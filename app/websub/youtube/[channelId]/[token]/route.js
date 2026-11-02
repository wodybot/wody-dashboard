import { createHash } from 'crypto';
import { getDb } from '@/lib/mongo';
import { topicForChannel, verifyWebSubSignature, verifyCallbackToken } from '@/lib/youtube';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

function text(body, status = 200) {
  return new Response(body, {
    status,
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
}

function log(...args) {
  console.log('[YouTube WebSub]', ...args);
}

function error(...args) {
  console.error('[YouTube WebSub]', ...args);
}

async function findVerifiedSub(db, channelId, token) {
  const sub = await db
    .collection('youtube_websub_subscriptions')
    .findOne({ youtube_channel_id: channelId });

  if (!sub) return null;
  if (!verifyCallbackToken(token, sub.callback_token)) return null;
  return sub;
}

export async function GET(request, { params }) {
  try {
    const { channelId, token } = await params;
    const { searchParams } = new URL(request.url);

    const mode = searchParams.get('hub.mode') || '';
    const topic = searchParams.get('hub.topic') || '';
    const challenge = searchParams.get('hub.challenge') || '';
    const leaseSecondsRaw = searchParams.get('hub.lease_seconds');

    log('GET verification received', { channelId, mode });

    if (!challenge) {
      error('GET rejected: missing hub.challenge', { channelId });
      return text('missing hub.challenge', 400);
    }

    const expectedTopic = topicForChannel(channelId);
    if (topic !== expectedTopic) {
      error('GET rejected: topic mismatch', { channelId, topic, expectedTopic });
      return text('topic mismatch', 404);
    }

    const db = await getDb();
    const sub = await findVerifiedSub(db, channelId, token);
    if (!sub) {
      error('GET rejected: unknown subscription or invalid token', { channelId });
      return text('unknown subscription', 404);
    }

    if (mode === 'subscribe') {
      const update = {
        status: 'verified',
        last_verified_at: new Date(),
        updated_at: new Date(),
      };

      const leaseSeconds = Number(leaseSecondsRaw);
      if (leaseSecondsRaw && Number.isFinite(leaseSeconds) && leaseSeconds > 0) {
        update.lease_seconds = leaseSeconds;
        update.expires_at = new Date(Date.now() + leaseSeconds * 1000);
      }

      await db.collection('youtube_websub_subscriptions').updateOne(
        { _id: sub._id },
        { $set: update },
      );

      log('Subscription verified', {
        channelId,
        leaseSeconds: update.lease_seconds ?? sub.lease_seconds ?? null,
      });
    } else if (mode === 'unsubscribe') {
      await db.collection('youtube_websub_subscriptions').updateOne(
        { _id: sub._id },
        {
          $set: {
            status: 'unsubscribed',
            unsubscribed_at: new Date(),
            updated_at: new Date(),
          },
        },
      );
      log('Subscription unsubscribed', { channelId });
    } else {
      error('GET rejected: unknown hub.mode', { channelId, mode });
      return text('unknown hub.mode', 400);
    }

    return text(challenge, 200);
  } catch (e) {
    error('GET handler failed', e);
    return text('internal error', 500);
  }
}

export async function POST(request, { params }) {
  let channelId = null;

  try {
    const resolved = await params;
    channelId = resolved.channelId;
    const token = resolved.token;

    log('POST notification received', {
      channelId,
      contentType: request.headers.get('content-type') || '',
    });

    const bodyBuffer = Buffer.from(await request.arrayBuffer());
    const signatureHeader =
      request.headers.get('x-hub-signature-256') ||
      request.headers.get('x-hub-signature') ||
      '';

    if (!bodyBuffer.length) {
      error('POST rejected: empty body', { channelId });
      return text('empty body', 400);
    }

    const db = await getDb();
    const sub = await findVerifiedSub(db, channelId, token);

    if (!sub) {
      error('POST rejected: unknown subscription or invalid token', { channelId });
      return text('unknown subscription', 404);
    }

    log('Subscription found and callback token validated', { channelId });

    if (!verifyWebSubSignature(bodyBuffer, sub.callback_secret, signatureHeader)) {
      error('POST rejected: invalid WebSub signature', {
        channelId,
        hasSignature: Boolean(signatureHeader),
      });
      return text('bad signature', 403);
    }

    log('WebSub signature validated', { channelId });

    const body = bodyBuffer.toString('utf8');
    const deliveryHash = createHash('sha256')
      .update(channelId)
      .update('\0')
      .update(bodyBuffer)
      .digest('hex');

    const now = new Date();

    // Insert atomically. A unique index on delivery_hash prevents hub
    // retries from filling the queue with identical deliveries.
    const result = await db.collection('youtube_pending_notifications').updateOne(
      { delivery_hash: deliveryHash },
      {
        $setOnInsert: {
          youtube_channel_id: channelId,
          body,
          delivery_hash: deliveryHash,
          received_at: now,
          processed: false,
          attempts: 0,
        },
      },
      { upsert: true },
    );

    if (result.upsertedCount === 1) {
      log('Pending notification inserted', {
        channelId,
        notificationId: String(result.upsertedId?._id || ''),
        bytes: bodyBuffer.length,
      });
    } else {
      log('Duplicate delivery ignored', { channelId, deliveryHash });
    }

    return text('ok', 200);
  } catch (e) {
    error('POST handler failed', { channelId, error: e?.stack || String(e) });
    // Returning 500 tells the hub the delivery was not accepted, allowing
    // it to retry instead of silently losing the notification.
    return text('internal error', 500);
  }
}

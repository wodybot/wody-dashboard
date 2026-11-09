import { NextResponse } from 'next/server';
import { getDb } from '../../../../lib/mongo';
import {
  generateCallbackToken,
  generateSecret,
  subscribeToHub,
  topicForChannel,
} from '../../../../lib/youtube';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const RENEW_WINDOW_MS = 24 * 60 * 60 * 1000;
const RETRY_DELAY_MS = 10 * 60 * 1000;

function authorized(request) {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    console.error('[YouTube WebSub] CRON_SECRET is not configured');
    return false;
  }

  const auth = request.headers.get('authorization');
  return auth === `Bearer ${expected}`;
}

async function renewSubscriptions() {
  const db = await getDb();
  const now = new Date();
  const renewBefore = new Date(now.getTime() + RENEW_WINDOW_MS);
  const retryBefore = new Date(now.getTime() - RETRY_DELAY_MS);

  const watchedChannelIds = await db.collection('youtube_notify_channels').distinct(
    'youtube_channel_id'
  );

  if (!watchedChannelIds.length) {
    return { checked: 0, attempted: 0, accepted: 0, failed: 0 };
  }

  const subscriptions = await db.collection('youtube_websub_subscriptions')
    .find({ youtube_channel_id: { $in: watchedChannelIds } })
    .toArray();

  let attempted = 0;
  let accepted = 0;
  let failed = 0;

  for (const sub of subscriptions) {
    const expiresAt = sub.expires_at ? new Date(sub.expires_at) : null;
    const lastAttempt = sub.last_renew_attempt_at
      ? new Date(sub.last_renew_attempt_at)
      : null;

    const missingCredentials = !sub.callback_secret || !sub.callback_token;
    const expiredOrExpiring = !expiresAt || expiresAt <= renewBefore;
    const unverified = sub.status !== 'verified';
    const neverSubscribed = !sub.last_subscribed_at;

    if (
      !missingCredentials &&
      !expiredOrExpiring &&
      !unverified &&
      !neverSubscribed
    ) {
      continue;
    }

    if (
      unverified &&
      lastAttempt &&
      lastAttempt > retryBefore &&
      !expiredOrExpiring &&
      !missingCredentials &&
      !neverSubscribed
    ) {
      continue;
    }

    attempted += 1;

    const secret = sub.callback_secret || generateSecret();
    const callbackToken = sub.callback_token || generateCallbackToken();

    const patch = {
      topic: topicForChannel(sub.youtube_channel_id),
      callback_secret: secret,
      callback_token: callbackToken,
      status: 'pending',
      last_subscribed_at: now,
      last_renew_attempt_at: now,
      updated_at: now,
    };

    await db.collection('youtube_websub_subscriptions').updateOne(
      { _id: sub._id },
      { $set: patch }
    );

    // One broken subscription (for example a missing WEBSUB_CALLBACK_BASE_URL, which throws) must not stop the others, and the
    // reason is saved on the subscription so the bot can report it.
    let result;
    try {
      result = await subscribeToHub(sub.youtube_channel_id, secret, callbackToken);
    } catch (e) {
      result = { ok: false, detail: String(e?.message || e) };
    }
    const { ok, detail } = result;

    if (ok) {
      accepted += 1;
      console.info(
        `[YouTube WebSub] Renew request accepted for ${sub.youtube_channel_id}`
      );
    } else {
      failed += 1;
      await db.collection('youtube_websub_subscriptions').updateOne(
        { _id: sub._id },
        {
          $set: {
            status: 'error',
            last_error: detail,
            updated_at: new Date(),
          },
        }
      );
      console.error(
        `[YouTube WebSub] Renew request failed for ${sub.youtube_channel_id}: ${detail}`
      );
    }
  }

  return {
    checked: subscriptions.length,
    attempted,
    accepted,
    failed,
  };
}

async function handler(request) {
  if (!authorized(request)) {
    console.error('[YouTube WebSub] Renewal call refused: the Authorization header does not match CRON_SECRET');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await renewSubscriptions();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error('[YouTube WebSub] Renewal job failed', error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Renewal job failed',
      },
      { status: 500 }
    );
  }
}

export async function GET(request) {
  return handler(request);
}

export async function POST(request) {
  return handler(request);
}

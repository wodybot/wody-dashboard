import { getDb } from '@/lib/mongo';
import {
  verifySignature, timestampFresh, getLiveStream, getBoxArt, getUserById, twitchConfigured,
} from '@/lib/streams/twitch';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

const text = (body, status = 200) => new Response(status === 204 ? null : body, { status, headers: { 'content-type': 'text/plain; charset=utf-8' } });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function enrichOnline(event) {
  const data = {
    user_id: String(event.broadcaster_user_id), login: event.broadcaster_user_login, name: event.broadcaster_user_name,
    stream_id: String(event.id || ''), started_at: event.started_at || new Date().toISOString(),
    title: '', game: '', game_id: '', viewers: 0, thumbnail_url: null, profile_image_url: null, box_art_url: null,
  };
  if (!twitchConfigured()) return data;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const live = await getLiveStream(data.user_id);
      if (live) {
        Object.assign(data, { title: live.title, game: live.game, game_id: live.game_id, viewers: live.viewers, thumbnail_url: live.thumbnail_url });
        break;
      }
    } catch { break; }
    await sleep(900);
  }
  try { const user = await getUserById(data.user_id); if (user) data.profile_image_url = user.avatar; } catch { }
  try { data.box_art_url = await getBoxArt(data.game_id); } catch { }
  return data;
}

export async function POST(request) {
  try {
    const raw = await request.text();
    const messageId = request.headers.get('twitch-eventsub-message-id');
    const timestamp = request.headers.get('twitch-eventsub-message-timestamp');
    const signature = request.headers.get('twitch-eventsub-message-signature');
    const type = request.headers.get('twitch-eventsub-message-type');

    let body;
    try { body = JSON.parse(raw); } catch { return text('bad request', 400); }
    const subType = body?.subscription?.type;
    const broadcasterId = body?.subscription?.condition?.broadcaster_user_id;
    if (!messageId || !timestamp || !signature || !subType || !broadcasterId) return text('bad request', 400);

    const db = await getDb();
    const sub = await db.collection('stream_twitch_subscriptions').findOne({ broadcaster_id: String(broadcasterId), type: subType });
    if (!sub) return text('unknown subscription', 404);
    if (!verifySignature({ messageId, timestamp, rawBody: raw, signature, secret: sub.secret })) return text('invalid signature', 403);
    if (!timestampFresh(timestamp)) return text('stale message', 403);

    if (type === 'webhook_callback_verification') {
      await db.collection('stream_twitch_subscriptions').updateOne(
        { _id: sub._id },
        { $set: { status: 'enabled', twitch_sub_id: body.subscription.id, verified_at: new Date(), updated_at: new Date(), revoked_reason: null } },
      );
      await db.collection('stream_notifications').updateMany(
        { platform: 'twitch', twitch_user_id: String(broadcasterId) }, { $set: { sub_status: 'enabled' } },
      );
      return text(String(body.challenge || ''), 200);
    }

    if (type === 'revocation') {
      await db.collection('stream_twitch_subscriptions').updateOne(
        { _id: sub._id }, { $set: { status: 'revoked', revoked_reason: body.subscription.status || 'revoked', updated_at: new Date() } },
      );
      await db.collection('stream_notifications').updateMany(
        { platform: 'twitch', twitch_user_id: String(broadcasterId) }, { $set: { sub_status: 'revoked' } },
      );
      return text('', 204);
    }

    if (type !== 'notification') return text('', 204);

    const eventKey = `twitch:${messageId}`;
    try {
      await db.collection('stream_events').insertOne({
        provider: 'twitch', kind: subType === 'stream.online' ? 'online' : 'offline', event_key: eventKey,
        processed: false, attempts: 0, claimed_at: null, received_at: new Date(),
        data: { user_id: String(broadcasterId), login: body.event?.broadcaster_user_login, name: body.event?.broadcaster_user_name },
      });
    } catch (e) {
      if (e?.code === 11000) return text('', 200);
      throw e;
    }
    if (subType === 'stream.online') {
      const data = await enrichOnline(body.event || {});
      await db.collection('stream_events').updateOne({ event_key: eventKey }, { $set: { data } });
    }
    return text('', 200);
  } catch (e) {
    console.error('[Twitch EventSub] handler failed', e);
    return text('internal error', 500);
  }
}

export async function GET() { return text('Twitch EventSub callback', 200); }

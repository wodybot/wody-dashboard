// Stream Notifications (Premium), dashboard side. One module, one provider
// interface (Twitch, TikTok):
//   status()      is the provider available, and if not, why
//   validate()    sanitize/resolve the provider part of a notification
//   subscribe()   create what the provider needs (EventSub subscriptions)
//   unsubscribe() remove it when nobody uses it anymore
//   connect()/disconnect() OAuth account link (TikTok)
// The bot implements delivery with the same shape (streams/providers.py).
import { ObjectId } from 'mongodb';
import DEFAULTS from '@/lib/economy-defaults.json';
import { requestBot } from '@/lib/bridge';
import crypto from 'node:crypto';
import { json, validationError, premiumRequired, notFound } from '@/lib/modules/http';
import {
  fail, pickBool, pickInt, pickEnum, pickColor, pickUrl, pickText, pickButtons, checkVariables,
} from '@/lib/modules/validate';
import {
  twitchConfigured, TwitchError, TWITCH_EVENT_TYPES, searchChannels, getUserByLogin, parseTwitchLogin,
  createSubscription, deleteSubscription, listSubscriptions, newSecret, callbackUrl,
} from '@/lib/streams/twitch';
import { tiktokStatus, authorizeUrl, revokeToken, getUserInfo, refreshAccessToken, TikTokError } from '@/lib/streams/tiktok';
import { decryptToken, encryptToken } from '@/lib/streams/crypto';

const S = DEFAULTS.streams;
export const STREAM_VARIABLES = ['streamer', 'streamer_name', 'title', 'game', 'viewers', 'url', 'started_at'];
export const MAX_NOTIFICATIONS = 25;
const THUMBS = ['streamer', 'game', 'none'];
const IMAGES = ['media', 'custom', 'none'];
const LANGS = ['server', 'en', 'ro', 'fr', 'it', 'de', 'es', 'pt', 'nl', 'tr'];

export const providers = {
  twitch: {
    key: 'twitch',
    status: () => (twitchConfigured()
      ? (callbackUrl().startsWith('https://') ? { available: true, reason: null } : { available: false, reason: 'callback_not_https' })
      : { available: false, reason: 'not_configured' }),
  },
  tiktok: { key: 'tiktok', status: tiktokStatus },
};

export function mergeMessage(doc) {
  return { ...structuredClone(S.message), ...(doc || {}) };
}

export function sanitizeMessage(input, existing) {
  const errors = [];
  const m = { ...existing };
  const has = (k) => input[k] !== undefined;
  for (const k of ['use_embed', 'timestamp']) if (has(k)) m[k] = pickBool(input[k], m[k]);
  if (has('title')) m.title = pickText(errors, 'message.title', input.title, 256);
  if (has('description')) m.description = pickText(errors, 'message.description', input.description, 1800);
  if (has('footer')) m.footer = pickText(errors, 'message.footer', input.footer, 200);
  if (has('offline_title')) m.offline_title = pickText(errors, 'message.offline_title', input.offline_title, 256);
  if (has('offline_description')) m.offline_description = pickText(errors, 'message.offline_description', input.offline_description, 1000);
  if (has('button_label')) m.button_label = pickText(errors, 'message.button_label', input.button_label, 80);
  for (const k of ['color', 'offline_color']) if (has(k)) m[k] = pickColor(errors, `message.${k}`, input[k], m[k]);
  if (has('thumbnail')) m.thumbnail = pickEnum(errors, 'message.thumbnail', input.thumbnail, THUMBS, m.thumbnail);
  if (has('image')) m.image = pickEnum(errors, 'message.image', input.image, IMAGES, m.image);
  if (has('image_url')) m.image_url = pickUrl(errors, 'message.image_url', input.image_url, '');
  if (has('buttons')) m.buttons = pickButtons(errors, 'message.buttons', input.buttons, 2);
  for (const k of ['title', 'description', 'footer', 'offline_title', 'offline_description']) if (has(k)) checkVariables(errors, `message.${k}`, m[k], STREAM_VARIABLES);
  if (m.image === 'custom' && !m.image_url) fail(errors, 'message.image_url', 'required');
  return { message: m, errors };
}

function subStatus(subs) {
  if (!subs.length) return 'pending';
  if (subs.some((s) => s.status === 'failed')) return 'failed';
  if (subs.some((s) => s.status === 'revoked')) return 'revoked';
  return subs.every((s) => s.status === 'enabled') ? 'enabled' : 'pending';
}

async function ensureSubscriptions(db, broadcasterId, { force = false } = {}) {
  const coll = db.collection('stream_twitch_subscriptions');
  for (const type of TWITCH_EVENT_TYPES) {
    let sub = await coll.findOne({ broadcaster_id: broadcasterId, type });
    if (sub && sub.status === 'enabled' && !force) continue;
    const secret = newSecret();
    if (!sub) {
      try { await coll.insertOne({ broadcaster_id: broadcasterId, type, secret, status: 'pending', created_at: new Date() }); } catch (e) { if (e?.code !== 11000) throw e; }
    } else {
      if (sub.twitch_sub_id) await deleteSubscription(sub.twitch_sub_id).catch(() => {});
      await coll.updateOne({ _id: sub._id }, { $set: { secret, status: 'pending', twitch_sub_id: null, last_error: null, updated_at: new Date() } });
    }
    sub = await coll.findOne({ broadcaster_id: broadcasterId, type });
    let created;
    try {
      created = await createSubscription({ type, broadcasterId, secret: sub.secret });
    } catch (e) {
      if (e instanceof TwitchError && e.code === 'conflict') {
        // An older subscription for the same channel exists at Twitch (for
        // example created before a reset). Remove it and create ours.
        const existing = await listSubscriptions({ type, user_id: broadcasterId }).catch(() => []);
        for (const old of existing) await deleteSubscription(old.id).catch(() => {});
        created = await createSubscription({ type, broadcasterId, secret: sub.secret });
      } else {
        await coll.updateOne({ _id: sub._id }, { $set: { status: 'failed', last_error: e.code || 'error', updated_at: new Date() } });
        throw e;
      }
    }
    // Twitch calls our callback to verify BEFORE this response arrives, which
    // already marked the subscription enabled; only record the id here.
    await coll.updateOne({ _id: sub._id }, { $set: { twitch_sub_id: created.id, updated_at: new Date() } });
    await coll.updateOne({ _id: sub._id, status: 'pending' }, { $set: { status: created.status === 'enabled' ? 'enabled' : 'pending' } });
  }
}

async function releaseBroadcasterIfUnused(db, broadcasterId) {
  const used = await db.collection('stream_notifications').countDocuments({ platform: 'twitch', twitch_user_id: broadcasterId });
  if (used) return;
  const subs = await db.collection('stream_twitch_subscriptions').find({ broadcaster_id: broadcasterId }).toArray();
  for (const s of subs) if (s.twitch_sub_id) await deleteSubscription(s.twitch_sub_id).catch(() => {});
  await db.collection('stream_twitch_subscriptions').deleteMany({ broadcaster_id: broadcasterId });
}

function publicNotification(doc, h, subs, connection) {
  const n = h.serializeDoc(doc);
  n.message = mergeMessage(n.message);
  if (doc.platform === 'twitch') n.sub_status = subStatus(subs);
  if (doc.platform === 'tiktok') {
    n.sub_status = connection?.status === 'connected' ? 'enabled' : 'disconnected';
    n.connection_id = String(doc.connection_id);
  }
  return n;
}

function publicConnection(c, h) {
  return {
    id: String(c._id), open_id: c.open_id, username: c.username || '', display_name: c.display_name || '', avatar_url: c.avatar_url || '',
    profile_url: c.profile_url || '', status: c.status, status_reason: c.status_reason || null, scope: c.scope || '',
    connected_at: c.created_at, last_poll_at: c.last_poll_at || null, access_expires_at: c.access_expires_at || null,
  };
}

async function loadNotification(db, gidLong, id) {
  if (!/^[a-f0-9]{24}$/.test(id)) return null;
  return db.collection('stream_notifications').findOne({ _id: new ObjectId(id), guild_id: gidLong });
}

// The TikTok account the signed in person already linked on wody.online/tiktok (their own, never anyone else's),
// so a server can use it without a second login. Tokens never leave the server.
async function myTikTok(db, session, conns) {
  try {
    const l = await db.collection('user_tiktok_links').findOne({ user_id: String(session?.user?.id || '') }, { projection: { open_id: 1, username: 1, display_name: 1, avatar_url: 1, access_token_enc: 1 } });
    if (!l || !l.access_token_enc || !l.open_id) return null;
    return { username: l.username || '', display_name: l.display_name || '', avatar_url: l.avatar_url || '', already: conns.some((c) => c.open_id === l.open_id && c.status === 'connected') };
  } catch { return null; }
}

export async function streamsGet(ctx) {
  const { sub, url, db, gidLong, guildId, h, premium, session } = ctx;
  if (!premium) return json({ premium: false });
  if (sub === 'streams') {
    const rows = await db.collection('stream_notifications').find({ guild_id: gidLong }).sort({ created_at: 1 }).limit(MAX_NOTIFICATIONS + 5).toArray();
    const conns = await db.collection('stream_tiktok_connections').find({ guild_id: gidLong }).toArray();
    const connById = new Map(conns.map((c) => [String(c._id), c]));
    const ids = [...new Set(rows.filter((r) => r.platform === 'twitch').map((r) => r.twitch_user_id))];
    const subs = ids.length ? await db.collection('stream_twitch_subscriptions').find({ broadcaster_id: { $in: ids } }).toArray() : [];
    return json({
      premium: true, max: MAX_NOTIFICATIONS, variables: STREAM_VARIABLES,
      providers: Object.fromEntries(Object.values(providers).map((p) => [p.key, p.status()])),
      notifications: rows.map((r) => publicNotification(r, h, subs.filter((s) => s.broadcaster_id === r.twitch_user_id), connById.get(String(r.connection_id)))),
      connections: conns.map((c) => publicConnection(c, h)),
      my_tiktok: await myTikTok(db, session, conns),
      callback_url: callbackUrl(),
    });
  }
  if (sub === 'streams/search') {
    const status = providers.twitch.status();
    if (!status.available) return json({ error: status.reason, results: [] }, { status: 503 });
    try { return json({ results: await searchChannels(url.searchParams.get('q')) }); } catch (e) {
      return json({ error: e.code || 'unreachable', results: [] }, { status: 502 });
    }
  }
  if (sub === 'streams/diagnose') {
    const result = await requestBot({ kind: 'stream_diagnose', guildId, userId: session.user.id });
    return json(result, { status: result.error ? 502 : 200 });
  }
  return null;
}

export async function streamsMutate(ctx) {
  const { sub, method, body, db, gidLong, guildId, h, session, premium } = ctx;
  if (!premium) return premiumRequired();

  if (sub === 'streams' && method === 'POST') {
    const platform = body.platform;
    if (!['twitch', 'tiktok'].includes(platform)) return validationError([{ field: 'platform', code: 'invalid_choice' }]);
    const status = providers[platform].status();
    if (!status.available) return json({ error: 'provider_unavailable', reason: status.reason }, { status: 503 });
    const count = await db.collection('stream_notifications').countDocuments({ guild_id: gidLong });
    if (count >= MAX_NOTIFICATIONS) return json({ error: 'limit_reached', max: MAX_NOTIFICATIONS }, { status: 400 });
    const errors = [];
    const doc = {
      guild_id: gidLong, platform, enabled: true, notify_online: true, notify_offline: false, cooldown_minutes: 5, language: 'server',
      role_id: null, message: structuredClone(S.message), created_at: new Date(), updated_at: new Date(),
    };
    if (!body.channel_id || !(await h.assertChannelInGuild(guildId, body.channel_id))) fail(errors, 'channel_id', body.channel_id ? 'invalid_channel' : 'required');
    doc.channel_id = String(body.channel_id || '');
    if (body.role_id) { if (await h.assertRoleInGuild(guildId, body.role_id)) doc.role_id = String(body.role_id); else fail(errors, 'role_id', 'invalid_role'); }
    if (platform === 'twitch') {
      const login = parseTwitchLogin(body.twitch_login || body.twitch_user_login);
      if (!login) fail(errors, 'twitch_login', 'invalid_twitch_login');
      if (errors.length) return validationError(errors);
      let user;
      try { user = await getUserByLogin(login); } catch (e) { return json({ error: e.code || 'unreachable' }, { status: 502 }); }
      if (!user) return validationError([{ field: 'twitch_login', code: 'streamer_not_found' }]);
      const dupe = await db.collection('stream_notifications').countDocuments({ guild_id: gidLong, platform: 'twitch', twitch_user_id: user.id, channel_id: h.toLong(doc.channel_id) });
      if (dupe) return validationError([{ field: 'twitch_login', code: 'duplicate_notification' }]);
      Object.assign(doc, { twitch_login: user.login, twitch_user_id: user.id, twitch_display_name: user.name, twitch_avatar: user.avatar });
      try { await ensureSubscriptions(db, user.id); } catch (e) { return json({ error: e.code || 'subscription_failed' }, { status: 502 }); }
    } else {
      let conn = null;
      if (/^[a-f0-9]{24}$/.test(String(body.connection_id || ''))) conn = await db.collection('stream_tiktok_connections').findOne({ _id: new ObjectId(body.connection_id), guild_id: gidLong });
      if (!conn || conn.status !== 'connected') fail(errors, 'connection_id', 'tiktok_not_connected');
      if (errors.length) return validationError(errors);
      Object.assign(doc, { connection_id: conn._id, tiktok_username: conn.username, tiktok_display_name: conn.display_name, tiktok_avatar: conn.avatar_url });
    }
    if (errors.length) return validationError(errors);
    const store = h.deserializeInput({ channel_id: doc.channel_id, role_id: doc.role_id });
    const res = await db.collection('stream_notifications').insertOne({ ...doc, channel_id: store.channel_id, role_id: store.role_id });
    return json({ ok: true, id: String(res.insertedId) });
  }

  const idMatch = sub.match(/^streams\/([a-f0-9]{24})(?:\/(test|reconnect))?$/);
  if (idMatch) {
    const doc = await loadNotification(db, gidLong, idMatch[1]);
    if (!doc) return notFound();
    const action = idMatch[2];

    if (!action && (method === 'PUT' || method === 'PATCH')) {
      const errors = [];
      const patch = {};
      if (body.channel_id !== undefined) {
        if (!(await h.assertChannelInGuild(guildId, body.channel_id))) fail(errors, 'channel_id', 'invalid_channel'); else patch.channel_id = h.toLong(body.channel_id);
      }
      if (body.role_id !== undefined) {
        if (!body.role_id) patch.role_id = null; else if (!(await h.assertRoleInGuild(guildId, body.role_id))) fail(errors, 'role_id', 'invalid_role'); else patch.role_id = h.toLong(body.role_id);
      }
      for (const k of ['enabled', 'notify_online', 'notify_offline']) if (body[k] !== undefined) patch[k] = pickBool(body[k], doc[k]);
      if (body.cooldown_minutes !== undefined) patch.cooldown_minutes = pickInt(errors, 'cooldown_minutes', body.cooldown_minutes, 0, 1440, doc.cooldown_minutes ?? 5);
      if (body.message && typeof body.message === 'object') {
        const r = sanitizeMessage(body.message, mergeMessage(doc.message));
        errors.push(...r.errors);
        patch.message = r.message;
      }
      if (errors.length) return validationError(errors);
      await db.collection('stream_notifications').updateOne({ _id: doc._id }, { $set: { ...patch, updated_at: new Date() } });
      return json({ ok: true });
    }
    if (!action && method === 'DELETE') {
      await db.collection('stream_notifications').deleteOne({ _id: doc._id });
      await db.collection('stream_state').deleteOne({ notification_id: doc._id });
      if (doc.platform === 'twitch') await releaseBroadcasterIfUnused(db, doc.twitch_user_id);
      return json({ ok: true });
    }
    if (action === 'test' && method === 'POST') {
      const result = await requestBot({ kind: 'stream_test', guildId, userId: session.user.id,
        payload: { notification_id: String(doc._id), kind: body.kind === 'offline' ? 'offline' : 'online' } });
      return json(result, { status: result.error ? (result.error === 'rate_limited' ? 429 : 502) : 200 });
    }
    if (action === 'reconnect' && method === 'POST' && doc.platform === 'twitch') {
      try { await ensureSubscriptions(db, doc.twitch_user_id, { force: true }); } catch (e) { return json({ error: e.code || 'subscription_failed' }, { status: 502 }); }
      return json({ ok: true });
    }
  }

  if (sub === 'streams/tiktok/connect' && method === 'POST') {
    const status = tiktokStatus();
    if (!status.available) return json({ error: 'provider_unavailable', reason: status.reason }, { status: 503 });
    // The state lives only in the database, bound to this user and server. No cookie is set.
    const state = crypto.randomBytes(24).toString('base64url');
    await db.collection('stream_oauth_states').insertOne({ state, guild_id: gidLong, user_id: h.toLong(session.user.id), expires_at: new Date(Date.now() + 10 * 60_000) });
    return json({ url: authorizeUrl(state) });
  }

  // Use the account the person already linked on /tiktok for this server: no second login, the same official grant.
  if (sub === 'streams/tiktok/use-mine' && method === 'POST') {
    const status = tiktokStatus();
    if (!status.available) return json({ error: 'provider_unavailable', reason: status.reason }, { status: 503 });
    const link = await db.collection('user_tiktok_links').findOne({ user_id: String(session.user.id) });
    if (!link || !link.access_token_enc || !link.refresh_token_enc || !link.open_id) return json({ error: 'tiktok_not_linked' }, { status: 404 });
    const now = new Date();
    await db.collection('stream_tiktok_connections').updateOne(
      { guild_id: gidLong, open_id: link.open_id },
      {
        $set: {
          username: link.username, display_name: link.display_name, avatar_url: link.avatar_url, profile_url: link.profile_url,
          status: 'connected', status_reason: null, scope: link.scope || '',
          access_token_enc: link.access_token_enc, refresh_token_enc: link.refresh_token_enc,
          access_expires_at: link.access_expires_at, refresh_expires_at: link.refresh_expires_at,
          connected_by: h.toLong(session.user.id), updated_at: now, last_poll_at: null, last_video_ts: null,
        },
        $setOnInsert: { guild_id: gidLong, open_id: link.open_id, created_at: now },
      },
      { upsert: true },
    );
    return json({ ok: true });
  }

  const connMatch = sub.match(/^streams\/tiktok\/connections\/([a-f0-9]{24})(?:\/(refresh))?$/);
  if (connMatch) {
    const conn = await db.collection('stream_tiktok_connections').findOne({ _id: new ObjectId(connMatch[1]), guild_id: gidLong });
    if (!conn) return notFound();
    if (connMatch[2] === 'refresh' && method === 'POST') {
      if (conn.status !== 'connected') return json({ error: 'tiktok_not_connected' }, { status: 409 });
      try {
        let access = decryptToken(conn.access_token_enc);
        let profile;
        try { profile = await getUserInfo(access); } catch (e) {
          if (!(e instanceof TikTokError)) throw e;
          const tokens = await refreshAccessToken(decryptToken(conn.refresh_token_enc));
          access = tokens.access_token;
          await db.collection('stream_tiktok_connections').updateOne({ _id: conn._id }, { $set: {
            access_token_enc: encryptToken(tokens.access_token), refresh_token_enc: encryptToken(tokens.refresh_token),
            access_expires_at: new Date(Date.now() + Number(tokens.expires_in || 86400) * 1000),
            refresh_expires_at: new Date(Date.now() + Number(tokens.refresh_expires_in || 31536000) * 1000) } });
          profile = await getUserInfo(access);
        }
        await db.collection('stream_tiktok_connections').updateOne({ _id: conn._id }, { $set: {
          username: profile.username, display_name: profile.display_name, avatar_url: profile.avatar_url, updated_at: new Date() } });
        return json({ ok: true });
      } catch (e) {
        if (e instanceof TikTokError && ['invalid_grant', 'token_failed', 'user_failed'].includes(e.code)) {
          await db.collection('stream_tiktok_connections').updateOne({ _id: conn._id }, { $set: { status: 'expired', status_reason: e.code } });
          return json({ error: 'tiktok_expired' }, { status: 409 });
        }
        return json({ error: 'unreachable' }, { status: 502 });
      }
    }
    if (!connMatch[2] && method === 'DELETE') {
      try { if (conn.access_token_enc) await revokeToken(decryptToken(conn.access_token_enc)); } catch { /* token unreadable or already revoked */ }
      await db.collection('stream_tiktok_connections').deleteOne({ _id: conn._id });
      await db.collection('stream_notifications').updateMany({ guild_id: gidLong, platform: 'tiktok', connection_id: conn._id }, { $set: { enabled: false } });
      return json({ ok: true });
    }
  }
  return null;
}

import { MongoClient, Long } from 'mongodb';

const uri = process.env.BOT_MONGO_URL;
const dbName = process.env.BOT_MONGO_DB || 'discord_bot';

// The MongoClient is created lazily, on the first getDb() call, instead of
// eagerly at module import time. Next.js imports this module during the
// build's "Collecting page data" step, in an environment where runtime env
// vars like BOT_MONGO_URL aren't guaranteed to be set, constructing the
// client at import time made `new MongoClient(undefined)` crash the build
// (MongoClient's own connection-string parser throws trying to read
// .startsWith() off an undefined uri). Deferring construction to getDb()
// means it only ever runs at request time, when the real env var is
// present, with no change to runtime behavior: it's still built once and
// cached on `global._botMongo` exactly as before.
//
// A failed first connection used to stay cached forever: the rejected promise was reused by every later request
// on that server instance, so pages such as the blog worked, then did not, until the instance restarted. The
// failed attempt is now dropped so the very next request connects again, and an attempt gives up after 10 s
// instead of the driver's default 30 s, so a page shows its error screen (with retry) quickly.
function getClientPromise() {
  if (!uri) throw new Error('BOT_MONGO_URL is not set. Add it in the hosting environment variables (and redeploy).');
  if (!global._botMongo) {
    const attempt = new MongoClient(uri, { maxPoolSize: 10, serverSelectionTimeoutMS: 10000 }).connect();
    global._botMongo = attempt;
    attempt.catch(() => { if (global._botMongo === attempt) global._botMongo = null; });
  }
  return global._botMongo;
}

let indexesEnsured = false;
async function ensureIndexes(db) {
  if (indexesEnsured) return;
  indexesEnsured = true;
  try {
    await Promise.all([
      // Backs the per-guild premium lookup in route.js (isGuildPremium),
      // which now runs multiple times per request across several modules.
      db.collection('premium_servers').createIndex({ guild_id: 1, active: 1 }),
      // Backs the periodic global expiry sweep (sweepExpiredPremium).
      db.collection('premium_servers').createIndex({ active: 1, expires_at: 1 }),
      db.collection('premium_keys').createIndex({ key: 1 }),
      db.collection('forums').createIndex({ guild_id: 1 }),
      // Prevent duplicate WebSub redeliveries from creating duplicate
      // pending notifications. delivery_hash is only present on the
      // YouTube WebSub documents written by the callback route.
      db.collection('youtube_pending_notifications').createIndex(
        { delivery_hash: 1 },
        { unique: true, sparse: true },
      ),
      db.collection('youtube_pending_notifications').createIndex({ processed: 1, received_at: 1 }),
      // Backs the persistent, cross-instance mutation rate limiter in
      // route.js (rateLimited). expireAfterSeconds: 0 means "expire
      // exactly at expires_at", each bucket document deletes itself a
      // little after its own window closes, so this collection never
      // grows unbounded.
      db.collection('rate_limit_buckets').createIndex({ expires_at: 1 }, { expireAfterSeconds: 0 }),
      // captcha_settings/captcha_verifications back a PUBLIC, unauthenticated
      // endpoint (app/api/verify/[guildId]/route.js, reachable by anyone
      // with the link, not just logged-in dashboard users like every other
      // module). Without this index, a flood of requests against that route
      // would force a full collection scan per request instead of a direct
      // lookup, which is a much cheaper way to degrade the database than the
      // other, auth-gated routes. unique: true also enforces one settings
      // doc per guild at the database level, not just in application code.
      db.collection('captcha_settings').createIndex({ guild_id: 1 }, { unique: true }),
      db.collection('captcha_verifications').createIndex({ guild_id: 1, user_id: 1 }),
      // Arithmetic challenges issued by app/api/verify/[guildId]/route.js.
      // The TTL index is a hard backstop, not the actual expiry check: the
      // route already refuses any challenge whose expires_at has passed, so
      // a document lingering a minute past its deadline can never be
      // redeemed. This just stops the collection growing without bound,
      // since a challenge is created on every load of a public page.
      db.collection('captcha_challenges').createIndex({ expires_at: 1 }, { expireAfterSeconds: 0 }),
      db.collection('captcha_challenges').createIndex({ guild_id: 1, user_id: 1 }),
      // Sessions had no index beyond _id and nothing ever deleted an
      // expired one, so abandoned logins accumulated indefinitely. See the
      // expires_at comment in lib/session.js for why `exp` couldn't be
      // used for this directly.
      db.collection('sessions').createIndex({ expires_at: 1 }, { expireAfterSeconds: 0 }),
      // Stream Notifications. The unique keys also exist on the bot side
      // (db.py); creating them here too means a webhook that arrives before the
      // bot has started still gets duplicate protection.
      db.collection('stream_events').createIndex({ event_key: 1 }, { unique: true }),
      db.collection('stream_events').createIndex({ received_at: 1 }, { expireAfterSeconds: 7 * 24 * 3600 }),
      db.collection('stream_twitch_subscriptions').createIndex({ broadcaster_id: 1, type: 1 }, { unique: true }),
      db.collection('stream_oauth_states').createIndex({ state: 1 }, { unique: true }),
      db.collection('stream_oauth_states').createIndex({ expires_at: 1 }, { expireAfterSeconds: 0 }),
      db.collection('user_tiktok_links').createIndex({ user_id: 1 }, { unique: true }),
      db.collection('stream_webhook_events').createIndex({ created_at: 1 }, { expireAfterSeconds: 3 * 24 * 3600 }),
      db.collection('module_requests').createIndex({ created_at: 1 }, { expireAfterSeconds: 24 * 3600 }),
    ]);
  } catch (e) {
    // Non-fatal: worst case we fall back to an unindexed scan, but we never
    // want index creation to break a request.
    console.error('ensureIndexes failed', e);
  }
}

export async function getDb() {
  const client = await getClientPromise();
  const db = client.db(dbName);
  ensureIndexes(db).catch(() => {});
  return db;
}

export { Long };

// ---------------- ID helpers (Discord snowflakes are 64-bit) ----------------
const ID_FIELDS = new Set([
  'guild_id', 'channel_id', 'role_id', 'user_id', 'message_id',
  'admin_role_id', 'moderator_role_id', 'ticket_role_id', 'giveaway_role_id', 'event_role_id',
  'mod_log_channel_id', 'suggestion_channel_id', 'level_channel_id',
  'log_channel_id', 'auto_role_id', 'category_id', 'support_role_id',
  'transcript_channel_id', 'transcript_default_channel_id', 'panel_channel_id', 'created_by', 'closed_by',
  'claimed_by', 'activated_by', 'parent_id', 'host_id',
  'ticket_transcript_channel_id', 'temp_voice_hub_channel_id', 'temp_voice_category_id',
  'owner_id',
  // Economy / Birthdays / Stream Notifications
  'seller_id', 'buyer_id', 'actor_id', 'target_id', 'requested_by', 'connected_by',
  'announce_channel_id', 'reminder_channel_id', 'board_channel_id', 'board_message_id', 'mention_role_id', 'reminder_role_id',
  // Invite Tracking
  'notify_channel_id',
]);
const ID_ARRAY_FIELDS = new Set(['whitelist_role_ids', 'extra_users', 'used_by_guilds', 'level_ignored_channel_ids', 'staff_role_ids']);

export function toLong(v) {
  if (v === null || v === undefined || v === '') return null;
  if (v && typeof v === 'object' && (v._bsontype === 'Long' || v.constructor?.name === 'Long')) return v;
  if (typeof v === 'bigint') return Long.fromBigInt(v);
  if (typeof v === 'number') return Long.fromNumber(v);
  // Long.fromString throws on anything non-numeric. Because this runs deep
  // inside request handling (deserializeInput, every id field on every
  // settings save), that throw surfaced as an opaque HTTP 500 rather than
  // the 400 a malformed id deserves. Returning null instead lets callers
  // treat it as "no id given", which every call site already handles, and
  // the route-level validation that runs before this is what rejects the
  // request properly.
  const raw = String(v).trim();
  if (!/^-?\d{1,20}$/.test(raw)) return null;
  try {
    return Long.fromString(raw);
  } catch {
    return null;
  }
}

function toStr(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'object' && typeof v.toString === 'function') return v.toString();
  return String(v);
}

function serializeValue(v) {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'object' && v._bsontype) return toStr(v);
  if (Array.isArray(v)) return v.map(serializeValue);
  if (typeof v === 'object') {
    const out = {};
    for (const [k, val] of Object.entries(v)) {
      if (ID_FIELDS.has(k)) { out[k] = toStr(val); continue; }
      out[k] = serializeValue(val);
    }
    return out;
  }
  return v;
}

export function serializeDoc(d) {
  if (!d) return null;
  const out = {};
  for (const [k, v] of Object.entries(d)) {
    if (k === '_id') { out._id = toStr(v); continue; }
    if (v === null || v === undefined) { out[k] = null; continue; }
    if (ID_FIELDS.has(k)) { out[k] = toStr(v); continue; }
    if (ID_ARRAY_FIELDS.has(k) && Array.isArray(v)) { out[k] = v.map(toStr); continue; }
    if (v instanceof Date) { out[k] = v.toISOString(); continue; }
    if (Array.isArray(v)) { out[k] = v.map(serializeValue); continue; }
    if (typeof v === 'object' && v._bsontype) { out[k] = toStr(v); continue; }
    out[k] = v;
  }
  return out;
}

export function deserializeInput(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj || {})) {
    if (v === null || v === undefined || v === '') { out[k] = null; continue; }
    if (ID_FIELDS.has(k)) { out[k] = toLong(v); continue; }
    if (ID_ARRAY_FIELDS.has(k) && Array.isArray(v)) {
      out[k] = v.map(toLong).filter(Boolean);
      continue;
    }
    out[k] = v;
  }
  return out;
}

import { MongoClient, Long } from 'mongodb';

const uri = process.env.BOT_MONGO_URL;
const dbName = process.env.BOT_MONGO_DB || 'discord_bot';

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
      db.collection('premium_servers').createIndex({ guild_id: 1, active: 1 }),
      db.collection('premium_servers').createIndex({ active: 1, expires_at: 1 }),
      db.collection('premium_keys').createIndex({ key: 1 }),
      db.collection('forums').createIndex({ guild_id: 1 }),
      db.collection('youtube_pending_notifications').createIndex(
        { delivery_hash: 1 },
        { unique: true, sparse: true },
      ),
      db.collection('youtube_pending_notifications').createIndex({ processed: 1, received_at: 1 }),
      db.collection('rate_limit_buckets').createIndex({ expires_at: 1 }, { expireAfterSeconds: 0 }),
      db.collection('captcha_settings').createIndex({ guild_id: 1 }, { unique: true }),
      db.collection('captcha_verifications').createIndex({ guild_id: 1, user_id: 1 }),
      db.collection('captcha_challenges').createIndex({ expires_at: 1 }, { expireAfterSeconds: 0 }),
      db.collection('captcha_challenges').createIndex({ guild_id: 1, user_id: 1 }),
      db.collection('sessions').createIndex({ expires_at: 1 }, { expireAfterSeconds: 0 }),
      db.collection('stream_events').createIndex({ event_key: 1 }, { unique: true }),
      db.collection('stream_events').createIndex({ received_at: 1 }, { expireAfterSeconds: 7 * 24 * 3600 }),
      db.collection('stream_twitch_subscriptions').createIndex({ broadcaster_id: 1, type: 1 }, { unique: true }),
      db.collection('stream_oauth_states').createIndex({ state: 1 }, { unique: true }),
      db.collection('stream_oauth_states').createIndex({ expires_at: 1 }, { expireAfterSeconds: 0 }),
      db.collection('user_tiktok_links').createIndex({ user_id: 1 }, { unique: true }),
      db.collection('stream_webhook_events').createIndex({ created_at: 1 }, { expireAfterSeconds: 3 * 24 * 3600 }),
      db.collection('module_requests').createIndex({ created_at: 1 }, { expireAfterSeconds: 24 * 3600 }),
      // Wody Link (same specs as wody_link/store.py ensure_indexes, so whichever side starts first creates them)
      db.collection('link_bridges').createIndex({ pair_key: 1 }, { unique: true }),
      db.collection('link_bridges').createIndex({ 'a.guild_id': 1 }),
      db.collection('link_bridges').createIndex({ 'b.guild_id': 1 }),
      db.collection('link_bridges').createIndex({ owner_id: 1 }),
      db.collection('link_deliveries').createIndex({ bridge_id: 1, src_message_id: 1 }, { unique: true }),
      db.collection('link_deliveries').createIndex({ bridge_id: 1, created_at: -1 }),
      db.collection('link_history').createIndex({ bridge_id: 1, at: -1 }),
    ]);
  } catch (e) {
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

const ID_FIELDS = new Set([
  'guild_id', 'channel_id', 'role_id', 'user_id', 'message_id',
  'admin_role_id', 'moderator_role_id', 'ticket_role_id', 'giveaway_role_id', 'event_role_id',
  'mod_log_channel_id', 'suggestion_channel_id', 'level_channel_id',
  'log_channel_id', 'auto_role_id', 'category_id', 'support_role_id',
  'transcript_channel_id', 'transcript_default_channel_id', 'panel_channel_id', 'created_by', 'closed_by',
  'claimed_by', 'activated_by', 'parent_id', 'host_id',
  'ticket_transcript_channel_id', 'temp_voice_hub_channel_id', 'temp_voice_category_id',
  'owner_id',
  'seller_id', 'buyer_id', 'actor_id', 'target_id', 'requested_by', 'connected_by',
  'announce_channel_id', 'reminder_channel_id', 'board_channel_id', 'board_message_id', 'mention_role_id', 'reminder_role_id',
  'notify_channel_id',
]);
const ID_ARRAY_FIELDS = new Set(['whitelist_role_ids', 'extra_users', 'used_by_guilds', 'level_ignored_channel_ids', 'staff_role_ids']);

export function toLong(v) {
  if (v === null || v === undefined || v === '') return null;
  if (v && typeof v === 'object' && (v._bsontype === 'Long' || v.constructor?.name === 'Long')) return v;
  if (typeof v === 'bigint') return Long.fromBigInt(v);
  if (typeof v === 'number') return Long.fromNumber(v);
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

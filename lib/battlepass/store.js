// Mongo access for the Battle Pass dashboard. Same collections and document shapes as wody_battlepass/store.py:
// seasons keep an ObjectId _id, progress/claims/stats refer to it by its hex string, guild ids are stored as Long.
import { ObjectId } from 'mongodb';
import { toLong } from '@/lib/mongo';
import { COLL, DEFAULT_GUILD_LIMITS } from './constants.js';
import { normalizeTheme } from './page-theme.js';

export const oid = (v) => (/^[a-f0-9]{24}$/i.test(String(v || '')) ? new ObjectId(String(v)) : null);
const iso = (d) => (d ? new Date(d).toISOString() : null);
const str = (v) => (v === null || v === undefined ? null : String(v));

/** A season as the browser sees it. `full` includes the rewards, quests and settings, the list view stays small. */
export function seasonView(doc, { full = false } = {}) {
  const base = {
    id: str(doc._id), scope: doc.scope, guild_id: str(doc.guild_id), status: doc.status,
    name: doc.name, description: doc.description || '', i18n: doc.i18n || null,
    starts_at: iso(doc.starts_at), ends_at: iso(doc.ends_at), activated_at: iso(doc.activated_at),
    created_at: iso(doc.created_at), updated_at: iso(doc.updated_at), level_count: doc.level_count || (doc.levels || []).length,
    rewards_count: (doc.rewards || []).length, version: doc.version || 1,
    page: { accent: doc.page?.accent, preset: doc.page?.preset, mode: doc.page?.mode },
  };
  if (!full) return base;
  return {
    ...base, curve: doc.curve, overrides: doc.overrides || {}, levels: doc.levels || [], xp: doc.xp, rewards: doc.rewards || [],
    quests: doc.quests || [], achievements: doc.achievements || [], collections: doc.collections || [],
    protection: doc.protection, notifications: doc.notifications, page: normalizeTheme(doc.page),
  };
}

/**
 * The bot counts daily totals with $inc on dotted names ("xp.message", "refused.cooldown"), which Mongo stores as nested
 * objects ({ xp: { message } }). This turns one stats document back into flat names so every reader sums the same keys.
 */
export function flatStats(doc, prefix = '', out = {}) {
  for (const [k, v] of Object.entries(doc || {})) {
    if (!prefix && ['_id', 'season_id', 'day', 'at'].includes(k)) continue;
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !(v instanceof Date) && !Array.isArray(v) && v._bsontype === undefined) flatStats(v, key, out);
    else if (typeof v === 'number' || typeof v === 'bigint') out[key] = Number(v) || 0;
    else if (v && typeof v.toNumber === 'function') out[key] = v.toNumber() || 0;
  }
  return out;
}

/** The shape the priority functions read (dates as Date, ids as strings). */
export const forPriority = (d) => ({ ...d, id: str(d._id), guild_id: str(d.guild_id) });

export async function loadLimits(db) {
  try {
    const doc = await db.collection(COLL.state).findOne({ _id: 'limits' });
    return { ...DEFAULT_GUILD_LIMITS, ...(doc?.values || {}) };
  } catch { return { ...DEFAULT_GUILD_LIMITS }; }
}

export async function audit(db, { seasonId = null, actor, action, target = null, changes = {}, result = 'ok' }) {
  try {
    await db.collection(COLL.audit).insertOne({
      at: new Date(), season_id: seasonId ? String(seasonId) : null, actor: actor ? toLong(actor) : null, action, target, changes, result,
    });
  } catch (e) { console.error('[battlepass] audit failed', e?.message); }
}

/**
 * Runs `fn` while holding a short lock stored in Mongo, so two requests changing the same thing (activating two global seasons,
 * activating a server season while a global one starts) are applied one after the other. The lock expires on its own.
 */
export async function withLock(db, key, fn, { ttlMs = 15000 } = {}) {
  const col = db.collection(COLL.state);
  const id = `lock:${key}`;
  const now = new Date();
  const token = new ObjectId().toHexString();
  try {
    await col.updateOne({ _id: id, until: { $lt: now } }, { $set: { until: new Date(now.getTime() + ttlMs), token } }, { upsert: true });
  } catch (e) {
    if (e?.code === 11000) return { locked: true };
    throw e;
  }
  try {
    return { locked: false, value: await fn() };
  } finally {
    try { await col.updateOne({ _id: id, token }, { $set: { until: new Date(0) } }); } catch { /* the lock expires on its own */ }
  }
}

/** Asks the bot to drop its cached copy of the seasons (fire and forget; the bot also refreshes by itself every 30 seconds). */
export async function notifyBot(db, guildId, userId) {
  try {
    await db.collection('module_requests').insertOne({
      kind: 'bp_reload', guild_id: toLong(guildId || 0), requested_by: toLong(userId || 0), payload: {}, status: 'pending', created_at: new Date(),
    });
  } catch (e) { console.error('[battlepass] reload request failed', e?.message); }
}

/**
 * A request to the bot that is limited per member instead of per server (a Global season has no server to count against).
 * Returns { ok, result } or { error }.
 */
export async function askBot(db, { kind, guildId, userId, payload = {}, waitMs = 12000 }) {
  const res = await db.collection('module_requests').insertOne({
    kind, guild_id: toLong(guildId || 0), requested_by: toLong(userId), payload, status: 'pending', created_at: new Date(),
  });
  const deadline = Date.now() + waitMs;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 300));
    const doc = await db.collection('module_requests').findOne({ _id: res.insertedId });
    if (doc?.status === 'done') return { ok: true, result: doc.result || {} };
    if (doc?.status === 'failed') return { error: doc.error_code || 'failed' };
  }
  await db.collection('module_requests').deleteOne({ _id: res.insertedId, status: 'pending' });
  return { error: 'bot_unreachable' };
}

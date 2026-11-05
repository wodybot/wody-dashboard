// Reading helpers and the bridge to the bot. The website only reads Counting data; every change is a request to the bot,
// which validates it (wody_counting/games.py and admin.py) and writes it. That keeps one set of rules for bot and website.
import { toLong } from '@/lib/mongo';
import { COLL } from './constants.js';

export const iso = (d) => (d ? new Date(d).toISOString() : null);
export const str = (v) => (v === null || v === undefined ? null : String(v));
export const int = (v) => (Number.isFinite(Number(v)) ? Math.trunc(Number(v)) : 0);

/** A request to the bot. Returns { ok, result } or { error }. Limited per server so a click storm cannot flood the queue. */
export async function askBot(db, { guildId = 0, userId, payload, waitMs = 12000 }) {
  const gid = toLong(guildId || 0);
  const recent = await db.collection('module_requests').countDocuments({ kind: 'ct_action', guild_id: gid, created_at: { $gt: new Date(Date.now() - 15000) } });
  if (recent >= 12) return { error: 'rate_limited' };
  const res = await db.collection('module_requests').insertOne({
    kind: 'ct_action', guild_id: gid, requested_by: toLong(userId), payload, status: 'pending', created_at: new Date(),
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

/** Public or manager view of a game. Counters only: the database holds no message text. */
export function gameView(doc, { manager = false } = {}) {
  const st = doc.state || {};
  const base = {
    channel_id: str(doc._id), name: doc.name || '', mode: doc.mode, status: doc.status, public: doc.cfg?.visibility?.public !== false,
    value: st.value ?? null, index: int(st.index), highest_index: int(st.highest_index), session: int(st.session) || 1,
    saves: int(st.saves), stats: { total_valid: int(doc.stats?.total_valid), total_errors: int(doc.stats?.total_errors), sessions: int(doc.stats?.sessions) },
    created_at: iso(doc.created_at), updated_at: iso(doc.updated_at),
  };
  if (!manager) return base;
  return { ...base, guild_id: str(doc.guild_id), cfg: doc.cfg, i18n: doc.i18n || null, version: int(doc.ver) };
}

export async function limitsOf(db) {
  const doc = await db.collection(COLL.global).findOne({ _id: 'config' });
  return doc || null;
}

export async function audit(db, { actor, guildId = null, action, target = null, changes = {} }) {
  try {
    await db.collection(COLL.audit).insertOne({ at: new Date(), guild_id: guildId ? toLong(guildId) : null, actor: actor ? toLong(actor) : null, action, target, changes, result: 'ok' });
  } catch (e) { console.error('[counting] audit failed', e?.message); }
}

// Reads behind the public Counting pages and /api/counting/public/*. Counters of public games only; no server ids, settings or text.
import { toLong } from '@/lib/mongo';
import { getDiscordUserById } from '@/lib/discord';
import { COLL, MODES, BOARDS, PAGE, SNOWFLAKE } from './constants.js';
import { gameView, iso, str, int } from './store.js';

const VISIBLE = { status: { $in: ['active', 'paused'] }, 'cfg.visibility.public': { $ne: false }, 'cfg.visibility.web': { $ne: false } };
export const isMode = (m) => MODES.includes(m) || /^custom:[a-z][a-z0-9_]{0,31}$/.test(String(m));

async function nameOf(userId) {
  try {
    const u = await getDiscordUserById(userId);
    return u?.global_name || u?.username || `…${String(userId).slice(-4)}`;
  } catch { return `…${String(userId).slice(-4)}`; }
}

export async function loadSummary(db) {
  const games = db.collection(COLL.games);
  const [count, agg] = await Promise.all([
    games.countDocuments(VISIBLE),
    games.aggregate([{ $match: VISIBLE }, { $group: { _id: null, valid: { $sum: '$stats.total_valid' }, best: { $max: '$state.highest_index' } } }]).toArray(),
  ]);
  return { games: count, total_valid: int(agg[0]?.valid), highest: int(agg[0]?.best) };
}

/** { games } or { error }. */
export async function loadGames(db, { mode = '', q = '', sort = 'record', skip = 0 } = {}) {
  const filter = { ...VISIBLE };
  if (mode) { if (!isMode(mode)) return { error: 'invalid_mode' }; filter.mode = mode; }
  const text = String(q || '').trim().slice(0, 40);
  if (text) filter.name = { $regex: text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
  const sorts = { record: { 'state.highest_index': -1 }, valid: { 'stats.total_valid': -1 }, new: { created_at: -1 } };
  const rows = await db.collection(COLL.games).find(filter).sort({ ...(sorts[sort] || sorts.record), _id: 1 }).skip(Math.max(0, skip)).limit(PAGE).toArray();
  return { games: rows.map((d) => gameView(d)), page: PAGE };
}

/** One public game with its top counters, latest rounds and the last 30 days. Null when it is not public or does not exist. */
export async function loadGame(db, id) {
  if (!SNOWFLAKE.test(String(id))) return null;
  const doc = await db.collection(COLL.games).findOne({ _id: toLong(id), ...VISIBLE });
  if (!doc) return null;
  const since = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10).replace(/-/g, '');
  const [top, hist, daily] = await Promise.all([
    db.collection('ct_contrib').find({ channel_id: doc._id, valid: { $gt: 0 } }).sort({ valid: -1, user_id: 1 }).limit(10).toArray(),
    db.collection(COLL.history).find({ channel_id: doc._id }, { projection: { _id: 0 } }).sort({ ended_at: -1 }).limit(8).toArray(),
    db.collection(COLL.daily).find({ channel_id: doc._id, day: { $gte: since } }).sort({ day: 1 }).limit(31).toArray(),
  ]);
  const counters = await Promise.all(top.map(async (t) => ({ name: await nameOf(str(t.user_id)), valid: int(t.valid) })));
  return {
    game: gameView(doc), guild_id: str(doc.guild_id), counters,
    history: hist.map((h) => ({ session: int(h.session), final_index: int(h.final_index), highest_index: int(h.highest_index), participants: int(h.participants), duration_s: int(h.duration_s), ended_at: iso(h.ended_at), reason: h.reason })),
    daily: daily.map((d) => ({ day: d.day, valid: int(d.valid), errors: int(d.errors) })),
  };
}

export async function loadGlobalBoard(db, board = 'valid', skip = 0) {
  if (!BOARDS.includes(board)) return { error: 'invalid_board' };
  const field = { valid: 'valid', streak: 'best_streak', record: 'record', xp: 'xp' }[board];
  const rows = await db.collection(COLL.players).find({ guild_id: 0, [field]: { $gt: 0 } }).sort({ [field]: -1, user_id: 1 }).skip(Math.max(0, skip)).limit(PAGE).toArray();
  const named = await Promise.all(rows.map(async (r, i) => ({ rank: skip + i + 1, name: await nameOf(str(r.user_id)), value: int(r[field]) })));
  return { board, rows: named, page: PAGE };
}

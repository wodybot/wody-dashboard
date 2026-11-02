// WODY Collab: limits against abuse of the posting flow. Short lived records (kept 24 hours, then removed by the
// database itself) of when a person posted and deleted collabs. Only the Discord user ID, the server ID and a time.
//   cooldown      one new collab per minute
//   server cap    a few new collabs per person per server per day
//   delete cycle  posting and deleting again and again pauses posting for 30 minutes
//   duplicate     the same title cannot be posted twice within a day
import { M } from './db.js';
import { LIMITS } from './constants.js';
import { CollabError } from './lifecycle.js';

const E = (code, status, extra) => new CollabError(code, status, extra);
const DAY = 86400_000;
const norm = (v) => String(v || '').toLowerCase().replace(/\s+/g, ' ').trim();

export async function assertMayPost(db, userId, { guildId = null, title = '', exceptId = null } = {}) {
  const uid = String(userId); const now = Date.now();
  const col = db.collection(M.abuse);
  const block = await col.findOne({ user_id: uid, kind: 'block', until: { $gt: new Date(now) } });
  if (block) throw E('spam_blocked', 429, { retry_after: Math.max(1, Math.ceil((new Date(block.until).getTime() - now) / 1000)) });
  const last = await col.find({ user_id: uid, kind: 'post' }).sort({ at: -1 }).limit(1).toArray();
  if (last[0]) {
    const wait = LIMITS.postCooldownSec * 1000 - (now - new Date(last[0].at).getTime());
    if (wait > 0) throw E('cooldown', 429, { retry_after: Math.ceil(wait / 1000) });
  }
  if (guildId) {
    const n = await col.countDocuments({ user_id: uid, kind: 'post', guild_id: String(guildId), at: { $gt: new Date(now - DAY) } });
    if (n >= LIMITS.perServerDay) throw E('server_daily_limit', 429, { max: LIMITS.perServerDay });
  }
  const t = norm(title);
  if (t && LIMITS.dupHours > 0) {
    const same = await db.collection(M.requests).find({ author_id: uid, created_at: { $gt: new Date(now - LIMITS.dupHours * 3600_000) }, status: { $ne: 'deleted' } }, { projection: { 'content.title': 1 } }).limit(60).toArray();
    if (same.some((r) => String(r._id) !== String(exceptId) && norm(r.content?.title) === t && r.status !== 'draft')) throw E('duplicate_post', 409);
  }
}

export async function recordPost(db, userId, guildId = null) {
  const now = new Date();
  await db.collection(M.abuse).insertOne({ user_id: String(userId), kind: 'post', guild_id: guildId ? String(guildId) : null, at: now, expires_at: new Date(now.getTime() + DAY) });
}

// Called when an author deletes a collab that had been sent. Too many deletions in a short time pauses posting.
export async function recordDelete(db, userId) {
  const uid = String(userId); const now = new Date();
  const col = db.collection(M.abuse);
  await col.insertOne({ user_id: uid, kind: 'delete', at: now, expires_at: new Date(now.getTime() + DAY) });
  const n = await col.countDocuments({ user_id: uid, kind: 'delete', at: { $gt: new Date(now.getTime() - LIMITS.deleteWindowSec * 1000) } });
  if (n >= LIMITS.deleteMax) {
    const until = new Date(now.getTime() + LIMITS.blockMinutes * 60_000);
    await col.deleteMany({ user_id: uid, kind: 'block' });
    await col.insertOne({ user_id: uid, kind: 'block', at: now, until, expires_at: new Date(until.getTime() + 60_000) });
    await col.deleteMany({ user_id: uid, kind: 'delete' });          // a fresh count after the pause
  }
}

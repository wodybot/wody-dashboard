// What one member sees in a season: level, reward states, quests, achievements and collections. Read-only; every number
// comes from stored progress, and the same rules (curve, reward states) the bot applies.
import { toLong } from '@/lib/mongo';
import { COLL, CLAIMED, DEFAULT_PROTECTION, METRICS } from './constants.js';
import { thresholds, levelForXp } from './curve.js';
import { effectiveStatus } from './priority.js';
import { rewardState, collectionProgress } from './rewards.js';

const uid = (doc) => String(doc._id);

/** Public copy of a season: what members may read (no channel ids, no protection or notification settings). */
export function publicSeason(doc, now = new Date()) {
  const xp = doc.xp || {};
  return {
    id: uid(doc), scope: doc.scope, guild_id: doc.guild_id === null || doc.guild_id === undefined ? null : String(doc.guild_id),
    name: doc.name, description: doc.description || '', i18n: doc.i18n || null, status: effectiveStatus(doc, now),
    starts_at: doc.starts_at ? new Date(doc.starts_at).toISOString() : null, ends_at: doc.ends_at ? new Date(doc.ends_at).toISOString() : null,
    levels: (doc.levels || []).map((l) => l.xp),
    earn: {
      multiplier: xp.multiplier ?? 1,
      message: xp.message?.enabled === false ? null : { xp: xp.message?.xp, cooldown_seconds: xp.message?.cooldown_seconds, max_per_day: xp.message?.max_per_day },
      voice: xp.voice?.enabled === false ? null : { xp_per_interval: xp.voice?.xp_per_interval, interval_seconds: xp.voice?.interval_seconds, max_per_day: xp.voice?.max_per_day },
    },
    rewards: (doc.rewards || []).map(({ claim, ...r }) => (claim ? { ...r, claim: { label: claim.label, message: claim.message } } : r)), quests: doc.quests || [], achievements: doc.achievements || [], collections: doc.collections || [],
    page: doc.page || {},
  };
}

export async function memberState(db, doc, userId, now = new Date()) {
  const seasonId = uid(doc);
  const thr = thresholds((doc.levels || []).map((l) => l.xp));
  const user = toLong(userId);
  const prog = userId ? await db.collection(COLL.progress).findOne({ _id: `${seasonId}:${userId}` }) : null;
  const claims = userId ? await db.collection(COLL.claims).find({ season_id: seasonId, user_id: user }).project({ reward_id: 1 }).toArray() : [];
  const claimed = new Set(claims.map((c) => String(c.reward_id)));
  const xp = Number(prog?.xp || 0);
  const [level, into, need] = levelForXp(thr, xp);
  const status = effectiveStatus(doc, now);
  const protection = { ...DEFAULT_PROTECTION, ...(doc.protection || {}) };
  const completion = new Set((doc.collections || []).map((c) => String(c.completion_reward_id || '')).filter(Boolean));
  const rewards = {};
  for (const r of doc.rewards || []) {
    let state = rewardState(r, { seasonStatus: status, level, xp, claimed: claimed.has(String(r.id)), protection, now });
    if (completion.has(String(r.id)) && state !== CLAIMED) state = 'locked';        // granted only by finishing the collection
    rewards[r.id] = state;
  }
  const m = prog?.m || {};
  const metrics = Object.fromEntries(METRICS.map((k) => [k, Number(m[k] || 0)]));
  Object.assign(metrics, { xp, level, voice_minutes: Math.floor(Number(m.voice_seconds || 0) / 60), quests_done: Number(m.quests_done || 0) });
  const quests = (doc.quests || []).map((q) => {
    const st = prog?.quests?.[q.id] || {};
    return { id: q.id, value: Math.min(Number(st.v || 0), q.target), target: q.target, done: Boolean(st.done) };
  });
  const done = new Set(prog?.done || []);
  const achievements = (doc.achievements || []).map((a) => ({
    id: a.id, done: done.has(a.id),
    progress: (a.conditions || []).map((c) => ({ metric: c.metric, value: Math.min(metrics[c.metric] || 0, c.target), target: c.target })),
  }));
  const collections = (doc.collections || []).map((c) => {
    const [have, total] = collectionProgress(c, claimed);
    return { id: c.id, have, total };
  });
  return {
    season_id: seasonId, status, xp, level, max_level: thr.length, into, need, total_xp: thr.at(-1) || 0,
    rewards, claimed: [...claimed], quests, achievements, collections, has_progress: Boolean(prog),
  };
}

/** Top members of a season (display name comes from the profile service when available; here only ids and numbers). */
export async function topMembers(db, doc, limit = 10) {
  const rows = await db.collection(COLL.progress).find({ season_id: uid(doc) }).sort({ xp: -1 }).limit(limit).project({ user_id: 1, xp: 1 }).toArray();
  return rows.map((r) => ({ user_id: String(r.user_id), xp: Number(r.xp || 0) }));
}

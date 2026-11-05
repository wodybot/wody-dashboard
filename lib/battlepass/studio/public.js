// Server-side loader of a public season page. Reads only. The same rules as the rest of the Battle Pass apply: a member sees
// only their own progress, a server season page shows only that server's numbers, and nothing here writes XP or levels.
import { getDb } from '@/lib/mongo';
import { getSession } from '@/lib/session';
import { getDiscordUserById } from '@/lib/discord';
import { OWNER_ID } from '@/lib/owner-access';
import { COLL } from '../constants.js';
import { oid } from '../store.js';
import { publicSeason, memberState, topMembers } from '../member.js';
import { thresholds, levelForXp } from '../curve.js';
import { PAGE_COLL } from './constants.js';

export async function promoteDuePages(db) {
  const due = await db.collection(PAGE_COLL).find({ status: 'scheduled', schedule_at: { $lte: new Date() } }).limit(20).toArray();
  for (const p of due) {
    await db.collection(PAGE_COLL).updateOne({ _id: p._id, status: 'scheduled' }, {
      $set: { status: 'published', published: p.draft, published_version: (p.published_version || 0) + 1, published_at: new Date(), schedule_at: null, updated_at: new Date() },
      $push: { history: { at: new Date(), by: null, by_name: 'scheduler', action: 'publish', detail: 'scheduled' } },
    });
  }
}

export async function seasonStats(db, doc) {
  const sid = String(doc._id);
  const [participants, claimed, rows] = await Promise.all([
    db.collection(COLL.progress).countDocuments({ season_id: sid }),
    db.collection(COLL.claims).countDocuments({ season_id: sid }),
    db.collection(COLL.stats).find({ season_id: sid }).limit(800).toArray(),
  ]);
  const sum = (k) => rows.reduce((n, r) => n + Number(r?.[k] || 0), 0);
  return { participants, rewards_claimed: claimed, achievements: sum('achievements.completed'), levels: (doc.levels || []).length, rewards: (doc.rewards || []).length, quests: (doc.quests || []).length };
}

/** `slug` for a public page, or `sid` + preview for the Owner's live preview (any status, Owner only). */
export async function loadStudioPage({ slug = null, sid = null, preview = false }) {
  const db = await getDb();
  const session = await getSession();
  const viewerId = session?.user?.id ? String(session.user.id) : null;
  let page;
  if (preview) {
    if (!viewerId || viewerId !== String(OWNER_ID)) return null;
    page = await db.collection(PAGE_COLL).findOne({ season_id: String(sid) });
  } else {
    await promoteDuePages(db);
    page = await db.collection(PAGE_COLL).findOne({ slug: String(slug) });
    if (!page || page.status !== 'published' || !page.published) return null;
  }
  if (!page) return null;
  const _id = oid(page.season_id);
  const doc = _id ? await db.collection(COLL.seasons).findOne({ _id }) : null;
  if (!doc) return null;
  const now = new Date();
  const thr = thresholds((doc.levels || []).map((l) => l.xp));
  const top = await topMembers(db, doc, 10);
  const leaderboard = await Promise.all(top.map(async (row) => {
    const u = await getDiscordUserById(row.user_id);
    return { user_id: row.user_id, name: u?.global_name || u?.username || row.user_id.slice(-4), xp: row.xp, level: levelForXp(thr, row.xp)[0] };
  }));
  return {
    page: { slug: page.slug, status: page.status, season_id: page.season_id, version: page.published_version || 0 },
    config: preview ? page.draft : page.published,
    season: publicSeason(doc, now), state: await memberState(db, doc, viewerId, now), leaderboard,
    stats: await seasonStats(db, doc),
    viewer: viewerId ? { id: viewerId, name: session.user.global_name || session.user.username || '' } : null,
  };
}

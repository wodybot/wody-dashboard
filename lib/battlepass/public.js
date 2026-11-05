// Server-side loader shared by the two public Battle Pass pages. Reads only; the rules are the same ones the API applies.
import { toLong, getDb } from '@/lib/mongo';
import { getSession } from '@/lib/session';
import { getDiscordUserById } from '@/lib/discord';
import { COLL, ACTIVE, SCHEDULED } from './constants.js';
import { forPriority, oid } from './store.js';
import { resolveForGuild } from './priority.js';
import { publicSeason, memberState, topMembers } from './member.js';
import { thresholds, levelForXp } from './curve.js';

async function isPremium(db, gid) {
  if (!gid) return false;
  const doc = await db.collection('premium_servers').findOne({ guild_id: toLong(gid), active: true });
  if (!doc || doc.suspended) return false;
  return !(doc.expires_at && new Date(doc.expires_at) < new Date());
}

/** The season that runs for a server (or for nobody when gid is null) plus the reason when a server season is held back. */
export async function loadPublicPass(gid = null) {
  const db = await getDb();
  const now = new Date();
  const live = await db.collection(COLL.seasons).find({ status: { $in: [ACTIVE, SCHEDULED] } }).toArray();
  const premium = await isPremium(db, gid);
  const [running, reason] = resolveForGuild(live.map(forPriority), gid || '0', premium, now);
  const doc = running ? await db.collection(COLL.seasons).findOne({ _id: oid(running.id) }) : null;
  const session = await getSession();
  const viewerId = session?.user?.id ? String(session.user.id) : null;
  if (!doc) return { season: null, reason, viewer: viewerId ? { id: viewerId } : null, state: null, leaderboard: [], premium };
  const thr = thresholds((doc.levels || []).map((l) => l.xp));
  const top = await topMembers(db, doc, 10);
  const names = await Promise.all(top.map(async (row) => {
    const u = await getDiscordUserById(row.user_id);
    return { user_id: row.user_id, name: u?.global_name || u?.username || row.user_id.slice(-4), xp: row.xp, level: levelForXp(thr, row.xp)[0] };
  }));
  return {
    season: publicSeason(doc, now), reason, premium,
    viewer: viewerId ? { id: viewerId, name: session.user.global_name || session.user.username || '' } : null,
    state: await memberState(db, doc, viewerId, now), leaderboard: names,
  };
}

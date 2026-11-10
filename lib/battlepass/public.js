// Server-side loader shared by the two public Battle Pass pages. Reads only; the rules are the same ones the API applies.
import { toLong, getDb } from '@/lib/mongo';
import { getSession } from '@/lib/session';
import { getDiscordUserById } from '@/lib/discord';
import { COLL, ACTIVE, SCHEDULED, GLOBAL } from './constants.js';
import { forPriority, oid } from './store.js';
import { resolveForGuild, upcomingForGuild, effectiveStatus, aware } from './priority.js';
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
  // Published seasons that have not started yet, shown as "Coming soon". A server season only counts when the server can run it.
  const upcoming = upcomingForGuild(live.map(forPriority), gid || '0', now).filter((s) => s.scope === GLOBAL || premium).slice(0, gid ? 2 : 12).map((s) => ({
    id: s.id, scope: s.scope, name: s.name, description: s.description || '', i18n: s.i18n || null, starts_at: s.starts_at ? new Date(s.starts_at).toISOString() : null, page: s.page || {},
  }));
  // The Wody page lists every Global season that is running or published for later, not only the one on show.
  const lineup = gid ? null : live.map(forPriority).filter((s) => s.scope === GLOBAL && [ACTIVE, SCHEDULED].includes(effectiveStatus(s, now)))
    .sort((a, b) => (effectiveStatus(a, now) === effectiveStatus(b, now) ? (aware(a.starts_at)?.getTime() ?? Infinity) - (aware(b.starts_at)?.getTime() ?? Infinity) : effectiveStatus(a, now) === ACTIVE ? -1 : 1))
    .slice(0, 12).map((s) => ({
      id: s.id, status: effectiveStatus(s, now), name: s.name, description: s.description || '', i18n: s.i18n || null,
      starts_at: s.starts_at ? aware(s.starts_at).toISOString() : null, ends_at: s.ends_at ? aware(s.ends_at).toISOString() : null,
    }));
  const doc = running ? await db.collection(COLL.seasons).findOne({ _id: oid(running.id) }) : null;
  const session = await getSession();
  const viewerId = session?.user?.id ? String(session.user.id) : null;
  if (!doc) return { season: null, reason, viewer: viewerId ? { id: viewerId } : null, state: null, leaderboard: [], premium, upcoming, lineup };
  const thr = thresholds((doc.levels || []).map((l) => l.xp));
  const top = await topMembers(db, doc, 10);
  const names = await Promise.all(top.map(async (row) => {
    const u = await getDiscordUserById(row.user_id);
    return { user_id: row.user_id, name: u?.global_name || u?.username || row.user_id.slice(-4), xp: row.xp, level: levelForXp(thr, row.xp)[0] };
  }));
  return {
    season: publicSeason(doc, now), reason, premium, upcoming, lineup,
    viewer: viewerId ? { id: viewerId, name: session.user.global_name || session.user.username || '' } : null,
    state: await memberState(db, doc, viewerId, now), leaderboard: names,
  };
}

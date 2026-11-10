// Which season counts for a server. Same rule and same vectors as wody_battlepass/priority.py: an active Global season wins,
// server seasons keep their configuration and progress but do not run while it is active.
import { GLOBAL, GUILD, DRAFT, SCHEDULED, ACTIVE, PAUSED, COMPLETED } from './constants.js';

export const GLOBAL_ACTIVE = 'global_active';
export const NOT_PREMIUM = 'not_premium';
export const ANOTHER_GLOBAL_ACTIVE = 'another_global_active';
export const ANOTHER_GUILD_ACTIVE = 'another_guild_active';
export const BAD_STATUS = 'bad_status';
export const NOT_OWNER = 'not_owner';

export function aware(value) {
  if (value === null || value === undefined) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

const idOf = (s) => String(s._id ?? s.id ?? '');
const guildOf = (s) => (s.guild_id === null || s.guild_id === undefined ? null : String(s.guild_id));

export function effectiveStatus(season, now) {
  const status = season.status;
  if (status !== ACTIVE && status !== SCHEDULED) return status || DRAFT;
  const starts = aware(season.starts_at); const ends = aware(season.ends_at);
  if (ends && now >= ends) return COMPLETED;
  if (starts && now < starts) return SCHEDULED;
  if (status === SCHEDULED && !starts) return SCHEDULED;
  return ACTIVE;
}

const order = (a, b) => {
  const ta = aware(a.activated_at)?.getTime() ?? -Infinity; const tb = aware(b.activated_at)?.getTime() ?? -Infinity;
  if (ta !== tb) return ta < tb ? -1 : 1;
  const ia = idOf(a); const ib = idOf(b);
  return ia < ib ? -1 : ia > ib ? 1 : 0;
};

/** [running season or null, why a server season is not running or null] */
export function resolveForGuild(seasons, guildId, premium, now) {
  const globals = []; const guild = [];
  for (const s of seasons) {
    if (effectiveStatus(s, now) !== ACTIVE) continue;
    if (s.scope === GLOBAL) globals.push(s);
    else if (s.scope === GUILD && guildOf(s) === String(guildId)) guild.push(s);
  }
  if (globals.length) return [globals.sort(order)[0], guild.length ? GLOBAL_ACTIVE : null];
  if (guild.length && premium) return [guild.sort(order)[0], null];
  if (guild.length && !premium) return [null, NOT_PREMIUM];
  return [null, null];
}

/** [ok, reason] */
export function activationCheck(candidate, seasons, { premium, ownerOk, now }) {
  if (![DRAFT, SCHEDULED, PAUSED].includes(candidate.status)) return [false, BAD_STATUS];
  const others = seasons.filter((s) => idOf(s) !== idOf(candidate));
  const runningGlobal = others.filter((s) => s.scope === GLOBAL && effectiveStatus(s, now) === ACTIVE);
  if (candidate.scope === GLOBAL) return runningGlobal.length ? [false, ANOTHER_GLOBAL_ACTIVE] : [true, null];
  if (!ownerOk) return [false, NOT_OWNER];
  if (!premium) return [false, NOT_PREMIUM];
  if (runningGlobal.length) return [false, GLOBAL_ACTIVE];
  const gid = guildOf(candidate);
  if (others.some((s) => s.scope === GUILD && guildOf(s) === gid && effectiveStatus(s, now) === ACTIVE)) return [false, ANOTHER_GUILD_ACTIVE];
  return [true, null];
}

/** Server seasons that must be paused (not deleted) when a Global season starts. */
export function seasonsToSuspendOnGlobalStart(seasons, now) {
  return seasons.filter((s) => s.scope === GUILD && effectiveStatus(s, now) === ACTIVE);
}

/**
 * Published seasons that have not started yet, soonest first (undated ones last). A Global season counts for every server, a
 * server season only for its own. Same rule as upcoming() in wody_battlepass/priority.py.
 */
export function upcomingForGuild(seasons, guildId, now) {
  const rows = seasons.filter((s) => effectiveStatus(s, now) === SCHEDULED && (s.scope === GLOBAL || (s.scope === GUILD && guildOf(s) === String(guildId))));
  const when = (s) => aware(s.starts_at)?.getTime() ?? Infinity;
  return rows.sort((a, b) => (when(a) === when(b) ? (idOf(a) < idOf(b) ? -1 : 1) : when(a) < when(b) ? -1 : 1));
}

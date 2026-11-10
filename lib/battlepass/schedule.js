// When a server season may run. Wody's own (Global) seasons and the dates the Owner blocks are "busy": a server season cannot be
// published over them. Plain functions with no I/O, so the API, the calendar and the tests all apply the same rule.
import { GLOBAL, GUILD, DRAFT, SCHEDULED, ACTIVE, PAUSED } from './constants.js';
import { aware, effectiveStatus } from './priority.js';

export const BUSY_GLOBAL = 'global';
export const BUSY_BLOCKED = 'blocked';
export const MAX_BLOCKS = 60;

const iso = (d) => (d ? d.toISOString() : null);

/** [start, end) in ms. A missing start means "from now", a missing end means "no end". */
export function windowOf(season, now) {
  const s = aware(season.starts_at); const e = aware(season.ends_at);
  return [s ? Math.max(s.getTime(), 0) : now.getTime(), e ? e.getTime() : Infinity];
}

export function overlaps(a, b) {
  return a[0] < b[1] && b[0] < a[1];
}

/** Everything a server cannot use: Wody seasons that are published (running or coming) and the Owner's blocked dates. */
export function busyRanges(seasons, blocks, now) {
  const out = [];
  for (const s of seasons) {
    if (s.scope !== GLOBAL) continue;
    const status = effectiveStatus(s, now);
    if (status !== ACTIVE && status !== SCHEDULED) continue;
    const [start, end] = windowOf(s, now);
    out.push({ kind: BUSY_GLOBAL, id: String(s.id ?? s._id), name: s.name, starts_at: iso(new Date(start)), ends_at: Number.isFinite(end) ? iso(new Date(end)) : null });
  }
  for (const b of blocks || []) {
    const start = aware(b.starts_at); const end = aware(b.ends_at);
    if (!start || !end || end <= now) continue;
    out.push({ kind: BUSY_BLOCKED, id: String(b.id), name: b.reason || '', starts_at: iso(start), ends_at: iso(end) });
  }
  return out.sort((x, y) => new Date(x.starts_at) - new Date(y.starts_at));
}

/** The ranges from busyRanges() that a window collides with. Used by the server and, with the same rule, by the calendar. */
export function conflictsAgainst(candidate, busy, now) {
  const mine = windowOf(candidate, now);
  return (busy || []).filter((r) => overlaps(mine, [new Date(r.starts_at).getTime(), r.ends_at ? new Date(r.ends_at).getTime() : Infinity]));
}

/** The busy ranges a server season would collide with. Empty means the dates are free. */
export function scheduleConflicts(candidate, seasons, blocks, now) {
  return conflictsAgainst(candidate, busyRanges(seasons.filter((s) => String(s.id ?? s._id) !== String(candidate.id ?? candidate._id)), blocks, now), now);
}

/** Validates one blocked range sent by the Owner. Returns { ok, range } or { ok: false, error }. */
export function cleanBlock(input, now = new Date()) {
  const start = aware(input?.starts_at); const end = aware(input?.ends_at);
  if (!start || !end) return { ok: false, error: 'invalid_dates' };
  if (end <= start) return { ok: false, error: 'end_before_start' };
  if (end <= now) return { ok: false, error: 'in_the_past' };
  if (end.getTime() - start.getTime() > 400 * 86400000) return { ok: false, error: 'too_long' };
  const reason = String(input?.reason ?? '').replace(/[\p{Cc}\p{Cf}<>]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
  return { ok: true, range: { starts_at: start, ends_at: end, reason } };
}

/**
 * What is still missing before a season can be published, for the date the owner picked. `required` items block publishing,
 * the rest are advice. The checklist depends on the start: a season that starts later must have a valid future window,
 * one that starts now must not already be over.
 */
export function readiness(season, { scope, premium = true, conflicts = [], now = new Date() }) {
  const start = aware(season.starts_at); const end = aware(season.ends_at);
  const later = Boolean(start && start > now);
  const items = [];
  const add = (id, ok, required = true, extra = {}) => items.push({ id, ok: Boolean(ok), required, ...extra });
  add('name', String(season.name || '').trim().length > 0);
  add('levels', (season.level_count || (season.levels || []).length) >= 1);
  const xp = season.xp || {};
  add('xp_source', xp.message?.enabled !== false || xp.voice?.enabled !== false);
  add('rewards', (season.rewards || []).length >= 1);
  if (later) {
    add('start_future', true, true, { when: iso(start) });
  } else {
    add('start_now', true, true);
  }
  add('end_after_start', !end || end > (start || now));
  add('end_not_past', !end || end > now);
  if (scope === GUILD) {
    add('premium', premium);
    add('no_wody_overlap', conflicts.length === 0, true, { conflicts });
    add('channel', Boolean(season.notifications?.channel_id), false);
  }
  add('description', String(season.description || '').trim().length > 0, false);
  const status = season.status;
  const publishable = [DRAFT, PAUSED, SCHEDULED].includes(status) || status === undefined;
  return { items, ready: publishable && items.filter((i) => i.required).every((i) => i.ok), later };
}

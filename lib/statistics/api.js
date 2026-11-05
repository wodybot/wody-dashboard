// Wody Statistics API (mounted at /api/statistics/*). Server managers only; nothing here is public and nothing stores message text.
//
//   GET    guilds/:gid/settings                      current settings (no secrets)
//   PATCH  guilds/:gid/settings                      {enabled, retention_days, access, excluded_channels, excluded_categories, thresholds, tz_offset}
//   GET    guilds/:gid/overview?days=30[&back=1]     the whole analysis of a period (or ?first=YYYY-MM-DD&last=YYYY-MM-DD)
//   GET    guilds/:gid/history?weeks=26              weekly totals
//   GET    guilds/:gid/channels                      channels of the server (to exclude or compare)
//   GET    guilds/:gid/compare?days=30&channels=a,b  daily series of 2 to 5 channels
//   POST   guilds/:gid/report {days}                 a PDF report (application/pdf)
//   POST   guilds/:gid/purge {confirm: true}         delete every counter of the server
//
// The Discord session decides who is asking. The bot validates and writes; the website only relays. All answers are private and uncached.
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { trustedOrigin } from '@/lib/owner-access';
import { isAccountBlocked } from '@/lib/account-moderation';
import { getUserGuilds, canManage } from '@/lib/discord';
import { RANGES, DEFAULT_RANGE, SETTING_FIELDS, ACCESS, RETENTION, TZ, THRESHOLD_KEYS, HISTORY_WEEKS, MAX_COMPARE, SNOWFLAKE, BOT_ERRORS } from './constants.js';
import { askBot, loadSettings } from './store.js';

export function json(data, init = {}) {
  return NextResponse.json(data, { ...init, headers: { 'Cache-Control': 'no-store, private', ...(init.headers || {}) } });
}
export const err = (code, status = 400, extra = {}) => json({ error: code, ...extra }, { status });

async function readJson(request, max = 64 * 1024) {
  try {
    const text = await request.text();
    if (text.length > max) return null;
    const body = text ? JSON.parse(text) : {};
    return body && typeof body === 'object' && !Array.isArray(body) ? body : null;
  } catch { return null; }
}

async function limited(db, key, max, windowSec = 60) {
  const windowMs = windowSec * 1000;
  const start = Date.now() - (Date.now() % windowMs);
  try {
    const r = await db.collection('rate_limit_buckets').findOneAndUpdate(
      { _id: `st:${key}:${start}` }, { $inc: { count: 1 }, $setOnInsert: { expires_at: new Date(start + windowMs * 2) } },
      { upsert: true, returnDocument: 'after' });
    return (r?.count ?? r?.value?.count ?? 0) > max;
  } catch { return false; }
}

async function who(db) {
  const session = await getSession();
  const id = session?.user?.id;
  if (!id) return { error: err('unauthenticated', 401) };
  if (await isAccountBlocked(db, id)) return { error: err('account_blocked', 403) };
  return { session, userId: String(id) };
}

async function guildManager(db, session, gid) {
  if (!SNOWFLAKE.test(String(gid))) return { ok: false, response: err('invalid_id', 400) };
  const banned = await db.collection('guild_bans').findOne({ guild_id: String(gid), active: true });
  if (banned) return { ok: false, response: err('guild_banned', 403) };
  let guilds;
  try { guilds = await getUserGuilds(session.accessToken); } catch { return { ok: false, response: err('temporarily_unavailable', 503) }; }
  const g = guilds.find((x) => String(x.id) === String(gid));
  if (!g || !canManage(g.permissions, g.owner)) return { ok: false, response: err('forbidden', 403) };
  return { ok: true, guild: g };
}

function botAnswer(res) {
  if (res.error) return err(res.error, BOT_ERRORS[res.error] || 400);
  const r = res.result || {};
  if (r.ok === false) return err(r.error ? 'validation_failed' : 'failed', r.error ? 422 : 409, r.error ? { code: r.error, settings: r.settings } : {});
  return json({ ok: true, ...r });
}

const isDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`));

/** The period of a request: a fixed range (7, 14, 30, 90 days, optionally some periods back) or two ISO dates. */
export function periodOf(url) {
  const first = url.searchParams.get('first');
  const last = url.searchParams.get('last');
  if (first || last) {
    if (!isDate(first) || !isDate(last) || first > last) return null;
    return { first, last };
  }
  const days = Number(url.searchParams.get('days') || DEFAULT_RANGE);
  const back = Number(url.searchParams.get('back') || 0);
  if (!RANGES.includes(days) || !Number.isInteger(back) || back < 0 || back > 12) return null;
  return { days, back };
}

/** A settings patch the website will pass on. The bot checks every value again; this only rejects what can never be valid. */
export function cleanPatch(body) {
  if (!body || typeof body !== 'object') return null;
  const patch = {};
  for (const key of Object.keys(body)) {
    if (!SETTING_FIELDS.includes(key)) return null;
    const v = body[key];
    if (key === 'enabled' && typeof v !== 'boolean') return null;
    if (key === 'retention_days') {
      const n = Number(v);
      if (!Number.isInteger(n) || n < RETENTION.min || n > RETENTION.max) return null;
      patch[key] = n; continue;
    }
    if (key === 'access' && !ACCESS.includes(v)) return null;
    if (key === 'tz_offset') {
      const n = Number(v);
      if (!Number.isInteger(n) || n < TZ.min || n > TZ.max) return null;
      patch[key] = n; continue;
    }
    if (key === 'excluded_channels' || key === 'excluded_categories') {
      if (!Array.isArray(v) || v.length > 100 || !v.every((x) => SNOWFLAKE.test(String(x)))) return null;
      patch[key] = v.map(String); continue;
    }
    if (key === 'thresholds') {
      if (!v || typeof v !== 'object') return null;
      const t = {};
      for (const k of THRESHOLD_KEYS) {
        const n = Number(v[k]);
        if (!Number.isFinite(n) || n < 0 || n > 100000) return null;
        t[k] = n;
      }
      patch[key] = t; continue;
    }
    patch[key] = v;
  }
  return Object.keys(patch).length ? patch : null;
}

export async function handle({ request, db, parts, method }) {
  if (method !== 'GET' && !trustedOrigin(request)) return err('forbidden_origin', 403);
  const url = new URL(request.url);
  if (parts[0] !== 'guilds' || !parts[1] || !parts[2]) return err('not_found', 404);
  const auth = await who(db);
  if (auth.error) return auth.error;
  const [, gid, area] = parts;
  const gate = await guildManager(db, auth.session, gid);
  if (!gate.ok) return gate.response;
  const userId = auth.userId;
  const write = method !== 'GET';
  if (write ? await limited(db, `w:${gid}`, 30) : await limited(db, `r:${gid}`, 90)) return err('rate_limited', 429);

  if (area === 'settings') {
    if (method === 'GET') return json({ settings: await loadSettings(db, gid) });
    if (method === 'PATCH') {
      const patch = cleanPatch(await readJson(request));
      if (!patch) return err('invalid_body', 400);
      return botAnswer(await askBot(db, { kind: 'stats_action', guildId: gid, userId, payload: { action: 'settings', patch } }));
    }
    return err('method_not_allowed', 405);
  }
  if (area === 'overview' && method === 'GET') {
    const period = periodOf(url);
    if (!period) return err('invalid_period', 400);
    return botAnswer(await askBot(db, { kind: 'stats_query', guildId: gid, userId, payload: { kind: 'overview', ...period, force: url.searchParams.get('force') === '1' }, burst: 10 }));
  }
  if (area === 'history' && method === 'GET') {
    const weeks = Number(url.searchParams.get('weeks') || 26);
    if (!HISTORY_WEEKS.includes(weeks)) return err('invalid_period', 400);
    return botAnswer(await askBot(db, { kind: 'stats_query', guildId: gid, userId, payload: { kind: 'history', weeks }, burst: 10 }));
  }
  if (area === 'channels' && method === 'GET') {
    return botAnswer(await askBot(db, { kind: 'stats_query', guildId: gid, userId, payload: { kind: 'channels' }, burst: 10 }));
  }
  if (area === 'compare' && method === 'GET') {
    const period = periodOf(url);
    const ids = String(url.searchParams.get('channels') || '').split(',').map((s) => s.trim()).filter(Boolean);
    if (!period) return err('invalid_period', 400);
    if (ids.length < 2 || ids.length > MAX_COMPARE || !ids.every((x) => SNOWFLAKE.test(x))) return err('invalid_channels', 400);
    return botAnswer(await askBot(db, { kind: 'stats_query', guildId: gid, userId, payload: { kind: 'compare', ...period, channels: ids }, burst: 10 }));
  }
  if (area === 'report' && method === 'POST') {
    const body = await readJson(request);
    const days = Number(body?.days || DEFAULT_RANGE);
    if (!body || !RANGES.includes(days)) return err('invalid_body', 400);
    const res = await askBot(db, { kind: 'stats_action', guildId: gid, userId, payload: { action: 'report', days }, waitMs: 28000, burst: 4 });
    if (res.error) return err(res.error, BOT_ERRORS[res.error] || 400);
    const r = res.result || {};
    if (!r.pdf_b64) return err('failed', 409);
    const bytes = Buffer.from(String(r.pdf_b64), 'base64');
    const name = /^[A-Za-z0-9._-]{1,80}$/.test(String(r.filename || '')) ? r.filename : 'wody-statistics.pdf';
    return new NextResponse(bytes, { status: 200, headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${name}"`, 'Cache-Control': 'no-store, private', 'X-Content-Type-Options': 'nosniff' } });
  }
  if (area === 'purge' && method === 'POST') {
    const body = await readJson(request);
    if (!body || body.confirm !== true) return err('confirm_required', 400);
    return botAnswer(await askBot(db, { kind: 'stats_action', guildId: gid, userId, payload: { action: 'purge', confirm: true }, burst: 3 }));
  }
  return err('not_found', 404);
}

// Wody Battle Pass API (mounted at /api/battlepass/*).
//
//   Owner (platform owner writes, delegates read)     Global seasons
//     GET    owner/overview
//     GET    owner/seasons                            POST owner/seasons
//     GET    owner/seasons/:id                        PATCH owner/seasons/:id        DELETE owner/seasons/:id
//     POST   owner/seasons/:id/{activate|pause|resume|complete|archive|duplicate}
//     GET    owner/limits                             PATCH owner/limits
//     GET    owner/audit                              GET   owner/reports
//   Premium (server manager + Premium)                Server seasons
//     GET    guilds/:gid/status
//     GET    guilds/:gid/seasons                      POST guilds/:gid/seasons
//     GET    guilds/:gid/seasons/:id                  PATCH guilds/:gid/seasons/:id  DELETE guilds/:gid/seasons/:id
//     POST   guilds/:gid/seasons/:id/{activate|pause|resume|complete|archive|duplicate}
//     POST   guilds/:gid/seasons/:id/announce      post the season message in the saved channel now
//     GET    guilds/:gid/form                         PUT  guilds/:gid/form          delivery form (fields the members fill in)
//     GET    guilds/:gid/submissions                  PATCH guilds/:gid/submissions/:id   DELETE guilds/:gid/submissions/:id
//   Member (signed in)
//     GET    me?guild=:gid                            the season that counts for this server (Global first) and my progress
//     POST   claim                                    { season_id, reward_id }, decided by the bot's engine
//     GET    inventory                                PATCH profile { equipped, showcase, featured_badge, hidden_seasons, hidden_items }
//     GET    form?guild=:gid                          POST form { guild, reward_id, answers }      DELETE form/:id
//
// Rules that hold for every route: the Discord session decides who is asking, the ids in a body never decide who may act,
// a Global season always wins over a server season (priority.js, the same vectors as the bot), and nothing here changes
// XP or levels: the bot is the only writer of progress.
import { createHash, randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { OWNER_ID, getDelegate, trustedOrigin } from '@/lib/owner-access';
import { isAccountBlocked } from '@/lib/account-moderation';
import { toLong } from '@/lib/mongo';
import { getUserGuilds, canManage, getDiscordUserById } from '@/lib/discord';
import {
  COLL, GLOBAL, GUILD, DRAFT, SCHEDULED, ACTIVE, PAUSED, COMPLETED, ARCHIVED, LIMITS, DEFAULT_GUILD_LIMITS, REWARD_TYPES,
} from './constants.js';
import { cleanSeason, SNOWFLAKE } from './validate.js';
import { effectiveStatus, resolveForGuild, activationCheck, upcomingForGuild, GLOBAL_ACTIVE, aware } from './priority.js';
import { claimDecision } from './rewards.js';
import { levelForXp, thresholds } from './curve.js';
import { oid, seasonView, forPriority, loadLimits, audit, withLock, notifyBot, askBot, flatStats } from './store.js';
import { memberState, publicSeason } from './member.js';
import { busyRanges, scheduleConflicts, cleanBlock, readiness, MAX_BLOCKS } from './schedule.js';
import { studioRoutes } from './studio/api.js';
import { cleanForm, cleanAnswers, publicForm, submissionView, DEFAULT_FORM, FORM_LIMITS, SUBMISSION_STATUSES, plain } from './forms.js';

export function json(data, init = {}) {
  return NextResponse.json(data, { ...init, headers: { 'Cache-Control': 'no-store, private', ...(init.headers || {}) } });
}
export const err = (code, status = 400, extra = {}) => json({ error: code, ...extra }, { status });

async function readJson(request, max = 512 * 1024) {
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
      { _id: `bp:${key}:${start}` }, { $inc: { count: 1 }, $setOnInsert: { expires_at: new Date(start + windowMs * 2) } },
      { upsert: true, returnDocument: 'after' });
    return (r?.count ?? r?.value?.count ?? 0) > max;
  } catch { return false; }
}

// ---------------------------------------------------------------------------------------------- who is asking
async function who(db) {
  const session = await getSession();
  const id = session?.user?.id;
  if (!id) return { error: err('unauthenticated', 401) };
  if (await isAccountBlocked(db, id)) return { error: err('account_blocked', 403) };
  return { session, userId: String(id) };
}

async function ownerAccess(db, userId, { write }) {
  if (String(userId) === String(OWNER_ID)) return true;
  if (write) return false;
  return Boolean(await getDelegate(db, userId));
}

async function isGuildPremium(db, gid) {
  const doc = await db.collection('premium_servers').findOne({ guild_id: toLong(gid), active: true });
  if (!doc || doc.suspended) return false;
  return !(doc.expires_at && new Date(doc.expires_at) < new Date());
}

/** A person who manages this server in the dashboard (the same rule as every other server module). */
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

// ---------------------------------------------------------------------------------------------- seasons
const col = (db) => db.collection(COLL.seasons);
const live = (db) => col(db).find({ status: { $in: [ACTIVE, SCHEDULED] } }).toArray();
export async function loadBlocks(db) {
  try {
    const doc = await db.collection(COLL.state).findOne({ _id: 'blocked_dates' });
    return (doc?.ranges || []).map((r) => ({ id: String(r.id), starts_at: r.starts_at, ends_at: r.ends_at, reason: r.reason || '' }));
  } catch { return []; }
}
const blockView = (b) => ({ id: b.id, starts_at: new Date(b.starts_at).toISOString(), ends_at: new Date(b.ends_at).toISOString(), reason: b.reason || '' });
const scopeFilter = (scope, gid) => (scope === GLOBAL ? { scope: GLOBAL } : { scope: GUILD, guild_id: toLong(gid) });

async function loadSeason(db, id, scope, gid) {
  const _id = oid(id);
  if (!_id) return null;
  return col(db).findOne({ _id, ...scopeFilter(scope, gid) });
}

async function saveSeason(db, { scope, gid, existing, body, userId }) {
  const limits = await loadLimits(db);
  const { errors, doc } = cleanSeason(body, { scope, existing, limits });
  if (errors.length) return { response: err('validation_failed', 422, { errors }) };
  const now = new Date();
  if (existing) {
    if (existing.status === ARCHIVED) return { response: err('season_archived', 409) };
    if (existing.status !== DRAFT) {
      // Members already hold progress: levels cannot shrink and a reward somebody claimed cannot disappear.
      if (doc.level_count < (existing.level_count || 0)) return { response: err('levels_locked', 409) };
      const kept = new Set(doc.rewards.map((r) => r.id));
      const removed = (existing.rewards || []).map((r) => r.id).filter((x) => !kept.has(x));
      if (removed.length && await db.collection(COLL.claims).countDocuments({ season_id: String(existing._id), reward_id: { $in: removed } }, { limit: 1 })) {
        return { response: err('reward_in_use', 409) };
      }
    }
    await col(db).updateOne({ _id: existing._id }, { $set: { ...doc, updated_at: now, updated_by: toLong(userId) }, $inc: { version: 1 } });
    const fresh = await col(db).findOne({ _id: existing._id });
    return { season: fresh, changed: Object.keys(doc) };
  }
  if (scope === GUILD) {
    const n = await col(db).countDocuments({ scope: GUILD, guild_id: toLong(gid), status: { $ne: ARCHIVED } });
    if (n >= LIMITS.MAX_GUILD_SEASONS) return { response: err('too_many_seasons', 409, { max: LIMITS.MAX_GUILD_SEASONS }) };
  }
  const insert = {
    ...doc, status: DRAFT, guild_id: scope === GUILD ? toLong(gid) : null, created_at: now, updated_at: now, created_by: toLong(userId), version: 1,
  };
  const res = await col(db).insertOne(insert);
  return { season: { ...insert, _id: res.insertedId }, created: true };
}

/** Asks the bot to post the "new season" message. The bot sends it once per season (a flag on the season), so asking again is harmless. */
async function queueAnnounce(db, { gid, season, userId }) {
  const n = season.notifications || {};
  if (!n.channel_id || n.season_created === false) return;
  try {
    await db.collection('module_requests').insertOne({
      kind: 'bp_announce', guild_id: toLong(gid), requested_by: toLong(userId || 0), payload: { season_id: String(season._id) }, status: 'pending', created_at: new Date(),
    });
  } catch (e) { console.error('[battlepass] announce request failed', e?.message); }
}

async function transition(db, { action, scope, gid, season, userId }) {
  const now = new Date();
  const id = season._id;
  const set = (patch) => col(db).updateOne({ _id: id }, { $set: { ...patch, updated_at: now }, $inc: { version: 1 } });
  const current = effectiveStatus(season, now);

  if (action === 'activate' || action === 'resume') {
    if (action === 'resume' && season.status !== PAUSED) return { response: err('bad_status', 409) };
    // The season must still be valid with today's limits before it goes live.
    const limits = await loadLimits(db);
    const check = cleanSeason(seasonView(season, { full: true }), { scope, existing: season, limits });
    if (check.errors.length) return { response: err('invalid_config', 422, { errors: check.errors }) };
    const run = async () => {
      const all = (await live(db)).map(forPriority);
      const premium = scope === GUILD ? await isGuildPremium(db, gid) : true;
      const [ok, reason] = activationCheck(forPriority(season), all, { premium, ownerOk: true, now });
      if (!ok) return { response: err('activation_refused', 409, { reason }) };
      if (scope === GUILD) {
        const conflicts = scheduleConflicts(forPriority(season), all, await loadBlocks(db), now);
        if (conflicts.length) return { response: err('activation_refused', 409, { reason: 'wody_busy', conflicts }) };
      }
      await set({ status: ACTIVE, activated_at: now, paused_reason: null });
      if (scope === GUILD) {
        // A Global season may have been activated between the check and the write: the Global season wins, so undo.
        const globals = (await live(db)).map(forPriority).filter((s) => s.scope === GLOBAL && effectiveStatus(s, new Date()) === ACTIVE);
        if (globals.length) {
          await set({ status: PAUSED, paused_reason: GLOBAL_ACTIVE });
          return { response: err('activation_refused', 409, { reason: GLOBAL_ACTIVE }) };
        }
      }
      return { done: true };
    };
    const locked = await withLock(db, scope === GLOBAL ? 'global' : `guild:${gid}`, run);
    if (locked.locked) return { response: err('busy', 409) };
    if (locked.value.response) return locked.value;
    return { season: await col(db).findOne({ _id: id }) };
  }
  if (action === 'pause') {
    if (![ACTIVE, SCHEDULED].includes(season.status)) return { response: err('bad_status', 409) };
    await set({ status: PAUSED, paused_reason: 'manual' });
  } else if (action === 'complete') {
    if (![ACTIVE, SCHEDULED, PAUSED].includes(season.status) || current === COMPLETED) return { response: err('bad_status', 409) };
    const ends = aware(season.ends_at);
    await set({ status: COMPLETED, ends_at: ends && ends < now ? ends : now });
  } else if (action === 'archive') {
    if (![COMPLETED, DRAFT, PAUSED].includes(season.status) && current !== COMPLETED) return { response: err('bad_status', 409) };
    await set({ status: ARCHIVED });
  } else {
    return { response: err('not_found', 404) };
  }
  return { season: await col(db).findOne({ _id: id }) };
}

async function duplicate(db, { scope, gid, season, userId }) {
  if (scope === GUILD) {
    const n = await col(db).countDocuments({ scope: GUILD, guild_id: toLong(gid), status: { $ne: ARCHIVED } });
    if (n >= LIMITS.MAX_GUILD_SEASONS) return { response: err('too_many_seasons', 409, { max: LIMITS.MAX_GUILD_SEASONS }) };
  }
  const now = new Date();
  const { _id, activated_at, announced_at, start_notified_at, end_notified_at, ...rest } = season;
  const copy = {
    ...rest, name: `${season.name} (copy)`.slice(0, LIMITS.NAME), status: DRAFT, starts_at: null, ends_at: null,
    created_at: now, updated_at: now, created_by: toLong(userId), version: 1,
  };
  const res = await col(db).insertOne(copy);
  return { season: { ...copy, _id: res.insertedId } };
}

async function removeSeason(db, season) {
  if (season.status !== DRAFT) return { response: err('only_drafts', 409) };
  if (await db.collection(COLL.progress).countDocuments({ season_id: String(season._id) }, { limit: 1 })) return { response: err('has_progress', 409) };
  await col(db).deleteOne({ _id: season._id });
  return { done: true };
}

/** The shared season routes, used by both the owner (Global) and the server (Premium) trees. */
async function seasonRoutes({ db, rest, method, request, scope, gid, userId }) {
  const log = (action, season, changes) => audit(db, { seasonId: season?._id, actor: userId, action, target: scope === GUILD ? String(gid) : 'global', changes });
  const after = async (season) => { await notifyBot(db, scope === GUILD ? gid : 0, userId); return json({ season: seasonView(season, { full: true }) }); };

  if (rest.length === 0) {
    if (method === 'GET') {
      const rows = await col(db).find(scopeFilter(scope, gid)).sort({ updated_at: -1 }).limit(200).toArray();
      const now = new Date();
      return json({ seasons: rows.map((s) => ({ ...seasonView(s), effective_status: effectiveStatus(s, now) })) });
    }
    if (method === 'POST') {
      if (await limited(db, `create:${userId}`, 20)) return err('rate_limited', 429);
      const body = await readJson(request);
      if (!body) return err('invalid_body', 400);
      const r = await saveSeason(db, { scope, gid, existing: null, body, userId });
      if (r.response) return r.response;
      await log('season.create', r.season, { name: r.season.name });
      return json({ season: seasonView(r.season, { full: true }) }, { status: 201 });
    }
    return err('method_not_allowed', 405);
  }

  const season = await loadSeason(db, rest[0], scope, gid);
  if (!season) return err('not_found', 404);

  if (rest.length === 1) {
    if (method === 'GET') {
      const all = (await live(db)).map(forPriority);
      const [ok, reason] = activationCheck(forPriority(season), all, { premium: scope === GLOBAL ? true : await isGuildPremium(db, gid), ownerOk: true, now: new Date() });
      const now = new Date();
      const blocks = await loadBlocks(db);
      const conflicts = scope === GUILD ? scheduleConflicts(forPriority(season), all, blocks, now) : [];
      const ready = readiness(seasonView(season, { full: true }), { scope, premium: scope === GLOBAL ? true : await isGuildPremium(db, gid), conflicts, now });
      return json({ season: seasonView(season, { full: true }), effective_status: effectiveStatus(season, now), activation: { ok, reason }, limits: await loadLimits(db), readiness: ready, busy: scope === GUILD ? busyRanges(all, blocks, now) : [] });
    }
    if (method === 'PATCH') {
      if (await limited(db, `edit:${userId}`, 60)) return err('rate_limited', 429);
      const body = await readJson(request);
      if (!body) return err('invalid_body', 400);
      const r = await saveSeason(db, { scope, gid, existing: season, body, userId });
      if (r.response) return r.response;
      await log('season.update', r.season, { fields: r.changed });
      return after(r.season);
    }
    if (method === 'DELETE') {
      const r = await removeSeason(db, season);
      if (r.response) return r.response;
      await log('season.delete', season, { name: season.name });
      return json({ ok: true });
    }
    return err('method_not_allowed', 405);
  }

  if (rest.length === 2 && method === 'POST') {
    const action = rest[1];
    if (await limited(db, `act:${userId}`, 30)) return err('rate_limited', 429);
    if (action === 'duplicate') {
      const r = await duplicate(db, { scope, gid, season, userId });
      if (r.response) return r.response;
      await log('season.duplicate', r.season, { from: String(season._id) });
      return json({ season: seasonView(r.season, { full: true }) }, { status: 201 });
    }
    if (action === 'announce') {
      if (scope !== GUILD) return err('not_found', 404);
      if (![ACTIVE, SCHEDULED, PAUSED].includes(season.status)) return err('bad_status', 409);
      if (!season.notifications?.channel_id) return err('no_channel', 409);
      const answer = await askBot(db, { kind: 'bp_announce', guildId: gid, userId, payload: { season_id: String(season._id), force: true } });
      if (answer.error) return err(answer.error, answer.error === 'bot_unreachable' ? 503 : 409);
      await log('season.announce', season, { channel: String(season.notifications.channel_id) });
      return json({ ok: true, sent: Boolean(answer.result?.sent) });
    }
    const r = await transition(db, { action, scope, gid, season, userId });
    if (r.response) {
      await log(`season.${action}.refused`, season, { status: r.response.status });
      return r.response;
    }
    await log(`season.${action}`, r.season, { from: season.status, to: r.season.status });
    if (action === 'activate' && scope === GUILD) await queueAnnounce(db, { gid, season: r.season, userId });
    return after(r.season);
  }
  return err('not_found', 404);
}

// ---------------------------------------------------------------------------------------------- owner tree
async function ownerRoutes({ db, parts, method, request, userId }) {
  const write = method !== 'GET';
  if (!(await ownerAccess(db, userId, { write }))) return err('forbidden', 403);
  const [, area, ...rest] = parts;

  if (area === 'seasons') return seasonRoutes({ db, rest, method, request, scope: GLOBAL, gid: null, userId });
  if (area === 'pages') return studioRoutes({ db, rest, method, request, userId, readJson, json, err });

  if (area === 'blocked') {
    if (method === 'GET' && rest.length === 0) return json({ blocked: (await loadBlocks(db)).map(blockView), max: MAX_BLOCKS });
    if (method === 'POST' && rest.length === 0) {
      const body = await readJson(request, 4 * 1024);
      if (!body) return err('invalid_body', 400);
      const c = cleanBlock(body);
      if (!c.ok) return err(c.error, 422);
      const current = await loadBlocks(db);
      if (current.length >= MAX_BLOCKS) return err('too_many_blocks', 409, { max: MAX_BLOCKS });
      const range = { id: randomUUID().replaceAll('-', '').slice(0, 24), ...c.range, created_by: toLong(userId), created_at: new Date() };
      await db.collection(COLL.state).updateOne({ _id: 'blocked_dates' }, { $push: { ranges: range } }, { upsert: true });
      await audit(db, { actor: userId, action: 'calendar.block', target: 'global', changes: { starts_at: range.starts_at, ends_at: range.ends_at, reason: range.reason } });
      await notifyBot(db, 0, userId);
      return json({ blocked: (await loadBlocks(db)).map(blockView) }, { status: 201 });
    }
    if (method === 'DELETE' && rest.length === 1) {
      await db.collection(COLL.state).updateOne({ _id: 'blocked_dates' }, { $pull: { ranges: { id: String(rest[0]) } } });
      await audit(db, { actor: userId, action: 'calendar.unblock', target: String(rest[0]) });
      return json({ blocked: (await loadBlocks(db)).map(blockView) });
    }
    return err('method_not_allowed', 405);
  }

  if (area === 'overview' && method === 'GET') {
    const now = new Date();
    const all = await col(db).find({}).project({ scope: 1, status: 1, starts_at: 1, ends_at: 1, name: 1, activated_at: 1, guild_id: 1 }).toArray();
    const running = all.filter((s) => effectiveStatus(s, now) === ACTIVE);
    const globalRunning = running.find((s) => s.scope === GLOBAL);
    const day = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10).replaceAll('-', '');
    const stats = (globalRunning ? await db.collection(COLL.stats).find({ season_id: String(globalRunning._id), day: { $gte: day(6) } }).toArray() : []).map((r) => flatStats(r));
    const sum = (key) => stats.reduce((n, s) => n + Number(s?.[key] || 0), 0);
    return json({
      global_running: globalRunning ? seasonView(globalRunning) : null,
      counts: {
        global: all.filter((s) => s.scope === GLOBAL).length, server: all.filter((s) => s.scope === GUILD).length,
        server_running: running.filter((s) => s.scope === GUILD).length,
        // Server seasons that are switched on but not running because the Global season has priority.
        server_suspended: globalRunning ? running.filter((s) => s.scope === GUILD).length : 0,
      },
      participants: globalRunning ? await db.collection(COLL.progress).countDocuments({ season_id: String(globalRunning._id) }) : 0,
      week: { xp_message: sum('xp.message'), xp_voice: sum('xp.voice'), xp_quest: sum('xp.quest'), rewards_claimed: sum('rewards.claimed'), achievements: sum('achievements.completed') },
    });
  }

  if (area === 'limits') {
    if (method === 'GET') return json({ limits: await loadLimits(db), defaults: DEFAULT_GUILD_LIMITS });
    if (method === 'PATCH') {
      const body = await readJson(request, 8 * 1024);
      if (!body) return err('invalid_body', 400);
      const bounds = {
        max_message_xp: [1, LIMITS.MAX_MESSAGE_XP], max_voice_xp: [1, LIMITS.MAX_VOICE_XP_PER_INTERVAL], max_per_day: [100, 100000],
        max_per_week: [100, 500000], max_per_season: [1000, LIMITS.MAX_TOTAL_XP], max_multiplier: [0, LIMITS.MAX_PREMIUM_MULTIPLIER],
        min_message_cooldown: [LIMITS.MIN_MESSAGE_COOLDOWN, 3600], min_voice_interval: [LIMITS.MIN_VOICE_INTERVAL, 3600],
      };
      const current = await loadLimits(db); const errors = []; const next = { ...current };
      for (const [k, [lo, hi]] of Object.entries(bounds)) {
        if (body[k] === undefined) continue;
        const n = Number(body[k]);
        if (!Number.isFinite(n) || n < lo || n > hi || (k !== 'max_multiplier' && !Number.isInteger(n))) errors.push({ field: k, code: 'out_of_range', params: { min: lo, max: hi } });
        else next[k] = n;
      }
      if (errors.length) return err('validation_failed', 422, { errors });
      await db.collection(COLL.state).updateOne({ _id: 'limits' }, { $set: { values: next, updated_at: new Date() } }, { upsert: true });
      await audit(db, { actor: userId, action: 'limits.update', target: 'limits', changes: next });
      await notifyBot(db, 0, userId);
      return json({ limits: next });
    }
  }

  if (area === 'audit' && method === 'GET') {
    const rows = await db.collection(COLL.audit).find({}).sort({ at: -1 }).limit(100).toArray();
    return json({ entries: rows.map((r) => ({ id: String(r._id), at: r.at?.toISOString?.() || null, actor: r.actor ? String(r.actor) : null, action: r.action, target: r.target, season_id: r.season_id, result: r.result, changes: r.changes })) });
  }

  if (area === 'reports' && method === 'GET') {
    const rows = await db.collection(COLL.stats).find({ day: { $gte: new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10).replaceAll('-', '') } }).sort({ day: 1 }).limit(2000).toArray();
    const byDay = new Map();
    for (const r of rows) {
      const d = byDay.get(r.day) || { day: r.day, xp: 0, rewards: 0, refused: 0 };
      for (const [k, v] of Object.entries(flatStats(r))) {
        if (k.startsWith('xp.')) d.xp += Number(v) || 0;
        else if (k === 'rewards.claimed') d.rewards += Number(v) || 0;
        else if (k.startsWith('refused.')) d.refused += Number(v) || 0;
      }
      byDay.set(r.day, d);
    }
    return json({ days: [...byDay.values()] });
  }
  return err('not_found', 404);
}

// ---------------------------------------------------------------------------------------------- delivery form (owner side)
// One entry per member, season and reward: a fixed-length hash of that key is the document id, so saving is one atomic upsert.
const SUBMISSION_ID = /^[a-f0-9]{40}$/;
const submissionId = (gid, seasonId, userId, rewardKey) => createHash('sha1').update(`${gid}:${seasonId}:${userId}:${rewardKey}`).digest('hex');

async function rewardNames(db, seasonIds) {
  const names = new Map();
  for (const id of seasonIds) {
    const sid = oid(id);
    if (!sid) continue;
    const doc = await col(db).findOne({ _id: sid }, { projection: { rewards: 1 } });
    for (const r of doc?.rewards || []) names.set(`${id}:${r.id}`, r.name);
  }
  return names;
}

async function formOwnerRoutes({ db, gid, area, rest, method, request, userId, premium }) {
  const forms = db.collection(COLL.forms);
  const subs = db.collection(COLL.submissions);
  if (area === 'form') {
    if (method === 'GET') {
      const doc = await forms.findOne({ _id: String(gid) });
      return json({ form: doc ? { ...publicForm(doc), updated_at: doc.updated_at?.toISOString?.() || null } : { ...DEFAULT_FORM }, premium });
    }
    if (method === 'PUT') {
      if (!premium) return err('premium_required', 402);
      if (await limited(db, `form-save:${gid}`, 20)) return err('rate_limited', 429);
      const body = await readJson(request, 32 * 1024);
      if (!body) return err('invalid_body', 400);
      const { errors, doc } = cleanForm(body);
      if (errors.length) return json({ error: 'validation_failed', errors }, { status: 422 });
      await forms.updateOne({ _id: String(gid) }, { $set: { ...doc, guild_id: toLong(gid), updated_at: new Date(), updated_by: toLong(userId) } }, { upsert: true });
      await audit(db, { actor: userId, action: 'form.save', target: String(gid), changes: { enabled: doc.enabled, fields: doc.fields.length } });
      return json({ form: publicForm(doc) });
    }
    return err('method_not_allowed', 405);
  }

  // area === 'submissions'
  const [id] = rest;
  if (!id && method === 'GET') {
    const url = new URL(request.url);
    const status = url.searchParams.get('status') || 'new';
    if (status !== 'all' && !SUBMISSION_STATUSES.includes(status)) return err('invalid_body', 400);
    const before = url.searchParams.get('before');
    const filter = { guild_id: toLong(gid) };
    if (status !== 'all') filter.status = status;
    if (before) { const d = new Date(before); if (Number.isNaN(d.getTime())) return err('invalid_body', 400); filter.created_at = { $lt: d }; }
    const rows = await subs.find(filter).sort({ created_at: -1 }).limit(FORM_LIMITS.PAGE + 1).toArray();
    const page = rows.slice(0, FORM_LIMITS.PAGE);
    const names = await rewardNames(db, [...new Set(page.map((r) => r.season_id))]);
    const entries = [];
    for (const r of page) {
      const u = await getDiscordUserById(String(r.user_id)).catch(() => null);
      entries.push({ ...submissionView(r, { withUser: true }), user_name: u?.global_name || u?.username || '', reward_name: r.reward_id ? names.get(`${r.season_id}:${r.reward_id}`) || r.reward_id : null });
    }
    const counts = {};
    for (const st of SUBMISSION_STATUSES) counts[st] = await subs.countDocuments({ guild_id: toLong(gid), status: st });
    return json({ entries, counts, next: rows.length > FORM_LIMITS.PAGE ? page.at(-1).created_at.toISOString() : null });
  }
  if (id && SUBMISSION_ID.test(id)) {
    if (method === 'PATCH') {
      if (await limited(db, `form-handle:${gid}`, 120)) return err('rate_limited', 429);
      const body = await readJson(request, 4 * 1024);
      if (!body || !SUBMISSION_STATUSES.includes(body.status)) return err('invalid_body', 400);
      const res = await subs.findOneAndUpdate({ _id: id, guild_id: toLong(gid) },
        { $set: { status: body.status, note: plain(body.note, FORM_LIMITS.NOTE), handled_by: toLong(userId), handled_at: new Date(), updated_at: new Date() } }, { returnDocument: 'after' });
      const doc = res?.value ?? res;
      if (!doc || !doc._id) return err('not_found', 404);
      await audit(db, { actor: userId, action: 'form.handle', target: id, changes: { status: body.status } });
      return json({ entry: submissionView(doc, { withUser: true }) });
    }
    if (method === 'DELETE') {
      const r = await subs.deleteOne({ _id: id, guild_id: toLong(gid) });
      if (!r.deletedCount) return err('not_found', 404);
      await audit(db, { actor: userId, action: 'form.delete', target: id });
      return json({ ok: true });
    }
  }
  return err(id ? 'not_found' : 'method_not_allowed', id ? 404 : 405);
}

// ---------------------------------------------------------------------------------------------- premium tree
async function guildRoutes({ db, session, parts, method, request, userId }) {
  const [, gid, area, ...rest] = parts;
  const gate = await guildManager(db, session, gid);
  if (!gate.ok) return gate.response;
  const premium = await isGuildPremium(db, gid);

  if (area === 'status' && method === 'GET') {
    const now = new Date();
    const all = (await live(db)).map(forPriority);
    const [running, reason] = resolveForGuild(all, gid, premium, now);
    const coming = upcomingForGuild(all, gid, now).slice(0, 3);
    return json({
      premium, running: running ? { id: running.id, scope: running.scope, name: running.name, ends_at: running.ends_at ? aware(running.ends_at)?.toISOString() : null } : null, reason,
      global_active: all.some((s) => s.scope === GLOBAL && effectiveStatus(s, now) === ACTIVE),
      // published seasons that have not started: shown as "Coming soon" with their name, text and start date
      upcoming: coming.map((s) => ({ id: s.id, scope: s.scope, name: s.name, description: s.description || '', i18n: s.i18n || null, starts_at: s.starts_at ? aware(s.starts_at)?.toISOString() : null })),
    });
  }
  if (area === 'calendar' && method === 'GET') {
    const now = new Date();
    return json({ busy: busyRanges((await live(db)).map(forPriority), await loadBlocks(db), now), now: now.toISOString() });
  }
  if (area === 'form' || area === 'submissions') return formOwnerRoutes({ db, gid, area, rest, method, request, userId, premium });
  if (area !== 'seasons') return err('not_found', 404);
  // Reading what already exists never needs Premium; creating or changing does, so an expired server keeps its drafts and progress.
  if (method !== 'GET' && !(rest.length === 2 && ['pause', 'complete', 'archive'].includes(rest[1])) && !(method === 'DELETE') && !premium) {
    return err('premium_required', 402);
  }
  return seasonRoutes({ db, rest, method, request, scope: GUILD, gid, userId });
}

// ---------------------------------------------------------------------------------------------- member tree
async function resolveSeasonFor(db, gid, now = new Date()) {
  const all = (await live(db)).map(forPriority);
  const premium = gid ? await isGuildPremium(db, gid) : false;
  const [running, reason] = resolveForGuild(all, gid || '0', premium, now);
  return { running: running ? await col(db).findOne({ _id: oid(running.id) }) : null, reason };
}

async function memberRoutes({ db, parts, method, request, userId, url }) {
  const [area] = parts;
  if (area === 'me' && method === 'GET') {
    const gid = url.searchParams.get('guild');
    if (gid && !SNOWFLAKE.test(gid)) return err('invalid_id', 400);
    const { running, reason } = await resolveSeasonFor(db, gid);
    if (!running) return json({ season: null, reason });
    const now = new Date();
    return json({ season: publicSeason(running, now), state: await memberState(db, running, userId, now), reason });
  }

  if (area === 'claim' && method === 'POST') {
    if (await limited(db, `claim:${userId}`, 20)) return err('rate_limited', 429);
    const body = await readJson(request, 2 * 1024);
    const sid = oid(body?.season_id);
    const rewardId = String(body?.reward_id || '').slice(0, 64);
    if (!sid || !rewardId) return err('invalid_body', 400);
    const season = await col(db).findOne({ _id: sid });
    if (!season || season.status === DRAFT) return err('not_found', 404);
    const now = new Date();
    // Early refusal with the same rule the bot applies; the bot's engine still makes the final decision.
    const state = await memberState(db, season, userId, now);
    const reward = (season.rewards || []).find((r) => r.id === rewardId);
    const thr = thresholds((season.levels || []).map((l) => l.xp));
    const [ok, code] = claimDecision(reward, {
      seasonStatus: state.status, level: levelForXp(thr, state.xp)[0], xp: state.xp, claimed: state.claimed.includes(rewardId),
      protection: season.protection || {}, now,
    });
    if (!ok) return json({ ok: false, code }, { status: 409 });
    const answer = await askBot(db, { kind: 'bp_claim', guildId: season.guild_id, userId, payload: { season_id: String(season._id), reward_id: rewardId } });
    if (answer.error) return err(answer.error === 'bot_unreachable' ? 'bot_unreachable' : 'bot_error', 503);
    if (!answer.result.ok) return json({ ok: false, code: answer.result.code || 'refused' }, { status: 409 });
    return json({ ok: true, state: await memberState(db, season, userId, new Date()) });
  }

  if (area === 'form') {
    const forms = db.collection(COLL.forms);
    const subs = db.collection(COLL.submissions);
    if (method === 'GET') {
      const gid = url.searchParams.get('guild');
      if (!gid || !SNOWFLAKE.test(gid)) return err('invalid_id', 400);
      const { running, reason } = await resolveSeasonFor(db, gid);
      const doc = await forms.findOne({ _id: String(gid) });
      const active = Boolean(running && running.scope === GUILD && String(running.guild_id) === String(gid) && doc?.enabled);
      if (!active) return json({ available: false, reason: reason || (doc?.enabled ? 'season_not_running' : 'form_off') });
      const claims = await db.collection(COLL.claims).find({ season_id: String(running._id), user_id: toLong(userId) }).project({ reward_id: 1 }).toArray();
      const have = new Set(claims.map((c) => String(c.reward_id)));
      const rewards = (running.rewards || []).filter((r) => have.has(r.id)).map((r) => ({ id: r.id, name: r.name, i18n: r.i18n || null }));
      const mine = await subs.find({ guild_id: toLong(gid), season_id: String(running._id), user_id: toLong(userId) }).sort({ created_at: -1 }).limit(50).toArray();
      return json({ available: true, form: publicForm(doc), season_id: String(running._id), rewards, mine: mine.map((m) => submissionView(m)) });
    }
    if (method === 'POST') {
      if (await limited(db, `form-submit:${userId}`, 6)) return err('rate_limited', 429);
      const body = await readJson(request, 16 * 1024);
      const gid = String(body?.guild || '');
      if (!body || !SNOWFLAKE.test(gid)) return err('invalid_id', 400);
      if (!(await isGuildPremium(db, gid))) return err('premium_required', 402);
      const banned = await db.collection('guild_bans').findOne({ guild_id: gid, active: true });
      if (banned) return err('guild_banned', 403);
      const { running } = await resolveSeasonFor(db, gid);
      if (!running || running.scope !== GUILD || String(running.guild_id) !== gid) return err('season_not_running', 409);
      const doc = await forms.findOne({ _id: gid });
      if (!doc?.enabled) return err('form_off', 409);
      const seasonId = String(running._id);
      // Only someone who took part in this season can write to the owner: a member with progress in it.
      if (!(await db.collection(COLL.progress).findOne({ _id: `${seasonId}:${userId}` }))) return err('no_progress', 403);
      let rewardKey = 'general'; let rewardId = null;
      if (body.reward_id !== undefined && body.reward_id !== null && body.reward_id !== '') {
        rewardId = String(body.reward_id).slice(0, 64);
        if (!/^[A-Za-z0-9_-]{1,64}$/.test(rewardId)) return err('invalid_body', 400);
        const claimed = await db.collection(COLL.claims).findOne({ season_id: seasonId, user_id: toLong(userId), reward_id: rewardId });
        if (!claimed) return err('reward_not_claimed', 403);
        rewardKey = rewardId;
      }
      const { errors, answers } = cleanAnswers(doc, body.answers);
      if (errors.length) return json({ error: 'validation_failed', errors }, { status: 422 });
      const id = submissionId(gid, seasonId, userId, rewardKey);
      const existing = await subs.findOne({ _id: id });
      if (existing && existing.status === 'delivered') return err('already_delivered', 409);
      const now = new Date();
      await subs.updateOne({ _id: id }, {
        $set: { guild_id: toLong(gid), season_id: seasonId, user_id: toLong(userId), reward_id: rewardId, answers, status: 'new', note: '', updated_at: now },
        $setOnInsert: { created_at: now },
      }, { upsert: true });
      return json({ ok: true, entry: submissionView(await subs.findOne({ _id: id })) }, { status: existing ? 200 : 201 });
    }
    if (method === 'DELETE') {
      const id = parts[1];
      if (!id || !SUBMISSION_ID.test(id)) return err('not_found', 404);
      const r = await subs.deleteOne({ _id: id, user_id: toLong(userId) });
      return r.deletedCount ? json({ ok: true }) : err('not_found', 404);
    }
    return err('method_not_allowed', 405);
  }

  if (area === 'inventory' && method === 'GET') {
    const items = await db.collection(COLL.inventory).find({ user_id: toLong(userId) }).sort({ obtained_at: -1 }).limit(500).toArray();
    const profile = await db.collection(COLL.profiles).findOne({ user_id: toLong(userId) });
    return json({
      items: items.map((i) => ({ item_id: i.item_id, season_id: i.season_id, type: i.type, rarity: i.rarity, name: i.name, i18n: i.i18n || null, icon: i.icon || null, art: i.art || null, obtained_at: i.obtained_at?.toISOString?.() || null })),
      seasons: await inventorySeasons(db, items),
      profile: { equipped: profile?.equipped || {}, showcase: profile?.showcase || [], featured_badge: profile?.featured_badge || null, hidden_seasons: profile?.hidden_seasons || [], hidden_items: profile?.hidden_items || [] },
    });
  }

  if (area === 'profile' && method === 'PATCH') {
    if (await limited(db, `profile:${userId}`, 30)) return err('rate_limited', 429);
    const body = await readJson(request, 4 * 1024);
    if (!body) return err('invalid_body', 400);
    const items = await db.collection(COLL.inventory).find({ user_id: toLong(userId) }).project({ item_id: 1, type: 1 }).toArray();
    const owned = new Map(items.map((i) => [i.item_id, i.type]));
    const errors = []; const set = {};
    if (body.equipped !== undefined) {
      const eq = {};
      for (const slot of ['frame', 'background', 'accent', 'title', 'avatar_decoration', 'decoration']) {
        const v = body.equipped?.[slot];
        if (v === undefined || v === null || v === '') continue;
        if (!owned.has(String(v))) { errors.push({ field: `equipped.${slot}`, code: 'not_owned' }); continue; }
        const type = owned.get(String(v));
        const ok = { frame: ['frame'], background: ['background'], accent: ['accent'], title: ['title'], avatar_decoration: ['avatar_decoration'], decoration: ['decoration'] }[slot];
        if (!ok.includes(type)) errors.push({ field: `equipped.${slot}`, code: 'wrong_type' }); else eq[slot] = String(v);
      }
      set.equipped = eq;
    }
    if (body.showcase !== undefined) {
      if (!Array.isArray(body.showcase) || body.showcase.length > 6) errors.push({ field: 'showcase', code: 'too_many', params: { max: 6 } });
      else {
        const ids = [...new Set(body.showcase.map(String))];
        if (ids.some((x) => !owned.has(x))) errors.push({ field: 'showcase', code: 'not_owned' }); else set.showcase = ids;
      }
    }
    if (body.featured_badge !== undefined) {
      const v = body.featured_badge === null ? null : String(body.featured_badge);
      if (v !== null && (!owned.has(v) || owned.get(v) !== 'badge')) errors.push({ field: 'featured_badge', code: 'not_owned' }); else set.featured_badge = v;
    }
    if (body.hidden_seasons !== undefined) {
      if (!Array.isArray(body.hidden_seasons) || body.hidden_seasons.length > 200) errors.push({ field: 'hidden_seasons', code: 'invalid' });
      else set.hidden_seasons = [...new Set(body.hidden_seasons.map(String))].filter((x) => x.length <= 64);
    }
    if (body.hidden_items !== undefined) {
      if (!Array.isArray(body.hidden_items) || body.hidden_items.length > 500) errors.push({ field: 'hidden_items', code: 'invalid' });
      else set.hidden_items = [...new Set(body.hidden_items.map(String))].filter((x) => owned.has(x));
    }
    if (errors.length) return err('validation_failed', 422, { errors });
    await db.collection(COLL.profiles).updateOne({ user_id: toLong(userId) }, { $set: { ...set, updated_at: new Date() }, $setOnInsert: { created_at: new Date() } }, { upsert: true });
    return json({ ok: true });
  }
  return err('not_found', 404);
}

async function inventorySeasons(db, items) {
  const ids = [...new Set(items.map((i) => i.season_id).filter(Boolean))].slice(0, 100);
  if (!ids.length) return [];
  const docs = await db.collection(COLL.seasons).find({ _id: { $in: ids.map((x) => oid(x)).filter(Boolean) } }).project({ name: 1, i18n: 1, scope: 1 }).toArray();
  return docs.map((d) => ({ id: String(d._id), name: d.name || '', i18n: d.i18n || null, scope: d.scope || 'global' }));
}

export { REWARD_TYPES };

// ---------------------------------------------------------------------------------------------- entry
export async function handle({ request, db, parts, method, url }) {
  if (method !== 'GET' && !trustedOrigin(request)) return err('forbidden_origin', 403);
  const me = await who(db);
  if (me.error) return me.error;
  const { session, userId } = me;
  const [head] = parts;
  if (head === 'owner') return ownerRoutes({ db, parts, method, request, userId });
  if (head === 'guilds') return guildRoutes({ db, session, parts, method, request, userId });
  return memberRoutes({ db, parts, method, request, userId, url });
}

// Wody Counting API (mounted at /api/counting/*).
//
//   Public (no sign in, public games only, counters only)
//     GET    public/summary                          totals
//     GET    public/games?mode&sort&q&skip           public games
//     GET    public/games/:channelId                 one public game: state, top counters, recent rounds, last 30 days
//     GET    public/leaderboard?board                global board (members of public games)
//   Member (signed in)
//     GET    me?guild=:gid                           my counters in a server and in total
//   Server manager
//     GET    guilds/:gid/games                       POST guilds/:gid/games {channel_id, mode, name, config, i18n}
//     GET    guilds/:gid/games/:cid                  PATCH guilds/:gid/games/:cid {config, mode, name, i18n}
//     POST   guilds/:gid/games/:cid/{reset|pause|resume|archive|grant_save}
//     DELETE guilds/:gid/games/:cid                  delete the game for good (frees the channel); member totals and badges stay
//     GET    guilds/:gid/games/:cid/history
//     GET    guilds/:gid/competitions                POST guilds/:gid/competitions        PATCH guilds/:gid/competitions/:id
//     DELETE guilds/:gid/competitions/:id            cancel
//   Owner (writes), delegates (read)
//     GET    owner/overview | owner/config | owner/audit | owner/stats | owner/games?status&skip
//     PATCH  owner/config                            {limits, powerups, protection, modes_enabled, enabled ...}
//     GET    owner/defs?kind       POST owner/defs {kind,...}       DELETE owner/defs/:kind/:id
//     GET    owner/seasons         POST owner/seasons               PATCH owner/seasons/:id        POST owner/seasons/:id/{pause|resume|archive}
//     GET    owner/competitions    POST owner/competitions          PATCH owner/competitions/:id   DELETE owner/competitions/:id
//     POST   owner/games/:cid/{pause|resume|archive|reset}      DELETE owner/games/:cid
//
// Rules that hold for every route: the Discord session decides who is asking, ids in a body never decide who may act,
// the website never writes Counting data itself (the bot validates and writes), and nothing here reads or stores message text.
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { OWNER_ID, getDelegate, trustedOrigin } from '@/lib/owner-access';
import { isAccountBlocked } from '@/lib/account-moderation';
import { toLong } from '@/lib/mongo';
import { getUserGuilds, canManage } from '@/lib/discord';
import { COLL, MODES, BOARDS, PERIODS, DEF_KINDS, GAME_ACTIONS, SNOWFLAKE, ID, PAGE } from './constants.js';
import { askBot, gameView, iso, str, int } from './store.js';
import { loadSummary, loadGames, loadGame, loadGlobalBoard } from './public.js';

export function json(data, init = {}) {
  return NextResponse.json(data, { ...init, headers: { 'Cache-Control': 'no-store, private', ...(init.headers || {}) } });
}
export const err = (code, status = 400, extra = {}) => json({ error: code, ...extra }, { status });
const publicJson = (data) => json(data, { headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=120' } });

async function readJson(request, max = 256 * 1024) {
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
      { _id: `ct:${key}:${start}` }, { $inc: { count: 1 }, $setOnInsert: { expires_at: new Date(start + windowMs * 2) } },
      { upsert: true, returnDocument: 'after' });
    return (r?.count ?? r?.value?.count ?? 0) > max;
  } catch { return false; }
}

const clientKey = (request) => String(request.headers.get('x-forwarded-for') || 'local').split(',')[0].trim().slice(0, 64);
const pageSkip = (url) => Math.min(Math.max(int(url.searchParams.get('skip')), 0), 10000);

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
  if (res.error) return err(res.error, res.error === 'bot_unreachable' ? 503 : res.error === 'rate_limited' ? 429 : res.error === 'forbidden' ? 403 : 400);
  const r = res.result || {};
  if (r.ok === false) return err(r.errors?.length ? 'validation_failed' : (r.code || 'failed'), r.errors?.length ? 422 : 409, r.errors?.length ? { errors: r.errors } : {});
  return json({ ok: true, ...r });
}

// ---------------------------------------------------------------------------------------------- public
async function publicRoutes({ db, parts, request, url }) {
  if (await limited(db, `pub:${clientKey(request)}`, 90)) return err('rate_limited', 429);
  const [, what, id] = parts;
  if (what === 'summary') return publicJson(await loadSummary(db));
  if (what === 'games' && !id) {
    const out = await loadGames(db, { mode: url.searchParams.get('mode') || '', q: url.searchParams.get('q') || '', sort: url.searchParams.get('sort') || 'record', skip: pageSkip(url) });
    return out.error ? err(out.error, 400) : publicJson(out);
  }
  if (what === 'games' && id) {
    const out = await loadGame(db, id);
    return out ? publicJson(out) : err('not_found', 404);
  }
  if (what === 'leaderboard') {
    const out = await loadGlobalBoard(db, url.searchParams.get('board') || 'valid', pageSkip(url));
    return out.error ? err(out.error, 400) : publicJson(out);
  }
  return err('not_found', 404);
}

// ---------------------------------------------------------------------------------------------- member
async function memberRoutes({ db, parts, url, userId }) {
  if (parts[0] !== 'me') return err('not_found', 404);
  const gid = url.searchParams.get('guild');
  const user = toLong(userId);
  const read = async (guild) => {
    const p = await db.collection(COLL.players).findOne({ guild_id: toLong(guild), user_id: user });
    if (!p) return null;
    const valid = int(p.valid), errors = int(p.errors);
    return { valid, errors, accuracy: valid + errors ? Math.round((10000 * valid) / (valid + errors)) / 100 : 0, best_streak: int(p.best_streak), record: int(p.record), xp: int(p.xp), streak: int(p.streak), sessions: int(p.sessions) };
  };
  if (gid && !SNOWFLAKE.test(gid)) return err('invalid_id', 400);
  return json({ guild: gid ? await read(gid) : null, total: await read(0) });
}

// ---------------------------------------------------------------------------------------------- server manager
async function guildRoutes({ db, session, parts, method, request, userId }) {
  const [, gid, area, id, action] = parts;
  const gate = await guildManager(db, session, gid);
  if (!gate.ok) return gate.response;
  if (method !== 'GET' && (await limited(db, `g:${gid}`, 40))) return err('rate_limited', 429);
  const games = db.collection(COLL.games);
  if (area === 'games' && !id) {
    if (method === 'GET') {
      const rows = await games.find({ guild_id: toLong(gid) }).sort({ created_at: 1 }).limit(50).toArray();
      return json({ games: rows.map((d) => gameView(d, { manager: true })) });
    }
    if (method === 'POST') {
      const body = await readJson(request);
      if (!body || !SNOWFLAKE.test(String(body.channel_id))) return err('invalid_body', 400);
      const mode = String(body.mode || 'classic');
      if (!MODES.includes(mode) && !/^custom:[a-z][a-z0-9_]{0,31}$/.test(mode)) return err('invalid_mode', 400);
      return botAnswer(await askBot(db, { guildId: gid, userId, payload: { action: 'create_game', channel_id: String(body.channel_id), mode, name: String(body.name || '').slice(0, 60), config: body.config || null, i18n: body.i18n || null } }));
    }
    return err('method_not_allowed', 405);
  }
  if (area === 'games' && id) {
    if (!SNOWFLAKE.test(id)) return err('not_found', 404);
    const doc = await games.findOne({ _id: toLong(id), guild_id: toLong(gid) });
    if (!doc) return err('not_found', 404);
    if (!action && method === 'GET') return json({ game: gameView(doc, { manager: true }) });
    if (!action && method === 'DELETE') {
      return botAnswer(await askBot(db, { guildId: gid, userId, payload: { action: 'delete', channel_id: String(id) } }));
    }
    if (!action && method === 'PATCH') {
      const body = await readJson(request);
      if (!body) return err('invalid_body', 400);
      if (body.mode !== undefined && !MODES.includes(body.mode) && !/^custom:[a-z][a-z0-9_]{0,31}$/.test(String(body.mode))) return err('invalid_mode', 400);
      return botAnswer(await askBot(db, { guildId: gid, userId, payload: { action: 'update_game', channel_id: String(id), config: body.config, mode: body.mode, name: body.name, i18n: body.i18n } }));
    }
    if (action === 'history' && method === 'GET') {
      const rows = await db.collection(COLL.history).find({ channel_id: doc._id }, { projection: { _id: 0 } }).sort({ ended_at: -1 }).limit(50).toArray();
      return json({ history: rows.map((h) => ({ ...h, game_id: undefined, channel_id: undefined, guild_id: undefined, ended_at: iso(h.ended_at) })) });
    }
    if (method === 'POST' && GAME_ACTIONS.includes(action)) {
      const body = (await readJson(request)) || {};
      return botAnswer(await askBot(db, { guildId: gid, userId, payload: { action, channel_id: String(id), amount: Math.min(Math.max(int(body.amount) || 1, 1), 10) } }));
    }
    return err('not_found', 404);
  }
  if (area === 'competitions') {
    if (method === 'GET' && !id) {
      const rows = await db.collection(COLL.competitions).find({ guild_id: toLong(gid) }).sort({ starts_at: -1 }).limit(50).toArray();
      return json({ competitions: rows.map((c) => ({ ...c, id: str(c._id), _id: undefined, guild_id: str(c.guild_id), starts_at: iso(c.starts_at), ends_at: iso(c.ends_at), created_at: iso(c.created_at), updated_at: iso(c.updated_at), completed_at: iso(c.completed_at) })) });
    }
    if (method === 'POST' && !id) {
      const body = await readJson(request);
      if (!body) return err('invalid_body', 400);
      return botAnswer(await askBot(db, { guildId: gid, userId, payload: { action: 'competition_save', competition: body } }));
    }
    if (method === 'PATCH' && id && /^[a-f0-9]{12}$/.test(id)) {
      const body = await readJson(request);
      if (!body) return err('invalid_body', 400);
      return botAnswer(await askBot(db, { guildId: gid, userId, payload: { action: 'competition_save', competition: body, competition_id: id } }));
    }
    if (method === 'DELETE' && id && /^[a-f0-9]{12}$/.test(id)) {
      return botAnswer(await askBot(db, { guildId: gid, userId, payload: { action: 'competition_cancel', competition_id: id } }));
    }
  }
  return err('not_found', 404);
}

// ---------------------------------------------------------------------------------------------- owner
const view = (doc) => ({ ...doc, id: str(doc._id), _id: undefined, created_at: iso(doc.created_at), updated_at: iso(doc.updated_at), starts_at: iso(doc.starts_at), ends_at: iso(doc.ends_at), retired_at: iso(doc.retired_at), completed_at: iso(doc.completed_at) });

async function ownerRoutes({ db, parts, method, request, userId, url }) {
  const write = method !== 'GET';
  if (!(await ownerAccess(db, userId, { write }))) return err('forbidden', 403);
  if (write && (await limited(db, `o:${userId}`, 60))) return err('rate_limited', 429);
  const [, area, id, extra] = parts;
  const send = async (payload, guildId = 0) => botAnswer(await askBot(db, { guildId, userId, payload }));

  if (area === 'overview' && !write) {
    const [games, active, paused, comps, seasons, players, agg] = await Promise.all([
      db.collection(COLL.games).countDocuments({}), db.collection(COLL.games).countDocuments({ status: 'active' }), db.collection(COLL.games).countDocuments({ status: 'paused' }),
      db.collection(COLL.competitions).countDocuments({ status: { $in: ['scheduled', 'active'] } }), db.collection(COLL.seasons).countDocuments({ status: { $in: ['scheduled', 'active'] } }),
      db.collection(COLL.players).countDocuments({ guild_id: 0 }),
      db.collection(COLL.games).aggregate([{ $group: { _id: null, valid: { $sum: '$stats.total_valid' }, errors: { $sum: '$stats.total_errors' }, best: { $max: '$state.highest_index' } } }]).toArray(),
    ]);
    return json({ games, active, paused, competitions: comps, seasons, players, total_valid: int(agg[0]?.valid), total_errors: int(agg[0]?.errors), highest: int(agg[0]?.best) });
  }
  if (area === 'config') {
    if (!write) { const doc = await db.collection(COLL.global).findOne({ _id: 'config' }); return json({ config: doc ? { ...doc, _id: undefined } : null }); }
    const body = await readJson(request);
    if (!body || method !== 'PATCH') return err('invalid_body', 400);
    return send({ action: 'owner_global', patch: body });
  }
  if (area === 'defs') {
    if (!write) {
      const kind = url.searchParams.get('kind');
      if (kind && !DEF_KINDS.includes(kind)) return err('invalid_kind', 400);
      const rows = await db.collection(COLL.defs).find(kind ? { kind } : {}).sort({ kind: 1, id: 1 }).limit(500).toArray();
      return json({ defs: rows.map(view) });
    }
    if (method === 'POST') {
      const body = await readJson(request);
      if (!body || !DEF_KINDS.includes(body.kind)) return err('invalid_body', 400);
      return send({ action: 'owner_def', def: body });
    }
    if (method === 'DELETE' && DEF_KINDS.includes(id) && ID.test(String(extra || ''))) return send({ action: 'owner_def_delete', kind: id, id: extra });
    return err('not_found', 404);
  }
  if (area === 'seasons') {
    if (!write) { const rows = await db.collection(COLL.seasons).find({}).sort({ starts_at: -1 }).limit(100).toArray(); return json({ seasons: rows.map(view) }); }
    if (method === 'POST' && !id) { const body = await readJson(request); return body ? send({ action: 'owner_season', season: body }) : err('invalid_body', 400); }
    if (method === 'PATCH' && /^[a-f0-9]{12}$/.test(String(id))) { const body = await readJson(request); return body ? send({ action: 'owner_season', season: body, season_id: id }) : err('invalid_body', 400); }
    if (method === 'POST' && /^[a-f0-9]{12}$/.test(String(id)) && ['pause', 'resume', 'archive'].includes(extra)) {
      return send({ action: 'owner_season_status', season_id: id, status: { pause: 'paused', resume: 'scheduled', archive: 'archived' }[extra] });
    }
    return err('not_found', 404);
  }
  if (area === 'competitions') {
    if (!write) { const rows = await db.collection(COLL.competitions).find({ guild_id: 0 }).sort({ starts_at: -1 }).limit(100).toArray(); return json({ competitions: rows.map(view) }); }
    if (method === 'POST' && !id) { const body = await readJson(request); return body ? send({ action: 'owner_competition', competition: body }) : err('invalid_body', 400); }
    if (method === 'PATCH' && /^[a-f0-9]{12}$/.test(String(id))) { const body = await readJson(request); return body ? send({ action: 'owner_competition', competition: body, competition_id: id }) : err('invalid_body', 400); }
    if (method === 'DELETE' && /^[a-f0-9]{12}$/.test(String(id))) return send({ action: 'owner_competition_cancel', competition_id: id });
    return err('not_found', 404);
  }
  if (area === 'games') {
    if (!write) {
      const status = url.searchParams.get('status');
      const rows = await db.collection(COLL.games).find(status ? { status } : {}).sort({ updated_at: -1 }).skip(pageSkip(url)).limit(PAGE).toArray();
      return json({ games: rows.map((d) => ({ ...gameView(d), guild_id: str(d.guild_id) })), page: PAGE });
    }
    if (method === 'POST' && SNOWFLAKE.test(String(id)) && ['pause', 'resume', 'archive', 'reset'].includes(extra)) {
      const doc = await db.collection(COLL.games).findOne({ _id: toLong(id) });
      if (!doc) return err('not_found', 404);
      return send({ action: extra, channel_id: String(id) }, doc.guild_id);
    }
    if (method === 'DELETE' && SNOWFLAKE.test(String(id)) && !extra) {
      const doc = await db.collection(COLL.games).findOne({ _id: toLong(id) });
      if (!doc) return err('not_found', 404);
      return send({ action: 'delete', channel_id: String(id) }, doc.guild_id);
    }
    return err('not_found', 404);
  }
  if (area === 'stats' && !write) {
    const since = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10).replace(/-/g, '');
    const rows = await db.collection(COLL.daily).aggregate([{ $match: { day: { $gte: since } } }, { $group: { _id: '$day', valid: { $sum: '$valid' }, errors: { $sum: '$errors' } } }, { $sort: { _id: 1 } }]).toArray();
    const modes = await db.collection(COLL.games).aggregate([{ $group: { _id: '$mode', games: { $sum: 1 }, valid: { $sum: '$stats.total_valid' } } }, { $sort: { games: -1 } }]).toArray();
    return json({ daily: rows.map((r) => ({ day: r._id, valid: int(r.valid), errors: int(r.errors) })), modes: modes.map((m) => ({ mode: m._id, games: int(m.games), valid: int(m.valid) })) });
  }
  if (area === 'audit' && !write) {
    const rows = await db.collection(COLL.audit).find({}).sort({ at: -1 }).skip(pageSkip(url)).limit(PAGE).toArray();
    return json({ rows: rows.map((r) => ({ at: iso(r.at), actor: str(r.actor), guild_id: str(r.guild_id), action: r.action, target: r.target, changes: r.changes || {}, result: r.result })), page: PAGE });
  }
  return err('not_found', 404);
}

export async function handle({ request, db, parts, method, url }) {
  if (method !== 'GET' && !trustedOrigin(request)) return err('forbidden_origin', 403);
  const [head] = parts;
  if (head === 'public') {
    if (method !== 'GET') return err('method_not_allowed', 405);
    return publicRoutes({ db, parts, request, url });
  }
  const me = await who(db);
  if (me.error) return me.error;
  const { session, userId } = me;
  if (head === 'owner') return ownerRoutes({ db, parts, method, request, userId, url });
  if (head === 'guilds') return guildRoutes({ db, session, parts, method, request, userId });
  return memberRoutes({ db, parts, url, userId });
}

export { MODES, BOARDS, PERIODS };

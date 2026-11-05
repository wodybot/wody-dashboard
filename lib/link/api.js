// Wody Link API (mounted at /api/link/*). Every route authenticates the Discord user and then asks Discord who OWNS each
// server involved; the ids inside a bridge document, never the ids in the request, decide which servers are checked.
//
//   GET    capabilities
//   GET    servers                         servers the user owns that have Wody
//   GET    servers/:guildId/channels       eligible text channels of one owned server
//   GET    bridges                         bridges touching a server the user owns
//   POST   bridges/validate                dry-run of a new bridge
//   POST   bridges                         create
//   GET    bridges/:id                     detail (+ 24h delivery summary)
//   PATCH  bridges/:id                     name / translation / anti-spam (owner of BOTH servers)
//   POST   bridges/:id/pause               owner of either server (stopping is always safe)
//   POST   bridges/:id/resume              owner of BOTH servers, re-validated by the bot
//   DELETE bridges/:id                     owner of either server
//   GET    bridges/:id/history             owner events, paginated
//   GET    bridges/:id/deliveries          delivery records (metadata only), paginated
import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getSession } from '@/lib/session';
import { trustedOrigin } from '@/lib/owner-access';
import { isAccountBlocked } from '@/lib/account-moderation';
import { toLong } from '@/lib/mongo';
import { requestBot } from '@/lib/bridge';
import { getGuildChannelsResult, getBotUser, getGuildMemberRaw } from '@/lib/discord';
import { fail } from '@/lib/modules/validate';
import {
  COLL, MODULE_KEY, MAX_BRIDGES_PER_OWNER, MAX_BRIDGES_PER_CHANNEL, HISTORY_PAGE, STATUSES, HISTORY_TYPES, DELIVERY_STATUSES,
  DEFAULT_ANTISPAM, DEFAULT_TRANSLATION, NAME_MAX, TRANSLATION_LANGUAGES, ANTISPAM_BOUNDS,
} from './constants';
import { cleanName, cleanTranslation, cleanAntispam, parseSide, pairKey, snow } from './config';
import { requireOwner, requireOwnerOfAll, liveGuild, isOwnerOf, ownedServers } from './owner';
import { channelPermissions, botCan, eligible } from './perms';

const TEXT_TYPES = [0, 5];

export function json(data, init = {}) {
  return NextResponse.json(data, { ...init, headers: { 'Cache-Control': 'no-store, private', ...(init.headers || {}) } });
}
export const err = (code, status = 400, extra = {}) => json({ error: code, ...extra }, { status });

async function readJson(request, max = 16 * 1024) {
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
      { _id: `link:${key}:${start}` },
      { $inc: { count: 1 }, $setOnInsert: { expires_at: new Date(start + windowMs * 2) } },
      { upsert: true, returnDocument: 'after' },
    );
    return (r?.count ?? r?.value?.count ?? 0) > max;
  } catch { return false; }
}

const str = (v) => (v === null || v === undefined ? null : String(v));
const iso = (d) => (d ? new Date(d).toISOString() : null);
const oid = (v) => (/^[a-f0-9]{24}$/i.test(String(v || '')) ? new ObjectId(String(v)) : null);
const ids = (doc) => [str(doc.a.guild_id), str(doc.b.guild_id)];

// ---------------------------------------------------------------------------------------------- views
function sideView(side, owned) {
  if (!owned) return { owned: false, guild_name: side.guild_name || null };            // another owner's channel stays private
  return { owned: true, guild_id: str(side.guild_id), guild_name: side.guild_name || null, channel_id: str(side.channel_id), channel_name: side.channel_name || null };
}

export function bridgeView(doc, ownsA, ownsB) {
  const manage = ownsA && ownsB;
  return {
    id: str(doc._id),
    name: doc.name,
    status: doc.status,
    status_reason: doc.status_reason || null,
    a: sideView(doc.a, ownsA),
    b: sideView(doc.b, ownsB),
    manage,                                     // edit / resume
    can_pause: ownsA || ownsB,
    can_delete: ownsA || ownsB,
    translation: manage ? { ...DEFAULT_TRANSLATION, ...(doc.translation || {}) } : null,
    antispam: manage ? { ...DEFAULT_ANTISPAM, ...(doc.antispam || {}) } : null,
    translation_enabled: Boolean(doc.translation?.enabled),
    created_at: iso(doc.created_at),
    updated_at: iso(doc.updated_at),
    last_activity_at: iso(doc.last_activity_at),
    last_error: doc.last_error || null,
  };
}

// ---------------------------------------------------------------------------------------------- shared steps
async function notifyReload(db, doc, userId) {
  const now = new Date();
  const rows = ids(doc).map((g) => ({
    kind: 'link_reload', guild_id: toLong(g), requested_by: toLong(userId), payload: { bridge_id: str(doc._id) }, status: 'pending', created_at: now,
  }));
  try { await db.collection('module_requests').insertMany(rows); } catch (e) { console.error('[link] reload request failed', e?.message); }
}

async function writeHistory(db, doc, type, meta = {}) {
  try {
    await db.collection(COLL.history).insertOne({
      bridge_id: str(doc._id), guild_ids: ids(doc).map(toLong), type, meta, count: 1, at: new Date(),
    });
  } catch (e) { console.error('[link] history failed', e?.message); }
}

async function enableModule(db, guildIds, userId) {
  const at = new Date();
  for (const g of guildIds) {
    await db.collection('guild_settings').updateOne(
      { guild_id: toLong(g) }, { $set: { [`module_states.${MODULE_KEY}`]: true, updated_at: at } }, { upsert: true });
  }
  try {
    await db.collection('settings_audit').insertMany(guildIds.map((g) => ({
      guild_id: toLong(g), actor_id: toLong(userId), module: MODULE_KEY, action: 'module.enabled', via: 'wody_link', created_at: at,
    })));
  } catch { /* the audit trail is best effort */ }
}

async function botValidate(session, a, b) {
  const r = await requestBot({ kind: 'link_validate', guildId: a.guild_id, userId: session.user.id, payload: { a, b } });
  if (r.error) return { error: r.error === 'rate_limited' ? err('rate_limited', 429) : err(r.error === 'bot_unreachable' ? 'bot_unreachable' : 'bot_error', 503) };
  return { result: r.result };
}

async function channelChecks(guildId, channelId, side) {
  const { data, ok } = await getGuildChannelsResult(guildId);
  if (!ok) return { unavailable: true, checks: [] };
  const ch = (data || []).find((c) => String(c.id) === String(channelId));
  const checks = [{ side, code: 'channel_exists', ok: Boolean(ch), level: 'error' }];
  if (ch) checks.push({ side, code: 'channel_type', ok: TEXT_TYPES.includes(Number(ch.type)), level: 'error' });
  return { checks, channel: ch || null };
}

/** Live ownership of the two servers of an existing bridge, from the bridge document (never from the request). */
async function ownershipOf(session, doc, db) {
  const [ga, gb] = ids(doc);
  const uid = session.user.id;
  const [a, b] = await Promise.all([liveGuild(ga), liveGuild(gb)]);
  if ((!a.ok && a.reason === 'unavailable') || (!b.ok && b.reason === 'unavailable')) return { unavailable: true };
  const banned = db ? await db.collection('guild_bans').find({ guild_id: { $in: [ga, gb] }, active: true }).limit(1).toArray() : [];
  const ownsA = a.ok && isOwnerOf(a.guild, uid) && !banned.some((x) => x.guild_id === ga);
  const ownsB = b.ok && isOwnerOf(b.guild, uid) && !banned.some((x) => x.guild_id === gb);
  return { ownsA, ownsB, live: { a: a.ok ? a.guild : null, b: b.ok ? b.guild : null } };
}

async function loadBridge(db, session, id) {
  const _id = oid(id);
  if (!_id) return { res: err('not_found', 404) };
  const doc = await db.collection(COLL.bridges).findOne({ _id });
  if (!doc) return { res: err('not_found', 404) };
  const own = await ownershipOf(session, doc, db);
  if (own.unavailable) return { res: err('discord_unavailable', 503) };
  if (!own.ownsA && !own.ownsB) return { res: err('not_found', 404) };                       // never confirm that someone else's bridge exists
  return { doc, own };
}

// ---------------------------------------------------------------------------------------------- routes
export async function handle({ request, db, parts, method, url }) {
  const [head, a, b, c] = parts;
  const mutating = method !== 'GET' && method !== 'HEAD';
  if (mutating && !trustedOrigin(request)) return err('forbidden_origin', 403);

  const session = (await getSession().catch(() => null));
  if (!session?.user?.id) return err('unauthenticated', 401);
  const uid = String(session.user.id);
  if (await isAccountBlocked(db, uid)) return err('account_blocked', 403);
  if (await limited(db, `${mutating ? 'w' : 'r'}:${uid}`, mutating ? 40 : 240)) return err('rate_limited', 429);

  // ---- capabilities
  if (method === 'GET' && head === 'capabilities' && !a) {
    const doc = await db.collection(COLL.runtime).findOne({ _id: 'capabilities' });
    return json({
      translation: Boolean(doc?.translation),
      limits: { bridges_per_owner: MAX_BRIDGES_PER_OWNER, bridges_per_channel: MAX_BRIDGES_PER_CHANNEL, name_max: NAME_MAX },
      languages: TRANSLATION_LANGUAGES, antispam_bounds: ANTISPAM_BOUNDS, defaults: { antispam: DEFAULT_ANTISPAM, translation: DEFAULT_TRANSLATION },
    });
  }

  // ---- servers the user owns (offer-only list)
  if (method === 'GET' && head === 'servers' && !a) {
    const own = await ownedServers(session);
    if (own.unavailable) return err('discord_unavailable', 503);
    const counts = new Map();
    if (own.withBot.length) {
      const longs = own.withBot.map((g) => toLong(g.id));
      const rows = await db.collection(COLL.bridges).find({ $or: [{ 'a.guild_id': { $in: longs } }, { 'b.guild_id': { $in: longs } }] }, { projection: { a: 1, b: 1 } }).limit(500).toArray();
      for (const r of rows) for (const g of ids(r)) counts.set(g, (counts.get(g) || 0) + 1);
    }
    return json({ servers: own.withBot.map((g) => ({ ...g, bridges: counts.get(g.id) || 0 })) });
  }

  // ---- eligible channels of one owned server
  if (method === 'GET' && head === 'servers' && snow(a) && b === 'channels' && !c) {
    const gate = await requireOwner(session, a, { db });
    if (!gate.ok) return err(gate.code, gate.status);
    const { data, ok } = await getGuildChannelsResult(a);
    if (!ok) return err('discord_unavailable', 503);
    const bot = await getBotUser().catch(() => null);
    const member = bot ? await getGuildMemberRaw(a, bot.id) : null;
    const guild = gate.guild;
    const channels = (data || [])
      .filter((ch) => TEXT_TYPES.includes(Number(ch.type)))
      .sort((x, y) => (x.position ?? 0) - (y.position ?? 0))
      .map((ch) => {
        const can = bot && member ? botCan(channelPermissions({ guild, botId: bot.id, botRoleIds: member.roles || [], channel: ch })) : null;
        return { id: String(ch.id), name: String(ch.name || '').slice(0, 100), parent_id: ch.parent_id ? String(ch.parent_id) : null, can, eligible: can ? eligible(can) : null };
      });
    return json({ guild: { id: String(a), name: String(guild.name || '').slice(0, 100) }, channels });
  }

  if (head !== 'bridges') return err('not_found', 404);

  // ---- list
  if (method === 'GET' && !a) {
    const own = await ownedServers(session);
    if (own.unavailable) return err('discord_unavailable', 503);
    if (!own.owned.length) return json({ bridges: [], summary: { total: 0, active: 0, paused: 0, attention: 0 } });
    const longs = own.owned.map(toLong);
    const docs = await db.collection(COLL.bridges)
      .find({ $or: [{ 'a.guild_id': { $in: longs } }, { 'b.guild_id': { $in: longs } }] }).sort({ created_at: -1 }).limit(100).toArray();
    const mine = new Set(own.owned);
    const views = docs.map((d) => bridgeView(d, mine.has(str(d.a.guild_id)), mine.has(str(d.b.guild_id))));
    return json({
      bridges: views,
      summary: {
        total: views.length,
        active: views.filter((v) => v.status === 'active').length,
        paused: views.filter((v) => v.status === 'paused').length,
        attention: views.filter((v) => v.status === 'suspended' || v.status === 'degraded').length,
      },
    });
  }

  // ---- dry run / create
  if (method === 'POST' && a === 'validate' && !b) return createOrValidate({ request, db, session, dryRun: true });
  if (method === 'POST' && !a) return createOrValidate({ request, db, session, dryRun: false });

  // ---- one bridge
  if (!oid(a)) return err('not_found', 404);

  if (method === 'GET' && !b) {
    const { doc, own, res } = await loadBridge(db, session, a);
    if (res) return res;
    const since = new Date(Date.now() - 24 * 3600 * 1000);
    const grouped = await db.collection(COLL.deliveries).aggregate([
      { $match: { bridge_id: str(doc._id), created_at: { $gte: since } } }, { $group: { _id: '$status', n: { $sum: 1 } } },
    ]).toArray();
    const delivery = Object.fromEntries(DELIVERY_STATUSES.map((s) => [s, 0]));
    for (const g of grouped) if (g._id in delivery) delivery[g._id] = g.n;
    const view = bridgeView(doc, own.ownsA, own.ownsB);
    // Fresh channel names + whether the channels still exist, for the sides this user owns (cached lists, no polling).
    const refresh = { $set: {} };
    for (const [key, owns, side] of [['a', own.ownsA, doc.a], ['b', own.ownsB, doc.b]]) {
      if (!owns) continue;
      const { data, ok } = await getGuildChannelsResult(str(side.guild_id));
      if (!ok) continue;
      const ch = (data || []).find((x) => String(x.id) === str(side.channel_id));
      view[key].channel_missing = !ch;
      if (ch && ch.name !== side.channel_name) { view[key].channel_name = ch.name; refresh.$set[`${key}.channel_name`] = ch.name; }
      const gname = own.live[key]?.name;
      if (gname && gname !== side.guild_name) { view[key].guild_name = gname; refresh.$set[`${key}.guild_name`] = gname; }
    }
    if (Object.keys(refresh.$set).length) db.collection(COLL.bridges).updateOne({ _id: doc._id }, refresh).catch(() => {});
    const modules = {};
    for (const [key, owns, side] of [['a', own.ownsA, doc.a], ['b', own.ownsB, doc.b]]) {
      if (!owns) continue;
      const s = await db.collection('guild_settings').findOne({ guild_id: side.guild_id }, { projection: { [`module_states.${MODULE_KEY}`]: 1 } });
      modules[key] = s?.module_states?.[MODULE_KEY] === true;
    }
    return json({ bridge: view, delivery_24h: delivery, modules });
  }

  if (method === 'PATCH' && !b) {
    const { doc, own, res } = await loadBridge(db, session, a);
    if (res) return res;
    if (!(own.ownsA && own.ownsB)) return err('ownership_required', 403);
    const body = await readJson(request);
    if (!body) return err('invalid_body', 400);
    const errors = [];
    const set = {};
    if (body.name !== undefined) set.name = cleanName(errors, body.name, doc.name);
    if (body.translation !== undefined) set.translation = cleanTranslation(errors, body.translation, doc.translation);
    if (body.antispam !== undefined) set.antispam = cleanAntispam(errors, body.antispam, doc.antispam);
    if (errors.length) return json({ error: 'validation_failed', errors }, { status: 400 });
    if (!Object.keys(set).length) return err('nothing_to_update', 400);
    set.updated_at = new Date();
    await db.collection(COLL.bridges).updateOne({ _id: doc._id }, { $set: set });
    const fresh = await db.collection(COLL.bridges).findOne({ _id: doc._id });
    await writeHistory(db, fresh, 'modified', { changed: Object.keys(set).filter((k) => k !== 'updated_at') });
    await notifyReload(db, fresh, uid);
    return json({ bridge: bridgeView(fresh, true, true) });
  }

  if (method === 'POST' && b === 'pause' && !c) {
    const { doc, own, res } = await loadBridge(db, session, a);
    if (res) return res;
    if (doc.status === 'paused') return json({ bridge: bridgeView(doc, own.ownsA, own.ownsB) });
    await db.collection(COLL.bridges).updateOne({ _id: doc._id }, { $set: { status: 'paused', status_reason: null, updated_at: new Date() } });
    const fresh = await db.collection(COLL.bridges).findOne({ _id: doc._id });
    await writeHistory(db, fresh, 'paused', {});
    await notifyReload(db, fresh, uid);
    return json({ bridge: bridgeView(fresh, own.ownsA, own.ownsB) });
  }

  if (method === 'POST' && b === 'resume' && !c) {
    const { doc, own, res } = await loadBridge(db, session, a);
    if (res) return res;
    if (!(own.ownsA && own.ownsB)) return err('ownership_required', 403);
    const sideA = { guild_id: str(doc.a.guild_id), channel_id: str(doc.a.channel_id) };
    const sideB = { guild_id: str(doc.b.guild_id), channel_id: str(doc.b.channel_id) };
    const v = await botValidate(session, sideA, sideB);
    if (v.error) return v.error;
    if (!v.result?.ok) return json({ error: 'validation_failed', checks: v.result?.checks || [] }, { status: 422 });
    await db.collection(COLL.bridges).updateOne({ _id: doc._id }, { $set: { status: 'active', status_reason: null, updated_at: new Date() } });
    await enableModule(db, ids(doc), uid);
    const fresh = await db.collection(COLL.bridges).findOne({ _id: doc._id });
    await writeHistory(db, fresh, 'resumed', {});
    await notifyReload(db, fresh, uid);
    return json({ bridge: bridgeView(fresh, true, true) });
  }

  if (method === 'DELETE' && !b) {
    const { doc, res } = await loadBridge(db, session, a);
    if (res) return res;
    await db.collection(COLL.bridges).deleteOne({ _id: doc._id });
    await db.collection(COLL.deliveries).deleteMany({ bridge_id: str(doc._id) });          // temporary relay mapping goes with it
    await writeHistory(db, doc, 'deleted', {});                                           // the audit row stays until its TTL
    await notifyReload(db, doc, uid);
    return json({ ok: true });
  }

  if (method === 'GET' && (b === 'history' || b === 'deliveries') && !c) {
    const { doc, own, res } = await loadBridge(db, session, a);
    if (res) return res;
    const limit = Math.min(50, Math.max(1, Number.parseInt(url.searchParams.get('limit'), 10) || HISTORY_PAGE));
    const before = oid(url.searchParams.get('before'));
    const filter = { bridge_id: str(doc._id), ...(before ? { _id: { $lt: before } } : {}) };
    if (b === 'history') {
      const type = url.searchParams.get('type');
      if (type) { if (!HISTORY_TYPES.includes(type)) return err('invalid_filter', 400); filter.type = type; }
      const rows = await db.collection(COLL.history).find(filter).sort({ _id: -1 }).limit(limit + 1).toArray();
      const page = rows.slice(0, limit);
      const full = own.ownsA && own.ownsB;
      return json({
        items: page.map((r) => ({
          id: str(r._id), type: r.type, count: r.count || 1, at: iso(r.at),
          meta: full ? r.meta || {} : Object.fromEntries(Object.entries(r.meta || {}).filter(([k]) => k !== 'user_id')),
        })),
        next: rows.length > limit ? str(page[page.length - 1]._id) : null,
      });
    }
    const status = url.searchParams.get('status');
    if (status) { if (!DELIVERY_STATUSES.includes(status)) return err('invalid_filter', 400); filter.status = status; }
    const rows = await db.collection(COLL.deliveries).find(filter, {
      projection: { direction: 1, status: 1, last_error: 1, attempts: 1, created_at: 1, completed_at: 1 },
    }).sort({ _id: -1 }).limit(limit + 1).toArray();
    const page = rows.slice(0, limit);
    return json({
      items: page.map((r) => ({ id: str(r._id), direction: r.direction, status: r.status, error: r.last_error || null, attempts: r.attempts || 0, at: iso(r.created_at), completed_at: iso(r.completed_at) })),
      next: rows.length > limit ? str(page[page.length - 1]._id) : null,
    });
  }

  return err('not_found', 404);
}

// ---------------------------------------------------------------------------------------------- create / validate
async function createOrValidate({ request, db, session, dryRun }) {
  const uid = String(session.user.id);
  if (await limited(db, `${dryRun ? 'val' : 'create'}:${uid}`, dryRun ? 20 : 10)) return err('rate_limited', 429);
  const body = await readJson(request);
  if (!body) return err('invalid_body', 400);

  const errors = [];
  const A = parseSide(errors, 'a', body.a);
  const B = parseSide(errors, 'b', body.b);
  if (!errors.length && A.guild_id === B.guild_id) fail(errors, 'b.guild_id', 'same_server');
  if (!errors.length && A.channel_id === B.channel_id) fail(errors, 'b.channel_id', 'same_channel');
  const translation = cleanTranslation(errors, body.translation, DEFAULT_TRANSLATION);
  const antispam = cleanAntispam(errors, body.antispam, DEFAULT_ANTISPAM);
  if (errors.length) return json({ error: 'validation_failed', errors }, { status: 400 });

  // The ids came from the browser, so nothing is trusted until Discord confirms this user owns BOTH servers right now.
  const gate = await requireOwnerOfAll(session, [A.guild_id, B.guild_id], { db });
  if (!gate.ok) return err(gate.code, gate.status, { guild_id: gate.guild_id });

  const [ca, cb] = await Promise.all([channelChecks(A.guild_id, A.channel_id, 'a'), channelChecks(B.guild_id, B.channel_id, 'b')]);
  if (ca.unavailable || cb.unavailable) return err('discord_unavailable', 503);
  const local = [...ca.checks, ...cb.checks];
  if (local.some((x) => !x.ok)) return json({ ok: false, checks: local }, { status: 422 });

  const v = await botValidate(session, A, B);
  if (v.error) return v.error;
  const checks = v.result?.checks || [];
  if (!v.result?.ok) return json({ ok: false, checks }, { status: 422 });

  const pk = pairKey(A.channel_id, B.channel_id);
  const col = db.collection(COLL.bridges);
  const owned = await col.countDocuments({ owner_id: toLong(uid) });
  if (owned >= MAX_BRIDGES_PER_OWNER) return json({ ok: false, error: 'limit_reached', limit: MAX_BRIDGES_PER_OWNER, checks }, { status: 409 });
  for (const ch of [A.channel_id, B.channel_id]) {
    const n = await col.countDocuments({ $or: [{ 'a.channel_id': toLong(ch) }, { 'b.channel_id': toLong(ch) }] });
    if (n >= MAX_BRIDGES_PER_CHANNEL) return json({ ok: false, error: 'channel_limit_reached', limit: MAX_BRIDGES_PER_CHANNEL, checks }, { status: 409 });
  }
  if (await col.findOne({ pair_key: pk }, { projection: { _id: 1 } })) return json({ ok: false, error: 'duplicate_bridge', checks }, { status: 409 });

  if (dryRun) return json({ ok: true, checks });

  const nameErrors = [];
  const fallbackName = `${gate.guilds[A.guild_id].name} / ${gate.guilds[B.guild_id].name}`.slice(0, NAME_MAX);
  const name = body.name === undefined || body.name === '' ? fallbackName : cleanName(nameErrors, body.name, fallbackName);
  if (nameErrors.length) return json({ error: 'validation_failed', errors: nameErrors }, { status: 400 });

  const now = new Date();
  const doc = {
    name,
    owner_id: toLong(uid),
    a: { guild_id: toLong(A.guild_id), channel_id: toLong(A.channel_id), guild_name: gate.guilds[A.guild_id].name, channel_name: ca.channel?.name || null },
    b: { guild_id: toLong(B.guild_id), channel_id: toLong(B.channel_id), guild_name: gate.guilds[B.guild_id].name, channel_name: cb.channel?.name || null },
    pair_key: pk,
    status: 'active',
    status_reason: null,
    translation,
    antispam,
    created_by: toLong(uid),
    created_at: now,
    updated_at: now,
    last_activity_at: null,
  };
  try {
    const res = await col.insertOne(doc);
    doc._id = res.insertedId;
  } catch (e) {
    if (e?.code === 11000) return json({ ok: false, error: 'duplicate_bridge', checks }, { status: 409 });
    throw e;
  }
  await enableModule(db, [A.guild_id, B.guild_id], uid);
  await writeHistory(db, doc, 'created', { translation: translation.enabled });
  await notifyReload(db, doc, uid);
  return json({ ok: true, checks, bridge: bridgeView(doc, true, true) }, { status: 201 });
}

export { STATUSES };

// WODY Collab: categories made by a server owner. A category belongs to ONE server and can only be used by a
// request that is made for that server (origin_guild_id), so servers never see or use each other's categories.
//   access public   any member of the server (the person must be in the server with the bot, as for every server request)
//   access roles    only members who have one of the chosen Discord roles (checked live at the moment of posting)
//   access private  nobody but the server owner and its administrators
// The server owner and administrators can always post in every category of their server.
import crypto from 'crypto';
import { M } from './db.js';
import { SERVER_CAT_ACCESS, SERVER_CAT_LIMITS, SERVER_CAT_PREFIX, isServerCat } from './constants.js';
import { cleanLine, } from './validation.js';
import { CollabError } from './lifecycle.js';

const E = (code, status, extra) => new CollabError(code, status, extra);
const URL_LIKE = /(https?:\/\/|www\.|discord\.gg|\.[a-z]{2,}\/)/i;
const snow = (v) => (/^\d{15,25}$/.test(String(v || '')) ? String(v) : null);

export const cleanCategoryName = (v) => cleanLine(v, SERVER_CAT_LIMITS.name.max).replace(/[<>@`*_~|\\[\]]/g, '').replace(/\s+/g, ' ').trim();

const view = (c) => ({ id: String(c._id), slug: c.slug, name: c.name, access: c.access, roles: c.roles || [], enabled: c.enabled !== false, channel_id: c.channel_id || null, channel_name: c.channel_name || null, also_default: Boolean(c.also_default), created_at: c.created_at ? new Date(c.created_at).toISOString() : null });

export async function listGuildCategories(db, guildId, { includeDisabled = true } = {}) {
  const q = { guild_id: String(guildId) };
  if (!includeDisabled) q.enabled = { $ne: false };
  const rows = await db.collection(M.serverCategories).find(q).sort({ created_at: 1 }).limit(SERVER_CAT_LIMITS.perServer + 5).toArray();
  return rows;
}
export const adminView = view;

// Slugs a request made for `guildId` may use (enabled categories of that server only).
export async function serverCategorySlugs(db, guildId) {
  if (!snow(guildId)) return new Set();
  return new Set((await listGuildCategories(db, guildId, { includeDisabled: false })).map((c) => c.slug));
}

async function validRoleIds(guildId, ids, getRoles) {
  const out = [];
  const wanted = [...new Set((Array.isArray(ids) ? ids : []).map(snow).filter(Boolean))].slice(0, SERVER_CAT_LIMITS.roles);
  if (!wanted.length) return out;
  const r = await getRoles(guildId);
  if (!r.ok) throw E('discord_unavailable', 503);
  const known = new Set((r.data || []).map((x) => String(x.id)));
  for (const id of wanted) if (id !== String(guildId) && known.has(id)) out.push(id);   // never @everyone, never a role of another server
  return out;
}

// The optional announcement channel of a category: a text channel of THIS server, checked with Discord.
async function channelFields(guildId, body, getChannels, out) {
  if (!('channel_id' in body) && !('also_default' in body)) return;
  if ('channel_id' in body) {
    const id = body.channel_id ? snow(body.channel_id) : null;
    if (body.channel_id && !id) throw E('bad_channel', 400);
    if (id) {
      const r = await getChannels(guildId);
      if (!r.ok) throw E('discord_unavailable', 503);
      const found = (r.data || []).find((c) => String(c.id) === id && (c.type === 0 || c.type === 5));
      if (!found) throw E('bad_channel', 400);
      out.channel_name = String(found.name || '').slice(0, 100);
    } else out.channel_name = null;
    out.channel_id = id;
  }
  if ('also_default' in body) out.also_default = Boolean(body.also_default);
}

function checkFields(body, errors, { partial = false } = {}) {
  const out = {};
  if (!partial || 'name' in body) {
    const name = cleanCategoryName(body.name);
    if (name.length < SERVER_CAT_LIMITS.name.min || name.length > SERVER_CAT_LIMITS.name.max) errors.push({ field: 'name', code: 'length', params: SERVER_CAT_LIMITS.name });
    else if (URL_LIKE.test(name)) errors.push({ field: 'name', code: 'no_links' });
    else out.name = name;
  }
  if (!partial || 'access' in body) {
    if (!SERVER_CAT_ACCESS.includes(body.access)) errors.push({ field: 'access', code: 'invalid' }); else out.access = body.access;
  }
  if ('enabled' in body) out.enabled = Boolean(body.enabled);
  return out;
}

export async function createGuildCategory(db, guildId, actorId, body, { getRoles, getChannels }) {
  const errors = [];
  const f = checkFields(body, errors);
  const access = f.access || 'public';
  let roles = [];
  if (access === 'roles') {
    roles = await validRoleIds(guildId, body.roles, getRoles);
    if (!roles.length) errors.push({ field: 'roles', code: 'required' });
  }
  if (errors.length) throw E('validation_failed', 400, { errors });
  const chan = {}; await channelFields(guildId, body, getChannels, chan);
  const existing = await listGuildCategories(db, guildId);
  if (existing.length >= SERVER_CAT_LIMITS.perServer) throw E('too_many_categories', 429, { max: SERVER_CAT_LIMITS.perServer });
  if (existing.some((c) => c.name.toLowerCase() === f.name.toLowerCase())) throw E('validation_failed', 400, { errors: [{ field: 'name', code: 'duplicate' }] });
  const doc = { guild_id: String(guildId), slug: `${SERVER_CAT_PREFIX}${crypto.randomBytes(6).toString('hex')}`, name: f.name, access, roles, enabled: true, channel_id: chan.channel_id || null, channel_name: chan.channel_name || null, also_default: Boolean(chan.channel_id && chan.also_default), created_by: String(actorId), created_at: new Date(), updated_at: new Date() };
  const r = await db.collection(M.serverCategories).insertOne(doc);
  return { ...doc, _id: r.insertedId };
}

export async function updateGuildCategory(db, guildId, catId, actorId, body, { getRoles, getChannels, oid }) {
  const _id = oid(catId); if (!_id) throw E('not_found', 404);
  // the id must belong to THIS server, whatever was sent
  const cur = await db.collection(M.serverCategories).findOne({ _id, guild_id: String(guildId) });
  if (!cur) throw E('not_found', 404);
  const errors = [];
  const f = checkFields(body, errors, { partial: true });
  const access = f.access || cur.access;
  const set = { ...f, updated_at: new Date() };
  if (access === 'roles') {
    set.roles = 'roles' in body ? await validRoleIds(guildId, body.roles, getRoles) : cur.roles || [];
    if (!set.roles.length) errors.push({ field: 'roles', code: 'required' });
  } else set.roles = [];
  if (f.name) {
    const others = (await listGuildCategories(db, guildId)).filter((c) => String(c._id) !== String(_id));
    if (others.some((c) => c.name.toLowerCase() === f.name.toLowerCase())) errors.push({ field: 'name', code: 'duplicate' });
  }
  if (errors.length) throw E('validation_failed', 400, { errors });
  await channelFields(guildId, body, getChannels, set);
  if (set.channel_id === null || (!('channel_id' in set) && !cur.channel_id)) set.also_default = false;
  await db.collection(M.serverCategories).updateOne({ _id }, { $set: set });
  // posts keep showing the right name
  if (set.name && set.name !== cur.name) await db.collection(M.requests).updateMany({ category: cur.slug }, { $set: { 'card.category_name': set.name } });
  return { ...cur, ...set };
}

// Deleting a category never deletes anybody's post: those posts move to "Other Services".
export async function deleteGuildCategory(db, guildId, catId, { oid }) {
  const _id = oid(catId); if (!_id) throw E('not_found', 404);
  const cur = await db.collection(M.serverCategories).findOne({ _id, guild_id: String(guildId) });
  if (!cur) throw E('not_found', 404);
  await db.collection(M.requests).updateMany({ category: cur.slug }, {
    $set: { category: 'other_services', 'card.category': 'other_services', 'content.category': 'other_services', 'live.category': 'other_services', server_cat: false },
    $unset: { 'card.category_name': '' },
  });
  await db.collection(M.serverCategories).deleteOne({ _id });
  return { moved: true };
}

// Can this person post in this category right now? `staff` = owner or administrator of the server.
export async function canPostInCategory(cat, { userId, staff, getMember }) {
  if (!cat || cat.enabled === false) return { ok: false, reason: 'invalid_category' };
  if (staff) return { ok: true };
  if (cat.access === 'public') return { ok: true };
  if (cat.access === 'private') return { ok: false, reason: 'category_private' };
  const m = await getMember(cat.guild_id, userId);
  if (m === undefined) return { ok: false, reason: 'discord_unavailable' };
  const have = new Set((m?.roles || []).map(String));
  return (cat.roles || []).some((r) => have.has(String(r))) ? { ok: true } : { ok: false, reason: 'category_roles' };
}

// The checks used when a request is saved and submitted. Throws a CollabError. `ctx` carries the live lookups.
export async function assertCategoryAccess(db, content, { userId, isStaffOfGuild, getMember }) {
  const slug = content?.category;
  if (!isServerCat(slug)) return null;
  const cat = await db.collection(M.serverCategories).findOne({ slug });
  // a server category only works for a request made for that very server
  if (!cat || cat.enabled === false || !content.origin_guild_id || cat.guild_id !== String(content.origin_guild_id)) throw E('validation_failed', 400, { errors: [{ field: 'category', code: 'invalid_category' }] });
  const staff = await isStaffOfGuild(cat.guild_id);
  const r = await canPostInCategory(cat, { userId, staff, getMember });
  if (!r.ok) throw E(r.reason === 'discord_unavailable' ? 'discord_unavailable' : 'category_not_allowed', r.reason === 'discord_unavailable' ? 503 : 403, { reason: r.reason });
  return cat;
}

export { isServerCat };

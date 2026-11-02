// Owner API: a Discord server's own listing. Every route resolves the caller's access
// on the server (Discord permissions + listing managers) before doing anything.
import { toLong } from '@/lib/mongo';
import { getBotGuild, getGuildRoles, getInvite, getDiscordUserById, getGuildMemberRaw, snowflakeDate } from '@/lib/discord';
import { C, getCatalog, catalogSets, getSettings, currentPrefix } from './db.js';
import { json, err, validation, readJson, limited, sessionUser, fromError, resolveAccess, can } from './api-util.js';
import {
  CommunityError, createListing, updateContent, submitListing, isLocked, deleteListing,
} from './lifecycle.js';
import { sanitizeContent, completion } from './validation.js';
import {
  THEME_PRESETS, SECTION_KEYS, LOCKED_SECTIONS, SERVER_TYPES, LANGUAGES, SOCIAL_PLATFORMS, LIMITS, MANAGER_ROLES, MANAGER_PERMISSIONS,
  ROLE_PRESETS, CARD_STYLES, BUTTON_STYLES, IMAGE_RULES,
} from './constants.js';
import { validateImage, storeImage, pruneImages, loadImage } from './images.js';
import { listingAnalytics } from './analytics.js';

const GID = /^\d{15,25}$/;

function guildStats(guild) {
  return {
    member_count: guild.approximate_member_count ?? null, online_count: guild.approximate_presence_count ?? null,
    boosts: guild.premium_subscription_count ?? null, tier: guild.premium_tier ?? null, icon_hash: guild.icon || null,
    created_at: snowflakeDate(guild.id)?.toISOString() || null, fetched_at: new Date().toISOString(), voice_count: null, growth_7d: 0,
  };
}

async function checkInvite(code, gid) {
  if (!code) return { status: 'none' };
  let inv;
  try { inv = await getInvite(code); } catch { return { status: 'unreachable' }; }
  if (!inv) return { status: 'not_found' };
  if (String(inv.guild?.id) !== String(gid)) return { status: 'wrong_server' };
  if (inv.expires_at) return { status: 'expires', expires_at: inv.expires_at };
  return { status: 'valid', channel: inv.channel?.name || null };
}

export function ownerView(listing, access, { settings, catalog, timeline = [], versions = [], invite = null }) {
  const c = listing.content;
  const done = completion(c, settings);
  const pendingReview = isLocked(listing);
  return {
    status: listing.status,
    update_state: listing.update_state || null,
    locked: pendingReview,
    slug: listing.slug,
    url_prefix: currentPrefix(),
    can_delete: access.role === 'owner',
    content: c,
    live_slug: listing.live ? listing.slug : null,
    version: listing.version,
    submitted_at: listing.submitted_at,
    updated_at: listing.updated_at,
    published_at: listing.published_at,
    last_review: listing.last_review ? { type: listing.last_review.type, message: listing.last_review.message, fields: listing.last_review.fields, reason: listing.last_review.reason, at: listing.last_review.at } : null,
    stats: listing.stats || null,
    unavailable: Boolean(listing.unavailable),
    invite_status: listing.invite_status || 'unknown',
    invite,
    badges: listing.badges || [],
    counters: { favorites: listing.counters?.favorites || 0, reviews: listing.counters?.reviews || 0 },
    completion: done,
    timeline: timeline.map((t) => ({ type: t.type, at: t.at, kind: t.actor_kind, reason: t.reason, message: t.message, version: t.version, meta: t.meta })),
    versions: versions.map((v) => ({ version: v.version, at: v.at, kind: v.kind, changes: v.changes })),
    role: access.role,
    perms: [...access.perms],
  };
}

async function loadState(db, access, extra = {}) {
  const listing = access.listing || await db.collection(C.listings).findOne({ guild_id: toLong(access.guildId) });
  const [settings, catalog, timeline, versions] = await Promise.all([
    getSettings(db), getCatalog(db),
    db.collection(C.timeline).find({ listing_id: listing._id, owner_visible: true }).sort({ at: -1 }).limit(100).toArray(),
    db.collection(C.versions).find({ listing_id: listing._id }).sort({ version: -1 }).limit(30).toArray(),
  ]);
  return ownerView(listing, access, { settings, catalog, timeline, versions, ...extra });
}

function options(catalog, settings) {
  return {
    categories: catalog.categories, tags: catalog.tags, features: catalog.features, badges: catalog.badges,
    presets: THEME_PRESETS, sections: SECTION_KEYS, locked_sections: LOCKED_SECTIONS, server_types: SERVER_TYPES, languages: LANGUAGES,
    socials: Object.keys(SOCIAL_PLATFORMS), card_styles: CARD_STYLES, button_styles: BUTTON_STYLES, limits: LIMITS, image_rules: IMAGE_RULES,
    manager_roles: MANAGER_ROLES, manager_permissions: MANAGER_PERMISSIONS, role_presets: ROLE_PRESETS,
    settings: { require_invite: settings.require_invite, require_banner: settings.require_banner, reviews_enabled: settings.reviews_enabled, min_members: settings.min_members },
  };
}

export async function handleOwner({ request, db, parts, method, url }) {
  if (parts[0] !== 'owner') return null;
  const s = await sessionUser();
  if (!s) return err('unauthenticated', 401);
  const uid = String(s.user.id);
  if (await limited(db, `owner:${uid}`, 240, 60)) return err('rate_limited', 429);

  if (parts[1] === 'hub' && method === 'GET') {
    const { getUserGuilds, canManage } = await import('@/lib/discord');
    let guilds = [];
    try { guilds = await getUserGuilds(s.accessToken); } catch { return err('temporarily_unavailable', 503); }
    const manageable = guilds.filter((g) => canManage(g.permissions, g.owner));
    const mgrRows = await db.collection(C.managers).find({ user_id: toLong(uid) }).toArray();
    const byManagerListing = mgrRows.length ? await db.collection(C.listings).find({ _id: { $in: mgrRows.map((m) => m.listing_id) } }).toArray() : [];
    const byGuild = manageable.length ? await db.collection(C.listings).find({ guild_id: { $in: manageable.map((g) => toLong(g.id)) } }).toArray() : [];
    const seen = new Set(); const items = [];
    for (const g of manageable) {
      const l = byGuild.find((x) => String(x.guild_id) === String(g.id));
      seen.add(String(g.id));
      items.push({ guild_id: String(g.id), name: g.name, icon: g.icon, owner: Boolean(g.owner), status: l?.status || null, has_listing: Boolean(l) });
    }
    for (const l of byManagerListing) if (!seen.has(String(l.guild_id))) items.push({ guild_id: String(l.guild_id), name: l.content?.name || l.slug, icon: l.stats?.icon_hash ? null : null, owner: false, status: l.status, has_listing: true, as_manager: true });
    return json({ items });
  }

  if (parts[1] === 'notifications') {
    if (method === 'GET') {
      const rows = await db.collection(C.notifications).find({ to: uid }).sort({ created_at: -1 }).limit(40).toArray();
      return json({ items: rows.map((n) => ({ id: String(n._id), type: n.type, slug: n.slug, name: n.name, params: n.params || {}, at: n.created_at, read: n.read })), unread: rows.filter((n) => !n.read).length });
    }
    if (method === 'POST') { await db.collection(C.notifications).updateMany({ to: uid, read: false }, { $set: { read: true } }); return json({ ok: true }); }
  }

  const gid = parts[1];
  if (!GID.test(gid || '')) return err('not_found', 404);
  const access = await resolveAccess(db, s, gid);
  access.guildId = gid;
  if (access.unavailable && !access.role) return err('temporarily_unavailable', 503);
  const sub = parts[2] || '';

  // ---- state ----
  if (!sub && method === 'GET') {
    const settings = await getSettings(db); const catalog = await getCatalog(db);
    const guildInfo = access.guild ? { id: gid, name: access.guild.name, icon: access.guild.icon, owner: Boolean(access.guild.owner), permissions: describePerms(access.guild.permissions, access.guild.owner) } : null;
    if (!access.listing) {
      if (!access.canCreate) return err('forbidden', 403);
      return json({ listing: null, guild: guildInfo, can_create: true, options: options(catalog, settings) });
    }
    if (!access.role) return err('forbidden', 403);
    const invite = access.listing.content.invite_code ? await checkInvite(access.listing.content.invite_code, gid) : null;
    return json({ listing: await loadState(db, access, { invite }), guild: guildInfo, options: options(catalog, settings) });
  }

  // ---- create ----
  if (!sub && method === 'POST') {
    try {
      if (access.listing) return err('listing_exists', 409, { manage: true, allowed: Boolean(access.role) });
      if (!access.canCreate) return err('forbidden', 403);
      if (await limited(db, `create:${uid}`, 10, 3600)) return err('rate_limited', 429);
      const guild = await getBotGuild(gid, { withCounts: true });
      if (!guild) return err('bot_not_in_guild', 409);
      const settings = await getSettings(db);
      const body = (await readJson(request)) || {};
      const name = String(body.name || guild.name).slice(0, LIMITS.name[1]) || guild.name;
      await createListing(db, { guildId: gid, userId: uid, name, stats: guildStats(guild), settings });
      access.listing = await db.collection(C.listings).findOne({ guild_id: toLong(gid) });
      access.role = 'owner'; access.perms = new Set(ROLE_PRESETS.owner);
      return json({ ok: true, listing: await loadState(db, access) }, { status: 201 });
    } catch (e) { return fromError(e); }
  }

  if (!access.listing) return err('not_found', 404);
  if (!access.role) return err('forbidden', 403);
  const listing = access.listing;

  // ---- content ----
  if (sub === 'content' && method === 'PUT') {
    try {
      if (!can(access, 'edit')) return err('forbidden', 403);
      const body = await readJson(request);
      if (!body) return err('invalid_body');
      const catalog = await getCatalog(db);
      const { patch, errors } = sanitizeContent(body, listing.content, catalogSets(catalog));
      if (patch.invite_code) {
        const check = await checkInvite(patch.invite_code, gid);
        if (check.status === 'wrong_server') errors.push({ field: 'invite_code', code: 'invite_wrong_server' });
        else if (check.status === 'not_found') errors.push({ field: 'invite_code', code: 'invite_not_found' });
        else if (check.status === 'expires') errors.push({ field: 'invite_code', code: 'invite_expires' });
        else if (check.status === 'unreachable') errors.push({ field: 'invite_code', code: 'invite_unreachable' });
      }
      if (patch.staff_role_ids) {
        const roles = await getGuildRoles(gid).catch(() => null);
        const map = new Map((roles || []).map((r) => [String(r.id), r]));
        if (!roles || patch.staff_role_ids.some((id) => !map.has(id) || id === gid)) errors.push({ field: 'staff_role_ids', code: 'invalid_role' });
        else patch.staff_roles = patch.staff_role_ids.map((id) => ({ id, name: String(map.get(id).name).slice(0, 40), color: map.get(id).color ? `#${map.get(id).color.toString(16).padStart(6, '0')}` : null }));
      }
      if (errors.length) return validation(errors);
      if (!Object.keys(patch).length) return json({ ok: true, listing: await loadState(db, access) });
      access.listing = await updateContent(db, listing, patch, uid);
      if (patch.invite_code !== undefined) await db.collection(C.listings).updateOne({ _id: listing._id }, { $set: { invite_status: patch.invite_code ? 'valid' : 'unknown', invite_checked_at: new Date() } });
      return json({ ok: true, listing: await loadState(db, access) });
    } catch (e) { return fromError(e); }
  }

  // ---- images ----
  if (sub === 'image') {
    try {
      if (!can(access, 'edit')) return err('forbidden', 403);
      if (isLocked(listing)) return err('locked_pending', 409);
      if (method === 'DELETE') {
        const kind = url.searchParams.get('kind');
        if (!['banner', 'background'].includes(kind)) return err('invalid_kind');
        access.listing = await updateContent(db, listing, { [`${kind}_id`]: null }, uid);
        await pruneImages(db, access.listing);
        return json({ ok: true, listing: await loadState(db, access) });
      }
      if (method === 'POST') {
        if (await limited(db, `upload:${uid}`, 20, 3600)) return err('rate_limited', 429);
        let form; try { form = await request.formData(); } catch { return err('invalid_body'); }
        const kind = String(form.get('kind') || '');
        const file = form.get('file');
        if (!['banner', 'background'].includes(kind) || !file || typeof file.arrayBuffer !== 'function') return err('invalid_body');
        if (file.size > LIMITS.bannerBytes) return validation([{ field: kind, code: 'image_too_large', params: { max: 2 } }]);
        const buffer = Buffer.from(await file.arrayBuffer());
        const check = validateImage(buffer, kind);
        if (check.error) return validation([{ field: kind, code: check.error, params: check.params }]);
        const id = await storeImage(db, { listingId: listing._id, kind, buffer, info: check.info, userId: uid });
        access.listing = await updateContent(db, listing, { [`${kind}_id`]: id }, uid);
        await pruneImages(db, access.listing);
        return json({ ok: true, id, listing: await loadState(db, access) });
      }
    } catch (e) { return fromError(e); }
  }

  if (sub === 'invite-check' && method === 'POST') {
    if (!can(access, 'edit')) return err('forbidden', 403);
    if (await limited(db, `invite:${uid}`, 30, 600)) return err('rate_limited', 429);
    const { normalizeInvite } = await import('./validation.js');
    const body = await readJson(request);
    const code = normalizeInvite(body?.invite);
    if (!code) return json({ status: 'invalid_format' });
    return json(await checkInvite(code, gid));
  }

  if (sub === 'roles' && method === 'GET') {
    if (!can(access, 'edit')) return err('forbidden', 403);
    const roles = await getGuildRoles(gid).catch(() => null);
    if (!roles) return err('discord_unavailable', 502);
    return json({ items: roles.filter((r) => String(r.id) !== gid && !r.managed).sort((a, b) => b.position - a.position).slice(0, 200).map((r) => ({ id: String(r.id), name: r.name, color: r.color ? `#${r.color.toString(16).padStart(6, '0')}` : null })) });
  }

  if (sub === 'submit' && method === 'POST') {
    try {
      if (!can(access, 'submit')) return err('forbidden', 403);
      if (await limited(db, `submit:${uid}`, 12, 3600)) return err('rate_limited', 429);
      const submitBody = (await readJson(request)) || {};
      if (submitBody.accept_terms !== true) return err('terms_required', 400);
      const settings = await getSettings(db);
      let inviteOk = !settings.require_invite;
      if (listing.content.invite_code) {
        const check = await checkInvite(listing.content.invite_code, gid);
        inviteOk = check.status === 'valid';
        await db.collection(C.listings).updateOne({ _id: listing._id }, { $set: { invite_status: inviteOk ? 'valid' : 'invalid', invite_checked_at: new Date() } });
      }
      const guild = await getBotGuild(gid, { withCounts: true });
      if (!guild) return err('bot_not_in_guild', 409);
      await db.collection(C.listings).updateOne({ _id: listing._id }, { $set: { stats: { ...(listing.stats || {}), ...guildStats(guild), voice_count: listing.stats?.voice_count ?? null, growth_7d: listing.stats?.growth_7d ?? 0 }, unavailable: false } });
      const fresh = await db.collection(C.listings).findOne({ _id: listing._id });
      const next = await submitListing(db, fresh, uid, { settings, inviteOk, termsAccepted: true, hasImage: async (id) => Boolean(await loadImage(db, id)) });
      access.listing = next;
      return json({ ok: true, listing: await loadState(db, access) });
    } catch (e) { return fromError(e); }
  }

  // Only the owner can delete. The public address is free again straight away.
  if (sub === 'listing' && method === 'DELETE') {
    try {
      if (access.role !== 'owner') return err('forbidden', 403);
      if (await limited(db, `delete:${uid}`, 10, 3600)) return err('rate_limited', 429);
      await deleteListing(db, listing, { actor: uid, kind: 'owner' });
      return json({ ok: true });
    } catch (e) { return fromError(e); }
  }

  if (sub === 'analytics' && method === 'GET') {
    if (!can(access, 'analytics')) return err('forbidden', 403);
    const settings = await getSettings(db);
    if (!settings.analytics_enabled) return json({ disabled: true });
    return json(await listingAnalytics(db, listing, url.searchParams.get('range')));
  }

  // ---- managers ----
  if (sub === 'managers') {
    try {
      if (!can(access, 'managers')) return err('forbidden', 403);
      if (method === 'GET') {
        const rows = await db.collection(C.managers).find({ listing_id: listing._id }).toArray();
        const items = await Promise.all(rows.map(async (r) => {
          const u = await getDiscordUserById(String(r.user_id)).catch(() => null);
          return { user_id: String(r.user_id), role: r.role, permissions: r.permissions || ROLE_PRESETS[r.role] || [], name: u?.global_name || u?.username || null, added_at: r.at };
        }));
        return json({ items, max: LIMITS.managers });
      }
      const body = await readJson(request);
      if (!body) return err('invalid_body');
      if (method === 'POST' || method === 'PATCH') {
        const target = String(body.user_id || '');
        if (!GID.test(target)) return validation([{ field: 'user_id', code: 'invalid_id' }]);
        if (!MANAGER_ROLES.includes(body.role)) return validation([{ field: 'role', code: 'invalid_choice' }]);
        const perms = Array.isArray(body.permissions) ? [...new Set(body.permissions.map(String))] : (ROLE_PRESETS[body.role] || []);
        if (perms.some((p) => !MANAGER_PERMISSIONS.includes(p))) return validation([{ field: 'permissions', code: 'invalid_choice' }]);
        if (target === uid || String(listing.owner_id) === target) return validation([{ field: 'user_id', code: 'invalid_id' }]);
        if (method === 'POST') {
          const count = await db.collection(C.managers).countDocuments({ listing_id: listing._id });
          if (count >= LIMITS.managers) return err('limit_reached', 409);
          const member = await getGuildMemberRaw(gid, target).catch(() => null);
          if (!member) return validation([{ field: 'user_id', code: 'member_not_found' }]);
          try { await db.collection(C.managers).insertOne({ listing_id: listing._id, user_id: toLong(target), role: body.role, permissions: perms, granted_by: toLong(uid), at: new Date() }); } catch (e) { if (e?.code === 11000) return err('already_manager', 409); throw e; }
        } else {
          const r = await db.collection(C.managers).updateOne({ listing_id: listing._id, user_id: toLong(target) }, { $set: { role: body.role, permissions: perms } });
          if (!r.matchedCount) return err('not_found', 404);
        }
        return json({ ok: true });
      }
      if (method === 'DELETE') {
        const target = String(url.searchParams.get('user_id') || '');
        await db.collection(C.managers).deleteOne({ listing_id: listing._id, user_id: toLong(target) });
        return json({ ok: true });
      }
    } catch (e) { return fromError(e); }
  }
  return null;
}

function describePerms(permStr, owner) {
  if (owner) return ['owner'];
  try {
    const p = BigInt(permStr || 0);
    const out = [];
    if ((p & 0x8n) === 0x8n) out.push('administrator');
    if ((p & 0x20n) === 0x20n) out.push('manage_guild');
    return out;
  } catch { return []; }
}

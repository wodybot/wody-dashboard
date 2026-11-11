import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getUserGuilds, canManage } from '@/lib/discord';
import { toLong } from '@/lib/mongo';
import { C } from './db.js';
import { getDelegate } from '@/lib/owner-access';
import { ROLE_PRESETS } from './constants.js';
import { CommunityError } from './lifecycle.js';

export function json(data, init = {}) {
  return NextResponse.json(data, { ...init, headers: { 'Cache-Control': 'no-store, private', ...(init.headers || {}) } });
}
export function err(code, status = 400, extra = {}) { return json({ error: code, ...extra }, { status }); }
export function validation(errors) { return json({ error: 'validation_failed', errors }, { status: 400 }); }

export function fromError(e) {
  if (e instanceof CommunityError) return err(e.code, e.status, e.extra);
  console.error('[community]', e);
  return err('internal_error', 500);
}

export async function readJson(request) {
  try {
    const text = await request.text();
    if (text.length > 64 * 1024) return null;
    const body = text ? JSON.parse(text) : {};
    return body && typeof body === 'object' && !Array.isArray(body) ? body : null;
  } catch { return null; }
}

export async function limited(db, key, max, windowSec = 60) {
  const windowMs = windowSec * 1000;
  const start = Date.now() - (Date.now() % windowMs);
  try {
    const r = await db.collection('rate_limit_buckets').findOneAndUpdate(
      { _id: `cm:${key}:${start}` },
      { $inc: { count: 1 }, $setOnInsert: { expires_at: new Date(start + windowMs * 2) } },
      { upsert: true, returnDocument: 'after' },
    );
    return (r?.count ?? r?.value?.count ?? 0) > max;
  } catch { return false; }
}

export async function sessionUser() {
  const s = await getSession();
  return s?.user?.id ? s : null;
}

export function adminIds() {
  const ids = new Set();
  if (process.env.DISCORD_OWNER_ID) ids.add(process.env.DISCORD_OWNER_ID);
  for (const id of String(process.env.COMMUNITY_ADMIN_IDS || '').split(',')) if (/^\d{15,25}$/.test(id.trim())) ids.add(id.trim());
  return ids;
}
export const isWodyAdmin = (userId) => adminIds().has(String(userId));
export async function isCommunityAdmin(db, userId) {
  if (isWodyAdmin(userId)) return true;
  return Boolean(await getDelegate(db, userId));
}

export async function resolveAccess(db, session, guildId) {
  const gid = String(guildId);
  let guilds = null;
  try { guilds = await getUserGuilds(session.accessToken); } catch { guilds = null; }
  const g = guilds?.find((x) => String(x.id) === gid) || null;
  const listing = await db.collection(C.listings).findOne({ guild_id: toLong(gid) });
  const discordOwner = Boolean(g?.owner);
  const discordManage = Boolean(g && canManage(g.permissions, g.owner));
  let role = null; let perms = [];
  const mgr = listing ? await db.collection(C.managers).findOne({ listing_id: listing._id, user_id: toLong(session.user.id) }) : null;
  if (listing && String(listing.owner_id) === String(session.user.id) && (discordOwner || discordManage)) { role = 'owner'; perms = ROLE_PRESETS.owner; }
  else if (discordOwner) { role = 'owner'; perms = ROLE_PRESETS.owner; }
  else if (mgr) { role = mgr.role; perms = mgr.permissions?.length ? mgr.permissions : ROLE_PRESETS[mgr.role] || []; }
  else if (discordManage) { role = 'manager'; perms = ROLE_PRESETS.manager; }
  return { guild: g, guilds, listing, role, perms: new Set(perms), discordOwner, discordManage, canCreate: discordManage, unavailable: guilds === null };
}
export const can = (access, perm) => access.perms.has(perm);

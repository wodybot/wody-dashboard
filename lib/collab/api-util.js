// Shared helpers for the Collab API handlers.
import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getUserGuilds, getBotGuilds, canManage } from '@/lib/discord';
import { getDelegate, OWNER_ID, trustedOrigin } from '@/lib/owner-access';
import { CollabError } from './lifecycle.js';

export { trustedOrigin };
export function json(data, init = {}) {
  return NextResponse.json(data, { ...init, headers: { 'Cache-Control': 'no-store, private', ...(init.headers || {}) } });
}
export function err(code, status = 400, extra = {}) { return json({ error: code, ...extra }, { status }); }
export function fromError(e) {
  if (e instanceof CollabError) return err(e.code, e.status, e.extra);
  console.error('[collab]', e);
  return err('internal_error', 500);
}
export async function readJson(request, max = 64 * 1024) {
  try {
    const text = await request.text();
    if (text.length > max) return null;
    const body = text ? JSON.parse(text) : {};
    return body && typeof body === 'object' && !Array.isArray(body) ? body : null;
  } catch { return null; }
}
export async function limited(db, key, max, windowSec = 60) {
  const windowMs = windowSec * 1000;
  const start = Date.now() - (Date.now() % windowMs);
  try {
    const r = await db.collection('rate_limit_buckets').findOneAndUpdate(
      { _id: `mk:${key}:${start}` },
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
// Wody staff: the owner, extra admins from env, and Owner Panel delegates (checked in the database each call).
export async function isStaff(db, userId) {
  const id = String(userId);
  if (id === OWNER_ID) return true;
  const extra = String(process.env.COMMUNITY_ADMIN_IDS || '').split(',').map((s) => s.trim());
  if (extra.includes(id)) return true;
  return Boolean(await getDelegate(db, id));
}
export function actorOf(session) { return { id: session.user.id, name: session.user.global_name || session.user.username }; }

// Servers the user is in AND Wody is installed in. Role in each: owner / manager / member.
export async function eligibleGuilds(session) {
  let mine = [];
  try { mine = await getUserGuilds(session.accessToken); } catch { return { guilds: [], unavailable: true }; }
  let botIds = new Set();
  try { botIds = new Set((await getBotGuilds()).map((g) => String(g.id))); } catch { return { guilds: [], unavailable: true }; }
  const guilds = mine.filter((g) => botIds.has(String(g.id))).map((g) => ({ id: String(g.id), name: g.name, icon: g.icon || null, owner: Boolean(g.owner), manage: canManage(g.permissions, g.owner) }));
  return { guilds, unavailable: false };
}
// The Discord owner of a server, verified live. Server admins and managers do not count.
export async function isGuildOwner(session, guildId) {
  const { guilds, unavailable } = await eligibleGuilds(session);
  if (unavailable) return { ok: false, unavailable: true };
  const g = guilds.find((x) => x.id === String(guildId));
  return { ok: Boolean(g?.owner), guild: g || null };
}

// Image bytes are checked, never the declared type.
export function sniffImage(buf) {
  if (buf.length > 12 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buf.length > 12 && buf.subarray(0, 4).toString('latin1') === 'RIFF' && buf.subarray(8, 12).toString('latin1') === 'WEBP') return 'image/webp';
  return null;
}

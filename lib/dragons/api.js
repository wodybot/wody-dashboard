// Dragons API (mounted at /api/dragons/*). Server managers only.
//   GET guilds/:gid   the dragons of a server
//   PUT guilds/:gid   {dragons: [...]}   replaces them (validated again here, never trusted from the browser)
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { isAccountBlocked } from '@/lib/account-moderation';
import { getUserGuilds, canManage } from '@/lib/discord';
import { COLLECTION } from './constants.js';
import { normalizeDragons } from './schema.js';

const SNOWFLAKE = /^\d{15,25}$/;
export const json = (data, init = {}) => NextResponse.json(data, { ...init, headers: { 'Cache-Control': 'no-store, private', ...(init.headers || {}) } });
export const err = (code, status = 400, extra = {}) => json({ error: code, ...extra }, { status });

async function readJson(request, max = 96 * 1024) {
  try {
    const t = await request.text(); if (t.length > max) return null;
    const b = t ? JSON.parse(t) : {};
    return b && typeof b === 'object' && !Array.isArray(b) ? b : null;
  } catch { return null; }
}

async function rateLimited(db, key, max, windowSec = 60) {
  const ms = windowSec * 1000; const start = Date.now() - (Date.now() % ms);
  try {
    const r = await db.collection('rate_limit_buckets').findOneAndUpdate({ _id: `dragons:${key}:${start}` }, { $inc: { count: 1 }, $setOnInsert: { expires_at: new Date(start + ms * 2) } }, { upsert: true, returnDocument: 'after' });
    return (r?.count ?? r?.value?.count ?? 0) > max;
  } catch { return false; }
}

async function guildManager(db, session, gid) {
  if (!SNOWFLAKE.test(String(gid))) return { response: err('invalid_id', 400) };
  const banned = await db.collection('guild_bans').findOne({ guild_id: String(gid), active: true });
  if (banned) return { response: err('guild_banned', 403) };
  let guilds;
  try { guilds = await getUserGuilds(session.accessToken); } catch { return { response: err('temporarily_unavailable', 503) }; }
  const g = guilds.find((x) => String(x.id) === String(gid));
  if (!g || !canManage(g.permissions, g.owner)) return { response: err('forbidden', 403) };
  return { guild: g };
}

export async function handle({ request, db, parts, method }) {
  const [area, gid] = parts;
  if (area !== 'guilds' || !gid || parts.length > 2) return err('not_found', 404);
  const session = await getSession();
  const userId = session?.user?.id;
  if (!userId) return err('unauthenticated', 401);
  if (await isAccountBlocked(db, userId)) return err('account_blocked', 403);
  if (await rateLimited(db, `u:${userId}`, 60)) return err('rate_limited', 429);
  const gm = await guildManager(db, session, gid);
  if (gm.response) return gm.response;
  const doc = await db.collection(COLLECTION).findOne({ guild_id: String(gid) });
  const current = Array.isArray(doc?.dragons) ? doc.dragons : [];
  if (method === 'GET') return json({ dragons: current, updated_at: doc?.updated_at || null });
  if (method !== 'PUT') return err('method_not_allowed', 405);
  const body = await readJson(request); if (!body) return err('invalid_body', 400);
  const n = normalizeDragons(body.dragons, current);
  if (!n.ok) return err(n.error, 400, { field: n.field });
  const now = new Date();
  await db.collection(COLLECTION).updateOne({ guild_id: String(gid) }, { $set: { dragons: n.dragons, updated_at: now, updated_by: String(userId) }, $setOnInsert: { guild_id: String(gid), created_at: now } }, { upsert: true });
  try { await db.collection('dragon_audit').insertOne({ at: now, guild_id: String(gid), actor: String(userId), action: 'save', count: n.dragons.length }); } catch { /* the audit line is best effort */ }
  return json({ dragons: n.dragons, updated_at: now });
}

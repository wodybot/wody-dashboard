import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongo';
import { getSession } from '@/lib/session';
import { isTrustedOrigin } from '@/lib/captcha';
import { publicImageUrl } from '@/lib/img-sign';
import { authorizeUrl, getUserInfo, listVideos, refreshAccessToken, revokeToken, tiktokStatus, TikTokError } from '@/lib/streams/tiktok';
import { decryptToken, encryptToken } from '@/lib/streams/crypto';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

const json = (data, init = {}) => NextResponse.json(data, { ...init, headers: { 'Cache-Control': 'no-store, private' } });
const COL = 'user_tiktok_links';

async function limited(db, key, max, windowSec) {
  const now = Date.now();
  const win = now - (now % (windowSec * 1000));
  try {
    const r = await db.collection('rate_limit_buckets').findOneAndUpdate(
      { _id: `${key}:${win}` },
      { $inc: { count: 1 }, $setOnInsert: { expires_at: new Date(win + windowSec * 2000) } },
      { upsert: true, returnDocument: 'after' },
    );
    return (r?.count ?? r?.value?.count ?? 0) > max;
  } catch { return false; }
}

async function liveData(db, row) {
  let access = decryptToken(row.access_token_enc);
  const read = async (token) => ({ profile: await getUserInfo(token), videos: await listVideos(token, 6) });
  try {
    return await read(access);
  } catch (e) {
    if (!(e instanceof TikTokError) || e.code === 'unreachable') throw e;
    const tokens = await refreshAccessToken(decryptToken(row.refresh_token_enc));
    access = tokens.access_token;
    await db.collection(COL).updateOne({ _id: row._id }, { $set: {
      access_token_enc: encryptToken(tokens.access_token), refresh_token_enc: encryptToken(tokens.refresh_token),
      access_expires_at: new Date(Date.now() + Number(tokens.expires_in || 86400) * 1000),
      refresh_expires_at: new Date(Date.now() + Number(tokens.refresh_expires_in || 31536000) * 1000) } });
    return read(access);
  }
}

export async function GET() {
  const session = await getSession();
  if (!session?.user?.id) return json({ signed_in: false, available: tiktokStatus().available });
  const db = await getDb();
  const status = tiktokStatus();
  const row = await db.collection(COL).findOne({ user_id: String(session.user.id) });
  if (!row) return json({ signed_in: true, available: status.available, connected: false });
  if (!status.available) return json({ signed_in: true, available: false, connected: true, state: 'unavailable' });
  if (await limited(db, `ttl:${session.user.id}`, 30, 60)) return json({ error: 'rate_limited' }, { status: 429 });
  try {
    const { profile, videos } = await liveData(db, row);
    await db.collection(COL).updateOne({ _id: row._id }, { $set: { username: profile.username, display_name: profile.display_name, avatar_url: profile.avatar_url, updated_at: new Date() } });
    return json({
      signed_in: true, available: true, connected: true, state: 'ok',
      profile: { name: profile.display_name, username: profile.username, avatar: publicImageUrl(profile.avatar_url), url: profile.profile_url },
      videos: videos.map((v) => ({ id: v.id, title: v.title, cover: publicImageUrl(v.cover), url: v.url, created: v.created, views: v.views, likes: v.likes })),
    });
  } catch (e) {
    const expired = e instanceof TikTokError && ['invalid_grant', 'token_failed', 'user_failed'].includes(e.code);
    return json({ signed_in: true, available: true, connected: true, state: expired ? 'expired' : 'unreachable', profile: { name: row.display_name, username: row.username, avatar: publicImageUrl(row.avatar_url), url: row.profile_url } });
  }
}

export async function POST(request) {
  if (!isTrustedOrigin(request)) return json({ error: 'forbidden_origin' }, { status: 403 });
  const session = await getSession();
  if (!session?.user?.id) return json({ error: 'unauthenticated' }, { status: 401 });
  const status = tiktokStatus();
  if (!status.available) return json({ error: 'provider_unavailable' }, { status: 503 });
  const db = await getDb();
  if (await limited(db, `ttc:${session.user.id}`, 10, 600)) return json({ error: 'rate_limited' }, { status: 429 });
  const state = crypto.randomBytes(24).toString('base64url');
  await db.collection('stream_oauth_states').insertOne({ state, purpose: 'profile', user_id: String(session.user.id), expires_at: new Date(Date.now() + 10 * 60_000) });
  return json({ url: authorizeUrl(state) });
}

export async function DELETE(request) {
  if (!isTrustedOrigin(request)) return json({ error: 'forbidden_origin' }, { status: 403 });
  const session = await getSession();
  if (!session?.user?.id) return json({ error: 'unauthenticated' }, { status: 401 });
  const db = await getDb();
  const row = await db.collection(COL).findOne({ user_id: String(session.user.id) });
  if (row) {
    try { if (row.access_token_enc) await revokeToken(decryptToken(row.access_token_enc)); } catch { }
    await db.collection(COL).deleteOne({ _id: row._id });
  }
  return json({ ok: true });
}

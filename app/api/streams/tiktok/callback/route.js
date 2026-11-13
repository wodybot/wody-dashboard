import { NextResponse } from 'next/server';
import { getDb, toLong } from '@/lib/mongo';
import { getSession } from '@/lib/session';
import { exchangeCode, getUserInfo, tiktokStatus, TikTokError } from '@/lib/streams/tiktok';
import { encryptToken } from '@/lib/streams/crypto';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

const base = () => (process.env.NEXT_PUBLIC_BASE_URL || 'https://wody.online').replace(/\/+$/, '');
const back = (guildId, result) => NextResponse.redirect(`${base()}/dashboard/${guildId || ''}?tiktok=${result}`, { status: 302 });

const backProfile = (result) => NextResponse.redirect(`${base()}/tiktok?tiktok=${result}`, { status: 302 });

async function profileLink(db, doc, url, code) {
  if (new Date(doc.expires_at).getTime() < Date.now()) return backProfile('expired');
  const session = await getSession();
  if (!session?.user?.id || String(session.user.id) !== String(doc.user_id)) return backProfile('invalid');
  if (url.searchParams.get('error')) return backProfile('denied');
  if (!code) return backProfile('invalid');
  if (!tiktokStatus().available) return backProfile('unavailable');
  const tokens = await exchangeCode(code);
  const profile = await getUserInfo(tokens.access_token);
  const now = new Date();
  await db.collection('user_tiktok_links').updateOne(
    { user_id: String(doc.user_id) },
    { $set: {
      open_id: profile.open_id, username: profile.username, display_name: profile.display_name, avatar_url: profile.avatar_url, profile_url: profile.profile_url,
      scope: tokens.scope || '', access_token_enc: encryptToken(tokens.access_token), refresh_token_enc: encryptToken(tokens.refresh_token),
      access_expires_at: new Date(now.getTime() + Number(tokens.expires_in || 86400) * 1000),
      refresh_expires_at: new Date(now.getTime() + Number(tokens.refresh_expires_in || 31536000) * 1000), updated_at: now },
    $setOnInsert: { user_id: String(doc.user_id), created_at: now } },
    { upsert: true },
  );
  return backProfile('connected');
}

export async function GET(request) {
  const url = new URL(request.url);
  const state = url.searchParams.get('state') || '';
  const code = url.searchParams.get('code') || '';
  const db = await getDb();
  let guildId = '';
  try {
    const pending = state ? await db.collection('stream_oauth_states').findOneAndDelete({ state }) : null;
    const doc = pending?.value ?? pending;
    if (!doc) return back('', 'invalid');
    if (doc.purpose === 'profile') return await profileLink(db, doc, url, code);
    guildId = String(doc.guild_id);
    if (new Date(doc.expires_at).getTime() < Date.now()) return back(guildId, 'expired');
    const session = await getSession();
    if (!session?.user?.id || String(session.user.id) !== String(doc.user_id)) return back(guildId, 'invalid');
    if (url.searchParams.get('error')) return back(guildId, 'denied');
    if (!code) return back(guildId, 'invalid');
    if (!tiktokStatus().available) return back(guildId, 'unavailable');

    const tokens = await exchangeCode(code);
    const profile = await getUserInfo(tokens.access_token);
    const now = new Date();
    await db.collection('stream_tiktok_connections').updateOne(
      { guild_id: toLong(guildId), open_id: profile.open_id },
      {
        $set: {
          username: profile.username, display_name: profile.display_name, avatar_url: profile.avatar_url, profile_url: profile.profile_url,
          status: 'connected', status_reason: null, scope: tokens.scope || '',
          access_token_enc: encryptToken(tokens.access_token), refresh_token_enc: encryptToken(tokens.refresh_token),
          access_expires_at: new Date(now.getTime() + Number(tokens.expires_in || 86400) * 1000),
          refresh_expires_at: new Date(now.getTime() + Number(tokens.refresh_expires_in || 31536000) * 1000),
          connected_by: toLong(doc.user_id), updated_at: now, last_poll_at: null, next_poll_at: null, poll_step: 0, last_video_ts: null,
        },
        $setOnInsert: { guild_id: toLong(guildId), open_id: profile.open_id, created_at: now },
      },
      { upsert: true },
    );
    return back(guildId, 'connected');
  } catch (e) {
    console.error('[TikTok OAuth] callback failed', e instanceof TikTokError ? e.code : 'error');
    if (!guildId && state) return backProfile('failed');
    return back(guildId, 'failed');
  }
}

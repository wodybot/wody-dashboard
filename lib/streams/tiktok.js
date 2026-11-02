// TikTok, official products only: Login Kit (OAuth) and the Display API.
//
// What TikTok offers (checked against developers.tiktok.com):
//  - Webhooks: authorization.removed, video.publish.completed,
//    video.upload.failed, portability.download.ready. None of them announce
//    "a creator posted a public video".
//  - Display API /v2/video/list/ returns the videos of the user who authorized
//    the app (scope video.list). It cannot read any other account.
//
// So Wody can notify for a creator ONLY after that creator connects their own
// account here, and new videos are found by checking that account's own video
// list through the official API (the bot does this every few minutes). There is
// no way to follow an arbitrary public account officially, and none is
// attempted: no scraping, no private endpoints, no browser automation.
import crypto from 'crypto';
import { tokenCryptoConfigured } from '@/lib/streams/crypto';

const AUTH_URL = 'https://www.tiktok.com/v2/auth/authorize/';
const TOKEN_URL = 'https://open.tiktokapis.com/v2/oauth/token/';
const REVOKE_URL = 'https://open.tiktokapis.com/v2/oauth/revoke/';
const USER_URL = 'https://open.tiktokapis.com/v2/user/info/';
export const TIKTOK_SCOPES = ['user.info.basic', 'user.info.profile', 'video.list'];
export const WEBHOOK_TOLERANCE_MS = 5 * 60 * 1000;

export class TikTokError extends Error {
  constructor(code, message) { super(message || code); this.code = code; }
}

export function tiktokStatus() {
  if (!process.env.TIKTOK_CLIENT_KEY || !process.env.TIKTOK_CLIENT_SECRET) return { available: false, reason: 'not_configured' };
  if (!tokenCryptoConfigured()) return { available: false, reason: 'token_key_missing' };
  return { available: true, reason: null };
}

export function redirectUri() {
  const base = (process.env.NEXT_PUBLIC_BASE_URL || 'https://wody.online').replace(/\/+$/, '');
  return `${base}/api/streams/tiktok/callback`;
}

export function authorizeUrl(state) {
  const url = new URL(AUTH_URL);
  url.searchParams.set('client_key', process.env.TIKTOK_CLIENT_KEY);
  url.searchParams.set('scope', TIKTOK_SCOPES.join(','));
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('redirect_uri', redirectUri());
  url.searchParams.set('state', state);
  return url.toString();
}

async function tokenCall(form) {
  let res;
  try {
    res = await fetch(TOKEN_URL, {
      method: 'POST', cache: 'no-store',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_key: process.env.TIKTOK_CLIENT_KEY, client_secret: process.env.TIKTOK_CLIENT_SECRET, ...form }),
    });
  } catch { throw new TikTokError('unreachable', 'TikTok connection unavailable'); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) throw new TikTokError(data?.error === 'invalid_grant' ? 'invalid_grant' : 'token_failed', data?.error_description || 'TikTok rejected the request');
  return data;
}

// Server-side code exchange. The client secret never leaves the server.
export function exchangeCode(code) {
  return tokenCall({ code, grant_type: 'authorization_code', redirect_uri: redirectUri() });
}

export function refreshAccessToken(refreshToken) {
  return tokenCall({ grant_type: 'refresh_token', refresh_token: refreshToken });
}

export async function revokeToken(accessToken) {
  try {
    await fetch(REVOKE_URL, {
      method: 'POST', cache: 'no-store', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_key: process.env.TIKTOK_CLIENT_KEY, client_secret: process.env.TIKTOK_CLIENT_SECRET, token: accessToken }),
    });
  } catch { /* best effort: the local copy is deleted either way */ }
}

export async function getUserInfo(accessToken) {
  let res;
  try {
    res = await fetch(`${USER_URL}?fields=open_id,union_id,avatar_url,display_name,username,profile_deep_link`, {
      cache: 'no-store', headers: { Authorization: `Bearer ${accessToken}` },
    });
  } catch { throw new TikTokError('unreachable', 'TikTok connection unavailable'); }
  const data = await res.json().catch(() => ({}));
  const u = data?.data?.user;
  if (!res.ok || !u?.open_id) throw new TikTokError('user_failed', data?.error?.message || 'Could not read the TikTok profile');
  return { open_id: u.open_id, display_name: u.display_name || '', avatar_url: u.avatar_url || '', username: u.username || '', profile_url: u.profile_deep_link || '' };
}

// Display API /v2/video/list/: the creator's own latest public videos (scope video.list).
export async function listVideos(accessToken, max = 6) {
  let res;
  try {
    res = await fetch('https://open.tiktokapis.com/v2/video/list/?fields=id,title,cover_image_url,share_url,create_time,view_count,like_count', {
      method: 'POST', cache: 'no-store',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ max_count: Math.min(20, Math.max(1, max)) }),
    });
  } catch { throw new TikTokError('unreachable', 'TikTok connection unavailable'); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !Array.isArray(data?.data?.videos)) throw new TikTokError('videos_failed', data?.error?.message || 'Could not read the TikTok videos');
  return data.data.videos.map((v) => ({
    id: String(v.id || ''), title: String(v.title || '').slice(0, 150), cover: String(v.cover_image_url || ''),
    url: String(v.share_url || ''), created: Number(v.create_time) || 0, views: Number(v.view_count) || 0, likes: Number(v.like_count) || 0,
  })).filter((v) => v.id);
}

// TikTok-Signature: t=<unix seconds>,s=<hex hmac-sha256(client_secret, `${t}.${rawBody}`)>
export function verifyWebhook(header, rawBody, now = Date.now()) {
  if (!header || !process.env.TIKTOK_CLIENT_SECRET) return false;
  const parts = Object.fromEntries(String(header).split(',').map((p) => p.trim().split('=')).filter((kv) => kv.length === 2));
  const t = Number(parts.t);
  if (!parts.s || !Number.isFinite(t)) return false;
  if (Math.abs(now - t * 1000) > WEBHOOK_TOLERANCE_MS) return false;
  const expected = crypto.createHmac('sha256', process.env.TIKTOK_CLIENT_SECRET).update(`${parts.t}.${rawBody}`).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(parts.s);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

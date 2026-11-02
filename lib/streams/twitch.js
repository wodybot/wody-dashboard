// Twitch, official API only: Helix (search, users, streams) and EventSub
// webhooks (stream.online / stream.offline). No scraping, no page checks, no
// polling of twitch.tv. Docs: dev.twitch.tv/docs/eventsub
import crypto from 'crypto';

const HELIX = 'https://api.twitch.tv/helix';
const TOKEN_URL = 'https://id.twitch.tv/oauth2/token';

export const TWITCH_EVENT_TYPES = ['stream.online', 'stream.offline'];
export const TIMESTAMP_TOLERANCE_MS = 10 * 60 * 1000;   // Twitch: reject messages older than 10 minutes

export function twitchConfigured() {
  return Boolean(process.env.TWITCH_CLIENT_ID && process.env.TWITCH_CLIENT_SECRET);
}

export class TwitchError extends Error {
  constructor(code, message, status) { super(message || code); this.code = code; this.status = status; }
}

let _token = null; // { value, expiresAt }

async function appToken(force = false) {
  if (!twitchConfigured()) throw new TwitchError('not_configured', 'Twitch is not configured');
  if (!force && _token && _token.expiresAt - Date.now() > 60_000) return _token.value;
  let res;
  try {
    res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.TWITCH_CLIENT_ID,
        client_secret: process.env.TWITCH_CLIENT_SECRET,
        grant_type: 'client_credentials',
      }),
      cache: 'no-store',
    });
  } catch {
    throw new TwitchError('unreachable', 'Twitch connection unavailable');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) throw new TwitchError(res.status === 400 || res.status === 403 ? 'bad_credentials' : 'unreachable', 'Twitch rejected the credentials', res.status);
  _token = { value: data.access_token, expiresAt: Date.now() + (Number(data.expires_in) || 3600) * 1000 };
  return _token.value;
}

async function helix(path, { method = 'GET', params, body, retry = true } = {}) {
  const token = await appToken();
  const url = new URL(`${HELIX}/${path}`);
  for (const [k, v] of Object.entries(params || {})) {
    if (Array.isArray(v)) v.forEach((x) => url.searchParams.append(k, x)); else if (v !== undefined) url.searchParams.set(k, v);
  }
  let res;
  try {
    res = await fetch(url, {
      method,
      headers: { 'Client-Id': process.env.TWITCH_CLIENT_ID, Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store',
    });
  } catch {
    throw new TwitchError('unreachable', 'Twitch connection unavailable');
  }
  if (res.status === 401 && retry) { await appToken(true); return helix(path, { method, params, body, retry: false }); }
  if (res.status === 204) return { status: 204, data: null };
  const data = await res.json().catch(() => ({}));
  if (res.status === 429) throw new TwitchError('rate_limited', 'Twitch rate limit reached', 429);
  if (!res.ok) throw new TwitchError(res.status === 409 ? 'conflict' : 'api_error', data?.message || `Twitch error ${res.status}`, res.status);
  return { status: res.status, data };
}

const LOGIN_RE = /^[a-zA-Z0-9_]{1,25}$/;

export function parseTwitchLogin(input) {
  let raw = String(input || '').trim();
  const m = raw.match(/twitch\.tv\/([a-zA-Z0-9_]{1,25})/i);
  if (m) raw = m[1];
  raw = raw.replace(/^@/, '');
  return LOGIN_RE.test(raw) ? raw.toLowerCase() : null;
}

export async function searchChannels(query) {
  const q = String(query || '').trim();
  if (q.length < 2) return [];
  const { data } = await helix('search/channels', { params: { query: q, first: '8' } });
  return (data?.data || []).map((c) => ({
    id: c.id, login: c.broadcaster_login, name: c.display_name, avatar: c.thumbnail_url, live: Boolean(c.is_live),
  }));
}

export async function getUserByLogin(login) {
  const { data } = await helix('users', { params: { login } });
  const u = data?.data?.[0];
  return u ? { id: u.id, login: u.login, name: u.display_name, avatar: u.profile_image_url } : null;
}

export async function getUserById(id) {
  const { data } = await helix('users', { params: { id } });
  const u = data?.data?.[0];
  return u ? { id: u.id, login: u.login, name: u.display_name, avatar: u.profile_image_url } : null;
}

export async function getLiveStream(userId) {
  const { data } = await helix('streams', { params: { user_id: userId } });
  const s = data?.data?.[0];
  if (!s || s.type !== 'live') return null;
  return {
    stream_id: s.id, title: s.title, game: s.game_name, game_id: s.game_id, viewers: s.viewer_count,
    started_at: s.started_at, thumbnail_url: s.thumbnail_url,
  };
}

export async function getBoxArt(gameId) {
  if (!gameId) return null;
  const { data } = await helix('games', { params: { id: gameId } });
  return data?.data?.[0]?.box_art_url || null;
}

export function callbackUrl() {
  const base = (process.env.NEXT_PUBLIC_BASE_URL || 'https://wody.online').replace(/\/+$/, '');
  return `${base}/api/streams/twitch/eventsub`;
}

export function newSecret() { return crypto.randomBytes(32).toString('hex'); }

export async function createSubscription({ type, broadcasterId, secret }) {
  const body = {
    type, version: '1', condition: { broadcaster_user_id: String(broadcasterId) },
    transport: { method: 'webhook', callback: callbackUrl(), secret },
  };
  const { data } = await helix('eventsub/subscriptions', { method: 'POST', body });
  const sub = data?.data?.[0];
  if (!sub) throw new TwitchError('api_error', 'Twitch did not create the subscription');
  return { id: sub.id, status: sub.status };
}

export async function deleteSubscription(id) {
  try { await helix('eventsub/subscriptions', { method: 'DELETE', params: { id } }); } catch (e) {
    if (e.status !== 404) throw e;
  }
}

export async function listSubscriptions(params = {}) {
  const { data } = await helix('eventsub/subscriptions', { params });
  return data?.data || [];
}

// ---- webhook verification (https://dev.twitch.tv/docs/eventsub/handling-webhook-events) ----
export function verifySignature({ messageId, timestamp, rawBody, signature, secret }) {
  if (!messageId || !timestamp || !signature || !secret) return false;
  const expected = `sha256=${crypto.createHmac('sha256', secret).update(messageId + timestamp + rawBody).digest('hex')}`;
  const a = Buffer.from(expected);
  const b = Buffer.from(String(signature));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function timestampFresh(timestamp, now = Date.now()) {
  const t = Date.parse(timestamp);
  return Number.isFinite(t) && Math.abs(now - t) <= TIMESTAMP_TOLERANCE_MS;
}

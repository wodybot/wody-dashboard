const TOKEN_URL = 'https://id.kick.com/oauth/token';
const API = 'https://api.kick.com/public/v1';

export function kickConfigured() {
  return Boolean(process.env.KICK_CLIENT_ID && process.env.KICK_CLIENT_SECRET);
}

export class KickError extends Error {
  constructor(code, message, status) { super(message || code); this.code = code; this.status = status; }
}

let _token = null;

async function appToken() {
  if (!kickConfigured()) throw new KickError('not_configured', 'Kick is not configured');
  if (_token && _token.expiresAt - Date.now() > 60_000) return _token.value;
  let res;
  try {
    res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: process.env.KICK_CLIENT_ID, client_secret: process.env.KICK_CLIENT_SECRET, grant_type: 'client_credentials' }),
      cache: 'no-store',
    });
  } catch { throw new KickError('unreachable', 'Kick connection unavailable'); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) throw new KickError(res.status === 400 || res.status === 401 || res.status === 403 ? 'bad_credentials' : 'unreachable', 'Kick rejected the credentials', res.status);
  _token = { value: data.access_token, expiresAt: Date.now() + (Number(data.expires_in) || 3600) * 1000 };
  return _token.value;
}

export function parseKickSlug(input) {
  let s = String(input || '').trim();
  if (!s) return null;
  const m = s.match(/^(?:https?:\/\/)?(?:www\.)?kick\.com\/([^/?#\s]+)/i);
  if (m) s = m[1];
  s = s.replace(/^@/, '').toLowerCase();
  return /^[a-z0-9_-]{1,40}$/.test(s) ? s : null;
}

export async function getChannelBySlug(slug) {
  const token = await appToken();
  let res;
  try {
    res = await fetch(`${API}/channels?slug=${encodeURIComponent(slug)}`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
  } catch { throw new KickError('unreachable', 'Kick connection unavailable'); }
  if (res.status === 401) { _token = null; throw new KickError('bad_credentials', 'Kick rejected the token', 401); }
  if (!res.ok) throw new KickError('unreachable', 'Kick API error', res.status);
  const data = await res.json().catch(() => ({}));
  const row = Array.isArray(data.data) ? data.data[0] : null;
  if (!row) return null;
  return {
    slug: String(row.slug || slug).toLowerCase(),
    id: String(row.broadcaster_user_id ?? ''),
    name: row.slug || slug,
    avatar: row.banner_picture || null,
  };
}


import crypto from 'node:crypto';

const DISCORD_CDN_PATH_RE = /^(?:icons\/\d{15,25}\/[a-zA-Z0-9_]+\.(?:png|jpe?g|webp|gif)|avatars\/\d{15,25}\/[a-zA-Z0-9_]+\.(?:png|jpe?g|webp|gif)|embed\/avatars\/[0-9]\.png)$/;

const OWN_HOSTS = new Set(['wody.online', 'www.wody.online']);
try {
  if (process.env.NEXT_PUBLIC_BASE_URL) OWN_HOSTS.add(new URL(process.env.NEXT_PUBLIC_BASE_URL).hostname.toLowerCase());
} catch { }

function key() {
  const secret = process.env.SESSION_SECRET || (process.env.NODE_ENV === 'production' ? '' : 'dev-secret');
  if (!secret) return null;
  return crypto.createHash('sha256').update(`wody-img-proxy:v1:${secret}`).digest();
}

export function signImageUrl(url) {
  const k = key();
  if (!k) return null;
  return crypto.createHmac('sha256', k).update(String(url)).digest('base64url').slice(0, 32);
}

export function verifyImageSignature(url, sig) {
  if (!url || !sig || typeof sig !== 'string') return false;
  const exp = signImageUrl(url);
  if (!exp) return false;
  const expected = Buffer.from(exp);
  const got = Buffer.from(sig);
  return expected.length === got.length && crypto.timingSafeEqual(expected, got);
}

export function publicImageUrl(raw) {
  if (!raw || typeof raw !== 'string') return '';
  const v = raw.trim();
  if (!v) return '';
  if (v.startsWith('/') && !v.startsWith('//')) return v;
  if (/^(data|blob):/i.test(v)) return v;
  let u;
  try { u = new URL(v.startsWith('//') ? `https:${v}` : v); } catch { return ''; }
  if (u.protocol === 'http:') u.protocol = 'https:';
  if (u.protocol !== 'https:') return '';
  const host = u.hostname.toLowerCase();
  if (OWN_HOSTS.has(host)) return u.toString();
  if (host === 'cdn.discordapp.com' && DISCORD_CDN_PATH_RE.test(u.pathname.replace(/^\//, ''))) {
    const size = u.searchParams.get('size');
    const path = u.pathname.replace(/^\//, '');
    return `/api/discord-cdn?path=${encodeURIComponent(path)}${size ? `&size=${encodeURIComponent(size)}` : ''}`;
  }
  const target = u.toString();
  const sig = signImageUrl(target);
  if (!sig) return '';
  return `/api/img-proxy?u=${encodeURIComponent(target)}&s=${sig}`;
}

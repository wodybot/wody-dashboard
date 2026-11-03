import { clsx } from "clsx";
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

const DISCORD_CDN_PROXY_PATH_RE = /^(?:icons\/\d{15,25}\/[a-zA-Z0-9_]+\.(?:png|jpe?g|webp|gif)|avatars\/\d{15,25}\/[a-zA-Z0-9_]+\.(?:png|jpe?g|webp|gif)|embed\/avatars\/[0-9]\.png)$/;

function discordCdnProxyPath(u) {
  if (u.hostname.toLowerCase() !== 'cdn.discordapp.com') return null;
  const path = u.pathname.replace(/^\//, '');
  if (!DISCORD_CDN_PROXY_PATH_RE.test(path)) return null;
  const size = u.searchParams.get('size');
  return `/api/discord-cdn?path=${encodeURIComponent(path)}${size ? `&size=${encodeURIComponent(size)}` : ''}`;
}

export function discordCdnUrl(rawUrl) {
  if (!rawUrl) return rawUrl;
  let u;
  try {
    u = new URL(rawUrl);
  } catch {
    return proxiedImageUrl(rawUrl);
  }
  const proxied = discordCdnProxyPath(u);
  if (proxied) return proxied;
  return proxiedImageUrl(rawUrl);
}

const OWN_IMAGE_HOSTS = ['wody.online', 'www.wody.online'];
let ownBaseHost = null;
try {
  if (process.env.NEXT_PUBLIC_BASE_URL) ownBaseHost = new URL(process.env.NEXT_PUBLIC_BASE_URL).hostname.toLowerCase();
} catch {
  ownBaseHost = null;
}

export function proxiedImageUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return rawUrl;
  const raw = rawUrl.trim();
  if (!raw) return rawUrl;
  if (raw.startsWith('/') && !raw.startsWith('//')) return raw;
  if (/^(data|blob):/i.test(raw)) return raw;
  if (!raw.startsWith('//') && !/^[a-z][a-z0-9+.-]*:/i.test(raw)) return raw;
  let u;
  try {
    u = new URL(raw.startsWith('//') ? `https:${raw}` : raw);
  } catch {
    return null;
  }
  if (u.protocol === 'http:') u.protocol = 'https:';
  if (u.protocol !== 'https:') return null;
  const host = u.hostname.toLowerCase();
  if (OWN_IMAGE_HOSTS.includes(host) || host === ownBaseHost) return raw.startsWith('//') || /^http:/i.test(raw) ? u.toString() : raw;
  const discordPath = discordCdnProxyPath(u);
  if (discordPath) return discordPath;
  return `/api/img-proxy?u=${encodeURIComponent(u.toString())}`;
}

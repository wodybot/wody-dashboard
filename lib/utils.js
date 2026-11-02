import { clsx } from "clsx";
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

// Rewrites a raw https://cdn.discordapp.com/... URL (guild icon, user
// avatar, or the numbered default-avatar images) into our own same-origin
// proxy path, /api/discord-cdn. cdn.discordapp.com sits behind Cloudflare
// Bot Management, which sets its own cookies (__cf_bm, __dcfduid,
// __sdcfduid) on ANY direct request to it, including a plain
// <img src="https://cdn.discordapp.com/...">, before the visitor has made
// any cookie choice. Routing every such image through our server instead
// (see the 'discord-cdn' handler in app/api/[[...path]]/route.js) means the
// visitor's browser only ever talks to our own domain.
// Anything that isn't actually a cdn.discordapp.com URL (null, or some
// other host) is returned unchanged, so this is safe to wrap around any
// avatar/icon URL unconditionally, whether or not it turned out to be one.
//
// Only the avatar/icon shapes the /api/discord-cdn handler actually accepts
// (same regex as there) go to that proxy. Every other external URL (Discord
// attachments, media.discordapp.net, Twitch/TikTok avatars, any other host)
// goes through proxiedImageUrl() below instead of being returned unchanged,
// so no caller can ever end up with a direct third-party request.
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
    // Relative same-origin paths stay as they are; anything else that is
    // not a full URL (e.g. "//host/x.png") is routed through the proxy
    // helper, which drops what it cannot serve from our own origin.
    return proxiedImageUrl(rawUrl);
  }
  const proxied = discordCdnProxyPath(u);
  if (proxied) return proxied;
  return proxiedImageUrl(rawUrl);
}

// Rewrites an external https image URL (imgur, giphy, any host an admin pastes
// into a Welcome/Goodbye/Level/embed field, the promo banner image, ...) into
// our own same-origin proxy, /api/img-proxy (app/api/img-proxy/route.js).
// Image hosts set third-party cookies on ANY direct browser request, so the
// browser must only ever talk to our own domain. This is display-only: the
// value saved in the database and the value the bot receives never change.
// Left untouched (returned exactly as given): empty values, relative paths
// (this also makes it safe to call twice on the same value), data:, blob:,
// plain http:, our own domain, and cdn.discordapp.com, which keeps using
// discordCdnUrl() and its own dedicated proxy above.
// Only deterministic inputs are used (no window), so server and client always
// render the same src and hydration never mismatches.
const OWN_IMAGE_HOSTS = ['wody.online', 'www.wody.online'];
let ownBaseHost = null;
try {
  if (process.env.NEXT_PUBLIC_BASE_URL) ownBaseHost = new URL(process.env.NEXT_PUBLIC_BASE_URL).hostname.toLowerCase();
} catch {
  ownBaseHost = null;
}

//
// Every external picture is served from our own origin, never by the
// visitor's browser directly:
//   - empty values, relative paths, data: and blob:    -> unchanged
//   - our own domain                                    -> unchanged
//   - cdn.discordapp.com avatars/icons                  -> /api/discord-cdn
//   - any other https URL (Discord attachments too)     -> /api/img-proxy
//   - plain http:// (and "//host/..." links)            -> upgraded to https
//                                                          and proxied, so the
//                                                          browser never makes
//                                                          the request itself
//   - anything else (ftp:, javascript:, broken URLs)    -> null (no image)
export function proxiedImageUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return rawUrl;
  const raw = rawUrl.trim();
  if (!raw) return rawUrl;
  if (raw.startsWith('/') && !raw.startsWith('//')) return raw;
  if (/^(data|blob):/i.test(raw)) return raw;
  // A relative path without a leading slash (no scheme, not "//host").
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

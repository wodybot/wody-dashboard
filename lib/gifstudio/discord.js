import { GIF_MAX_DISCORD_BYTES, GIF_PUBLIC_PATH } from './constants';

// Discord distribution. The GIF is served from one stable, permanent HTTPS address (no expiring links, no address changes).
// Discord decides how a link preview is drawn: the Components V2 media gallery used by the Wody message animates a GIF, while
// the classic og:image preview of a plain link may show only the first frame. The panel states this instead of promising it.
const SITE_URL = () => (process.env.NEXT_PUBLIC_BASE_URL || 'https://wody.online').replace(/\/$/, '');

export const publicUrl = (slug) => `${SITE_URL()}${GIF_PUBLIC_PATH}/${slug}.gif`;
export const fallbackUrl = (slug) => `${SITE_URL()}${GIF_PUBLIC_PATH}/${slug}.png`;

export function readiness(item, version) {
  const url = publicUrl(item.slug);
  const checks = [];
  const add = (id, ok, extra = {}) => checks.push({ id, ok: !!ok, ...extra });
  add('https', url.startsWith('https://'));
  add('stable_url', /^[a-z0-9-]+\.gif$/.test(url.split('/').pop()));
  add('has_version', !!version);
  if (version) {
    add('size', version.bytes <= GIF_MAX_DISCORD_BYTES, { bytes: version.bytes, max: GIF_MAX_DISCORD_BYTES });
    add('dimensions', version.width >= 300 && version.height >= 150, { width: version.width, height: version.height });
    add('animated', version.frames > 1, { frames: version.frames });
    add('duration', version.duration_ms >= 1500, { duration_ms: version.duration_ms });
  }
  return { ok: checks.every((c) => c.ok), checks, url, fallback: fallbackUrl(item.slug), limitation: 'og_image_first_frame' };
}

// Real check of the published address: Content-Type, size and cache headers as Discord would fetch them.
export async function liveCheck(item, fetchImpl = fetch) {
  const url = publicUrl(item.slug);
  try {
    const res = await fetchImpl(url, { method: 'GET', redirect: 'manual', signal: AbortSignal.timeout(8000), headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)' } });
    const type = res.headers.get('content-type') || '';
    const len = Number(res.headers.get('content-length') || 0);
    const buf = res.ok ? Buffer.from(await res.arrayBuffer()) : null;
    return {
      ok: res.ok && type.startsWith('image/gif') && !!buf && buf.toString('ascii', 0, 3) === 'GIF',
      status: res.status, content_type: type, bytes: buf ? buf.length : len, cache_control: res.headers.get('cache-control') || '', etag: !!res.headers.get('etag'), url,
    };
  } catch (e) {
    return { ok: false, status: 0, error: 'unreachable', url, detail: String(e?.name || 'error') };
  }
}

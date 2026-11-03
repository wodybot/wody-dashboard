export const SITE_IMAGE_PATH_RE = /^\/api\/site-image\/[a-f0-9]{24}$/;

/** '' (empty), a stored upload path, an https/http link, or null when the value is not a usable image reference. */
export function cleanImageRef(value, max = 2048) {
  const v = String(value ?? '').trim().slice(0, max);
  if (!v) return '';
  if (SITE_IMAGE_PATH_RE.test(v)) return v;
  try {
    const u = new URL(v);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : null;
  } catch {
    return null;
  }
}

export function absoluteImage(value, base) {
  const v = String(value || '');
  return v.startsWith('/') ? `${String(base || '').replace(/\/$/, '')}${v}` : v;
}


import { getDb } from '@/lib/mongo';
import { unstable_cache, revalidateTag } from 'next/cache';
import { publicImageUrl } from '@/lib/img-sign';
import { SITE_IMAGE_PATH_RE } from '@/lib/site-images';

export const COUNTDOWN_BANNER_COLLECTION = 'site_config';
export const COUNTDOWN_BANNER_ID = 'countdown_banner';
export const COUNTDOWN_BANNER_CACHE_TAG = 'countdown-banner-config';

export const COUNTDOWN_BANNER_DEFAULTS = Object.freeze({
  enabled: false,
  text: '',
  target_at: null,
  ended_text: '',
  background_url: '',
  background_dim: 45,
});

function cleanImageUrl(value) {
  const v = String(value || '').trim().slice(0, 2048);
  if (!v) return '';
  if (SITE_IMAGE_PATH_RE.test(v)) return v;
  try {
    const u = new URL(v);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : '';
  } catch {
    return '';
  }
}

function cleanDim(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.min(85, Math.round(n))) : COUNTDOWN_BANNER_DEFAULTS.background_dim;
}

const MAX_LEN = { text: 200, endedText: 100 };

function sanitize(doc) {
  if (!doc || typeof doc !== 'object') return { ...COUNTDOWN_BANNER_DEFAULTS };
  const targetDate = doc.target_at ? new Date(doc.target_at) : null;
  return {
    enabled: !!doc.enabled,
    text: String(doc.text || '').trim().slice(0, MAX_LEN.text),
    target_at: targetDate && !Number.isNaN(targetDate.getTime()) ? targetDate.toISOString() : null,
    ended_text: String(doc.ended_text || '').trim().slice(0, MAX_LEN.endedText),
    background_url: cleanImageUrl(doc.background_url),
    background_dim: doc.background_dim == null ? COUNTDOWN_BANNER_DEFAULTS.background_dim : cleanDim(doc.background_dim),
  };
}

export function parseCountdownBannerPatch(body) {
  if (!body || typeof body !== 'object') return { ok: false, error: 'invalid_body' };
  const patch = {};
  if ('enabled' in body) patch.enabled = !!body.enabled;
  if ('text' in body) patch.text = String(body.text || '').trim().slice(0, MAX_LEN.text);
  if ('ended_text' in body) patch.ended_text = String(body.ended_text || '').trim().slice(0, MAX_LEN.endedText);
  if ('background_url' in body) {
    const raw = String(body.background_url || '').trim();
    const url = cleanImageUrl(raw);
    if (raw && !url) return { ok: false, error: 'invalid_background_url' };
    patch.background_url = url;
  }
  if ('background_dim' in body) patch.background_dim = cleanDim(body.background_dim);
  if ('target_at' in body) {
    if (body.target_at === null) {
      patch.target_at = null;
    } else {
      const d = new Date(body.target_at);
      if (Number.isNaN(d.getTime())) return { ok: false, error: 'invalid_target_at' };
      patch.target_at = d.toISOString();
    }
  }
  if (Object.keys(patch).length === 0) return { ok: false, error: 'empty_patch' };
  return { ok: true, patch };
}

async function readCountdownBannerFromDb() {
  try {
    const db = await getDb();
    const doc = await db.collection(COUNTDOWN_BANNER_COLLECTION).findOne({ _id: COUNTDOWN_BANNER_ID });
    return sanitize(doc);
  } catch (e) {
    console.error('readCountdownBannerFromDb failed', e);
    throw e;
  }
}

const getCachedCountdownBanner = unstable_cache(
  readCountdownBannerFromDb,
  ['countdown-banner-config-v1'],
  { revalidate: 60, tags: [COUNTDOWN_BANNER_CACHE_TAG] },
);

export async function getCountdownBanner() {
  let config;
  try { config = await getCachedCountdownBanner(); } catch { return null; }
  if (!config.enabled || !config.text || !config.target_at) return null;
  const isOver = new Date(config.target_at).getTime() <= Date.now();
  if (isOver && !config.ended_text) return null;
  return withBackgroundSrc(config);
}

export function withBackgroundSrc(config) {
  if (!config) return config;
  return { ...config, background_src: publicImageUrl(config.background_url) };
}

export async function getCountdownBannerConfig() {
  return getCachedCountdownBanner();
}

export async function saveCountdownBannerPatch(patch, ownerId) {
  const db = await getDb();
  await db.collection(COUNTDOWN_BANNER_COLLECTION).updateOne(
    { _id: COUNTDOWN_BANNER_ID },
    {
      $set: { ...patch, updated_at: new Date(), updated_by: ownerId || null },
      $setOnInsert: { created_at: new Date() },
    },
    { upsert: true },
  );
  revalidateTag(COUNTDOWN_BANNER_CACHE_TAG);
  return readCountdownBannerFromDb();
}

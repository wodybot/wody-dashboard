

import { getDb } from '@/lib/mongo';
import { unstable_cache, revalidateTag } from 'next/cache';

export const PROMO_BANNER_CONFIG_COLLECTION = 'site_config';
export const PROMO_BANNER_CONFIG_ID = 'promo_banner';
export const PROMO_BANNER_CACHE_TAG = 'promo-banner-config';

export const PROMO_BANNER_DEFAULTS = Object.freeze({
  enabled: false,
  imageUrl: '',
  buttonText: '',
  buttonUrl: '',
});

import { SITE_IMAGE_PATH_RE } from '@/lib/site-images';

const MAX_TEXT_LEN = { imageUrl: 2048, buttonText: 60, buttonUrl: 2048 };

function isHttpUrl(value) {
  if (!value) return true;
  try {
    const u = new URL(value);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}

const isImageRef = (v) => SITE_IMAGE_PATH_RE.test(String(v || '')) || isHttpUrl(v);

function sanitize(doc) {
  if (!doc || typeof doc !== 'object') return { ...PROMO_BANNER_DEFAULTS };
  return {
    enabled: !!doc.enabled,
    imageUrl: isImageRef(doc.imageUrl) ? String(doc.imageUrl || '').slice(0, MAX_TEXT_LEN.imageUrl) : '',
    buttonText: String(doc.buttonText || '').slice(0, MAX_TEXT_LEN.buttonText),
    buttonUrl: isHttpUrl(doc.buttonUrl) ? String(doc.buttonUrl || '').slice(0, MAX_TEXT_LEN.buttonUrl) : '',
  };
}

export function parsePromoBannerPatch(body) {
  if (!body || typeof body !== 'object') return { ok: false, error: 'invalid_body' };
  const patch = {};
  if ('enabled' in body) patch.enabled = !!body.enabled;
  if ('imageUrl' in body) {
    const v = String(body.imageUrl || '').trim();
    if (v && !isImageRef(v)) return { ok: false, error: 'invalid_imageUrl' };
    patch.imageUrl = v.slice(0, MAX_TEXT_LEN.imageUrl);
  }
  if ('buttonText' in body) patch.buttonText = String(body.buttonText || '').trim().slice(0, MAX_TEXT_LEN.buttonText);
  if ('buttonUrl' in body) {
    const v = String(body.buttonUrl || '').trim();
    if (v && !isHttpUrl(v)) return { ok: false, error: 'invalid_buttonUrl' };
    patch.buttonUrl = v.slice(0, MAX_TEXT_LEN.buttonUrl);
  }
  if (Object.keys(patch).length === 0) return { ok: false, error: 'empty_patch' };
  return { ok: true, patch };
}

async function readPromoBannerFromDb() {
  try {
    const db = await getDb();
    const doc = await db.collection(PROMO_BANNER_CONFIG_COLLECTION).findOne({ _id: PROMO_BANNER_CONFIG_ID });
    return sanitize(doc);
  } catch (e) {
    console.error('readPromoBannerFromDb failed, defaulting', e);
    return { ...PROMO_BANNER_DEFAULTS };
  }
}

const getCachedPromoBanner = unstable_cache(
  readPromoBannerFromDb,
  ['promo-banner-config-v1'],
  { revalidate: 60, tags: [PROMO_BANNER_CACHE_TAG] },
);

export async function getPromoBanner() {
  const config = await getCachedPromoBanner();
  const ready = config.enabled && config.imageUrl && config.buttonUrl;
  return ready ? config : null;
}

export async function getPromoBannerConfig() {
  return getCachedPromoBanner();
}

export async function savePromoBannerPatch(patch, ownerId) {
  const db = await getDb();
  await db.collection(PROMO_BANNER_CONFIG_COLLECTION).updateOne(
    { _id: PROMO_BANNER_CONFIG_ID },
    {
      $set: { ...patch, updated_at: new Date(), updated_by: ownerId || null },
      $setOnInsert: { created_at: new Date() },
    },
    { upsert: true },
  );
  revalidateTag(PROMO_BANNER_CACHE_TAG);
  return readPromoBannerFromDb();
}

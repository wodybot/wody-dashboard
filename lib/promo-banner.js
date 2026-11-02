// FILE: promo-banner.js
// PUNE ÎN: lib/promo-banner.js
// (fișier nou în proiectul wody-dashboard-main la această cale)

// Server-only config for the promotional banner shown at the top of a
// server's dashboard Overview tab. Same site_config collection, same
// cached-read / tag-revalidate-on-save pattern as lib/autumn.js and
// lib/community-showcase.js: a single global document, editable from the
// owner panel with no redeploy, live immediately after saving.
//
// Everything about the banner is owner-controlled: whether it shows at
// all, its image, and the button's own text and destination URL. Nothing
// here is hardcoded copy, unlike most of the rest of the site's content
// (which lives in messages/<locale>.json), a promo banner is inherently
// a one-off, changes-whenever-the-owner-wants thing, not permanent UI
// text that needs translating into 9 languages.

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
  if (!value) return true; // empty is valid (means "not set")
  try {
    const u = new URL(value);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}

// The banner image is a link, or a picture uploaded in the owner panel (/api/site-image/<id>, same site, no cookies).
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

// Validates a partial update body from the owner panel. Returns
// { ok: true, patch } or { ok: false, error }.
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

// Cached read for the homepage. Revalidated on a 60s timer AND instantly
// on save via the cache tag, so normal traffic never hits Mongo for this
// while an owner-panel change still goes live immediately.
const getCachedPromoBanner = unstable_cache(
  readPromoBannerFromDb,
  ['promo-banner-config-v1'],
  { revalidate: 60, tags: [PROMO_BANNER_CACHE_TAG] },
);

// What a dashboard actually renders from: enabled AND has both an image
// and a link to send people to (a banner with neither would be either
// invisible or a dead click, so it's treated as "not ready yet" rather
// than shown broken). buttonText is deliberately NOT required here: a
// banner with no button text still renders, just as the image alone with
// the whole thing wrapped in the link instead of a separate button (see
// PromoBanner in components/promo-banner.jsx).
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

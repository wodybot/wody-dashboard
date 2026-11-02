// Config server-only pentru bara de countdown afisata sus pe tot site-ul
// (vezi components/countdown-banner.jsx si mount-ul din app/[locale]/layout.js).
// Acelasi tipar ca lib/promo-banner.js: un singur document in site_config,
// citire cache-uita cu revalidare pe tag, editabil din owner panel fara
// redeploy, vizibil imediat dupa salvare.
//
// target_at e un timestamp ISO absolut (nu o durata), calculat o singura
// data in momentul in care owner-ul apasa Save in panel (acum + zile/ore/
// minute/secunde introduse acolo). Fiind un timestamp fix, numaratoarea
// arata la fel pentru toti vizitatorii, indiferent de fusul lor orar, si
// nu se decaleaza intre reincarcari de pagina.

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
  // Text optional aratat dupa ce numaratoarea ajunge la zero. Gol inseamna
  // "ascunde bara automat cand se termina", nu "arata un mesaj gol".
  ended_text: '',
  // Imagine optionala de fundal, intinsa pe toata lungimea si latimea barei
  // (object-fit: cover), plus cat de mult e intunecata ca textul sa ramana lizibil.
  background_url: '',
  background_dim: 45,
});

function cleanImageUrl(value) {
  const v = String(value || '').trim().slice(0, 2048);
  if (!v) return '';
  if (SITE_IMAGE_PATH_RE.test(v)) return v;   // a picture uploaded in the owner panel
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

// Valideaza un body partial trimis din owner panel. Returneaza
// { ok: true, patch } sau { ok: false, error }.
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
  // target_at vine ca timestamp ISO deja calculat de client (acum + durata
  // introdusa in panel), null sterge numaratoarea curenta fara sa dezactiveze
  // toata bara (owner-ul poate lasa enabled true si seta un target nou mai
  // tarziu).
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
    // Do NOT return the defaults here: unstable_cache would keep that "disabled" answer for a minute and the
    // bar would vanish for every visitor after one hiccup. A thrown error is never cached.
    console.error('readCountdownBannerFromDb failed', e);
    throw e;
  }
}

const getCachedCountdownBanner = unstable_cache(
  readCountdownBannerFromDb,
  ['countdown-banner-config-v1'],
  { revalidate: 60, tags: [COUNTDOWN_BANNER_CACHE_TAG] },
);

// Ce randeaza efectiv bara: enabled, are un text si un target setat, si
// targetul nu a trecut deja (fara ended_text un target trecut nu se mai
// arata deloc, cu ended_text ramane vizibil ca mesaj de final pana owner-ul
// il opreste sau seteaza un target nou).
export async function getCountdownBanner() {
  let config;
  try { config = await getCachedCountdownBanner(); } catch { return null; }
  if (!config.enabled || !config.text || !config.target_at) return null;
  const isOver = new Date(config.target_at).getTime() <= Date.now();
  if (isOver && !config.ended_text) return null;
  return withBackgroundSrc(config);
}

// background_src: sursa same-origin semnata pe server (lib/img-sign.js) pe
// care o foloseste bara in browser, ca vizitatorul sa nu ceara niciodata
// imaginea direct de la hostul extern (imgur etc.), care ar seta cookie-uri.
// background_url ramane neschimbat, il editeaza owner panel-ul.
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

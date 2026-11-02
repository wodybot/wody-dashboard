// FILE: season-effects.js
// PUNE ÎN: lib/season-effects.js
// (fișier nou în proiectul wody-dashboard-main la această cale)

// Server-only helpers for the seasonal decorative effects (Autumn,
// Winter, Halloween), one at a time, picked from the owner panel.
//
// Single global config document (a site-wide skin, not a per-guild
// setting), same site_config collection, same getDb() connection as
// everything else, no new datastore.
//
// This REPLACES lib/autumn.js's config as the thing every page actually
// reads from now (see app/[locale]/layout.js), but that old file and its
// site_config document are deliberately left in place, untouched, rather
// than deleted or overwritten: see migrateFromLegacyAutumn() below, the
// one-time migration this file does the first time it's ever read, so a
// site that currently has Autumn Mode on does NOT go dark the moment this
// ships. Once migrated, this document is the only one read or written
// going forward; the old one just sits there as an inert historical
// record.
//
// Design goal (matches the old file): if the document doesn't exist yet
// and there's nothing to migrate, or Mongo is briefly unreachable, this
// defaults to fully OFF. A cold start or a DB hiccup must never silently
// turn decorative effects on.

import { getDb } from '@/lib/mongo';
import { unstable_cache, revalidateTag } from 'next/cache';
import { AUTUMN_CONFIG_COLLECTION, AUTUMN_CONFIG_ID } from '@/lib/autumn';

export const SEASON_CONFIG_COLLECTION = 'site_config';
export const SEASON_CONFIG_ID = 'season_effects';
export const SEASON_CACHE_TAG = 'season-effects-config';

export const SEASONS = Object.freeze(['autumn', 'winter', 'halloween']);

export const SEASON_DEFAULTS = Object.freeze({
  enabled: false,
  season: 'autumn',
  effects: Object.freeze({
    particles: true,
    shadows: true,
    animations: true,
  }),
  // Default is deliberately the lightest touch available, same product
  // decision the old Autumn-only config made.
  density: 'low',
  intensity: 'low',
});

const DENSITY_LEVELS = new Set(['low', 'medium', 'high']);
const INTENSITY_LEVELS = new Set(['low', 'medium', 'high']);
const SEASON_SET = new Set(SEASONS);

function sanitize(doc) {
  if (!doc || typeof doc !== 'object') return { ...SEASON_DEFAULTS, effects: { ...SEASON_DEFAULTS.effects } };
  const effectsIn = doc.effects && typeof doc.effects === 'object' ? doc.effects : {};
  return {
    enabled: doc.enabled === true,
    season: SEASON_SET.has(doc.season) ? doc.season : SEASON_DEFAULTS.season,
    effects: {
      particles: effectsIn.particles !== false,
      shadows: effectsIn.shadows !== false,
      animations: effectsIn.animations !== false,
    },
    density: DENSITY_LEVELS.has(doc.density) ? doc.density : SEASON_DEFAULTS.density,
    intensity: INTENSITY_LEVELS.has(doc.intensity) ? doc.intensity : SEASON_DEFAULTS.intensity,
  };
}

// Validates a partial update body from the owner panel. Returns
// { ok: true, patch } or { ok: false, error }. Never trusts field shape.
export function parseSeasonPatch(body) {
  if (!body || typeof body !== 'object') return { ok: false, error: 'invalid_body' };
  const patch = {};
  if ('enabled' in body) {
    if (typeof body.enabled !== 'boolean') return { ok: false, error: 'invalid_enabled' };
    patch.enabled = body.enabled;
  }
  if ('season' in body) {
    if (!SEASON_SET.has(body.season)) return { ok: false, error: 'invalid_season' };
    patch.season = body.season;
  }
  if ('effects' in body) {
    const e = body.effects;
    if (!e || typeof e !== 'object') return { ok: false, error: 'invalid_effects' };
    for (const key of ['particles', 'shadows', 'animations']) {
      if (key in e) {
        if (typeof e[key] !== 'boolean') return { ok: false, error: `invalid_effects_${key}` };
        patch[`effects.${key}`] = e[key];
      }
    }
  }
  if ('density' in body) {
    if (!DENSITY_LEVELS.has(body.density)) return { ok: false, error: 'invalid_density' };
    patch.density = body.density;
  }
  if ('intensity' in body) {
    if (!INTENSITY_LEVELS.has(body.intensity)) return { ok: false, error: 'invalid_intensity' };
    patch.intensity = body.intensity;
  }
  if (Object.keys(patch).length === 0) return { ok: false, error: 'empty_patch' };
  return { ok: true, patch };
}

// Runs once: if this new document has never been created, but the old
// Autumn-only document exists AND was enabled, carry those exact
// settings over as season: 'autumn' so nothing currently showing on the
// live site goes dark the moment this ships. Writes the new document so
// this only ever runs the one time; every read after that finds the new
// document already in place and skips straight past this.
async function migrateFromLegacyAutumn(db) {
  try {
    const legacy = await db.collection(AUTUMN_CONFIG_COLLECTION).findOne({ _id: AUTUMN_CONFIG_ID });
    if (!legacy?.enabled) return null;
    const migrated = {
      enabled: true,
      season: 'autumn',
      effects: {
        particles: legacy.effects?.leaves !== false,
        shadows: legacy.effects?.shadows !== false,
        animations: legacy.effects?.animations !== false,
      },
      density: DENSITY_LEVELS.has(legacy.density) ? legacy.density : SEASON_DEFAULTS.density,
      intensity: INTENSITY_LEVELS.has(legacy.intensity) ? legacy.intensity : SEASON_DEFAULTS.intensity,
      created_at: new Date(),
      updated_at: new Date(),
      updated_by: null,
      migrated_from_legacy_autumn: true,
    };
    await db.collection(SEASON_CONFIG_COLLECTION).updateOne(
      { _id: SEASON_CONFIG_ID },
      { $setOnInsert: migrated },
      { upsert: true },
    );
    return sanitize(migrated);
  } catch (e) {
    console.error('migrateFromLegacyAutumn failed, defaulting to OFF', e);
    return null;
  }
}

async function readSeasonConfigFromDb() {
  try {
    const db = await getDb();
    const doc = await db.collection(SEASON_CONFIG_COLLECTION).findOne({ _id: SEASON_CONFIG_ID });
    if (doc) return sanitize(doc);
    const migrated = await migrateFromLegacyAutumn(db);
    return migrated || { ...SEASON_DEFAULTS, effects: { ...SEASON_DEFAULTS.effects } };
  } catch (e) {
    console.error('readSeasonConfigFromDb failed, defaulting to OFF', e);
    return { ...SEASON_DEFAULTS, effects: { ...SEASON_DEFAULTS.effects } };
  }
}

// Cached read used by every page render (root layout) and the public GET
// endpoint. Revalidated on a 60s timer AND instantly on save via the
// cache tag, so the owner panel doesn't have to wait a minute to see its
// own change reflected, but normal page loads never hit Mongo.
const getCachedSeasonConfig = unstable_cache(
  readSeasonConfigFromDb,
  ['season-effects-config-v1'],
  { revalidate: 60, tags: [SEASON_CACHE_TAG] },
);

export async function getSeasonConfig() {
  return getCachedSeasonConfig();
}

export async function saveSeasonPatch(patch, ownerId) {
  const db = await getDb();
  await db.collection(SEASON_CONFIG_COLLECTION).updateOne(
    { _id: SEASON_CONFIG_ID },
    {
      $set: { ...patch, updated_at: new Date(), updated_by: ownerId || null },
      $setOnInsert: { created_at: new Date() },
    },
    { upsert: true },
  );
  revalidateTag(SEASON_CACHE_TAG);
  return readSeasonConfigFromDb();
}

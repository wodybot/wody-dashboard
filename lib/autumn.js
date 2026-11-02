// Server-only helpers for the "Autumn Mode" seasonal decorative effects.
//
// Single global config document (this is a site-wide skin, not a per-guild
// setting), stored in the same Mongo database as everything else, under the
// existing `getDb()` connection, no new datastore, no new admin system.
//
// Design goal (see AUTUMN_DEFAULTS): if the document doesn't exist yet, or
// Mongo is briefly unreachable, the feature defaults to fully OFF. A cold
// start or a DB hiccup must never silently turn decorative effects on.

import { getDb } from '@/lib/mongo';
import { unstable_cache, revalidateTag } from 'next/cache';

export const AUTUMN_CONFIG_COLLECTION = 'site_config';
export const AUTUMN_CONFIG_ID = 'autumn_effects';
export const AUTUMN_CACHE_TAG = 'autumn-config';

export const AUTUMN_DEFAULTS = Object.freeze({
  enabled: false,
  effects: Object.freeze({
    leaves: true,
    shadows: true,
    animations: true,
  }),
  // Default is deliberately the lightest touch available (see product
  // brief: "default-ul trebuie sa fie Low / Premium / Minimal").
  density: 'low',
  intensity: 'low',
});

const DENSITY_LEVELS = new Set(['low', 'medium', 'high']);
const INTENSITY_LEVELS = new Set(['low', 'medium', 'high']);

function sanitize(doc) {
  if (!doc || typeof doc !== 'object') return { ...AUTUMN_DEFAULTS, effects: { ...AUTUMN_DEFAULTS.effects } };
  const effectsIn = doc.effects && typeof doc.effects === 'object' ? doc.effects : {};
  return {
    enabled: doc.enabled === true,
    effects: {
      leaves: effectsIn.leaves !== false,
      shadows: effectsIn.shadows !== false,
      animations: effectsIn.animations !== false,
    },
    density: DENSITY_LEVELS.has(doc.density) ? doc.density : AUTUMN_DEFAULTS.density,
    intensity: INTENSITY_LEVELS.has(doc.intensity) ? doc.intensity : AUTUMN_DEFAULTS.intensity,
  };
}

// Validates a partial update body from the owner panel. Returns
// { ok: true, patch } or { ok: false, error }. Never trusts field shape.
export function parseAutumnPatch(body) {
  if (!body || typeof body !== 'object') return { ok: false, error: 'invalid_body' };
  const patch = {};
  if ('enabled' in body) {
    if (typeof body.enabled !== 'boolean') return { ok: false, error: 'invalid_enabled' };
    patch.enabled = body.enabled;
  }
  if ('effects' in body) {
    const e = body.effects;
    if (!e || typeof e !== 'object') return { ok: false, error: 'invalid_effects' };
    for (const key of ['leaves', 'shadows', 'animations']) {
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

async function readAutumnConfigFromDb() {
  try {
    const db = await getDb();
    const doc = await db.collection(AUTUMN_CONFIG_COLLECTION).findOne({ _id: AUTUMN_CONFIG_ID });
    return sanitize(doc);
  } catch (e) {
    console.error('readAutumnConfigFromDb failed, defaulting to OFF', e);
    return { ...AUTUMN_DEFAULTS, effects: { ...AUTUMN_DEFAULTS.effects } };
  }
}

// Cached read used by every page render (root layout) and the public GET
// endpoint. Revalidated on a 60s timer AND instantly on save via the
// 'autumn-config' tag, so the owner panel doesn't have to wait a minute to
// see its own change reflected, but normal page loads never hit Mongo.
const getCachedAutumnConfig = unstable_cache(
  readAutumnConfigFromDb,
  ['autumn-config-v1'],
  { revalidate: 60, tags: [AUTUMN_CACHE_TAG] },
);

export async function getAutumnConfig() {
  return getCachedAutumnConfig();
}

export async function saveAutumnPatch(patch, ownerId) {
  const db = await getDb();
  await db.collection(AUTUMN_CONFIG_COLLECTION).updateOne(
    { _id: AUTUMN_CONFIG_ID },
    {
      $set: { ...patch, updated_at: new Date(), updated_by: ownerId || null },
      $setOnInsert: { created_at: new Date() },
    },
    { upsert: true },
  );
  revalidateTag(AUTUMN_CACHE_TAG);
  return readAutumnConfigFromDb();
}

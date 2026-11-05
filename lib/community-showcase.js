

import { getDb } from '@/lib/mongo';
import { unstable_cache, revalidateTag } from 'next/cache';
import { getBotGuilds, guildIconUrl } from '@/lib/discord';

export const SHOWCASE_CONFIG_COLLECTION = 'site_config';
export const SHOWCASE_CONFIG_ID = 'community_showcase';
export const SHOWCASE_CACHE_TAG = 'community-showcase-config';

export const SHOWCASE_DEFAULTS = Object.freeze({
  minMembers: 5,
  maxDisplay: 28,
  excludedGuildIds: Object.freeze([]),
});

const MAX_EXCLUSIONS = 500;
const SNOWFLAKE_RE = /^\d{15,25}$/;

const MIN_MEMBERS_BOUNDS = { min: 0, max: 100_000 };
const MAX_DISPLAY_BOUNDS = { min: 4, max: 60 };

function clampInt(value, { min, max }) {
  const n = Math.trunc(Number(value));
  if (!Number.isFinite(n)) return null;
  return Math.min(max, Math.max(min, n));
}

function sanitize(doc) {
  if (!doc || typeof doc !== 'object') return { ...SHOWCASE_DEFAULTS, excludedGuildIds: [] };
  const minMembers = clampInt(doc.minMembers, MIN_MEMBERS_BOUNDS);
  const maxDisplay = clampInt(doc.maxDisplay, MAX_DISPLAY_BOUNDS);
  const excludedGuildIds = Array.isArray(doc.excludedGuildIds)
    ? [...new Set(doc.excludedGuildIds.map(String).filter((id) => SNOWFLAKE_RE.test(id)))].slice(0, MAX_EXCLUSIONS)
    : [];
  return {
    minMembers: minMembers ?? SHOWCASE_DEFAULTS.minMembers,
    maxDisplay: maxDisplay ?? SHOWCASE_DEFAULTS.maxDisplay,
    excludedGuildIds,
  };
}

export function parseShowcasePatch(body) {
  if (!body || typeof body !== 'object') return { ok: false, error: 'invalid_body' };
  const patch = {};
  if ('minMembers' in body) {
    const v = clampInt(body.minMembers, MIN_MEMBERS_BOUNDS);
    if (v === null) return { ok: false, error: 'invalid_minMembers' };
    patch.minMembers = v;
  }
  if ('maxDisplay' in body) {
    const v = clampInt(body.maxDisplay, MAX_DISPLAY_BOUNDS);
    if (v === null) return { ok: false, error: 'invalid_maxDisplay' };
    patch.maxDisplay = v;
  }
  if ('excludedGuildIds' in body) {
    if (!Array.isArray(body.excludedGuildIds)) return { ok: false, error: 'invalid_excludedGuildIds' };
    const ids = body.excludedGuildIds.map(String).map((s) => s.trim()).filter(Boolean);
    if (ids.some((id) => !SNOWFLAKE_RE.test(id))) return { ok: false, error: 'invalid_excludedGuildIds' };
    if (ids.length > MAX_EXCLUSIONS) return { ok: false, error: 'too_many_excludedGuildIds' };
    patch.excludedGuildIds = [...new Set(ids)];
  }
  if (Object.keys(patch).length === 0) return { ok: false, error: 'empty_patch' };
  return { ok: true, patch };
}

let lastGoodConfig = null;

async function readShowcaseConfigFromDb() {
  try {
    const db = await getDb();
    const doc = await db.collection(SHOWCASE_CONFIG_COLLECTION).findOne({ _id: SHOWCASE_CONFIG_ID });
    lastGoodConfig = sanitize(doc);
    return lastGoodConfig;
  } catch (e) {
    console.error('readShowcaseConfigFromDb failed', e);
    if (lastGoodConfig) return lastGoodConfig;
    throw e;
  }
}

const getCachedShowcaseConfig = unstable_cache(
  readShowcaseConfigFromDb,
  ['community-showcase-config-v1'],
  { revalidate: 60, tags: [SHOWCASE_CACHE_TAG] },
);

export async function getShowcaseConfig() {
  return getCachedShowcaseConfig();
}

export async function saveShowcasePatch(patch, ownerId) {
  const db = await getDb();
  await db.collection(SHOWCASE_CONFIG_COLLECTION).updateOne(
    { _id: SHOWCASE_CONFIG_ID },
    {
      $set: { ...patch, updated_at: new Date(), updated_by: ownerId || null },
      $setOnInsert: { created_at: new Date() },
    },
    { upsert: true },
  );
  revalidateTag(SHOWCASE_CACHE_TAG);
  return readShowcaseConfigFromDb();
}

function seededShuffle(items, seed) {
  let s = (seed >>> 0) || 1;
  const next = () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
  const arr = items.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export const SHOWCASE_ROTATE_MS = 20 * 60_000;

const getShowcaseGuildList = unstable_cache(
  async () => {
    const guilds = await getBotGuilds({ withCounts: true });
    return (Array.isArray(guilds) ? guilds : []).map((g) => ({
      id: String(g.id),
      name: g.name,
      icon: g.icon || null,
      approximate_member_count: g.approximate_member_count ?? null,
    }));
  },
  ['community-showcase-guilds-v1'],
  { revalidate: 300 },
);

export async function getShowcaseServers() {
  try {
    const [guilds, config] = await Promise.all([getShowcaseGuildList(), getShowcaseConfig()]);
    const excluded = new Set(config.excludedGuildIds || []);
    const qualifying = (Array.isArray(guilds) ? guilds : [])
      .filter((g) => (g?.approximate_member_count ?? 0) > config.minMembers)
      .filter((g) => !excluded.has(String(g.id)))
      .map((g) => ({
        id: g.id,
        name: g.name,
        member_count: g.approximate_member_count ?? null,
        icon_url: guildIconUrl(g),
      }));

    const seed = Math.floor(Date.now() / SHOWCASE_ROTATE_MS);
    return qualifying.length > config.maxDisplay
      ? seededShuffle(qualifying, seed).slice(0, config.maxDisplay)
      : seededShuffle(qualifying, seed);
  } catch (e) {
    console.error('getShowcaseServers failed', e);
    return [];
  }
}

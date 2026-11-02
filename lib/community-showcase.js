// FILE: community-showcase.js
// PUNE ÎN: lib/community-showcase.js
// (fișier nou în proiectul wody-dashboard-main la această cale)

// Server-only config for the "running in communities of every size"
// showcase strip on the landing page (components/community-showcase.jsx).
//
// Single global document, same site_config collection and exact same
// cached-read / tag-revalidate-on-save pattern as lib/autumn.js, so this
// never needs its own new datastore or admin system, and the owner panel
// change takes effect immediately (no redeploy, no waiting for a cache
// window) the same way Autumn Mode already does.
//
// What's configurable, and why these two specifically:
//   - minMembers: a server only qualifies for the showcase once it has
//     more than this many members (see status/showcase in route.js, which
//     is the thing that actually reads getBotGuilds()). Inclusion itself
//     is NOT something to configure here, any server the bot is in that
//     clears this bar is picked up automatically the next time the
//     showcase is read, nothing to opt in by hand.
//   - maxDisplay: how many servers are shown at once when more qualify
//     than that. route.js picks a random subset of this size and rotates
//     it periodically (see ROTATE_MS there) so it isn't always the same
//     handful of biggest servers.

import { getDb } from '@/lib/mongo';
import { unstable_cache, revalidateTag } from 'next/cache';
import { getBotGuilds, guildIconUrl } from '@/lib/discord';

export const SHOWCASE_CONFIG_COLLECTION = 'site_config';
export const SHOWCASE_CONFIG_ID = 'community_showcase';
export const SHOWCASE_CACHE_TAG = 'community-showcase-config';

export const SHOWCASE_DEFAULTS = Object.freeze({
  // Matches the original "peste 5 membri" request.
  minMembers: 5,
  // Matches the original "25-30 servere" request.
  maxDisplay: 28,
  // Guild IDs to always leave out, regardless of member count. Backs the
  // "contact us to be excluded" line in the Privacy Policy (see
  // messages/<locale>.json, privacy.sections), a server owner who asks
  // gets their guild ID added here from the owner panel and it stops
  // appearing on the next read (cache tag makes that immediate).
  excludedGuildIds: Object.freeze([]),
});

const MAX_EXCLUSIONS = 500;
const SNOWFLAKE_RE = /^\d{15,25}$/;

// Sane bounds so a fat-fingered owner-panel edit (or a malformed API call)
// can't zero out the whole strip or ask for an unbounded/huge marquee.
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

// Validates a partial update body from the owner panel. Returns
// { ok: true, patch } or { ok: false, error }. Never trusts field shape.
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

// Last configuration that was read successfully, kept in memory. If the database cannot be read for a moment, this
// is used instead of quietly falling back to "nothing is excluded", which used to put hidden servers back on the
// home page (and the owner panel then showed an empty list that a save would have written over the real one).
let lastGoodConfig = null;

async function readShowcaseConfigFromDb() {
  try {
    const db = await getDb();
    const doc = await db.collection(SHOWCASE_CONFIG_COLLECTION).findOne({ _id: SHOWCASE_CONFIG_ID });
    lastGoodConfig = sanitize(doc);
    return lastGoodConfig;
  } catch (e) {
    console.error('readShowcaseConfigFromDb failed', e);
    // Throwing (instead of returning defaults) also keeps the cache from storing a wrong answer.
    if (lastGoodConfig) return lastGoodConfig;
    throw e;
  }
}

// Cached read used by the public status/showcase endpoint. Revalidated on
// a 60s timer AND instantly on save via the cache tag, same tradeoff as
// Autumn: normal traffic never hits Mongo for this, but an owner-panel
// change is live immediately rather than waiting up to a minute.
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

// Deterministic PRNG (xorshift32), used only to pick and rotate the
// random subset of servers shown in the community showcase. Not
// cryptographic, doesn't need to be: it only needs to (a) be reproducible
// for the same seed within one rotation window, so every visitor hitting
// the page in that window sees the same set instead of a different random
// shuffle on every request, and (b) look random enough that the featured
// servers change window to window rather than always settling on the
// same handful of biggest ones.
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

// How often the featured subset rotates when there are more qualifying
// servers than fit on screen. 20 minutes: long enough that a visitor
// browsing the homepage, or the marquee looping a few times, never sees
// the set change under them, short enough that the same handful of
// servers isn't glued to the front page for hours.
export const SHOWCASE_ROTATE_MS = 20 * 60_000;

// The one function that actually builds the showcase list: real guilds
// the bot is in, filtered and rotated per the config above. Shared by
// both callers so the two can never drift apart:
//   - the homepage (app/[locale]/page.js, a Server Component) calls this
//     directly at render time, so the very first HTML sent to the browser
//     already has the real, rotated server list in it, no client-side
//     fetch, no blank/missing section while that fetch is in flight, the
//     strip is just there from the start.
//   - the public status/showcase API route calls it too, so the client
//     component's background refresh (it polls every 5 minutes to catch
//     a rotation window changing while the tab is left open) hits the
//     exact same logic as the initial server-rendered version.
// The bot's guild list (only the public fields the strip shows), cached in
// Next's shared data cache for a few minutes. getBotGuilds() alone only has
// a per-instance in-memory cache, so every cold server instance had to call
// Discord before the homepage could finish rendering; this way the list is
// shared between instances and refreshed in the background (stale while
// revalidate) instead of making a visitor wait for Discord.
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
    // Always shuffled, even when nothing needs trimming, so display order
    // isn't always biggest-member-count-first.
    return qualifying.length > config.maxDisplay
      ? seededShuffle(qualifying, seed).slice(0, config.maxDisplay)
      : seededShuffle(qualifying, seed);
  } catch (e) {
    console.error('getShowcaseServers failed', e);
    return [];
  }
}

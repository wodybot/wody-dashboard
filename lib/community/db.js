// Community Discovery: collections, indexes, seed data and the catalog cache.
// Collection names follow the bot/dashboard convention (snake_case, one prefix).
import { getDb } from '@/lib/mongo';
import {
  SEED_CATEGORIES, SEED_SUBCATEGORIES, SEED_TAGS, SEED_FEATURES, SEED_BADGES, DEFAULT_SETTINGS,
} from './constants.js';

export const C = {
  listings: 'community_listings',
  versions: 'community_versions',
  timeline: 'community_timeline',
  audit: 'community_audit',
  reviews: 'community_reviews',
  reports: 'community_reports',
  favorites: 'community_favorites',
  managers: 'community_managers',
  categories: 'community_categories',
  tags: 'community_tags',
  features: 'community_features',
  badges: 'community_badges',
  analytics: 'community_analytics',
  visits: 'community_visits',
  images: 'community_images',
  notifications: 'community_notifications',
  settings: 'community_settings',
  statsDaily: 'community_stats_daily',
};

let ready = null;

async function ensure(db) {
  const idx = (name, spec, opts) => db.collection(name).createIndex(spec, opts).catch((e) => console.error('community index', name, e?.message));
  await Promise.all([
    idx(C.listings, { guild_id: 1 }, { unique: true }),
    idx(C.listings, { slug: 1 }, { unique: true }),
    idx(C.listings, { name_key: 1, status: 1 }),
    idx(C.listings, { status: 1, 'pub.category': 1, 'pub.score': -1 }),
    idx(C.listings, { status: 1, published_at: -1 }),
    idx(C.listings, { status: 1, bumped_at: -1 }),
    idx(C.listings, { status: 1, 'stats.member_count': -1 }),
    idx(C.listings, { status: 1, 'stats.growth_7d': -1 }),
    // Discovery home sorts (recommended, popular, verified, featured) served straight from an index.
    idx(C.listings, { status: 1, 'pub.score': -1, published_at: -1 }),
    idx(C.listings, { status: 1, 'counters.uniques_30d': -1, 'counters.favorites': -1, 'pub.score': -1 }),
    idx(C.listings, { status: 1, badges: 1, 'pub.score': -1 }),
    idx(C.listings, { status: 1, 'featured.placement': 1, 'featured.end': 1 }),
    idx(C.listings, { status: 1, submitted_at: 1 }),
    idx(C.listings, { 'pub.tags': 1 }),
    idx(C.listings, { 'pub.languages': 1 }),
    idx(C.listings, { owner_id: 1 }),
    idx(C.versions, { listing_id: 1, version: -1 }),
    idx(C.timeline, { listing_id: 1, at: -1 }),
    idx(C.audit, { at: -1 }),
    idx(C.audit, { target: 1, at: -1 }),
    idx(C.reviews, { listing_id: 1, user_id: 1 }, { unique: true }),
    idx(C.reviews, { listing_id: 1, status: 1, created_at: -1 }),
    idx(C.reviews, { status: 1, created_at: -1 }),
    idx(C.reports, { status: 1, created_at: -1 }),
    idx(C.reports, { listing_id: 1, reporter_id: 1 }),
    idx(C.favorites, { user_id: 1, listing_id: 1 }, { unique: true }),
    idx(C.favorites, { user_id: 1, at: -1 }),
    idx(C.managers, { listing_id: 1, user_id: 1 }, { unique: true }),
    idx(C.managers, { user_id: 1 }),
    idx(C.categories, { slug: 1 }, { unique: true }),
    idx(C.tags, { slug: 1 }, { unique: true }),
    idx(C.features, { slug: 1 }, { unique: true }),
    idx(C.badges, { key: 1 }, { unique: true }),
    idx(C.analytics, { listing_id: 1, day: 1 }, { unique: true }),
    idx(C.analytics, { day: 1 }),
    // Visitor dedup keys hold only a salted daily hash and expire on their own.
    idx(C.visits, { k: 1 }, { unique: true }),
    idx(C.visits, { at: 1 }, { expireAfterSeconds: 2 * 24 * 3600 }),
    idx(C.images, { listing_id: 1 }),
    idx(C.notifications, { to: 1, created_at: -1 }),
    idx(C.notifications, { created_at: 1 }, { expireAfterSeconds: 90 * 24 * 3600 }),
    idx(C.statsDaily, { listing_id: 1, day: 1 }, { unique: true }),
  ]);
  // Seeds only fill empty collections, so admin edits are never overwritten.
  const now = new Date();
  if (!(await db.collection(C.categories).findOne({}))) {
    const rows = [];
    SEED_CATEGORIES.forEach((slug, i) => {
      rows.push({ slug, parent: null, order: i, enabled: true, names: {}, seo_slug: slug, created_at: now });
      (SEED_SUBCATEGORIES[slug] || []).forEach((sub, j) => rows.push({ slug: `${slug}.${sub}`, parent: slug, order: j, enabled: true, names: {}, seo_slug: `${slug}-${sub}`, created_at: now }));
    });
    await db.collection(C.categories).insertMany(rows, { ordered: false }).catch(() => {});
  }
  if (!(await db.collection(C.tags).findOne({}))) {
    await db.collection(C.tags).insertMany(SEED_TAGS.map((slug, i) => ({ slug, order: i, enabled: true, names: {}, created_at: now })), { ordered: false }).catch(() => {});
  }
  if (!(await db.collection(C.features).findOne({}))) {
    await db.collection(C.features).insertMany(SEED_FEATURES.map((slug, i) => ({ slug, order: i, enabled: true, names: {}, created_at: now })), { ordered: false }).catch(() => {});
  }
  if (!(await db.collection(C.badges).findOne({}))) {
    await db.collection(C.badges).insertMany(SEED_BADGES.map((b) => ({ ...b, names: {}, created_at: now })), { ordered: false }).catch(() => {});
  }
  if (!(await db.collection(C.settings).findOne({ _id: 'main' }))) {
    await db.collection(C.settings).insertOne({ _id: 'main', ...DEFAULT_SETTINGS, created_at: now }).catch(() => {});
  }
}

export async function cdb() {
  const db = await getDb();
  if (!ready) ready = ensure(db).catch((e) => { ready = null; console.error('community ensure failed', e); });
  await ready;
  await loadPrefix(db);
  return db;
}

// The public URL prefix is read from settings and cached for a short time so that
// cards and links can be built synchronously.
let prefixCache = { value: 'server', at: 0 };
export function currentPrefix() { return prefixCache.value; }
export async function loadPrefix(db) {
  if (Date.now() - prefixCache.at > 30_000) {
    const doc = await db.collection(C.settings).findOne({ _id: 'main' }, { projection: { url_prefix: 1 } });
    prefixCache = { value: doc?.url_prefix || 'server', at: Date.now() };
  }
  return prefixCache.value;
}

// ---- catalog (categories, tags, features, badges) with a short cache ----
let catalogCache = null;
export function resetCatalogCache() { catalogCache = null; prefixCache = { ...prefixCache, at: 0 }; }

export async function getCatalog(db, { includeDisabled = false } = {}) {
  if (!catalogCache || Date.now() - catalogCache.at > 30_000) {
    const [categories, tags, features, badges] = await Promise.all([
      db.collection(C.categories).find({}).sort({ order: 1 }).toArray(),
      db.collection(C.tags).find({}).sort({ order: 1 }).toArray(),
      db.collection(C.features).find({}).sort({ order: 1 }).toArray(),
      db.collection(C.badges).find({}).toArray(),
    ]);
    const clean = (r) => { const { _id, ...rest } = r; return { id: String(_id), ...rest }; };
    catalogCache = { at: Date.now(), categories: categories.map(clean), tags: tags.map(clean), features: features.map(clean), badges: badges.map(clean) };
  }
  const f = (rows) => (includeDisabled ? rows : rows.filter((r) => r.enabled !== false));
  return { categories: f(catalogCache.categories), tags: f(catalogCache.tags), features: f(catalogCache.features), badges: catalogCache.badges };
}

export function catalogSets(catalog) {
  const categories = new Set(catalog.categories.filter((c) => !c.parent).map((c) => c.slug));
  const subcategories = new Map();
  for (const c of catalog.categories) if (c.parent) {
    if (!subcategories.has(c.parent)) subcategories.set(c.parent, new Set());
    subcategories.get(c.parent).add(c.slug);
  }
  return { categories, subcategories, tags: new Set(catalog.tags.map((t) => t.slug)), features: new Set(catalog.features.map((f) => f.slug)) };
}

export async function getSettings(db) {
  const doc = await db.collection(C.settings).findOne({ _id: 'main' });
  const { _id, created_at, updated_at, ...rest } = doc || {};
  return { ...DEFAULT_SETTINGS, ...rest };
}

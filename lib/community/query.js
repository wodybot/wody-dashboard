import { C, getCatalog, currentPrefix } from './db.js';
import { PUBLIC_STATUS, MEMBER_BANDS } from './constants.js';

const esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const imgUrl = (id) => (id ? `/api/community/img/${id}` : null);

function memberLabelBand(band) {
  return {
    lt100: { $lt: 100 }, '100_1k': { $gte: 100, $lt: 1000 }, '1k_10k': { $gte: 1000, $lt: 10000 }, gt10k: { $gte: 10000 },
  }[band] || null;
}

function badgeList(listing, catalog) {
  const byKey = new Map(catalog.badges.map((b) => [b.key, b]));
  const keys = [...(listing.badges || [])];
  const f = listing.featured;
  if (f && new Date(f.start) <= new Date() && new Date(f.end) > new Date() && !keys.includes('featured')) keys.push('featured');
  return keys.map((k) => byKey.get(k)).filter(Boolean).map((b) => ({ key: b.key, color: b.color, icon: b.icon, names: b.names || {} }));
}

export function inviteAvailable(listing) {
  return Boolean(listing.live?.invite_code) && listing.invite_status !== 'invalid' && !listing.unavailable;
}

export function publicCard(listing, catalog) {
  const c = listing.live;
  const s = listing.stats || null;
  return {
    slug: listing.slug,
    path: `/${currentPrefix()}/${listing.slug}`,
    name: c.name,
    short_description: c.short_description,
    category: c.category,
    subcategory: c.subcategory || '',
    tags: c.tags || [],
    languages: c.languages || [],
    server_type: c.server_type,
    theme: c.theme ? { primary: c.theme.primary, accent: c.theme.accent } : null,
    banner: imgUrl(c.banner_id),
    icon: s?.icon_hash ? `/api/community/icon/${listing.slug}` : null,
    badges: badgeList(listing, catalog),
    verified: (listing.badges || []).includes('verified'),
    members: s?.member_count ?? null,
    online: s?.online_count ?? null,
    stats_available: Boolean(s && s.member_count != null),
    bumps: listing.bump_total || 0,
    bumped_at: listing.bumped_at || null,
    rating: listing.counters?.reviews ? Math.round((listing.counters.rating_sum / listing.counters.reviews) * 10) / 10 : null,
    reviews: listing.counters?.reviews || 0,
    invite: inviteAvailable(listing),
    updated_at: listing.updated_at,
  };
}

const CARD_PROJECTION = { slug: 1, live: 1, stats: 1, badges: 1, featured: 1, counters: 1, invite_status: 1, unavailable: 1, updated_at: 1, status: 1, bumped_at: 1, bump_total: 1 };

function buildFilter(p) {
  const f = { status: PUBLIC_STATUS };
  if (p.category) f['pub.category'] = p.category;
  if (p.subcategory) f['pub.subcategory'] = p.subcategory;
  if (p.tags?.length) f['pub.tags'] = { $all: p.tags };
  if (p.languages?.length) f['pub.languages'] = { $in: p.languages };
  if (p.server_type) f['pub.server_type'] = p.server_type;
  if (p.features?.length) f['pub.features'] = { $all: p.features };
  if (p.badge) f.badges = p.badge;
  const band = memberLabelBand(p.members);
  if (band) f['stats.member_count'] = band;
  if (p.activity === 'active') f['stats.online_count'] = { $gte: 25 };
  if (p.activity === 'very_active') f['stats.online_count'] = { $gte: 250 };
  const terms = String(p.q || '').toLowerCase().split(/\s+/).filter(Boolean).slice(0, 6);
  if (terms.length) f.$and = terms.map((t) => ({ 'pub.search_text': { $regex: esc(t.slice(0, 40)) } }));
  return f;
}

const SORT_MAP = {
  recommended: { 'pub.score': -1, published_at: -1 },
  popular: { 'counters.uniques_30d': -1, 'counters.favorites': -1, 'pub.score': -1 },
  newest: { published_at: -1 },
  members: { 'stats.member_count': -1 },
  growing: { 'stats.growth_7d': -1, 'pub.score': -1 },
  updated: { updated_at: -1 },
  bumped: { bumped_at: -1 },
};

export async function searchListings(db, params = {}) {
  const catalog = await getCatalog(db);
  const size = Math.max(6, Math.min(48, Number(params.size) || 24));
  const page = Math.max(0, Number(params.page) || 0);
  const filter = buildFilter(params);
  if (params.sort === 'bumped') filter.bumped_at = { $ne: null };
  const sort = SORT_MAP[params.sort] || SORT_MAP.recommended;
  const [total, rows] = await Promise.all([
    db.collection(C.listings).countDocuments(filter),
    db.collection(C.listings).find(filter, { projection: CARD_PROJECTION }).sort({ ...sort, _id: 1 }).skip(page * size).limit(size).toArray(),
  ]);
  return { total, page, size, pages: Math.max(1, Math.ceil(total / size)), items: rows.map((r) => publicCard(r, catalog)) };
}

export async function featuredListings(db, placement = 'home', limit = 8, categorySlug = null) {
  const catalog = await getCatalog(db);
  const now = new Date();
  const filter = { status: PUBLIC_STATUS, 'featured.start': { $lte: now }, 'featured.end': { $gt: now }, 'featured.placement': placement };
  if (categorySlug) filter['pub.category'] = categorySlug;
  const rows = await db.collection(C.listings).find(filter, { projection: CARD_PROJECTION }).sort({ 'featured.priority': -1, 'pub.score': -1 }).limit(limit).toArray();
  return rows.map((r) => publicCard(r, catalog));
}

const HOME_TTL = 30_000;
const SEARCH_TTL = 30_000;
const STALE_MAX = 10 * 60_000;
let homeCache = null;
let homeInflight = null;
const searchCache = new Map();
const searchInflight = new Map();
export function clearDiscoveryCache() { homeCache = null; searchCache.clear(); }

function refreshHome(db) {
  if (!homeInflight) {
    homeInflight = discoveryHomeUncached(db)
      .then((value) => { homeCache = { at: Date.now(), value }; return value; })
      .finally(() => { homeInflight = null; });
  }
  return homeInflight;
}

export async function discoveryHome(db) {
  const age = homeCache ? Date.now() - homeCache.at : Infinity;
  if (age < HOME_TTL) return homeCache.value;
  if (age < STALE_MAX) { refreshHome(db).catch(() => {}); return homeCache.value; }
  return refreshHome(db);
}

function refreshSearch(db, key, params) {
  let p = searchInflight.get(key);
  if (!p) {
    p = searchListings(db, params)
      .then((value) => { if (searchCache.size > 300) searchCache.clear(); searchCache.set(key, { at: Date.now(), value }); return value; })
      .finally(() => { searchInflight.delete(key); });
    searchInflight.set(key, p);
  }
  return p;
}

export async function cachedSearchListings(db, params = {}) {
  const key = JSON.stringify(params);
  const hit = searchCache.get(key);
  const age = hit ? Date.now() - hit.at : Infinity;
  if (age < SEARCH_TTL) return hit.value;
  if (age < STALE_MAX) { refreshSearch(db, key, params).catch(() => {}); return hit.value; }
  return refreshSearch(db, key, params);
}

async function discoveryHomeUncached(db) {
  const catalog = await getCatalog(db);
  const base = { status: PUBLIC_STATUS };
  const take = (filter, sort, n = 8) => db.collection(C.listings).find(filter, { projection: CARD_PROJECTION }).sort(sort).limit(n).toArray();
  const recent = new Date(Date.now() - 7 * 86_400_000);
  const [featured, bumped, popular, growing, fresh, recommended, verified, counts] = await Promise.all([
    featuredListings(db, 'home', 8),
    take({ ...base, bumped_at: { $gte: recent } }, SORT_MAP.bumped),
    take(base, SORT_MAP.popular),
    take({ ...base, 'stats.growth_7d': { $gt: 0 } }, SORT_MAP.growing),
    take(base, SORT_MAP.newest),
    take(base, SORT_MAP.recommended),
    take({ ...base, badges: 'verified' }, SORT_MAP.recommended),
    db.collection(C.listings).aggregate([{ $match: base }, { $group: { _id: '$pub.category', n: { $sum: 1 } } }]).toArray(),
  ]);
  const cards = (rows) => rows.map((r) => publicCard(r, catalog));
  return {
    featured, bumped: cards(bumped), popular: cards(popular), growing: cards(growing), fresh: cards(fresh), recommended: cards(recommended), verified: cards(verified),
    categories: catalog.categories.filter((c) => !c.parent).map((c) => ({ ...c, count: counts.find((x) => x._id === c.slug)?.n || 0 })),
  };
}

let extrasCache = new Map();
async function guildExtras(db, listing) {
  const key = String(listing._id);
  const hit = extrasCache.get(key);
  if (hit && Date.now() - hit.at < 5 * 60_000) return hit.v;
  const now = new Date();
  const [events, ach] = await Promise.all([
    db.collection('economy_events').find({ guild_id: listing.guild_id, active: true, ends_at: { $gt: now }, starts_at: { $lte: now } }, { projection: { type: 1, multiplier: 1, ends_at: 1 } }).limit(6).toArray(),
    db.collection('economy_achievements').aggregate([{ $match: { guild_id: listing.guild_id } }, { $group: { _id: null, unlocked: { $sum: 1 }, players: { $addToSet: '$user_id' } } }, { $project: { unlocked: 1, players: { $size: '$players' } } }]).toArray(),
  ]).catch(() => [[], []]);
  const v = {
    events: events.map((e) => ({ type: e.type, multiplier: e.multiplier, ends_at: e.ends_at })),
    achievements: ach[0] ? { unlocked: ach[0].unlocked, players: ach[0].players } : null,
  };
  extrasCache.set(key, { at: Date.now(), v });
  if (extrasCache.size > 500) extrasCache = new Map([...extrasCache].slice(-250));
  return v;
}

export async function getProfile(db, slug) {
  const clean = String(slug || '').toLowerCase().slice(0, 64);
  let listing = await db.collection(C.listings).findOne({ slug: clean });
  let redirect = null;
  if (!listing) {
    const old = await db.collection(C.listings).findOne({ slug_history: clean }, { projection: { slug: 1, status: 1 } });
    if (old && old.status === PUBLIC_STATUS) redirect = old.slug;
    return { listing: null, redirect };
  }
  if (listing.status !== PUBLIC_STATUS || !listing.live) return { listing: null, redirect: null };
  const catalog = await getCatalog(db);
  const c = listing.live;
  const s = listing.stats || null;
  const extras = await guildExtras(db, listing);
  const sections = c.sections || [];
  const enabled = (key) => sections.find((x) => x.key === key)?.enabled;
  const reviewSummary = listing.counters?.reviews ? { average: Math.round((listing.counters.rating_sum / listing.counters.reviews) * 10) / 10, count: listing.counters.reviews } : { average: null, count: 0 };
  const profile = {
    ...publicCard(listing, catalog),
    description: c.description,
    theme: c.theme,
    background: imgUrl(c.background_id),
    features: c.features || [],
    socials: c.socials || {},
    sections,
    staff: enabled('staff') ? (c.staff_roles || []).map((r) => ({ name: r.name, color: r.color })) : [],
    stats: s ? {
      members: s.member_count ?? null, online: s.online_count ?? null, voice: s.voice_count ?? null, boosts: s.boosts ?? null,
      created_at: s.created_at ?? null, fetched_at: s.fetched_at ?? null,
    } : null,
    events: enabled('events') ? extras.events : [],
    achievements: enabled('achievements') ? extras.achievements : null,
    review_summary: reviewSummary,
    reviews_enabled: true,
    published_at: listing.published_at,
  };
  return { listing: profile, redirect: null, raw: { id: listing._id, guild_id: listing.guild_id, category: c.category, tags: c.tags || [] } };
}

export async function similarListings(db, raw, limit = 6) {
  const catalog = await getCatalog(db);
  const rows = await db.collection(C.listings).find(
    { status: PUBLIC_STATUS, _id: { $ne: raw.id }, $or: [{ 'pub.category': raw.category }, { 'pub.tags': { $in: raw.tags } }] },
    { projection: { ...CARD_PROJECTION, pub: 1 } },
  ).sort({ 'pub.score': -1 }).limit(60).toArray();
  const scored = rows.map((r) => ({
    r, score: (r.pub.category === raw.category ? 3 : 0) + (r.pub.tags || []).filter((t) => raw.tags.includes(t)).length * 2 + Math.min(2, (r.pub.score || 0) / 100),
  }));
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((x) => publicCard(x.r, catalog));
}

export async function sitemapEntries(db, limit = 5000) {
  return db.collection(C.listings).find({ status: PUBLIC_STATUS }, { projection: { slug: 1, updated_at: 1 } }).limit(limit).toArray();
}

export { MEMBER_BANDS };

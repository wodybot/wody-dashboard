import crypto from 'crypto';
import { M, getCategories } from './db.js';
import { LIMITS } from './constants.js';
import { publicFilter, oid, sweepExpired } from './lifecycle.js';

const PAGE = LIMITS.pageSize;
const CARD_PROJ = { card: 1, category: 1, tags: 1, language: 1, published_at: 1, updated_live_at: 1, expires_at: 1, app_count: 1 };

export function publicCard(r) {
  return {
    id: String(r._id), title: r.card?.title || '', summary: r.card?.summary || '', category: r.category, tags: (r.tags || []).slice(0, 6), language: r.language || 'en',
    deadline: r.card?.deadline || null, published_at: r.published_at?.toISOString?.() || null, updated_at: r.updated_live_at?.toISOString?.() || null, applications: r.app_count || 0,
  };
}

const encCursor = (r) => `${r.published_at.getTime()}_${r._id}`;
function decCursor(c) {
  const m = /^(\d{10,14})_([a-f0-9]{24})$/.exec(String(c || ''));
  return m ? { at: new Date(Number(m[1])), id: oid(m[2]) } : null;
}

export async function recent(db, { category = '', cursor = '', limit = PAGE } = {}) {
  await sweepExpired(db);
  const q = publicFilter();
  if (category) q.category = category;
  const cur = decCursor(cursor);
  if (cur) q.$or = [{ published_at: { $lt: cur.at } }, { published_at: cur.at, _id: { $lt: cur.id } }];
  const rows = await db.collection(M.requests).find(q, { projection: CARD_PROJ }).sort({ published_at: -1, _id: -1 }).limit(Math.min(limit, PAGE) + 1).toArray();
  const more = rows.length > Math.min(limit, PAGE);
  const page = more ? rows.slice(0, -1) : rows;
  return { items: page.map(publicCard), next: more ? encCursor(page[page.length - 1]) : null };
}

export async function recentlyUpdated(db, { category = '', limit = PAGE } = {}) {
  const q = publicFilter();
  q.$expr = { $gt: ['$updated_live_at', '$published_at'] };
  if (category) q.category = category;
  const rows = await db.collection(M.requests).find(q, { projection: CARD_PROJ }).sort({ updated_live_at: -1, _id: -1 }).limit(limit).toArray();
  return { items: rows.map(publicCard), next: null };
}

function seedToUnit(seed) {
  const h = crypto.createHash('sha256').update(String(seed || Math.random())).digest();
  return h.readUInt32BE(0) / 0xffffffff;
}
function shuffleSeeded(arr, seed) {
  let s = Math.floor(seedToUnit(seed) * 2 ** 31) || 1;
  const rnd = () => { s = (s * 48271) % 2147483647; return s / 2147483647; };
  for (let i = arr.length - 1; i > 0; i -= 1) { const j = Math.floor(rnd() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
  return arr;
}

export async function discover(db, { seed = '', category = '', seen = [], limit = PAGE } = {}) {
  const base = publicFilter();
  if (category) base.category = category;
  const excl = seen.map(oid).filter(Boolean).slice(0, 300);
  const start = seedToUnit(seed);
  const pool = [];
  const pull = async (cond, n) => db.collection(M.requests).find({ ...base, ...(excl.length ? { _id: { $nin: excl } } : {}), ...cond }, { projection: CARD_PROJ }).sort({ random_key: 1 }).limit(n).toArray();
  pool.push(...await pull({ random_key: { $gte: start } }, 120));
  if (pool.length < 120) pool.push(...(await pull({ random_key: { $lt: start } }, 120 - pool.length)));
  shuffleSeeded(pool, seed);
  const byCat = new Map();
  for (const r of pool) { if (!byCat.has(r.category)) byCat.set(r.category, []); byCat.get(r.category).push(r); }
  const out = [];
  const lists = [...byCat.values()];
  while (out.length < limit && lists.some((l) => l.length)) for (const l of lists) { if (l.length && out.length < limit) out.push(l.shift()); }
  let recycled = false;
  if (out.length < limit && excl.length) {
    recycled = true;
    const have = new Set(out.map((r) => String(r._id)));
    const again = await db.collection(M.requests).find(base, { projection: CARD_PROJ }).sort({ random_key: 1 }).limit(120).toArray();
    shuffleSeeded(again, seed);
    for (const r of again) { if (out.length >= limit) break; if (!have.has(String(r._id))) out.push(r); }
  }
  return { items: out.map(publicCard), next: null, recycled };
}

export async function forYou(db, userId, { category = '', limit = PAGE } = {}) {
  const prof = userId ? await db.collection(M.profiles).findOne({ user_id: String(userId) }) : null;
  const cats = (prof?.pref_categories || []).slice(0, 10);
  const tags = (prof?.pref_tags || []).slice(0, 20);
  if (cats.length || tags.length) {
    const q = publicFilter();
    const or = [];
    if (cats.length) or.push({ category: { $in: cats } });
    if (tags.length) or.push({ tags: { $in: tags } });
    q.$or = or;
    if (category) q.category = category;
    if (userId) q.author_id = { $ne: String(userId) };
    const rows = await db.collection(M.requests).find(q, { projection: CARD_PROJ }).sort({ published_at: -1, _id: -1 }).limit(limit).toArray();
    if (rows.length) return { items: rows.map(publicCard), next: null, personalised: true };
  }
  const r = await recent(db, { category, limit });
  return { ...r, personalised: false };
}

export async function categoryStats(db) {
  const cats = await getCategories(db);
  const counts = await db.collection(M.requests).aggregate([
    { $match: publicFilter() }, { $group: { _id: '$category', n: { $sum: 1 } } },
  ]).toArray();
  const byCat = new Map(counts.map((c) => [c._id, c.n]));
  const since = new Date(Date.now() - 30 * 86_400_000);
  const apps = await db.collection(M.applications).aggregate([
    { $match: { created_at: { $gte: since } } }, { $group: { _id: '$category', n: { $sum: 1 } } },
  ]).toArray();
  const appBy = new Map(apps.map((c) => [c._id, c.n]));
  const list = cats.map((c) => ({ slug: c.slug, icon: c.icon, names: c.names, count: byCat.get(c.slug) || 0, applications_30d: appBy.get(c.slug) || 0 }));
  const popular = list.filter((c) => c.count > 0 && c.applications_30d > 0).sort((a, b) => b.applications_30d - a.applications_30d || b.count - a.count).slice(0, 8);
  return { categories: list, popular };
}

export async function publicRequest(db, id) {
  const _id = oid(id); if (!_id) return null;
  await sweepExpired(db);
  const r = await db.collection(M.requests).findOne({ _id, ...publicFilter() });
  if (!r) return null;
  const c = r.live;
  return {
    id: String(r._id), title: c.title, description: c.description, outcome: c.outcome, requirements: c.requirements, category: c.category, tags: c.tags, links: c.links, language: c.language,
    deadline: c.deadline, questions: c.questions, attachments: c.attachments, public_contact: Boolean(c.public_contact) , published_at: r.published_at.toISOString(), updated_at: r.updated_live_at.toISOString(),
    expires_at: r.expires_at.toISOString(), applications: r.app_count || 0, author: { name: r.author?.name || 'User', avatar: r.author?.avatar ? `https://cdn.discordapp.com/avatars/${r.author.id}/${r.author.avatar}.png?size=64` : null },
    origin_guild_name: r.origin_guild_name || null,
  };
}

export async function homeSections(db, { userId = null, category = '', seed = '' } = {}) {
  const [fy, rc, ds, up, stats] = await Promise.all([
    forYou(db, userId, { category }), recent(db, { category }), discover(db, { seed, category }), recentlyUpdated(db, { category }), categoryStats(db),
  ]);
  return { for_you: fy, recent: rc, discover: ds, updated: up, categories: stats.categories, popular: stats.popular, seed };
}

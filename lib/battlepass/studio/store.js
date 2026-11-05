import { toLong } from '@/lib/mongo';
import { COLL } from '../constants.js';
import { oid } from '../store.js';
import { effectiveStatus } from '../priority.js';
import { PAGE_COLL, LIMITS, RESERVED_SLUGS, SLUG_RE } from './constants.js';
import { defaultConfig, normalizeConfig } from './schema.js';

let indexed = false;
export async function ensureIndexes(db) {
  if (indexed) return;
  indexed = true;
  try {
    await Promise.all([
      db.collection(PAGE_COLL).createIndex({ season_id: 1 }, { unique: true }),
      db.collection(PAGE_COLL).createIndex({ slug: 1 }, { unique: true }),
    ]);
  } catch (e) { console.error('[bp-studio] indexes', e?.message || e); }
}

const hist = (actor, action, detail = '') => ({ at: new Date(), by: actor?.id || null, by_name: actor?.name || null, action, detail: String(detail).slice(0, 200) });
export { hist };

/** A season can get a public page only when it really has something to show: a name, levels and rewards, and it is not a draft. */
export function seasonReadiness(season, now = new Date()) {
  const status = effectiveStatus(season, now);
  const checks = [
    { id: 'named', ok: Boolean(String(season?.name || '').trim()) },
    { id: 'levels', ok: (season?.levels || []).length >= 1 },
    { id: 'rewards', ok: (season?.rewards || []).length >= 1 },
    { id: 'not_draft', ok: status !== 'draft' },
  ];
  return { ok: checks.every((c) => c.ok), checks, status };
}

export function slugFromName(name) {
  const s = String(name || 'season').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'season';
  return s.length >= 3 ? s : `${s}-pass`;
}

async function freeSlug(db, base) {
  let slug = RESERVED_SLUGS.includes(base) ? `${base}-pass` : base;
  for (let i = 0; i < 20; i += 1) {
    const cand = i === 0 ? slug : `${slug}-${i + 1}`;
    if (SLUG_RE.test(cand) && !(await db.collection(PAGE_COLL).findOne({ slug: cand }))) return cand;
  }
  return `${slug}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Creates the draft page of a season when it has none (idempotent: season_id is unique, so two calls never make two pages). */
export async function ensurePage(db, season, actor = null) {
  await ensureIndexes(db);
  const sid = String(season._id);
  const existing = await db.collection(PAGE_COLL).findOne({ season_id: sid });
  if (existing) return existing;
  const cfg = defaultConfig();
  const fromSeason = normalizeConfig({ theme: season.page && typeof season.page === 'object' ? season.page : {} }, cfg);
  const config = fromSeason.ok ? fromSeason.config : cfg;
  const now = new Date();
  const doc = {
    season_id: sid, scope: season.scope, guild_id: season.guild_id === undefined || season.guild_id === null ? null : toLong(season.guild_id),
    slug: await freeSlug(db, slugFromName(season.name)), status: 'draft', draft: config, published: null, published_version: 0,
    versions: [], schedule_at: null, history: [hist(actor, 'create')], created_at: now, updated_at: now,
  };
  // upsert on season_id: concurrent calls converge on one document (the unique index is the second guard)
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await db.collection(PAGE_COLL).updateOne({ season_id: sid }, { $setOnInsert: doc }, { upsert: true });
      break;
    } catch (e) {
      if (e?.code !== 11000) throw e;
      if (await db.collection(PAGE_COLL).findOne({ season_id: sid })) break;
      doc.slug = `${doc.slug.slice(0, 50)}-${Math.random().toString(36).slice(2, 7)}`; // another season took the slug in the meantime
    }
  }
  return db.collection(PAGE_COLL).findOne({ season_id: sid });
}

export async function getPage(db, sid) { return db.collection(PAGE_COLL).findOne({ season_id: String(sid) }); }
export async function getSeason(db, sid) { const _id = oid(sid); return _id ? db.collection(COLL.seasons).findOne({ _id }) : null; }

export async function updatePage(db, sid, set, actor, action, detail) {
  const upd = { $set: { ...set, updated_at: new Date() } };
  if (action) upd.$push = { history: { $each: [hist(actor, action, detail)], $slice: -LIMITS.history } };
  const r = await db.collection(PAGE_COLL).findOneAndUpdate({ season_id: String(sid) }, upd, { returnDocument: 'after' });
  return r?.value ?? r;
}

const iso = (d) => (d ? new Date(d).toISOString() : null);
export function pageView(doc, season = null) {
  if (!doc) return null;
  return {
    season_id: doc.season_id, scope: doc.scope, guild_id: doc.guild_id === null || doc.guild_id === undefined ? null : String(doc.guild_id),
    slug: doc.slug, status: doc.status, draft: doc.draft, published: doc.published, published_version: doc.published_version || 0,
    versions: (doc.versions || []).map((v) => ({ v: v.v, at: iso(v.at), by: v.by_name || null, note: v.note || '' })).sort((a, b) => b.v - a.v),
    schedule_at: iso(doc.schedule_at), error: doc.error || null,
    history: (doc.history || []).slice(-30).reverse().map((h) => ({ at: iso(h.at), by: h.by_name, action: h.action, detail: h.detail || '' })),
    updated_at: iso(doc.updated_at), published_at: iso(doc.published_at), path: doc.status === 'published' || doc.status === 'scheduled' ? `/battlepass/${doc.slug}` : null,
    season: season ? { id: String(season._id), name: season.name, scope: season.scope, status: effectiveStatus(season, new Date()), level_count: (season.levels || []).length, rewards_count: (season.rewards || []).length, quests_count: (season.quests || []).length, guild_id: season.guild_id ? String(season.guild_id) : null } : null,
  };
}

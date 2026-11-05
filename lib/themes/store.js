// Storage and lookups for Dynamic Themes. Large files never live here: an asset record keeps only the reference to the stored image.
import { toLong } from '@/lib/mongo';
import { THEME_COLL, ASSET_COLL, GUILD_COLL, AUDIT_COLL, LIMITS, OFFICIAL_IDS, LEGACY_THEMES } from './constants.js';
import { OFFICIAL, officialConfig } from './official.js';
import { normalizeThemeConfig, publishIssues } from './schema.js';
import { buildRenderTheme } from './render.js';

const clone = (v) => JSON.parse(JSON.stringify(v));
const iso = (d) => (d ? new Date(d).toISOString() : null);

let indexed = false;
export async function ensureIndexes(db) {
  if (indexed) return;
  try {
    await db.collection(THEME_COLL).createIndex({ id: 1 }, { unique: true });
    await db.collection(GUILD_COLL).createIndex({ guild_id: 1 }, { unique: true });
    await db.collection(AUDIT_COLL).createIndex({ at: -1 });
    await db.collection(ASSET_COLL).createIndex({ created_at: -1 });
    indexed = true;
  } catch { /* the indexes are a guard, not a requirement */ }
}
export const resetIndexCache = () => { indexed = false; seededAt = new WeakMap(); };

export async function audit(db, actor, action, theme, result = 'ok', detail = '') {
  try {
    await db.collection(AUDIT_COLL).insertOne({
      at: new Date(), actor_id: String(actor?.id || ''), actor_name: String(actor?.name || '').slice(0, 60), action, theme: String(theme || '').slice(0, 60),
      result, detail: String(detail || '').replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, 200),
    });
  } catch { /* an audit write must never break the action it records */ }
}

// ---------------------------------------------------------------------------------------------- themes
/** The official themes exist from the start, complete and published. A theme the Owner already edited keeps its edits. */
let seededAt = new WeakMap();     // the official themes are checked at most every 5 minutes per database connection

/** Earlier official themes are removed and the servers that used them move to the closest new one (their own colours are kept). */
async function retireLegacy(db) {
  for (const [oldId, newId] of Object.entries(LEGACY_THEMES)) {
    try {
      await db.collection(THEME_COLL).deleteMany({ id: oldId });
      await db.collection(GUILD_COLL).updateMany({ 'draft.theme_id': oldId }, { $set: { 'draft.theme_id': newId, 'draft.preset': '', 'draft.effects.items': {} } });
      await db.collection(GUILD_COLL).updateMany({ 'published.theme_id': oldId }, { $set: { 'published.theme_id': newId, 'published.preset': '', 'published.effects.items': {} } });
    } catch { /* a failed clean-up is retried on the next start */ }
  }
  try { await db.collection(ASSET_COLL).deleteMany({ official_key: { $regex: '^wody-dragon-' } }); } catch { /* the old artwork records are harmless if they stay */ }
}

export async function seedOfficial(db) {
  if (Date.now() - (seededAt.get(db) || 0) < 300_000) return;
  await ensureIndexes(db);
  await retireLegacy(db);
  const col = db.collection(THEME_COLL);
  for (const id of OFFICIAL_IDS) {
    const cfg = officialConfig(id);
    const existing = await col.findOne({ id });
    if (existing && (existing.published || existing.status !== 'draft')) continue; // a finished theme keeps its edits
    const now = new Date();
    const draft = existing ? { ...cfg, ...existing.draft, character: cfg.character, intro: cfg.intro } : cfg;
    const snap = await snapshotOf(db, { id, version: 0, draft });
    const entry = { v: snap.version, config: snap.config, at: now, by_name: 'Wody', note: 'Official release' };
    const set = { draft, status: 'published', published: snap, version: snap.version, versions: [entry], schedule: null, updated_at: now, history: [{ at: now, by: 'Wody', action: 'publish', detail: `v${snap.version}` }] };
    try {
      if (existing) await col.updateOne({ id }, { $set: set });
      else await col.updateOne({ id }, { $setOnInsert: { id, official: true, created_at: now, ...set } }, { upsert: true });
    } catch (e) { if (e?.code !== 11000) throw e; }
  }
  seededAt.set(db, Date.now());
}

export const getTheme = (db, id) => db.collection(THEME_COLL).findOne({ id: String(id) });

/** Is this theme visible to servers right now? Published always; scheduled inside its window; everything else no. */
export function availability(doc, now = new Date()) {
  if (!doc || !doc.published) return 'unavailable';
  if (doc.status === 'published') return 'available';
  if (doc.status === 'scheduled' && doc.schedule) {
    const start = doc.schedule.start ? new Date(doc.schedule.start) : null; const end = doc.schedule.end ? new Date(doc.schedule.end) : null;
    if (start && now < start) return 'upcoming';
    if (end && now >= end) return 'ended';
    return 'available';
  }
  return 'unavailable';
}

export async function assetMap(db, ids) {
  const list = [...new Set(ids.filter(Boolean))];
  if (!list.length) return {};
  const rows = await db.collection(ASSET_COLL).find({}).limit(500).toArray();
  const out = {};
  for (const r of rows) if (list.includes(String(r._id))) out[String(r._id)] = { url: r.site_image, w: r.width, h: r.height, kind: r.kind, status: r.status, name: r.name, has_alpha: r.has_alpha };
  return out;
}
export const refsOf = (cfg) => [cfg.meta.cover, cfg.environment.background_asset, cfg.character.asset, cfg.character.mobile_asset].filter(Boolean);

export async function issuesFor(db, cfg) { return publishIssues(cfg, await assetMap(db, refsOf(cfg))); }

/** A frozen copy that servers read: the config plus the resolved asset URLs. Editing the draft later never changes it. */
export async function snapshotOf(db, doc) {
  const cfg = clone(doc.draft);
  const assets = await assetMap(db, refsOf(cfg));
  return { id: doc.id, version: (doc.version || 0) + 1, config: cfg, assets };
}

export function themeView(doc, { full = false, issues = null } = {}) {
  const cfg = doc.draft;
  const base = {
    id: doc.id, official: Boolean(doc.official), status: doc.status, name: cfg.meta.name, category: cfg.meta.category, version: doc.version || 0,
    schedule: doc.schedule ? { start: iso(doc.schedule.start), end: iso(doc.schedule.end) } : null, availability: availability(doc),
    has_character: Boolean(cfg.character.asset), requires_character: cfg.character.requires_character, updated_at: iso(doc.updated_at), issues: issues || [],
  };
  if (!full) return base;
  return {
    ...base, draft: cfg, published: doc.published ? doc.published.config : null,
    versions: (doc.versions || []).map((v) => ({ v: v.v, at: iso(v.at), by: v.by_name || '', note: v.note || '' })).sort((a, b) => b.v - a.v),
    history: (doc.history || []).slice(-30).reverse().map((h) => ({ at: iso(h.at), by: h.by, action: h.action, detail: h.detail || '' })),
  };
}

export async function saveDraft(db, id, config, actor, action = 'edit', detail = '') {
  const r = await db.collection(THEME_COLL).findOneAndUpdate({ id }, {
    $set: { draft: config, updated_at: new Date() },
    $push: { history: { $each: [{ at: new Date(), by: actor.name, action, detail }], $slice: -LIMITS.history } },
  }, { returnDocument: 'after' });
  return r?.value ?? r;
}

export function validateOfficial() {
  const bad = [];
  for (const [id, cfg] of Object.entries(OFFICIAL)) { const r = normalizeThemeConfig(cfg, clone(cfg)); if (!r.ok) bad.push([id, r.error, r.field]); }
  return bad;
}

// ---------------------------------------------------------------------------------------------- servers
export async function isGuildPremium(db, gid) {
  const doc = await db.collection('premium_servers').findOne({ guild_id: toLong(gid), active: true });
  if (!doc || doc.suspended) return false;
  return !(doc.expires_at && new Date(doc.expires_at) < new Date());
}
export const getGuildTheme = (db, gid) => db.collection(GUILD_COLL).findOne({ guild_id: String(gid) });

const cache = new Map();
export const forgetAll = () => cache.clear();
export function forgetGuild(gid) { for (const k of cache.keys()) if (k.startsWith(`${gid}:`)) cache.delete(k); }

/** What a visitor of this server's pages should see: the render theme, or null for the standard Wody look (the fallback). Never throws. */
export async function resolveGuildTheme(db, gid, { now = new Date(), locale = 'en' } = {}) {
  const key = `${gid}:${locale}`;
  const hit = cache.get(key);
  if (hit && hit.until > Date.now()) return hit.value;
  let value = null;
  try {
    const g = await getGuildTheme(db, gid);
    if (g?.published?.theme_id) {
      const theme = await getTheme(db, g.published.theme_id);
      // themes on the server's pages are a Premium feature: without Premium the standard look is used
      const moduleOff = (await db.collection('guild_settings').findOne({ guild_id: toLong(gid) }))?.module_states?.theme_studio === false;   // the Theme Studio switch
      if (!moduleOff && availability(theme, now) === 'available' && await isGuildPremium(db, gid)) {
        const premium = true;
        const label = theme.draft.i18n?.[locale] || null;
        value = buildRenderTheme(theme.published, g.published, { premium, locale, label: label && label.name ? label : null });
        // where the theme shows (the dashboard switch) is a setting, not artwork: it takes effect as soon as it is saved
        if (typeof g.draft?.dashboard === 'boolean') value.dashboard = g.draft.dashboard;
      }
    }
  } catch (e) {
    console.error('[themes] resolve failed, using the default look', e?.message);
    value = null;
  }
  cache.set(key, { value, until: Date.now() + 15000 });
  if (cache.size > 500) cache.clear();
  return value;
}

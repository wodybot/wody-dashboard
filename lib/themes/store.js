// Storage and lookups for Dynamic Themes. Large files never live here: an asset record keeps only the reference to the stored image.
import { readFile } from 'fs/promises';
import path from 'path';
import sharp from 'sharp';
import { toLong } from '@/lib/mongo';
import { THEME_COLL, ASSET_COLL, GUILD_COLL, AUDIT_COLL, LIMITS, OFFICIAL_IDS } from './constants.js';
import { OFFICIAL, OFFICIAL_ELEMENT, officialConfig } from './official.js';
import { normalizeThemeConfig, publishIssues } from './schema.js';
import { buildRenderTheme } from './render.js';

const ART_VERSION = 2; // 2: the layered dragon artwork
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
export const resetIndexCache = () => { indexed = false; };

export async function audit(db, actor, action, theme, result = 'ok', detail = '') {
  try {
    await db.collection(AUDIT_COLL).insertOne({
      at: new Date(), actor_id: String(actor?.id || ''), actor_name: String(actor?.name || '').slice(0, 60), action, theme: String(theme || '').slice(0, 60),
      result, detail: String(detail || '').replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, 200),
    });
  } catch { /* an audit write must never break the action it records */ }
}

// ---------------------------------------------------------------------------------------------- themes
/** WODY, the Wody dragon: one image per element, stored once as an asset the themes point to. Returns the asset id. */
async function officialAsset(db, id) {
  const element = OFFICIAL_ELEMENT[id];
  const col = db.collection(ASSET_COLL);
  const key = `wody-dragon-${element}`;
  const have = await col.findOne({ official_key: key });
  if (have && (have.art_version || 1) >= ART_VERSION) return String(have._id);
  const buf = await readFile(path.join(process.cwd(), 'public/themes', `${key}.png`));
  const meta = await sharp(buf).metadata();
  if (have) {
    // the artwork was redrawn: bring an already stored copy up to date, once
    {
      const imgId = String(have.site_image || '').split('/').pop();
      try {
        const { ObjectId } = await import('mongodb');
        await db.collection('site_images').updateOne({ _id: new ObjectId(imgId) }, { $set: { w: meta.width, h: meta.height, size: buf.length, data: buf, updated_at: new Date() } });
      } catch { await db.collection('site_images').updateOne({ _id: imgId }, { $set: { w: meta.width, h: meta.height, size: buf.length, data: buf, updated_at: new Date() } }); }
      await col.updateOne({ _id: have._id }, { $set: { width: meta.width, height: meta.height, bytes: buf.length, art_version: ART_VERSION } });
    }
    return String(have._id);
  }
  const img = await db.collection('site_images').insertOne({ mime: 'image/png', w: meta.width, h: meta.height, size: buf.length, data: buf, by: 'wody', created_at: new Date() });
  const now = new Date();
  const ins = await col.insertOne({
    official_key: key, kind: 'character', name: `WODY (${element})`, site_image: `/api/site-image/${img.insertedId}`, mime: 'image/png', bytes: buf.length,
    width: meta.width, height: meta.height, has_alpha: true, license: { type: 'owned', source: 'Original artwork of Wody, the Wody dragon', confirmed: true },
    status: 'valid', warnings: [], created_by: 'wody', created_at: now, art_version: ART_VERSION,
  });
  return String(ins.insertedId);
}

/** The five official themes exist from the start, complete and published: each has WODY attached. Never overwrites a theme the Owner already changed. */
export async function seedOfficial(db) {
  await ensureIndexes(db);
  const col = db.collection(THEME_COLL);
  for (const id of OFFICIAL_IDS) {
    const cfg = officialConfig(id);
    const existing = await col.findOne({ id });
    if (existing && (existing.draft.character.asset || existing.published || existing.status !== 'draft')) { await officialAsset(db, id); continue; } // a finished theme keeps its edits; only the stored artwork is brought up to date
    const asset = await officialAsset(db, id);
    const now = new Date();
    // an older draft without art keeps whatever the Owner edited; only the character is completed
    const draft = existing ? { ...existing.draft, intro: { ...existing.draft.intro, audio: cfg.intro.audio }, character: { ...cfg.character, ...existing.draft.character, id: 'wody', name: 'WODY', asset, position: cfg.character.position, breath_origin: cfg.character.breath_origin } } : { ...cfg, character: { ...cfg.character, asset } };
    const snap = await snapshotOf(db, { id, version: 0, draft });
    const entry = { v: snap.version, config: snap.config, at: now, by_name: 'Wody', note: 'Official release' };
    const set = { draft, status: 'published', published: snap, version: snap.version, versions: [entry], schedule: null, updated_at: now, history: [{ at: now, by: 'Wody', action: 'publish', detail: `v${snap.version}` }] };
    try {
      if (existing) await col.updateOne({ id }, { $set: set });
      else await col.updateOne({ id }, { $setOnInsert: { id, official: true, created_at: now, ...set } }, { upsert: true });
    } catch (e) { if (e?.code !== 11000) throw e; }
  }
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
      if (availability(theme, now) === 'available') {
        const premium = await isGuildPremium(db, gid);
        const label = theme.draft.i18n?.[locale] || null;
        value = buildRenderTheme(theme.published, g.published, { premium, locale, label: label && label.name ? label : null });
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

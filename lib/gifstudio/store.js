import crypto from 'crypto';
import { ObjectId } from 'mongodb';
import { LIMITS } from './constants';

export const ITEMS = 'gif_studio_items';
export const BLOBS = 'gif_studio_blobs';
const STALE_MS = 6 * 60 * 1000;

let indexed = false;
export async function ensureIndexes(db) {
  if (indexed) return;
  indexed = true;
  try {
    await Promise.all([
      db.collection(ITEMS).createIndex({ slug: 1 }, { unique: true }),
      db.collection(ITEMS).createIndex({ updated_at: -1 }),
      db.collection(BLOBS).createIndex({ item_id: 1 }),
    ]);
  } catch (e) { console.error('gifstudio indexes failed', e?.message || e); }
}

export const oid = (id) => (/^[a-f0-9]{24}$/.test(String(id || '')) ? new ObjectId(String(id)) : null);

export function makeSlug(name) {
  const base = String(name || 'preview').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'preview';
  return `${base}-${crypto.randomBytes(3).toString('hex')}`;
}

export const isSlug = (s) => /^[a-z0-9][a-z0-9-]{2,63}$/.test(String(s || ''));

// What the owner panel sees: never the binary data.
export function view(d, { now = Date.now() } = {}) {
  if (!d) return null;
  const cur = (d.versions || []).find((v) => v.v === d.current_version) || null;
  const pub = (d.versions || []).find((v) => v.v === d.published_version) || null;
  let status = d.status;
  let job = d.job || null;
  if (status === 'generating' && job && now - new Date(job.updated_at || job.started_at || 0).getTime() > STALE_MS) { status = 'failed'; job = { ...job, state: 'failed', error: 'job_stalled' }; }
  const pick = (v) => (v ? { v: v.v, hash: v.hash, bytes: v.bytes, width: v.width, height: v.height, frames: v.frames, fps: v.fps, colors: v.colors, duration_ms: v.duration_ms, preset: v.preset, optimized: !!v.optimized, at: v.at, by: v.by_name || null } : null);
  return {
    id: String(d._id), slug: d.slug, name: d.name, kind: d.kind, module: d.module || null, status, config: d.config,
    config_hash: d.config_hash, version: d.current_version || 0, published_version: d.published_version || 0,
    current: pick(cur), published: pick(pub), versions: (d.versions || []).map(pick).sort((a, b) => b.v - a.v),
    has_blob: !!cur, schedule_at: d.schedule_at ? new Date(d.schedule_at).toISOString() : null,
    job: job ? { state: job.state, progress: job.progress || 0, step: job.step || '', error: job.error || null, cancel: !!job.cancel, optimized: job.optimized || 0 } : null,
    history: (d.history || []).slice(-30).reverse().map((h) => ({ at: h.at, by: h.by_name, action: h.action, detail: h.detail || '' })),
    public_path: pub ? `/api/gif-preview/${d.slug}.gif` : null, fallback_path: pub ? `/api/gif-preview/${d.slug}.png` : null,
    created_at: d.created_at, updated_at: d.updated_at, published_at: d.published_at || null,
  };
}

const hist = (actor, action, detail = '') => ({ at: new Date(), by: actor?.id || null, by_name: actor?.name || null, action, detail: String(detail).slice(0, 200) });

export async function listItems(db, { status } = {}) {
  await ensureIndexes(db);
  const q = status ? { status } : {};
  const rows = await db.collection(ITEMS).find(q).sort({ updated_at: -1 }).limit(LIMITS.items).toArray();
  return rows.map((r) => view(r));
}
export async function getItem(db, id) {
  const _id = oid(id); if (!_id) return null;
  return db.collection(ITEMS).findOne({ _id });
}
export async function getItemBySlug(db, slug) {
  if (!isSlug(slug)) return null;
  return db.collection(ITEMS).findOne({ slug });
}

export async function createItem(db, { name, config, kind, module, hash }, actor) {
  await ensureIndexes(db);
  const now = new Date();
  const doc = {
    slug: makeSlug(name), name, kind, module: module || null, status: 'draft', config, config_hash: hash,
    versions: [], current_version: 0, published_version: 0, job: null, history: [hist(actor, 'create')], created_at: now, updated_at: now,
  };
  const r = await db.collection(ITEMS).insertOne(doc);
  return { ...doc, _id: r.insertedId };
}

export async function updateItem(db, id, set, actor, action, detail) {
  const _id = oid(id);
  const upd = { $set: { ...set, updated_at: new Date() } };
  if (action) upd.$push = { history: { $each: [hist(actor, action, detail)], $slice: -LIMITS.history } };
  const r = await db.collection(ITEMS).findOneAndUpdate({ _id }, upd, { returnDocument: 'after' });
  return r?.value ?? r;
}

export async function saveBlob(db, itemId, kind, data, meta = {}) {
  const r = await db.collection(BLOBS).insertOne({ item_id: String(itemId), kind, data, size: data.length, created_at: new Date(), ...meta });
  return r.insertedId;
}
export async function loadBlob(db, id) {
  const _id = id instanceof ObjectId ? id : oid(id); if (!_id) return null;
  return db.collection(BLOBS).findOne({ _id });
}

export async function deleteItem(db, id) {
  const _id = oid(id);
  await db.collection(BLOBS).deleteMany({ item_id: String(id) });
  await db.collection(ITEMS).deleteOne({ _id });
}

// Drops the oldest versions (and their binary data) above the limit, never the current or the published one.
export async function pruneVersions(db, item) {
  const keep = new Set([item.current_version, item.published_version]);
  const vs = [...(item.versions || [])].sort((a, b) => b.v - a.v);
  const drop = vs.slice(LIMITS.versions).filter((v) => !keep.has(v.v));
  if (!drop.length) return;
  const ids = drop.flatMap((v) => [v.blob_id, v.png_id]).filter(Boolean);
  await db.collection(BLOBS).deleteMany({ _id: { $in: ids } });
  await db.collection(ITEMS).updateOne({ _id: item._id }, { $pull: { versions: { v: { $in: drop.map((v) => v.v) } } } });
}

export { hist };

// A blob read from MongoDB is a BSON Binary; in tests it is a Buffer. Either way the caller gets a plain Buffer.
export function blobBytes(blob) {
  const d = blob?.data;
  if (!d) return null;
  if (Buffer.isBuffer(d)) return d;
  if (d.buffer) return Buffer.from(d.buffer.subarray(0, d.position ?? d.buffer.length));
  return null;
}

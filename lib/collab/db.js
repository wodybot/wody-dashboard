import { getDb } from '@/lib/mongo';
import { SEED_CATEGORIES, DEFAULT_SETTINGS } from './constants.js';

export const M = {
  requests: 'marketplace_requests',
  versions: 'marketplace_versions',
  applications: 'marketplace_applications',
  categories: 'marketplace_categories',
  tags: 'marketplace_tags',
  checks: 'marketplace_checks',
  decisions: 'marketplace_decisions',
  reports: 'marketplace_reports',
  servers: 'marketplace_servers',
  serverCategories: 'marketplace_server_categories',
  abuse: 'marketplace_abuse',
  profiles: 'marketplace_profiles',
  messages: 'marketplace_messages',
  files: 'marketplace_files',
  notifications: 'marketplace_notifications',
  audit: 'marketplace_audit',
  settings: 'marketplace_settings',
  challenges: 'marketplace_challenges',
};

let ready = null;

async function ensure(db) {
  const idx = (name, spec, opts) => db.collection(name).createIndex(spec, opts).catch((e) => console.error('collab index', name, e?.message));
  await Promise.all([
    idx(M.requests, { status: 1, published_at: -1, _id: -1 }),
    idx(M.requests, { status: 1, category: 1, published_at: -1, _id: -1 }),
    idx(M.requests, { status: 1, updated_live_at: -1 }),
    idx(M.requests, { status: 1, expires_at: 1 }),
    idx(M.requests, { status: 1, tags: 1 }),
    idx(M.requests, { author_id: 1, updated_at: -1 }),
    idx(M.requests, { status: 1, review_queue: 1, queued_at: 1 }),
    idx(M.requests, { origin_guild_id: 1, status: 1, queued_at: 1 }),
    idx(M.requests, { status: 1, random_key: 1 }),
    idx(M.requests, { origin_guild_id: 1, status: 1, published_at: -1 }),
    idx(M.serverCategories, { guild_id: 1, created_at: 1 }),
    idx(M.serverCategories, { slug: 1 }, { unique: true }),
    idx(M.abuse, { user_id: 1, kind: 1, at: -1 }),
    idx(M.abuse, { expires_at: 1 }, { expireAfterSeconds: 0 }),
    idx(M.versions, { request_id: 1, n: -1 }),
    idx(M.versions, { request_id: 1, hash: 1 }),
    idx(M.applications, { request_id: 1, applicant_id: 1 }, { unique: true }),
    idx(M.applications, { request_id: 1, status: 1, created_at: -1 }),
    idx(M.applications, { applicant_id: 1, created_at: -1 }),
    idx(M.applications, { category: 1, created_at: -1 }),
    idx(M.categories, { slug: 1 }, { unique: true }),
    idx(M.tags, { slug: 1 }, { unique: true }),
    idx(M.checks, { request_id: 1, version_id: 1 }),
    idx(M.decisions, { request_id: 1, at: -1 }),
    idx(M.decisions, { at: -1 }),
    idx(M.reports, { request_id: 1, reporter_id: 1 }, { unique: true }),
    idx(M.reports, { status: 1, created_at: -1 }),
    idx(M.servers, { guild_id: 1 }, { unique: true }),
    idx(M.profiles, { user_id: 1 }, { unique: true }),
    idx(M.messages, { to_user_id: 1, created_at: -1 }),
    idx(M.messages, { request_id: 1, created_at: -1 }),
    idx(M.files, { request_id: 1 }),
    idx(M.notifications, { to: 1, created_at: -1 }),
    idx(M.notifications, { created_at: 1 }, { expireAfterSeconds: 90 * 24 * 3600 }),
    idx(M.challenges, { expires_at: 1 }, { expireAfterSeconds: 0 }),
    idx(M.audit, { at: -1 }),
    idx(M.audit, { target: 1, at: -1 }),
  ]);
  await db.collection(M.messages).updateMany({ ip_hash: { $exists: true } }, { $unset: { ip_hash: '' } }).catch(() => {});
  const now = new Date();
  if (!(await db.collection(M.categories).findOne({}))) {
    await db.collection(M.categories).insertMany(
      SEED_CATEGORIES.map((c, i) => ({ slug: c.slug, icon: c.icon, names: c.names, order: i, enabled: true, created_at: now })),
      { ordered: false },
    ).catch(() => {});
  }
  if (!(await db.collection(M.settings).findOne({ _id: 'main' }))) {
    await db.collection(M.settings).insertOne({ _id: 'main', ...DEFAULT_SETTINGS, created_at: now }).catch(() => {});
  }
}

export async function mdb() {
  const db = await getDb();
  if (!ready) ready = ensure(db).catch((e) => { ready = null; console.error('collab ensure failed', e); });
  await ready;
  return db;
}

let catCache = null;
export function resetCategoryCache() { catCache = null; }
export async function getCategories(db, { includeDisabled = false } = {}) {
  if (!catCache || Date.now() - catCache.at > 30_000) {
    const rows = await db.collection(M.categories).find({}).sort({ order: 1 }).toArray();
    catCache = { at: Date.now(), rows: rows.map(({ _id, ...r }) => ({ id: String(_id), ...r })) };
  }
  return includeDisabled ? catCache.rows : catCache.rows.filter((c) => c.enabled !== false);
}

export async function getSettings(db) {
  const doc = await db.collection(M.settings).findOne({ _id: 'main' });
  const { _id, created_at, updated_at, ...rest } = doc || {};
  return { ...DEFAULT_SETTINGS, ...rest };
}

export async function auditLog(db, actor, action, target, detail = {}) {
  try {
    await db.collection(M.audit).insertOne({ at: new Date(), actor: String(actor), action, target: String(target ?? ''), detail });
  } catch (e) { console.error('collab audit', e?.message); }
}

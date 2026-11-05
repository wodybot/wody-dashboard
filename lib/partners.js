import { cleanImageRef } from '@/lib/site-image-path';
import { getDb } from '@/lib/mongo';
import { publicImageUrl } from '@/lib/img-sign';

export const PARTNERS_COLLECTION = 'partner_bots';

export const PARTNER_LIMITS = {
  name: 60,
  tagline: 90,
  description: 600,
  url: 2048,
  tags: 6,
  tag: 24,
  total: 60,
};

const HEX = /^#[0-9a-fA-F]{6}$/;

function cleanUrl(value) {
  const v = String(value || '').trim().slice(0, PARTNER_LIMITS.url);
  if (!v) return '';
  try {
    const u = new URL(v);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : null;
  } catch {
    return null;
  }
}

function cleanText(value, max) {
  return String(value || '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, max);
}

export function parsePartnerInput(body, { partial = false } = {}) {
  if (!body || typeof body !== 'object') return { ok: false, error: 'invalid_body' };
  const patch = {};
  const has = (k) => k in body;
  const need = (k) => !partial || has(k);

  if (need('name')) {
    const v = cleanText(body.name, PARTNER_LIMITS.name);
    if (v.length < 2) return { ok: false, error: 'invalid_name', field: 'name' };
    patch.name = v;
  }
  if (has('tagline')) patch.tagline = cleanText(body.tagline, PARTNER_LIMITS.tagline);
  if (has('description')) patch.description = cleanText(body.description, PARTNER_LIMITS.description);
  for (const key of ['avatar_url', 'banner_url', 'invite_url', 'website_url', 'support_url']) {
    if (!has(key) && !(key === 'invite_url' && need(key))) continue;
    const v = (key === 'avatar_url' || key === 'banner_url') ? cleanImageRef(body[key], PARTNER_LIMITS.url) : cleanUrl(body[key]);
    if (v === null) return { ok: false, error: 'invalid_url', field: key };
    if (key === 'invite_url' && !v) return { ok: false, error: 'invite_required', field: key };
    patch[key] = v;
  }
  if (has('tags')) {
    const raw = Array.isArray(body.tags) ? body.tags : String(body.tags || '').split(',');
    patch.tags = [...new Set(raw.map((t) => cleanText(t, PARTNER_LIMITS.tag)).filter(Boolean))].slice(0, PARTNER_LIMITS.tags);
  }
  if (has('color')) {
    const v = String(body.color || '').trim();
    if (v && !HEX.test(v)) return { ok: false, error: 'invalid_color', field: 'color' };
    patch.color = v || '#c46a2d';
  }
  if (has('servers')) {
    const n = body.servers === '' || body.servers == null ? null : Number(body.servers);
    if (n !== null && (!Number.isFinite(n) || n < 0)) return { ok: false, error: 'invalid_servers', field: 'servers' };
    patch.servers = n === null ? null : Math.round(n);
  }
  if (has('order')) {
    const n = Number(body.order);
    patch.order = Number.isFinite(n) ? Math.max(0, Math.min(9999, Math.round(n))) : 0;
  }
  if (has('featured')) patch.featured = !!body.featured;
  if (has('enabled')) patch.enabled = !!body.enabled;

  if (!partial) {
    patch.tagline ??= '';
    patch.description ??= '';
    patch.avatar_url ??= '';
    patch.banner_url ??= '';
    patch.website_url ??= '';
    patch.support_url ??= '';
    patch.tags ??= [];
    patch.color ??= '#c46a2d';
    patch.servers ??= null;
    patch.order ??= 0;
    patch.featured ??= false;
    patch.enabled ??= true;
  }
  if (Object.keys(patch).length === 0) return { ok: false, error: 'empty_patch' };
  return { ok: true, patch };
}

export function serializePartner(doc) {
  if (!doc) return null;
  return {
    id: String(doc._id),
    name: doc.name || '',
    tagline: doc.tagline || '',
    description: doc.description || '',
    avatar_url: doc.avatar_url || '',
    banner_url: doc.banner_url || '',
    invite_url: doc.invite_url || '',
    website_url: doc.website_url || '',
    support_url: doc.support_url || '',
    tags: Array.isArray(doc.tags) ? doc.tags : [],
    color: HEX.test(doc.color || '') ? doc.color : '#c46a2d',
    servers: typeof doc.servers === 'number' ? doc.servers : null,
    order: Number(doc.order) || 0,
    featured: !!doc.featured,
    enabled: doc.enabled !== false,
    created_at: doc.created_at || null,
    updated_at: doc.updated_at || null,
  };
}

const SORT = { featured: -1, order: 1, created_at: 1 };

function withPublicImages(p) {
  return { ...p, avatar_src: publicImageUrl(p.avatar_url), banner_src: publicImageUrl(p.banner_url) };
}

export async function getPublicPartners() {
  try {
    const db = await getDb();
    const rows = await db.collection(PARTNERS_COLLECTION).find({ enabled: { $ne: false } }).sort(SORT).limit(PARTNER_LIMITS.total).toArray();
    return rows.map(serializePartner).map(withPublicImages);
  } catch (e) {
    console.error('getPublicPartners failed', e);
    return [];
  }
}

export async function getAllPartners(db) {
  const rows = await db.collection(PARTNERS_COLLECTION).find({}).sort(SORT).limit(200).toArray();
  return rows.map(serializePartner);
}

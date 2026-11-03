import { cleanImageRef } from '@/lib/site-image-path';


export const BLOG_COLLECTION = 'blog_posts';

export async function readWithRetry(fn, tries = 3) {
  let last;
  for (let i = 0; i < tries; i += 1) {
    try { return await fn(); } catch (e) { last = e; await new Promise((r) => setTimeout(r, 200 * (i + 1))); }
  }
  throw last;
}

const MAX_LEN = {
  title: 140,
  slug: 100,
  excerpt: 240,
  content: 20000,
  coverImageUrl: 2048,
  seoTitle: 70,
  seoDescription: 160,
  authorName: 60,
};

export function slugify(input) {
  return String(input || '')
    .toLowerCase()
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_LEN.slug)
    .replace(/-+$/g, '');
}

function isHttpUrl(value) {
  if (!value) return true;
  try {
    const u = new URL(value);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}

export function parseBlogPostInput(body, { partial = false } = {}) {
  if (!body || typeof body !== 'object') return { ok: false, error: 'invalid_body' };
  const patch = {};

  const has = (k) => k in body;
  const need = (k) => !partial || has(k);

  if (need('title')) {
    const v = String(body.title || '').trim();
    if (!v) return { ok: false, error: 'invalid_title' };
    patch.title = v.slice(0, MAX_LEN.title);
  }
  if (has('slug')) {
    const v = slugify(body.slug);
    if (!v) return { ok: false, error: 'invalid_slug' };
    patch.slug = v;
  }
  if (has('excerpt')) {
    patch.excerpt = String(body.excerpt || '').trim().slice(0, MAX_LEN.excerpt);
  }
  if (need('content')) {
    const v = String(body.content || '').trim();
    if (!v) return { ok: false, error: 'invalid_content' };
    patch.content = v.slice(0, MAX_LEN.content);
  }
  if (has('cover_image_url')) {
    const v = String(body.cover_image_url || '').trim();
    const ref = cleanImageRef(v, MAX_LEN.coverImageUrl);
    if (ref === null) return { ok: false, error: 'invalid_cover_image_url' };
    patch.cover_image_url = ref;
  }
  if (has('seo_title')) patch.seo_title = String(body.seo_title || '').trim().slice(0, MAX_LEN.seoTitle);
  if (has('seo_description')) patch.seo_description = String(body.seo_description || '').trim().slice(0, MAX_LEN.seoDescription);
  if (has('author_name')) patch.author_name = String(body.author_name || '').trim().slice(0, MAX_LEN.authorName);
  if (has('published')) patch.published = !!body.published;

  if (Object.keys(patch).length === 0) return { ok: false, error: 'empty_patch' };
  return { ok: true, patch };
}

export async function ensureUniqueSlug(db, baseSlug, excludeId) {
  let slug = baseSlug || 'post';
  let n = 2;
  for (let i = 0; i < 50; i++) {
    const query = { slug };
    if (excludeId) query._id = { $ne: excludeId };
    const clash = await db.collection(BLOG_COLLECTION).findOne(query, { projection: { _id: 1 } });
    if (!clash) return slug;
    slug = `${baseSlug || 'post'}-${n++}`;
  }
  return slug;
}

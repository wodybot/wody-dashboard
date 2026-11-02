// FILE: blog.js
// PUNE ÎN: lib/blog.js
// (fișier nou în proiectul wody-dashboard-main la această cale)

// Data layer for the public Blog (see app/[locale]/blog/page.js and
// app/[locale]/blog/[slug]/page.js), a dedicated blog_posts collection
// (not the site_config single-document pattern the Appearance cards use,
// this is a real list of many independent documents), owner-only writes
// via the routes in app/api/[[...path]]/route.js.
//
// Content (SimpleMarkdown syntax, see components/simple-markdown.jsx) is
// stored as-typed and rendered through that same safe renderer wherever
// it's shown, never as raw HTML, same reasoning as that file's own
// comment.

export const BLOG_COLLECTION = 'blog_posts';

// Reads from the database with a few quick retries. A short database hiccup used to be swallowed by the pages,
// which then showed "no posts" or a 404 for a post that exists; now it retries and, only if it keeps failing,
// the error reaches the page's error screen (with its retry button).
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

// URL-safe slug: lowercase, spaces/punctuation collapsed to single
// hyphens, no leading/trailing hyphen. Used both to auto-generate a slug
// from the title when the owner doesn't set one, and to sanitize one
// they typed by hand.
export function slugify(input) {
  return String(input || '')
    .toLowerCase()
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '') // strip accents
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_LEN.slug)
    .replace(/-+$/g, '');
}

function isHttpUrl(value) {
  if (!value) return true; // empty is valid (means "not set")
  try {
    const u = new URL(value);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}

// Validates a create/update body from the owner panel. `partial: true`
// (used for edits) skips the "must be present" checks for fields the
// owner isn't touching in this save, `required` (used for create) treats
// title/content as mandatory. Returns { ok: true, patch } or
// { ok: false, error }.
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
    if (v && !isHttpUrl(v)) return { ok: false, error: 'invalid_cover_image_url' };
    patch.cover_image_url = v.slice(0, MAX_LEN.coverImageUrl);
  }
  if (has('seo_title')) patch.seo_title = String(body.seo_title || '').trim().slice(0, MAX_LEN.seoTitle);
  if (has('seo_description')) patch.seo_description = String(body.seo_description || '').trim().slice(0, MAX_LEN.seoDescription);
  if (has('author_name')) patch.author_name = String(body.author_name || '').trim().slice(0, MAX_LEN.authorName);
  if (has('published')) patch.published = !!body.published;

  if (Object.keys(patch).length === 0) return { ok: false, error: 'empty_patch' };
  return { ok: true, patch };
}

// Finds a slug that doesn't collide with an existing post. Tries the
// bare slug first, then -2, -3, ... `excludeId` lets an edit keep its
// own current slug without treating it as a collision with itself.
export async function ensureUniqueSlug(db, baseSlug, excludeId) {
  let slug = baseSlug || 'post';
  let n = 2;
  // 50 attempts is generous; if a title is reused that many times
  // something else is going on and the caller gets whatever the last
  // attempt produced, still unique-checked, just not infinitely retried.
  for (let i = 0; i < 50; i++) {
    const query = { slug };
    if (excludeId) query._id = { $ne: excludeId };
    const clash = await db.collection(BLOG_COLLECTION).findOne(query, { projection: { _id: 1 } });
    if (!clash) return slug;
    slug = `${baseSlug || 'post'}-${n++}`;
  }
  return slug;
}

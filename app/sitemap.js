import { getDb } from '@/lib/mongo';
import { routing } from '@/i18n/routing';
import { MODULE_SEO_SLUGS } from '@/lib/module-seo';
import { BLOG_COLLECTION } from '@/lib/blog';
import { C } from '@/lib/community/db';

const SITE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://wody.online';

// Builds the per-path locale prefix ('' for the default locale since
// localePrefix is 'as-needed', e.g. /premium vs /fr/premium) plus the
// hreflang alternates block search engines use to serve the right
// language version of a page.
// Module detail pages only have their own copy in these locales; the rest
// show English text, so they stay out of the sitemap (no duplicate content).
const SEO_COPY_LOCALES = ['en', 'ro'];

function localizedEntry(path, rest, onlyLocales) {
  const locs = onlyLocales || routing.locales;
  const alternates = {
    languages: {
      ...Object.fromEntries(
        locs.map((l) => [
          l,
          `${SITE_URL}${l === routing.defaultLocale ? '' : `/${l}`}${path}`,
        ])
      ),
      'x-default': `${SITE_URL}${path}`,
    },
  };
  return locs.map((l) => ({
    url: `${SITE_URL}${l === routing.defaultLocale ? '' : `/${l}`}${path}`,
    alternates,
    ...rest,
  }));
}

// Best-effort lookup of the newest update's timestamp, so /updates reports
// its real last-changed date to crawlers instead of "whenever this built".
// Falls back to "now" on any failure (e.g. Mongo briefly unreachable at
// build time) rather than breaking the whole sitemap.
async function getLatestUpdateDate(fallback) {
  try {
    const db = await getDb();
    const doc = await db.collection('updates').find({}).sort({ created_at: -1 }).limit(1).next();
    return doc?.created_at ? new Date(doc.created_at) : fallback;
  } catch {
    return fallback;
  }
}

// Published blog posts only (drafts must never show up in a sitemap,
// that would invite crawling of content the owner hasn't published yet).
// Each post's own lastModified is its real updated_at (or published_at
// for a post that's never been edited since), same reasoning as
// getLatestUpdateDate above, not a single "now" for every post.
async function getPublishedBlogSlugs(fallback) {
  try {
    const db = await getDb();
    const docs = await db.collection(BLOG_COLLECTION)
      .find({ published: true })
      .project({ slug: 1, updated_at: 1, published_at: 1 })
      .toArray();
    return docs.map((d) => ({
      slug: d.slug,
      lastModified: d.updated_at ? new Date(d.updated_at) : (d.published_at ? new Date(d.published_at) : fallback),
    }));
  } catch {
    return [];
  }
}

// Published community profiles only (drafts, pending, rejected, suspended and unpublished
// listings are never listed in the sitemap).
async function getPublishedCommunities() {
  try {
    const db = await getDb();
    const settings = await db.collection(C.settings).findOne({ _id: 'main' }, { projection: { url_prefix: 1 } });
    const prefix = settings?.url_prefix || 'server';
    const rows = await db.collection(C.listings).find({ status: 'published' }).project({ slug: 1, updated_at: 1 }).limit(5000).toArray();
    return rows.map((r) => ({ path: `/${prefix}/${r.slug}`, lastModified: r.updated_at ? new Date(r.updated_at) : new Date() }));
  } catch {
    return [];
  }
}

// Published, approved and not expired Collab requests only (newest 2000).
async function getPublishedRequests() {
  try {
    const db = await getDb();
    const rows = await db.collection('marketplace_requests')
      .find({ status: 'published', expires_at: { $gt: new Date() }, closed_at: null })
      .project({ updated_live_at: 1 }).sort({ published_at: -1 }).limit(2000).toArray();
    return rows.map((r) => ({ path: `/collab/${r._id}`, lastModified: r.updated_live_at ? new Date(r.updated_live_at) : new Date() }));
  } catch {
    return [];
  }
}

// Only public, indexable marketing pages belong here.
// /dashboard/* is private (requires login) and excluded via robots.js.
export default async function sitemap() {
  const lastModified = new Date();
  const updatesLastModified = await getLatestUpdateDate(lastModified);
  const blogPosts = await getPublishedBlogSlugs(lastModified);
  const communities = await getPublishedCommunities();
  const requests = await getPublishedRequests();

  return [
    ...localizedEntry('/', { lastModified, changeFrequency: 'weekly', priority: 1 }),
    ...localizedEntry('/premium', { lastModified, changeFrequency: 'monthly', priority: 0.9 }),
    ...localizedEntry('/help', { lastModified, changeFrequency: 'monthly', priority: 0.8 }),
    ...localizedEntry('/commands', { lastModified, changeFrequency: 'monthly', priority: 0.8 }),
    ...localizedEntry('/modules', { lastModified, changeFrequency: 'weekly', priority: 0.85 }),
    ...MODULE_SEO_SLUGS.flatMap((slug) =>
      localizedEntry(`/modules/${slug}`, { lastModified, changeFrequency: 'monthly', priority: 0.75 }, SEO_COPY_LOCALES)
    ),
    ...localizedEntry('/updates', {
      lastModified: updatesLastModified,
      // Content here can change any time the owner posts a new entry.
      changeFrequency: 'weekly',
      priority: 0.7,
    }),
    // The whole point of adding a blog for SEO: a steady stream of fresh,
    // indexable, keyword-relevant pages, so the list itself is weighted
    // like /updates (changes whenever a post ships) and every published
    // post gets its own entry with its own real last-modified date.
    ...localizedEntry('/blog', { lastModified, changeFrequency: 'weekly', priority: 0.7 }),
    ...blogPosts.flatMap(({ slug, lastModified: postModified }) =>
      localizedEntry(`/blog/${slug}`, { lastModified: postModified, changeFrequency: 'monthly', priority: 0.65 })
    ),
    ...localizedEntry('/servers', { lastModified, changeFrequency: 'daily', priority: 0.8 }),
    ...localizedEntry('/servers/guidelines', { lastModified, changeFrequency: 'yearly', priority: 0.4 }),
    ...localizedEntry('/tiktok', { lastModified, changeFrequency: 'yearly', priority: 0.4 }),
    ...localizedEntry('/collab', { lastModified, changeFrequency: 'daily', priority: 0.7 }),
    ...requests.flatMap(({ path, lastModified: m }) => localizedEntry(path, { lastModified: m, changeFrequency: 'weekly', priority: 0.5 })),
    ...localizedEntry('/leaderboard', { lastModified, changeFrequency: 'daily', priority: 0.7 }),
    ...localizedEntry('/partners', { lastModified, changeFrequency: 'weekly', priority: 0.6 }),
    ...communities.flatMap(({ path, lastModified: m }) => localizedEntry(path, { lastModified: m, changeFrequency: 'weekly', priority: 0.6 })),
    ...localizedEntry('/team', { lastModified, changeFrequency: 'monthly', priority: 0.5 }),
    ...localizedEntry('/contact', { lastModified, changeFrequency: 'yearly', priority: 0.5 }),
    ...localizedEntry('/careers', { lastModified, changeFrequency: 'monthly', priority: 0.5 }),
    ...localizedEntry('/privacy', { lastModified, changeFrequency: 'yearly', priority: 0.3 }),
    ...localizedEntry('/terms', { lastModified, changeFrequency: 'yearly', priority: 0.3 }),
    ...localizedEntry('/cookies', { lastModified, changeFrequency: 'yearly', priority: 0.3 }),
  ];
}

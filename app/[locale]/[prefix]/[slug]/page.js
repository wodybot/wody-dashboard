import { notFound, permanentRedirect } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Footer, TopNav } from '@/components/nav';
import ListingView from '@/components/community/ListingView';
import ProfileInteractive, { ViewPing } from '@/components/community/ProfileActions';
import { cdb, getCatalog, currentPrefix } from '@/lib/community/db';
import { getProfile, similarListings } from '@/lib/community/query';
import { routing } from '@/i18n/routing';
import { catalogName, formatCount } from '@/lib/community/names';
import { ROBOTS_INDEX, absolute, clip, jsonLd, languageNames, localePath, localizedAlternates, ogLocale } from '@/lib/community/seo';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
const pathFor = (locale, slug) => (locale === routing.defaultLocale ? `/${currentPrefix()}/${slug}` : `/${locale}/${currentPrefix()}/${slug}`);
// The old fixed prefix keeps working: it redirects to the prefix chosen in the admin settings.
const LEGACY_PREFIX = 'server';

async function load(slug, prefix) {
  const db = await cdb();
  if (prefix !== currentPrefix() && prefix !== LEGACY_PREFIX) return { db, listing: null, wrongPrefix: true };
  return { db, legacy: prefix !== currentPrefix(), ...(await getProfile(db, slug)) };
}

// Everything search engines need, generated automatically from the listing itself:
// a keyword-rich title and description, hreflang for every language, social cards and keywords.
function seoFor(listing, catalog, t, locale) {
  const categoryRow = catalog?.categories?.find((c) => c.slug === listing.category) || listing.category;
  const category = listing.category ? catalogName(t, 'categories', categoryRow, locale) : '';
  const tags = (listing.tags || []).map((tag) => catalogName(t, 'tags', catalog?.tags?.find((x) => x.slug === tag) || tag, locale)).filter(Boolean);
  const features = (listing.features || []).map((f) => catalogName(t, 'features', catalog?.features?.find((x) => x.slug === f) || f, locale)).filter(Boolean);
  const languages = languageNames(listing.languages || [], locale);
  const members = listing.stats?.members ?? listing.members ?? null;
  const rich = category ? t('seo.profileTitleCategory', { name: listing.name, category }) : '';
  const title = rich && rich.length <= 70 ? rich : t('seo.profileTitle', { name: listing.name });
  const facts = [
    members ? t('seo.members', { count: formatCount(members, locale) }) : null,
    category || null,
    languages.length ? languages.slice(0, 3).join(', ') : null,
  ].filter(Boolean).join(' · ');
  // The owner's own short description first, then the facts and a call to action, all within ~158 characters.
  let tail = [facts ? `${facts}.` : '', t('seo.join')].filter(Boolean).join(' ');
  const shortLen = String(listing.short_description || '').trim().length;
  if (shortLen > 158 - tail.length - 1 && 158 - tail.length - 1 < 70) tail = facts ? `${facts}.` : '';
  const short = clip(listing.short_description, Math.max(40, 158 - tail.length - 1));
  const description = [short && (/[.!?…]$/.test(short) ? short : `${short}.`), tail].filter(Boolean).join(' ');
  const discord = t('seo.discordServer');
  const keywords = [...new Set([
    listing.name, `${listing.name} discord`, category && `${category} ${discord}`, discord, ...tags, ...features, ...languages.map((l) => `${l} ${discord}`), 'Wody',
  ].filter(Boolean))].slice(0, 25);
  const image = absolute(listing.banner) || absolute(listing.icon) || absolute('/opengraph-image');
  return { title, description, keywords, image, category, tags, languages, members };
}

export async function generateMetadata({ params }) {
  const { locale, slug, prefix } = await params;
  const { db, listing } = await load(slug, prefix);
  const t = await getTranslations({ locale, namespace: 'community' });
  // Anything that is not published has no public page and is never indexed.
  if (!listing) return { title: { absolute: t('seo.notFoundTitle') }, robots: { index: false, follow: false } };
  const catalog = await getCatalog(db).catch(() => null);
  const seo = seoFor(listing, catalog, t, locale);
  const path = `/${currentPrefix()}/${listing.slug}`;
  const url = absolute(localePath(locale, path));
  return {
    title: { absolute: seo.title },
    description: seo.description,
    keywords: seo.keywords,
    category: seo.category || undefined,
    alternates: localizedAlternates(locale, path),
    robots: ROBOTS_INDEX,
    openGraph: {
      title: seo.title, description: seo.description, url, type: 'website', siteName: 'Wody', ...ogLocale(locale),
      images: [{ url: seo.image, alt: listing.name, ...(listing.banner ? { width: 1200, height: 400 } : {}) }],
    },
    twitter: { card: listing.banner ? 'summary_large_image' : 'summary', title: seo.title, description: seo.description, images: [seo.image] },
  };
}

export default async function ServerProfilePage({ params }) {
  const { locale, slug, prefix } = await params;
  setRequestLocale(locale);
  const { db, listing, redirect, raw, legacy } = await load(slug, prefix);
  if (redirect) permanentRedirect(pathFor(locale, redirect));
  if (!listing) notFound();
  if (legacy) permanentRedirect(pathFor(locale, listing.slug));
  const catalog = await getCatalog(db);
  const similar = await similarListings(db, raw, 6);
  const t = await getTranslations('community');
  const seo = seoFor(listing, catalog, t, locale);
  const pagePath = `/${currentPrefix()}/${listing.slug}`;
  const url = absolute(localePath(locale, pagePath));
  const categoryRow = catalog.categories.find((c) => c.slug === listing.category);
  const ld = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage', '@id': `${url}#webpage`, url, name: seo.title, description: seo.description, inLanguage: locale,
        isPartOf: { '@type': 'WebSite', '@id': `${absolute('/')}#website`, name: 'Wody', url: absolute('/') },
        breadcrumb: { '@id': `${url}#breadcrumb` }, about: { '@id': `${url}#community` },
        primaryImageOfPage: seo.image ? { '@type': 'ImageObject', url: seo.image } : undefined,
        datePublished: listing.published_at ? new Date(listing.published_at).toISOString() : undefined,
        dateModified: listing.updated_at ? new Date(listing.updated_at).toISOString() : undefined,
      },
      {
        '@type': 'BreadcrumbList', '@id': `${url}#breadcrumb`,
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: t('seo.home'), item: absolute(localePath(locale, '/')) },
          { '@type': 'ListItem', position: 2, name: t('seo.communities'), item: absolute(localePath(locale, '/servers')) },
          ...(categoryRow ? [{ '@type': 'ListItem', position: 3, name: seo.category, item: absolute(localePath(locale, `/servers?category=${encodeURIComponent(categoryRow.slug)}`)) }] : []),
          { '@type': 'ListItem', position: categoryRow ? 4 : 3, name: listing.name, item: url },
        ],
      },
      {
        '@type': 'Organization', '@id': `${url}#community`, name: listing.name, url, description: clip(listing.short_description, 300),
        ...(listing.icon ? { logo: absolute(listing.icon) } : {}),
        ...(seo.image ? { image: seo.image } : {}),
        keywords: seo.keywords.join(', '),
        ...(seo.languages.length ? { knowsLanguage: listing.languages } : {}),
        ...(seo.members ? { interactionStatistic: { '@type': 'InteractionCounter', interactionType: 'https://schema.org/JoinAction', userInteractionCount: seo.members } } : {}),
        ...(listing.review_summary.count ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: listing.review_summary.average, reviewCount: listing.review_summary.count, bestRating: 5, worstRating: 1 } } : {}),
      },
    ],
  };
  return (
    <div className="min-h-screen">
      <TopNav />
      <main id="main-content" className="w-full">
        <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(ld)} />
        <ViewPing slug={listing.slug} />
        <ListingView
          listing={listing}
          catalog={catalog}
          similar={similar}
          fullBleed
          slots={{
            footerNote: <p className="pt-2 text-center text-xs text-white/55">{t('profile.disclaimer')}</p>,
            heroActions: <ProfileInteractive slug={listing.slug} part="buttons" />,
            reviews: <ProfileInteractive slug={listing.slug} part="reviews" summary={listing.review_summary} />,
          }}
        />
      </main>
      <Footer />
    </div>
  );
}

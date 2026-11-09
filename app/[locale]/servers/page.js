import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Compass, Search, Heart, Plus, BookOpen } from 'lucide-react';
import { Footer, TopNav } from '@/components/nav';
import { Link } from '@/i18n/navigation';
import ServerCard from '@/components/community/ServerCard';
import DiscoveryFilters from '@/components/community/DiscoveryFilters';
import Highlights from '@/components/community/Highlights';
import { cdb, getCatalog, getSettings } from '@/lib/community/db';
import { cachedSearchListings, discoveryHome, featuredListings } from '@/lib/community/query';
import { parseSearchParams } from '@/lib/community/api-public';
import { catalogName } from '@/lib/community/names';
import { SORTS } from '@/lib/community/constants';
import { routing } from '@/i18n/routing';
import { ROBOTS_INDEX, absolute, jsonLd, localePath, localizedAlternates, ogLocale } from '@/lib/community/seo';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
const SITE_URL = (process.env.NEXT_PUBLIC_BASE_URL || 'https://wody.online').replace(/\/+$/, '');

const hasFilters = (p) => Boolean(p.q || p.category || p.subcategory || p.tags.length || p.languages.length || p.features.length || p.members || p.activity || p.server_type || p.page);

export async function generateMetadata({ params, searchParams }) {
  const { locale } = await params;
  const sp = parseSearchParams(await searchParams);
  const t = await getTranslations({ locale, namespace: 'community' });
  const path = locale === routing.defaultLocale ? '/servers' : `/${locale}/servers`;
  const indexable = !hasFilters(sp) && sp.sort === 'recommended';
  return {
    title: { absolute: t('seo.title') },
    description: t('seo.description'),
    keywords: t('seo.keywords').split(',').map((k) => k.trim()).filter(Boolean),
    alternates: localizedAlternates(locale, '/servers'),
    robots: indexable ? ROBOTS_INDEX : { index: false, follow: true },
    openGraph: { title: t('seo.title'), description: t('seo.description'), url: `${SITE_URL}${path}`, type: 'website', siteName: 'Wody', ...ogLocale(locale), images: [{ url: absolute('/opengraph-image') }] },
    twitter: { card: 'summary_large_image', title: t('seo.title'), description: t('seo.description') },
  };
}

function Section({ id, title, children, action }) {
  return (
    <section aria-labelledby={id} className="mb-12">
      <div className="mb-4 flex items-end justify-between gap-3">
        <h2 id={id} className="text-xl font-bold sm:text-2xl">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

const Grid = ({ children }) => <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{children}</div>;

function qs(base, patch) {
  const u = new URLSearchParams();
  const merged = { ...base, ...patch };
  for (const [k, v] of Object.entries(merged)) {
    if (v == null || v === '' || (Array.isArray(v) && !v.length)) continue;
    if (k === 'page' && !Number(v)) continue;
    u.set(k, Array.isArray(v) ? v.join(',') : String(v));
  }
  const s = u.toString();
  return s ? `/servers?${s}` : '/servers';
}

export default async function ServersPage({ params, searchParams }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('community');
  const sp = parseSearchParams(await searchParams);
  const db = await cdb();
  const browsing = hasFilters(sp);
  const searching = browsing || sp.sort !== 'recommended';
  const [catalog, settings, home, catFeatured] = await Promise.all([
    getCatalog(db),
    searching ? getSettings(db) : null,
    searching ? null : discoveryHome(db),
    sp.category ? featuredListings(db, 'category', 4, sp.category) : [],
  ]);
  const base = { q: sp.q, category: sp.category, sub: sp.subcategory, tags: sp.tags, lang: sp.languages, features: sp.features, members: sp.members, activity: sp.activity, type: sp.server_type, sort: sp.sort };
  const results = searching ? await cachedSearchListings(db, { ...sp, size: settings.discovery_page_size }) : null;
  const listed = [];
  const seen = new Set();
  for (const card of (results?.items || [...(home?.featured || []), ...(home?.recommended || []), ...(home?.popular || []), ...(home?.fresh || [])])) {
    if (card?.slug && card.path && !seen.has(card.slug)) { seen.add(card.slug); listed.push(card); }
  }
  const pageUrl = absolute(localePath(locale, '/servers'));
  const ld = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'CollectionPage', '@id': `${pageUrl}#webpage`, url: pageUrl, name: t('seo.title'), description: t('seo.description'), inLanguage: locale,
        isPartOf: { '@type': 'WebSite', '@id': `${absolute('/')}#website`, name: 'Wody', url: absolute('/') }, breadcrumb: { '@id': `${pageUrl}#breadcrumb` },
        ...(listed.length ? { mainEntity: { '@id': `${pageUrl}#list` } } : {}) },
      { '@type': 'BreadcrumbList', '@id': `${pageUrl}#breadcrumb`, itemListElement: [
        { '@type': 'ListItem', position: 1, name: t('seo.home'), item: absolute(localePath(locale, '/')) },
        { '@type': 'ListItem', position: 2, name: t('seo.communities'), item: pageUrl },
      ] },
      ...(listed.length ? [{ '@type': 'ItemList', '@id': `${pageUrl}#list`, numberOfItems: Math.min(listed.length, 30),
        itemListElement: listed.slice(0, 30).map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, url: absolute(localePath(locale, c.path)) })) }] : []),
    ],
  };

  return (
    <div className="min-h-screen">
      <TopNav />
      <main id="main-content" className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-12">
        <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(ld)} />
        <header className="mb-8 text-center">
          <p className="mx-auto mb-3 inline-flex items-center gap-2 rounded-full border border-primary/25 bg-card/70 px-3 py-1 text-xs text-muted-foreground"><Compass className="h-3.5 w-3.5" aria-hidden="true" />{t('home.badge')}</p>
          <h1 className="text-3xl font-black uppercase tracking-tight sm:text-5xl">{t('home.title')}</h1>
          <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">{t('home.subtitle')}</p>
          <form method="get" action="/servers" role="search" className="mx-auto mt-6 flex max-w-2xl gap-2">
            <label htmlFor="q" className="sr-only">{t('home.search')}</label>
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <input id="q" name="q" type="search" defaultValue={sp.q} maxLength={80} placeholder={t('home.search')} className="h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
            </div>
            <button type="submit" className="rounded-md bg-[#e6cd8c] text-[#1a1208] px-5 text-sm font-semibold hover:bg-[#f3e1b0] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e6cd8c]">{t('home.searchButton')}</button>
          </form>
          <nav aria-label={t('favorites.mine')} className="mx-auto mt-5 grid max-w-2xl grid-cols-1 gap-2 sm:grid-cols-3">
            <Link href="/servers/favorites" className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full border px-4 py-2 text-center text-sm font-semibold leading-tight transition border-rose-400/45 bg-rose-500/10 text-rose-200 hover:border-rose-300/70 hover:bg-rose-500/20"><Heart className="h-4 w-4 fill-rose-400/80 text-rose-300" aria-hidden="true" />{t('favorites.mine')}</Link>
            <Link href="/dashboard" className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full border px-4 py-2 text-center text-sm font-semibold leading-tight transition border-[#e6cd8c]/45 bg-[#e6cd8c]/10 text-[#f0c08e] hover:bg-[#e6cd8c]/20"><Plus className="h-4 w-4" aria-hidden="true" />{t('home.listYours')}</Link>
            <Link href="/servers/guidelines" className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full border px-4 py-2 text-center text-sm font-semibold leading-tight transition border-border/70 bg-card/50 text-muted-foreground hover:text-foreground"><BookOpen className="h-4 w-4" aria-hidden="true" />{t('guidelines.link')}</Link>
          </nav>
        </header>

        {results ? (
          <div className="grid gap-6 lg:grid-cols-[17rem_1fr]">
            <div><DiscoveryFilters catalog={catalog} params={sp} /></div>
            <div>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground" role="status">{t('results.count', { count: results.total })}</p>
                <nav aria-label={t('results.sort')} className="flex flex-wrap gap-1.5">
                  {SORTS.map((s) => <Link key={s} href={qs(base, { sort: s, page: 0 })} aria-current={sp.sort === s ? 'true' : undefined} className={`rounded-full border px-3 py-1 text-xs ${sp.sort === s ? 'border-[#e6cd8c] bg-[#e6cd8c]/20' : 'border-border/60 text-muted-foreground hover:bg-secondary/50'}`}>{t(`sort.${s}`)}</Link>)}
                </nav>
              </div>
              {catFeatured.length && !sp.page ? <div className="mb-6"><h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t('home.featured')}</h2><Grid>{catFeatured.map((s) => <ServerCard key={s.slug} server={s} catalog={catalog} />)}</Grid></div> : null}
              {results.items.length ? <Grid>{results.items.map((s, i) => <ServerCard key={s.slug} server={s} catalog={catalog} priority={i < 4} />)}</Grid> : (
                <div className="rounded-2xl border border-dashed border-border/70 bg-secondary/10 px-6 py-14 text-center"><p className="font-semibold">{t('results.emptyTitle')}</p><p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{t('results.emptyText')}</p><Link href="/servers" className="mt-4 inline-block text-sm text-[#e08a4e] underline-offset-4 hover:underline">{t('filters.reset')}</Link></div>
              )}
              {results.pages > 1 ? (
                <nav aria-label={t('results.pagination')} className="mt-8 flex items-center justify-center gap-3">
                  {sp.page > 0 ? <Link href={qs(base, { page: sp.page - 1 })} rel="prev" className="rounded-md border border-border/60 px-4 py-2 text-sm hover:bg-secondary/50">{t('common.previous')}</Link> : null}
                  <span className="text-sm text-muted-foreground">{t('results.page', { page: sp.page + 1, pages: results.pages })}</span>
                  {sp.page + 1 < results.pages ? <Link href={qs(base, { page: sp.page + 1 })} rel="next" className="rounded-md border border-border/60 px-4 py-2 text-sm hover:bg-secondary/50">{t('common.next')}</Link> : null}
                </nav>
              ) : null}
            </div>
          </div>
        ) : (
          <>
            <Highlights />
            {home.featured.length ? <Section id="featured" title={t('home.featured')}><Grid>{home.featured.map((s, i) => <ServerCard key={s.slug} server={s} catalog={catalog} priority={i < 4} />)}</Grid></Section> : null}
            <Section id="categories" title={t('home.browse')}>
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                {home.categories.map((c) => (
                  <li key={c.slug}><Link href={`/servers?category=${c.slug}`} className="flex h-full flex-col rounded-xl border border-border/60 bg-card/50 p-4 transition hover:border-[#e6cd8c]/60 hover:bg-card focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#e6cd8c] motion-reduce:transition-none"><span className="font-semibold">{catalogName(t, 'categories', c, locale)}</span><span className="mt-1 text-xs text-muted-foreground">{t('home.communities', { count: c.count })}</span></Link></li>
                ))}
              </ul>
            </Section>
            {[['bumped', home.bumped, 'bumped'], ['popular', home.popular, 'popular'], ['growing', home.growing, 'growing'], ['fresh', home.fresh, 'newest'], ['recommended', home.recommended, 'recommended']].map(([key, list, sort]) => list.length ? (
              <Section key={key} id={key} title={t(`home.${key}`)} action={<Link href={`/servers?sort=${sort}&page=0`} className="text-sm text-[#e08a4e] underline-offset-4 hover:underline">{t('home.seeAll')}</Link>}>
                <Grid>{list.slice(0, 4).map((s) => <ServerCard key={s.slug} server={s} catalog={catalog} />)}</Grid>
              </Section>
            ) : null)}
            {!home.recommended.length ? (
              <div className="rounded-2xl border border-dashed border-border/70 bg-secondary/10 px-6 py-16 text-center"><p className="text-lg font-semibold">{t('home.emptyTitle')}</p><p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{t('home.emptyText')}</p><Link href="/dashboard" className="mt-4 inline-block rounded-md bg-[#e6cd8c] text-[#1a1208] px-5 py-2 text-sm font-semibold">{t('home.listYours')}</Link></div>
            ) : null}
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}

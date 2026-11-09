import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
import { ArrowRight, Sparkles } from 'lucide-react';
import { Footer, TopNav } from '@/components/nav';
import { ICONS } from '@/components/module-preview-content';
import { MODULE_SEO_SLUGS } from '@/lib/module-seo';
import { OG_IMAGES, TWITTER_CARD } from '@/lib/seo-social';

const SITE_URL = (process.env.NEXT_PUBLIC_BASE_URL || 'https://wody.online').replace(/\/+$/, '');

export const revalidate = 3600;

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

function urlFor(locale, path) {
  return `${SITE_URL}${locale === routing.defaultLocale ? '' : `/${locale}`}${path}`;
}

export async function generateMetadata({ params }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'modulesHub' });
  const languages = Object.fromEntries(routing.locales.map((l) => [l, urlFor(l, '/modules')]));
  languages['x-default'] = `${SITE_URL}/modules`;
  return {
    title: { absolute: t('metaTitle') },
    description: t('metaDescription'),
    alternates: { canonical: urlFor(locale, '/modules'), languages },
    robots: { index: true, follow: true },
    twitter: TWITTER_CARD,
      openGraph: { images: OG_IMAGES, title: t('ogTitle'), description: t('metaDescription'), url: urlFor(locale, '/modules'), type: 'website', locale },
  };
}

export default async function ModulesHubPage({ params }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'modulesHub' });
  const tc = await getTranslations({ locale, namespace: 'moduleCard' });
  const modules = (await getTranslations({ locale, namespace: 'landing' })).raw('modulesDetail').filter((m) => MODULE_SEO_SLUGS.includes(m.key));

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: t('home'), item: urlFor(locale, '/') },
          { '@type': 'ListItem', position: 2, name: t('breadcrumb'), item: urlFor(locale, '/modules') },
        ],
      },
      {
        '@type': 'CollectionPage',
        name: t('metaTitle'),
        description: t('metaDescription'),
        url: urlFor(locale, '/modules'),
        mainEntity: {
          '@type': 'ItemList',
          itemListElement: modules.map((m, i) => ({ '@type': 'ListItem', position: i + 1, name: m.title, url: urlFor(locale, `/modules/${m.key}`) })),
        },
      },
    ],
  };

  return (
    <div className="relative min-h-screen overflow-x-hidden">
      <div className="absolute inset-0 pointer-events-none -z-10">
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full bg-[#7c3010]/20 blur-3xl" />
      </div>
      <TopNav />
      <main id="main-content" className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12 md:py-16">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
        <header className="max-w-3xl mx-auto text-center mb-10 md:mb-14">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight leading-tight">{t('title')}</h1>
          <p className="mt-4 text-base sm:text-lg text-muted-foreground leading-relaxed">{t('subtitle')}</p>
        </header>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {modules.map((m) => {
            const Icon = ICONS[m.key] || Sparkles;
            return (
              <li key={m.key} className="flex flex-col rounded-2xl border border-border/70 bg-card/45 backdrop-blur-sm p-5">
                <div className="flex items-center gap-3 mb-3">
                  <span className="module-icon-wrap w-10 h-10 rounded-xl flex items-center justify-center"><Icon className="w-[18px] h-[18px]" /></span>
                  <h2 className="font-semibold text-base">{m.title}</h2>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">{m.desc}</p>
                <Link href={`/modules/${m.key}`} className="mt-auto pt-4 inline-flex items-center gap-1.5 text-sm font-medium text-[#e6cd8c] hover:underline underline-offset-4">
                  {tc('learnMore')} <span className="sr-only">: {m.title}</span><ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </li>
            );
          })}
        </ul>
      </main>
      <Footer />
    </div>
  );
}

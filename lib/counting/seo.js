// Metadata and structured data for the public Counting pages (list, one game, help).
import { routing } from '@/i18n/routing';
import { moduleOgImages, moduleTwitter } from '@/lib/seo-social';

const SITE = process.env.NEXT_PUBLIC_BASE_URL || 'https://wody.online';
export const urlFor = (locale, path) => `${SITE}${locale === routing.defaultLocale ? '' : `/${locale}`}${path}`;

export function countingMetadata({ locale, path, title, description, index = true }) {
  const languages = Object.fromEntries(routing.locales.map((l) => [l, urlFor(l, path)]));
  languages['x-default'] = `${SITE}${path}`;
  return {
    title: { absolute: title }, description,
    alternates: { canonical: urlFor(locale, path), languages },
    robots: { index, follow: true },
    twitter: moduleTwitter('counting', locale),
    openGraph: { images: moduleOgImages('counting', locale), title, description, url: urlFor(locale, path), type: 'website', locale },
  };
}

export const ldScript = (data) => JSON.stringify(data).replace(/</g, '\\u003c');

export function listJsonLd({ locale, t, games }) {
  const url = urlFor(locale, '/counting');
  return {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'CollectionPage', '@id': `${url}#page`, url, name: t('seo.listTitle'), inLanguage: locale, description: t('seo.listDescription'), isPartOf: { '@type': 'WebSite', name: 'Wody', url: SITE } },
      { '@type': 'ItemList', itemListElement: games.slice(0, 20).map((g, i) => ({ '@type': 'ListItem', position: i + 1, url: urlFor(locale, `/counting/${g.channel_id}`), name: g.name || `#${g.channel_id.slice(-4)}` })) },
      { '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Wody', item: urlFor(locale, '/') }, { '@type': 'ListItem', position: 2, name: t('seo.breadcrumb'), item: url }] },
    ],
  };
}

export function gameJsonLd({ locale, t, game }) {
  const url = urlFor(locale, `/counting/${game.channel_id}`);
  const name = game.name || t('seo.gameFallback');
  return {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'WebPage', '@id': `${url}#page`, url, name, inLanguage: locale, description: t('seo.gameDescription', { name, record: game.highest_index, total: game.stats.total_valid }), isPartOf: { '@type': 'WebSite', name: 'Wody', url: SITE } },
      { '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Wody', item: urlFor(locale, '/') },
        { '@type': 'ListItem', position: 2, name: t('seo.breadcrumb'), item: urlFor(locale, '/counting') },
        { '@type': 'ListItem', position: 3, name, item: url }] },
    ],
  };
}

export function faqJsonLd({ locale, t, keys }) {
  const url = urlFor(locale, '/counting/help');
  return {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'FAQPage', '@id': `${url}#faq`, url, inLanguage: locale, mainEntity: keys.map((k) => ({ '@type': 'Question', name: t(`help.faq.${k}.q`), acceptedAnswer: { '@type': 'Answer', text: t(`help.faq.${k}.a`) } })) },
      { '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Wody', item: urlFor(locale, '/') },
        { '@type': 'ListItem', position: 2, name: t('seo.breadcrumb'), item: urlFor(locale, '/counting') },
        { '@type': 'ListItem', position: 3, name: t('help.title'), item: url }] },
    ],
  };
}

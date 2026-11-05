// Metadata and structured data for the public Statistics help page.
import { routing } from '@/i18n/routing';
import { moduleOgImages, moduleTwitter } from '@/lib/seo-social';

const SITE = process.env.NEXT_PUBLIC_BASE_URL || 'https://wody.online';
export const urlFor = (locale, path) => `${SITE}${locale === routing.defaultLocale ? '' : `/${locale}`}${path}`;
export const FAQ_KEYS = ['what', 'start', 'privacy', 'participants', 'score', 'classes', 'retention', 'access', 'accuracy'];
export const ldScript = (data) => JSON.stringify(data).replace(/</g, '\\u003c');

export function statisticsMetadata({ locale, path, title, description }) {
  const languages = Object.fromEntries(routing.locales.map((l) => [l, urlFor(l, path)]));
  languages['x-default'] = `${SITE}${path}`;
  return {
    title: { absolute: title }, description,
    alternates: { canonical: urlFor(locale, path), languages },
    robots: { index: true, follow: true },
    twitter: moduleTwitter('statistics', locale),
    openGraph: { images: moduleOgImages('statistics', locale), title, description, url: urlFor(locale, path), type: 'website', locale },
  };
}

export function faqJsonLd({ locale, t }) {
  const url = urlFor(locale, '/statistics/help');
  return {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'FAQPage', '@id': `${url}#faq`, url, name: t('title'), inLanguage: locale, description: t('seo.description'),
        isPartOf: { '@type': 'WebSite', name: 'Wody', url: SITE },
        mainEntity: FAQ_KEYS.map((k) => ({ '@type': 'Question', name: t(`faq.${k}.q`), acceptedAnswer: { '@type': 'Answer', text: t(`faq.${k}.a`) } })) },
      { '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Wody', item: urlFor(locale, '/') },
        { '@type': 'ListItem', position: 2, name: t('seo.breadcrumb'), item: url }] },
    ],
  };
}

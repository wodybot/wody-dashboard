// Metadata, Open Graph and structured data of a studio page. The Owner writes the title and description; the rest comes from the season.
import { routing } from '@/i18n/routing';
import { moduleOgImages, moduleTwitter } from '@/lib/seo-social';
import { absoluteImage } from '@/lib/site-image-path';

const SITE = process.env.NEXT_PUBLIC_BASE_URL || 'https://wody.online';
const urlFor = (locale, path) => `${SITE}${locale === routing.defaultLocale ? '' : `/${locale}`}${path}`;

export function studioMetadata({ locale, data, t }) {
  const { config, season, page } = data;
  const path = `/battlepass/${page.slug}`;
  const ogImage = absoluteImage(config.seo.og_image, SITE);
  const title = config.seo.title || config.hero.title || season.name;
  const description = config.seo.description || season.description || t('seo.globalDescription');
  const languages = Object.fromEntries(routing.locales.map((l) => [l, urlFor(l, path)]));
  languages['x-default'] = `${SITE}${path}`;
  // A server season page is indexable only when the Owner did not switch indexing off; a Premium server page is never promoted.
  const index = !config.seo.noindex && season.scope === 'global';
  return {
    title: { absolute: title }, description, alternates: { canonical: urlFor(locale, path), languages }, robots: { index, follow: true },
    twitter: { ...moduleTwitter('battlepass', locale), ...(ogImage ? { images: [ogImage] } : {}) },
    openGraph: { images: ogImage ? [{ url: ogImage }] : moduleOgImages('battlepass', locale), title, description, url: urlFor(locale, path), type: 'website', locale },
  };
}

export function studioJsonLd({ locale, data, t }) {
  const { config, season, page } = data;
  const url = urlFor(locale, `/battlepass/${page.slug}`);
  const name = config.seo.title || season.name;
  const graph = [
    { '@type': 'WebPage', '@id': `${url}#page`, url, name, inLanguage: locale, isPartOf: { '@type': 'WebSite', name: 'Wody', url: SITE }, description: config.seo.description || season.description || t('seo.globalDescription') },
    { '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Wody', item: urlFor(locale, '/') }, { '@type': 'ListItem', position: 2, name: 'Battle Pass', item: urlFor(locale, '/battlepass') }, { '@type': 'ListItem', position: 3, name, item: url }] },
  ];
  if (config.faq.length) graph.push({ '@type': 'FAQPage', mainEntity: config.faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) });
  if (season.starts_at && season.ends_at) {
    graph.push({ '@type': 'Event', name, startDate: season.starts_at, endDate: season.ends_at, eventAttendanceMode: 'https://schema.org/OnlineEventAttendanceMode', eventStatus: 'https://schema.org/EventScheduled', location: { '@type': 'VirtualLocation', url }, organizer: { '@type': 'Organization', name: 'Wody', url: SITE } });
  }
  return { '@context': 'https://schema.org', '@graph': graph };
}

// Metadata and structured data for the public Battle Pass pages. Pages with a Global season are indexable;
// per-server pages are indexable only when they describe a season that runs (decided by the caller through t keys).
import { routing } from '@/i18n/routing';
import { moduleOgImages, moduleTwitter } from '@/lib/seo-social';

const SITE = process.env.NEXT_PUBLIC_BASE_URL || 'https://wody.online';
const urlFor = (locale, path) => `${SITE}${locale === routing.defaultLocale ? '' : `/${locale}`}${path}`;

export function passMetadata({ locale, path, t, scope, name = '' }) {
  const params = { name: name || 'Wody' };
  const title = scope === 'global' ? t('seo.globalTitle') : t('seo.serverTitle', params);
  const description = scope === 'global' ? t('seo.globalDescription') : t('seo.serverDescription', params);
  const languages = Object.fromEntries(routing.locales.map((l) => [l, urlFor(l, path)]));
  languages['x-default'] = `${SITE}${path}`;
  return {
    title: { absolute: title }, description,
    alternates: { canonical: urlFor(locale, path), languages },
    robots: { index: scope === 'global', follow: true },
    twitter: moduleTwitter('battlepass', locale),
    openGraph: { images: moduleOgImages('battlepass', locale), title, description, url: urlFor(locale, path), type: 'website', locale },
  };
}

export function passJsonLd({ locale, path, t, season, guildName = '' }) {
  const url = urlFor(locale, path);
  const name = season?.name || t('seo.globalTitle');
  const graph = [
    { '@type': 'WebPage', '@id': `${url}#page`, url, name, inLanguage: locale, isPartOf: { '@type': 'WebSite', name: 'Wody', url: SITE },
      description: season?.description || t('seo.globalDescription') },
    { '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Wody', item: urlFor(locale, '/') },
      { '@type': 'ListItem', position: 2, name: guildName || t('seo.breadcrumb'), item: url }] },
  ];
  if (season?.starts_at && season?.ends_at) {
    graph.push({ '@type': 'Event', name, startDate: season.starts_at, endDate: season.ends_at, eventAttendanceMode: 'https://schema.org/OnlineEventAttendanceMode',
      eventStatus: 'https://schema.org/EventScheduled', location: { '@type': 'VirtualLocation', url }, organizer: { '@type': 'Organization', name: 'Wody', url: SITE } });
  }
  return { '@context': 'https://schema.org', '@graph': graph };
}

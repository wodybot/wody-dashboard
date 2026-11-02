// SEO helpers for the public Community Discovery pages: localized URLs with hreflang alternates,
// clean meta descriptions and Open Graph locales. Everything is generated automatically from the
// listing data, so owners never have to write SEO text themselves.
import { routing } from '@/i18n/routing';

export const SITE_URL = (process.env.NEXT_PUBLIC_BASE_URL || 'https://wody.online').replace(/\/+$/, '');

export const OG_LOCALES = { en: 'en_US', ro: 'ro_RO', de: 'de_DE', es: 'es_ES', fr: 'fr_FR', it: 'it_IT', nl: 'nl_NL', pt: 'pt_PT', tr: 'tr_TR' };

// '/servers' -> '/servers' for the default locale, '/ro/servers' for the others.
export function localePath(locale, path) {
  return locale === routing.defaultLocale ? path : `/${locale}${path}`;
}

export function absolute(url) {
  if (!url) return null;
  return /^https?:\/\//.test(url) ? url : `${SITE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
}

// canonical + hreflang for every language + x-default, ready for Next's `alternates`.
export function localizedAlternates(locale, path) {
  return {
    canonical: localePath(locale, path),
    languages: {
      ...Object.fromEntries(routing.locales.map((l) => [l, absolute(localePath(l, path))])),
      'x-default': absolute(localePath(routing.defaultLocale, path)),
    },
  };
}

export function ogLocale(locale) {
  return {
    locale: OG_LOCALES[locale] || 'en_US',
    alternateLocale: routing.locales.filter((l) => l !== locale).map((l) => OG_LOCALES[l]).filter(Boolean),
  };
}

// One line of plain text, cut on a word boundary (search engines show about 155-160 characters).
export function clip(text, max = 158) {
  const s = String(text || '')
    .replace(/[*_`~>#|[\]]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (s.length <= max) return s;
  const cut = s.slice(0, max - 1);
  const space = cut.lastIndexOf(' ');
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,.;:\u2013-]+$/, '')}…`;
}

export function languageNames(codes = [], locale = 'en') {
  let dn = null;
  try { dn = new Intl.DisplayNames([locale], { type: 'language' }); } catch { dn = null; }
  return codes.map((c) => {
    try { return (dn && dn.of(c)) || c; } catch { return c; }
  });
}

export const ROBOTS_INDEX = {
  index: true,
  follow: true,
  googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1, 'max-video-preview': -1 },
};

export function jsonLd(data) {
  return { __html: JSON.stringify(data).replace(/</g, '\\u003c') };
}

import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['en', 'ro', 'fr', 'it', 'de', 'es', 'pt', 'nl', 'tr'],
  defaultLocale: 'en',
  localePrefix: 'as-needed',
  localeCookie: false,
  localeDetection: false,
});

export const LOCALE_LABELS = {
  en: 'English',
  ro: 'Română',
  fr: 'Français',
  it: 'Italiano',
  de: 'Deutsch',
  es: 'Español',
  pt: 'Português',
  nl: 'Nederlands',
  tr: 'Türkçe',
};

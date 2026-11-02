import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['en', 'ro', 'fr', 'it', 'de', 'es', 'pt', 'nl', 'tr'],
  defaultLocale: 'en',
  localePrefix: 'as-needed',
  // Locale persistence is handled explicitly after preference consent.
  localeCookie: false,
  // The site must always start in English; it must never auto-switch based
  // on the visitor's browser/Accept-Language settings. Locale only changes
  // when the visitor explicitly picks one from the language selector, which
  // itself only appears after cookie consent for Preferences is given.
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

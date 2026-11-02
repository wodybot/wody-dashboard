import { NextResponse } from 'next/server';
import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

// Kept in sync with components/cookie-consent.js (CONSENT_COOKIE) and
// components/language-switcher.jsx (LOCALE_COOKIE). Not imported directly
// because those are client components; the cookie *names* and the shape of
// the consent payload are the only things middleware needs.
const CONSENT_COOKIE = 'wody_cookie_consent';
const LOCALE_COOKIE = 'wody_language';

const intlMiddleware = createMiddleware(routing);

// Mirrors readCookieConsent() in components/cookie-consent.js.
function preferencesAllowed(request) {
  const raw = request.cookies.get(CONSENT_COOKIE)?.value;
  if (!raw) return false;
  try {
    const parsed = JSON.parse(decodeURIComponent(raw));
    if (!parsed || typeof parsed !== 'object') return false;
    if (!['accepted', 'rejected', 'custom'].includes(parsed.choice)) return false;
    return parsed.preferences === true;
  } catch {
    return false;
  }
}

// Returns the locale segment of the pathname (e.g. 'ro' for '/ro/dashboard'),
// or null if the path has no locale prefix.
function localeFromPathname(pathname) {
  const segment = pathname.split('/')[1];
  return routing.locales.includes(segment) ? segment : null;
}

export default function middleware(request) {
  const { pathname } = request.nextUrl;
  const allowed = preferencesAllowed(request);
  const pathLocale = localeFromPathname(pathname);

  // NOTE: there used to be a block here that force-redirected any direct
  // visit to a locale-prefixed URL (e.g. /ro/premium) back to the
  // unprefixed English page whenever the "Preferences" cookie category
  // hadn't been accepted yet. That never touched consent or cookies itself
  // (visiting /ro/premium sets nothing), it just stopped the page from
  // rendering in that language, which meant Googlebot (never has cookies)
  // was permanently redirected away from every non-English URL in the
  // sitemap, and any shared /ro/... link bounced a first-time visitor to
  // English. Removed. The two things that must actually be gated behind
  // consent are handled elsewhere and are untouched by this:
  //   - The language switcher only renders after consent and only writes
  //     wody_language after consent (components/language-switcher.jsx).
  //   - No locale is ever auto-selected from a visitor's browser/IP
  //     (routing.localeDetection is false), so nobody lands on a non-English
  //     page unless they navigated there themselves or it's what a URL
  //     (e.g. from the switcher, or a search result) explicitly pointed to.
  // First-time, unprefixed visits still default to English exactly as
  // before, that behavior comes from routing.defaultLocale + as-needed
  // prefixes and isn't part of this block at all.

  // Once Preferences is accepted and a language has been chosen, that choice
  // must stick across full page loads too, e.g. returning from the Discord
  // OAuth round trip, which always lands back on an unprefixed (English)
  // URL. If the visitor is on an unprefixed path but has a saved, non-English
  // preference, send them back to their chosen language instead of silently
  // falling back to English.
  if (allowed && !pathLocale) {
    const preferred = request.cookies.get(LOCALE_COOKIE)?.value;
    if (preferred && preferred !== routing.defaultLocale && routing.locales.includes(preferred)) {
      const url = request.nextUrl.clone();
      url.pathname = pathname === '/' ? `/${preferred}` : `/${preferred}${pathname}`;
      return NextResponse.redirect(url);
    }
  }

  return intlMiddleware(request);
}

export const config = {
  // Match all paths except: api routes, the YouTube WebSub callback
  // (app/websub/youtube/[channelId]/route.js, must stay reachable by
  // Google's hub exactly as-is, with no locale redirect/rewrite ever
  // applied to it), Next.js internals, static files (anything with a file
  // extension, e.g. favicon.ico), and Next's generated metadata routes.
  //
  // icon$ and opengraph-image$ are listed explicitly (not just caught by
  // the file-extension check below) because app/icon.js and
  // app/opengraph-image.js are dynamic route handlers that serve at
  // exactly /icon and /opengraph-image, with NO extension in the URL
  // path, so `.*\..*` never matched them. Without this exclusion the
  // next-intl middleware treated /icon as a normal page path, tried to
  // rewrite it under a locale (e.g. /en/icon), and since that route only
  // exists at the app root (outside app/[locale]/), that rewrite 404'd on
  // every request. That's why the logo/favicon stopped showing in the
  // browser tab and why Google Search stopped picking it up (it was
  // fetching a 404 at /icon, not a missing file).
  matcher: ['/((?!api|websub|_next|icon$|opengraph-image$|.*\\..*).*)'],
};

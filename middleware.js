import { NextResponse } from 'next/server';
import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

const CONSENT_COOKIE = 'wody_cookie_consent';
const LOCALE_COOKIE = 'wody_language';

const intlMiddleware = createMiddleware(routing);

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

function localeFromPathname(pathname) {
  const segment = pathname.split('/')[1];
  return routing.locales.includes(segment) ? segment : null;
}

export default function middleware(request) {
  const { pathname } = request.nextUrl;
  const allowed = preferencesAllowed(request);
  const pathLocale = localeFromPathname(pathname);


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
  matcher: ['/((?!api|websub|_next|icon$|opengraph-image$|.*\\..*).*)'],
};

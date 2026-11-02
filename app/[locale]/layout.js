import '../globals.css';
import { Suspense } from 'react';
import { NextIntlClientProvider, hasLocale } from 'next-intl';
import { getTranslations, getMessages, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Toaster } from 'sonner';
import CookieNotice from '@/components/cookie-notice';
import CountdownBanner from '@/components/countdown-banner';
import { getCountdownBanner } from '@/lib/countdown-banner';
import { COMMUNITY_INVITE, TIKTOK_URL, YOUTUBE_URL } from '@/lib/content';
import { routing } from '@/i18n/routing';
import { SeasonConfigProvider } from '@/components/seasonal/seasonal-context';
import SeasonalEffectsMount from '@/components/seasonal/seasonal-effects-mount';

const SITE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://wody.online';
const SITE_NAME = 'Wody';

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

// og:locale wants underscore form, e.g. en_US, ro_RO.
const OG_LOCALE_MAP = {
  en: 'en_US', ro: 'ro_RO', fr: 'fr_FR', it: 'it_IT', de: 'de_DE',
  es: 'es_ES', pt: 'pt_PT', nl: 'nl_NL', tr: 'tr_TR',
};

export async function generateMetadata({ params }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  // Runs for every single page (this is the root locale layout), so any
  // unguarded failure here, even a transient one, previously crashed the
  // ENTIRE page, not just a missing bit of metadata, and always with this
  // exact generic "Server Components render" error the browser console
  // showed. Falling back to a minimal, still-valid metadata object means
  // a translation hiccup costs a page's SEO title, never the whole page.
  // notFound() above stays OUTSIDE this try: it's intentional Next.js
  // control flow (a special thrown value that produces the 404 page),
  // not a failure to recover from, so it must keep propagating untouched.
  try {
    const t = await getTranslations({ locale, namespace: 'meta' });

    const title = t('title');
    const description = t('description');

    const languages = {
      ...Object.fromEntries(routing.locales.map((l) => [l, `${SITE_URL}${l === routing.defaultLocale ? '' : `/${l}`}`])),
      'x-default': SITE_URL,
    };

    return {
      metadataBase: new URL(SITE_URL),
      title: { default: title, template: '%s' },
      description,
      keywords: t.raw('keywords'),
      applicationName: SITE_NAME,
      authors: [{ name: 'Wody' }],
      creator: 'Wody',
      publisher: 'Wody',
      alternates: {
        canonical: locale === routing.defaultLocale ? '/' : `/${locale}`,
        languages,
      },
      robots: {
        index: true,
        follow: true,
        googleBot: {
          index: true,
          follow: true,
          'max-image-preview': 'large',
          'max-snippet': -1,
          'max-video-preview': -1,
        },
      },
      openGraph: {
        type: 'website',
        url: SITE_URL,
        siteName: SITE_NAME,
        title,
        description,
        locale: OG_LOCALE_MAP[locale] || 'en_US',
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
      },
      verification: {
        google: 'YeUwZqA5A-XV_qFbBfbK0MNrTj7ozPkVYlQ6IcfmctA',
      },
    };
  } catch (error) {
    console.error('generateMetadata failed, serving minimal fallback metadata', error);
    return {
      metadataBase: new URL(SITE_URL),
      title: { default: SITE_NAME, template: '%s' },
      applicationName: SITE_NAME,
    };
  }
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

// Its own small async component, rather than an inline await in
// LocaleLayout, specifically so the <Suspense> boundary below can let the
// REST of the page (children) render and stream immediately instead of
// waiting on this one query. Awaiting getCountdownBanner() directly inside
// LocaleLayout, as this used to do, made every single page's response
// wait on a Mongo round trip before anything (not just the banner) could
// render, which is both "the whole site feels slow" and, stacked on a
// page that already does its own slower work (like /team resolving many
// Discord user lookups), enough added latency to trip the platform's
// request timeout and show as a hard error. getCountdownBanner() itself
// still has its own unstable_cache (60s) and already returns safe
// defaults on any failure (see lib/countdown-banner.js), this only
// changes WHEN that result is allowed to block rendering: never the main
// content, only this one banner slot.
async function CountdownBannerServer() {
  const config = await getCountdownBanner();
  return <CountdownBanner initialConfig={config} />;
}

export default async function LocaleLayout({ children, params }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  // Enables static rendering for this locale's request-config lookups.
  setRequestLocale(locale);

  // Wrapped: this whole block runs for every single page. An unguarded
  // failure here previously crashed the entire page with the same
  // generic "Server Components render" error generateMetadata's fallback
  // above now avoids for the metadata half of the same problem. messages
  // falling back to {} still renders the page (client components read
  // whatever they can from an empty message set rather than the request
  // failing outright); getTranslations/getMessages are local file reads
  // bundled with the app, not network calls, so this is a low-probability
  // safety net, not an expected everyday path.
  let description = '';
  let messages = {};
  let jsonLd = null;
  let organizationJsonLd = null;
  // Declared here (not `const t = ...` inside the try below) because the
  // JSX further down uses t('skipToContent') OUTSIDE this try block: a
  // const scoped to the try made `t` disappear right after it, throwing
  // "ReferenceError: t is not defined" on literally every single render
  // of every single page (this layout wraps all of them). That was the
  // actual, exact cause of the generic "Server Components render" error
  // reported repeatedly, not a next-intl/dynamic-rendering conflict.
  let t = (key) => key;
  try {
    t = await getTranslations({ locale, namespace: 'meta' });
    description = t('description');

    // Perf: NextIntlClientProvider ships whatever `messages` it's given down
    // to the browser as JSON for hydration. The full per-locale message file
    // is 130-150KB because it also contains the dashboard's `guildSettings`
    // namespace (~45KB alone) plus legal/static-page copy (privacy, terms,
    // help, cookies, commands, etc.) that is only ever read server-side via
    // getTranslations() in RSCs, never through useTranslations() in a client
    // component, so the client never actually needed it. Trimming to just
    // the namespaces this layout's own client components use (nav, footer,
    // language switcher, cookie notice, the homepage bot-status/module-flip
    // cards, and the error boundary) cuts that payload by ~98% on every page
    // except the dashboard, with zero change to what's rendered. The
    // dashboard route group (app/[locale]/dashboard/layout.js) re-adds the
    // full message set for its own subtree, so nothing there is affected.
    const allMessages = await getMessages();
    const CLIENT_NAMESPACES = ['nav', 'footer', 'brand', 'botStatus', 'communityShowcase', 'moduleCard', 'errorPage', 'verifyPage', 'invite', 'collab', 'passport', 'bell', 'profile', 'humancheck', 'tiktokLink'];
    messages = Object.fromEntries(
      CLIENT_NAMESPACES.filter((ns) => ns in allMessages).map((ns) => [ns, allMessages[ns]])
    );
    // Community Discovery: the public pages (/servers, profiles, favorites, preview) render client
    // components that read the `community` namespace. The admin text and the guidelines are only used
    // on the server or inside the dashboard (which ships every message), so they are left out here.
    // Module names only (no descriptions): the homepage previews label custom images with them.
    if (allMessages.modules) {
      messages.modules = Object.fromEntries(Object.entries(allMessages.modules)
        .filter(([, v]) => v && typeof v === 'object' && v.title)
        .map(([k, v]) => [k, { title: v.title }]));
    }
    if (allMessages.community) {
      const { admin: _admin, guidelines: _guidelines, ...publicCommunity } = allMessages.community;
      messages.community = publicCommunity;
    }

    jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'Wody',
      applicationCategory: 'BrowserApplication',
      operatingSystem: 'Any',
      url: SITE_URL,
      description,
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    };

    organizationJsonLd = {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'Wody',
      url: SITE_URL,
      logo: `${SITE_URL}/icon`,
      sameAs: [COMMUNITY_INVITE, TIKTOK_URL, YOUTUBE_URL],
    };
  } catch (error) {
    console.error('LocaleLayout: failed to load translations/messages, rendering with minimal fallback', error);
  }

  // The decorative seasonal layer (Autumn, Winter or Halloween, whichever
  // the owner panel currently has picked) + its context are always
  // mounted here (SeasonConfigProvider + SeasonalEffectsMount), but both
  // are intentionally tiny client components with no SVGs, no CSS
  // keyframes, and no images of their own, they only fetch the small
  // public config JSON and, only when it says enabled: true, dynamically
  // import() the actual heavy layer (see
  // components/seasonal/seasonal-effects-mount.jsx). That runtime-
  // conditional import is what actually keeps OFF-by-default sites from
  // downloading any seasonal-specific chunk beyond this small always-on
  // bootstrap, a server-side "if" around a statically-imported client
  // component does NOT achieve that, since Next.js still registers the
  // chunk for hydration regardless of which branch renders.
  const inner = (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2.5 focus:text-primary-foreground focus:shadow-lg"
      >
        {t('skipToContent')}
      </a>
      <Suspense fallback={null}>
        <CountdownBannerServer />
      </Suspense>
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
      />
      <link
        rel="discord:component-embed"
        type="application/json"
        href={`${SITE_URL}/discord-embed.json`}
      />
      {children}
      <CookieNotice />
      <Toaster theme="dark" position="top-right" richColors closeButton />
    </>
  );

  return (
    <html lang={locale} className="dark">
      <body className="antialiased min-h-screen bg-background text-foreground">
        <div aria-hidden="true" className="ambient-glow" />
        <NextIntlClientProvider messages={messages}>
          <SeasonConfigProvider>
            <SeasonalEffectsMount />
            {inner}
          </SeasonConfigProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

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

const OG_LOCALE_MAP = {
  en: 'en_US', ro: 'ro_RO', fr: 'fr_FR', it: 'it_IT', de: 'de_DE',
  es: 'es_ES', pt: 'pt_PT', nl: 'nl_NL', tr: 'tr_TR',
};

export async function generateMetadata({ params }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

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

async function CountdownBannerServer() {
  const config = await getCountdownBanner();
  return <CountdownBanner initialConfig={config} />;
}

export default async function LocaleLayout({ children, params }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  setRequestLocale(locale);

  let description = '';
  let messages = {};
  let jsonLd = null;
  let organizationJsonLd = null;
  let t = (key) => key;
  try {
    t = await getTranslations({ locale, namespace: 'meta' });
    description = t('description');

    const allMessages = await getMessages();
    const CLIENT_NAMESPACES = ['nav', 'footer', 'brand', 'botStatus', 'communityShowcase', 'moduleCard', 'errorPage', 'verifyPage', 'invite', 'collab', 'passport', 'bell', 'profile', 'humancheck', 'tiktokLink'];
    messages = Object.fromEntries(
      CLIENT_NAMESPACES.filter((ns) => ns in allMessages).map((ns) => [ns, allMessages[ns]])
    );
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

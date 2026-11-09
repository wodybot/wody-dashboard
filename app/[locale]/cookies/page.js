
import { localizedAlternates } from '@/lib/community/seo';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { TopNav, Footer } from '@/components/nav';
import { CONTENT } from '@/lib/content';
import CookiePreferences from '@/components/cookie-preferences';
import { OG_IMAGES, TWITTER_CARD } from '@/lib/seo-social';

const SITE_URL = (process.env.NEXT_PUBLIC_BASE_URL || 'https://wody.online').replace(/\/+$/, '');

export const revalidate = 3600;

export async function generateMetadata({ params }) {
  const { locale } = await params;
  setRequestLocale(locale);
  try {
    const t = await getTranslations({ locale, namespace: 'cookies' });
    return {
      title: { absolute: `Wody - ${t('pageTitle')}` },
      description: 'Which cookies Wody uses on the dashboard and website, and why.',
      alternates: localizedAlternates(locale, '/cookies'),
      robots: { index: true, follow: true },
      twitter: TWITTER_CARD,
      openGraph: { images: OG_IMAGES,
        title: `Wody - ${t('pageTitle')}`,
        description: 'Which cookies Wody uses on the dashboard and website, and why.',
        url: `${SITE_URL}/cookies`,
        type: 'website',
      },
    };
  } catch (error) {
    console.error('cookies generateMetadata failed, serving minimal fallback metadata', error);
    return { title: { absolute: 'Cookies' }, alternates: { canonical: '/cookies' } };
  }
}

function CookieTable({ table }) {
  const [h0, h1, h2, h3, h4, h5] = table.headers;
  return (
    <div className="border-y border-[#a04820]/40 bg-card/60 overflow-hidden">
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full min-w-[820px] text-sm table-fixed">
          <colgroup>
            <col className="w-[14%]" />
            <col className="w-[9%]" />
            <col className="w-[13%]" />
            <col className="w-[38%]" />
            <col className="w-[16%]" />
            <col className="w-[10%]" />
          </colgroup>
          <thead>
            <tr className="border-b border-[#a04820]/40 bg-[#7c3010]/15">
              <th className="text-left font-semibold text-foreground px-4 py-3">{h0}</th>
              <th className="text-left font-semibold text-foreground px-4 py-3">{h1}</th>
              <th className="text-left font-semibold text-foreground px-4 py-3">{h2}</th>
              <th className="text-left font-semibold text-foreground px-4 py-3">{h3}</th>
              <th className="text-left font-semibold text-foreground px-4 py-3">{h4}</th>
              <th className="text-left font-semibold text-foreground px-4 py-3">{h5}</th>
            </tr>
          </thead>
          <tbody>
            {table.rows.map((c) => (
              <tr key={c.name} className="border-b border-[#a04820]/20 last:border-0 align-top">
                <td className="px-4 py-3 font-mono text-xs text-[#f2c091] break-words">{c.name}</td>
                <td className="px-4 py-3 text-muted-foreground">{c.provider}</td>
                <td className="px-4 py-3 text-muted-foreground">{c.category}</td>
                <td className="px-4 py-3 text-muted-foreground">{c.purpose}</td>
                <td className="px-4 py-3 text-muted-foreground">{c.duration}</td>
                <td className="px-4 py-3 text-muted-foreground">{c.consent}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="md:hidden divide-y divide-[#a04820]/20">
        {table.rows.map((c) => (
          <div key={c.name} className="p-4 space-y-2">
            <div className="font-mono text-xs text-[#f2c091]">{c.name}</div>
            <dl className="space-y-1.5 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-foreground/80 font-medium shrink-0">{table.mobileLabels.provider}</dt>
                <dd className="text-muted-foreground text-right">{c.provider}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-foreground/80 font-medium shrink-0">{table.mobileLabels.category}</dt>
                <dd className="text-muted-foreground text-right">{c.category}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-foreground/80 font-medium shrink-0">{table.mobileLabels.duration}</dt>
                <dd className="text-muted-foreground text-right">{c.duration}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-foreground/80 font-medium shrink-0">{table.mobileLabels.consent}</dt>
                <dd className="text-muted-foreground text-right">{c.consent}</dd>
              </div>
              <div className="pt-1">
                <dt className="text-foreground/80 font-medium mb-1">{table.mobileLabels.purpose}</dt>
                <dd className="text-muted-foreground">{c.purpose}</dd>
              </div>
            </dl>
          </div>
        ))}
      </div>
    </div>
  );
}

export default async function CookiePolicyPage({ params }) {
  const { locale } = await params;
  setRequestLocale(locale);
  let t, table, sections;
  try {
    t = await getTranslations({ locale, namespace: 'cookies' });
    table = t.raw('table');
    sections = t.raw('sections');
  } catch (error) {
    console.error('cookies page failed to load translations, showing degraded state', error);
    return (
      <div className="relative min-h-screen">
        <TopNav />
        <main className="max-w-2xl mx-auto px-4 py-24 text-center">
          <h1 className="text-2xl font-semibold mb-2">Cookies</h1>
          <p className="text-muted-foreground text-sm">This page couldn&apos;t load right now, please try again shortly.</p>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <TopNav />
      <main id="main-content" className="max-w-4xl mx-auto px-6 py-14">
        <h1 className="text-4xl font-bold mb-2 text-center sm:text-left">{t('pageTitle')}</h1>
        <p className="text-sm text-muted-foreground mb-10 text-center sm:text-left">{CONTENT.legal.lastUpdated}</p>

        <div className="space-y-8 text-[15px] leading-relaxed text-muted-foreground legal-content">
          {sections.map((s, i) => (
            <section key={i}>
              <h2 className="text-xl font-semibold text-foreground mb-2">{s.heading}</h2>
              <div dangerouslySetInnerHTML={{ __html: s.html }} />
              {i === 0 && <div className="mt-4"><CookieTable table={table} /></div>}
              {s.heading === '5. Changing or withdrawing your choice' && <CookiePreferences />}
            </section>
          ))}
        </div>
      </main>
      <Footer />
    </div>
  );
}

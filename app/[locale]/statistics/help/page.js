import Link from 'next/link';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Footer, TopNav } from '@/components/nav';
import { FAQ_KEYS, faqJsonLd, ldScript, statisticsMetadata } from '@/lib/statistics/seo';

export const dynamic = 'force-static';

export async function generateMetadata({ params }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'statisticsHelp' });
  return statisticsMetadata({ locale, path: '/statistics/help', title: t('seo.title'), description: t('seo.description') });
}

export default async function StatisticsHelpPage({ params }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'statisticsHelp' });
  const prefix = locale === 'en' ? '' : `/${locale}`;
  return (
    <div className="relative min-h-screen overflow-x-hidden">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldScript(faqJsonLd({ locale, t })) }} />
      <TopNav />
      <main id="main-content" className="mx-auto max-w-3xl px-4 py-12 sm:px-6 md:py-16">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{t('title')}</h1>
        <p className="mt-3 text-muted-foreground">{t('intro')}</p>
        <section className="mt-8 rounded-xl border border-border/60 bg-card/40 p-5">
          <h2 className="text-lg font-semibold">{t('summaryTitle')}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{t('summary')}</p>
        </section>
        <section className="mt-10 space-y-4" aria-label="FAQ">
          {FAQ_KEYS.map((k) => (<div key={k} className="rounded-xl border border-border/60 bg-card/50 p-5"><h2 className="font-semibold">{t(`faq.${k}.q`)}</h2><p className="mt-2 text-sm text-muted-foreground">{t(`faq.${k}.a`)}</p></div>))}
        </section>
        <p className="mt-8 text-sm"><Link className="underline" href={prefix || '/'}>{t('back')}</Link></p>
      </main>
      <Footer />
    </div>
  );
}

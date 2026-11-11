import Link from 'next/link';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Footer, TopNav } from '@/components/nav';
import { countingMetadata, faqJsonLd, ldScript } from '@/lib/counting/seo';
import { MODES } from '@/lib/counting/constants';

export const dynamic = 'force-static';
const FAQ = ['what', 'start', 'modes', 'mistake', 'saves', 'xp', 'privacy', 'public', 'battlepass', 'cheat', 'premium'];

export async function generateMetadata({ params }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'counting' });
  return countingMetadata({ locale, path: '/counting/help', title: t('seo.helpTitle'), description: t('seo.helpDescription') });
}

export default async function CountingHelpPage({ params }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'counting' });
  const prefix = locale === 'en' ? '' : `/${locale}`;
  return (
    <div className="relative min-h-screen overflow-x-hidden">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldScript(faqJsonLd({ locale, t, keys: FAQ })) }} />
      <TopNav />
      <main id="main-content" className="mx-auto max-w-3xl px-4 py-12 sm:px-6 md:py-16">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{t('help.title')}</h1>
        <p className="mt-3 text-muted-foreground">{t('help.intro')}</p>
        <section className="mt-8 rounded-xl border border-border/60 bg-card/40 p-5">
          <h2 className="text-lg font-semibold">{t('help.summaryTitle')}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{t('help.summary')}</p>
        </section>
        <section className="mt-10 space-y-4" aria-label="FAQ">
          {FAQ.map((k) => (<div key={k} className="rounded-xl border border-border/60 bg-card/50 p-5"><h2 className="font-semibold">{t(`help.faq.${k}.q`)}</h2><p className="mt-2 text-sm text-muted-foreground">{t(`help.faq.${k}.a`)}</p></div>))}
        </section>
        <section className="mt-10 rounded-xl border border-border/60 bg-card/40 p-5" aria-label={t('games.modeInfoTitle')}>
          <h2 className="text-lg font-semibold">{t('games.modeInfoTitle')}</h2>
          <dl className="mt-3 space-y-3 text-sm">
            {MODES.map((m) => (<div key={m}><dt className="font-semibold">{t(`mode.${m}`)}</dt><dd className="text-muted-foreground">{t(`modeInfo.${m}`)}</dd></div>))}
          </dl>
        </section>
        <p className="mt-8 text-sm"><Link className="underline" href={`${prefix}/counting`}>{t('help.back')}</Link></p>
      </main>
      <Footer />
    </div>
  );
}

import { getTranslations, getLocale, setRequestLocale } from 'next-intl/server';
import { Check } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { Footer, TopNav } from '@/components/nav';
import { INVITE_URL } from '@/lib/content';
import { localizedAlternates, SITE_URL, localePath, ogLocale } from '@/lib/community/seo';
import { OG_IMAGES, TWITTER_CARD } from '@/lib/seo-social';
import { SvgScene } from '@/components/scenes';

const INDEXED = new Set(['en', 'ro']);

export async function generateMetadata({ params }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'gta6Page' });
  const indexed = INDEXED.has(locale);
  return {
    title: { absolute: t('metaTitle') },
    description: t('metaDescription'),
    alternates: indexed
      ? { canonical: localePath(locale, '/gta6-discord-bot'), languages: { en: `${SITE_URL}/gta6-discord-bot`, ro: `${SITE_URL}/ro/gta6-discord-bot`, 'x-default': `${SITE_URL}/gta6-discord-bot` } }
      : localizedAlternates('en', '/gta6-discord-bot'),
    robots: indexed ? { index: true, follow: true } : { index: false, follow: true },
    twitter: TWITTER_CARD,
    openGraph: { images: OG_IMAGES, title: t('metaTitle'), description: t('metaDescription'), url: `${SITE_URL}${localePath(locale, '/gta6-discord-bot')}`, type: 'website', ...ogLocale(locale) },
  };
}

export default async function Gta6BotPage({ params }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'gta6Page' });
  const features = t.raw('features');
  const steps = t.raw('steps');
  const faq = t.raw('faq');
  const url = `${SITE_URL}${localePath(locale, '/gta6-discord-bot')}`;
  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: t('metaTitle'),
      description: t('metaDescription'),
      url,
      inLanguage: locale,
      isPartOf: { '@type': 'WebSite', name: 'Wody', url: SITE_URL },
      about: { '@type': 'SoftwareApplication', name: 'Wody', applicationCategory: 'CommunicationApplication', operatingSystem: 'Discord', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' } },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'HowTo',
      name: t('stepsTitle'),
      step: steps.map((s, i) => ({ '@type': 'HowToStep', position: i + 1, text: s })),
    },
  ];
  return (
    <div className="min-h-screen flex flex-col">
      <TopNav />
      <main id="main-content" className="flex-1">
        <section className="relative isolate overflow-hidden">
          <div className="absolute inset-0 -z-10" style={{ background: 'linear-gradient(175deg, #ff5e8a 0%, #7a2a7a 38%, #1a0b3b 100%)' }} />
          <div className="absolute inset-0 -z-10 opacity-50"><SvgScene kind="miami" /></div>
          <div className="absolute inset-0 -z-10 bg-gradient-to-r from-[#1a0b3b]/85 via-[#1a0b3b]/45 to-transparent" />
          <div className="absolute inset-0 -z-10 bg-gradient-to-b from-transparent via-transparent to-background" />
          <div className="mx-auto max-w-4xl px-5 pb-20 pt-16 text-white sm:pt-24">
            <p className="text-xs uppercase tracking-[0.2em] text-[#ffd9b0]">{t('badge')}</p>
            <h1 className="mt-3 text-4xl font-extrabold [text-shadow:0_2px_24px_rgba(26,11,59,.6)] leading-[1.05] tracking-tight sm:text-5xl md:text-6xl">{t('h1')}</h1>
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-white/85 sm:text-lg">{t('intro')}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href={INVITE_URL} target="_blank" rel="noopener noreferrer" className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-[#2a0b3b] transition hover:bg-white/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">{t('cta')}</a>
              <Link href="/profile?tab=page" className="rounded-full border border-white/50 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">{t('ctaProfile')}</Link>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-4xl px-5 py-12">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{t('featuresTitle')}</h2>
          <ul className="mt-6 grid gap-4 sm:grid-cols-2">
            {features.map((f) => (
              <li key={f.t} className="rounded-2xl border border-border/60 bg-card/40 p-5">
                <h3 className="font-semibold">{f.t}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{f.d}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="mx-auto max-w-4xl px-5 py-8">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{t('stepsTitle')}</h2>
          <ol className="mt-6 space-y-3">
            {steps.map((s, i) => (
              <li key={s} className="flex items-start gap-3 text-sm sm:text-base">
                <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#ff5e8a] text-xs font-bold text-white">{i + 1}</span>
                <span>{s}</span>
              </li>
            ))}
          </ol>
        </section>

        <section className="mx-auto max-w-4xl px-5 py-12">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{t('faqTitle')}</h2>
          <dl className="mt-6 space-y-5">
            {faq.map((f) => (
              <div key={f.q}>
                <dt className="flex items-start gap-2 font-semibold"><Check className="mt-1 h-4 w-4 shrink-0 text-[#ff5e8a]" aria-hidden="true" />{f.q}</dt>
                <dd className="mt-1 pl-6 text-sm leading-relaxed text-muted-foreground">{f.a}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-10 rounded-xl border border-border/60 bg-card/30 p-4 text-xs leading-relaxed text-muted-foreground">{t('disclaimer')}</p>
        </section>
      </main>
      <Footer />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </div>
  );
}

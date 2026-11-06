import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ArrowRight, Check, ChevronDown, Crown, Globe, IdCard, Layers, Link2, Briefcase, Sparkles, Trophy, UserRound, Users } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { Footer, TopNav } from '@/components/nav';
import { INVITE_URL } from '@/lib/content';
import { SITE_URL, localePath, localizedAlternates, ogLocale } from '@/lib/community/seo';
import { OG_IMAGES, TWITTER_CARD } from '@/lib/seo-social';
import { SvgScene } from '@/components/scenes';

const PATH = '/miami-style-discord-bot';
const WHERE_ICONS = [Trophy, Users, UserRound];
const FEATURE_ICONS = [IdCard, Briefcase, Layers, Globe];

export async function generateMetadata({ params }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'miamiPage' });
  // The page is written in every language, so every language is its own indexed page
  return {
    title: { absolute: t('metaTitle') },
    description: t('metaDescription'),
    alternates: localizedAlternates(locale, PATH),
    robots: { index: true, follow: true },
    twitter: TWITTER_CARD,
    openGraph: { images: OG_IMAGES, title: t('metaTitle'), description: t('metaDescription'), url: `${SITE_URL}${localePath(locale, PATH)}`, type: 'website', ...ogLocale(locale) },
  };
}

export default async function MiamiStylePage({ params }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'miamiPage' });
  const stats = t.raw('stats');
  const themes = t.raw('themes');
  const where = t.raw('where');
  const features = t.raw('features');
  const steps = t.raw('steps');
  const faq = t.raw('faq');
  const url = `${SITE_URL}${localePath(locale, PATH)}`;
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
    { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) },
    { '@context': 'https://schema.org', '@type': 'HowTo', name: t('stepsTitle'), step: steps.map((s, i) => ({ '@type': 'HowToStep', position: i + 1, text: s })) },
  ];
  return (
    <div className="min-h-screen flex flex-col">
      <TopNav />
      <main id="main-content" className="flex-1">
        <section className="relative isolate overflow-hidden border-b border-white/10">
          <div className="absolute inset-0 -z-20" style={{ background: 'linear-gradient(175deg, #ff5e8a 0%, #7a2a7a 40%, #150a2e 100%)' }} />
          <div className="absolute inset-0 -z-10 opacity-40"><SvgScene kind="miami" /></div>
          <div className="absolute inset-0 -z-10 bg-gradient-to-r from-[#150a2e]/90 via-[#150a2e]/55 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 -z-10 h-32 bg-gradient-to-b from-transparent to-background" />
          <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 pb-20 pt-14 text-white sm:pt-20 lg:grid-cols-[1.1fr_.9fr]">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs uppercase tracking-[0.18em] text-[#ffd9b0] backdrop-blur"><Sparkles className="h-3.5 w-3.5" aria-hidden="true" />{t('badge')}</p>
              <h1 className="mt-5 text-4xl font-extrabold leading-[1.04] tracking-tight [text-shadow:0_2px_24px_rgba(21,10,46,.6)] sm:text-5xl lg:text-6xl">{t('h1')}</h1>
              <p className="mt-5 max-w-xl text-base leading-relaxed text-white/85 sm:text-lg">{t('intro')}</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <a href={INVITE_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-[#2a0b3b] shadow-lg shadow-black/30 transition hover:bg-white/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">{t('cta')}<ArrowRight className="h-4 w-4" aria-hidden="true" /></a>
                <Link href="/profile?tab=page" className="inline-flex items-center rounded-full border border-white/50 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">{t('ctaProfile')}</Link>
              </div>
              <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/80">
                {stats.map((s) => <li key={s} className="inline-flex items-center gap-1.5"><Check className="h-4 w-4 text-[#ffd9b0]" aria-hidden="true" />{s}</li>)}
              </ul>
            </div>

            <figure className="relative mx-auto w-full max-w-md" aria-label={t('previewLabel')}>
              <div className="absolute -inset-6 -z-10 rounded-[2rem] bg-[#ff5e8a]/30 blur-3xl" aria-hidden="true" />
              <div className="relative overflow-hidden rounded-3xl border border-white/20 shadow-[0_40px_90px_-30px_rgba(0,0,0,.8)]">
                <div className="absolute inset-0" style={{ background: 'linear-gradient(160deg, #ff9a7a 0%, #b43a8a 45%, #26104d 100%)' }} />
                <div className="absolute inset-0 opacity-90"><SvgScene kind="coast" /></div>
                <div className="relative flex min-h-[15rem] flex-col justify-end bg-gradient-to-t from-[#150a2e]/90 via-[#150a2e]/30 to-transparent p-5">
                  <div className="flex items-center gap-3">
                    <span className="h-14 w-14 shrink-0 rounded-full border-2 border-white/90" style={{ background: 'conic-gradient(from 200deg,#ffd9b0,#ff5e8a,#7a5cff,#3fd0c9,#ffd9b0)' }} aria-hidden="true" />
                    <div className="min-w-0">
                      <p className="truncate text-xl font-extrabold">{t('previewName')}</p>
                      <p className="text-xs text-white/80">{t('previewLevel')}</p>
                    </div>
                    <Crown className="ml-auto h-5 w-5 text-[#ffd9b0]" aria-hidden="true" />
                  </div>
                  <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-white/20"><div className="h-full w-[78%] rounded-full bg-gradient-to-r from-[#ff5e8a] via-[#ffd9b0] to-[#3fd0c9]" /></div>
                  <p className="mt-1.5 text-right text-[11px] text-white/75">{t('previewXp')}</p>
                </div>
              </div>
              <figcaption className="mt-3 text-center text-xs text-white/60">{t('previewLabel')}</figcaption>
            </figure>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-16">
          <div className="max-w-2xl">
            <h2 className="text-2xl font-bold tracking-tight sm:text-4xl">{t('themesTitle')}</h2>
            <p className="mt-2 text-muted-foreground">{t('themesIntro')}</p>
          </div>
          <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {themes.map((th) => (
              <li key={th.k} className="group overflow-hidden rounded-2xl border border-border/60 bg-card/40 transition hover:-translate-y-1 hover:border-[#ff5e8a]/60 hover:shadow-[0_20px_50px_-25px_rgba(255,94,138,.6)]">
                <div className="relative h-36 overflow-hidden bg-[#1a0b3b]">
                  <SvgScene kind={th.k} />
                  <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-black/50 to-transparent" />
                </div>
                <div className="p-4">
                  <h3 className="font-semibold">{th.t}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{th.d}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="border-y border-border/50 bg-card/20">
          <div className="mx-auto max-w-6xl px-5 py-16">
            <h2 className="text-2xl font-bold tracking-tight sm:text-4xl">{t('whereTitle')}</h2>
            <ul className="mt-8 grid gap-5 md:grid-cols-3">
              {where.map((w, i) => {
                const Icon = WHERE_ICONS[i];
                return (
                  <li key={w.t} className="rounded-2xl border border-border/60 bg-background/40 p-6">
                    <span className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-[#ff5e8a] to-[#7a5cff] text-white shadow-lg shadow-[#ff5e8a]/30"><Icon className="h-5 w-5" aria-hidden="true" /></span>
                    <h3 className="mt-4 font-semibold">{w.t}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{w.d}</p>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-16">
          <h2 className="text-2xl font-bold tracking-tight sm:text-4xl">{t('stepsTitle')}</h2>
          <ol className="mt-8 grid gap-5 md:grid-cols-3">
            {steps.map((s, i) => (
              <li key={s} className="relative rounded-2xl border border-border/60 bg-card/40 p-6">
                <span className="text-5xl font-black leading-none text-[#ff5e8a]/30" aria-hidden="true">{i + 1}</span>
                <p className="mt-2 text-sm font-medium leading-relaxed sm:text-base"><span className="sr-only">{i + 1}. </span>{s}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="mx-auto max-w-6xl px-5 pb-6">
          <h2 className="text-2xl font-bold tracking-tight sm:text-4xl">{t('featuresTitle')}</h2>
          <ul className="mt-8 grid gap-4 sm:grid-cols-2">
            {features.map((f, i) => {
              const Icon = FEATURE_ICONS[i];
              return (
                <li key={f.t} className="flex gap-4 rounded-2xl border border-border/60 bg-card/30 p-5">
                  <Icon className="mt-0.5 h-5 w-5 shrink-0 text-[#ff5e8a]" aria-hidden="true" />
                  <div><h3 className="font-semibold">{f.t}</h3><p className="mt-1 text-sm leading-relaxed text-muted-foreground">{f.d}</p></div>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="mx-auto max-w-3xl px-5 py-16">
          <h2 className="text-2xl font-bold tracking-tight sm:text-4xl">{t('faqTitle')}</h2>
          <div className="mt-6 divide-y divide-border/60 rounded-2xl border border-border/60 bg-card/30">
            {faq.map((f) => (
              <details key={f.q} className="group p-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold [&::-webkit-details-marker]:hidden">
                  {f.q}
                  <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition group-open:rotate-180" aria-hidden="true" />
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 pb-16">
          <div className="relative isolate overflow-hidden rounded-3xl border border-white/15 p-8 text-center text-white sm:p-12">
            <div className="absolute inset-0 -z-20" style={{ background: 'linear-gradient(135deg, #ff5e8a 0%, #7a2a7a 50%, #1a0b3b 100%)' }} />
            <div className="absolute inset-0 -z-10 opacity-30"><SvgScene kind="skyline" /></div>
            <h2 className="text-2xl font-extrabold tracking-tight sm:text-4xl">{t('ctaTitle')}</h2>
            <p className="mx-auto mt-3 max-w-xl text-white/85">{t('ctaText')}</p>
            <a href={INVITE_URL} target="_blank" rel="noopener noreferrer" className="mt-7 inline-flex items-center gap-2 rounded-full bg-white px-7 py-3 text-sm font-semibold text-[#2a0b3b] shadow-lg shadow-black/30 transition hover:bg-white/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">{t('cta')}<ArrowRight className="h-4 w-4" aria-hidden="true" /></a>
          </div>
          <p className="mx-auto mt-8 max-w-3xl text-center text-xs leading-relaxed text-muted-foreground">{t('disclaimer')}</p>
        </section>
      </main>
      <Footer />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </div>
  );
}

import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Link } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
import { Bot, Check, ChevronRight, Sparkles } from 'lucide-react';
import { INVITE_URL } from '@/lib/content';
import { Button } from '@/components/ui/button';
import { Footer, TopNav } from '@/components/nav';
import { ICONS, HomepageModulePreview } from '@/components/module-preview-content';
import { MODULE_SEO_SLUGS, getModuleSeoContent, getCommandsAnchor } from '@/lib/module-seo';
import { BrandText } from '@/components/brand-text';
import { buildHowTo } from '@/lib/module-howto';
import { OG_IMAGES, TWITTER_CARD } from '@/lib/seo-social';

const SITE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://wody.online';

// Was generateStaticParams() + setRequestLocale() (next-intl's documented
// way to keep static generation working), which should have worked but
// still reliably failed the production build on at least one slug with
// the exact same opaque "ReferenceError: t is not defined" the OTHER
// dynamic-rendering conflicts on this site produced, taking the entire
// build down with it (next build exits on the first prerender failure).
// force-dynamic sidesteps the conflict entirely, same fix already proven
// on /team, /blog, /updates, /commands and others: these ~15 module SEO
// pages are now rendered per-request instead of pre-built, which still
// serves fully correct HTML and metadata to both visitors and crawlers,
// just without the build-time head start.
// Public text page: rendered once and cached, refreshed every hour (was rendered on every request).
export const revalidate = 3600;

// Every module page in every language is built ahead of time and refreshed in the background.
export function generateStaticParams() {
  return routing.locales.flatMap((locale) => MODULE_SEO_SLUGS.map((slug) => ({ locale, slug })));
}

export async function generateMetadata({ params }) {
  const { locale, slug } = await params;
  // Required for getTranslations() below to work during static
  // generation (this route has generateStaticParams): without it,
  // next-intl opts the render into dynamic-only mode internally, which
  // conflicted with Next.js's attempt to prerender this page at build
  // time and produced a generic, unrecoverable "Server Components
  // render" error for every visitor rather than just this page's SEO
  // content. See https://next-intl.dev/docs/routing/setup#static-rendering
  setRequestLocale(locale);
  try {
    const content = getModuleSeoContent(slug, locale);
    if (!content) return {};

    const path = `/modules/${slug}`;
    const hasOwnCopy = ['en', 'ro'].includes(locale);
    const localizedPath = locale === routing.defaultLocale || !hasOwnCopy ? path : `/${locale}${path}`;
    const languages = Object.fromEntries(['en', 'ro'].map((itemLocale) => [
      itemLocale,
      `${SITE_URL}${itemLocale === routing.defaultLocale ? '' : `/${itemLocale}`}${path}`,
    ]));
    languages['x-default'] = `${SITE_URL}${path}`;

    return {
      title: { absolute: content.metaTitle },
      description: content.metaDescription,
      alternates: { canonical: `${SITE_URL}${localizedPath}`, languages },
      robots: { index: hasOwnCopy, follow: true },
      twitter: TWITTER_CARD,
      openGraph: { images: OG_IMAGES,
        title: content.ogTitle,
        description: content.ogDescription,
        url: `${SITE_URL}${localizedPath}`,
        type: 'website',
        locale,
      },
    };
  } catch (error) {
    console.error('modules generateMetadata failed, serving minimal fallback metadata', error);
    return { alternates: { canonical: `${SITE_URL}/modules/${slug}` } };
  }
}

export default async function ModulePage({ params }) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  if (!MODULE_SEO_SLUGS.includes(slug)) notFound();
  const content = getModuleSeoContent(slug, locale);
  if (!content) notFound();

  let t, modulesDetail, th, tg;
  try {
    t = await getTranslations({ locale, namespace: 'modulesPage' });
    th = await getTranslations({ locale, namespace: 'modulesPage.howto' });
    tg = await getTranslations({ locale, namespace: 'moduleGuide' });
    modulesDetail = (await getTranslations({ locale, namespace: 'landing' })).raw('modulesDetail');
  } catch (error) {
    console.error('module page failed to load translations, showing degraded state', error);
    return (
      <div className="relative min-h-screen">
        <TopNav />
        <main className="max-w-2xl mx-auto px-4 py-24 text-center">
          <h1 className="text-2xl font-semibold mb-2">{content.metaTitle}</h1>
          <p className="text-muted-foreground text-sm">This page couldn&apos;t fully load right now, please try again shortly.</p>
        </main>
        <Footer />
      </div>
    );
  }
  const baseModule = modulesDetail.find((m) => m.key === slug);
  const Icon = ICONS[slug] || Sparkles;
  const commandsAnchor = getCommandsAnchor(slug);
  const commandsHref = commandsAnchor ? `/commands#${commandsAnchor}` : '/commands';

  const otherModules = modulesDetail.filter((m) => m.key !== slug);

  const modulePath = locale === routing.defaultLocale ? `/modules/${slug}` : `/${locale}/modules/${slug}`;

  const moduleTitle = baseModule?.title || content.heroTitle;
  const howtoSteps = buildHowTo(slug, moduleTitle, th, tg);
  const howtoName = th('title', { module: moduleTitle });
  const howtoIntro = th('intro', { module: moduleTitle });

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'SoftwareApplication',
        name: `Wody: ${baseModule?.title || content.heroTitle}`,
        applicationCategory: 'CommunicationApplication',
        operatingSystem: 'Discord',
        description: content.metaDescription,
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
        url: `${SITE_URL}${modulePath}`,
      },
      ...(howtoSteps.length ? [{
        '@type': 'HowTo',
        name: howtoName,
        description: howtoIntro,
        step: howtoSteps.map((st, i) => ({
          '@type': 'HowToStep',
          position: i + 1,
          name: st.title,
          text: [st.text, ...(st.list || []), ...(st.cmds || [])].join(' '),
        })),
      }] : []),
      {
        '@type': 'FAQPage',
        mainEntity: content.faq.map((item) => ({
          '@type': 'Question',
          name: item.q,
          acceptedAnswer: { '@type': 'Answer', text: item.a },
        })),
      },
    ],
  };

  return (
    <div className="relative min-h-screen overflow-x-hidden">
      <div className="absolute inset-0 pointer-events-none -z-10">
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full bg-[#7c3010]/20 blur-3xl" />
        <div className="absolute top-[40%] -right-48 w-[500px] h-[500px] rounded-full bg-[#c46a2d]/10 blur-3xl" />
      </div>

      <TopNav />

      <main id="main-content" className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12 md:py-16 lg:py-20">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

        {/* HERO */}
        <header className="max-w-4xl mx-auto text-center mb-10 md:mb-14">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-card/70 px-3 py-1.5 text-xs text-muted-foreground mb-5">
            <Icon className="w-3.5 h-3.5 text-primary" />
            {t('badge')}
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight leading-tight">
            {content.heroTitle}
          </h1>
          <p className="mt-5 text-base sm:text-lg md:text-xl text-muted-foreground leading-relaxed max-w-3xl mx-auto">
            {content.heroSubtitle}
          </p>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 mt-7">
            <a href={INVITE_URL} target="_blank" rel="noopener noreferrer">
              <Button className="gradient-primary w-full sm:w-auto gap-2">
                <Bot className="w-4 h-4" /> {t('inviteBtn')}
              </Button>
            </a>
            <Link href={commandsHref}>
              <Button variant="outline" className="w-full sm:w-auto gap-2">
                {t('viewCommandsBtn')} <ChevronRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </header>

        {/* MOCKUP */}
        <section className="w-full mb-14 md:mb-16">
          <div className="w-full max-w-5xl mx-auto flex justify-center">
            <HomepageModulePreview moduleKey={slug} className="module-preview-large mx-auto" />
          </div>
        </section>

        {/* INTRO */}
        <section className="max-w-4xl mx-auto mb-14 md:mb-16 space-y-4 text-center">
          {content.intro.map((paragraph, i) => (
            <p key={i} className="text-muted-foreground leading-relaxed">{paragraph}</p>
          ))}
        </section>

        {/* PROFILE: who it is for and what goes wrong elsewhere */}
        {content.audience?.length ? (
          <section className="max-w-5xl mx-auto mb-14 md:mb-16 grid gap-8 md:grid-cols-2 text-left">
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight uppercase mb-6 text-center md:text-left">{t('audienceTitle')}</h2>
              <ul className="space-y-3">
                {content.audience.map((line, i) => (
                  <li key={i} className="flex items-start gap-3 rounded-2xl border border-border/70 bg-card/45 backdrop-blur-sm p-4 text-sm leading-6 text-muted-foreground">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#e08a4e]" aria-hidden="true" />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight uppercase mb-6 text-center md:text-left">{t('painsTitle')}</h2>
              <ul className="space-y-3">
                {content.pains.map((line, i) => (
                  <li key={i} className="flex items-start gap-3 rounded-2xl border border-border/70 bg-card/45 backdrop-blur-sm p-4 text-sm leading-6 text-muted-foreground">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/60" aria-hidden="true" />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        ) : null}

        {/* FEATURES */}
        <section className="max-w-5xl mx-auto mb-14 md:mb-16 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight uppercase mb-6">{t('featuresTitle')}</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {content.features.map((feature, i) => (
              <div key={i} className="flex items-start gap-3 rounded-2xl border border-border/70 bg-card/45 backdrop-blur-sm p-4 text-left">
                <div className="w-6 h-6 rounded-lg bg-[#7c3010]/20 text-[#e08a4e] flex items-center justify-center shrink-0 mt-0.5">
                  <Check className="w-3.5 h-3.5" />
                </div>
                <p className="text-sm leading-6 text-muted-foreground">{feature}</p>
              </div>
            ))}
          </div>
        </section>

        {/* HOW TO SET UP */}
        {howtoSteps.length ? (
          <section className="max-w-4xl mx-auto mb-14 md:mb-16" aria-labelledby="howto-title">
            <div className="text-center mb-6">
              <h2 id="howto-title" className="text-2xl sm:text-3xl font-bold tracking-tight uppercase">{howtoName}</h2>
              <p className="mt-3 text-sm sm:text-base text-muted-foreground leading-relaxed">{howtoIntro}</p>
            </div>
            <ol className="space-y-3">
              {howtoSteps.map((st, i) => (
                <li key={i} className="flex items-start gap-4 rounded-2xl border border-border/70 bg-card/45 backdrop-blur-sm p-4 sm:p-5 text-left">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#7c3010]/25 text-sm font-bold text-[#e08a4e]" aria-hidden="true">{i + 1}</span>
                  <div className="min-w-0">
                    <h3 className="font-semibold leading-snug">{st.title}</h3>
                    <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{st.text}</p>
                    {st.list?.length ? (
                      <ul className="mt-2 space-y-1.5">
                        {st.list.map((item, j) => (
                          <li key={j} className="flex items-start gap-2 text-sm leading-6 text-muted-foreground">
                            <Check className="mt-1 h-3.5 w-3.5 shrink-0 text-[#e08a4e]" aria-hidden="true" /><span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    {st.cmds?.length ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {st.cmds.map((c) => (
                          <code key={c} className="rounded-lg border border-border/70 bg-background/60 px-2.5 py-1 text-xs text-foreground">{c}</code>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </li>
              ))}
            </ol>
          </section>
        ) : null}

        {/* FAQ */}
        <section className="max-w-4xl mx-auto mb-14 md:mb-16 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight uppercase mb-6">{t('faqTitle')}</h2>
          <div className="space-y-3 text-left">
            {content.faq.map((item, i) => (
              <details key={i} className="group rounded-2xl border border-border/70 bg-card/45 backdrop-blur-sm overflow-hidden">
                <summary className="cursor-pointer list-none px-5 py-4 flex items-center justify-between gap-4 font-medium">
                  <span><BrandText>{item.q}</BrandText></span>
                  <span className="text-muted-foreground group-open:rotate-45 transition-transform text-xl leading-none">+</span>
                </summary>
                <div className="px-5 pb-5 text-sm leading-6 text-muted-foreground"><BrandText>{item.a}</BrandText></div>
              </details>
            ))}
          </div>
        </section>

        {/* OTHER MODULES */}
        <section className="max-w-5xl mx-auto text-center">
          <h2 className="text-xl sm:text-2xl font-semibold tracking-tight uppercase mb-5">{t('otherModulesTitle')}</h2>
          <div className="flex flex-wrap justify-center gap-2.5">
            {otherModules.map((m) => {
              const OtherIcon = ICONS[m.key] || Sparkles;
              const isSeoPage = MODULE_SEO_SLUGS.includes(m.key);
              return (
                <Link
                  key={m.key}
                  href={isSeoPage ? `/modules/${m.key}` : { pathname: '/', hash: 'modules' }}
                  className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/45 backdrop-blur-sm px-3.5 py-2 text-sm text-muted-foreground hover:text-foreground hover:border-primary/30 hover:bg-card/70 transition-colors"
                >
                  <OtherIcon className="w-3.5 h-3.5 text-[#e08a4e]" /> {m.title}
                </Link>
              );
            })}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}

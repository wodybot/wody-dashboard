
import { localizedAlternates } from '@/lib/community/seo';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { ArrowRight, BookOpen, Bot, CheckCircle2, ExternalLink, HelpCircle, ShieldCheck, Ticket, Wrench, Globe, MessageCircle, Music2, Youtube, Vote, LayoutDashboard, FileText } from 'lucide-react';
import { COMMUNITY_INVITE, CONTENT, INVITE_URL, TIKTOK_URL, YOUTUBE_URL } from '@/lib/content';
import { Button } from '@/components/ui/button';
import { Footer, TopNav } from '@/components/nav';
import { BrandText, highlightBrandHtml } from '@/components/brand-text';
import { OG_IMAGES, TWITTER_CARD } from '@/lib/seo-social';

const SITE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://wody.online';

export const revalidate = 3600;

const ICONS = { BookOpen, Bot, CheckCircle2, HelpCircle, ShieldCheck, Ticket, Wrench, Vote, LayoutDashboard };

export async function generateMetadata({ params }) {
  const { locale } = await params;
  setRequestLocale(locale);
  try {
    const t = await getTranslations({ locale, namespace: 'help' });
    return {
      title: { absolute: t('metaTitle') },
      description: t('metaDescription'),
      alternates: localizedAlternates(locale, '/help'),
      robots: { index: true, follow: true },
      twitter: TWITTER_CARD,
      openGraph: { images: OG_IMAGES,
        title: t('ogTitle'),
        description: t('ogDescription'),
        url: `${SITE_URL}/help`,
        type: 'article',
      },
    };
  } catch (error) {
    console.error('help generateMetadata failed, serving minimal fallback metadata', error);
    return { title: { absolute: 'Help' }, alternates: { canonical: '/help' } };
  }
}

function FAQItem({ q, a }) {
  return (
    <details className="group rounded-2xl border border-border/70 bg-card/45 backdrop-blur-sm overflow-hidden">
      <summary className="cursor-pointer list-none px-5 py-4 flex items-center justify-between gap-4 font-medium">
        <span><BrandText>{q}</BrandText></span>
        <span className="text-muted-foreground group-open:rotate-45 transition-transform text-xl leading-none">+</span>
      </summary>
      <div className="px-5 pb-5 text-sm leading-6 text-muted-foreground" dangerouslySetInnerHTML={{ __html: highlightBrandHtml(a) }} />
    </details>
  );
}

export default async function HelpPage({ params }) {
  const { locale } = await params;
  setRequestLocale(locale);
  let t, tLanding;
  try {
    t = await getTranslations({ locale, namespace: 'help' });
    tLanding = await getTranslations({ locale, namespace: 'landing' });
  } catch (error) {
    console.error('help page failed to load translations, showing degraded state', error);
    return (
      <div className="relative min-h-screen">
        <TopNav />
        <main className="max-w-2xl mx-auto px-4 py-24 text-center">
          <h1 className="text-2xl font-semibold mb-2">Help</h1>
          <p className="text-muted-foreground text-sm">This page couldn&apos;t load right now, please try again shortly.</p>
        </main>
        <Footer />
      </div>
    );
  }

  const premiumLimits = tLanding.raw('premium.limits');
  const premiumLimitsText = premiumLimits.filter((l) => l.boosted === '∞').map((l) => t('premiumFreeLimit', { title: l.title, standard: l.standard })).join(', ');
  const premiumOptions = tLanding.raw('premium.options');
  // "Option A: Promote Wody" in any language: the part after the first colon is the option's own name
  const optionName = (title) => String(title).replace(/^[^:]{1,24}[ ][A-E]\s*:\s*/, '');
  const premiumOptionsText = premiumOptions
    .map((o, i) => t('premiumOption', { letter: String.fromCharCode(65 + i), title: optionName(o.title), steps: o.steps.join(' ') }))
    .join(' ');
  // The Premium modules, written as a list the way this language writes lists ("A, B and C")
  let premiumModulesText = '';
  try {
    const names = (await getTranslations({ locale, namespace: 'premiumPage' })).raw('modules').map((m) => m.title);
    premiumModulesText = new Intl.ListFormat(locale, { style: 'long', type: 'conjunction' }).format(names);
  } catch { premiumModulesText = ''; }

  const rawSections = t.raw('sections');
  const modulesSection = {
    key: 'modules',
    title: t('modulesTitle'),
    icon: 'Bot',
    items: tLanding.raw('modulesDetail').map((m) => [m.title, m.desc]),
  };
  const sections = [
    rawSections[0], rawSections[1], modulesSection, rawSections[2], rawSections[3],
    {
      ...rawSections[4],
      items: rawSections[4].items.map((item) => {
        if (item[1] === '__PREMIUM_LIMITS__') return [item[0], t('premiumUnlocks', { modules: premiumModulesText, limits: premiumLimitsText })];
        if (item[1] === '__PREMIUM_OPTIONS__') return [item[0], t('premiumHow', { options: premiumOptionsText })];
        return item;
      }),
    },
    ...rawSections.slice(5),
  ];

  const faqItems = tLanding.raw('faq').concat([{ q: t('extraFaqQuestion'), a: t('extraFaqAnswer') }]);
  const links = t.raw('links');

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqItems.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: item.a },
    })),
  };

  return (
    <div className="relative min-h-screen overflow-x-hidden">
      <div className="absolute inset-0 pointer-events-none -z-10">
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full bg-[#7c3010]/20 blur-3xl" />
      </div>

      <TopNav />

      <main id="main-content" className="max-w-7xl mx-auto px-4 sm:px-6 py-12 md:py-16">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

        <header className="max-w-3xl mx-auto text-center mb-10 md:mb-14">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-card/70 px-3 py-1.5 text-xs text-muted-foreground mb-5">
            <HelpCircle className="w-3.5 h-3.5 text-primary" />
            {t('badge')}
          </div>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight">
            {t('heroTitlePrefix')} <span className="gradient-text">{t('heroTitleBrand')}</span>
          </h1>
          <p className="mt-5 text-base sm:text-lg text-muted-foreground leading-relaxed max-w-2xl mx-auto">
            {t('heroSubtitle')}
          </p>

          <div className="flex flex-col sm:flex-row gap-3 mt-7 justify-center">
            <a href={INVITE_URL} target="_blank" rel="noopener noreferrer">
              <Button className="gradient-primary w-full sm:w-auto gap-2">
                {t('inviteWody')}
                <ExternalLink className="w-4 h-4" />
              </Button>
            </a>
            <a href={COMMUNITY_INVITE} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" className="w-full sm:w-auto">
                {t('joinCommunity')}
              </Button>
            </a>
          </div>
        </header>

        <section className="grid lg:grid-cols-[220px_1fr] gap-8">
          <aside className="lg:sticky lg:top-24 self-start rounded-2xl border border-border/70 bg-card/40 backdrop-blur-sm p-4">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">{t('onThisPage')}</div>
            <nav className="space-y-1">
              {sections.map((section) => (
                <a key={section.key} href={`#${section.key}`} className="block rounded-lg px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors">
                  {section.title}
                </a>
              ))}
            </nav>
          </aside>

          <div className="space-y-8 min-w-0">
            {sections.map((section) => {
              const Icon = ICONS[section.icon] || HelpCircle;
              return (
                <section key={section.key} id={section.key} className="scroll-mt-24">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                      <Icon className="w-4 h-4 text-primary" />
                    </div>
                    <h2 className="text-2xl font-semibold">{section.title}</h2>
                  </div>
                  <div className="space-y-3">
                    {section.items.map(([q, a]) => <FAQItem key={q} q={q} a={a} />)}
                  </div>
                </section>
              );
            })}

            <section className="rounded-2xl border border-border/70 bg-card/45 backdrop-blur-sm p-6 sm:p-8">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <Globe className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold">{t('linksTitle')}</h2>
                  <p className="text-sm text-muted-foreground">{t('linksSubtitle')}</p>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <a href="https://wody.online" className="group rounded-xl border border-border/70 bg-background/30 p-4 hover:border-primary/30 hover:bg-background/50 transition text-center sm:text-left">
                  <Globe className="w-4 h-4 text-primary mb-3 mx-auto sm:mx-0" />
                  <div className="font-medium">{links.website.title}</div>
                  <div className="text-sm text-muted-foreground mt-1">{links.website.sub}</div>
                </a>
                <Link href="/dashboard" className="group rounded-xl border border-border/70 bg-background/30 p-4 hover:border-primary/30 hover:bg-background/50 transition text-center sm:text-left">
                  <LayoutDashboard className="w-4 h-4 text-primary mb-3 mx-auto sm:mx-0" />
                  <div className="font-medium">{links.dashboard.title}</div>
                  <div className="text-sm text-muted-foreground mt-1">{links.dashboard.sub}</div>
                </Link>
                <a href={INVITE_URL} target="_blank" rel="noopener noreferrer" className="group rounded-xl border border-border/70 bg-background/30 p-4 hover:border-primary/30 hover:bg-background/50 transition text-center sm:text-left">
                  <Bot className="w-4 h-4 text-primary mb-3 mx-auto sm:mx-0" />
                  <div className="font-medium">{links.invite.title}</div>
                  <div className="text-sm text-muted-foreground group-hover:text-foreground mt-1">{links.invite.sub}</div>
                </a>
                <a href={COMMUNITY_INVITE} target="_blank" rel="noopener noreferrer" className="group rounded-xl border border-border/70 bg-background/30 p-4 hover:border-primary/30 hover:bg-background/50 transition text-center sm:text-left">
                  <MessageCircle className="w-4 h-4 text-primary mb-3 mx-auto sm:mx-0" />
                  <div className="font-medium">{links.community.title}</div>
                  <div className="text-sm text-muted-foreground mt-1">{links.community.sub}</div>
                </a>
                <a href={TIKTOK_URL} target="_blank" rel="noopener noreferrer" className="group rounded-xl border border-border/70 bg-background/30 p-4 hover:border-primary/30 hover:bg-background/50 transition text-center sm:text-left">
                  <Music2 className="w-4 h-4 text-primary mb-3 mx-auto sm:mx-0" />
                  <div className="font-medium">{links.tiktok.title}</div>
                  <div className="text-sm text-muted-foreground mt-1">{links.tiktok.sub}</div>
                </a>
                <a href={YOUTUBE_URL} target="_blank" rel="noopener noreferrer" className="group rounded-xl border border-border/70 bg-background/30 p-4 hover:border-primary/30 hover:bg-background/50 transition text-center sm:text-left">
                  <Youtube className="w-4 h-4 text-primary mb-3 mx-auto sm:mx-0" />
                  <div className="font-medium">{links.youtube.title}</div>
                  <div className="text-sm text-muted-foreground mt-1">{links.youtube.sub}</div>
                </a>
                <Link href="/privacy" className="group rounded-xl border border-border/70 bg-background/30 p-4 hover:border-primary/30 hover:bg-background/50 transition text-center sm:text-left">
                  <FileText className="w-4 h-4 text-primary mb-3 mx-auto sm:mx-0" />
                  <div className="font-medium">{links.privacy.title}</div>
                  <div className="text-sm text-muted-foreground mt-1">{links.privacy.sub}</div>
                </Link>
                <Link href="/cookies" className="group rounded-xl border border-border/70 bg-background/30 p-4 hover:border-primary/30 hover:bg-background/50 transition text-center sm:text-left">
                  <FileText className="w-4 h-4 text-primary mb-3 mx-auto sm:mx-0" />
                  <div className="font-medium">{links.cookies.title}</div>
                  <div className="text-sm text-muted-foreground mt-1">{links.cookies.sub}</div>
                </Link>
                <Link href="/terms" className="group rounded-xl border border-border/70 bg-background/30 p-4 hover:border-primary/30 hover:bg-background/50 transition text-center sm:text-left">
                  <FileText className="w-4 h-4 text-primary mb-3 mx-auto sm:mx-0" />
                  <div className="font-medium">{links.terms.title}</div>
                  <div className="text-sm text-muted-foreground mt-1">{links.terms.sub}</div>
                </Link>
              </div>
            </section>

            <section className="rounded-2xl border border-primary/20 bg-primary/5 p-6 sm:p-8">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5 text-center md:text-left">
                <div>
                  <h2 className="text-xl font-semibold">{t('readyTitle')}</h2>
                  <p className="text-sm text-muted-foreground mt-1">{t('readySubtitle')}</p>
                </div>
                <a href={INVITE_URL} target="_blank" rel="noopener noreferrer">
                  <Button className="gradient-primary gap-2">
                    {t('inviteWody')}
                    <ExternalLink className="w-4 h-4" />
                  </Button>
                </a>
              </div>
            </section>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}

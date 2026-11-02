// FILE: page.js
// PUNE ÎN: app/page.js
// (înlocuiește fișierul existent din proiectul wody-dashboard-main la această cale)

import { Suspense } from 'react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { getShowcaseServers } from '@/lib/community-showcase';
import { Button } from '@/components/ui/button';
import { TopNav, Footer } from '@/components/nav';
import { BotStatusCard } from '@/components/bot-status';
import { CommunityShowcase } from '@/components/community-showcase';
import { PassportPromo, PassportPromoFallback } from '@/components/passport-promo';
import { EcosystemSection } from '@/components/ecosystem-section';
import { HeroActions } from '@/components/hero-actions';
import { ModuleFlipCard } from '@/components/module-flip-card';
import { COUNTER_INVITE_URL, COMMUNITY_INVITE } from '@/lib/content';
import {
  Zap, Shield, Lock, Sparkles, Package, MessageCircle, Users,
  Bot, Crown, ArrowRight, Check, Star, Hash, Trophy, Clock, Gift,
} from 'lucide-react';
import { BrandText } from '@/components/brand-text';

const FEATURE_ICONS = [Zap, Shield, Lock, Package, Sparkles, Star];
const STAT_ICONS = [Package, Zap, Clock, Gift];
// Modules that need an active Premium subscription (shown in their own group).
const PREMIUM_MODULE_KEYS = new Set(['economy', 'blackjack', 'backups', 'temporary_voice', 'youtube_notify', 'stream_notifications']);

// getTranslations() (next-intl) opts a Server Component into dynamic
// rendering internally; without this export Next.js still tried to
// STATICALLY prerender the homepage at build time, the two conflicted,
// and the failed prerender is what actually produced the generic "Server
// Components render" error visitors saw, on every request, not just
// intermittently. Same fix already applied to /team, /blog, /updates,
// /commands and others.
// The homepage is the same for everybody, so it is built once and refreshed in the background (it used to be
// rendered again on every visit just to know who is signed in). Who is signed in is asked by the browser:
// TopNav, HeroActions and ModuleFlipCard already do that when no user is passed (see use-session-user.js).
export const revalidate = 300;

// Its own async component inside <Suspense>, so the hero and everything
// above the strip render and reach the browser immediately, and the server
// list streams into the very same HTML response as soon as it is ready
// (getShowcaseServers() is cached, so this is normally instant anyway).
async function ShowcaseSection() {
  let showcaseServers = [];
  try {
    showcaseServers = await getShowcaseServers();
  } catch (error) {
    console.error('homepage showcase failed, showing an empty strip', error);
  }
  return <CommunityShowcase initialServers={showcaseServers} />;
}

export default async function Home({ params }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = undefined;
  let t;
  try {
    t = await getTranslations({ locale, namespace: 'landing' });
  } catch (error) {
    console.error('homepage failed to load translations, showing degraded state', error);
    return (
      <div className="relative min-h-screen">
        <TopNav user={user} />
        <main className="max-w-2xl mx-auto px-4 py-24 text-center">
          <h1 className="text-2xl font-semibold mb-2">Wody</h1>
          <p className="text-muted-foreground text-sm">This page couldn&apos;t load right now, please try again shortly.</p>
        </main>
        <Footer />
      </div>
    );
  }
  // Computed here, at render time on the server, instead of only inside
  // CommunityShowcase's own client-side useEffect: that fetch used to run
  // AFTER the page was already visible in the browser, so the strip
  // popped in a moment later, blank/missing until it resolved. Awaiting
  // it here means the real, already-rotated server list is baked into
  // the first HTML the browser receives, the strip is just there
  // instantly, no loading gap. getShowcaseServers() is the exact same
  // function status/showcase (route.js) calls, so this can never drift
  // from what the API itself would return, and CommunityShowcase still
  // polls that API every 5 minutes in the background afterwards to pick
  // up a rotation change if the tab is left open.
  // Now streamed instead of awaited here (see ShowcaseSection above): the
  // list is still in the same server response, no client-side fetch, but
  // the rest of the page no longer waits on it before it can be sent.
  const allModules = t.raw('modulesDetail');

  return (
    <div className="relative min-h-screen overflow-x-hidden">
      <div className="absolute inset-0 pointer-events-none -z-10">
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full bg-[#7c3010]/25 blur-3xl" />
        <div className="absolute top-[600px] -right-40 w-[600px] h-[600px] rounded-full bg-[#a04820]/20 blur-3xl" />
        <div className="absolute top-[1400px] left-1/3 w-[500px] h-[500px] rounded-full bg-[#4a1e0a]/25 blur-3xl" />
        <div className="absolute top-[2200px] -left-40 w-[600px] h-[600px] rounded-full bg-[#7c3010]/20 blur-3xl" />
      </div>

      <TopNav user={user} />

      <main id="main-content" className="relative">
        {/* HERO */}
        <section className="max-w-7xl mx-auto px-6 pt-14 md:pt-20 pb-14 md:pb-16 relative">
          <div className="hidden lg:block absolute top-24 right-6 xl:right-10">
            <BotStatusCard />
          </div>
          <div className="max-w-3xl text-center sm:text-left">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#e6cd8c]/40 bg-[#e6cd8c]/10 text-[#f3e1b0] backdrop-blur-md px-3 py-1.5 text-xs mb-6 shadow-sm">
              <div className="w-1.5 h-1.5 rounded-full bg-[#e6cd8c] animate-pulse" />
              <span className="font-medium text-[#f3e1b0]">{t('liveBadge')}</span>
            </div>
            <h1 className="text-4xl sm:text-5xl md:text-7xl font-bold tracking-tight leading-[1.02] mb-6 max-w-4xl">
              {t('heroTitle')}{' '}
              <span className="gradient-text-shimmer">{t('heroBrand')}</span>
            </h1>
            <p className="text-base sm:text-lg md:text-xl text-muted-foreground mb-10 max-w-2xl leading-relaxed">{t('heroSubtitle')}</p>
            <div className="flex flex-row flex-wrap items-stretch sm:items-center justify-center sm:justify-start gap-3">
              <HeroActions user={user} primaryLabel={t('ctaPrimary')} moreLabel={t('ctaSecondary')} />
            </div>

            {/* Desktop shows the bot status card floating top-right of the hero;
                on smaller screens there's no room for that, so it's repeated
                here instead, otherwise mobile visitors never see it.
                mx-auto centers the capped-width card under the centered
                hero text (text-center alone only centers inline content,
                not a block-level element like this one). */}
            <div className="mt-8 lg:hidden">
              <BotStatusCard className="w-full max-w-sm mx-auto" />
            </div>
          </div>
        </section>

        {/* COMMUNITY SHOWCASE */}
        {/* Full-width, centered "running in communities of every size"
            strip: real guilds the bot is in (>5 members), pulled from
            /api/status/showcase, two rows auto-scrolling in opposite
            directions. Renders nothing while loading / if there's nothing
            to show, so it never leaves an empty gap on its own. */}
        <Suspense fallback={null}>
          <ShowcaseSection />
        </Suspense>

        {/* WODY PASSPORT promotion (global feature, not a module) */}
        <Suspense fallback={<PassportPromoFallback />}>
          <PassportPromo />
        </Suspense>

        {/* Explore the WODY Ecosystem: two independent horizontal bands (Collab, Passport) */}
        <Suspense fallback={null}>
          <EcosystemSection />
        </Suspense>

        {/* SECTION DIVIDER */}
        {/* Sits between the hero (pb-14/pb-16) and modules section (py-20,
            80px top). Those two paddings aren't equal, so without this extra
            margin the line drifts closer to the hero text than to the
            modules heading. mt-6/md:mt-4 tops the gap above up to the same
            80px the modules section already gives below, centering the line
            between the two pieces of text. */}
        <div className="max-w-7xl mx-auto px-6 mt-6 md:mt-4" aria-hidden="true">
          <div className="h-px w-full bg-gradient-to-r from-transparent via-[#c46a2d]/45 to-transparent" />
        </div>

        {/* MODULES DETAIL */}
        <section id="modules" className="max-w-7xl mx-auto px-6 py-20 relative">
          <div className="max-w-2xl mb-10 text-center mx-auto">
            <div className="text-xs uppercase tracking-wider text-[#e6cd8c] mb-2">{t('fullFeatureList')}</div>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight">{t('modulesTitle')}</h2>
            <p className="text-muted-foreground mt-3">{t('modulesSubtitle')}</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {allModules.filter((m) => !PREMIUM_MODULE_KEYS.has(m.key)).map((m, i) => (
              <ModuleFlipCard key={m.key || i} module={m} user={user} />
            ))}
          </div>
        </section>

        <div className="max-w-7xl mx-auto px-6" aria-hidden="true">
          <div className="h-px w-full bg-gradient-to-r from-transparent via-[#c46a2d]/45 to-transparent" />
        </div>

        {/* PREMIUM: the teaser, the higher limits and the Premium modules in ONE card. Placed after the free modules (and above
            Why Wody), since Premium is Wody's own offering. Full breakdown (unlocks, limits,
            both ways to qualify) lives on the dedicated /premium page so
            the two never drift out of sync, this section only teases it. */}
        <section id="premium" className="max-w-7xl mx-auto px-6 py-16">
          <div className="rounded-3xl border-2 border-[#c46a2d]/50 bg-gradient-to-br from-[#7c3010]/20 via-[#4a1e0a]/20 to-transparent p-6 sm:p-8 md:p-12 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-[#f2c091]/10 blur-3xl pointer-events-none" />
            <div className="relative flex flex-col md:flex-row items-center md:items-start gap-8 md:gap-10">
              <div className="text-center md:text-left flex-1">
                <div className="flex items-center justify-center md:justify-start gap-2 mb-3">
                  <div className="inline-flex items-center gap-1.5 rounded-full border border-[#e6cd8c]/40 bg-[#e6cd8c]/10 text-[#f3e1b0] px-3 py-1 text-xs">
                    <Crown className="w-3 h-3" /> {t('premium.badge')}
                  </div>
                </div>
                <h2 className="text-4xl md:text-5xl font-bold mb-2">{t('premium.title')}</h2>
                <p className="text-xl text-[#f2c091] font-semibold mb-4">{t('premium.subtitle')}</p>
                <p className="text-muted-foreground mb-6 max-w-2xl">
                  {t.rich('premium.body', {
                    hl: (chunks) => <span className="text-[#f2c091] font-semibold">{chunks}</span>,
                  })}
                </p>
                <div className="flex flex-col sm:flex-row items-center md:items-start gap-3">
                  <a href={COMMUNITY_INVITE} target="_blank" rel="noopener noreferrer">
                    <Button size="lg" variant="outline">
                      <Users className="w-4 h-4 mr-2" /> {t('premium.cta')}
                    </Button>
                  </a>
                  <Link href="/premium">
                    <Button size="lg" className="gradient-primary">
                      <Crown className="w-4 h-4 mr-2" /> {t('premiumSeeMore')} <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </Link>
                </div>
              </div>
              <div className="w-full md:w-auto rounded-2xl border border-[#c46a2d]/50 bg-[#c46a2d]/10 p-6 md:min-w-[280px]">
                <div className="text-xs uppercase tracking-wider text-[#e6cd8c] mb-2 flex items-center gap-1.5">
                  <Crown className="w-3.5 h-3.5" /> {t('premium.limitsTitle')}
                </div>
                <div className="space-y-3">
                  {t.raw('premium.limits').map((l, i) => (
                    <div key={i} className="flex items-center justify-between gap-3">
                      <span className="text-sm font-medium">{l.title}</span>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {l.standard} <span className="text-[#f2c091] font-semibold">→ {l.boosted}</span>
                      </span>
                    </div>
                  ))}
                </div>
                <Link href="/premium" className="mt-4 inline-flex items-center gap-1 text-xs text-[#f2c091] hover:text-[#e08a4e]">
                  {t('premiumFullBreakdown')} <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </div>

            {/* PREMIUM MODULES, inside the same Premium card: one block for everything Premium. */}
            <div id="premium-modules" className="relative mt-10 border-t border-[#c46a2d]/30 pt-8 md:mt-12 md:pt-10 scroll-mt-24">
              <div className="mb-6 flex flex-col items-center gap-2 text-center md:flex-row md:items-end md:justify-between md:text-left">
                <div>
                  <div className="mb-1 inline-flex items-center gap-1.5 text-xs uppercase tracking-wider text-[#e6cd8c]"><Sparkles className="h-3.5 w-3.5" /> {t('premium.title')}</div>
                  <h3 className="text-2xl font-bold tracking-tight sm:text-3xl">{t('modulesPremiumTitle')}</h3>
                </div>
                <p className="max-w-md text-sm text-muted-foreground md:text-right">{t('modulesPremiumSubtitle')}</p>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {allModules.filter((m) => PREMIUM_MODULE_KEYS.has(m.key)).map((m, i) => (
                  <ModuleFlipCard key={m.key || i} module={m} user={user} />
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* SECTION DIVIDER */}
        {/* Sits between the modules section (py-20, 80px bottom) and Why Wody
            (pt-12/pt-14, only 48-56px top). Same issue as the divider above
            but in reverse, the line sits too close to the Why Wody title.
            mb-8/md:mb-6 pads the gap below up to match the 80px above,
            centering the line. Was already fairly close (per your note it
            "looked fine"), this makes it exact rather than close. */}
        <div className="max-w-7xl mx-auto px-6 mb-8 md:mb-6" aria-hidden="true">
          <div className="h-px w-full bg-gradient-to-r from-transparent via-[#c46a2d]/45 to-transparent" />
        </div>

        {/* WHY WODY */}
        <section id="features" className="max-w-7xl mx-auto px-6 pt-12 pb-16 md:pt-14 md:pb-16">
          <div className="max-w-2xl mb-10 text-center mx-auto">
            <div className="text-xs uppercase tracking-wider text-[#e6cd8c] mb-2 font-semibold">{t('whyWody')}</div>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight">{t('whyWodyTitle')}</h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {t.raw('features').map((f, i) => {
              const Icon = FEATURE_ICONS[i] || Sparkles;
              return (
                <div key={i} className="feature-card rounded-2xl border border-border/70 bg-card/50 backdrop-blur-sm p-6 shadow-sm hover:border-primary/25 hover:bg-card/70 text-center sm:text-left">
                  <div className="feature-icon-wrap w-10 h-10 rounded-lg border border-border/80 bg-background/40 text-[#e08a4e] flex items-center justify-center mb-4 mx-auto sm:mx-0">
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="font-semibold mb-1.5">{f.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* WODY COUNTER (secondary product) */}
        <section className="max-w-7xl mx-auto px-6 py-16">
          <div className="rounded-3xl border border-border bg-gradient-to-br from-[#4a1e0a]/40 via-card/40 to-transparent p-6 sm:p-8 md:p-12 relative overflow-hidden">
            <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-[#c46a2d]/20 blur-3xl pointer-events-none" />
            <div className="grid md:grid-cols-2 gap-8 items-center relative">
              <div className="text-center md:text-left">
                <div className="inline-flex items-center gap-1.5 rounded-full border border-[#e6cd8c]/40 bg-[#e6cd8c]/10 text-[#f3e1b0] px-3 py-1 text-xs mb-4">
                  <Hash className="w-3 h-3" /> {t('counter.badge')}
                </div>
                <h2 className="text-3xl md:text-4xl font-bold mb-2">{t('counter.title')}</h2>
                <p className="text-lg text-muted-foreground mb-4">{t('counter.subtitle')}</p>
                <p className="text-sm text-muted-foreground mb-6">{t('counter.body')}</p>
                <ul className="space-y-2 mb-6">
                  {t.raw('counter.bullets').map((b, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <Check className="w-4 h-4 text-[#e08a4e] shrink-0 mt-0.5" />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
                <a href={COUNTER_INVITE_URL} target="_blank" rel="noopener noreferrer">
                  <Button size="lg" className="gradient-primary">
                    <Bot className="w-4 h-4 mr-2" /> {t('counter.cta')}
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </a>
              </div>
              <div className="flex items-center justify-center">
                <div className="grid grid-cols-3 gap-3 max-w-xs">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                    <div key={n} className={`aspect-square rounded-xl border border-border flex items-center justify-center font-bold text-2xl ${n === 5 ? 'bg-[#7c3010]/40 text-[#f2c091] border-[#a04820]' : 'bg-card/30 text-muted-foreground'}`}>
                      {n}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* COMMUNITY */}
        <section className="max-w-7xl mx-auto px-6 py-16">
          <div className="rounded-3xl border border-border bg-gradient-to-br from-[#7c3010]/15 via-transparent to-[#4a1e0a]/25 p-8 md:p-12 text-center">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-[#e6cd8c]/40 bg-[#e6cd8c]/10 text-[#f3e1b0] px-3 py-1 text-xs mb-4">
              <Users className="w-3 h-3" /> {t('community.badge')}
            </div>
            <h2 className="text-3xl md:text-5xl font-bold mb-3">{t('community.title')}</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto mb-8">{t('community.body')}</p>
            <a href={COMMUNITY_INVITE} target="_blank" rel="noopener noreferrer">
              <Button size="lg" className="gradient-primary text-base">
                <Users className="w-4 h-4 mr-2" /> {t('community.cta')}
              </Button>
            </a>
          </div>
        </section>

        {/* FAQ */}
        <section className="max-w-4xl mx-auto px-6 py-16">
          <div className="text-xs uppercase tracking-wider text-[#e6cd8c] mb-2 text-center">{t('faqLabel')}</div>
          <h2 className="text-3xl md:text-5xl font-bold text-center mb-10">{t('faqTitle')}</h2>
          <div className="space-y-3">
            {t.raw('faq').map((f, i) => (
              <details key={i} className="group rounded-2xl border border-border bg-card/40 open:bg-card/60 open:border-[#a04820]/40 transition">
                <summary className="cursor-pointer p-5 flex items-center justify-between font-medium list-none">
                  <span><BrandText>{f.q}</BrandText></span>
                  <ArrowRight className="w-4 h-4 text-muted-foreground transition group-open:rotate-90" />
                </summary>
                <div className="px-5 pb-5 text-sm text-muted-foreground"><BrandText>{f.a}</BrandText></div>
              </details>
            ))}
          </div>
        </section>
      </main>

      <Footer />
      <div className="border-t border-border/50">
        <p className="max-w-7xl mx-auto px-6 py-4 text-center text-xs text-muted-foreground">
          {t('disclaimer')}
        </p>
      </div>
    </div>
  );
}

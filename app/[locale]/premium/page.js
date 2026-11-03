import { localizedAlternates } from '@/lib/community/seo';
import { Crown, Archive, Mic2, Youtube, CheckCircle2, ExternalLink, MessageCircle, Server, Megaphone, Vote } from 'lucide-react';
import { getTranslations, getLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { COMMUNITY_INVITE, INVITE_URL } from '@/lib/content';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Footer, TopNav } from '@/components/nav';
import { getSession } from '@/lib/session';
import { OG_IMAGES, TWITTER_CARD } from '@/lib/seo-social';

const SITE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://wody.online';

// getTranslations() (next-intl) opts a Server Component into dynamic
// rendering internally; without this export Next.js still tried to
// STATICALLY prerender this page at build time, the two conflicted,
// and the failed prerender is what actually produced the generic
// 'Server Components render' error visitors saw, on every request,
// not just intermittently. Same fix already applied successfully to
// /team, /blog, /updates and the leaderboard page.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function generateMetadata() {
  try {
    const t = await getTranslations('premiumPage');
    return {
      title: { absolute: t('metaTitle') },
      description: t('metaDescription'),
      alternates: localizedAlternates(await getLocale(), '/premium'),
      robots: { index: true, follow: true },
      twitter: TWITTER_CARD,
      openGraph: { images: OG_IMAGES,
        title: t('ogTitle'),
        description: t('ogDescription'),
        url: `${SITE_URL}/premium`,
        type: 'website',
      },
    };
  } catch (error) {
    console.error('premium generateMetadata failed, serving minimal fallback metadata', error);
    return { title: { absolute: 'Premium' }, alternates: { canonical: '/premium' } };
  }
}

const OPTION_ICONS = {
  promote: Megaphone,
  vote: Vote,
};

const MODULE_ICONS = [Archive, Mic2, Youtube];

export default async function PremiumPage() {
  const session = await getSession();
  let t, tNav, tLanding, limits, options, modules;
  try {
    t = await getTranslations('premiumPage');
    tNav = await getTranslations('nav');
    tLanding = await getTranslations('landing');
    limits = tLanding.raw('premium.limits');
    options = tLanding.raw('premium.options');
    modules = t.raw('modules');
  } catch (error) {
    console.error('premium page failed to load translations, showing degraded state', error);
    return (
      <div className="relative min-h-screen">
        <TopNav user={session?.user || null} />
        <main className="max-w-2xl mx-auto px-4 py-24 text-center">
          <h1 className="text-2xl font-semibold mb-2">Premium</h1>
          <p className="text-muted-foreground text-sm">This page couldn&apos;t load right now, please try again shortly.</p>
        </main>
        <Footer />
      </div>
    );
  }

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: t('ogTitle'),
    url: `${SITE_URL}/premium`,
    description: t('ogDescription'),
    isPartOf: { '@type': 'WebSite', name: 'Wody', url: SITE_URL },
  };

  return (
    <div className="relative min-h-screen overflow-x-hidden">
      <div className="absolute inset-0 pointer-events-none -z-10">
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full bg-[#7c3010]/20 blur-3xl" />
        <div className="absolute top-40 -right-40 w-[500px] h-[500px] rounded-full bg-[#c46a2d]/10 blur-3xl" />
      </div>

      <TopNav user={session?.user || null} />

      <main id="main-content" className="max-w-6xl mx-auto px-4 sm:px-6 py-12 md:py-16">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

        <header className="max-w-3xl mx-auto text-center mb-10 md:mb-14">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-card/70 px-3 py-1.5 text-xs text-muted-foreground mb-5">
            <Crown className="w-3.5 h-3.5 text-primary" />
            {t('badge')}
          </div>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight">
            Wody <span className="gradient-text">{t('headingSuffix')}</span>
          </h1>
          <p className="mt-5 text-base sm:text-lg text-muted-foreground leading-relaxed max-w-2xl mx-auto">
            {t('subtitle')}
          </p>
        </header>

        <section className="grid lg:grid-cols-3 gap-4 md:gap-5 mb-8">
          {modules.map((mod, i) => {
            const Icon = MODULE_ICONS[i] || CheckCircle2;
            return (
              <Card key={mod.title} className="p-6 bg-card/55 border-[#c46a2d]/25">
                <div className="w-11 h-11 rounded-xl bg-[#c46a2d]/15 text-[#f2c091] flex items-center justify-center mb-4">
                  <Icon className="w-5 h-5" />
                </div>
                <h2 className="text-xl font-semibold">{mod.title}</h2>
                <p className="mt-2 text-sm text-muted-foreground leading-6">{mod.text}</p>
              </Card>
            );
          })}
        </section>

        <section className="rounded-3xl border border-border/70 bg-card/55 backdrop-blur-sm p-6 sm:p-8 md:p-10 shadow-sm">
          <div className="flex items-start gap-4 mb-7">
            <div className="w-12 h-12 rounded-xl bg-[#c46a2d]/15 text-[#f2c091] flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-2xl font-semibold">{t('higherLimitsTitle')}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{t('higherLimitsSubtitle')}</p>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {limits.map((item) => (
              <div key={item.title} className="rounded-2xl border border-border/60 bg-background/35 p-4">
                <div className="text-sm font-medium">{item.title}</div>
                <div className="mt-2 text-lg font-bold text-[#f2c091]">{item.standard} → {item.boosted}</div>
                <div className="text-xs text-muted-foreground mt-1">{t('freeToPremium')}</div>
              </div>
            ))}
          </div>

          <div className="mt-10 mb-2">
            <h2 className="text-2xl font-semibold">{t('howToGetTitle')}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t('howToGetSubtitle')}</p>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            {options.map((opt) => {
              const Icon = OPTION_ICONS[opt.key] || CheckCircle2;
              return (
                <div key={opt.key} className="rounded-2xl border border-[#c46a2d]/25 bg-[#c46a2d]/10 p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-9 h-9 rounded-lg bg-[#c46a2d]/20 text-[#f2c091] flex items-center justify-center shrink-0">
                      <Icon className="w-4 h-4" />
                    </div>
                    <h3 className="font-semibold">{opt.title}</h3>
                  </div>
                  <ol className="space-y-2">
                    {opt.steps.map((step, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-sm text-muted-foreground leading-6">
                        <span className="shrink-0 mt-0.5 w-5 h-5 rounded-full bg-[#c46a2d]/25 text-[#f2c091] text-xs font-semibold flex items-center justify-center">{i + 1}</span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              );
            })}
          </div>

          <div className="mt-5 rounded-2xl border border-border/60 bg-background/35 p-5 text-sm text-muted-foreground leading-6">
            {tLanding('premium.value')}
          </div>

          <div className="mt-7 flex flex-col sm:flex-row gap-3">
            <a href={INVITE_URL} target="_blank" rel="noopener noreferrer">
              <Button className="gradient-primary gap-2 w-full sm:w-auto">
                {tNav('invite')} <ExternalLink className="w-4 h-4" />
              </Button>
            </a>
            <a href={COMMUNITY_INVITE} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" className="gap-2 w-full sm:w-auto">
                <MessageCircle className="w-4 h-4" /> {t('joinCommunityBtn')}
              </Button>
            </a>
            {session?.user && (
              <Link href="/dashboard">
                <Button variant="outline" className="gap-2 w-full sm:w-auto">
                  <Server className="w-4 h-4" /> {tNav('openDashboard')}
                </Button>
              </Link>
            )}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}

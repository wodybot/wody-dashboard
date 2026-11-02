// FILE: page.js
// PUNE ÎN: app/careers/page.js
// (înlocuiește fișierul existent din proiectul wody-dashboard-main la această cale)

import { localizedAlternates } from '@/lib/community/seo';
import { BriefcaseBusiness, Mail, MessageCircle, Sparkles, Users2, Rocket } from 'lucide-react';
import { getTranslations, getLocale } from 'next-intl/server';
import { CONTENT, COMMUNITY_INVITE } from '@/lib/content';
import { Button } from '@/components/ui/button';
import { Footer, TopNav } from '@/components/nav';
import { getCareersRolesConfig } from '@/lib/careers-roles';

const SITE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://wody.online';

// Fără asta, Next.js poate randa pagina o singură dată la build (nu are
// cookies()/headers(), deci ar crede că nu are input per-request) și o
// salvare din owner panel nu s-ar vedea până la următorul deploy. La fel
// ca app/opengraph-image.js și app/[locale]/team/page.js. unstable_cache
// din getCareersRolesConfig e cel care ține costul mic (o citire Mongo
// cel mult o dată pe minut, sau instant după o salvare), nu blocarea
// paginii la build time.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function generateMetadata() {
  try {
    const t = await getTranslations('careers');
    return {
      title: { absolute: t('metaTitle') },
      description: t('metaDescription'),
      alternates: localizedAlternates(await getLocale(), '/careers'),
      robots: { index: true, follow: true },
      openGraph: {
        title: t('ogTitle'),
        description: t('metaDescription'),
        url: `${SITE_URL}/careers`,
        type: 'website',
      },
    };
  } catch (error) {
    console.error('careers generateMetadata failed, serving minimal fallback metadata', error);
    return { title: { absolute: 'Careers' }, alternates: { canonical: '/careers' } };
  }
}

export default async function CareersPage() {
  let t;
  try {
    t = await getTranslations('careers');
  } catch (error) {
    console.error('careers page failed to load translations, showing degraded state', error);
    return (
      <div className="relative min-h-screen">
        <TopNav />
        <main className="max-w-2xl mx-auto px-4 py-24 text-center">
          <h1 className="text-2xl font-semibold mb-2">Careers</h1>
          <p className="text-muted-foreground text-sm">This page couldn&apos;t load right now, please try again shortly.</p>
        </main>
        <Footer />
      </div>
    );
  }
  const email = 'applications@wody.online';
  // Lista de roluri e editabilă din owner panel (Appearance -> Careers
  // roles). Cât timp owner-ul nu a salvat încă nimic acolo, rămâne pe
  // textul tradus din messages/<locale>.json, ca să nu se schimbe nimic
  // pe pagină până la prima editare.
  const careersRolesConfig = await getCareersRolesConfig();
  const focusAreas = careersRolesConfig.roles || t.raw('focusAreas');

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: t('ogTitle'),
    url: `${SITE_URL}/careers`,
    description: t('metaDescription'),
  };

  return (
    <div className="relative min-h-screen overflow-x-hidden">
      <div className="absolute inset-0 pointer-events-none -z-10">
        <div className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full bg-[#7c3010]/20 blur-3xl" />
        <div className="absolute top-80 -left-40 w-[500px] h-[500px] rounded-full bg-[#c46a2d]/10 blur-3xl" />
      </div>

      <TopNav />

      <main id="main-content" className="max-w-5xl mx-auto px-4 sm:px-6 py-12 md:py-16">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

        <header className="max-w-3xl mx-auto text-center mb-10 md:mb-14">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-card/70 px-3 py-1.5 text-xs text-muted-foreground mb-5">
            <BriefcaseBusiness className="w-3.5 h-3.5 text-primary" />
            {t('badge')}
          </div>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight">
            {t('heroTitlePrefix')} <span className="gradient-text-shimmer">Wody</span>
          </h1>
          <p className="mt-5 text-base sm:text-lg text-muted-foreground leading-relaxed max-w-2xl mx-auto">
            {t('heroSubtitle')}
          </p>
        </header>

        {/* Perks: three short, honest reasons to work with an indie
            project instead of generic corporate benefit copy. */}
        <section className="grid sm:grid-cols-3 gap-4 md:gap-5 mb-6 md:mb-8">
          {[
            { icon: Rocket, title: t('perk1Title'), body: t('perk1Body') },
            { icon: Sparkles, title: t('perk2Title'), body: t('perk2Body') },
            { icon: Users2, title: t('perk3Title'), body: t('perk3Body') },
          ].map(({ icon: Icon, title, body }) => (
            <div
              key={title}
              className="group relative rounded-2xl border border-border/70 bg-card/55 backdrop-blur-sm p-5 sm:p-6 overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:border-[#e08a4e]/50 hover:bg-card/80"
            >
              <div className="absolute -top-10 -right-10 w-28 h-28 rounded-full bg-[#c46a2d]/10 blur-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative w-10 h-10 rounded-xl bg-[#7c3010]/25 text-[#e08a4e] border border-primary/20 flex items-center justify-center mb-4">
                <Icon className="w-5 h-5" />
              </div>
              <h3 className="relative font-semibold">{title}</h3>
              <p className="relative mt-2 text-sm text-muted-foreground leading-6">{body}</p>
            </div>
          ))}
        </section>

        {/* Focus areas as pills: gives the page some of the texture of a
            real careers board (the kind of work involved) without
            inventing specific job postings that don't exist. */}
        <section className="max-w-3xl mx-auto text-center mb-10 md:mb-14">
          <h2 className="text-sm font-semibold uppercase tracking-[0.15em] text-[#e08a4e] mb-4">
            {t('focusAreasTitle')}
          </h2>
          <div className="flex flex-wrap items-center justify-center gap-2.5">
            {focusAreas.map((area) => (
              <span
                key={area}
                className="rounded-full border border-[#c46a2d]/40 bg-[#7c3010]/15 px-4 py-1.5 text-sm font-medium text-[#f2c091]"
              >
                {area}
              </span>
            ))}
          </div>
        </section>

        <section className="grid md:grid-cols-2 gap-4 md:gap-5">
          <article className="rounded-3xl border border-border/70 bg-card/55 backdrop-blur-sm p-6 sm:p-8 text-center md:text-left transition-all duration-300 hover:-translate-y-1 hover:border-[#e08a4e]/50 hover:bg-card/80">
            <div className="w-12 h-12 rounded-2xl bg-[#7c3010]/25 text-[#e08a4e] border border-primary/20 flex items-center justify-center mb-5 mx-auto md:mx-0">
              <BriefcaseBusiness className="w-5 h-5" />
            </div>
            <h2 className="text-2xl font-semibold">{t('contributeTitle')}</h2>
            <p className="mt-3 text-sm sm:text-base text-muted-foreground leading-7">
              {t('contributeBody')}
            </p>
          </article>

          <article className="rounded-3xl border border-border/70 bg-card/55 backdrop-blur-sm p-6 sm:p-8 text-center md:text-left transition-all duration-300 hover:-translate-y-1 hover:border-[#e08a4e]/50 hover:bg-card/80">
            <div className="w-12 h-12 rounded-2xl bg-[#7c3010]/25 text-[#e08a4e] border border-primary/20 flex items-center justify-center mb-5 mx-auto md:mx-0">
              <Mail className="w-5 h-5" />
            </div>
            <h2 className="text-2xl font-semibold">{t('applyTitle')}</h2>
            <p className="mt-3 text-sm sm:text-base text-muted-foreground leading-7">
              {t('applyBody')}
            </p>
            <a
              href={`mailto:${email}?subject=Wody%20Career%20Enquiry`}
              className="mt-6 block rounded-2xl border border-primary/25 bg-background/40 px-4 py-4 text-sm font-medium text-[#f2c091] hover:bg-background/60 hover:border-primary/40 transition-colors break-all"
            >
              {email}
            </a>
          </article>
        </section>

        <section className="max-w-3xl mx-auto mt-6 rounded-3xl border border-border/70 bg-gradient-to-br from-[#7c3010]/15 via-card/45 to-transparent p-6 sm:p-8">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
              <MessageCircle className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">{t('communityTitle')}</h2>
              <p className="mt-2 text-sm sm:text-base text-muted-foreground leading-7">
                {t('communityBody')}
              </p>
              <a href={COMMUNITY_INVITE} target="_blank" rel="noopener noreferrer" className="inline-block mt-5">
                <Button variant="outline" className="gap-2">
                  <MessageCircle className="w-4 h-4" /> {t('joinCommunity')}
                </Button>
              </a>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}

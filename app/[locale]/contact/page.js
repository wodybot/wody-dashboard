import { localizedAlternates } from '@/lib/community/seo';
import { Mail, MessageCircle } from 'lucide-react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { CONTENT, COMMUNITY_INVITE } from '@/lib/content';
import { Button } from '@/components/ui/button';
import { Footer, TopNav } from '@/components/nav';

const SITE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://wody.online';

// getTranslations() (next-intl) opts a Server Component into dynamic
// rendering internally; without this export Next.js still tried to
// STATICALLY prerender this page at build time, the two conflicted,
// and the failed prerender is what actually produced the generic
// 'Server Components render' error visitors saw, on every request,
// not just intermittently. Same fix already applied successfully to
// /team, /blog, /updates and the leaderboard page.
// Public text page: rendered once and cached, refreshed every hour (was rendered on every request).
export const revalidate = 3600;

export async function generateMetadata({ params }) {
  const { locale } = await params;
  setRequestLocale(locale);
  try {
    const t = await getTranslations({ locale, namespace: 'contact' });
    return {
      title: { absolute: t('metaTitle') },
      description: t('metaDescription'),
      alternates: localizedAlternates(locale, '/contact'),
      robots: { index: true, follow: true },
      openGraph: {
        title: t('ogTitle'),
        description: t('metaDescription'),
        url: `${SITE_URL}/contact`,
        type: 'website',
      },
    };
  } catch (error) {
    console.error('contact generateMetadata failed, serving minimal fallback metadata', error);
    return { title: { absolute: 'Contact' }, alternates: { canonical: '/contact' } };
  }
}

export default async function ContactPage({ params }) {
  const { locale } = await params;
  setRequestLocale(locale);
  let t;
  try {
    t = await getTranslations({ locale, namespace: 'contact' });
  } catch (error) {
    console.error('contact page failed to load translations, showing degraded state', error);
    return (
      <div className="relative min-h-screen">
        <TopNav />
        <main className="max-w-2xl mx-auto px-4 py-24 text-center">
          <h1 className="text-2xl font-semibold mb-2">Contact</h1>
          <p className="text-muted-foreground text-sm">This page couldn&apos;t load right now, please try again shortly.</p>
        </main>
        <Footer />
      </div>
    );
  }
  const email = 'contact@wody.online';

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ContactPage',
    name: t('ogTitle'),
    url: `${SITE_URL}/contact`,
    description: t('metaDescription'),
    mainEntity: {
      '@type': 'Organization',
      name: 'Wody',
      email: `mailto:${email}`,
    },
  };

  return (
    <div className="relative min-h-screen overflow-x-hidden">
      <div className="absolute inset-0 pointer-events-none -z-10">
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full bg-[#7c3010]/20 blur-3xl" />
        <div className="absolute top-40 -right-40 w-[500px] h-[500px] rounded-full bg-[#c46a2d]/10 blur-3xl" />
      </div>

      <TopNav />

      <main id="main-content" className="max-w-5xl mx-auto px-4 sm:px-6 py-12 md:py-16">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

        <header className="max-w-3xl mx-auto text-center mb-10 md:mb-14">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-card/70 px-3 py-1.5 text-xs text-muted-foreground mb-5">
            <Mail className="w-3.5 h-3.5 text-primary" />
            {t('badge')}
          </div>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight">
            {t('heroTitlePrefix')} <span className="gradient-text">Wody</span>
          </h1>
          <p className="mt-5 text-base sm:text-lg text-muted-foreground leading-relaxed max-w-2xl mx-auto">
            {t('heroSubtitle')}
          </p>
        </header>

        <section className="max-w-2xl mx-auto rounded-3xl border border-border/70 bg-card/55 backdrop-blur-sm p-6 sm:p-8 md:p-10 shadow-sm">
          <div className="flex flex-col items-center text-center">
            <div className="w-14 h-14 rounded-2xl bg-[#7c3010]/25 text-[#e08a4e] border border-primary/20 flex items-center justify-center mb-5">
              <Mail className="w-6 h-6" />
            </div>
            <h2 className="text-2xl font-semibold">{t('getInTouch')}</h2>
            <p className="mt-2 text-sm sm:text-base text-muted-foreground leading-relaxed">
              {t('getInTouchBody')}
            </p>

            <a
              href={`mailto:${email}`}
              className="mt-7 w-full rounded-2xl border border-primary/25 bg-background/40 px-4 py-4 text-sm sm:text-base font-medium text-[#f2c091] hover:bg-background/60 hover:border-primary/40 transition-colors break-all"
            >
              {email}
            </a>

            <div className="mt-7 grid sm:grid-cols-2 gap-3 w-full">
              <a href={`mailto:${email}`}>
                <Button className="gradient-primary w-full gap-2">
                  <Mail className="w-4 h-4" /> {t('sendEmail')}
                </Button>
              </a>
              <a href={COMMUNITY_INVITE} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" className="w-full gap-2">
                  <MessageCircle className="w-4 h-4" /> {t('joinCommunity')}
                </Button>
              </a>
            </div>
          </div>
        </section>

        <section className="max-w-2xl mx-auto mt-6 rounded-2xl border border-border/70 bg-card/35 p-5 sm:p-6 text-sm text-muted-foreground leading-6">
          <p>{t('footNote')}</p>
        </section>
      </main>

      <Footer />
    </div>
  );
}

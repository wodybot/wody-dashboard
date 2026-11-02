// LEGAL TEXT POLICY: the Privacy Policy, Terms and Cookie Policy are authored in English only. The sections added for Economy, Blackjack, Birthdays and Stream Notifications exist in English and every locale shows that same English text. When changing legal text, edit messages/en.json and copy the same section into the other messages/<locale>.json files unchanged. Do not translate legal text.
// FILE: page.js
// PUNE ÎN: app/privacy/page.js
// (înlocuiește fișierul existent din proiectul wody-dashboard-main la această cale)

import { localizedAlternates } from '@/lib/community/seo';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { TopNav, Footer } from '@/components/nav';
import { CONTENT } from '@/lib/content';

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
    const t = await getTranslations({ locale, namespace: 'privacy' });
    return {
      title: { absolute: `Wody - ${t('pageTitle')}` },
      description: 'How Wody collects, uses, stores and protects data through the Discord bot and web dashboard.',
      alternates: localizedAlternates(locale, '/privacy'),
      robots: { index: true, follow: true },
      openGraph: {
        title: `Wody - ${t('pageTitle')}`,
        description: 'How Wody collects, uses, stores and protects data through the Discord bot and web dashboard.',
        url: `${SITE_URL}/privacy`,
        type: 'website',
      },
    };
  } catch (error) {
    console.error('privacy generateMetadata failed, serving minimal fallback metadata', error);
    return { title: { absolute: 'Privacy' }, alternates: { canonical: '/privacy' } };
  }
}

// See the comment in app/terms/page.js, same trusted-HTML-per-section
// pattern, sourced from the "privacy" namespace in messages/<locale>.json.
export default async function PrivacyPage({ params }) {
  const { locale } = await params;
  setRequestLocale(locale);
  let t, sections;
  try {
    t = await getTranslations({ locale, namespace: 'privacy' });
    sections = t.raw('sections');
  } catch (error) {
    console.error('privacy page failed to load translations, showing degraded state', error);
    return (
      <div className="relative min-h-screen">
        <TopNav />
        <main className="max-w-2xl mx-auto px-4 py-24 text-center">
          <h1 className="text-2xl font-semibold mb-2">Privacy</h1>
          <p className="text-muted-foreground text-sm">This page couldn&apos;t load right now, please try again shortly.</p>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <TopNav />
      <main id="main-content" className="max-w-3xl mx-auto px-6 py-14">
        <h1 className="text-4xl font-bold mb-2 text-center sm:text-left">{t('pageTitle')}</h1>
        <p className="text-sm text-muted-foreground mb-10 text-center sm:text-left">{CONTENT.legal.privacyUpdated}</p>

        <div className="space-y-6 text-[15px] leading-relaxed text-muted-foreground legal-content">
          <div dangerouslySetInnerHTML={{ __html: t.raw('intro') }} />
          {sections.map((s, i) => (
            <section key={i}>
              <h2 className="text-xl font-semibold text-foreground mb-2">{s.heading}</h2>
              <div dangerouslySetInnerHTML={{ __html: s.html }} />
            </section>
          ))}
        </div>
      </main>
      <Footer />
    </div>
  );
}

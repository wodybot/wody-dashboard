
import { localizedAlternates } from '@/lib/community/seo';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { TopNav, Footer } from '@/components/nav';
import { CONTENT } from '@/lib/content';
import { OG_IMAGES, TWITTER_CARD } from '@/lib/seo-social';

const SITE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://wody.online';

export const revalidate = 3600;

export async function generateMetadata({ params }) {
  const { locale } = await params;
  setRequestLocale(locale);
  try {
    const t = await getTranslations({ locale, namespace: 'terms' });
    return {
      title: { absolute: `Wody - ${t('pageTitle')}` },
      description: 'The terms that govern using the Wody Discord bot and web dashboard.',
      alternates: localizedAlternates(locale, '/terms'),
      robots: { index: true, follow: true },
      twitter: TWITTER_CARD,
      openGraph: { images: OG_IMAGES,
        title: `Wody - ${t('pageTitle')}`,
        description: 'The terms that govern using the Wody Discord bot and web dashboard.',
        url: `${SITE_URL}/terms`,
        type: 'website',
      },
    };
  } catch (error) {
    console.error('terms generateMetadata failed, serving minimal fallback metadata', error);
    return { title: { absolute: 'Terms' }, alternates: { canonical: '/terms' } };
  }
}

export default async function TermsPage({ params }) {
  const { locale } = await params;
  setRequestLocale(locale);
  let t, sections;
  try {
    t = await getTranslations({ locale, namespace: 'terms' });
    sections = t.raw('sections');
  } catch (error) {
    console.error('terms page failed to load translations, showing degraded state', error);
    return (
      <div className="relative min-h-screen">
        <TopNav />
        <main className="max-w-2xl mx-auto px-4 py-24 text-center">
          <h1 className="text-2xl font-semibold mb-2">Terms</h1>
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
        <p className="text-sm text-muted-foreground mb-10 text-center sm:text-left">{CONTENT.legal.termsUpdated}</p>

        <div className="space-y-6 text-[15px] leading-relaxed text-muted-foreground legal-content">
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

import { localizedAlternates } from '@/lib/community/seo';
import { getTranslations, getLocale } from 'next-intl/server';
import { Footer, TopNav } from '@/components/nav';
import { Suspense } from 'react';
import TikTokLink from '@/components/tiktok-link';
import { OG_IMAGES, TWITTER_CARD } from '@/lib/seo-social';

const SITE_URL = (process.env.NEXT_PUBLIC_BASE_URL || 'https://wody.online').replace(/\/+$/, '');

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function generateMetadata() {
  try {
    const t = await getTranslations('tiktokLink');
    return {
      title: { absolute: t('metaTitle') },
      description: t('metaDescription'),
      alternates: localizedAlternates(await getLocale(), '/tiktok'),
      robots: { index: true, follow: true },
      twitter: TWITTER_CARD,
      openGraph: { images: OG_IMAGES, title: t('metaTitle'), description: t('metaDescription'), url: `${SITE_URL}/tiktok`, type: 'website' },
    };
  } catch (error) {
    console.error('tiktok generateMetadata failed, serving minimal fallback metadata', error);
    return { title: { absolute: 'Wody Creator Link' }, alternates: { canonical: '/tiktok' } };
  }
}

export default function TikTokPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <TopNav />
      <main className="flex-1 mx-auto w-full max-w-4xl px-4 py-12 sm:py-16">
        <Suspense fallback={null}><TikTokLink /></Suspense>
      </main>
      <Footer />
    </div>
  );
}

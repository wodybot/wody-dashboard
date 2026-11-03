import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Footer, TopNav } from '@/components/nav';
import FavoritesClient from './FavoritesClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function generateMetadata({ params }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'community' });
  return { title: { absolute: t('favorites.pageTitle') }, robots: { index: false, follow: false } };
}

export default async function FavoritesPage({ params }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <div className="min-h-screen">
      <TopNav />
      <main id="main-content" className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-12"><FavoritesClient /></main>
      <Footer />
    </div>
  );
}

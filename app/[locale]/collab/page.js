import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Briefcase, Plus, ShieldCheck } from 'lucide-react';
import { Footer, TopNav } from '@/components/nav';
import { Link } from '@/i18n/navigation';
import CollabHome from '@/components/collab/CollabHome';
import { getSession } from '@/lib/session';
import { mdb } from '@/lib/collab/db';
import { homeSections } from '@/lib/collab/query';
import { CATEGORY_RE } from '@/lib/collab/constants';
import { ROBOTS_INDEX, absolute, localePath, localizedAlternates, ogLocale } from '@/lib/community/seo';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function generateMetadata({ params }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'collab' });
  return {
    title: { absolute: t('seo.title') },
    description: t('seo.description'),
    alternates: localizedAlternates(locale, '/collab'),
    robots: ROBOTS_INDEX,
    openGraph: { title: t('seo.title'), description: t('seo.description'), url: absolute(localePath(locale, '/collab')), type: 'website', siteName: 'Wody', ...ogLocale(locale), images: [{ url: absolute('/opengraph-image') }] },
    twitter: { card: 'summary_large_image', title: t('seo.title'), description: t('seo.description') },
  };
}

export default async function CollabPage({ params, searchParams }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('collab');
  const sp = await searchParams;
  const category = CATEGORY_RE.test(String(sp?.category || '')) ? String(sp.category) : '';
  const session = await getSession();
  let initial = null;
  try {
    const db = await mdb();
    initial = JSON.parse(JSON.stringify(await homeSections(db, { userId: session?.user?.id, category, seed: '' })));
  } catch (e) {
    console.error('collab home failed, the page loads each section on its own', e?.message);
  }
  return (
    <div className="min-h-screen">
      <TopNav user={session?.user || null} />
      <main id="main-content" className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-12">
        <header className="mb-8 text-center">
          <p className="mx-auto mb-3 inline-flex items-center gap-2 rounded-full border border-[#e6cd8c]/30 bg-card/70 px-3 py-1 text-xs text-muted-foreground"><Briefcase className="h-3.5 w-3.5" aria-hidden="true" />{t('badge')}</p>
          <h1 className="text-3xl font-black uppercase tracking-tight sm:text-5xl">{t('title')}</h1>
          <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">{t('subtitle')}</p>
          <nav aria-label={t('title')} className="mx-auto mt-5 flex max-w-2xl flex-wrap items-center justify-center gap-2">
            <Link href="/profile?tab=requests&new=1" className="inline-flex items-center gap-2 rounded-full border border-[#e6cd8c]/50 bg-[#e6cd8c]/10 px-4 py-2 text-sm font-semibold text-[#f3e1b0] transition hover:bg-[#e6cd8c]/20"><Plus className="h-4 w-4" aria-hidden="true" />{t('postRequest')}</Link>
            <Link href="/profile" className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/50 px-4 py-2 text-sm font-medium text-muted-foreground transition hover:text-foreground">{t('myArea')}</Link>
          </nav>
          <p className="mx-auto mt-4 inline-flex max-w-2xl items-start gap-2 text-left text-xs text-muted-foreground"><ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />{t('noPayments')}</p>
        </header>
        <CollabHome initial={initial} initialCategory={category} signedIn={Boolean(session?.user)} />
      </main>
      <Footer />
    </div>
  );
}

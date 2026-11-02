import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { Footer, TopNav } from '@/components/nav';
import ServerCollabPage from '@/components/collab/ServerCollabPage';
import { getSession } from '@/lib/session';
import { CATEGORY_RE } from '@/lib/collab/constants';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const metadata = { title: 'Server Collab', robots: { index: false, follow: true } };

// The data is loaded by the page itself from the public Collab API, which only returns this server's own posts.
export default async function ServerCollabRoute({ params, searchParams }) {
  const { locale, guildId } = await params;
  if (!/^\d{15,25}$/.test(String(guildId))) notFound();
  setRequestLocale(locale);
  const sp = await searchParams;
  const category = CATEGORY_RE.test(String(sp?.category || '')) ? String(sp.category) : '';
  const session = await getSession();
  return (
    <div className="min-h-screen">
      <TopNav user={session?.user || null} />
      <main id="main-content" className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-12">
        <ServerCollabPage guildId={String(guildId)} initialCategory={category} signedIn={Boolean(session?.user)} />
      </main>
      <Footer />
    </div>
  );
}

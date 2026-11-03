import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ArrowLeft, Calendar, Clock, Link2, Tag } from 'lucide-react';
import { Footer, TopNav } from '@/components/nav';
import { Link } from '@/i18n/navigation';
import RequestActions from '@/components/marketplace/RequestActions';
import { getSession } from '@/lib/session';
import { mdb, getCategories } from '@/lib/marketplace/db';
import { publicRequest } from '@/lib/marketplace/query';
import { ROBOTS_INDEX, absolute, localePath, localizedAlternates, clip } from '@/lib/community/seo';
import { OG_IMAGES, TWITTER_CARD } from '@/lib/seo-social';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function load(id) {
  try { const db = await mdb(); const r = await publicRequest(db, id); return { db, r }; } catch (e) { console.error('marketplace request failed', e?.message); return { db: null, r: null }; }
}

export async function generateMetadata({ params }) {
  const { locale, id } = await params;
  const { r } = await load(id);
  if (!r) return { robots: { index: false, follow: false } };
  const t = await getTranslations({ locale, namespace: 'marketplace' });
  const title = `${r.title} | ${t('title')}`;
  return {
    title: { absolute: title }, description: clip(r.description), alternates: localizedAlternates(locale, `/marketplace/${id}`), robots: ROBOTS_INDEX,
    twitter: TWITTER_CARD,
      openGraph: { title, description: clip(r.description), url: absolute(localePath(locale, `/marketplace/${id}`)), type: 'article', siteName: 'Wody', images: [{ url: absolute('/opengraph-image') }] },
  };
}

export default async function RequestPage({ params }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('marketplace');
  const { db, r } = await load(id);
  if (!r) notFound();
  const session = await getSession();
  const cats = db ? await getCategories(db).catch(() => []) : [];
  const cat = cats.find((c) => c.slug === r.category);
  const catLabel = cat?.names?.[locale] || cat?.names?.en || r.category;
  const date = (iso) => new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(iso));
  const files = r.attachments || [];
  return (
    <div className="min-h-screen">
      <TopNav user={session?.user || null} />
      <main id="main-content" className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
        <Link href="/marketplace" className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" aria-hidden="true" />{t('back')}</Link>
        <article className="rounded-3xl border border-border/60 bg-card/60 p-5 sm:p-8">
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-[#e6cd8c]">{catLabel}</p>
          <h1 className="text-2xl font-bold leading-tight sm:text-3xl">{r.title}</h1>
          <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" aria-hidden="true" />{date(r.published_at)}</span>
            {r.deadline && <span className="inline-flex items-center gap-1"><Calendar className="h-3.5 w-3.5" aria-hidden="true" />{t('deadline')}: {r.deadline}</span>}
            {r.origin_guild_name && <span>{t('fromServer', { name: r.origin_guild_name })}</span>}
            <span>{t('applicationsCount', { n: r.applications })}</span>
          </p>
          <section className="mt-6"><h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">{t('f.description')}</h2><p className="whitespace-pre-wrap break-words text-sm leading-relaxed sm:text-base">{r.description}</p></section>
          {r.outcome && <section className="mt-5"><h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">{t('f.outcome')}</h2><p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{r.outcome}</p></section>}
          {r.requirements && <section className="mt-5"><h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">{t('f.requirements')}</h2><p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{r.requirements}</p></section>}
          {r.tags.length > 0 && <p className="mt-5 flex flex-wrap items-center gap-1.5"><Tag className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />{r.tags.map((x) => <span key={x} className="rounded-md bg-muted/60 px-1.5 py-0.5 text-xs">#{x}</span>)}</p>}
          {r.links.length > 0 && (
            <section className="mt-5"><h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">{t('f.links')}</h2>
              <ul className="space-y-1">{r.links.map((u) => <li key={u} className="flex items-center gap-2 text-sm"><Link2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /><a href={u} target="_blank" rel="noopener noreferrer nofollow ugc" className="break-all underline underline-offset-4">{u}</a></li>)}</ul>
              <p className="mt-1 text-[11px] text-muted-foreground">{t('linksWarning')}</p>
            </section>
          )}
          {files.length > 0 && (
            <section className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {files.map((fid) => { const file_src = `/api/marketplace/file/${fid}`; return <a key={fid} href={file_src} target="_blank" rel="noopener noreferrer"><img src={file_src} alt={t('attachmentAlt')} loading="lazy" decoding="async" className="aspect-video w-full rounded-lg border border-border/60 object-cover" /></a>; })}
            </section>
          )}
        </article>
        <RequestActions request={{ id: r.id, title: r.title, questions: r.questions, public_contact: r.public_contact }} signedIn={Boolean(session?.user)} />
      </main>
      <Footer />
    </div>
  );
}

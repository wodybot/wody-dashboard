import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { FileText, Target, ListChecks, ArrowLeft, Calendar, Clock, Link2, Tag, TreePalm, UserRound } from 'lucide-react';
import { Footer, TopNav } from '@/components/nav';
import { Link } from '@/i18n/navigation';
import { discordCdnUrl } from '@/lib/utils';
import RequestActions, { ReportButton } from '@/components/collab/RequestActions';
import OwnerBar from '@/components/collab/OwnerBar';
import { OWNER_ID } from '@/lib/owner-access';
import { getSession } from '@/lib/session';
import { mdb, getCategories } from '@/lib/collab/db';
import { publicRequest } from '@/lib/collab/query';
import { ROBOTS_INDEX, absolute, localePath, localizedAlternates, clip } from '@/lib/community/seo';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function load(id) {
  try { const db = await mdb(); const r = await publicRequest(db, id); return { db, r }; } catch (e) { console.error('collab request failed', e?.message); return { db: null, r: null }; }
}

export async function generateMetadata({ params }) {
  const { locale, id } = await params;
  const { r } = await load(id);
  if (!r) return { robots: { index: false, follow: false } };
  const t = await getTranslations({ locale, namespace: 'collab' });
  const title = `${r.title} | ${t('title')}`;
  return {
    title: { absolute: title }, description: clip(r.description), alternates: localizedAlternates(locale, `/collab/${id}`), robots: ROBOTS_INDEX,
    openGraph: { title, description: clip(r.description), url: absolute(localePath(locale, `/collab/${id}`)), type: 'article', siteName: 'Wody', images: [{ url: absolute('/opengraph-image') }] },
  };
}

// A titled block of the request page: a gold icon chip, a larger heading and the text in a tinted panel,
// so Description, Desired outcome and the rest are easy to tell apart at a glance.
function Block({ icon: Icon, title, tone = 'gold', children }) {
  const tones = {
    gold: { chip: 'bg-[#e6cd8c]/15 text-[#e6cd8c] ring-[#e6cd8c]/30', head: 'text-[#f3e1b0]', box: 'border-[#e6cd8c]/25 bg-[#e6cd8c]/[0.04]' },
    green: { chip: 'bg-emerald-400/15 text-emerald-300 ring-emerald-400/30', head: 'text-emerald-200', box: 'border-emerald-400/25 bg-emerald-400/[0.04]' },
    sky: { chip: 'bg-sky-400/15 text-sky-300 ring-sky-400/30', head: 'text-sky-200', box: 'border-sky-400/25 bg-sky-400/[0.04]' },
    violet: { chip: 'bg-violet-400/15 text-violet-300 ring-violet-400/30', head: 'text-violet-200', box: 'border-violet-400/25 bg-violet-400/[0.04]' },
  }[tone];
  return (
    <section className="mt-6">
      <h2 className={`mb-2.5 flex items-center gap-2.5 text-lg font-bold tracking-tight sm:text-xl ${tones.head}`}>
        <span className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1 ${tones.chip}`}><Icon className="h-4 w-4" aria-hidden="true" /></span>
        {title}
      </h2>
      <div className={`rounded-2xl border p-4 sm:p-5 ${tones.box}`}>{children}</div>
    </section>
  );
}

export default async function RequestPage({ params }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('collab');
  const { db, r } = await load(id);
  if (!r) notFound();
  const session = await getSession();
  const cats = db ? await getCategories(db).catch(() => []) : [];
  const cat = cats.find((c) => c.slug === r.category);
  const catLabel = cat?.names?.[locale] || cat?.names?.en || r.category_name || r.category;
  const date = (iso) => new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(iso));
  const files = r.attachments || [];
  return (
    <div className="min-h-screen">
      <TopNav user={session?.user || null} />
      <main id="main-content" className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
        <Link href="/collab" className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" aria-hidden="true" />{t('back')}</Link>
        {String(session?.user?.id || '') === String(OWNER_ID) && <OwnerBar requestId={r.id} status={r.status || 'published'} />}
        <article className="rounded-3xl border border-border/60 bg-card/60 p-5 sm:p-8">
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-[#e6cd8c]">{catLabel}</p>
          <h1 className="text-2xl font-bold leading-tight sm:text-3xl">{r.title}</h1>
          <div data-author className="mt-4 flex items-center gap-3 rounded-2xl border border-border/60 bg-background/40 p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={discordCdnUrl(r.author.avatar || 'https://cdn.discordapp.com/embed/avatars/0.png')} alt="" width={40} height={40} className="h-10 w-10 shrink-0 rounded-full border border-[#e6cd8c]/50 object-cover" />
            <div className="min-w-0 flex-1">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{t('postedBy')}</p>
              <p className="truncate text-sm font-semibold">{r.author.name}</p>
            </div>
            {r.author_profile && (
              <Link href={r.author_profile} className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-[#e6cd8c]/40 bg-[#e6cd8c]/10 px-3 text-xs font-semibold text-[#f3e1b0] transition-colors hover:bg-[#e6cd8c]/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e6cd8c]">
                <UserRound className="h-3.5 w-3.5" aria-hidden="true" />{t('viewProfile')}
              </Link>
            )}
          </div>
          <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" aria-hidden="true" />{date(r.published_at)}</span>
            {r.deadline && <span className="inline-flex items-center gap-1"><Calendar className="h-3.5 w-3.5" aria-hidden="true" />{t('deadline')}: {r.deadline}</span>}
            <span>{r.origin_guild_name ? t('fromServer', { name: r.origin_guild_name }) : t('forEveryone')}</span>
            <span>{t('applicationsCount', { n: r.applications })}</span>
          </p>
          <Block icon={FileText} title={t('f.description')} tone="gold"><p className="whitespace-pre-wrap break-words text-sm leading-relaxed sm:text-base">{r.description}</p></Block>
          {r.outcome && <Block icon={Target} title={t('f.outcome')} tone="green"><p className="whitespace-pre-wrap break-words text-sm leading-relaxed sm:text-base">{r.outcome}</p></Block>}
          {r.requirements && <Block icon={ListChecks} title={t('f.requirements')} tone="sky"><p className="whitespace-pre-wrap break-words text-sm leading-relaxed sm:text-base">{r.requirements}</p></Block>}
          {r.tags.length > 0 && <p className="mt-5 flex flex-wrap items-center gap-1.5"><Tag className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />{r.tags.map((x) => <span key={x} className="rounded-md bg-muted/60 px-1.5 py-0.5 text-xs">#{x}</span>)}</p>}
          {r.links.length > 0 && (
            <Block icon={Link2} title={t('f.links')} tone="violet">
              <ul className="space-y-1">{r.links.map((u) => <li key={u} className="flex items-center gap-2 text-sm"><Link2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /><a href={u} target="_blank" rel="noopener noreferrer nofollow ugc" className="break-all underline underline-offset-4">{u}</a></li>)}</ul>
              <p className="mt-1 text-[11px] text-muted-foreground">{t('linksWarning')}</p>
            </Block>
          )}
          {files.length > 0 && (
            <section className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {files.map((fid) => { const file_src = `/api/collab/file/${fid}`; return <a key={fid} href={file_src} target="_blank" rel="noopener noreferrer"><img src={file_src} alt={t('attachmentAlt')} loading="lazy" decoding="async" className="aspect-video w-full rounded-lg border border-border/60 object-cover" /></a>; })}
            </section>
          )}
          <ReportButton request={{ id: r.id }} signedIn={Boolean(session?.user)} />
        </article>
        {r.author_away && (
          <p data-away="on" className="mt-6 flex items-start gap-2 rounded-2xl border border-sky-400/40 bg-sky-400/10 p-4 text-sm text-sky-100">
            <TreePalm className="mt-0.5 h-4 w-4 shrink-0 text-sky-300" aria-hidden="true" />
            <span className="min-w-0 break-words"><b>{t('away.title')}</b> {t('away.text')}{r.author_away.until ? ` ${t('away.until', { date: new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(`${r.author_away.until}T00:00:00Z`)) })}` : ''}{r.author_away.note ? <span className="mt-1 block text-xs text-sky-100/90">{r.author_away.note}</span> : null}</span>
          </p>
        )}
        <RequestActions request={{ id: r.id, title: r.title, questions: r.questions, public_contact: r.public_contact }} signedIn={Boolean(session?.user)} />
      </main>
      <Footer />
    </div>
  );
}

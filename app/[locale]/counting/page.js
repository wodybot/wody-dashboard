import Link from 'next/link';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Footer, TopNav } from '@/components/nav';
import { getDb } from '@/lib/mongo';
import { loadSummary, loadGames, loadGlobalBoard } from '@/lib/counting/public';
import { MODES } from '@/lib/counting/constants';
import { countingMetadata, listJsonLd, ldScript } from '@/lib/counting/seo';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function generateMetadata({ params }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'counting' });
  return countingMetadata({ locale, path: '/counting', title: t('seo.listTitle'), description: t('seo.listDescription') });
}

const fmt = (n, locale) => { try { return new Intl.NumberFormat(locale).format(n); } catch { return String(n); } };

export default async function CountingHomePage({ params, searchParams }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const mode = MODES.includes(sp?.mode) ? sp.mode : '';
  const sort = ['record', 'valid', 'new'].includes(sp?.sort) ? sp.sort : 'record';
  const q = typeof sp?.q === 'string' ? sp.q.slice(0, 40) : '';
  const skip = Math.min(Math.max(parseInt(sp?.skip, 10) || 0, 0), 10000);
  const [t, modeT, db] = await Promise.all([getTranslations({ locale, namespace: 'counting' }), getTranslations({ locale, namespace: 'counting.mode' }), getDb()]);
  const [summary, list, board] = await Promise.all([loadSummary(db), loadGames(db, { mode, q, sort, skip }), loadGlobalBoard(db, 'valid', 0)]);
  const games = list.games || [];
  const prefix = locale === 'en' ? '' : `/${locale}`;
  const link = (over) => {
    const p = new URLSearchParams({ ...(mode ? { mode } : {}), ...(sort !== 'record' ? { sort } : {}), ...(q ? { q } : {}), ...over });
    for (const [k, v] of [...p]) if (!v || v === '0') p.delete(k);
    const s = p.toString();
    return `${prefix}/counting${s ? `?${s}` : ''}`;
  };
  return (
    <div className="relative min-h-screen overflow-x-hidden">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldScript(listJsonLd({ locale, t, games })) }} />
      <TopNav />
      <main id="main-content" className="mx-auto max-w-5xl px-4 py-12 sm:px-6 md:py-16">
        <header className="mb-10 text-center">
          <p className="mb-4 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">{t('public.badge')}</p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{t('public.title')}</h1>
          <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground sm:text-base">{t('public.subtitle')}</p>
          <dl className="mt-7 flex flex-wrap items-stretch justify-center gap-3">
            {[['games', summary.games], ['total', summary.total_valid], ['record', summary.highest]].map(([k, v]) => (
              <div key={k} className="min-w-[8.5rem] rounded-xl border border-border/60 bg-card/50 px-4 py-2.5">
                <dt className="text-[11px] text-muted-foreground">{t(`public.stat.${k}`)}</dt><dd className="text-lg font-semibold tabular-nums">{fmt(v, locale)}</dd>
              </div>))}
          </dl>
        </header>

        <section aria-labelledby="games-h" className="mb-12">
          <h2 id="games-h" className="mb-4 text-xl font-semibold">{t('public.gamesTitle')}</h2>
          <form method="get" action={`${prefix}/counting`} className="mb-5 flex flex-wrap gap-2">
            <label className="sr-only" htmlFor="q">{t('public.search')}</label>
            <input id="q" name="q" defaultValue={q} maxLength={40} placeholder={t('public.search')} className="h-10 min-w-[10rem] flex-1 rounded-md border border-input bg-background px-3 text-sm" />
            <label className="sr-only" htmlFor="mode">{t('public.filterMode')}</label>
            <select id="mode" name="mode" defaultValue={mode} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
              <option value="">{t('public.allModes')}</option>{MODES.map((m) => <option key={m} value={m}>{modeT(m)}</option>)}
            </select>
            <label className="sr-only" htmlFor="sort">{t('public.sort')}</label>
            <select id="sort" name="sort" defaultValue={sort} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
              {['record', 'valid', 'new'].map((s) => <option key={s} value={s}>{t(`public.sortBy.${s}`)}</option>)}
            </select>
            <button type="submit" className="h-10 rounded-md bg-[#e6cd8c] px-4 text-sm font-medium text-black">{t('public.apply')}</button>
          </form>
          {games.length === 0 ? <p className="text-sm text-muted-foreground">{t('public.noGames')}</p> : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {games.map((g) => (
                <li key={g.channel_id}>
                  <Link href={`${prefix}/counting/${g.channel_id}`} className="block rounded-xl border border-border/60 bg-card/50 p-4 transition hover:border-[#e6cd8c]/50">
                    <h3 className="font-semibold">{g.name || t('seo.gameFallback')}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{modeT(g.mode.startsWith('custom:') ? 'custom_sequence' : g.mode)}{g.status === 'paused' ? ` · ${t('state.paused')}` : ''}</p>
                    <p className="mt-2 text-sm tabular-nums">{t('public.record')}: <strong>{fmt(g.highest_index, locale)}</strong> · {t('public.total')}: {fmt(g.stats.total_valid, locale)}</p>
                  </Link>
                </li>))}
            </ul>)}
          <nav className="mt-5 flex justify-between text-sm" aria-label={t('public.pages')}>
            {skip > 0 ? <Link href={link({ skip: String(Math.max(0, skip - 24)) })} rel="prev" className="underline">{t('public.prev')}</Link> : <span />}
            {games.length === 24 ? <Link href={link({ skip: String(skip + 24) })} rel="next" className="underline">{t('public.next')}</Link> : null}
          </nav>
        </section>

        <section aria-labelledby="board-h" className="mb-12">
          <h2 id="board-h" className="mb-4 text-xl font-semibold">{t('public.boardTitle')}</h2>
          <p className="mb-3 text-sm text-muted-foreground">{t('public.boardHint')}</p>
          {board.rows?.length ? (
            <ol className="divide-y divide-border/50 rounded-xl border border-border/60 bg-card/50">
              {board.rows.slice(0, 10).map((r) => (<li key={r.rank} className="flex items-center justify-between px-4 py-2.5 text-sm"><span><span className="mr-3 inline-block w-6 text-muted-foreground tabular-nums">{r.rank}</span>{r.name}</span><span className="tabular-nums">{fmt(r.value, locale)}</span></li>))}
            </ol>) : <p className="text-sm text-muted-foreground">{t('public.noBoard')}</p>}
        </section>

        <section className="rounded-xl border border-border/60 bg-card/40 p-5 text-sm text-muted-foreground">
          <p>{t('public.privacy')}</p>
          <p className="mt-2"><Link className="underline" href={`${prefix}/counting/help`}>{t('public.helpLink')}</Link></p>
        </section>
      </main>
      <Footer />
    </div>
  );
}

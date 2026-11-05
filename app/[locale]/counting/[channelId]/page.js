import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Footer, TopNav } from '@/components/nav';
import { getDb } from '@/lib/mongo';
import { loadGame } from '@/lib/counting/public';
import { countingMetadata, gameJsonLd, ldScript } from '@/lib/counting/seo';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function generateMetadata({ params }) {
  const { locale, channelId } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'counting' });
  const data = await loadGame(await getDb(), channelId);
  if (!data) return { robots: { index: false, follow: false } };
  const name = data.game.name || t('seo.gameFallback');
  return countingMetadata({ locale, path: `/counting/${channelId}`, title: t('seo.gameTitle', { name }), description: t('seo.gameDescription', { name, record: data.game.highest_index, total: data.game.stats.total_valid }) });
}

const fmt = (n, locale) => { try { return new Intl.NumberFormat(locale).format(n); } catch { return String(n); } };

export default async function CountingGamePage({ params }) {
  const { locale, channelId } = await params;
  setRequestLocale(locale);
  const [t, modeT, data] = await Promise.all([getTranslations({ locale, namespace: 'counting' }), getTranslations({ locale, namespace: 'counting.mode' }), getDb().then((db) => loadGame(db, channelId))]);
  if (!data) notFound();
  const { game, counters, history, daily } = data;
  const prefix = locale === 'en' ? '' : `/${locale}`;
  const max = Math.max(1, ...daily.map((d) => d.valid + d.errors));
  const accuracy = game.stats.total_valid + game.stats.total_errors ? Math.round((1000 * game.stats.total_valid) / (game.stats.total_valid + game.stats.total_errors)) / 10 : 0;
  return (
    <div className="relative min-h-screen overflow-x-hidden">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldScript(gameJsonLd({ locale, t, game })) }} />
      <TopNav />
      <main id="main-content" className="mx-auto max-w-4xl px-4 py-12 sm:px-6 md:py-16">
        <nav aria-label="breadcrumb" className="mb-6 text-sm text-muted-foreground"><Link className="underline" href={`${prefix}/counting`}>{t('seo.breadcrumb')}</Link></nav>
        <header className="mb-8">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{game.name || t('seo.gameFallback')}</h1>
          <p className="mt-2 text-muted-foreground">{modeT(game.mode.startsWith('custom:') ? 'custom_sequence' : game.mode)} · {t(`state.${game.status}`)}</p>
        </header>
        <dl className="mb-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[['current', game.index ? game.value : '0'], ['record', fmt(game.highest_index, locale)], ['total', fmt(game.stats.total_valid, locale)], ['accuracy', `${accuracy}%`]].map(([k, v]) => (
            <div key={k} className="rounded-xl border border-border/60 bg-card/50 px-4 py-3"><dt className="text-[11px] text-muted-foreground">{t(`public.stat.${k}`)}</dt><dd className="text-xl font-semibold tabular-nums">{v}</dd></div>))}
        </dl>
        <section aria-labelledby="days-h" className="mb-10">
          <h2 id="days-h" className="mb-3 text-xl font-semibold">{t('public.last30')}</h2>
          {daily.length ? (
            <>
              <div className="flex h-40 items-end gap-1 rounded-xl border border-border/60 bg-card/50 p-3" role="img" aria-label={t('public.last30')}>
                {daily.map((d) => (<div key={d.day} className="flex flex-1 flex-col justify-end" title={`${d.day}: ${d.valid} / ${d.errors}`}><div className="bg-red-400/70" style={{ height: `${(d.errors / max) * 100}%` }} /><div className="bg-emerald-400/80" style={{ height: `${(d.valid / max) * 100}%` }} /></div>))}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{t('public.legend')}</p>
            </>) : <p className="text-sm text-muted-foreground">{t('public.noActivity')}</p>}
        </section>
        <div className="grid gap-8 md:grid-cols-2">
          <section aria-labelledby="top-h">
            <h2 id="top-h" className="mb-3 text-xl font-semibold">{t('public.topCounters')}</h2>
            {counters.length ? (<ol className="divide-y divide-border/50 rounded-xl border border-border/60 bg-card/50">{counters.map((c, i) => (<li key={i} className="flex justify-between px-4 py-2.5 text-sm"><span><span className="mr-3 inline-block w-6 text-muted-foreground tabular-nums">{i + 1}</span>{c.name}</span><span className="tabular-nums">{fmt(c.valid, locale)}</span></li>))}</ol>) : <p className="text-sm text-muted-foreground">{t('public.noBoard')}</p>}
          </section>
          <section aria-labelledby="hist-h">
            <h2 id="hist-h" className="mb-3 text-xl font-semibold">{t('public.rounds')}</h2>
            {history.length ? (<ul className="divide-y divide-border/50 rounded-xl border border-border/60 bg-card/50">{history.map((h) => (<li key={h.session} className="px-4 py-2.5 text-sm">{t('public.roundLine', { session: h.session, index: fmt(h.final_index, locale), people: h.participants })}</li>))}</ul>) : <p className="text-sm text-muted-foreground">{t('public.noRounds')}</p>}
          </section>
        </div>
        <p className="mt-10 text-sm text-muted-foreground">{t('public.privacy')}</p>
      </main>
      <Footer />
    </div>
  );
}

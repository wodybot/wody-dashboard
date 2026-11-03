'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Globe, Bot, Server, Palette, Clapperboard, LayoutTemplate, Code2, PenLine, AudioLines, Sparkles, LayoutGrid, Plus, AlertTriangle } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import Scroller from './Scroller';
import RequestCard, { CardSkeletons } from './RequestCard';
import { mfetch, catName } from './client';

const ICONS = { Globe, Bot, Server, Palette, Clapperboard, LayoutTemplate, Code2, PenLine, AudioLines, Sparkles };
const newSeed = () => Math.random().toString(36).slice(2, 10);

function Section({ id, title, hint, state, categories, onRefresh, onMore, emptyText, signedIn }) {
  const t = useTranslations('marketplace');
  return (
    <section aria-labelledby={`mk-${id}`} className="mb-10">
      <div className="mb-2">
        <h2 id={`mk-${id}`} className="text-xl font-bold sm:text-2xl">{title}</h2>
        {hint && <p className="mt-0.5 text-sm text-muted-foreground">{hint}</p>}
      </div>
      <Scroller
        label={title} prevLabel={t('prev')} nextLabel={t('next')} refreshLabel={t('refresh')}
        onRefresh={onRefresh} refreshing={state.loading} onNearEnd={onMore}
      >
        {state.loading && !state.items.length && <CardSkeletons />}
        {state.error && !state.items.length && (
          <div role="alert" className="flex w-full items-center gap-3 rounded-2xl border border-destructive/40 bg-destructive/5 p-4 text-sm">
            <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" /><span className="flex-1">{t('sectionError')}</span>
            <button type="button" className="rounded-lg border border-border/70 px-3 py-1.5 font-medium" onClick={onRefresh}>{t('retry')}</button>
          </div>
        )}
        {!state.loading && !state.error && !state.items.length && (
          <div className="w-full rounded-2xl border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">
            {emptyText || t('empty')}{' '}
            <Link href="/dashboard/marketplace" className="font-medium text-foreground underline underline-offset-4">{signedIn ? t('postFirst') : t('postFirstLogin')}</Link>
          </div>
        )}
        {state.items.map((it) => <RequestCard key={it.id} item={it} categories={categories} />)}
        {state.moreLoading && <CardSkeletons n={2} />}
      </Scroller>
    </section>
  );
}

const blank = { items: [], next: null, loading: true, error: false, moreLoading: false };

export default function MarketplaceHome({ initial, initialCategory = '', signedIn = false }) {
  const t = useTranslations('marketplace');
  const locale = useLocale();
  const [category, setCategory] = useState(initialCategory);
  const [cats, setCats] = useState(initial?.categories || []);
  const [popular, setPopular] = useState(initial?.popular || []);
  const seed = useRef(initial?.seed || newSeed());
  const seen = useRef(new Set((initial?.discover?.items || []).map((x) => x.id)));
  const fromInitial = (k) => (initial?.[k] ? { ...blank, items: initial[k].items, next: initial[k].next, loading: false } : blank);
  const [secs, setSecs] = useState({
    for_you: fromInitial('for_you'), recent: fromInitial('recent'), discover: fromInitial('discover'), updated: fromInitial('updated'),
  });
  const [zones, setZones] = useState({});
  const gen = useRef(0);

  const patch = (k, v) => setSecs((s) => ({ ...s, [k]: { ...s[k], ...v } }));

  const loadSection = useCallback(async (k, cat, { fresh = false } = {}) => {
    const my = gen.current;
    patch(k, { loading: true, error: false });
    let q = `section/${k}?category=${encodeURIComponent(cat || '')}`;
    if (k === 'discover') {
      if (fresh) seed.current = newSeed();
      q += `&seed=${seed.current}&seen=${[...seen.current].slice(-200).join(',')}`;
    }
    const r = await mfetch(q);
    if (my !== gen.current) return;
    if (!r.ok) { patch(k, { loading: false, error: true }); return; }
    if (k === 'discover') for (const it of r.data.items) seen.current.add(it.id);
    patch(k, { items: r.data.items, next: r.data.next || null, loading: false, error: false });
  }, []);

  const loadMore = useCallback(async (k) => {
    setSecs((s) => {
      const cur = s[k];
      if (!cur.next || cur.moreLoading) return s;
      (async () => {
        const r = await mfetch(`section/recent?category=${encodeURIComponent(category || '')}&cursor=${cur.next}`);
        setSecs((s2) => ({ ...s2, [k]: r.ok ? { ...s2[k], items: [...s2[k].items, ...r.data.items.filter((n) => !s2[k].items.some((o) => o.id === n.id))], next: r.data.next || null, moreLoading: false } : { ...s2[k], moreLoading: false } }));
      })();
      return { ...s, [k]: { ...cur, moreLoading: true } };
    });
  }, [category]);

  const pick = useCallback((slug) => {
    if (slug === category) return;
    gen.current += 1;
    setCategory(slug);
    seen.current = new Set();
    seed.current = newSeed();
    try { const u = new URL(window.location.href); if (slug) u.searchParams.set('category', slug); else u.searchParams.delete('category'); window.history.replaceState(null, '', u); } catch { }
    setSecs({ for_you: blank, recent: blank, discover: blank, updated: blank });
    for (const k of ['for_you', 'recent', 'discover', 'updated']) loadSection(k, slug);
  }, [category, loadSection]);

  useEffect(() => {
    let alive = true;
    mfetch('categories').then((r) => { if (alive && r.ok) { setCats(r.data.categories); setPopular(r.data.popular); } });
    return () => { alive = false; };
  }, []);

  const withItems = useMemo(() => cats.filter((c) => c.count > 0), [cats]);

  return (
    <div>
      <nav aria-label={t('categories')} className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">{t('categories')}</h2>
        <div className="mk-scroll -mx-1 flex gap-3 overflow-x-auto px-1 pb-2" style={{ scrollbarWidth: 'none' }}>
          {[{ slug: '', icon: 'all', count: cats.reduce((n, c) => n + c.count, 0), names: { en: t('all') } }, ...cats].map((c) => {
            const Icon = c.slug === '' ? LayoutGrid : (ICONS[c.icon] || Sparkles);
            const active = category === c.slug;
            return (
              <button
                key={c.slug || 'all'} type="button" aria-pressed={active} onClick={() => pick(c.slug)}
                className={`flex w-[132px] shrink-0 flex-col items-start gap-2 rounded-2xl border p-3 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e6cd8c] ${active ? 'border-[#e6cd8c]/70 bg-[#e6cd8c]/10' : 'border-border/60 bg-card/50 hover:border-[#e6cd8c]/40'}`}
              >
                <Icon className="h-5 w-5 text-[#e6cd8c]" aria-hidden="true" />
                <span className="line-clamp-2 min-h-[2.5rem] text-sm font-medium leading-tight">{c.slug === '' ? t('all') : catName(c, locale)}</span>
                <span className="text-[11px] text-muted-foreground">{t('count', { n: c.count })}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {popular.length > 0 && !category && (
        <section aria-labelledby="mk-popular" className="mb-10">
          <h2 id="mk-popular" className="mb-3 text-xl font-bold sm:text-2xl">{t('popular')}</h2>
          <ul className="flex flex-wrap gap-2">
            {popular.map((c) => (
              <li key={c.slug}><button type="button" onClick={() => pick(c.slug)} className="rounded-full border border-border/60 bg-card/50 px-3 py-1.5 text-sm hover:border-[#e6cd8c]/50">{catName(c, locale)} <span className="text-muted-foreground">· {t('applicationsCount', { n: c.applications_30d })}</span></button></li>
            ))}
          </ul>
        </section>
      )}

      <Section id="foryou" title={t('forYou')} hint={t('forYouHint')} state={secs.for_you} categories={cats} onRefresh={() => loadSection('for_you', category, { fresh: true })} signedIn={signedIn} />
      <Section id="recent" title={t('recent')} state={secs.recent} categories={cats} onRefresh={() => loadSection('recent', category)} onMore={() => loadMore('recent')} signedIn={signedIn} />
      <Section id="discover" title={t('discover')} hint={t('discoverHint')} state={secs.discover} categories={cats} onRefresh={() => loadSection('discover', category, { fresh: true })} signedIn={signedIn} />
      <Section id="updated" title={t('updated')} state={secs.updated} categories={cats} onRefresh={() => loadSection('updated', category)} emptyText={t('updatedEmpty')} signedIn={signedIn} />

      {!category && withItems.map((c) => (
        <Zone key={c.slug} cat={c} cats={cats} state={zones[c.slug]} setZones={setZones} onOpen={() => pick(c.slug)} />
      ))}
    </div>
  );
}

function Zone({ cat, cats, state, setZones, onOpen }) {
  const t = useTranslations('marketplace');
  const locale = useLocale();
  const ref = useRef(null);
  const load = useCallback(async () => {
    setZones((z) => ({ ...z, [cat.slug]: { ...(z[cat.slug] || blank), loading: true, error: false } }));
    const r = await mfetch(`section/recent?category=${cat.slug}`);
    setZones((z) => ({ ...z, [cat.slug]: r.ok ? { ...blank, items: r.data.items, next: r.data.next, loading: false } : { ...blank, loading: false, error: true } }));
  }, [cat.slug, setZones]);
  useEffect(() => {
    const el = ref.current; if (!el || state) return undefined;
    if (typeof IntersectionObserver === 'undefined') { load(); return undefined; }
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { io.disconnect(); load(); } }, { rootMargin: '300px' });
    io.observe(el);
    return () => io.disconnect();
  }, [state, load]);
  const st = state || blank;
  return (
    <div ref={ref}>
      <Section
        id={`zone-${cat.slug}`} title={catName(cat, locale)} hint={t('zoneHint', { n: cat.count })} state={st} categories={cats} onRefresh={load}
        onMore={undefined}
      />
      <button type="button" onClick={onOpen} className="sr-only focus:not-sr-only">{t('openCategory')}</button>
    </div>
  );
}

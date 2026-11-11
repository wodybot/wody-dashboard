'use client';

import { useCallback, useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Eye, EyeOff, Loader2, Star } from 'lucide-react';
import { btn } from '@/components/collab/ProfileParts';

const GROUPS = ['badge', 'medal', 'reward'];
const groupOf = (type) => (type === 'badge' ? 'badge' : type === 'achievement' ? 'medal' : 'reward');

async function call(method, path, body) {
  try {
    const res = await fetch(`/api/battlepass/${path}`, { method, headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined, cache: 'no-store' });
    return { ok: res.ok, data: await res.json().catch(() => ({})) };
  } catch { return { ok: false, data: {} }; }
}

/** Per Battle Pass and per item switches for what the public profile shows. Saves as you go. */
export default function BattlePassVisibility({ onSaved }) {
  const t = useTranslations('battlepass.profile');
  const locale = useLocale();
  const [state, setState] = useState('loading');
  const [items, setItems] = useState([]);
  const [seasons, setSeasons] = useState([]);
  const [hiddenSeasons, setHiddenSeasons] = useState([]);
  const [hiddenItems, setHiddenItems] = useState([]);
  const [featured, setFeatured] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let live = true;
    call('GET', 'inventory').then((r) => {
      if (!live) return;
      if (!r.ok) { setState('error'); return; }
      setItems(r.data.items || []); setSeasons(r.data.seasons || []);
      setHiddenSeasons(r.data.profile?.hidden_seasons || []); setHiddenItems(r.data.profile?.hidden_items || []);
      setFeatured(r.data.profile?.featured_badge || null);
      setState('ready');
    });
    return () => { live = false; };
  }, []);

  const save = useCallback(async (patch, rollback) => {
    setError(false);
    const r = await call('PATCH', 'profile', patch);
    if (!r.ok) { rollback(); setError(true); return; }
    onSaved?.();
  }, [onSaved]);

  const toggleSeason = (id) => {
    const prev = hiddenSeasons;
    const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
    setHiddenSeasons(next);
    save({ hidden_seasons: next }, () => setHiddenSeasons(prev));
  };
  const setMany = (ids, hide) => {
    const prev = hiddenItems;
    const set = new Set(prev);
    ids.forEach((id) => (hide ? set.add(id) : set.delete(id)));
    const next = [...set];
    setHiddenItems(next);
    save({ hidden_items: next }, () => setHiddenItems(prev));
  };
  const feature = (id) => {
    const prev = featured;
    const next = prev === id ? null : id;
    setFeatured(next);
    save({ featured_badge: next }, () => setFeatured(prev));
  };

  if (state === 'loading') return <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /></div>;
  if (state === 'error') return <p className="text-sm text-muted-foreground">{t('loadError')}</p>;
  if (!items.length) return <p className="text-sm text-muted-foreground">{t('empty')}</p>;

  const name = (o) => o.i18n?.[locale]?.name || o.name;
  // Counting badges are Wody achievements; only seasons Wody itself runs (Global) are shown on a profile, so only those are listed here.
  const bySeason = [
    ...(items.some((i) => i.season_id === 'counting') ? [{ id: 'counting', name: t('achievementsName'), scope: 'counting' }] : []),
    ...seasons.filter((s) => s.scope === 'global'),
  ];

  return (
    <div className="space-y-4">
      {bySeason.map((se) => {
        const own = items.filter((i) => i.season_id === se.id);
        if (!own.length) return null;
        const seasonOff = hiddenSeasons.includes(se.id);
        const shown = seasonOff ? 0 : own.filter((i) => !hiddenItems.includes(i.item_id)).length;
        return (
          <div key={se.id} className={`rounded-xl border border-border/50 p-3 ${seasonOff ? 'opacity-70' : ''}`}>
            <div className="flex flex-wrap items-center gap-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">{name(se)}</p>
                <p className="text-[11px] text-muted-foreground">{se.scope === 'counting' ? '' : `${se.scope === 'global' ? t('scopeGlobal') : t('scopeServer')} · `}{t('itemsCount', { shown, total: own.length })}</p>
              </div>
              <button type="button" className={btn} aria-pressed={!seasonOff} onClick={() => toggleSeason(se.id)}>
                {seasonOff ? <EyeOff className="h-3.5 w-3.5" aria-hidden="true" /> : <Eye className="h-3.5 w-3.5" aria-hidden="true" />}{seasonOff ? t('hidden') : t('shown')}
              </button>
            </div>
            {!seasonOff && GROUPS.map((g) => {
              const list = own.filter((i) => groupOf(i.type) === g);
              if (!list.length) return null;
              const ids = list.map((i) => i.item_id);
              const allHidden = ids.every((id) => hiddenItems.includes(id));
              return (
                <div key={g} className="mt-3">
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-muted-foreground">{t(g === 'badge' ? 'groupBadge' : g === 'medal' ? 'groupMedal' : 'groupReward')}</span>
                    <button type="button" className="text-xs underline underline-offset-2" onClick={() => setMany(ids, !allHidden)}>{allHidden ? t('showAll') : t('hideAll')}</button>
                  </div>
                  <ul className="grid gap-1.5 sm:grid-cols-2">
                    {list.map((it) => {
                      const off = hiddenItems.includes(it.item_id);
                      return (
                        <li key={it.item_id} className={`flex items-center gap-2 rounded-lg border border-border/50 px-2 py-1.5 ${off ? 'opacity-60' : ''}`}>
                          <span aria-hidden="true" className="w-5 text-center">{it.icon || ''}</span>
                          <span className="min-w-0 flex-1 truncate text-xs font-semibold">{name(it)}</span>
                          {g === 'badge' && !off ? (
                            <button type="button" className={btn} onClick={() => feature(it.item_id)} aria-pressed={featured === it.item_id} aria-label={featured === it.item_id ? t('featured') : t('feature')}>
                              <Star className={`h-3.5 w-3.5 ${featured === it.item_id ? 'fill-current' : ''}`} aria-hidden="true" />
                            </button>
                          ) : null}
                          <button type="button" className={btn} aria-pressed={!off} onClick={() => setMany([it.item_id], !off)} aria-label={off ? t('hidden') : t('shown')}>
                            {off ? <EyeOff className="h-3.5 w-3.5" aria-hidden="true" /> : <Eye className="h-3.5 w-3.5" aria-hidden="true" />}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>
        );
      })}
      {error ? <p role="alert" className="text-xs text-red-400">{t('saveError')}</p> : null}
    </div>
  );
}

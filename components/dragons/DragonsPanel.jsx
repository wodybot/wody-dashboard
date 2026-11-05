'use client';
// Dashboard > Dragons. A cinematic stage for the server's dragons, the stats that follow from level, rarity and size, and every setting
// a manager can change. Changes appear in the shared save bar; nothing is stored until it is saved.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Flame, Play, Plus, Trash2, Swords, ShieldCheck, Heart, Crown } from 'lucide-react';
import { SaveBar } from '@/components/dashboard-kit';
import DragonStage from './DragonStage';
import { playDragonSound } from './sound';
import { TYPES, SIZES, PERSONALITIES, RARITIES, ANIMATIONS, EFFECTS, SOUNDS, BEHAVIORS, MAX_DRAGONS, NAME_MAX, LEVEL_MAX, BREATH_SECONDS } from '@/lib/dragons/constants';
import { defaultDragon, dragonStats } from '@/lib/dragons/schema';

const clone = (v) => JSON.parse(JSON.stringify(v));
const STATE_OF = { appear: 'appear', fly: 'fly', fire_attack: 'fire_attack', roar: 'roar', land: 'land', rest: 'rest' };
const STATE_MS = { appear: 2200, fly: 6000, fire_attack: 3200, roar: 2600, land: 2400, rest: 6000 };
const SOUND_OF = { fire_attack: 'breath', roar: 'roar', fly: 'wings', appear: 'wings' };
const TABS = ['animations', 'behavior', 'effects', 'sounds', 'progress'];

async function api(path, options) {
  try {
    const res = await fetch(`/api/dragons/${path}`, { credentials: 'same-origin', headers: options?.body ? { 'Content-Type': 'application/json' } : undefined, ...options });
    const data = await res.json().catch(() => ({}));
    return res.ok ? { ok: true, data } : { ok: false, error: data.error || 'generic', field: data.field || null };
  } catch { return { ok: false, error: 'network' }; }
}

function Switch({ id, label, checked, onChange, disabled }) {
  return (
    <label htmlFor={id} className="flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-xl border border-border bg-card/50 px-3 py-2 text-sm">
      <span>{label}</span>
      <input id={id} type="checkbox" role="switch" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} className="h-5 w-5 accent-[#e08a4e]" />
    </label>
  );
}
function Field({ label, id, children }) {
  return <div className="flex items-center justify-between gap-3"><label htmlFor={id} className="text-sm text-muted-foreground">{label}</label><div className="flex items-center gap-2">{children}</div></div>;
}
const selectCls = 'min-h-9 rounded-lg border border-border bg-background px-2 text-sm';

export default function DragonsPanel({ guildId }) {
  const t = useTranslations('dragons');
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState([]);
  const [draft, setDraft] = useState([]);
  const [selected, setSelected] = useState('');
  const [tab, setTab] = useState('animations');
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState('idle');
  const [playKey, setPlayKey] = useState(0);
  const timer = useRef(null);

  const errText = useCallback((r) => (t.has(`errors.${r.error}`) ? t(`errors.${r.error}`) : t('errors.generic')) + (r.field ? ` (${r.field})` : ''), [t]);
  const load = useCallback(async () => {
    const r = await api(`guilds/${guildId}`);
    if (!r.ok) { setError(errText(r)); setLoaded(true); return; }
    const list = r.data.dragons || []; setSaved(clone(list)); setDraft(clone(list)); setSelected((s) => (list.some((d) => d.id === s) ? s : list[0]?.id || '')); setError(''); setLoaded(true);
  }, [guildId, errText]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => () => clearTimeout(timer.current), []);

  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(saved), [draft, saved]);
  const dragon = draft.find((d) => d.id === selected) || null;
  const edit = (fn) => setDraft((list) => list.map((d) => { if (d.id !== selected) return d; const n = clone(d); fn(n); return n; }));

  const play = useCallback((name) => {
    if (!dragon) return;
    setState(STATE_OF[name] || 'idle'); setPlayKey((k) => k + 1);
    if (dragon.sounds.enabled && dragon.sounds[SOUND_OF[name]]) playDragonSound(SOUND_OF[name], dragon.sounds.volume);
    clearTimeout(timer.current); timer.current = setTimeout(() => setState('idle'), STATE_MS[name] || 3000);
  }, [dragon]);
  // the dragon breathes fire now and then when that behavior is on
  useEffect(() => {
    if (!dragon || !dragon.enabled || !dragon.behavior.auto_breath || !dragon.animations.fire_attack) return undefined;
    const id = setInterval(() => { setState((s) => (s === 'idle' ? 'fire_attack' : s)); setPlayKey((k) => k + 1); clearTimeout(timer.current); timer.current = setTimeout(() => setState('idle'), 3200); }, dragon.behavior.breath_seconds * 1000);
    return () => clearInterval(id);
  }, [dragon]);

  const add = (type) => {
    let n = 1; while (draft.some((d) => d.id === `dragon_${n}`)) n += 1;
    const d = defaultDragon(type, `dragon_${n}`); setDraft((list) => [...list, d]); setSelected(d.id);
  };
  const remove = () => { const rest = draft.filter((d) => d.id !== selected); setDraft(rest); setSelected(rest[0]?.id || ''); };
  const save = async () => {
    setBusy(true); const r = await api(`guilds/${guildId}`, { method: 'PUT', body: JSON.stringify({ dragons: draft }) }); setBusy(false);
    if (!r.ok) { setError(errText(r)); return; }
    setSaved(clone(r.data.dragons)); setDraft(clone(r.data.dragons)); setError('');
  };

  if (!loaded) return <p className="text-sm text-muted-foreground" role="status">{t('loading')}</p>;
  const stats = dragon ? dragonStats(dragon) : null;
  const shownName = dragon ? dragon.name || t(`types.${dragon.type}`) : '';
  const fmt = (n) => new Intl.NumberFormat().format(n);

  return (
    <div className="grid min-w-0 gap-4">
      <nav aria-label={t('breadcrumb')} className="text-sm text-muted-foreground"><span>{t('title')}</span>{dragon ? <span> / <span className="text-foreground">{shownName}</span></span> : null}</nav>
      {error ? <p role="alert" className="rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm">{error}</p> : null}

      <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label={t('title')}>
        {draft.map((d) => (
          <button key={d.id} type="button" role="tab" aria-selected={d.id === selected} onClick={() => { setSelected(d.id); setState('idle'); }}
            className={`min-h-9 rounded-full border px-3 text-sm ${d.id === selected ? 'border-[#e6cd8c] bg-[#e6cd8c]/15 text-[#e6cd8c]' : 'border-border'}`}>{d.name || t(`types.${d.type}`)}</button>
        ))}
        {draft.length < MAX_DRAGONS ? (
          <label className="inline-flex min-h-9 items-center gap-1 rounded-full border border-dashed border-border px-3 text-sm">
            <Plus className="h-4 w-4" aria-hidden="true" /><span className="sr-only">{t('add')}</span>
            <select aria-label={t('add')} value="" onChange={(e) => e.target.value && add(e.target.value)} className="bg-transparent text-sm">
              <option value="">{t('add')}</option>{TYPES.map((x) => <option key={x} value={x}>{t(`types.${x}`)}</option>)}
            </select>
          </label>
        ) : null}
      </div>

      {!dragon ? (
        <div className="rounded-2xl border border-border bg-card/60 p-8 text-center"><Flame className="mx-auto h-8 w-8 text-[#e08a4e]" aria-hidden="true" /><p className="mt-3 font-semibold">{t('emptyTitle')}</p><p className="mt-1 text-sm text-muted-foreground">{t('emptyText')}</p></div>
      ) : (
        <>
          <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
            <section className="relative min-h-[420px] overflow-hidden rounded-2xl border border-border sm:min-h-[520px]" aria-label={t('stageLabel')}>
              <div className="absolute inset-0"><DragonStage dragon={dragon} state={dragon.enabled ? state : 'rest'} playKey={playKey} label={t('stageLabel')} /></div>
              <div className="relative z-10 flex max-w-[22rem] flex-col gap-3 p-5">
                <h2 className="font-serif text-3xl font-semibold text-[#f6e3b4] drop-shadow">{shownName}</h2>
                <div className="flex flex-wrap gap-2 text-sm">
                  <span className="inline-flex items-center gap-1 rounded-full border border-[#e6cd8c]/60 bg-black/40 px-3 py-1 text-[#e6cd8c]"><Crown className="h-3.5 w-3.5" aria-hidden="true" />{t(`rarities.${dragon.rarity}`)}</span>
                  <span className="rounded-full border border-white/20 bg-black/40 px-3 py-1">{t('levelN', { n: dragon.level })}</span>
                  {!dragon.enabled ? <span className="rounded-full border border-white/20 bg-black/40 px-3 py-1">{t('disabled')}</span> : null}
                </div>
                <p className="text-sm text-white/80 drop-shadow">{t(`personalityText.${dragon.personality}`, { type: t(`types.${dragon.type}`) })}</p>
                <dl className="grid grid-cols-3 gap-2 rounded-xl border border-white/10 bg-black/45 p-3 text-center backdrop-blur-sm">
                  {[['attack', Swords, stats.attack], ['defense', ShieldCheck, stats.defense], ['life', Heart, stats.life]].map(([k, Icon, v]) => (
                    <div key={k}><Icon className="mx-auto h-5 w-5 text-[#e6cd8c]" aria-hidden="true" /><dt className="mt-1 text-xs text-white/70">{t(`stats.${k}`)}</dt><dd className="text-lg font-semibold">{fmt(v)}</dd></div>
                  ))}
                </dl>
                <button type="button" onClick={() => play('fire_attack')} className="inline-flex min-h-11 w-fit items-center gap-2 rounded-xl border border-[#e6cd8c]/60 bg-black/50 px-4 text-sm font-medium text-[#f6e3b4] hover:bg-black/70"><Play className="h-4 w-4" aria-hidden="true" />{t('preview')}</button>
              </div>
            </section>

            <section className="rounded-2xl border border-border bg-card/70 p-4" aria-label={t('customize')}>
              <h3 className="font-serif text-lg font-semibold">{t('customize')}</h3>
              <div className="mt-3 grid gap-3">
                <Field label={t('name')} id="dg-name"><input id="dg-name" value={dragon.name} maxLength={NAME_MAX} placeholder={t(`types.${dragon.type}`)} onChange={(e) => edit((d) => { d.name = e.target.value; })} className={`${selectCls} w-44`} /></Field>
                <Field label={t('type')} id="dg-type"><select id="dg-type" value={dragon.type} onChange={(e) => edit((d) => { d.type = e.target.value; })} className={selectCls}>{TYPES.map((x) => <option key={x} value={x}>{t(`types.${x}`)}</option>)}</select></Field>
                <Field label={t('scaleColor')} id="dg-scale"><input id="dg-scale" type="color" value={dragon.scale_color} onChange={(e) => edit((d) => { d.scale_color = e.target.value; })} className="h-9 w-12 cursor-pointer rounded border border-border bg-transparent" /><code className="w-16 text-xs">{dragon.scale_color}</code></Field>
                <Field label={t('fireColor')} id="dg-fire"><input id="dg-fire" type="color" value={dragon.fire_color} onChange={(e) => edit((d) => { d.fire_color = e.target.value; })} className="h-9 w-12 cursor-pointer rounded border border-border bg-transparent" /><code className="w-16 text-xs">{dragon.fire_color}</code></Field>
                <Field label={t('size')} id="dg-size"><select id="dg-size" value={dragon.size} onChange={(e) => edit((d) => { d.size = e.target.value; })} className={selectCls}>{SIZES.map((x) => <option key={x} value={x}>{t(`sizes.${x}`)}</option>)}</select></Field>
                <Field label={t('personality')} id="dg-pers"><select id="dg-pers" value={dragon.personality} onChange={(e) => edit((d) => { d.personality = e.target.value; })} className={selectCls}>{PERSONALITIES.map((x) => <option key={x} value={x}>{t(`personalities.${x}`)}</option>)}</select></Field>
                <Field label={t('rarity')} id="dg-rar"><select id="dg-rar" value={dragon.rarity} onChange={(e) => edit((d) => { d.rarity = e.target.value; })} className={selectCls}>{RARITIES.map((x) => <option key={x} value={x}>{t(`rarities.${x}`)}</option>)}</select></Field>
                <Field label={t('level')} id="dg-lvl"><input id="dg-lvl" type="number" min={1} max={LEVEL_MAX} value={dragon.level} onChange={(e) => edit((d) => { d.level = Math.max(1, Math.min(LEVEL_MAX, Math.round(Number(e.target.value) || 1))); })} className={`${selectCls} w-20`} /></Field>
                <Switch id="dg-on" label={t('active')} checked={dragon.enabled} onChange={(v) => edit((d) => { d.enabled = v; })} />
                <button type="button" onClick={remove} className="inline-flex min-h-9 w-fit items-center gap-2 rounded-lg border border-red-500/40 px-3 text-sm text-red-300"><Trash2 className="h-4 w-4" aria-hidden="true" />{t('remove')}</button>
              </div>
            </section>
          </div>

          <section className="rounded-2xl border border-border bg-card/60 p-4">
            <div role="tablist" aria-label={t('settings')} className="flex flex-wrap gap-2">
              {TABS.map((k) => <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`min-h-10 rounded-xl border px-4 text-sm ${tab === k ? 'border-[#e6cd8c] bg-[#e6cd8c]/15 text-[#e6cd8c]' : 'border-border'}`}>{t(`tabs.${k}`)}</button>)}
            </div>
            <div className="mt-4" role="tabpanel">
              {tab === 'animations' ? (
                <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6 [&>li]:min-w-0">
                  {ANIMATIONS.map((a) => (
                    <li key={a} className="grid min-w-0 gap-2 rounded-xl border border-border bg-background/40 p-2">
                      <button type="button" onClick={() => play(a)} disabled={!dragon.animations[a]} className="relative aspect-[4/3] overflow-hidden rounded-lg border border-border disabled:opacity-40" aria-label={`${t('play')}: ${t(`animations.${a}`)}`}>
                        <DragonStage dragon={{ ...dragon, effects: { ...dragon.effects, light: false } }} state="idle" label="" />
                        <span className="absolute inset-0 grid place-items-center bg-black/30"><Play className="h-7 w-7 text-white" aria-hidden="true" /></span>
                      </button>
                      <Switch id={`dg-an-${a}`} label={t(`animations.${a}`)} checked={dragon.animations[a]} onChange={(v) => edit((d) => { d.animations[a] = v; })} />
                    </li>
                  ))}
                </ul>
              ) : null}
              {tab === 'behavior' ? (
                <div className="grid gap-3 md:grid-cols-2">
                  {BEHAVIORS.map((b) => <Switch key={b} id={`dg-bh-${b}`} label={t(`behaviors.${b}`)} checked={dragon.behavior[b]} onChange={(v) => edit((d) => { d.behavior[b] = v; })} />)}
                  <Field label={t('breathSeconds')} id="dg-breath"><input id="dg-breath" type="range" min={BREATH_SECONDS[0]} max={BREATH_SECONDS[1]} value={dragon.behavior.breath_seconds} onChange={(e) => edit((d) => { d.behavior.breath_seconds = Number(e.target.value); })} className="w-40 accent-[#e08a4e]" /><span className="w-10 text-xs">{dragon.behavior.breath_seconds}s</span></Field>
                </div>
              ) : null}
              {tab === 'effects' ? <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{EFFECTS.map((x) => <Switch key={x} id={`dg-fx-${x}`} label={t(`effects.${x}`)} checked={dragon.effects[x]} onChange={(v) => edit((d) => { d.effects[x] = v; })} />)}</div> : null}
              {tab === 'sounds' ? (
                <div className="grid gap-3 md:grid-cols-2">
                  <Switch id="dg-snd" label={t('sounds.enabled')} checked={dragon.sounds.enabled} onChange={(v) => edit((d) => { d.sounds.enabled = v; })} />
                  <Field label={t('sounds.volume')} id="dg-vol"><input id="dg-vol" type="range" min={0} max={100} value={dragon.sounds.volume} onChange={(e) => edit((d) => { d.sounds.volume = Number(e.target.value); })} className="w-40 accent-[#e08a4e]" /><span className="w-10 text-xs">{dragon.sounds.volume}%</span></Field>
                  {SOUNDS.map((s) => (
                    <div key={s} className="flex items-center gap-2"><div className="min-w-0 flex-1"><Switch id={`dg-sd-${s}`} label={t(`sounds.${s}`)} checked={dragon.sounds[s]} onChange={(v) => edit((d) => { d.sounds[s] = v; })} /></div>
                      <button type="button" onClick={() => playDragonSound(s, dragon.sounds.volume)} className="inline-flex min-h-11 items-center gap-1 rounded-xl border border-border px-3 text-sm"><Play className="h-4 w-4" aria-hidden="true" />{t('play')}</button></div>
                  ))}
                </div>
              ) : null}
              {tab === 'progress' ? (
                <div className="grid gap-3">
                  <p className="text-sm text-muted-foreground">{t('progressHint')}</p>
                  {[['attack', stats.attack], ['defense', stats.defense], ['life', stats.life]].map(([k, v]) => {
                    const max = dragonStats({ level: LEVEL_MAX, rarity: 'mythic', size: 'huge', personality: k === 'attack' ? 'aggressive' : k === 'defense' ? 'protective' : 'wise' })[k];
                    return <div key={k} className="grid gap-1"><div className="flex justify-between text-sm"><span>{t(`stats.${k}`)}</span><span>{fmt(v)}</span></div><div className="h-2 overflow-hidden rounded-full bg-border" role="presentation"><div className="h-full rounded-full bg-[#e08a4e]" style={{ width: `${Math.max(3, Math.round((v / max) * 100))}%` }} /></div></div>;
                  })}
                </div>
              ) : null}
            </div>
          </section>
        </>
      )}
      <SaveBar dirty={dirty} saving={busy} onSave={save} onDiscard={() => { setDraft(clone(saved)); setSelected((s) => (saved.some((d) => d.id === s) ? s : saved[0]?.id || '')); }} />
    </div>
  );
}

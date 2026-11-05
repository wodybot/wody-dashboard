'use client';
// One GIF in the studio: general settings, visual design, animation timeline, Discord preview, export and publishing, history.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ConfirmDialog, ModuleTabs, NativeSelect, formatDate } from '@/components/module-kit';
import WodyIcon from '@/components/wody-icon';
import { proxiedImageUrl } from '@/lib/utils';
import { gs, ic, useErrText, StatusBadge, fmtBytes, fmtMs } from './gs-kit';

const LOCALES = ['en', 'ro', 'fr', 'it', 'de', 'es', 'nl', 'pt', 'tr'];
const LOCALE_NAMES = { en: 'English', ro: 'Română', fr: 'Français', it: 'Italiano', de: 'Deutsch', es: 'Español', nl: 'Nederlands', pt: 'Português', tr: 'Türkçe' };
const PHASES = ['intro', 'reveal', 'features', 'latest', 'final'];
const PRESETS = ['standard', 'high_quality', 'discord', 'cinematic', 'custom'];
const PALETTES = ['wody', 'gold', 'night', 'aurora', 'custom'];
const clone = (v) => JSON.parse(JSON.stringify(v));

function Num({ value, onChange, min, max, label }) {
  return <Input type="number" aria-label={label} value={value} min={min} max={max} onChange={(e) => onChange(Number(e.target.value))} />;
}

function DiscordMock({ t, og, src }) {
  const btns = og?.buttons || [];
  return (
    <div className="rounded-xl bg-[#313338] p-4 text-[#dbdee1]" aria-label={t('discord.mockLabel')}>
      <div className="flex gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#1e1f22]"><WodyIcon name="wody" size={28} /></div>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2 text-sm"><b className="text-white">Wody</b><span className="rounded bg-[#5865f2] px-1.5 text-[10px] font-semibold text-white">APP</span></div>
          <div className="overflow-hidden rounded-lg border-l-4 border-l-[#e08a4e] bg-[#2b2d31] p-3">
            <div className="text-lg font-bold text-white">{og?.title || 'Wody'}</div>
            <div className="mt-1 text-sm"><b>{og?.subtitle}</b><br />{og?.tagline}</div>
            {src ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={src} alt={t('discord.imageAlt')} className="mt-3 max-h-64 w-full rounded-lg object-cover" />
            ) : <div className="mt-3 flex h-32 items-center justify-center rounded-lg bg-black/30 text-xs text-muted-foreground">{t('discord.noImage')}</div>}
            <div className="mt-3 flex flex-wrap gap-2">{btns.map((b) => <span key={b.label} className="rounded bg-[#4e5058] px-3 py-1.5 text-sm text-white">{b.label}</span>)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function GifEditor({ id, meta, og, initial, onClose, onChange }) {
  const t = useTranslations('gifStudio.ui');
  const locale = useLocale();
  const errText = useErrText();
  const [item, setItem] = useState(initial || null);
  const [cfg, setCfg] = useState(initial ? clone(initial.config) : null);
  const [name, setName] = useState(initial?.name || '');
  const [tab, setTab] = useState('general');
  const [busy, setBusy] = useState('');
  const [at, setAt] = useState(1500);
  const [frame, setFrame] = useState(null);
  const [frameErr, setFrameErr] = useState(null);
  const [schedule, setSchedule] = useState('');
  const [verify, setVerify] = useState(null);
  const [confirmPub, setConfirmPub] = useState(false);
  const [restoreV, setRestoreV] = useState(null);
  const poll = useRef(null);

  const adopt = useCallback((it, resetDraft = false) => {
    setItem(it); onChange?.(it);
    if (resetDraft) { setCfg(clone(it.config)); setName(it.name); }
  }, [onChange]);

  useEffect(() => { (async () => { const r = await gs(`items/${id}`); if (r.ok) adopt(r.data.item, true); else { toast.error(errText(r.data?.error)); onClose(); } })(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id]);

  // progress polling while a generation runs
  useEffect(() => {
    clearInterval(poll.current);
    if (item?.status === 'generating') {
      poll.current = setInterval(async () => {
        const r = await gs(`items/${id}`);
        if (r.ok) { setItem(r.data.item); onChange?.(r.data.item); if (r.data.item.status !== 'generating') { clearInterval(poll.current); if (r.data.item.status === 'failed') toast.error(errText(r.data.item.job?.error)); else toast.success(t('toast.generated')); } }
      }, 1500);
    }
    return () => clearInterval(poll.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.status, id]);

  const dirty = useMemo(() => item && cfg && (JSON.stringify(cfg) !== JSON.stringify(item.config) || name !== item.name), [cfg, name, item]);
  const total = useMemo(() => (cfg ? PHASES.reduce((a, p) => a + (cfg.timeline[p].on ? cfg.timeline[p].ms : 0), 0) : 0), [cfg]);

  // live frame of the draft (also unsaved changes) so the timeline and the Discord preview can be checked before generating
  useEffect(() => {
    if (!cfg) return undefined;
    const ctrl = new AbortController();
    const h = setTimeout(async () => {
      try {
        const res = await fetch('/api/gifstudio/frame', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ config: cfg, at }), signal: ctrl.signal });
        if (!res.ok) { const d = await res.json().catch(() => ({})); setFrameErr(d.error || 'generic'); return; }
        setFrameErr(null);
        const url = URL.createObjectURL(await res.blob());
        setFrame((old) => { if (old) URL.revokeObjectURL(old); return url; });
      } catch { /* aborted */ }
    }, 450);
    return () => { clearTimeout(h); ctrl.abort(); };
  }, [cfg, at]);

  if (!item || !cfg) return <div className="flex items-center gap-2 text-sm text-muted-foreground"><WodyIcon name="loading" size={18} className="animate-spin" />{t('loading')}</div>;

  const set = (path, value) => setCfg((c) => { const n = clone(c); let o = n; const ks = path.split('.'); ks.slice(0, -1).forEach((k) => { o = o[k]; }); o[ks.at(-1)] = value; return n; });
  const locked = item.status === 'generating';

  async function save() {
    setBusy('save');
    const r = await gs(`items/${id}`, { method: 'PATCH', body: { name, config: cfg } });
    setBusy('');
    if (!r.ok) { toast.error(`${errText(r.data?.error)}${r.data?.field ? ` (${r.data.field})` : ''}`); return false; }
    adopt(r.data.item, true); toast.success(t('toast.saved')); return true;
  }
  async function act(sub, body, okKey) {
    if (dirty && !(await save())) return;
    setBusy(sub);
    const r = await gs(`items/${id}/${sub}`, { method: 'POST', body: body || {} });
    setBusy('');
    if (!r.ok) { toast.error(errText(r.data?.error)); return; }
    if (r.data.item) adopt(r.data.item, sub === 'restore');
    if (okKey) toast.success(t(okKey));
  }
  async function doVerify() {
    setBusy('verify'); setVerify(null);
    const r = await gs(`items/${id}/verify`, { method: 'POST', body: {} });
    setBusy('');
    if (!r.ok) { toast.error(errText(r.data?.error)); return; }
    setVerify(r.data.result);
  }

  const TABS = [
    { key: 'general', label: t('tab.general'), icon: ic('settings') }, { key: 'design', label: t('tab.design'), icon: ic('design') },
    { key: 'timeline', label: t('tab.timeline'), icon: ic('timeline') }, { key: 'discord', label: t('tab.discord'), icon: ic('discord') },
    { key: 'export', label: t('tab.export'), icon: ic('export') }, { key: 'history', label: t('tab.history'), icon: ic('history') },
  ];
  const fileSrc = item.has_blob ? `/api/gifstudio/items/${id}/file?v=${item.version}` : null;
  const staticSrc = og?.media_url || '/api/og?variant=passport';
  const ready = item.readiness;
  const featCount = cfg.texts.features.length;
  const icons = meta?.icons || [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" size="sm" onClick={onClose}><WodyIcon name="back" size={15} className="mr-1.5" />{t('back')}</Button>
        <span className="flex items-center gap-2 font-semibold"><WodyIcon name="gif" size={20} />{item.name}</span>
        <StatusBadge status={item.status} />
        {item.version > 0 && <span className="text-xs text-muted-foreground">v{item.version}</span>}
        {dirty && <span className="text-xs text-amber-300">{t('unsaved')}</span>}
        <Button size="sm" className="ml-auto gradient-primary" disabled={!dirty || busy === 'save' || locked} onClick={save}>
          {busy === 'save' ? <WodyIcon name="loading" size={15} className="mr-1.5 animate-spin" /> : <WodyIcon name="save" size={15} className="mr-1.5" />}{t('save')}
        </Button>
      </div>

      <ModuleTabs tabs={TABS} active={tab} onChange={setTab} />

      {tab === 'general' && (
        <Card className="space-y-4 p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div><Label className="mb-1.5 block text-xs">{t('field.name')}</Label><Input value={name} maxLength={60} disabled={locked} onChange={(e) => setName(e.target.value)} /></div>
            <div><Label className="mb-1.5 block text-xs">{t('field.language')}</Label><NativeSelect label={t('field.language')} value={cfg.locale} disabled={locked} onChange={(v) => set('locale', v)} options={LOCALES.map((l) => ({ value: l, label: LOCALE_NAMES[l] }))} /></div>
            <div><Label className="mb-1.5 block text-xs">{t('field.preset')}</Label><NativeSelect label={t('field.preset')} value={cfg.preset} disabled={locked} onChange={(v) => set('preset', v)} options={PRESETS.map((p) => ({ value: p, label: t(`preset.${p}`) }))} /></div>
            <div className="text-xs text-muted-foreground self-end">{t(`presetHint.${cfg.preset}`)}</div>
          </div>
          {cfg.preset === 'custom' && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              {[['width', 320, 1200], ['height', 168, 630], ['fps', 4, 20], ['colors', 16, 256], ['maxMb', 1, 9]].map(([k, lo, hi]) => (
                <div key={k}><Label className="mb-1.5 block text-xs">{t(`custom.${k}`)}</Label><Num label={t(`custom.${k}`)} min={lo} max={hi} value={cfg.custom[k]} onChange={(v) => set(`custom.${k}`, v)} /></div>
              ))}
            </div>
          )}
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div><Label className="mb-1.5 block text-xs">{t('field.title')}</Label><Input maxLength={40} value={cfg.texts.title} disabled={locked} onChange={(e) => set('texts.title', e.target.value)} placeholder={t('field.defaultText')} /></div>
              <div><Label className="mb-1.5 block text-xs">{t('field.subtitle')}</Label><Input maxLength={80} value={cfg.texts.subtitle} disabled={locked} onChange={(e) => set('texts.subtitle', e.target.value)} placeholder={t('field.defaultText')} /></div>
              <div><Label className="mb-1.5 block text-xs">{t('field.cta')}</Label><Input maxLength={40} value={cfg.texts.cta} disabled={locked} onChange={(e) => set('texts.cta', e.target.value)} placeholder={t('field.defaultText')} /></div>
            </div>
            <p className="flex items-start gap-2 text-xs text-muted-foreground"><WodyIcon name="info" size={15} className="mt-0.5" />{t('field.textHint')}</p>
            <div>
              <div className="mb-1.5 flex items-center justify-between"><Label className="text-xs">{t('field.features')}</Label>
                {featCount < 4 && <Button size="sm" variant="outline" disabled={locked} onClick={() => set('texts.features', [...cfg.texts.features, { icon: 'sparkles', text: '' }])}><WodyIcon name="add" size={14} className="mr-1.5" />{t('field.addFeature')}</Button>}</div>
              {featCount === 0 && <p className="text-xs text-muted-foreground">{t('field.featuresDefault')}</p>}
              {cfg.texts.features.map((f, i) => (
                <div key={i} className="mb-2 flex items-center gap-2">
                  <WodyIcon name={f.icon} size={28} />
                  <div className="w-40 shrink-0"><NativeSelect label={t('field.icon')} value={f.icon} disabled={locked} onChange={(v) => set(`texts.features.${i}.icon`, v)} options={icons.map((k) => ({ value: k, label: k }))} /></div>
                  <Input maxLength={70} value={f.text} disabled={locked} onChange={(e) => set(`texts.features.${i}.text`, e.target.value)} />
                  <Button size="sm" variant="outline" aria-label={t('act.delete')} disabled={locked} onClick={() => set('texts.features', cfg.texts.features.filter((_, j) => j !== i))}><WodyIcon name="delete" size={15} /></Button>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      {tab === 'design' && (
        <Card className="space-y-4 p-5">
          <div><Label className="mb-2 block text-xs">{t('design.palette')}</Label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5" role="radiogroup" aria-label={t('design.palette')}>
              {PALETTES.map((p) => {
                const c = p === 'custom' ? cfg.colors : meta?.palettes?.[p];
                return (
                  <button key={p} type="button" role="radio" aria-checked={cfg.palette === p} disabled={locked} onClick={() => set('palette', p)}
                    className={`rounded-xl border p-3 text-left text-sm ${cfg.palette === p ? 'border-[#e08a4e] bg-[#e08a4e]/10' : 'border-border/50 hover:bg-secondary/20'}`}>
                    <div className="mb-2 h-8 rounded-lg" style={{ background: c ? `linear-gradient(135deg, ${c.bg1}, ${c.bg2})` : undefined, boxShadow: c ? `inset 0 -4px 0 ${c.accent}` : undefined }} />
                    {t(`palette.${p}`)}
                  </button>
                );
              })}
            </div>
          </div>
          {cfg.palette === 'custom' && (
            <div className="grid gap-3 sm:grid-cols-3">
              {['bg1', 'bg2', 'accent'].map((k) => (
                <div key={k}><Label className="mb-1.5 block text-xs">{t(`design.${k}`)}</Label>
                  <div className="flex items-center gap-2"><input type="color" aria-label={t(`design.${k}`)} value={cfg.colors[k]} disabled={locked} onChange={(e) => set(`colors.${k}`, e.target.value)} className="h-10 w-12 cursor-pointer rounded border border-border bg-transparent" /><Input value={cfg.colors[k]} maxLength={7} onChange={(e) => set(`colors.${k}`, e.target.value)} /></div></div>
              ))}
              <p className="text-xs text-muted-foreground sm:col-span-3">{t('design.contrast')}</p>
            </div>
          )}
          <p className="flex items-start gap-2 text-xs text-muted-foreground"><WodyIcon name="info" size={15} className="mt-0.5" />{t('design.emojiRule')}</p>
          {frame && <div className="overflow-hidden rounded-xl border border-border/50">{/* eslint-disable-next-line @next/next/no-img-element */}<img src={proxiedImageUrl(frame)} alt={t('timeline.frameAlt')} className="w-full" /></div>}
        </Card>
      )}

      {tab === 'timeline' && (
        <Card className="space-y-4 p-5">
          <div className="flex h-8 overflow-hidden rounded-lg border border-border/50" aria-hidden="true">
            {PHASES.filter((p) => cfg.timeline[p].on).map((p, i) => (
              <button key={p} type="button" onClick={() => { let a = 0; for (const q of PHASES) { if (q === p) break; if (cfg.timeline[q].on) a += cfg.timeline[q].ms; } setAt(a + cfg.timeline[p].ms / 2); }}
                className="flex items-center justify-center truncate text-[11px] font-medium text-white" style={{ width: `${(cfg.timeline[p].ms / total) * 100}%`, background: ['#7c3a14', '#a0642e', '#c4803f', '#a0642e', '#7c3a14'][i % 5] }}>{t(`phase.${p}`)}</button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground"><span>{t('timeline.total')}: <b>{fmtMs(total)}</b></span>{(total < 3000 || total > 20000) && <span className="flex items-center gap-1 text-red-300"><WodyIcon name="warning" size={14} />{t('timeline.range')}</span>}</div>
          <div className="space-y-2">
            {PHASES.filter((p) => (cfg.kind === 'latest' ? p !== 'reveal' && p !== 'features' : p !== 'latest')).map((p) => (
              <div key={p} className="grid items-center gap-3 rounded-xl border border-border/50 bg-secondary/10 p-3 sm:grid-cols-[10rem_1fr_6rem]">
                <div className="flex items-center gap-2 text-sm font-medium"><Switch checked={cfg.timeline[p].on} disabled={locked} onCheckedChange={(v) => set(`timeline.${p}.on`, v)} aria-label={t(`phase.${p}`)} />{t(`phase.${p}`)}</div>
                <input type="range" aria-label={t(`phase.${p}`)} min={600} max={5000} step={100} disabled={locked || !cfg.timeline[p].on} value={cfg.timeline[p].ms} onChange={(e) => set(`timeline.${p}.ms`, Number(e.target.value))} className="w-full accent-[#e08a4e]" />
                <span className="text-right text-xs tabular-nums text-muted-foreground">{fmtMs(cfg.timeline[p].ms)}</span>
              </div>
            ))}
          </div>
          <div><Label className="mb-1.5 block text-xs">{t('timeline.scrub')}: {fmtMs(at)}</Label><input type="range" aria-label={t('timeline.scrub')} min={0} max={Math.max(1, total - 1)} step={100} value={Math.min(at, total - 1)} onChange={(e) => setAt(Number(e.target.value))} className="w-full accent-[#e08a4e]" /></div>
          <div className="overflow-hidden rounded-xl border border-border/50 bg-black/30">
            {frame ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={proxiedImageUrl(frame)} alt={t('timeline.frameAlt')} className="w-full" /> : <div className="flex h-40 items-center justify-center"><WodyIcon name="loading" size={24} className="animate-spin" /></div>}
          </div>
          {frameErr && <p className="flex items-center gap-1.5 text-xs text-red-300"><WodyIcon name="error" size={14} />{errText(frameErr)}</p>}
        </Card>
      )}

      {tab === 'discord' && (
        <Card className="space-y-4 p-5">
          <DiscordMock t={t} og={og} src={fileSrc || frame} />
          <p className="flex items-start gap-2 text-xs text-muted-foreground"><WodyIcon name="info" size={15} className="mt-0.5" />{t('discord.note')}</p>
          <div>
            <div className="mb-2 text-sm font-medium">{t('discord.checks')}</div>
            {!ready ? <p className="text-xs text-muted-foreground">{t('discord.generateFirst')}</p> : (
              <ul className="grid gap-1.5 sm:grid-cols-2">
                {ready.checks.map((c) => <li key={c.id} className="flex items-center gap-2 text-xs"><WodyIcon name={c.ok ? 'success' : 'error'} size={16} />{t(`check.${c.id}`)}</li>)}
              </ul>
            )}
          </div>
          {item.published_version > 0 && (
            <div className="space-y-2">
              <Button size="sm" variant="outline" disabled={busy === 'verify'} onClick={doVerify}><WodyIcon name={busy === 'verify' ? 'loading' : 'search'} size={15} className={`mr-1.5 ${busy === 'verify' ? 'animate-spin' : ''}`} />{t('discord.verify')}</Button>
              {verify && (
                <div className={`rounded-lg border p-3 text-xs ${verify.ok ? 'border-green-500/30 bg-green-500/10' : 'border-red-500/30 bg-red-500/10'}`}>
                  <div className="flex items-center gap-2 font-medium"><WodyIcon name={verify.ok ? 'success' : 'error'} size={16} />{verify.ok ? t('discord.verifyOk') : t('discord.verifyFail')}</div>
                  <div className="mt-1 text-muted-foreground">HTTP {verify.status} · {verify.content_type || '-'} · {verify.bytes ? fmtBytes(verify.bytes) : '-'}</div>
                </div>
              )}
            </div>
          )}
        </Card>
      )}

      {tab === 'export' && (
        <Card className="space-y-5 p-5">
          <div className="grid gap-4 sm:grid-cols-[1fr_16rem]">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Button onClick={() => act('generate', {}, 'toast.generating')} disabled={locked || busy === 'generate'} className="gradient-primary"><WodyIcon name="regenerate" size={16} className="mr-2" />{item.has_blob ? t('act.regenerate') : t('act.generate')}</Button>
                {locked && <Button variant="outline" onClick={() => act('cancel', {}, 'toast.cancelled')}><WodyIcon name="cancel" size={16} className="mr-2" />{t('act.cancel')}</Button>}
              </div>
              {locked && item.job && (
                <div>
                  <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground"><span className="flex items-center gap-1.5"><WodyIcon name="generating" size={14} />{t(`step.${item.job.step || 'frames'}`)}</span><span>{Math.round(item.job.progress * 100)}%</span></div>
                  <div className="h-2 overflow-hidden rounded-full bg-secondary/40" role="progressbar" aria-valuenow={Math.round(item.job.progress * 100)} aria-valuemin={0} aria-valuemax={100}><div className="h-full bg-[#e08a4e] transition-all" style={{ width: `${Math.round(item.job.progress * 100)}%` }} /></div>
                </div>
              )}
              {item.status === 'failed' && <p className="flex items-center gap-2 text-sm text-red-300"><WodyIcon name="error" size={16} />{errText(item.job?.error)}</p>}
              {item.current && (
                <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-3">
                  <div><dt className="text-muted-foreground">{t('spec.resolution')}</dt><dd>{item.current.width}x{item.current.height}</dd></div>
                  <div><dt className="text-muted-foreground">{t('spec.duration')}</dt><dd>{fmtMs(item.current.duration_ms)}</dd></div>
                  <div><dt className="text-muted-foreground">{t('spec.size')}</dt><dd>{fmtBytes(item.current.bytes)}</dd></div>
                  <div><dt className="text-muted-foreground">{t('spec.frames')}</dt><dd>{item.current.frames} · {item.current.fps} fps</dd></div>
                  <div><dt className="text-muted-foreground">{t('spec.colors')}</dt><dd>{item.current.colors}</dd></div>
                  <div><dt className="text-muted-foreground">{t('spec.optimized')}</dt><dd>{item.current.optimized ? t('yes') : t('no')}</dd></div>
                </dl>
              )}
            </div>
            <div className="overflow-hidden rounded-xl border border-border/50 bg-black/30">
              {fileSrc ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={proxiedImageUrl(fileSrc)} alt={t('spec.previewAlt')} className="w-full" /> : <div className="flex h-32 flex-col items-center justify-center gap-2 text-xs text-muted-foreground"><WodyIcon name="gif" size={30} />{t('library.notGenerated')}</div>}
            </div>
          </div>

          <div className="rounded-xl border border-border/50 bg-secondary/10 p-4">
            <div className="mb-3 flex items-center gap-2 font-medium"><WodyIcon name="publish" size={18} />{t('publish.title')}</div>
            <div className="flex flex-wrap items-end gap-3">
              <Button disabled={!item.has_blob || locked || busy === 'publish' || item.status === 'archived' || item.version === item.published_version} onClick={() => setConfirmPub(true)} className="gradient-primary"><WodyIcon name="publish" size={16} className="mr-2" />{t('act.publish')}</Button>
              <div><Label className="mb-1.5 block text-xs">{t('publish.scheduleAt')}</Label><Input type="datetime-local" value={schedule} onChange={(e) => setSchedule(e.target.value)} /></div>
              <Button variant="outline" disabled={!schedule || !item.has_blob || locked} onClick={() => act('publish', { schedule_at: new Date(schedule).toISOString() }, 'toast.scheduled')}><WodyIcon name="scheduled" size={16} className="mr-2" />{t('act.schedule')}</Button>
              {(item.status === 'published' || item.status === 'scheduled') && <Button variant="outline" onClick={() => act('unpublish', {}, 'toast.unpublished')}><WodyIcon name="lock" size={16} className="mr-2" />{t('act.unpublish')}</Button>}
            </div>
            {item.schedule_at && <p className="mt-2 text-xs text-muted-foreground">{t('publish.scheduledFor', { date: formatDate(item.schedule_at, locale) })}</p>}
            {item.public_path && (
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs"><WodyIcon name="link" size={15} /><code className="break-all rounded bg-black/30 px-2 py-1">{`${typeof window !== 'undefined' ? window.location.origin : ''}${item.public_path}`}</code>
                <Button size="sm" variant="outline" onClick={() => { navigator.clipboard?.writeText(`${window.location.origin}${item.public_path}`); toast.success(t('toast.copied')); }}><WodyIcon name="copy" size={14} className="mr-1.5" />{t('act.copy')}</Button></div>
            )}
            <p className="mt-3 flex items-start gap-2 text-xs text-muted-foreground"><WodyIcon name="security" size={15} className="mt-0.5" />{t('publish.permanent')}</p>
          </div>
        </Card>
      )}

      {tab === 'history' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="p-5">
            <div className="mb-3 flex items-center gap-2 font-medium"><WodyIcon name="storage" size={18} />{t('history.versions')}</div>
            {item.versions.length === 0 ? <p className="text-xs text-muted-foreground">{t('history.noVersions')}</p> : (
              <ul className="space-y-2">{item.versions.map((v) => (
                <li key={v.v} className="flex flex-wrap items-center gap-2 rounded-lg border border-border/50 bg-secondary/10 p-2.5 text-xs">
                  <b>v{v.v}</b><span className="text-muted-foreground">{v.width}x{v.height} · {fmtMs(v.duration_ms)} · {fmtBytes(v.bytes)} · {formatDate(v.at, locale)}</span>
                  {v.v === item.published_version && <span className="rounded bg-green-500/15 px-1.5 text-green-300">{t('library.live')}</span>}
                  {v.v === item.version && <span className="rounded bg-sky-500/15 px-1.5 text-sky-300">{t('history.current')}</span>}
                  {v.v !== item.version && <Button size="sm" variant="outline" className="ml-auto" disabled={locked} onClick={() => setRestoreV(v.v)}><WodyIcon name="restore" size={14} className="mr-1.5" />{t('act.restore')}</Button>}
                </li>))}</ul>
            )}
          </Card>
          <Card className="p-5">
            <div className="mb-3 flex items-center gap-2 font-medium"><WodyIcon name="audit" size={18} />{t('history.log')}</div>
            <ul className="space-y-1.5">{item.history.map((h, i) => (
              <li key={i} className="flex flex-wrap gap-x-2 text-xs"><span className="text-muted-foreground">{formatDate(h.at, locale)}</span><b>{t.has(`action.${h.action}`) ? t(`action.${h.action}`) : h.action}</b><span className="text-muted-foreground">{h.by}{h.detail ? ` · ${h.detail}` : ''}</span></li>))}</ul>
          </Card>
        </div>
      )}

      <ConfirmDialog open={confirmPub} onOpenChange={setConfirmPub} destructive={false} icon={<WodyIcon name="publish" size={22} />} title={t('publish.confirmTitle')} description={t('publish.confirmText')} confirmLabel={t('act.publish')} busy={busy === 'publish'}
        onConfirm={async () => { await act('publish', {}, 'toast.published'); setConfirmPub(false); }} />
      <ConfirmDialog open={restoreV !== null} onOpenChange={(o) => { if (!o) setRestoreV(null); }} destructive={false} icon={<WodyIcon name="restore" size={22} />} title={t('history.restoreTitle')} description={t('history.restoreText', { v: restoreV ?? 0 })} confirmLabel={t('act.restore')}
        onConfirm={async () => { await act('restore', { version: restoreV }, 'toast.restored'); setRestoreV(null); }} />
    </div>
  );
}

'use client';
// Owner editor for one global theme draft. Sections: identity, palette, environment, effects, components, access and performance, localization.
import { useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Card, Row, Color, Range, Select, Toggle, clone } from './fields';
import Preview from './Preview';
import { buildRenderTheme } from '@/lib/themes/render';
import { paletteIssue } from '@/lib/themes/schema';
import {
  LOCALES, CATEGORIES, SCENES, EFFECTS, TRANSITIONS, CARD_STYLES, BUTTON_STYLES,
  HEADER_STYLES, NAV_STYLES, BORDER_STYLES, SHADOW_STYLES, HEADING_FONTS, BODY_FONTS, PERF, PERF_PROFILES, LIMITS,
} from '@/lib/themes/constants';

export const SECTIONS = ['identity', 'palette', 'environment', 'effects', 'components', 'access', 'localization'];
const COLORS = ['primary', 'secondary', 'accent', 'bg', 'surface', 'card', 'border', 'text', 'muted', 'button', 'hover', 'active', 'glow'];

function AssetSelect({ id, label, value, kinds, assets, onChange, t }) {
  const list = assets.filter((a) => kinds.includes(a.kind));
  return (
    <Row label={label} id={id}>
      <select id={id} value={value || ''} onChange={(e) => onChange(e.target.value || null)} className="min-h-9 max-w-[16rem] rounded-lg border border-border bg-background px-2 text-sm">
        <option value="">{t('editor.noAsset')}</option>
        {list.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.width}x{a.height})</option>)}
      </select>
    </Row>
  );
}
function Num({ id, label, value, min, max, onChange, suffix = '' }) {
  return <Range id={id} label={label} value={value} min={min} max={max} suffix={suffix} onChange={onChange} />;
}

export default function ThemeEditor({ theme, cfg, setCfg, assets, section, setSection, readOnly, noteId, only = null }) {
  const t = useTranslations('themes');
  const locale = useLocale();
  const [openLoc, setOpenLoc] = useState('en');
  const edit = (fn) => { if (readOnly) return; setCfg((c) => { const n = clone(c); fn(n); return n; }); };
  const assetMap = useMemo(() => Object.fromEntries(assets.map((a) => [a.id, { url: a.url, w: a.width, h: a.height }])), [assets]);
  const rendered = useMemo(() => {
    try { return buildRenderTheme({ id: theme.id, version: theme.version, config: cfg, assets: assetMap }, null, { premium: true, locale, label: cfg.i18n?.[locale] || null }); } catch { return null; }
  }, [theme.id, theme.version, cfg, assetMap, locale]);
  const issue = useMemo(() => { try { return paletteIssue(cfg.palette); } catch { return null; } }, [cfg.palette]);
  const set = (path, v) => edit((c) => { const keys = path.split('.'); let o = c; for (const k of keys.slice(0, -1)) o = o[k]; o[keys[keys.length - 1]] = v; });
  const effOn = (id) => cfg.effects.find((e) => e.id === id);

  return (
    <div className={`grid gap-4 ${readOnly ? 'opacity-90' : ''}`} data-theme-editor aria-describedby={noteId}>
      {only ? null : <div role="tablist" aria-label={t('editor.sections')} className="flex flex-wrap gap-1.5">
        {SECTIONS.map((s) => <button key={s} role="tab" aria-selected={section === s} type="button" onClick={() => setSection(s)} className={`min-h-9 rounded-lg border px-3 text-sm ${section === s ? 'border-primary bg-primary/15' : 'border-border'}`}>{t(`editor.tab.${s}`)}</button>)}
      </div>}

      <fieldset disabled={readOnly} className="grid gap-4 border-0 p-0">
        {section === 'identity' ? (
          <Card title={t('editor.tab.identity')}>
            <Row label={t('editor.name')} id="th-name"><input id="th-name" maxLength={LIMITS.name} value={cfg.meta.name} onChange={(e) => set('meta.name', e.target.value)} className="min-h-9 w-64 max-w-full rounded-lg border border-border bg-background px-2 text-sm" /></Row>
            <Row label={t('editor.description')} id="th-desc"><textarea id="th-desc" maxLength={LIMITS.description} value={cfg.meta.description} onChange={(e) => set('meta.description', e.target.value)} className="min-h-20 w-72 max-w-full rounded-lg border border-border bg-background p-2 text-sm" /></Row>
            <Select id="th-cat" t={t} group="categories" label={t('editor.category')} value={cfg.meta.category} options={CATEGORIES} onChange={(v) => set('meta.category', v)} />
            <AssetSelect id="th-cover" t={t} label={t('editor.cover')} value={cfg.meta.cover} kinds={['cover']} assets={assets} onChange={(v) => set('meta.cover', v)} />
          </Card>
        ) : null}

        {section === 'palette' ? (
          <>
            <Card title={t('editor.tab.palette')} hint={t('editor.paletteHint')}>
              {COLORS.map((k) => <Color key={k} id={`pal-${k}`} t={t} label={t(`colors.${k}`)} value={cfg.palette[k]} fallback={cfg.palette[k]} onChange={(v) => set(`palette.${k}`, v)} onClear={() => {}} />)}
              <Color id="pal-gf" t={t} label={t('premium.gradientFrom')} value={cfg.palette.gradient.from} fallback={cfg.palette.gradient.from} onChange={(v) => set('palette.gradient.from', v)} onClear={() => {}} />
              <Color id="pal-gt" t={t} label={t('premium.gradientTo')} value={cfg.palette.gradient.to} fallback={cfg.palette.gradient.to} onChange={(v) => set('palette.gradient.to', v)} onClear={() => {}} />
              <Num id="pal-ga" label={t('premium.gradientAngle')} value={cfg.palette.gradient.angle} min={0} max={360} suffix="°" onChange={(v) => set('palette.gradient.angle', v)} />
              {issue ? <p role="alert" className="text-sm text-amber-400">{t('editor.contrastWarn', { a: t(`colors.${issue.field}`), b: t(`colors.${issue.against}`) })}</p> : <p className="text-sm text-emerald-400">{t('editor.contrastOk')}</p>}
            </Card>
            <Card title={t('editor.presets')} hint={t('editor.presetsHint', { max: LIMITS.presets })}>
              {(cfg.presets || []).map((p, i) => (
                <div key={p.id} className="flex flex-wrap items-center gap-2">
                  <code className="text-sm">{p.id}</code>
                  <input aria-label={t('colors.primary')} type="color" value={p.primary || cfg.palette.primary} onChange={(e) => edit((c) => { const v = e.target.value; c.presets[i] = { ...c.presets[i], primary: v, button: v, glow: v, border: v }; })} className="h-9 w-12 rounded border border-border bg-transparent" />
                  <button type="button" onClick={() => edit((c) => { c.presets.splice(i, 1); })} className="min-h-9 rounded-lg border border-border px-3 text-sm">{t('editor.remove')}</button>
                </div>
              ))}
              {(cfg.presets || []).length < LIMITS.presets ? <PresetAdd t={t} onAdd={(id) => edit((c) => { c.presets = [...(c.presets || []), { id, primary: c.palette.primary, button: c.palette.primary, glow: c.palette.primary, border: c.palette.primary }]; })} /> : null}
            </Card>
          </>
        ) : null}

        {section === 'environment' ? (
          <Card title={t('editor.tab.environment')}>
            <Select id="env-scene" t={t} group="scenes" label={t('premium.scene')} value={cfg.environment.scene} options={SCENES} onChange={(v) => set('environment.scene', v)} />
            <Num id="env-fog" label={t('editor.fog')} value={cfg.environment.fog} min={0} max={100} suffix="%" onChange={(v) => set('environment.fog', v)} />
            <Color id="env-lc" t={t} label={t('premium.ambientColor')} value={cfg.environment.lighting.color} fallback={cfg.environment.lighting.color} onChange={(v) => set('environment.lighting.color', v)} onClear={() => {}} />
            <Num id="env-li" label={t('premium.ambientIntensity')} value={cfg.environment.lighting.intensity} min={0} max={100} suffix="%" onChange={(v) => set('environment.lighting.intensity', v)} />
            <Toggle id="env-par" label={t('editor.parallax')} value={cfg.environment.parallax} onChange={(v) => set('environment.parallax', v)} />
            <AssetSelect id="env-bg" t={t} label={t('editor.backgroundAsset')} value={cfg.environment.background_asset} kinds={['background', 'environment']} assets={assets} onChange={(v) => set('environment.background_asset', v)} />
          </Card>
        ) : null}

        {section === 'effects' ? (
          <Card title={t('editor.tab.effects')} hint={t('editor.effectsHint', { max: LIMITS.effects })}>
            {EFFECTS.map((id) => {
              const on = effOn(id);
              return (
                <div key={id} className="flex flex-wrap items-center justify-between gap-2">
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(on)} disabled={!on && cfg.effects.length >= LIMITS.effects} onChange={(e) => edit((c) => { c.effects = e.target.checked ? [...c.effects, { id, intensity: 50 }] : c.effects.filter((x) => x.id !== id); })} className="h-5 w-5" />{t(`effects.${id}`)}</label>
                  {on ? <Num id={`fx-${id}`} label={t('editor.intensity')} value={on.intensity} min={0} max={100} suffix="%" onChange={(v) => edit((c) => { c.effects.find((x) => x.id === id).intensity = v; })} /> : null}
                </div>
              );
            })}
            {effOn('lightning') ? <p className="text-sm text-muted-foreground">{t('editor.lightningNote')}</p> : null}
          </Card>
        ) : null}

        {section === 'components' ? (
          <>
            <Card title={t('editor.tab.components')}>
              <Select id="co-card" t={t} group="cardStyles" label={t('server.cardStyle')} value={cfg.components.card_style} options={CARD_STYLES} onChange={(v) => set('components.card_style', v)} />
              <Select id="co-btn" t={t} group="buttonStyles" label={t('server.buttonStyle')} value={cfg.components.button_style} options={BUTTON_STYLES} onChange={(v) => set('components.button_style', v)} />
              <Select id="co-head" t={t} group="headerStyles" label={t('server.headerStyle')} value={cfg.components.header_style} options={HEADER_STYLES} onChange={(v) => set('components.header_style', v)} />
              <Select id="co-nav" t={t} group="navStyles" label={t('premium.nav')} value={cfg.components.nav_style} options={NAV_STYLES} onChange={(v) => set('components.nav_style', v)} />
              <Select id="co-bor" t={t} group="borderStyles" label={t('premium.border')} value={cfg.components.border_style} options={BORDER_STYLES} onChange={(v) => set('components.border_style', v)} />
              <Select id="co-sha" t={t} group="shadowStyles" label={t('premium.shadow')} value={cfg.components.shadow_style} options={SHADOW_STYLES} onChange={(v) => set('components.shadow_style', v)} />
              <Num id="co-gl" label={t('premium.glass')} value={cfg.components.glass} min={0} max={100} suffix="%" onChange={(v) => set('components.glass', v)} />
              <Num id="co-bl" label={t('premium.blur')} value={cfg.components.blur} min={0} max={24} suffix="px" onChange={(v) => set('components.blur', v)} />
              <Num id="co-rd" label={t('editor.radius')} value={cfg.components.radius} min={0} max={32} suffix="px" onChange={(v) => set('components.radius', v)} />
            </Card>
            <Card title={t('editor.typography')}>
              <Select id="ty-h" t={t} group="fonts" label={t('editor.headingFont')} value={cfg.typography.heading} options={HEADING_FONTS} onChange={(v) => set('typography.heading', v)} />
              <Select id="ty-b" t={t} group="fonts" label={t('editor.bodyFont')} value={cfg.typography.body} options={BODY_FONTS} onChange={(v) => set('typography.body', v)} />
              <Select id="tr-t" t={t} group="transitions" label={t('editor.themeTransition')} value={cfg.transitions.type} options={TRANSITIONS} onChange={(v) => set('transitions.type', v)} />
              <Num id="tr-d" label={t('editor.transitionDuration')} value={cfg.transitions.duration_ms} min={150} max={1500} suffix="ms" onChange={(v) => set('transitions.duration_ms', v)} />
            </Card>
          </>
        ) : null}

        {section === 'access' ? (
          <>
            <Card title={t('editor.accessibility')} hint={t('editor.accessibilityHint')}>
              {issue ? <p role="alert" className="text-sm text-amber-400">{t('editor.contrastWarn', { a: t(`colors.${issue.field}`), b: t(`colors.${issue.against}`) })}</p> : <p className="text-sm text-emerald-400">{t('editor.contrastOk')}</p>}
              <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                {['reducedMotion', 'disableEffects', 'photosensitive'].map((k) => <li key={k}>{t(`editor.a11y.${k}`)}</li>)}
              </ul>
            </Card>
            <Card title={t('editor.performance')} hint={t('editor.performanceHint')}>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead><tr><th className="py-1 pr-3">{t('controls.quality')}</th><th className="pr-3">{t('editor.particles')}</th><th className="pr-3">FPS</th><th>{t('editor.lightning')}</th></tr></thead>
                  <tbody>{PERF_PROFILES.map((p) => <tr key={p} className="border-t border-border"><td className="py-1 pr-3">{t(`controls.${p}`)}</td><td className="pr-3">{Math.round(PERF[p].particles * 100)}%</td><td className="pr-3">{PERF[p].fps}</td><td>{PERF[p].lightning ? t('editor.yes') : t('editor.no')}</td></tr>)}</tbody>
                </table>
              </div>
            </Card>
          </>
        ) : null}

        {section === 'localization' ? (
          <Card title={t('editor.tab.localization')} hint={t('editor.localizationHint')}>
            <div className="flex flex-wrap gap-1.5" role="tablist" aria-label={t('editor.languages')}>
              {LOCALES.map((l) => <button key={l} role="tab" aria-selected={openLoc === l} type="button" onClick={() => setOpenLoc(l)} className={`min-h-9 rounded-lg border px-3 text-sm uppercase ${openLoc === l ? 'border-primary bg-primary/15' : 'border-border'}`}>{l}</button>)}
            </div>
            <Row label={t('editor.name')} id="i18n-name"><input id="i18n-name" maxLength={LIMITS.name} value={cfg.i18n?.[openLoc]?.name || ''} onChange={(e) => edit((c) => { c.i18n = { ...c.i18n, [openLoc]: { ...(c.i18n?.[openLoc] || {}), name: e.target.value } }; })} className="min-h-9 w-64 max-w-full rounded-lg border border-border bg-background px-2 text-sm" /></Row>
            <Row label={t('editor.description')} id="i18n-desc"><textarea id="i18n-desc" maxLength={LIMITS.description} value={cfg.i18n?.[openLoc]?.description || ''} onChange={(e) => edit((c) => { c.i18n = { ...c.i18n, [openLoc]: { ...(c.i18n?.[openLoc] || {}), description: e.target.value } }; })} className="min-h-20 w-72 max-w-full rounded-lg border border-border bg-background p-2 text-sm" /></Row>
          </Card>
        ) : null}
      </fieldset>

      <Card title={t('preview.heading')} hint={t('preview.draftHint')}>
        <Preview theme={rendered} t={t} name={cfg.i18n?.[locale]?.name || cfg.meta.name} />
      </Card>
    </div>
  );
}

function PresetAdd({ t, onAdd }) {
  const [id, setId] = useState('');
  const ok = /^[a-z][a-z0-9_]{2,39}$/.test(id);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input aria-label={t('editor.presetId')} placeholder="preset_id" value={id} onChange={(e) => setId(e.target.value.toLowerCase())} className="min-h-9 w-40 rounded-lg border border-border bg-background px-2 text-sm" />
      <button type="button" disabled={!ok} onClick={() => { onAdd(id); setId(''); }} className="min-h-9 rounded-lg border border-border px-3 text-sm disabled:opacity-50">{t('editor.addPreset')}</button>
    </div>
  );
}

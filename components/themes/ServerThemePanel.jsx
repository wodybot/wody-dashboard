'use client';
// Dashboard panels for a server's theme. mode "basic": Dashboard > Website > Theme. mode "premium": Dashboard > Premium > Theme Studio.
// Only fixed choices and bounded numbers are offered; the API enforces the same rules again (no code, no free-form CSS, no HTML).
import { proxiedImageUrl } from '@/lib/utils';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import WodyIcon from '@/components/wody-icon';
import Preview from './Preview';
import WhereItShows from './WhereItShows';
import { SaveBar } from '@/components/dashboard-kit';
import { Card, Row, Color, Range, Select, Toggle, clone } from './fields';
import { themeApi, errorText } from './api';
import { buildRenderTheme } from '@/lib/themes/render';
import { SERVER_DEFAULT } from '@/lib/themes/schema';
import { CARD_STYLES, BUTTON_STYLES, HEADER_STYLES, NAV_STYLES, BORDER_STYLES, SHADOW_STYLES, SCENES, CHAR_POSITIONS, BG_MOVEMENT, LIMITS } from '@/lib/themes/constants';

// A saved draft from an older version may miss whole sections: every section is completed from the defaults before it is drawn.
const whole = (d) => {
  const base = clone(SERVER_DEFAULT); const src = d && typeof d === 'object' ? d : {};
  const prem = src.premium && typeof src.premium === 'object' ? src.premium : {};
  return {
    ...base, ...src,
    palette: { ...(src.palette || {}) }, components: { ...(src.components || {}) },
    effects: { ...base.effects, ...(src.effects || {}), items: { ...(src.effects?.items || {}) } },
    intro: { ...base.intro, ...(src.intro || {}) },
    premium: { ...base.premium, ...prem, character: { ...base.premium.character, ...(prem.character || {}) }, blocks: Array.isArray(prem.blocks) ? prem.blocks : [] },
  };
};

export default function ServerThemePanel({ guildId, mode = 'basic', premium: premiumProp = false, onGetPremium }) {
  const t = useTranslations('themes');
  const locale = useLocale();
  const isPremiumMode = mode === 'premium';
  const [state, setState] = useState({ loading: true });
  const [catalog, setCatalog] = useState([]);
  const [draft, setDraft] = useState(null);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState(null);
  const [dirty, setDirty] = useState(false);

  const load = useCallback(async () => {
    const [g, c] = await Promise.all([themeApi(`guild/${guildId}`), themeApi('catalog')]);
    if (!g.ok) { setState({ loading: false, error: errorText(t, g) }); return; }
    setCatalog(c.ok ? c.data.themes || [] : []);
    setState({ loading: false, ...g.data });
    setDraft(whole(g.data.server.draft));
    setDirty(false);
  }, [guildId, t]);
  useEffect(() => { load(); }, [load]);

  const premium = Boolean(state.premium ?? premiumProp);
  const nameOf = useCallback((c) => (c.official && t.has(`official.${c.id}.name`) ? t(`official.${c.id}.name`) : c.i18n?.[locale]?.name || c.name), [t, locale]);
  const descOf = useCallback((c) => (c.official && t.has(`official.${c.id}.description`) ? t(`official.${c.id}.description`) : c.i18n?.[locale]?.description || c.description), [t, locale]);
  const edit = (fn) => { setDraft((d) => { const n = clone(d); fn(n); return n; }); setDirty(true); setMsg(null); };

  const theme = state.theme;
  const rendered = useMemo(() => {
    if (!theme || !draft) return null;
    try { return buildRenderTheme({ id: theme.id, version: theme.version, config: theme.config, assets: theme.assets }, draft, { premium, locale, label: null }); } catch { return null; }
  }, [theme, draft, premium, locale]);

  async function run(kind, fn) {
    setBusy(kind); setMsg(null);
    const r = await fn();
    setBusy('');
    if (!r.ok) { setMsg({ bad: true, text: errorText(t, r) }); return false; }
    setState((s) => ({ ...s, ...r.data, loading: false })); setDraft(whole(r.data.server.draft)); setDirty(false);
    return true;
  }
  const BASIC_KEYS = ['theme_id', 'preset', 'palette', 'surface_opacity', 'components', 'effects', 'intro', 'dashboard'];
  // unfinished custom sections (no text, or no button label or link yet) are left out instead of failing the whole save
  const payload = () => {
    if (!isPremiumMode) return Object.fromEntries(BASIC_KEYS.map((k) => [k, draft[k]]));
    const blocks = (draft.premium.blocks || []).filter((b) => (b.type === 'text' ? String(b.text || '').trim() : String(b.label || '').trim() && String(b.url || '').trim()));
    return { ...draft, premium: { ...draft.premium, blocks } };
  };
  const save = async () => {
    const config = payload();
    if (await run('save', () => themeApi(`guild/${guildId}`, { method: 'PUT', body: { config } }))) setMsg({ text: t('server.saved') });
  };
  const publish = async () => {
    if (dirty && !(await run('save', () => themeApi(`guild/${guildId}`, { method: 'PUT', body: { config: payload() } })))) return;
    if (await run('publish', () => themeApi(`guild/${guildId}/publish`, { method: 'POST' }))) setMsg({ text: t('server.published') });
  };
  const uploadLogo = async (e) => {
    const file = e.target.files?.[0]; e.target.value = '';
    if (!file) return;
    const form = new FormData(); form.set('file', file);
    setBusy('logo'); setMsg(null);
    const r = await themeApi(`guild/${guildId}/logo`, { method: 'POST', form });
    setBusy('');
    if (!r.ok) { setMsg({ bad: true, text: errorText(t, r) }); return; }
    // only the logo is taken from the answer: whatever else is being edited stays as it is
    const logo = r.data.server?.draft?.premium?.logo || '';
    setDraft((d) => ({ ...d, premium: { ...d.premium, logo } }));
    setState((s) => ({ ...s, server: r.data.server }));
    setMsg({ text: t('premium.logoSaved') });
  };
  const reset = async () => { if (!window.confirm(t('server.resetConfirm'))) return; if (await run('reset', () => themeApi(`guild/${guildId}/reset`, { method: 'POST' }))) setMsg({ text: t('server.resetDone') }); };
  // Choosing a theme is one click: it is saved and goes live right away (a theme is meant to be seen on the server pages, not kept
  // as a draft). Everything else stays a draft until Publish or the save bar.
  const pick = async (id) => {
    if (dirty && !window.confirm(t('server.discardForTheme'))) return;
    setBusy('pick'); setMsg(null);
    let r = await themeApi(`guild/${guildId}`, { method: 'PUT', body: { config: { theme_id: id } } });
    if (r.ok) r = await themeApi(`guild/${guildId}/publish`, { method: 'POST' });
    setBusy('');
    if (!r.ok) { setMsg({ bad: true, text: errorText(t, r) }); return; }
    setState((st) => ({ ...st, ...r.data, loading: false })); setDraft(whole(r.data.server.draft)); setDirty(false); setMsg({ text: t('server.published') });
  };

  if (state.loading || !draft) return <p className="text-sm text-muted-foreground" role="status">{t('common.loading')}</p>;
  if (state.error) return <p className="text-sm text-red-400" role="alert">{state.error}</p>;

  const cfg = theme?.config;
  const pal = (k) => draft.palette?.[k] || '';
  const effPal = rendered?.palette || {};
  const setPal = (k, v) => edit((d) => { d.palette = { ...d.palette, [k]: v }; });
  const clrPal = (k) => edit((d) => { const p = { ...d.palette }; delete p[k]; d.palette = p; });
  const P = draft.premium;
  const setP = (patch) => edit((d) => { d.premium = { ...d.premium, ...patch }; });
  const locked = isPremiumMode && !premium;

  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4" data-theme-panel={mode}>
      <div className="flex flex-wrap items-center gap-2">
        {isPremiumMode ? <span className="inline-flex items-center gap-1.5 rounded-full border border-[#e6cd8c]/40 bg-[#e6cd8c]/10 px-3 py-1 text-xs text-[#e6cd8c]"><WodyIcon name="premium" size={14} />{t('server.premiumBadge')}</span> : null}
        <span className="text-sm text-muted-foreground">{state.server.published_at ? t('server.livePublished') : t('server.notPublished')}</span>
      </div>

      {locked ? (
        <div className="rounded-2xl border border-[#e6cd8c]/30 bg-[#e6cd8c]/[0.06] p-4">
          <p className="text-sm">{t('server.premiumOnly')}</p>
          {onGetPremium ? <button type="button" onClick={onGetPremium} className="mt-3 min-h-10 rounded-lg border border-[#e6cd8c]/50 px-4 text-sm text-[#e6cd8c]">{t('server.getPremium')}</button> : null}
        </div>
      ) : null}

      <WhereItShows guildId={guildId} published={Boolean(state.server.published_at)} dashboardOn={draft.dashboard === true} onToggleDashboard={(v) => edit((d) => { d.dashboard = v; })} />

      <Card title={t('server.chooseTheme')} hint={t('server.chooseHint')}>
        {catalog.length === 0 ? <p className="text-sm text-muted-foreground">{t('server.noThemes')}</p> : (
          <ul className="grid gap-2 sm:grid-cols-2" aria-label={t('server.chooseTheme')}>
            <li><button type="button" aria-pressed={!draft.theme_id} onClick={() => pick(null)} className={`h-full w-full rounded-xl border p-3 text-left ${!draft.theme_id ? 'border-primary bg-primary/10' : 'border-border'}`}><strong className="block text-sm">{t('server.standard')}</strong><span className="text-xs text-muted-foreground">{t('server.standardHint')}</span></button></li>
            {catalog.map((c) => (
              <li key={c.id}><button type="button" aria-pressed={draft.theme_id === c.id} onClick={() => pick(c.id)} className={`h-full w-full rounded-xl border p-3 text-left ${draft.theme_id === c.id ? 'border-primary bg-primary/10' : 'border-border'}`}>
                <span className="flex items-center gap-2"><span aria-hidden="true" className="inline-flex gap-0.5">{[c.palette.primary, c.palette.secondary, c.palette.accent].map((x, i) => <i key={i} style={{ background: x, width: 12, height: 12, borderRadius: 4, display: 'inline-block' }} />)}</span><strong className="text-sm">{nameOf(c)}</strong></span>
                <span className="mt-1 block text-xs text-muted-foreground">{descOf(c)}</span>
              </button></li>
            ))}
          </ul>
        )}
      </Card>

      {cfg && !locked ? (
        <>
          {!isPremiumMode ? (
            <>
              {cfg.presets?.length ? (
                <Card title={t('server.presets')}>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" aria-pressed={!draft.preset} onClick={() => edit((d) => { d.preset = ''; })} className={`min-h-9 rounded-lg border px-3 text-sm ${!draft.preset ? 'border-primary bg-primary/10' : 'border-border'}`}>{t('common.themeDefault')}</button>
                    {cfg.presets.map((p) => <button key={p.id} type="button" aria-pressed={draft.preset === p.id} onClick={() => edit((d) => { d.preset = p.id; d.palette = {}; })} className={`min-h-9 rounded-lg border px-3 text-sm ${draft.preset === p.id ? 'border-primary bg-primary/10' : 'border-border'}`}>{t.has(`presets.${p.id}`) ? t(`presets.${p.id}`) : p.id.replace(/_/g, ' ')}</button>)}
                  </div>
                </Card>
              ) : null}
              <Card title={t('server.colors')} hint={t('server.colorsHint')}>
                {['primary', 'secondary', 'accent'].map((k) => <Color key={k} id={`c-${k}`} t={t} label={t(`colors.${k}`)} value={pal(k)} fallback={effPal[k]} onChange={(v) => setPal(k, v)} onClear={() => clrPal(k)} />)}
                <Range id="opacity" label={t('server.surfaceOpacity')} value={draft.surface_opacity} min={60} max={100} onChange={(v) => edit((d) => { d.surface_opacity = v; })} />
              </Card>
              <Card title={t('server.styles')}>
                <Select id="card" t={t} group="cardStyles" label={t('server.cardStyle')} value={draft.components.card_style || cfg.components.card_style} options={CARD_STYLES} onChange={(v) => edit((d) => { d.components.card_style = v; })} />
                <Select id="header" t={t} group="headerStyles" label={t('server.headerStyle')} value={draft.components.header_style || cfg.components.header_style} options={HEADER_STYLES} onChange={(v) => edit((d) => { d.components.header_style = v; })} />
                <Select id="button" t={t} group="buttonStyles" label={t('server.buttonStyle')} value={draft.components.button_style || cfg.components.button_style} options={BUTTON_STYLES} onChange={(v) => edit((d) => { d.components.button_style = v; })} />
              </Card>
            </>
          ) : (
            <>
              <Card title={t('premium.colors')} hint={t('premium.colorsHint')}>
                {['primary', 'secondary', 'accent', 'bg', 'surface', 'card', 'text', 'muted'].map((k) => <Color key={k} id={`pc-${k}`} t={t} label={t(`colors.${k}`)} value={pal(k)} fallback={effPal[k === 'bg' ? 'bg' : k]} onChange={(v) => setPal(k, v)} onClear={() => clrPal(k)} />)}
                <Toggle id="grad" label={t('premium.gradient')} value={Boolean(P.gradient)} onChange={(on) => setP({ gradient: on ? { from: effPal.primary || '#ff6a3d', to: effPal.accent || '#ffd27a', angle: 165 } : null })} />
                {P.gradient ? (
                  <>
                    <Color id="g-from" t={t} label={t('premium.gradientFrom')} value={P.gradient.from} fallback={P.gradient.from} onChange={(v) => setP({ gradient: { ...P.gradient, from: v } })} onClear={() => {}} />
                    <Color id="g-to" t={t} label={t('premium.gradientTo')} value={P.gradient.to} fallback={P.gradient.to} onChange={(v) => setP({ gradient: { ...P.gradient, to: v } })} onClear={() => {}} />
                    <Range id="g-angle" label={t('premium.gradientAngle')} value={P.gradient.angle} min={0} max={360} suffix="°" onChange={(v) => setP({ gradient: { ...P.gradient, angle: v } })} />
                  </>
                ) : null}
                <Range id="opacity" label={t('server.surfaceOpacity')} value={draft.surface_opacity} min={60} max={100} onChange={(v) => edit((d) => { d.surface_opacity = v; })} />
              </Card>
              <Card title={t('premium.surfaces')}>
                <Select id="card" t={t} group="cardStyles" label={t('server.cardStyle')} value={draft.components.card_style || cfg.components.card_style} options={CARD_STYLES} onChange={(v) => edit((d) => { d.components.card_style = v; })} />
                <Select id="header" t={t} group="headerStyles" label={t('server.headerStyle')} value={draft.components.header_style || cfg.components.header_style} options={HEADER_STYLES} onChange={(v) => edit((d) => { d.components.header_style = v; })} />
                <Select id="button" t={t} group="buttonStyles" label={t('server.buttonStyle')} value={draft.components.button_style || cfg.components.button_style} options={BUTTON_STYLES} onChange={(v) => edit((d) => { d.components.button_style = v; })} />
                <Range id="glass" label={t('premium.glass')} value={P.glass ?? cfg.components.glass} min={0} max={100} onChange={(v) => setP({ glass: v })} />
                <Range id="blur" label={t('premium.blur')} value={P.blur ?? cfg.components.blur} min={0} max={24} suffix="px" onChange={(v) => setP({ blur: v })} />
                <Select id="border" t={t} group="borderStyles" label={t('premium.border')} value={P.border_style} options={['', ...BORDER_STYLES]} onChange={(v) => setP({ border_style: v })} />
                <Select id="shadow" t={t} group="shadowStyles" label={t('premium.shadow')} value={P.shadow_style} options={['', ...SHADOW_STYLES]} onChange={(v) => setP({ shadow_style: v })} />
                <Select id="nav" t={t} group="navStyles" label={t('premium.nav')} value={P.nav_style} options={['', ...NAV_STYLES]} onChange={(v) => setP({ nav_style: v })} />
                <Select id="density" t={t} group="density" label={t('premium.density')} value={P.density} options={['compact', 'cozy', 'spacious']} onChange={(v) => setP({ density: v })} />
              </Card>
              <Card title={t('premium.atmosphere')}>
                <Toggle id="light" label={t('premium.ambient')} value={Boolean(P.lighting)} onChange={(on) => setP({ lighting: on ? { color: effPal.glow || '#ff8a4a', intensity: 60 } : null })} />
                {P.lighting ? (
                  <>
                    <Color id="l-color" t={t} label={t('premium.ambientColor')} value={P.lighting.color} fallback={P.lighting.color} onChange={(v) => setP({ lighting: { ...P.lighting, color: v } })} onClear={() => {}} />
                    <Range id="l-int" label={t('premium.ambientIntensity')} value={P.lighting.intensity} min={0} max={100} onChange={(v) => setP({ lighting: { ...P.lighting, intensity: v } })} />
                  </>
                ) : null}
                <Select id="scene" t={t} group="scenes" label={t('premium.scene')} value={P.scene} options={['', ...SCENES]} onChange={(v) => setP({ scene: v })} />
                <Range id="anim" label={t('premium.animation')} value={P.animation} min={0} max={100} onChange={(v) => setP({ animation: v })} />
                <Select id="move" t={t} group="movement" label={t('premium.movement')} value={P.movement} options={BG_MOVEMENT} onChange={(v) => setP({ movement: v })} />
                <Range id="dens" label={t('premium.particles')} value={P.particle_density} min={0} max={100} onChange={(v) => setP({ particle_density: v })} />
              </Card>
              {cfg.character?.asset ? (
                <Card title={t('premium.character')} hint={t('premium.characterHint')}>
                  <Toggle id="ch-on" label={t('premium.characterShow')} value={P.character.enabled !== false} onChange={(v) => setP({ character: { ...P.character, enabled: v } })} />
                  <Select id="ch-pos" t={t} group="positions" label={t('premium.characterPosition')} value={P.character.position} options={['', ...CHAR_POSITIONS.filter((x) => x !== 'custom')]} onChange={(v) => setP({ character: { ...P.character, position: v } })} />
                  <Range id="ch-scale" label={t('premium.characterScale')} value={P.character.scale} min={80} max={120} onChange={(v) => setP({ character: { ...P.character, scale: v } })} />
                </Card>
              ) : null}
              <Card title={t('premium.logo')} hint={t('premium.logoHint')}>
                <div className="flex flex-wrap items-center gap-3">
                  {P.logo ? <img src={proxiedImageUrl(P.logo)} alt="" width={56} height={56} className="h-14 w-14 rounded-xl border border-border bg-black/30 object-contain" /> : <span className="text-sm text-muted-foreground">{t('premium.logoNone')}</span>}
                  <label className="inline-flex min-h-9 cursor-pointer items-center rounded-lg border border-border px-3 text-sm hover:bg-white/5">
                    {busy === 'logo' ? t('common.saving') : t('premium.logoUpload')}
                    <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" disabled={Boolean(busy)} onChange={uploadLogo} />
                  </label>
                  {P.logo ? <button type="button" className="min-h-9 rounded-lg border border-border px-3 text-sm hover:bg-white/5" onClick={() => setP({ logo: '' })}>{t('premium.logoRemove')}</button> : null}
                </div>
              </Card>
              <Card title={t('premium.banner')} hint={t('premium.bannerHint')}>
                <Row label={t('premium.bannerUrl')} id="banner"><input id="banner" type="url" inputMode="url" placeholder="https://" value={P.banner} onChange={(e) => setP({ banner: e.target.value })} className="min-h-9 w-64 max-w-full rounded-lg border border-border bg-background px-2 text-sm" /></Row>
              </Card>
              <Card title={t('premium.blocks')} hint={t('premium.blocksHint', { max: LIMITS.blocks })}>
                {P.blocks.map((b, i) => (
                  <div key={i} className="grid gap-2 rounded-xl border border-border p-3">
                    <Select id={`b-type-${i}`} t={t} group="blockTypes" label={t('premium.blockType')} value={b.type} options={['text', 'button']} onChange={(v) => setP({ blocks: P.blocks.map((x, j) => (j === i ? { type: v, title: x.title } : x)) })} />
                    <Row label={t('premium.blockTitle')} id={`b-t-${i}`}><input id={`b-t-${i}`} maxLength={60} value={b.title} onChange={(e) => setP({ blocks: P.blocks.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)) })} className="min-h-9 w-56 max-w-full rounded-lg border border-border bg-background px-2 text-sm" /></Row>
                    {b.type === 'text'
                      ? <textarea aria-label={t('premium.blockText')} maxLength={LIMITS.blockText} value={b.text || ''} onChange={(e) => setP({ blocks: P.blocks.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)) })} className="min-h-20 rounded-lg border border-border bg-background p-2 text-sm" />
                      : (
                        <>
                          <Row label={t('premium.blockLabel')} id={`b-l-${i}`}><input id={`b-l-${i}`} maxLength={40} value={b.label || ''} onChange={(e) => setP({ blocks: P.blocks.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} className="min-h-9 w-56 max-w-full rounded-lg border border-border bg-background px-2 text-sm" /></Row>
                          <Row label={t('premium.blockUrl')} id={`b-u-${i}`}><input id={`b-u-${i}`} type="url" placeholder="https://" value={b.url || ''} onChange={(e) => setP({ blocks: P.blocks.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)) })} className="min-h-9 w-56 max-w-full rounded-lg border border-border bg-background px-2 text-sm" /></Row>
                        </>
                      )}
                    <button type="button" onClick={() => setP({ blocks: P.blocks.filter((_, j) => j !== i) })} className="min-h-9 justify-self-start rounded-lg border border-border px-3 text-sm">{t('premium.blockRemove')}</button>
                  </div>
                ))}
                {P.blocks.length < LIMITS.blocks ? <button type="button" onClick={() => setP({ blocks: [...P.blocks, { type: 'text', title: '', text: '' }] })} className="min-h-9 justify-self-start rounded-lg border border-border px-3 text-sm">{t('premium.blockAdd')}</button> : null}
              </Card>
            </>
          )}

          <Card title={t('server.effects')} hint={t('server.effectsHint')}>
            <Toggle id="fx-on" label={t('server.effectsOn')} value={draft.effects.enabled !== false} onChange={(v) => edit((d) => { d.effects.enabled = v; })} />
            <Range id="fx-int" label={t('server.effectsIntensity')} value={draft.effects.intensity} min={0} max={100} onChange={(v) => edit((d) => { d.effects.intensity = v; })} />
            {cfg.effects.map((e) => <Range key={e.id} id={`fx-${e.id}`} label={t(`effects.${e.id}`)} value={draft.effects.items?.[e.id] ?? 100} min={0} max={100} onChange={(v) => edit((d) => { d.effects.items = { ...d.effects.items, [e.id]: v }; })} />)}
            <Toggle id="dash" label={t('server.dashboardOn')} value={draft.dashboard === true} onChange={(v) => edit((d) => { d.dashboard = v; })} />
            {cfg.intro?.enabled ? <Toggle id="intro" label={t('server.introOn')} value={draft.intro.enabled !== false} onChange={(v) => edit((d) => { d.intro = { enabled: v }; })} /> : null}
          </Card>

          <Card title={t('preview.heading')} hint={t('preview.hint')}>
            <Preview theme={rendered} t={t} name={nameOf({ id: theme.id, official: theme.id.startsWith('wody_'), i18n: cfg.i18n || {}, name: cfg.meta.name })} />
          </Card>
        </>
      ) : null}

      {msg ? <p role={msg.bad ? 'alert' : 'status'} className={`text-sm ${msg.bad ? 'text-red-400' : 'text-emerald-400'}`}>{msg.text}</p> : null}
      {!locked ? (
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={Boolean(busy)} onClick={publish} className="min-h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50">{busy === 'publish' ? t('common.saving') : t('server.publish')}</button>
          <button type="button" disabled={Boolean(busy)} onClick={reset} className="min-h-10 rounded-lg border border-red-400/40 px-4 text-sm text-red-300 disabled:opacity-50">{t('server.reset')}</button>
        </div>
      ) : null}
      {!locked ? <SaveBar dirty={dirty} saving={busy === 'save'} onSave={save} onDiscard={() => { setDraft(whole(state.server.draft)); setDirty(false); setMsg(null); }} /> : null}
    </div>
  );
}

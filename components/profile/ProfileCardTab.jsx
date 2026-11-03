'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ImagePlus, Loader2, RotateCcw, Save, Trash2, Undo2 } from 'lucide-react';
import { input, lab, btn, btnMain } from '@/components/collab/ProfileParts';
import ProfileCardPreview from '@/components/profile/ProfileCardPreview';
import PolicyConsent from '@/components/profile/PolicyConsent';
import { CARD_FONTS, cardFontStyle } from '@/lib/card-fonts';
import { discordCdnUrl } from '@/lib/utils';
import { SvgScene } from '@/components/scenes';
import { PROFILE_CARD, PROFILE_CARD_DEFAULT, applyPatch, normalizeConfig } from '@/lib/profile-card';

const SETTING_KEYS = {
  avatar: ['avatar_pos', 'avatar_size', 'avatar_shape'],
  text: ['name_align', 'stats_pos', 'font'],
  bar: ['bar_style'],
  effects: ['effect', 'decoration', 'anim', 'scene'],
};
const MIAMI_THEMES = ['coast', 'dusk', 'skyline', 'miami'];
const THEME_ORDER = PROFILE_CARD.choices.theme.filter((x) => x !== 'custom' && !MIAMI_THEMES.includes(x));

async function api(method, body, url = '/api/profile-card') {
  try {
    const isForm = typeof FormData !== 'undefined' && body instanceof FormData;
    const res = await fetch(url, { method, headers: body && !isForm ? { 'Content-Type': 'application/json' } : undefined, body: body ? (isForm ? body : JSON.stringify(body)) : undefined, cache: 'no-store' });
    return { ok: res.ok, status: res.status, data: await res.json().catch(() => ({})) };
  } catch {
    return { ok: false, status: 0, data: {} };
  }
}

function Section({ title, children }) {
  return (
    <section className="rounded-2xl border border-border/60 bg-card/40 p-4">
      <h3 className="mb-3 text-sm font-bold">{title}</h3>
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function Color({ id, label, value, onChange }) {
  return (
    <div>
      <label className={lab} htmlFor={id}>{label}</label>
      <div className="flex gap-2">
        <input id={id} type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-10 w-14 shrink-0 cursor-pointer rounded-lg border border-border/60 bg-transparent p-1" />
        <input aria-label={label} className={input} value={value} maxLength={7} onChange={(e) => { const v = e.target.value.startsWith('#') ? e.target.value : `#${e.target.value}`; if (/^#[0-9a-fA-F]{0,6}$/.test(v)) onChange(v.toLowerCase()); }} />
      </div>
    </div>
  );
}

function Range({ id, label, value, min, max, onChange, unit = '' }) {
  return (
    <div>
      <label className={`${lab} flex justify-between`} htmlFor={id}><span>{label}</span><span className="text-muted-foreground">{value}{unit}</span></label>
      <input id={id} type="range" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-[#e6cd8c]" />
    </div>
  );
}

export default function ProfileCardTab({ identity }) {
  const t = useTranslations('profileCard');
  const tnav = useTranslations('nav');
  const [saved, setSaved] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [consent, setConsent] = useState(false);
  const fileRef = useRef(null);
  const [draft, setDraft] = useState(null);
  const [state, setState] = useState('loading');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const draftRef = useRef(null);
  draftRef.current = draft;

  const load = useCallback(async (keepDraft = false) => {
    const r = await api('GET');
    if (!r.ok || !r.data?.config) { if (!keepDraft) setState('error'); return; }
    const config = normalizeConfig(r.data.config);
    setSaved({ config, rev: r.data.rev, customized: r.data.customized, image: r.data.image || null, public: r.data.public !== false });
    setDraft((d) => (keepDraft && d && JSON.stringify(d) !== JSON.stringify(normalizeConfig(r.data.config)) && dirtyRef.current ? d : config));
    setState('ready');
  }, []);
  const dirtyRef = useRef(false);

  useEffect(() => { load(); }, [load]);
  const dirty = useMemo(() => Boolean(saved && draft && JSON.stringify(saved.config) !== JSON.stringify(draft)), [saved, draft]);
  dirtyRef.current = dirty;

  useEffect(() => {
    const refresh = () => { if (!dirtyRef.current && document.visibilityState === 'visible') load(true); };
    const timer = setInterval(refresh, 20000);
    document.addEventListener('visibilitychange', refresh);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', refresh); };
  }, [load]);

  useEffect(() => {
    const warn = (e) => { if (dirtyRef.current) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, []);

  const set = (patch) => { setMsg(null); setDraft((d) => ({ ...d, ...patch, theme: 'custom' })); };
  const pickTheme = (id) => { setMsg(null); setDraft(applyPatch(draftRef.current, { theme: id }).config); };

  const save = async () => {
    if (!dirty || busy) return;
    const patch = {};
    for (const [k, v] of Object.entries(draft)) if (JSON.stringify(v) !== JSON.stringify(saved.config[k])) patch[k] = v;
    if (patch.theme === 'custom' && Object.keys(patch).length === 1) delete patch.theme;
    if (patch.bg_url) {
      if (!consent) { setMsg({ kind: 'err', text: t('consent.required') }); return; }
      patch.policy_accepted = true;
    }
    setBusy(true);
    const r = await api('PATCH', patch);
    setBusy(false);
    if (r.ok) {
      const config = normalizeConfig(r.data.config);
      setSaved({ config, rev: r.data.rev, customized: r.data.customized, image: r.data.image || null, public: r.data.public !== false });
      setDraft(config);
      setMsg({ kind: 'ok', text: t('saved') });
    } else if (r.data?.error === 'invalid_value') {
      setMsg({ kind: 'err', text: t('invalid', { field: t(`field.${r.data.field}`) }) });
    } else {
      setMsg({ kind: 'err', text: t('saveError') });
    }
  };

  const applyServer = (data) => {
    const config = normalizeConfig(data.config);
    setSaved({ config, rev: data.rev, customized: data.customized, image: data.image || null, public: data.public !== false });
    setDraft(config);
  };

  const upload = async (file) => {
    if (!file || uploading) return;
    setMsg(null);
    if (!consent) { setMsg({ kind: 'err', text: t('consent.required') }); if (fileRef.current) fileRef.current.value = ''; return; }
    if (dirtyRef.current && !window.confirm(t('unsaved'))) return;
    setUploading(true);
    const form = new FormData();
    form.append('file', file);
    form.append('policy_accepted', 'true');
    const r = await api('POST', form, '/api/profile-card/image');
    setUploading(false);
    if (fileRef.current) fileRef.current.value = '';
    if (r.ok) { applyServer(r.data); setMsg({ kind: 'ok', text: t('imageSaved') }); return; }
    const code = r.status === 429 ? 'rate_limited' : r.data?.error;
    if (code === 'account_blocked') { setMsg({ kind: 'err', text: t('consent.blocked') }); return; }
    setMsg({ kind: 'err', text: t(`imageErr.${['image_too_large', 'image_invalid', 'image_dimensions', 'rate_limited'].includes(code) ? code : 'generic'}`) });
  };

  const removeImage = async () => {
    if (busy || uploading) return;
    setBusy(true);
    const r = await api('DELETE', undefined, '/api/profile-card/image');
    setBusy(false);
    if (r.ok) { applyServer(r.data); setMsg({ kind: 'ok', text: t('saved') }); } else setMsg({ kind: 'err', text: t('saveError') });
  };

  const togglePublic = async (value) => {
    if (value && !consent) { setMsg({ kind: 'err', text: t('consent.required') }); return; }
    setSaved((x) => ({ ...x, public: value }));
    const r = await api('PATCH', value ? { public: true, policy_accepted: true } : { public: false });
    if (!r.ok) { setSaved((x) => ({ ...x, public: !value })); setMsg({ kind: 'err', text: r.data?.error === 'account_blocked' ? t('consent.blocked') : t('saveError') }); }
  };

  const reset = async () => {
    if (busy || !window.confirm(t('resetConfirm'))) return;
    setBusy(true);
    const r = await api('DELETE');
    setBusy(false);
    if (r.ok) {
      const config = normalizeConfig(r.data.config);
      setSaved({ config, rev: r.data.rev, customized: false, image: null, public: saved.public });
      setDraft(config);
      setMsg({ kind: 'ok', text: t('saved') });
    } else setMsg({ kind: 'err', text: t('saveError') });
  };

  if (state === 'loading') return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden="true" /></div>;
  if (state === 'error' || !draft) return <p role="alert" className="rounded-2xl border border-border/60 p-6 text-sm text-muted-foreground">{t('loadError')}</p>;

  const cfg = draft;
  const optLabel = (setting, value) => (setting === 'font' && CARD_FONTS.some((f) => f.id === value) ? CARD_FONTS.find((f) => f.id === value).label : t(`opt.${setting}.${value}`));
  const select = (key) => (
    <div key={key}>
      <label className={lab} htmlFor={`pc-${key}`}>{t(`setting.${key}`)}</label>
      <select id={`pc-${key}`} className={input} value={cfg[key]} style={key === 'font' ? cardFontStyle(cfg[key] === 'bold' ? undefined : cfg[key]) : undefined} onChange={(e) => set({ [key]: e.target.value })}>
        {PROFILE_CARD.choices[key].map((v) => <option key={v} value={v} style={key === 'font' ? cardFontStyle(v === 'bold' ? undefined : v) : undefined}>{optLabel(key, v)}</option>)}
      </select>
    </div>
  );
  const renderTheme = (id) => {
              const th = PROFILE_CARD.themes[id];
              const on = cfg.theme === id;
              const bg = th.bg_mode === 'solid' ? th.bg_color : `linear-gradient(${(th.gradient_angle + 90) % 360}deg, ${th.gradient_from}, ${th.gradient_to})`;
              return (
                <button key={id} type="button" role="radio" aria-checked={on} onClick={() => pickTheme(id)}
                  className={`rounded-xl border p-1.5 text-left text-xs font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#e6cd8c] ${on ? 'border-[#e6cd8c] bg-[#e6cd8c]/10' : 'border-border/60 hover:border-[#e6cd8c]/60'}`}>
                  <span className={`relative mb-1 block overflow-hidden rounded-lg border border-white/10 ${MIAMI_THEMES.includes(id) ? "h-14" : "h-8"}`} style={{ background: bg }}>{MIAMI_THEMES.includes(id) ? <SvgScene kind={id} /> : null}<span className="block h-full w-1/3 rounded-l-lg" style={{ background: `${th.accent}` , opacity: 0.8 }} /></span>
                  <span className="flex min-w-0 items-center gap-1 px-0.5"><span className="truncate">{t(`theme.${id}`)}</span>{th.anim && th.anim !== 'none' ? <span className="shrink-0 text-[10px] text-[#e6cd8c]" aria-hidden="true">●</span> : null}</span>
                </button>
              );
  };
  const avatarSrc = discordCdnUrl(identity?.avatar ? `https://cdn.discordapp.com/avatars/${identity.id}/${identity.avatar}.png?size=256` : 'https://cdn.discordapp.com/embed/avatars/0.png');
  const urlInvalid = (() => { try { applyPatch(PROFILE_CARD_DEFAULT, { bg_url: cfg.bg_url || null }); return false; } catch { return true; } })();

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      <div className="lg:sticky lg:top-16 lg:self-start">
        <h2 className="text-lg font-black">{t('title')}</h2>
        <p className="mb-3 mt-1 text-sm text-muted-foreground">{t('intro')}</p>
        <div className="rounded-2xl border border-border/60 bg-card/40 p-3">
          <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground"><span>{t('preview')}</span><span>934 × 282</span></div>
          <ProfileCardPreview cfg={cfg} name={identity?.name || t('sampleName')} avatarSrc={avatarSrc} levelText={t('levelText', { level: 12 })} rankText={t('rankText', { rank: 3 })} xpText="429 / 1.3K XP" />
          <p className="mt-2 text-xs text-muted-foreground">{t('previewNote')}</p>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button type="button" onClick={save} disabled={!dirty || busy || urlInvalid} className={`${btnMain} disabled:opacity-50`}>{busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Save className="h-4 w-4" aria-hidden="true" />}{busy ? t('saving') : t('save')}</button>
          <button type="button" onClick={() => { setDraft(saved.config); setMsg(null); }} disabled={!dirty || busy} className={`${btn} disabled:opacity-50`}><Undo2 className="h-3.5 w-3.5" aria-hidden="true" />{t('discard')}</button>
          <button type="button" onClick={reset} disabled={busy} className={btn}><RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />{t('resetDefault')}</button>
        </div>
        <p role="status" aria-live="polite" className={`mt-2 min-h-5 text-sm ${msg?.kind === 'err' ? 'text-red-300' : 'text-emerald-300'}`}>{msg ? msg.text : dirty ? <span className="text-amber-300">{t('unsaved')}</span> : ''}</p>
        <p className="mt-1 text-xs text-muted-foreground">{t('sync')} {t('discord')}</p>
        <p className="mt-1 text-xs text-muted-foreground">{t('privacy')}</p>
      </div>

      <div className="space-y-4">
        <section className="rounded-2xl border border-border/60 bg-card/40 p-4">
          <h3 className="mb-3 text-sm font-bold">{t('sectionTemplates')}</h3>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4" role="radiogroup" aria-label={t('themes')}>
            {THEME_ORDER.map(renderTheme)}
          </div>
        </section>

        <section className="rounded-2xl border border-fuchsia-400/40 bg-gradient-to-br from-fuchsia-500/10 via-transparent to-amber-300/10 p-4 shadow-[0_0_24px_-10px_rgba(255,94,138,.6)]">
          <h3 className="mb-1 flex items-center gap-2 text-sm font-bold">{t('sectionMiami')}<span className="rounded-full bg-gradient-to-r from-fuchsia-500 to-amber-400 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-black">{tnav('tags.new')}</span></h3>
          <p className="mb-3 text-xs text-muted-foreground">{t('miamiHint')}</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup" aria-label={t('sectionMiami')}>
            {MIAMI_THEMES.map(renderTheme)}
          </div>
        </section>

        <Section title={t('sectionAvatar')}>{SETTING_KEYS.avatar.map(select)}
          <div><label className={lab} htmlFor="pc-layout">{t('layout')}</label>
            <select id="pc-layout" className={input} value={cfg.layout} onChange={(e) => set({ layout: e.target.value })}>
              {PROFILE_CARD.choices.layout.map((v) => <option key={v} value={v}>{t(`layoutOpt.${v}`)}</option>)}
            </select></div>
        </Section>
        <Section title={t('sectionText')}>{SETTING_KEYS.text.map(select)}
          <Color id="pc-accent" label={t('field.accent')} value={cfg.accent} onChange={(v) => /^#[0-9a-f]{6}$/.test(v) && set({ accent: v })} />
          <Color id="pc-text" label={t('field.text_color')} value={cfg.text_color} onChange={(v) => /^#[0-9a-f]{6}$/.test(v) && set({ text_color: v })} />
        </Section>
        <Section title={t('sectionBar')}>{SETTING_KEYS.bar.map(select)}
          <Color id="pc-bar" label={t('field.bar_color')} value={cfg.bar_color} onChange={(v) => /^#[0-9a-f]{6}$/.test(v) && set({ bar_color: v })} />
          <Color id="pc-track" label={t('field.bar_track')} value={cfg.bar_track} onChange={(v) => /^#[0-9a-f]{6}$/.test(v) && set({ bar_track: v })} />
        </Section>
        <Section title={t('sectionBackground')}>{select('bg_mode')}
          {cfg.bg_mode === 'solid' && <Color id="pc-bg" label={t('field.bg_color')} value={cfg.bg_color} onChange={(v) => /^#[0-9a-f]{6}$/.test(v) && set({ bg_color: v })} />}
          {cfg.bg_mode === 'gradient' && (<>
            <Color id="pc-g1" label={t('field.gradient_from')} value={cfg.gradient_from} onChange={(v) => /^#[0-9a-f]{6}$/.test(v) && set({ gradient_from: v })} />
            <Color id="pc-g2" label={t('field.gradient_to')} value={cfg.gradient_to} onChange={(v) => /^#[0-9a-f]{6}$/.test(v) && set({ gradient_to: v })} />
            <Range id="pc-ang" label={t('field.gradient_angle')} value={cfg.gradient_angle} min={0} max={360} unit="°" onChange={(v) => set({ gradient_angle: v })} />
          </>)}
          {cfg.bg_mode === 'image' && (<>
            <div className="sm:col-span-2">
              <label className={lab} htmlFor="pc-url">{t('field.bg_url')}</label>
              <input id="pc-url" className={input} inputMode="url" value={cfg.bg_url || ''} maxLength={PROFILE_CARD.urlMax} placeholder="https://" aria-invalid={urlInvalid} onChange={(e) => set(e.target.value.trim() ? { bg_url: e.target.value.trim(), bg_image: null } : { bg_url: null })} />
              <p className={`mt-1 text-xs ${urlInvalid ? 'text-red-300' : 'text-muted-foreground'}`}>{urlInvalid ? t('invalid', { field: t('field.bg_url') }) : t('bgHint')}</p>
            </div>
            <div className="sm:col-span-2 flex flex-wrap items-center gap-2">
              <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="sr-only" id="pc-file" onChange={(e) => upload(e.target.files?.[0])} />
              <label htmlFor="pc-file" className={`${btn} cursor-pointer ${uploading ? 'pointer-events-none opacity-60' : ''}`}>
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <ImagePlus className="h-4 w-4" aria-hidden="true" />}{uploading ? t('uploading') : t('upload')}
              </label>
              {saved.image && <button type="button" onClick={removeImage} disabled={busy} className={btn}><Trash2 className="h-3.5 w-3.5" aria-hidden="true" />{t('removeImage')}</button>}
              <p className="w-full text-xs text-muted-foreground">{t('imageHint')}{saved.image ? ` ${t('imageCurrent', { w: saved.image.w, h: saved.image.h, size: (saved.image.size / 1048576).toFixed(1) })}` : ''}</p>
            </div>
            <Color id="pc-ov" label={t('field.overlay_color')} value={cfg.overlay_color} onChange={(v) => /^#[0-9a-f]{6}$/.test(v) && set({ overlay_color: v })} />
            <Range id="pc-op" label={t('field.bg_opacity')} value={cfg.bg_opacity} min={0} max={100} unit="%" onChange={(v) => set({ bg_opacity: v })} />
          </>)}
        </Section>
        <Section title={t('sectionFrame')}>
          <Range id="pc-bw" label={t('field.border_width')} value={cfg.border_width} min={0} max={8} onChange={(v) => set({ border_width: v })} />
          <Color id="pc-bc" label={t('field.border_color')} value={cfg.border_color} onChange={(v) => /^#[0-9a-f]{6}$/.test(v) && set({ border_color: v })} />
          <Range id="pc-rad" label={t('field.radius')} value={cfg.radius} min={0} max={60} onChange={(v) => set({ radius: v })} />
        </Section>
        <Section title={t('sectionEffects')}>{SETTING_KEYS.effects.map(select)}
          <p className="sm:col-span-2 text-xs text-muted-foreground">{t('animNote')}</p>
        </Section>
        <section className="space-y-3 rounded-2xl border border-border/60 bg-card/40 p-4">
          <PolicyConsent ns="profileCard" checked={consent} onChange={setConsent} />
          <label className="flex cursor-pointer items-start gap-3">
            <input type="checkbox" className="mt-1 h-4 w-4 accent-[#e6cd8c]" checked={saved.public} onChange={(e) => togglePublic(e.target.checked)} />
            <span><span className="block text-sm font-bold">{t('publicToggle')}</span><span className="block text-xs text-muted-foreground">{t('publicHint')}</span></span>
          </label>
        </section>
      </div>
    </div>
  );
}

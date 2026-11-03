'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Copy, ExternalLink, IdCard, Loader2, RotateCcw, Save, Undo2 } from 'lucide-react';
import { input, lab, btn, btnMain } from '@/components/collab/ProfileParts';
import PageBackdrop from '@/components/profile/PageBackdrop';
import HintLink from '@/components/hint-link';
import PolicyConsent from '@/components/profile/PolicyConsent';
import { SHORT_RESERVED, PAGE_CHOICES, PAGE_DEFAULT, PAGE_PRESETS, cleanMusicUrl, cleanPageImage, normalizePage, pageAccent, pageGradient } from '@/lib/profile-page';
import { discordCdnUrl } from '@/lib/utils';

const SPECIAL_PATTERNS = ['coast', 'skyline', 'miami'];

async function api(method, body, path = 'profile-page') {
  try {
    const res = await fetch(`/api/${path}`, { method, headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined, cache: 'no-store' });
    return { ok: res.ok, data: await res.json().catch(() => ({})) };
  } catch {
    return { ok: false, data: {} };
  }
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

function Panel({ title, children }) {
  return (
    <section className="rounded-2xl border border-border/60 bg-card/40 p-4">
      <h3 className="mb-3 text-sm font-bold">{title}</h3>
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function MiniPage({ page, identity, t }) {
  const accent = pageAccent(page) || '#e6cd8c';
  const rawSrc = (identity?.avatar ? `https://cdn.discordapp.com/avatars/${identity.id}/${identity.avatar}.png?size=128` : 'https://cdn.discordapp.com/embed/avatars/0.png');
  const card = (
    <div className="rounded-2xl border p-3" style={{ borderColor: `${accent}66`, background: 'rgba(20,14,10,0.7)' }}>
      <div className="mb-2 flex items-center gap-2 text-xs font-bold"><IdCard className="h-4 w-4" style={{ color: accent }} aria-hidden="true" />{t('levelCardTitle')}</div>
      <div className="h-14 rounded-xl" style={{ background: `linear-gradient(110deg, ${accent}55, rgba(0,0,0,0.5))` }} />
    </div>
  );
  return (
    <div className="relative isolate overflow-hidden rounded-2xl border border-border/60 bg-[#120b08]" style={{ minHeight: 320 }}>
      <PageBackdrop page={page} fixed={false} />
      <div className="relative flex flex-col gap-3 p-4">
        {page.card_place === 'top' && card}
        <div className="flex items-center gap-3 rounded-2xl border p-3" style={{ borderColor: `${accent}40`, background: 'rgba(20,14,10,0.7)' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={discordCdnUrl(rawSrc)} alt="" className="h-14 w-14 rounded-full border-2 object-cover" style={{ borderColor: accent }} />
          <div className="min-w-0"><div className="truncate text-lg font-black">{identity?.name || identity?.username}</div><div className="truncate text-xs text-muted-foreground">@{identity?.username}</div></div>
        </div>
        {page.card_place !== 'top' && card}
      </div>
    </div>
  );
}

export default function ProfilePageTab({ identity, onGoCard }) {
  const t = useTranslations('profilePage');
  const [saved, setSaved] = useState(null);
  const [draft, setDraft] = useState(null);
  const [state, setState] = useState('loading');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const dirtyRef = useRef(false);
  const [consent, setConsent] = useState(false);
  const [mod, setMod] = useState(null);
  const [appeal, setAppeal] = useState('');
  const [appealSent, setAppealSent] = useState(false);

  const load = useCallback(async () => {
    const r = await api('GET');
    if (!r.ok || !r.data?.page) { setState('error'); return; }
    const page = normalizePage(r.data.page);
    setSaved(page); setDraft(page); setMod(r.data.moderation || null); setState('ready');
  }, []);
  useEffect(() => { load(); }, [load]);
  const dirty = useMemo(() => Boolean(saved && draft && JSON.stringify(saved) !== JSON.stringify(draft)), [saved, draft]);
  dirtyRef.current = dirty;
  useEffect(() => {
    const warn = (e) => { if (dirtyRef.current) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, []);

  const uname = identity?.username || '';
  const shortOk = Boolean(uname) && !SHORT_RESERVED.has(uname.toLowerCase());
  const shortLink = `wody.online/${uname}`;
  const copyShort = async () => { try { await navigator.clipboard.writeText(`https://${shortLink}`); setMsg({ kind: 'ok', text: t('shortCopied') }); } catch { setMsg({ kind: 'err', text: t('shortTitle') }); } };
  const set = (patch) => { setMsg(null); setDraft((d) => ({ ...d, ...patch })); };
  const musicBad = (() => { try { cleanMusicUrl(draft?.music || null); return false; } catch { return true; } })();
  const imageBad = (() => { try { cleanPageImage(draft?.image || null); return false; } catch { return true; } })();

  const save = async () => {
    if (!dirty || busy || imageBad || musicBad || !consent) return;
    const patch = {};
    for (const [k, v] of Object.entries(draft)) if (JSON.stringify(v) !== JSON.stringify(saved[k])) patch[k] = v;
    patch.policy_accepted = true;
    setBusy(true);
    const r = await api('PATCH', patch);
    setBusy(false);
    if (r.ok) { const page = normalizePage(r.data.page); setSaved(page); setDraft(page); setConsent(false); setMsg({ kind: 'ok', text: t('saved') }); }
    else if (['policy_acceptance_required', 'account_blocked', 'uploads_restricted', 'customization_suspended'].includes(r.data?.error)) setMsg({ kind: 'err', text: t(`mod.err.${r.data.error}`) });
    else if (r.data?.error === 'invalid_value') setMsg({ kind: 'err', text: t('invalid', { field: t(`field.${r.data.field}`) }) });
    else setMsg({ kind: 'err', text: t('saveError') });
  };
  const reset = async () => {
    if (busy || !window.confirm(t('resetConfirm'))) return;
    setBusy(true);
    const r = await api('DELETE');
    setBusy(false);
    if (r.ok) { const page = normalizePage(r.data.page); setSaved(page); setDraft(page); setMsg({ kind: 'ok', text: t('saved') }); } else setMsg({ kind: 'err', text: t('saveError') });
  };

  if (state === 'loading') return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden="true" /></div>;
  if (state === 'error' || !draft) return <p role="alert" className="rounded-2xl border border-border/60 p-6 text-sm text-muted-foreground">{t('loadError')}</p>;
  const page = draft;
  const choice = (key, id) => (
    <div key={key}>
      <label className={lab} htmlFor={id}>{t(`field.${key}`)}</label>
      <select id={id} className={input} value={page[key]} onChange={(e) => set({ [key]: e.target.value })}>
        {PAGE_CHOICES[key].filter((v) => key !== 'pattern' || !SPECIAL_PATTERNS.includes(v)).map((v) => <option key={v} value={v}>{t(`opt.${key}.${v}`)}</option>)}
        {key === 'pattern' ? <optgroup label={t('specialGroup')}>{SPECIAL_PATTERNS.map((v) => <option key={v} value={v}>{t(`opt.pattern.${v}`)}</option>)}</optgroup> : null}
      </select>
    </div>
  );

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <div className="lg:sticky lg:top-16 lg:self-start">
        <h2 className="text-lg font-black">{t('title')}</h2>
        <p className="mb-3 mt-1 text-sm text-muted-foreground">{t('intro')}</p>
        <div className="mb-2 text-xs text-muted-foreground">{t('preview')}</div>
        <MiniPage page={page} identity={identity} t={t} />
        <p className="mt-2 text-xs text-muted-foreground">{t('previewNote')}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button type="button" onClick={save} disabled={!dirty || busy || imageBad || musicBad || !consent} className={`${btnMain} disabled:opacity-50`}>{busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Save className="h-4 w-4" aria-hidden="true" />}{busy ? t('saving') : t('save')}</button>
          <button type="button" onClick={() => { setDraft(saved); setMsg(null); }} disabled={!dirty || busy} className={`${btn} disabled:opacity-50`}><Undo2 className="h-3.5 w-3.5" aria-hidden="true" />{t('discard')}</button>
          <button type="button" onClick={reset} disabled={busy} className={btn}><RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />{t('reset')}</button>
        </div>
        <p role="status" aria-live="polite" className={`mt-2 min-h-5 text-sm ${msg?.kind === 'err' ? 'text-red-300' : 'text-emerald-300'}`}>{msg ? msg.text : dirty ? <span className="text-amber-300">{t('unsaved')}</span> : ''}</p>
        {shortOk ? (
          <div className="mt-3 rounded-xl border border-[#e6cd8c]/30 bg-[#e6cd8c]/5 p-3">
            <p className="text-xs font-semibold text-[#e6cd8c]">{t('shortTitle')}</p>
            <div className="mt-1.5 flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded bg-secondary/40 px-2 py-1 text-sm">{shortLink}</code>
              <button type="button" onClick={copyShort} className={btn}><Copy className="h-3.5 w-3.5" aria-hidden="true" />{t('shortCopy')}</button>
            </div>
            <p className="mt-1.5 text-[11px] text-muted-foreground">{t('shortHint')}</p>
          </div>
        ) : null}
        <div className="mt-2 flex flex-wrap gap-2">
          <HintLink href={shortOk ? `/${encodeURIComponent(uname)}` : `/profile/${encodeURIComponent(uname)}`} icon={ExternalLink}>{t('open')}</HintLink>
          <HintLink onClick={onGoCard} icon={IdCard}>{t('goCard')}</HintLink>
        </div>
      </div>

      <div className="space-y-4">
        <Panel title={t('sectionBackground')}>
          <div className="sm:col-span-2">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup" aria-label={t('field.mode')}>
              {PAGE_CHOICES.mode.map((m) => (
                <button key={m} type="button" role="radio" aria-checked={page.mode === m} onClick={() => set({ mode: m })}
                  className={`rounded-xl border px-3 py-2 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#e6cd8c] ${page.mode === m ? 'border-[#e6cd8c] bg-[#e6cd8c]/10 text-[#e6cd8c]' : 'border-border/60 hover:border-[#e6cd8c]/60'}`}>{t(`opt.mode.${m}`)}</button>
              ))}
            </div>
          </div>
          {page.mode === 'preset' && (
            <div className="sm:col-span-2 grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup" aria-label={t('presets')}>
              {Object.keys(PAGE_PRESETS).map((k) => (
                <button key={k} type="button" role="radio" aria-checked={page.preset === k} onClick={() => set({ preset: k })}
                  className={`rounded-xl border p-1.5 text-left text-xs font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#e6cd8c] ${page.preset === k ? 'border-[#e6cd8c] bg-[#e6cd8c]/10' : 'border-border/60 hover:border-[#e6cd8c]/60'}`}>
                  <span className="mb-1 block h-10 rounded-lg border border-white/10" style={{ background: pageGradient({ mode: 'preset', preset: k }) }} />
                  <span className="block truncate px-0.5">{t(`opt.preset.${k}`)}</span>
                </button>
              ))}
            </div>
          )}
          {page.mode === 'gradient' && (<>
            <Color id="pp-from" label={t('field.from')} value={page.from} onChange={(v) => /^#[0-9a-f]{6}$/.test(v) && set({ from: v })} />
            <Color id="pp-to" label={t('field.to')} value={page.to} onChange={(v) => /^#[0-9a-f]{6}$/.test(v) && set({ to: v })} />
            <Range id="pp-angle" label={t('field.angle')} value={page.angle} min={0} max={360} unit="°" onChange={(v) => set({ angle: v })} />
          </>)}
          {page.mode === 'image' && (<>
            <div className="sm:col-span-2">
              <label className={lab} htmlFor="pp-image">{t('field.image')}</label>
              <input id="pp-image" className={input} inputMode="url" value={page.image || ''} maxLength={500} placeholder="https://" aria-invalid={imageBad} onChange={(e) => set({ image: e.target.value.trim() || null })} />
              <p className={`mt-1 text-xs ${imageBad ? 'text-red-300' : 'text-muted-foreground'}`}>{imageBad ? t('invalid', { field: t('field.image') }) : t('imageHint')}</p>
            </div>
            <Range id="pp-dim" label={t('field.dim')} value={page.dim} min={0} max={90} unit="%" onChange={(v) => set({ dim: v })} />
            <Range id="pp-blur" label={t('field.blur')} value={page.blur} min={0} max={24} unit="px" onChange={(v) => set({ blur: v })} />
          </>)}
          {page.mode !== 'none' && choice('pattern', 'pp-pattern')}
        </Panel>
        {mod && (mod.notice || mod.suspended || mod.uploads_restricted || mod.account_blocked) ? (
          <section role="alert" className="rounded-2xl border border-amber-400/40 bg-amber-400/5 p-4 text-sm">
            <h3 className="font-bold text-amber-200">{t('mod.title')}</h3>
            <p className="mt-1 text-muted-foreground">{t(`mod.action.${mod.notice?.action || (mod.account_blocked ? 'block_account' : mod.suspended ? 'suspend_customization' : 'restrict_uploads')}`)}</p>
            {appealSent ? <p className="mt-2 text-emerald-300">{t('mod.appealSent')}</p> : (
              <div className="mt-3">
                <label className={lab} htmlFor="pp-appeal">{t('mod.appealLabel')}</label>
                <textarea id="pp-appeal" className={`${input} min-h-20`} value={appeal} maxLength={1500} onChange={(e) => setAppeal(e.target.value)} />
                <button type="button" disabled={appeal.trim().length < 10} className={`${btn} mt-2 disabled:opacity-50`} onClick={async () => { const r = await api('POST', { message: appeal }, 'content-appeal'); if (r.ok) setAppealSent(true); else setMsg({ kind: 'err', text: t('saveError') }); }}>{t('mod.appealSend')}</button>
              </div>
            )}
          </section>
        ) : null}
        <Panel title={t('sectionName')}>
          {choice('name_fx', 'pp-namefx')}
          <div className="sm:col-span-2">
            <label className={lab} htmlFor="pp-music">{t('field.music')}</label>
            <input id="pp-music" className={input} inputMode="url" value={page.music || ''} maxLength={500} placeholder="https://example.com/song.mp3" aria-invalid={musicBad} onChange={(e) => set({ music: e.target.value.trim() || null })} />
            <p className={`mt-1 text-xs ${musicBad ? 'text-red-300' : 'text-muted-foreground'}`}>{musicBad ? t('invalid', { field: t('field.music') }) : t('musicHint')}</p>
          </div>
          <div className="sm:col-span-2">
            <label className={lab} htmlFor="pp-music-title">{t('field.music_title')}</label>
            <input id="pp-music-title" className={input} value={page.music_title || ''} maxLength={60} onChange={(e) => set({ music_title: e.target.value })} />
          </div>
        </Panel>
        <PolicyConsent ns="profilePage" checked={consent} onChange={setConsent} />
        <Panel title={t('sectionStyle')}>
          {(page.mode === 'gradient' || page.mode === 'image') && <Color id="pp-accent" label={t('field.accent')} value={page.accent} onChange={(v) => /^#[0-9a-f]{6}$/.test(v) && set({ accent: v })} />}
          {choice('card_place', 'pp-place')}
          <p className="sm:col-span-2 text-xs text-muted-foreground">{page.mode === 'preset' ? t('accentPresetNote') : page.mode === 'none' ? t('accentNoneNote') : t('accentNote')}</p>
        </Panel>
      </div>
    </div>
  );
}

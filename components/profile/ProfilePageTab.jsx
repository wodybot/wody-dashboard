'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { buildLevelCard } from '@/lib/profile-level';
import { ArrowDown, ArrowUp, Copy, Eye, EyeOff, ExternalLink, IdCard, Loader2, Plus, Trash2 } from 'lucide-react';
import { input, lab, btn, btnMain } from '@/components/collab/ProfileParts';
import PageBackdrop from '@/components/profile/PageBackdrop';
import HintLink from '@/components/hint-link';
import BattlePassVisibility from '@/components/profile/BattlePassVisibility';
import SaveBar from '@/components/profile/SaveBar';
import ProfilePageView from '@/components/profile/ProfilePageView';
import ProfileCardPreview from '@/components/profile/ProfileCardPreview';
import { SvgScene } from '@/components/scenes';
import { SHORT_RESERVED, PAGE_CHOICES, PAGE_LIMITS, PAGE_PRESETS, PAGE_SECTIONS, publicPageView, cleanMusicUrl, cleanPageImage, normalizePage, pageAccent, pageGradient } from '@/lib/profile-page';
import { discordCdnUrl } from '@/lib/utils';
import { normalizeConfig } from '@/lib/profile-card';

const SPECIAL_PATTERNS = ['coast', 'dusk', 'skyline', 'miami'];

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

function LivePreview({ page, identity, socials, away, cardCfg, passport, pass, level, views, isPublic }) {
  const tcard = useTranslations('profileCard');
  const outer = useRef(null);
  const [zoom, setZoom] = useState(1);
  useEffect(() => {
    const el = outer.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(() => setZoom(window.innerWidth >= 1024 ? Math.min(1, el.clientWidth / 1200) : 1));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const rawSrc = identity?.avatar ? `https://cdn.discordapp.com/avatars/${identity.id}/${identity.avatar}.png?size=128` : 'https://cdn.discordapp.com/embed/avatars/0.png';
  const accent = pageAccent(page) || '#e6cd8c';
  const name = identity?.name || identity?.username || '';
  const card = cardCfg ? { cfg: cardCfg, tagline: '', level: buildLevelCard(level || { level: 12, xp: 429, needed: 1337, rank: 3 }, tcard, 'en') } : null;
  return (
    <div ref={outer} className="relative isolate overflow-hidden rounded-2xl border border-border/60 bg-[#120b08]">
      <PageBackdrop page={page} fixed={false} />
      <div style={{ width: zoom < 1 || (typeof window !== 'undefined' && window.innerWidth >= 1024) ? 1200 : 'auto', zoom }} className="flex flex-col gap-6 px-6 py-6">
        <ProfilePageView page={publicPageView(page)} name={name} username={identity?.username || ''} avatarSrc={discordCdnUrl(rawSrc)} memberSince={null} away={away} socials={socials} live={0} views={views} isPublic={isPublic} locale="en" card={card} passport={passport} pass={pass} />
      </div>
    </div>
  );
}

export default function ProfilePageTab({ isPublic = false, views = 0, identity, socials = {}, away = null, onGoCard }) {
  const t = useTranslations('profilePage');
  const [passport, setPassport] = useState(null);
  const [pass, setPass] = useState(null);
  const [level, setLevel] = useState(null);
  const [cardCfg, setCardCfg] = useState(null);
  useEffect(() => { api('GET', null, 'profile-card').then((r) => { if (r.ok && r.data?.config) setCardCfg(normalizeConfig(r.data.config)); }); }, []);
  const tb = useTranslations('battlepass.profile');
  const refreshPass = useCallback(() => { api('GET').then((r) => { if (r.ok) setPass(r.data.pass || null); }); }, []);
  const tnav = useTranslations('nav');
  const [saved, setSaved] = useState(null);
  const [draft, setDraft] = useState(null);
  const [state, setState] = useState('loading');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const dirtyRef = useRef(false);
  const [consent, setConsent] = useState(false);
  const [musicRights, setMusicRights] = useState(false);
  const [musicBusy, setMusicBusy] = useState(false);
  const [mod, setMod] = useState(null);
  const [appeal, setAppeal] = useState('');
  const [appealSent, setAppealSent] = useState(false);

  const load = useCallback(async () => {
    const r = await api('GET');
    if (!r.ok || !r.data?.page) { setState('error'); return; }
    const page = normalizePage(r.data.page);
    setSaved(page); setDraft(page); setMod(r.data.moderation || null); setPassport(r.data.passport || null); setPass(r.data.pass || null); setLevel(r.data.level || null); setState('ready');
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
  const uploadMusic = async (file) => {
    if (!file || !musicRights) return;
    setMusicBusy(true);
    try {
      const form = new FormData();
      form.append('file', file); form.append('policy_accepted', 'true'); form.append('rights_accepted', 'true');
      const res = await fetch('/api/profile-page/music', { method: 'POST', body: form });
      const j = await res.json().catch(() => ({}));
      if (res.ok && j.url) {
        setDraft((d) => ({ ...d, music: j.url, music_title: d.music_title || String(j.name || '').replace(/\.[^.]+$/, '').slice(0, 60) }));
        setMsg({ kind: 'ok', text: t('musicUploaded') });
      } else {
        const known = ['audio_too_large', 'audio_invalid', 'rate_limited', 'uploads_restricted', 'customization_suspended', 'account_blocked', 'rights_acceptance_required'];
        setMsg({ kind: 'err', text: t(`musicError.${known.includes(j.error) ? j.error : 'generic'}`) });
      }
    } catch { setMsg({ kind: 'err', text: t('musicError.generic') }); }
    setMusicBusy(false);
  };
  const musicStored = typeof draft?.music === 'string' && draft.music.startsWith('/api/profile-page/music/');
  const musicBad = (() => { try { cleanMusicUrl(draft?.music || null); return false; } catch { return true; } })();
  const imageBad = (() => { try { cleanPageImage(draft?.image || null); return false; } catch { return true; } })();

  const save = async () => {
    if (!dirty || busy || saveBlocked || !consent) return;
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
      {key === 'pattern' ? (
        <select id={id} className={input} value={page[key]} onChange={(e) => set({ [key]: e.target.value })}>
          {PAGE_CHOICES.pattern.filter((v) => !SPECIAL_PATTERNS.includes(v)).map((v) => <option key={v} value={v}>{t(`opt.pattern.${v}`)}</option>)}
          <optgroup label={`${t('specialGroup')} · ${tnav('tags.new')}`}>
            {SPECIAL_PATTERNS.map((v) => <option key={v} value={v}>{t(`opt.pattern.${v}`)}</option>)}
          </optgroup>
        </select>
      ) : (
        <select id={id} className={input} value={page[key]} onChange={(e) => set({ [key]: e.target.value })}>
          {PAGE_CHOICES[key].map((v) => <option key={v} value={v}>{t(`opt.${key}.${v}`)}</option>)}
        </select>
      )}
    </div>
  );
  const upd = (key, i, patch) => set({ [key]: page[key].map((x, j) => (j === i ? { ...x, ...patch } : x)) });
  const del = (key, i) => set({ [key]: page[key].filter((_, j) => j !== i) });
  const hidden = new Set(page.hide);
  const toggleHide = (k) => set({ hide: hidden.has(k) ? page.hide.filter((x) => x !== k) : [...page.hide, k] });
  const move = (k, d) => {
    const o = [...page.order]; const i = o.indexOf(k); const j = i + d;
    if (j < 0 || j >= o.length) return;
    [o[i], o[j]] = [o[j], o[i]]; set({ order: o });
  };
  const L = PAGE_LIMITS;
  const urlBad = (v) => { if (!v) return false; try { cleanPageImage(v); return false; } catch { return true; } };
  const listBad = page.links.some((l) => !l.url || urlBad(l.url)) || page.portfolio.some((p) => !p.title.trim() || urlBad(p.url) || urlBad(p.image));
  const saveBlocked = imageBad || musicBad || listBad;

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <div className="lg:sticky lg:top-16 lg:self-start">
        <h2 className="text-lg font-black">{t('title')}</h2>
        <p className="mb-3 mt-1 text-sm text-muted-foreground">{t('intro')}</p>
        <div className="mb-2 text-xs text-muted-foreground">{t('preview')}</div>
        <LivePreview page={page} identity={identity} socials={socials} away={away} cardCfg={cardCfg} passport={passport} pass={pass} level={level} views={views} isPublic={isPublic} />
        <p className="mt-2 text-xs text-muted-foreground">{t('previewNote')}</p>
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
        <section className="rounded-2xl border border-[#ff5e8a]/35 bg-gradient-to-br from-[#ff5e8a]/10 via-transparent to-[#7a5cff]/10 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 text-sm font-bold">{t('specialGroup')}<span className="rounded-full bg-gradient-to-r from-fuchsia-500 to-amber-400 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-black">{tnav('tags.new')}</span></h3>
            {SPECIAL_PATTERNS.includes(page.pattern) ? <button type="button" className={btn} onClick={() => set({ pattern: 'none' })}>{t('miamiOff')}</button> : null}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{t('miamiHint')}</p>
          <div role="radiogroup" aria-label={t('specialGroup')} className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {SPECIAL_PATTERNS.map((k) => {
              const on = page.pattern === k;
              return (
                <button key={k} type="button" role="radio" aria-checked={on} onClick={() => set({ pattern: k, mode: page.mode === 'none' ? 'gradient' : page.mode })}
                  className={`group overflow-hidden rounded-xl border text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ffd9b0] ${on ? 'border-[#ff5e8a] shadow-[0_0_30px_-8px_#ff5e8a]' : 'border-border/60 hover:border-[#ff5e8a]/60'}`}>
                  <span className="relative block h-20 overflow-hidden bg-[#1a0b3b]"><SvgScene kind={k} /></span>
                  <span className="flex items-center justify-between gap-2 px-2.5 py-2 text-xs font-semibold"><span className="truncate">{t(`opt.pattern.${k}`)}</span>{on ? <span className="h-2 w-2 shrink-0 rounded-full bg-[#ff5e8a]" aria-hidden="true" /> : null}</span>
                </button>
              );
            })}
          </div>
        </section>
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
          <div className="sm:col-span-2 rounded-xl border border-border/60 bg-background/30 p-3">
            <div className="mb-1 text-sm font-semibold">{t('musicUploadTitle')}</div>
            <label className="flex cursor-pointer items-start gap-2 text-xs leading-5 text-muted-foreground">
              <input type="checkbox" className="mt-1 h-4 w-4 shrink-0 accent-[#e6cd8c]" checked={musicRights} onChange={(e) => setMusicRights(e.target.checked)} />
              <span>{t('musicRights')}</span>
            </label>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <label className={`${btn} ${!musicRights || musicBusy ? 'pointer-events-none opacity-50' : 'cursor-pointer'}`}>
                {musicBusy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}{musicBusy ? t('musicUploading') : t('musicUpload')}
                <input type="file" accept="audio/mpeg,audio/ogg,audio/mp4,audio/x-m4a,audio/wav,audio/flac,.mp3,.ogg,.m4a,.wav,.flac" className="sr-only" disabled={!musicRights || musicBusy} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; uploadMusic(f); }} />
              </label>
              {musicStored ? <button type="button" className={btn} onClick={() => set({ music: null })}><Trash2 className="h-4 w-4" aria-hidden="true" />{t('musicRemove')}</button> : null}
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">{musicStored ? t('musicStoredNote') : t('musicLimits')}</p>
          </div>
          <div className="sm:col-span-2">
            <label className={lab} htmlFor="pp-music-title">{t('field.music_title')}</label>
            <input id="pp-music-title" className={input} value={page.music_title || ''} maxLength={60} onChange={(e) => set({ music_title: e.target.value })} />
          </div>
        </Panel>
        <section className="rounded-2xl border border-border/60 bg-card/40 p-4">
          <h3 className="mb-3 text-sm font-bold">{t('sectionContent')}</h3>
          <div className="space-y-4">
            <div>
              <label className={`${lab} flex justify-between`} htmlFor="pp-bio"><span>{t('field.bio')}</span><span className="text-muted-foreground">{[...page.bio].length}/{L.bio}</span></label>
              <textarea id="pp-bio" className={`${input} min-h-24`} value={page.bio} maxLength={L.bio} onChange={(e) => set({ bio: e.target.value })} />
            </div>
            <div>
              <label className={lab} htmlFor="pp-skills">{t('field.skills')}</label>
              <input id="pp-skills" className={input} value={page.skills.join(', ')} onChange={(e) => set({ skills: e.target.value.split(',').map((x) => x.trimStart().slice(0, L.skill)).slice(0, L.skills) })} onBlur={() => set({ skills: page.skills.map((x) => x.trim()).filter(Boolean) })} />
              <p className="mt-1 text-xs text-muted-foreground">{t('skillsHint', { max: L.skills })}</p>
            </div>
            <div>
              <div className={`${lab} flex justify-between`}><span>{t('field.links')}</span><span className="text-muted-foreground">{page.links.length}/{L.links}</span></div>
              <div className="space-y-2">
                {page.links.map((l, i) => (
                  <div key={i} className="flex flex-wrap gap-2 rounded-xl border border-border/50 p-2">
                    <input aria-label={t('linkLabel')} placeholder={t('linkLabel')} className={`${input} min-w-0 flex-1 basis-32`} value={l.label} maxLength={L.label} onChange={(e) => upd('links', i, { label: e.target.value })} />
                    <input aria-label={t('linkUrl')} placeholder="https://" inputMode="url" aria-invalid={!l.url || urlBad(l.url)} className={`${input} min-w-0 flex-[2] basis-48`} value={l.url} maxLength={500} onChange={(e) => upd('links', i, { url: e.target.value.trim() })} />
                    <button type="button" className={btn} onClick={() => del('links', i)} aria-label={t('remove')}><Trash2 className="h-3.5 w-3.5" aria-hidden="true" /></button>
                  </div>
                ))}
              </div>
              {page.links.length < L.links ? <button type="button" className={`${btn} mt-2`} onClick={() => set({ links: [...page.links, { label: '', url: '' }] })}><Plus className="h-3.5 w-3.5" aria-hidden="true" />{t('addLink')}</button> : null}
            </div>
            <div>
              <div className={`${lab} flex justify-between`}><span>{t('field.portfolio')}</span><span className="text-muted-foreground">{page.portfolio.length}/{L.portfolio}</span></div>
              <p className="mb-2 text-xs text-muted-foreground">{t('portfolioHint')}</p>
              <div className="space-y-3">
                {page.portfolio.map((p, i) => (
                  <div key={i} className="grid gap-2 rounded-xl border border-border/50 p-3 sm:grid-cols-2">
                    <input aria-label={t('portTitle')} placeholder={t('portTitle')} aria-invalid={!p.title.trim()} className={input} value={p.title} maxLength={L.title} onChange={(e) => upd('portfolio', i, { title: e.target.value })} />
                    <input aria-label={t('portUrl')} placeholder={`${t('portUrl')} https://`} inputMode="url" aria-invalid={urlBad(p.url)} className={input} value={p.url || ''} maxLength={500} onChange={(e) => upd('portfolio', i, { url: e.target.value.trim() || null })} />
                    <input aria-label={t('portImage')} placeholder={`${t('portImage')} https://`} inputMode="url" aria-invalid={urlBad(p.image)} className={`${input} sm:col-span-2`} value={p.image || ''} maxLength={500} onChange={(e) => upd('portfolio', i, { image: e.target.value.trim() || null })} />
                    <textarea aria-label={t('portDesc')} placeholder={t('portDesc')} className={`${input} min-h-16 sm:col-span-2`} value={p.desc} maxLength={L.desc} onChange={(e) => upd('portfolio', i, { desc: e.target.value })} />
                    <div className="sm:col-span-2"><button type="button" className={btn} onClick={() => del('portfolio', i)}><Trash2 className="h-3.5 w-3.5" aria-hidden="true" />{t('remove')}</button></div>
                  </div>
                ))}
              </div>
              {page.portfolio.length < L.portfolio ? <button type="button" className={`${btn} mt-2`} onClick={() => set({ portfolio: [...page.portfolio, { title: '', desc: '', url: null, image: null }] })}><Plus className="h-3.5 w-3.5" aria-hidden="true" />{t('addItem')}</button> : null}
            </div>
          </div>
        </section>
        <section className="rounded-2xl border border-border/60 bg-card/40 p-4">
          <h3 className="text-sm font-bold">{t('sectionLayout')}</h3>
          <p className="mb-3 mt-1 text-xs text-muted-foreground">{t('layoutHint')}</p>
          <ul className="space-y-2">
            {page.order.map((k, i) => (
              <li key={k} className="flex items-center gap-2 rounded-xl border border-border/50 px-3 py-2">
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">{t(`section.${k}`)}</span>
                <button type="button" onClick={() => toggleHide(k)} aria-pressed={!hidden.has(k)} className={`${btn} ${hidden.has(k) ? 'opacity-70' : ''}`}>{hidden.has(k) ? <EyeOff className="h-3.5 w-3.5" aria-hidden="true" /> : <Eye className="h-3.5 w-3.5" aria-hidden="true" />}{hidden.has(k) ? t('visPrivate') : t('visPublic')}</button>
                <button type="button" className={btn} onClick={() => move(k, -1)} disabled={i === 0} aria-label={t('moveUp')}><ArrowUp className="h-3.5 w-3.5" aria-hidden="true" /></button>
                <button type="button" className={btn} onClick={() => move(k, 1)} disabled={i === page.order.length - 1} aria-label={t('moveDown')}><ArrowDown className="h-3.5 w-3.5" aria-hidden="true" /></button>
              </li>
            ))}
            {['socials', 'stats'].map((k) => (
              <li key={k} className="flex items-center gap-2 rounded-xl border border-border/50 px-3 py-2">
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">{t(`section.${k}`)}</span>
                <button type="button" onClick={() => toggleHide(k)} aria-pressed={!hidden.has(k)} className={`${btn} ${hidden.has(k) ? 'opacity-70' : ''}`}>{hidden.has(k) ? <EyeOff className="h-3.5 w-3.5" aria-hidden="true" /> : <Eye className="h-3.5 w-3.5" aria-hidden="true" />}{hidden.has(k) ? t('visPrivate') : t('visPublic')}</button>
              </li>
            ))}
          </ul>
        </section>
        <section className="rounded-2xl border border-border/60 bg-card/40 p-4">
          <h3 className="text-sm font-bold">{tb('editorTitle')}</h3>
          <p className="mb-3 mt-1 text-xs text-muted-foreground">{tb('editorIntro')}</p>
          <BattlePassVisibility onSaved={refreshPass} />
        </section>
        <Panel title={t('sectionStyle')}>
          {(page.mode === 'gradient' || page.mode === 'image') && <Color id="pp-accent" label={t('field.accent')} value={page.accent} onChange={(v) => /^#[0-9a-f]{6}$/.test(v) && set({ accent: v })} />}
          <p className="sm:col-span-2 text-xs text-muted-foreground">{page.mode === 'preset' ? t('accentPresetNote') : page.mode === 'none' ? t('accentNoneNote') : t('accentNote')}</p>
        </Panel>
      </div>
      <SaveBar t={t} dirty={dirty} busy={busy} canSave={!saveBlocked} consent={consent} onConsent={setConsent} onSave={save} onDiscard={() => { setDraft(saved); setMsg(null); }} onReset={reset} msg={msg} onMsgDone={() => setMsg(null)} />
    </div>
  );
}

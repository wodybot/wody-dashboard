'use client';
import { useCallback, useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Check, Globe, Search, ImagePlus, X, ShieldCheck, Server as ServerIcon, Link2, TreePalm } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import HumanCheck from '@/components/human-check';
import { mfetch, catName, fmtDate } from './client';
import { errText } from './RequestActions';
import { LIMITS } from '@/lib/collab/constants';
const isServerCatSlug = (v) => /^sc_[a-f0-9]{12}$/.test(String(v || ''));
import SocialLinks from '@/components/profile/SocialLinks';
import PostDone from './PostDone';
import ServerCollabForm from './ServerCollabForm';
import { input, lab, btn, btnMain } from './ui';
export { input, lab, btn, btnMain };

const STATUS_TONE = { published: 'text-emerald-300 border-emerald-400/40', draft: 'text-muted-foreground border-border/60', rejected: 'text-red-300 border-red-400/40', suspended: 'text-red-300 border-red-400/40', needs_changes: 'text-amber-300 border-amber-400/40', expired: 'text-muted-foreground border-border/60' };

export const EMPTY = { title: '', description: '', category: '', tags: '', outcome: '', requirements: '', links: '', language: 'en', deadline: '', questions: '', attachments: [], contact_mode: 'internal', public_contact: false, origin_guild_id: '' };
const toForm = (c) => ({ ...EMPTY, ...c, tags: (c?.tags || []).join(', '), links: (c?.links || []).join('\n'), questions: (c?.questions || []).join('\n'), origin_guild_id: c?.origin_guild_id || '', deadline: c?.deadline || '' });
const fromForm = (f) => ({ ...f, tags: f.tags.split(',').map((x) => x.trim()).filter(Boolean), links: f.links.split('\n').map((x) => x.trim()).filter(Boolean), questions: f.questions.split('\n').map((x) => x.trim()).filter(Boolean), origin_guild_id: f.origin_guild_id || null, deadline: f.deadline || null });

export function StatusChip({ status, pending }) {
  const t = useTranslations('collab');
  const s = pending && pending !== 'pending_verification' ? pending : status;
  return <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${STATUS_TONE[s] || 'text-sky-300 border-sky-400/40'}`}>{t(`status.${s}`)}</span>;
}

// Search box and list of the servers a request can be posted for: only servers the person is in that have
// Wody and a public Community listing.
function ServerPicker({ guilds, value, onPick }) {
  const t = useTranslations('collab');
  const [q, setQ] = useState('');
  const listed = guilds.filter((g) => g.listed);
  const needle = q.trim().toLowerCase();
  const shown = (needle ? listed.filter((g) => g.name.toLowerCase().includes(needle)) : listed).slice(0, 8);
  if (!listed.length) {
    return (
      <div className="mt-2 rounded-xl border border-dashed border-border/70 p-3 text-sm text-muted-foreground">
        <p>{t('editor.audienceNone')}</p>
        <Link href="/dashboard/community" className="mt-2 inline-flex text-xs font-medium text-[#e6cd8c] underline underline-offset-4">{t('editor.audienceList')}</Link>
      </div>
    );
  }
  return (
    <div className="mt-2">
      <label className="sr-only" htmlFor="ed-guild-q">{t('editor.audienceSearch')}</label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
        <input id="ed-guild-q" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('editor.audienceSearch')} maxLength={60} autoComplete="off" className={`${input} pl-9`} />
      </div>
      <div role="radiogroup" aria-label={t('editor.audienceServer')} className="mt-2 max-h-72 space-y-3 overflow-y-auto pr-1">
        {[['open', shown.filter((g) => !g.require_approval)], ['approval', shown.filter((g) => g.require_approval)]].map(([kind, list]) => list.length > 0 && (
          <div key={kind}>
            <p className="text-xs font-semibold">{t(`editor.group.${kind}`)}</p>
            <p className="mb-1.5 text-[11px] text-muted-foreground">{t(`editor.group.${kind}Hint`)}</p>
            <ul className="space-y-1.5">
              {list.map((g) => (
                <li key={g.id}>
                  <label className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm transition-colors ${value === g.id ? 'border-[#e6cd8c]/60 bg-[#e6cd8c]/10' : 'border-border/60 bg-card/40 hover:border-border'}`}>
                    <input type="radio" name="ed-guild" className="sr-only" checked={value === g.id} onChange={() => onPick(g.id)} />
                    <span className="min-w-0 flex-1 truncate font-medium">{g.name}</span>
                    <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] ${g.require_approval ? 'border-sky-400/40 text-sky-300' : 'border-emerald-400/40 text-emerald-300'}`}>{g.require_approval ? t('servers.approvalOn') : t('servers.approvalOff')}</span>
                    {value === g.id && <Check className="h-4 w-4 shrink-0 text-[#e6cd8c]" aria-hidden="true" />}
                  </label>
                </li>
              ))}
            </ul>
          </div>
        ))}
        {!shown.length && <p className="px-1 py-2 text-sm text-muted-foreground">{t('editor.audienceNoMatch')}</p>}
      </div>
      {value && (() => { const g = guilds.find((x) => x.id === value); return g ? <p className="mt-2 rounded-lg border border-border/60 bg-card/40 p-2.5 text-[11px] text-muted-foreground">{t(g.require_approval ? 'editor.whyApproval' : 'editor.whyOpen', { name: g.name })}</p> : null; })()}
      <p className="mt-1 text-[11px] text-muted-foreground">{t('editor.audienceServerHint')}</p>
    </div>
  );
}

export function Editor({ id, cats, guilds, initial = null, onClose, onSaved }) {
  const t = useTranslations('collab');
  const locale = useLocale();
  const [f, setF] = useState(EMPTY);
  const [rid, setRid] = useState(id);
  const [state, setState] = useState({ busy: false, msg: '', ok: false });
  const [loaded, setLoaded] = useState(!id);
  const [done, setDone] = useState(null);
  const [link, setLink] = useState('');
  const [linkBusy, setLinkBusy] = useState(false);
  // Who the request is for: everyone (no origin server) or one of the servers the person is in.
  const [aud, setAud] = useState('global');
  // Categories made by the chosen server (and whether this person can post in each).
  const [sc, setSc] = useState({ gid: '', list: [], name: '' });
  // Opened from /createcollab?guild=..&category=..: only a suggestion, used when that server is one the person can post for.
  useEffect(() => {
    if (id || !initial?.guild) return;
    const g = guilds.find((x) => x.id === initial.guild && x.listed);
    if (!g) return;
    setAud('server');
    setF((x) => ({ ...x, origin_guild_id: g.id, category: initial.category || x.category }));
  }, [id, initial, guilds]);
  useEffect(() => {
    if (aud !== 'server' || !f.origin_guild_id) { setSc({ gid: '', list: [], name: '' }); return undefined; }
    let live = true;
    mfetch(`guild/${f.origin_guild_id}/categories`).then((r) => { if (live) setSc({ gid: f.origin_guild_id, list: r.ok ? r.data.categories : [], name: r.ok ? r.data.guild?.name || '' : '' }); });
    return () => { live = false; };
  }, [aud, f.origin_guild_id]);
  // A server category only belongs to its own server: drop it when the server changes or is no longer chosen.
  useEffect(() => {
    if (aud !== 'server') { if (isServerCatSlug(f.category)) setF((x) => ({ ...x, category: '' })); return; }
    // for a server only that server's own categories count (the site's categories are for posts made for everyone)
    if (f.category && sc.gid === f.origin_guild_id && !sc.list.some((c) => c.slug === f.category && c.can_post)) setF((x) => ({ ...x, category: '' }));
  }, [aud, sc, f.category, f.origin_guild_id]);
  useEffect(() => { if (id) mfetch(`me/requests/${id}`).then((r) => { if (r.ok) { setF(toForm(r.data.content)); setAud(r.data.content?.origin_guild_id ? 'server' : 'global'); } setLoaded(true); }); }, [id]);
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  async function save() {
    if (aud === 'server' && !f.origin_guild_id) return { r: { ok: false, data: { error: 'audience' } }, id: rid };
    const body = fromForm({ ...f, origin_guild_id: aud === 'server' ? f.origin_guild_id : '' });
    const r = rid ? await mfetch(`me/requests/${rid}`, { method: 'PUT', body }) : await mfetch('me/requests', { method: 'POST', body });
    if (r.ok && !rid) setRid(r.data.id);
    return { r, id: rid || r.data?.id };
  }
  async function saveDraft() {
    setState({ busy: true, msg: '', ok: false });
    const { r } = await save();
    setState({ busy: false, ok: r.ok, msg: r.ok ? t('editor.saved') : errText(t, r.data) });
    if (r.ok) onSaved();
  }
  async function submit() {
    setState({ busy: true, msg: '', ok: false });
    const { r, id: use } = await save();
    if (!r.ok) { setState({ busy: false, ok: false, msg: errText(t, r.data) }); return; }
    const s = await mfetch(`me/requests/${use}/submit`, { method: 'POST' });
    if (!s.ok) { setState({ busy: false, ok: false, msg: errText(t, s.data) }); onSaved(); return; }
    setState({ busy: false, ok: true, msg: '' });
    setDone({ id: use, title: f.title, outcome: ['published', 'pending_review', 'pending_server'].includes(s.data.outcome) ? s.data.outcome : 'published' });
    onSaved();
  }
  async function upload(e) {
    const file = e.target.files?.[0]; e.target.value = '';
    if (!file) return;
    const form = new FormData(); form.append('file', file);
    const r = await mfetch('upload', { method: 'POST', form });
    if (r.ok) setF((s) => ({ ...s, attachments: [...s.attachments, r.data.id].slice(0, LIMITS.attachments.max) })); else setState({ busy: false, ok: false, msg: errText(t, r.data) });
  }
  async function addLink() {
    const u = link.trim();
    if (!u || linkBusy) return;
    setLinkBusy(true); setState({ busy: false, msg: '', ok: false });
    const r = await mfetch('upload/url', { method: 'POST', body: { url: u } });
    setLinkBusy(false);
    if (r.ok) { setLink(''); setF((s) => ({ ...s, attachments: [...s.attachments, r.data.id].slice(0, LIMITS.attachments.max) })); } else setState({ busy: false, ok: false, msg: errText(t, r.data) });
  }
  if (!loaded) return <p className="text-sm text-muted-foreground">{t('loading')}</p>;
  if (done) return <PostDone id={done.id} title={done.title} outcome={done.outcome} onNew={() => { setDone(null); setF(EMPTY); setRid(null); setAud('global'); setState({ busy: false, msg: '', ok: false }); }} onClose={onClose} />;
  return (
    <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="space-y-4" noValidate>
      <div className="flex items-center justify-between"><h2 className="text-lg font-semibold">{id ? t('editor.edit') : t('editor.new')}</h2><button type="button" onClick={onClose} className={btn}><X className="h-4 w-4" aria-hidden="true" />{t('close')}</button></div>
      <div role="note" className="flex items-start gap-3 rounded-xl border border-[#e6cd8c]/40 bg-[#e6cd8c]/[0.07] p-3.5"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#e6cd8c]" aria-hidden="true" /><div className="min-w-0"><p className="text-sm font-semibold text-[#f3e1b0]">{t('editor.noMoneyTitle')}</p><p className="mt-0.5 text-xs leading-relaxed text-foreground/85">{t('editor.noMoney')}</p></div></div>
      <div><label className={lab} htmlFor="ed-title">{t('field.title')}</label><input id="ed-title" className={input} maxLength={100} value={f.title} onChange={set('title')} /></div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div><label className={lab} htmlFor="ed-cat">{t('field.category')}</label><select id="ed-cat" className={input} value={f.category} onChange={set('category')}><option value="">{t('choose')}</option>{aud !== 'server' && cats.map((c) => <option key={c.slug} value={c.slug}>{catName(c, locale)}</option>)}{aud === 'server' && sc.gid === f.origin_guild_id && sc.list.length > 0 && (
            <optgroup label={sc.name ? `${t('editor.serverCatGroup')}: ${sc.name}` : t('editor.serverCatGroup')}>
              {sc.list.map((c) => <option key={c.slug} value={c.slug} disabled={!c.can_post}>{c.name}{!c.can_post ? ` (${t(c.access === 'roles' ? 'editor.lockRoles' : 'editor.lockPrivate')})` : ''}</option>)}
            </optgroup>
          )}</select></div>
        {aud === 'server' && sc.gid === f.origin_guild_id && sc.list.length === 0 && <p role="alert" className="text-xs text-amber-300 sm:col-span-2">{t('editor.serverNoCats')}</p>}
        <div><label className={lab} htmlFor="ed-lang">{t('field.language')}</label><select id="ed-lang" className={input} value={f.language} onChange={set('language')}>{['en', 'ro', 'fr', 'it', 'de', 'es', 'pt', 'nl', 'tr'].map((l) => <option key={l} value={l}>{l.toUpperCase()}</option>)}</select></div>
      </div>
      <div><label className={lab} htmlFor="ed-desc">{t('field.description')}</label><textarea id="ed-desc" className={input} rows={6} maxLength={4000} value={f.description} onChange={set('description')} /></div>
      <div><label className={lab} htmlFor="ed-out">{t('f.outcome')}</label><textarea id="ed-out" className={input} rows={2} maxLength={800} value={f.outcome} onChange={set('outcome')} /></div>
      <div><label className={lab} htmlFor="ed-req">{t('f.requirements')}</label><textarea id="ed-req" className={input} rows={2} maxLength={800} value={f.requirements} onChange={set('requirements')} /></div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div><label className={lab} htmlFor="ed-tags">{t('field.tags')}</label><input id="ed-tags" className={input} value={f.tags} onChange={set('tags')} placeholder={t('editor.tagsHint')} /></div>
        <div><label className={lab} htmlFor="ed-dead">{t('field.deadline')}</label><input id="ed-dead" type="date" className={input} value={f.deadline} onChange={set('deadline')} /></div>
      </div>
      <div><label className={lab} htmlFor="ed-links">{t('field.links')}</label><textarea id="ed-links" className={input} rows={2} value={f.links} onChange={set('links')} placeholder={t('editor.linksHint')} /></div>
      <div><label className={lab} htmlFor="ed-q">{t('field.questions')}</label><textarea id="ed-q" className={input} rows={2} value={f.questions} onChange={set('questions')} placeholder={t('editor.questionsHint')} /></div>
      <div>
        <span className={lab}>{t('field.attachments')}</span>
        <div className="flex flex-wrap items-center gap-2">
          {f.attachments.map((a) => <span key={a} className="inline-flex items-center gap-1 rounded-md bg-muted/60 px-2 py-1 text-xs">{t('editor.image')}<button type="button" aria-label={t('remove')} onClick={() => setF((s) => ({ ...s, attachments: s.attachments.filter((x) => x !== a) }))}><X className="h-3 w-3" aria-hidden="true" /></button></span>)}
          {f.attachments.length < LIMITS.attachments.max && <label className={`${btn} cursor-pointer`}><ImagePlus className="h-4 w-4" aria-hidden="true" />{t('editor.addImage')}<input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={upload} /></label>}
        </div>
        {f.attachments.length < LIMITS.attachments.max && (
          <div className="mt-2">
            <label className={lab} htmlFor="ed-imglink">{t('editor.imageLink')}</label>
            <div className="flex gap-2">
              <input id="ed-imglink" type="url" inputMode="url" autoComplete="off" className={input} maxLength={2048} value={link} placeholder="https://" onChange={(e) => setLink(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addLink(); } }} />
              <button type="button" className={`${btn} shrink-0`} disabled={linkBusy || !link.trim()} onClick={addLink}><Link2 className="h-4 w-4" aria-hidden="true" />{linkBusy ? t('loading') : t('editor.imageLinkAdd')}</button>
            </div>
          </div>
        )}
        <p className="mt-1 text-[11px] text-muted-foreground">{t('editor.imageHint')}</p>
        <p className="text-[11px] text-muted-foreground">{t('editor.imageLinkHint')}</p>
      </div>
      <fieldset>
        <legend className={lab}>{t('editor.audienceLegend')}</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {[['global', Globe, 'audienceGlobal', 'audienceGlobalHint'], ['server', ServerIcon, 'audienceServer', null]].map(([val, Icon, label, hint]) => {
            const off = false;
            return (
              <label key={val} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors ${aud === val ? 'border-[#e6cd8c]/60 bg-[#e6cd8c]/10' : 'border-border/60 bg-card/40 hover:border-border'} ${off ? 'cursor-not-allowed opacity-50' : ''}`}>
                <input type="radio" name="ed-audience" className="sr-only" checked={aud === val} disabled={off} onChange={() => setAud(val)} />
                <span className={`mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${aud === val ? 'border-[#e6cd8c]/50 bg-[#e6cd8c]/15 text-[#f3e1b0]' : 'border-border/60 text-muted-foreground'}`}><Icon className="h-4 w-4" aria-hidden="true" /></span>
                <span className="min-w-0"><span className="block text-sm font-semibold">{t(`editor.${label}`)}</span>{hint && <span className="block text-[11px] text-muted-foreground">{t(`editor.${hint}`)}</span>}</span>
              </label>
            );
          })}
        </div>
        {aud === 'global' && <p className="mt-2 rounded-lg border border-border/60 bg-card/40 p-2.5 text-[11px] text-muted-foreground">{t('editor.whyGlobal')}</p>}
        {aud === 'server' && <ServerPicker guilds={guilds} value={f.origin_guild_id} onPick={(id) => setF((x) => ({ ...x, origin_guild_id: id }))} />}
      </fieldset>
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={f.public_contact} onChange={set('public_contact')} /><span>{t('editor.publicContact')}<span className="block text-[11px] text-muted-foreground">{t('editor.publicContactHint')}</span></span></label>
      <div className="flex flex-wrap items-center justify-end gap-2">{state.msg && <p role={state.ok ? 'status' : 'alert'} className={`min-w-0 flex-1 text-right text-sm ${state.ok ? 'text-emerald-300' : 'text-destructive'}`}>{state.msg}</p>}<button type="button" className={btn} disabled={state.busy} onClick={saveDraft}>{t('editor.saveDraft')}</button><button type="submit" className={btnMain} disabled={state.busy}>{t('editor.submit')}</button></div>
    </form>
  );
}

export function Applications({ req, onClose }) {
  const t = useTranslations('collab');
  const [data, setData] = useState(null);
  const [note, setNote] = useState({});
  const [passes, setPasses] = useState({});
  const [round, setRound] = useState(0);
  const [msg, setMsg] = useState('');
  const load = useCallback(async () => { const r = await mfetch(`me/requests/${req.id}/applications`); setData(r.ok ? r.data : { items: [], questions: [] }); }, [req.id]);
  useEffect(() => { load(); }, [load]);
  const act = async (appId, what, body) => { const r = await mfetch(`me/requests/${req.id}/applications/${appId}/${what}`, { method: 'POST', body }); setMsg(r.ok ? '' : errText(t, r.data)); load(); if (what === 'message') { setRound((n) => n + 1); if (r.ok) setNote((n) => ({ ...n, [appId]: '' })); } };
  return (
    <div>
      <div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-semibold">{t('apps.title', { title: req.title })}</h2><button className={btn} onClick={onClose}><X className="h-4 w-4" aria-hidden="true" />{t('close')}</button></div>
      {msg && <p role="alert" className="mb-3 text-sm text-destructive">{msg}</p>}
      {!data ? <p className="text-sm text-muted-foreground">{t('loading')}</p> : data.items.length === 0 ? <p className="text-sm text-muted-foreground">{t('apps.none')}</p> : (
        <ul className="space-y-4">{data.items.map((a) => (
          <li key={a.id} className="rounded-2xl border border-border/60 bg-card/50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2"><strong>{a.applicant?.name}</strong><span className="rounded-full border border-border/60 px-2 py-0.5 text-[11px]">{t(`appStatus.${a.status}`)}</span></div>
            {a.away && <p className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-sky-400/40 bg-sky-400/10 px-2.5 py-1 text-[11px] text-sky-200" data-away="on"><TreePalm className="h-3.5 w-3.5" aria-hidden="true" />{t('away.applicant')}{a.away.until ? ` · ${a.away.until}` : ''}{a.away.note ? ` · ${a.away.note}` : ''}</p>}
            {a.socials && Object.keys(a.socials).length > 0 && <SocialLinks socials={a.socials} className="mt-2" size="sm" />}
            <p className="mt-2 whitespace-pre-wrap break-words text-sm">{a.intro}</p>
            {a.experience && <p className="mt-2 whitespace-pre-wrap break-words text-sm text-muted-foreground"><b>{t('field.experience')}:</b> {a.experience}</p>}
            {a.skills?.length > 0 && <p className="mt-2 text-sm"><b>{t('field.skills')}:</b> {a.skills.join(', ')}</p>}
            {a.approach && <p className="mt-2 whitespace-pre-wrap break-words text-sm"><b>{t('field.approach')}:</b> {a.approach}</p>}
            {a.duration && <p className="mt-2 text-sm"><b>{t('field.duration')}:</b> {a.duration}</p>}
            {a.portfolio?.length > 0 && <ul className="mt-2 space-y-1 text-sm">{a.portfolio.map((u) => <li key={u}><a href={u} target="_blank" rel="noopener noreferrer nofollow ugc" className="break-all underline underline-offset-4">{u}</a></li>)}</ul>}
            {data.questions.map((q, i) => <p key={i} className="mt-2 text-sm"><b>{q}</b><br />{a.answers?.[i]}</p>)}
            <div className="mt-3 flex flex-wrap gap-2">
              {a.status !== 'selected' && <button className={btnMain} disabled={req.accepted_application_id != null} onClick={() => act(a.id, 'select')}>{t('apps.select')}</button>}
              {a.status !== 'shortlisted' && a.status !== 'selected' && <button className={btn} onClick={() => act(a.id, 'status', { status: 'shortlisted' })}>{t('apps.shortlist')}</button>}
              {a.status !== 'declined' && a.status !== 'selected' && <button className={btn} onClick={() => act(a.id, 'status', { status: 'declined' })}>{t('apps.decline')}</button>}
            </div>
            <div className="mt-3 flex flex-wrap items-start gap-2"><input className={`${input} min-w-[12rem] flex-1`} aria-label={t('apps.clarify')} placeholder={t('apps.clarify')} maxLength={1500} value={note[a.id] || ''} onChange={(e) => setNote((n) => ({ ...n, [a.id]: e.target.value }))} />{(note[a.id] || '').trim() ? <HumanCheck purpose="collab_message" ctx={String(a.id)} resetKey={round} onPass={(p) => setPasses((x) => ({ ...x, [a.id]: p }))} /> : null}<button className={btn} disabled={!passes[a.id] || !(note[a.id] || '').trim()} onClick={() => act(a.id, 'message', { body: note[a.id], pass: passes[a.id] })}>{t('apps.send')}</button></div>
          </li>))}</ul>
      )}
    </div>
  );
}

export function MyApplications({ data, reload }) {
  const t = useTranslations('collab');
  const locale = useLocale();
  const withdraw = async (id) => { await mfetch(`me/applications/${id}/withdraw`, { method: 'POST' }); reload(); };
  if (!data.applications.length) return <p className="rounded-2xl border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground">{t('apps.mine.none')}</p>;
  return (
    <ul className="space-y-3">{data.applications.map((a) => (
      <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border/60 bg-card/50 p-4">
        <div className="min-w-0"><Link href={`/collab/${a.request_id}`} className="block truncate font-semibold hover:underline">{a.title}</Link><p className="text-xs text-muted-foreground">{fmtDate(a.created_at, locale)}</p></div>
        <div className="flex items-center gap-2"><span className="rounded-full border border-border/60 px-2 py-0.5 text-[11px]">{t(`appStatus.${a.status}`)}</span>{['sent', 'shortlisted'].includes(a.status) && <button className={btn} onClick={() => withdraw(a.id)}>{t('apps.withdraw')}</button>}</div>
      </li>))}</ul>
  );
}

export function ServersTab({ guilds, unavailable, reload }) {
  const t = useTranslations('collab');
  const [queue, setQueue] = useState({});
  const [reason, setReason] = useState({});
  const [msg, setMsg] = useState('');
  const owners = guilds.filter((g) => g.owner);
  const loadQ = useCallback(async (gid) => { const r = await mfetch(`server/${gid}/queue`); if (r.ok) setQueue((q) => ({ ...q, [gid]: r.data.items })); }, []);
  useEffect(() => { owners.forEach((g) => { if (g.require_approval) loadQ(g.id); }); }, [guilds]); // eslint-disable-line react-hooks/exhaustive-deps
  const decide = async (g, it, action) => { const r = await mfetch(`server/${g.id}/decide`, { method: 'POST', body: { request_id: it.id, version_id: it.version_id, action, reason: reason[it.id] } }); setMsg(r.ok ? '' : errText(t, r.data)); loadQ(g.id); };
  if (unavailable) return <p role="alert" className="text-sm text-destructive">{t('err.discord_unavailable')}</p>;
  if (!owners.length) return <p className="rounded-2xl border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground">{t('servers.none')}</p>;
  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">{t('servers.text')}</p>
      {msg && <p role="alert" className="text-sm text-destructive">{msg}</p>}
      {owners.map((g) => (
        <section key={g.id} className="rounded-2xl border border-border/60 bg-card/50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">{g.name}</h3>
          </div>
          <div className="mt-3"><ServerCollabForm key={g.id} gid={g.id} dashLink owner initial={g} onSaved={() => reload()} /></div>
          {g.require_approval && (
            <div className="mt-3"><h4 className="mb-2 text-sm font-semibold">{t('servers.queue')}</h4>
              {(queue[g.id] || []).length === 0 ? <p className="text-sm text-muted-foreground">{t('servers.queueEmpty')}</p> : (
                <ul className="space-y-3">{queue[g.id].map((it) => (
                  <li key={it.id} className="rounded-xl border border-border/60 p-3">
                    <p className="font-medium">{it.content.title}</p><p className="mt-1 line-clamp-4 whitespace-pre-wrap break-words text-sm text-muted-foreground">{it.content.description}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{it.author?.name}{it.edit ? ` · ${t('servers.edit')}` : ''}</p>
                    <input className={`${input} mt-2`} aria-label={t('servers.reason')} placeholder={t('servers.reason')} maxLength={300} value={reason[it.id] || ''} onChange={(e) => setReason((x) => ({ ...x, [it.id]: e.target.value }))} />
                    <div className="mt-2 flex flex-wrap gap-2"><button className={btnMain} onClick={() => decide(g, it, 'approve')}>{t('servers.approve')}</button><button className={btn} onClick={() => decide(g, it, 'changes')}>{t('servers.changes')}</button><button className={btn} onClick={() => decide(g, it, 'reject')}>{t('servers.reject')}</button></div>
                  </li>))}</ul>)}
            </div>)}
        </section>))}
    </div>
  );
}

export function PrefsTab({ cats }) {
  const t = useTranslations('collab');
  const locale = useLocale();
  const [p, setP] = useState(null);
  const [saved, setSaved] = useState(false);
  useEffect(() => { mfetch('me/profile').then((r) => setP(r.ok ? { ...r.data, tags: (r.data.pref_tags || []).join(', ') } : { pref_categories: [], tags: '' })); }, []);
  if (!p) return <p className="text-sm text-muted-foreground">{t('loading')}</p>;
  const save = async () => { const r = await mfetch('me/profile', { method: 'PUT', body: { pref_categories: p.pref_categories, pref_tags: p.tags.split(',').map((x) => x.trim()).filter(Boolean), locale } }); setSaved(r.ok); };
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t('prefs.text')}</p>
      <fieldset><legend className={lab}>{t('categories')}</legend><div className="flex flex-wrap gap-2">{cats.map((c) => { const on = p.pref_categories.includes(c.slug); return <label key={c.slug} className={`cursor-pointer rounded-full border px-3 py-1.5 text-sm ${on ? 'border-[#e6cd8c]/70 bg-[#e6cd8c]/10' : 'border-border/60'}`}><input type="checkbox" className="sr-only" checked={on} onChange={() => setP((s) => ({ ...s, pref_categories: on ? s.pref_categories.filter((x) => x !== c.slug) : [...s.pref_categories, c.slug] }))} />{catName(c, locale)}</label>; })}</div></fieldset>
      <div><label className={lab} htmlFor="pf-tags">{t('field.tags')}</label><input id="pf-tags" className={input} value={p.tags} onChange={(e) => setP((s) => ({ ...s, tags: e.target.value }))} placeholder={t('editor.tagsHint')} /></div>
      <p className="text-xs text-muted-foreground">{t('prefs.language')}</p>
      <div className="flex items-center justify-end gap-3"><button className={btnMain} onClick={save}>{t('prefs.save')}</button>{saved && <span role="status" className="text-sm text-emerald-300">{t('editor.saved')}</span>}</div>
    </div>
  );
}

'use client';
import { useCallback, useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Briefcase, Check, Globe, Search, Plus, Inbox, Send, Server as ServerIcon, SlidersHorizontal, ListChecks, ImagePlus, X, ShieldCheck } from 'lucide-react';
import { Footer, TopNav } from '@/components/nav';
import { Link } from '@/i18n/navigation';
import { mfetch, catName, fmtDate } from './client';
import { errText } from './RequestActions';
import { LIMITS } from '@/lib/collab/constants';

const input = 'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
const lab = 'mb-1 block text-xs font-medium text-muted-foreground';
const btn = 'inline-flex items-center gap-1.5 rounded-lg border border-border/70 px-3 py-1.5 text-sm font-medium transition hover:border-[#e6cd8c]/60 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e6cd8c]';
const btnMain = 'inline-flex items-center gap-1.5 rounded-lg bg-[#e6cd8c] text-[#1a1208] px-4 py-2 text-sm font-semibold hover:bg-[#f3e1b0] disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e6cd8c]';
const STATUS_TONE = { published: 'text-emerald-300 border-emerald-400/40', draft: 'text-muted-foreground border-border/60', rejected: 'text-red-300 border-red-400/40', suspended: 'text-red-300 border-red-400/40', needs_changes: 'text-amber-300 border-amber-400/40', expired: 'text-muted-foreground border-border/60' };

const EMPTY = { title: '', description: '', category: '', tags: '', outcome: '', requirements: '', links: '', language: 'en', deadline: '', questions: '', attachments: [], contact_mode: 'internal', public_contact: false, origin_guild_id: '' };
const toForm = (c) => ({ ...EMPTY, ...c, tags: (c?.tags || []).join(', '), links: (c?.links || []).join('\n'), questions: (c?.questions || []).join('\n'), origin_guild_id: c?.origin_guild_id || '', deadline: c?.deadline || '' });
const fromForm = (f) => ({ ...f, tags: f.tags.split(',').map((x) => x.trim()).filter(Boolean), links: f.links.split('\n').map((x) => x.trim()).filter(Boolean), questions: f.questions.split('\n').map((x) => x.trim()).filter(Boolean), origin_guild_id: f.origin_guild_id || null, deadline: f.deadline || null });

function StatusChip({ status, pending }) {
  const t = useTranslations('collab');
  const s = pending && pending !== 'pending_verification' ? pending : status;
  return <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${STATUS_TONE[s] || 'text-sky-300 border-sky-400/40'}`}>{t(`status.${s}`)}</span>;
}

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
      <ul role="radiogroup" aria-label={t('editor.audienceServer')} className="mt-2 max-h-56 space-y-1.5 overflow-y-auto pr-1">
        {shown.map((g) => (
          <li key={g.id}>
            <label className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm transition-colors ${value === g.id ? 'border-[#e6cd8c]/60 bg-[#e6cd8c]/10' : 'border-border/60 bg-card/40 hover:border-border'}`}>
              <input type="radio" name="ed-guild" className="sr-only" checked={value === g.id} onChange={() => onPick(g.id)} />
              <span className="min-w-0 flex-1 truncate font-medium">{g.name}</span>
              {g.require_approval && <span className="shrink-0 rounded-full border border-border/60 px-2 py-0.5 text-[10px] text-muted-foreground">{t('servers.approvalOn')}</span>}
              {value === g.id && <Check className="h-4 w-4 shrink-0 text-[#e6cd8c]" aria-hidden="true" />}
            </label>
          </li>
        ))}
        {!shown.length && <li className="px-1 py-2 text-sm text-muted-foreground">{t('editor.audienceNoMatch')}</li>}
      </ul>
      <p className="mt-1 text-[11px] text-muted-foreground">{t('editor.audienceServerHint')}</p>
    </div>
  );
}

function Editor({ id, cats, guilds, onClose, onSaved }) {
  const t = useTranslations('collab');
  const locale = useLocale();
  const [f, setF] = useState(EMPTY);
  const [rid, setRid] = useState(id);
  const [state, setState] = useState({ busy: false, msg: '', ok: false });
  const [loaded, setLoaded] = useState(!id);
  const [aud, setAud] = useState('global');
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
    setState({ busy: false, ok: true, msg: t(`outcome.${s.data.outcome}`) });
    onSaved();
  }
  async function upload(e) {
    const file = e.target.files?.[0]; e.target.value = '';
    if (!file) return;
    const form = new FormData(); form.append('file', file);
    const r = await mfetch('upload', { method: 'POST', form });
    if (r.ok) setF((s) => ({ ...s, attachments: [...s.attachments, r.data.id].slice(0, LIMITS.attachments.max) })); else setState({ busy: false, ok: false, msg: errText(t, r.data) });
  }
  if (!loaded) return <p className="text-sm text-muted-foreground">{t('loading')}</p>;
  return (
    <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="space-y-4" noValidate>
      <div className="flex items-center justify-between"><h2 className="text-lg font-semibold">{id ? t('editor.edit') : t('editor.new')}</h2><button type="button" onClick={onClose} className={btn}><X className="h-4 w-4" aria-hidden="true" />{t('close')}</button></div>
      <p className="flex items-start gap-2 rounded-xl border border-[#e6cd8c]/30 bg-[#e6cd8c]/5 p-3 text-xs"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#e6cd8c]" aria-hidden="true" />{t('editor.noMoney')}</p>
      <div><label className={lab} htmlFor="ed-title">{t('field.title')}</label><input id="ed-title" className={input} maxLength={100} value={f.title} onChange={set('title')} /></div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div><label className={lab} htmlFor="ed-cat">{t('field.category')}</label><select id="ed-cat" className={input} value={f.category} onChange={set('category')}><option value="">{t('choose')}</option>{cats.map((c) => <option key={c.slug} value={c.slug}>{catName(c, locale)}</option>)}</select></div>
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
        <p className="mt-1 text-[11px] text-muted-foreground">{t('editor.imageHint')}</p>
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
        {aud === 'server' && <ServerPicker guilds={guilds} value={f.origin_guild_id} onPick={(id) => setF((x) => ({ ...x, origin_guild_id: id }))} />}
      </fieldset>
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={f.public_contact} onChange={set('public_contact')} /><span>{t('editor.publicContact')}<span className="block text-[11px] text-muted-foreground">{t('editor.publicContactHint')}</span></span></label>
      {state.msg && <p role={state.ok ? 'status' : 'alert'} className={`text-sm ${state.ok ? 'text-emerald-300' : 'text-destructive'}`}>{state.msg}</p>}
      <div className="flex flex-wrap gap-2"><button type="button" className={btn} disabled={state.busy} onClick={saveDraft}>{t('editor.saveDraft')}</button><button type="submit" className={btnMain} disabled={state.busy}>{t('editor.submit')}</button></div>
    </form>
  );
}

function Applications({ req, onClose }) {
  const t = useTranslations('collab');
  const [data, setData] = useState(null);
  const [note, setNote] = useState({});
  const [msg, setMsg] = useState('');
  const load = useCallback(async () => { const r = await mfetch(`me/requests/${req.id}/applications`); setData(r.ok ? r.data : { items: [], questions: [] }); }, [req.id]);
  useEffect(() => { load(); }, [load]);
  const act = async (appId, what, body) => { const r = await mfetch(`me/requests/${req.id}/applications/${appId}/${what}`, { method: 'POST', body }); setMsg(r.ok ? '' : errText(t, r.data)); load(); if (what === 'message' && r.ok) setNote((n) => ({ ...n, [appId]: '' })); };
  return (
    <div>
      <div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-semibold">{t('apps.title', { title: req.title })}</h2><button className={btn} onClick={onClose}><X className="h-4 w-4" aria-hidden="true" />{t('close')}</button></div>
      {msg && <p role="alert" className="mb-3 text-sm text-destructive">{msg}</p>}
      {!data ? <p className="text-sm text-muted-foreground">{t('loading')}</p> : data.items.length === 0 ? <p className="text-sm text-muted-foreground">{t('apps.none')}</p> : (
        <ul className="space-y-4">{data.items.map((a) => (
          <li key={a.id} className="rounded-2xl border border-border/60 bg-card/50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2"><strong>{a.applicant?.name}</strong><span className="rounded-full border border-border/60 px-2 py-0.5 text-[11px]">{t(`appStatus.${a.status}`)}</span></div>
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
            <div className="mt-3 flex gap-2"><input className={input} aria-label={t('apps.clarify')} placeholder={t('apps.clarify')} maxLength={1500} value={note[a.id] || ''} onChange={(e) => setNote((n) => ({ ...n, [a.id]: e.target.value }))} /><button className={btn} onClick={() => act(a.id, 'message', { body: note[a.id] })}>{t('apps.send')}</button></div>
          </li>))}</ul>
      )}
    </div>
  );
}

function MyRequests({ data, reload, cats, guilds }) {
  const t = useTranslations('collab');
  const locale = useLocale();
  const [view, setView] = useState(null);
  const [msg, setMsg] = useState('');
  useEffect(() => { if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('new')) setView({ kind: 'edit', id: null }); }, []);
  const act = async (id, path, method = 'POST') => { const r = await mfetch(`me/requests/${id}${path}`, { method }); setMsg(r.ok ? '' : errText(t, r.data)); reload(); };
  if (view?.kind === 'edit') return <Editor id={view.id} cats={cats} guilds={guilds} onClose={() => { setView(null); reload(); }} onSaved={reload} />;
  if (view?.kind === 'apps') return <Applications req={view.req} onClose={() => { setView(null); reload(); }} />;
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-semibold">{t('tab.requests')}</h2><button className={btnMain} onClick={() => setView({ kind: 'edit', id: null })}><Plus className="h-4 w-4" aria-hidden="true" />{t('postRequest')}</button></div>
      {msg && <p role="alert" className="mb-3 text-sm text-destructive">{msg}</p>}
      {data.requests.length === 0 ? <p className="rounded-2xl border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground">{t('requests.none')}</p> : (
        <ul className="space-y-3">{data.requests.map((r) => (
          <li key={r.id} className="rounded-2xl border border-border/60 bg-card/50 p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0"><p className="truncate font-semibold">{r.title || t('untitled')}</p><p className="mt-0.5 text-xs text-muted-foreground">{r.updated_at ? fmtDate(r.updated_at, locale) : ''}{r.expires_at && r.status === 'published' ? ` · ${t('requests.expires', { date: fmtDate(r.expires_at, locale) })}` : ''}</p></div>
              <StatusChip status={r.status} pending={r.pending_state} />
            </div>
            {r.decision?.reason && (r.status === 'rejected' || r.status === 'needs_changes' || r.pending_state === 'needs_changes' || r.pending_state === 'rejected') && <p className="mt-2 text-sm text-amber-200">{t('requests.reason', { reason: r.decision.reason })}</p>}
            {(r.status === 'pending_review' || r.pending_state === 'pending_review') && <p className="mt-2 text-xs text-muted-foreground">{t('requests.heldReview')}</p>}
            {(r.status === 'pending_server' || r.pending_state === 'pending_server') && <p className="mt-2 text-xs text-muted-foreground">{t('requests.heldServer')}</p>}
            <div className="mt-3 flex flex-wrap gap-2">
              {r.status !== 'suspended' && r.status !== 'pending_verification' && <button className={btn} onClick={() => setView({ kind: 'edit', id: r.id })}>{t('requests.edit')}</button>}
              {r.status === 'published' && <Link className={btn} href={`/collab/${r.id}`}>{t('view')}</Link>}
              {r.status === 'published' && <button className={btn} onClick={() => setView({ kind: 'apps', req: r })}>{t('requests.applications', { n: r.applications })}</button>}
              {r.status === 'published' && !r.closed_at && <button className={btn} onClick={() => act(r.id, '/close')}>{t('requests.close')}</button>}
              {r.status === 'published' && r.closed_at && !r.accepted_application_id && <button className={btn} onClick={() => act(r.id, '/reopen')}>{t('requests.reopen')}</button>}
              {r.status === 'expired' && <button className={btn} onClick={() => act(r.id, '/renew')}>{t('requests.renew')}</button>}
              {r.pending_state && r.pending_state !== 'pending_verification' && <button className={btn} onClick={() => act(r.id, '/discard')}>{t('requests.discard')}</button>}
              {r.status === 'draft' && <button className={btn} onClick={() => act(r.id, '', 'DELETE')}>{t('requests.delete')}</button>}
            </div>
          </li>))}</ul>
      )}
    </div>
  );
}

function MyApplications({ data, reload }) {
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

function InboxTab({ reload }) {
  const t = useTranslations('collab');
  const locale = useLocale();
  const [items, setItems] = useState(null);
  const [notes, setNotes] = useState([]);
  const [reply, setReply] = useState({});
  const load = useCallback(async () => {
    const [a, b] = await Promise.all([mfetch('me/inbox'), mfetch('me/notifications')]);
    setItems(a.ok ? a.data.items : []); setNotes(b.ok ? b.data.items : []);
    if (a.ok) { await mfetch('me/inbox/read', { method: 'POST' }); await mfetch('me/notifications/read', { method: 'POST' }); reload(); }
  }, [reload]);
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const send = async (m) => { const r = await mfetch(`me/applications/${m.application_id}/message`, { method: 'POST', body: { body: reply[m.id] } }); if (r.ok) { setReply((x) => ({ ...x, [m.id]: '' })); load(); } };
  if (!items) return <p className="text-sm text-muted-foreground">{t('loading')}</p>;
  return (
    <div className="space-y-6">
      <section><h2 className="mb-2 text-lg font-semibold">{t('inbox.notifications')}</h2>
        {notes.length === 0 ? <p className="text-sm text-muted-foreground">{t('inbox.noNotifications')}</p> : <ul className="space-y-2">{notes.map((n) => <li key={n.id} className="rounded-xl border border-border/60 bg-card/40 p-3 text-sm"><span className="font-medium">{t(`notify.${n.type}`, { title: n.params?.title || '', reason: n.params?.reason || '' })}</span><span className="ml-2 text-xs text-muted-foreground">{fmtDate(n.at, locale)}</span></li>)}</ul>}
      </section>
      <section><h2 className="mb-2 text-lg font-semibold">{t('tab.inbox')}</h2>
        {items.length === 0 ? <p className="text-sm text-muted-foreground">{t('inbox.none')}</p> : <ul className="space-y-3">{items.map((m) => (
          <li key={m.id} className={`rounded-2xl border p-4 ${m.mine ? 'border-border/40 bg-card/30' : 'border-border/70 bg-card/60'}`}>
            <p className="text-xs text-muted-foreground">{m.mine ? t('inbox.you') : (m.kind === 'public' ? `${m.name} (${t('inbox.visitor')})` : t('inbox.them'))} · {fmtDate(m.at, locale)}</p>
            <p className="mt-1 whitespace-pre-wrap break-words text-sm">{m.body}</p>
            {m.reply_to && <p className="mt-1 text-xs text-muted-foreground">{t('inbox.replyTo')}: {m.reply_to}</p>}
            {m.application_id && !m.mine && <div className="mt-2 flex gap-2"><input className={input} aria-label={t('inbox.reply')} placeholder={t('inbox.reply')} maxLength={1500} value={reply[m.id] || ''} onChange={(e) => setReply((x) => ({ ...x, [m.id]: e.target.value }))} /><button className={btn} onClick={() => send(m)}>{t('apps.send')}</button></div>}
          </li>))}</ul>}
      </section>
    </div>
  );
}

function ServersTab({ guilds, unavailable, reload }) {
  const t = useTranslations('collab');
  const [queue, setQueue] = useState({});
  const [reason, setReason] = useState({});
  const [msg, setMsg] = useState('');
  const owners = guilds.filter((g) => g.owner);
  const loadQ = useCallback(async (gid) => { const r = await mfetch(`server/${gid}/queue`); if (r.ok) setQueue((q) => ({ ...q, [gid]: r.data.items })); }, []);
  useEffect(() => { owners.forEach((g) => { if (g.require_approval) loadQ(g.id); }); }, [guilds]); // eslint-disable-line react-hooks/exhaustive-deps
  const toggle = async (g) => { const r = await mfetch(`server/${g.id}/settings`, { method: 'PUT', body: { require_approval: !g.require_approval } }); setMsg(r.ok ? '' : errText(t, r.data)); await reload(); };
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
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={g.require_approval} onChange={() => toggle(g)} />{t('servers.require')}</label></div>
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

function PrefsTab({ cats }) {
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
      <div className="flex items-center gap-3"><button className={btnMain} onClick={save}>{t('prefs.save')}</button>{saved && <span role="status" className="text-sm text-emerald-300">{t('editor.saved')}</span>}</div>
    </div>
  );
}

export default function CollabHubClient() {
  const t = useTranslations('collab');
  const [tab, setTab] = useState('requests');
  const [ov, setOv] = useState(null);
  const [gl, setGl] = useState({ guilds: [], unavailable: false });
  const [cats, setCats] = useState([]);
  const [auth, setAuth] = useState('loading');
  const reload = useCallback(async () => {
    const r = await mfetch('me/overview');
    if (r.status === 401) { setAuth('out'); return; }
    if (r.ok) { setOv(r.data); setAuth('in'); }
    const g = await mfetch('me/guilds'); if (g.ok) setGl(g.data);
  }, []);
  useEffect(() => { reload(); mfetch('categories').then((r) => { if (r.ok) setCats(r.data.categories); }); }, [reload]);
  const tabs = [
    { id: 'requests', icon: Briefcase }, { id: 'applications', icon: Send }, { id: 'inbox', icon: Inbox }, { id: 'servers', icon: ServerIcon }, { id: 'prefs', icon: SlidersHorizontal },
  ];
  return (
    <div className="min-h-screen">
      <TopNav />
      <main id="main-content" className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
        <h1 className="mb-1 flex items-center gap-3 text-3xl font-black"><ListChecks className="h-7 w-7 text-[#e6cd8c]" aria-hidden="true" />{t('hub.title')}</h1>
        <p className="mb-6 text-sm text-muted-foreground">{t('hub.text')} <Link href="/collab" className="underline underline-offset-4">{t('browseAll')}</Link></p>
        {auth === 'out' ? (
          <div className="rounded-2xl border border-border/60 p-8 text-center"><a href="/api/auth/login?next=%2Fdashboard%2Fcollab" className={btnMain}>{t('apply.login')}</a></div>
        ) : auth === 'loading' ? <p className="text-sm text-muted-foreground">{t('loading')}</p> : (
          <>
            <div role="tablist" aria-label={t('hub.title')} className="mk-scroll mb-6 flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
              {tabs.map(({ id, icon: Icon }) => (
                <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium ${tab === id ? 'border-[#e6cd8c]/70 bg-[#e6cd8c]/10' : 'border-border/60 hover:border-[#e6cd8c]/40'}`}>
                  <Icon className="h-4 w-4" aria-hidden="true" />{t(`tab.${id}`)}{id === 'inbox' && ov?.unread > 0 && <span className="ml-1 rounded-full bg-[#e6cd8c] text-[#1a1208] px-1.5 text-[10px]">{ov.unread}</span>}
                </button>))}
            </div>
            <div role="tabpanel">
              {tab === 'requests' && ov && <MyRequests data={ov} reload={reload} cats={cats} guilds={gl.guilds} />}
              {tab === 'applications' && ov && <MyApplications data={ov} reload={reload} />}
              {tab === 'inbox' && <InboxTab reload={reload} />}
              {tab === 'servers' && <ServersTab guilds={gl.guilds} unavailable={gl.unavailable} reload={reload} />}
              {tab === 'prefs' && <PrefsTab cats={cats} />}
            </div>
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}

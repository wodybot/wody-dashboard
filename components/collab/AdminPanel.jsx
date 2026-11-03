'use client';
import { useCallback, useEffect, useState } from 'react';
import { mfetch } from './client';
import { REJECT_REASONS, DEFAULT_SETTINGS } from '@/lib/collab/constants';

const input = 'w-full rounded-md border border-input bg-background px-3 py-2 text-sm';
const btn = 'rounded-md border border-border/70 px-3 py-1.5 text-sm font-medium hover:border-[#e6cd8c]/60 disabled:opacity-50';
const btnMain = 'rounded-md bg-[#e6cd8c] text-[#1a1208] px-3 py-1.5 text-sm font-semibold hover:bg-[#f3e1b0] disabled:opacity-50';
const when = (iso) => (iso ? new Date(iso).toLocaleString() : '-');

const REASON_LABEL = { money: 'Money detected', guard_error: 'Automatic check failed', suspicious_content: 'Suspicious content', edit_policy: 'Edit review policy', attachments: 'Has attachments', reports: 'Reports from users' };

function Field({ label, children }) { return <div><div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div><div className="mt-0.5 whitespace-pre-wrap break-words text-sm">{children || '-'}</div></div>; }

function Content({ c }) {
  if (!c) return null;
  return (
    <div className="space-y-3">
      <Field label="Title">{c.title}</Field>
      <Field label="Category / language">{`${c.category} / ${c.language}`}</Field>
      <Field label="Description">{c.description}</Field>
      <Field label="Desired outcome">{c.outcome}</Field>
      <Field label="Provider requirements">{c.requirements}</Field>
      <Field label="Tags">{(c.tags || []).join(', ')}</Field>
      <Field label="Links">{(c.links || []).join('\n')}</Field>
      <Field label="Questions">{(c.questions || []).join('\n')}</Field>
      <Field label="Deadline">{c.deadline}</Field>
      <Field label="Attachments">{`${(c.attachments || []).length} image(s)`}</Field>
      <Field label="Public contact">{c.public_contact ? 'enabled' : 'off'}</Field>
    </div>
  );
}

function Detail({ id, onDone, canSettings }) {
  const [d, setD] = useState(null);
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => { const r = await mfetch(`staff/request/${id}`); setD(r.ok ? r.data : { error: true }); }, [id]);
  useEffect(() => { load(); }, [load]);
  if (!d) return <p className="text-sm text-muted-foreground">Loading...</p>;
  if (d.error) return <p className="text-sm text-destructive">Could not load this request.</p>;
  const suspended = d.status === 'suspended';
  const openReports = (d.reports || []).filter((x) => x.status === 'open').length;
  const falseAlarm = openReports > 0 || (suspended && d.suspended?.reason === 'reports');
  const versionId = suspended ? d.live_version_id : d.version_id;
  async function act(action) {
    setBusy(true); setMsg('');
    const r = await mfetch('staff/decide', { method: 'POST', body: { request_id: d.id, version_id: versionId, action, reason, note } });
    setBusy(false);
    if (r.ok) { setMsg(`Done: ${r.data.outcome}`); await load(); onDone?.(); } else setMsg(r.data?.error === 'version_outdated' ? 'The author changed the request. Reload and review the new version.' : `Error: ${r.data?.error || 'failed'}`);
  }
  async function restore() {
    setBusy(true); setMsg('');
    const r = await mfetch('staff/restore', { method: 'POST', body: { request_id: d.id } });
    setBusy(false);
    setMsg(r.ok ? 'Restored.' : r.data?.error === 'recheck_flagged' ? `Not restored: the live text still triggers the check (${(r.data.signals || []).map((s) => s.rule).join(', ')}).` : `Error: ${r.data?.error}`);
    await load(); onDone?.();
  }
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="rounded-full border border-border/60 px-2 py-0.5 text-xs">{d.status}{d.pending_state ? ` / edit ${d.pending_state}` : ''}</span>
        <span className="rounded-full border border-border/60 px-2 py-0.5 text-xs">queue: {d.queue || 'none'}</span>
        <span className="rounded-full border border-border/60 px-2 py-0.5 text-xs">risk {d.risk}</span>
        {d.escalated && <span className="rounded-full border border-red-400/50 px-2 py-0.5 text-xs text-red-300">escalated</span>}
        {(d.reasons || []).map((r) => <span key={r} className="rounded-full border border-amber-400/40 px-2 py-0.5 text-xs text-amber-200">{REASON_LABEL[r] || r}</span>)}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Author">{`${d.author?.name} (${d.author?.id})`}</Field>
        <Field label="Origin server">{d.origin_guild_name ? `${d.origin_guild_name} (${d.origin_guild_id})` : 'none'}</Field>
        <Field label="Queued">{when(d.queued_at)}</Field>
        <Field label="Version analysed">{d.version_id || '-'}</Field>
      </div>
      {d.suspended && <p className="rounded-md border border-red-400/40 p-3 text-sm">Suspended: {d.suspended.reason} ({when(d.suspended.at)})</p>}

      <section><h4 className="mb-2 font-semibold">Automatic check {d.check ? `(${d.check.version}${d.check.false_positive ? ', marked false positive' : ''})` : ''}</h4>
        {!d.check ? <p className="text-sm text-muted-foreground">No check stored.</p> : (
          <>
            {d.check.error && <p className="mb-2 text-sm text-destructive">Check error: {d.check.error}</p>}
            <p className="mb-2 text-xs text-muted-foreground">AI: {d.check.ai?.used ? (d.check.ai.ok ? 'used' : 'configured, failed') : 'not configured'}</p>
            {d.check.signals?.length ? <ul className="space-y-1">{d.check.signals.map((s, i) => <li key={i} className="rounded-md bg-muted/40 p-2 text-xs"><b>{s.rule}</b> in <code>{s.field}</code> (risk {s.risk}): {s.excerpt}</li>)}</ul> : <p className="text-sm text-muted-foreground">No signals.</p>}
          </>)}
      </section>

      <section><h4 className="mb-2 font-semibold">{d.live ? 'Analysed version (pending)' : 'Analysed request'}</h4><Content c={d.analysed} /></section>
      {d.live && (
        <section><h4 className="mb-2 font-semibold">Changes against the live version</h4>
          {d.diff.length === 0 ? <p className="text-sm text-muted-foreground">No differences.</p> : <ul className="space-y-2">{d.diff.map((x) => <li key={x.field} className="rounded-md bg-muted/40 p-2 text-xs"><b>{x.field}</b><div className="text-red-300">- {JSON.stringify(x.before)}</div><div className="text-emerald-300">+ {JSON.stringify(x.after)}</div></li>)}</ul>}
          <details className="mt-2"><summary className="cursor-pointer text-sm">Live version</summary><div className="mt-2"><Content c={d.live} /></div></details>
        </section>)}

      <section className="rounded-xl border border-border/60 p-4">
        <h4 className="mb-2 font-semibold">Decision</h4>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><label className="text-xs text-muted-foreground" htmlFor="mk-reason">Reason (shown to the author)</label>
            <input id="mk-reason" list="mk-reasons" className={input} maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} /><datalist id="mk-reasons">{REJECT_REASONS.map((r) => <option key={r} value={r.replace(/_/g, ' ')} />)}</datalist></div>
          <div><label className="text-xs text-muted-foreground" htmlFor="mk-note">Internal note</label><input id="mk-note" className={input} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} /></div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {!suspended && <><button className={btnMain} disabled={busy || d.queue !== 'global'} onClick={() => act('approve')}>Approve and publish</button>
            <button className={btn} disabled={busy || (d.queue !== 'global' && !falseAlarm)} onClick={() => act('false_positive')}>{falseAlarm && d.queue !== 'global' ? 'Mark false positive (dismiss reports)' : 'Mark false positive and approve'}</button>
            <button className={btn} disabled={busy || d.queue !== 'global'} onClick={() => act('changes')}>Request changes</button></>}
          {suspended && falseAlarm && <button className={btnMain} disabled={busy} onClick={() => act('false_positive')}>Mark false positive and restore</button>}
          <button className={btn} disabled={busy || (d.queue !== 'global')} onClick={() => act('reject')}>Reject</button>
          <button className={btn} disabled={busy || suspended || !d.live_version_id && !d.version_id} onClick={() => act('suspend')}>Suspend</button>
          <button className={btn} disabled={busy} onClick={() => act('escalate')}>Escalate</button>
          {suspended && <button className={btnMain} disabled={busy} onClick={restore}>Restore after re-check</button>}
        </div>
        {openReports > 0 && <p className="mt-3 text-xs text-amber-200">{openReports} open report{openReports === 1 ? '' : 's'} on this post. If they are wrong, mark it as a false positive: the reports are closed and the post stays live.</p>}
        {!suspended && d.queue !== 'global' && <p className="mt-3 text-xs text-muted-foreground">Approve, Mark false positive, Request changes and Reject only apply to a request that is waiting for a decision. This one is not waiting: it is already decided (for example live after a restore, or a single report that did not hold it). Use Suspend to take it down, or Escalate to send it to the queue.</p>}
        {msg && <p role="status" className="mt-2 text-sm">{msg}</p>}
      </section>

      <section><h4 className="mb-2 font-semibold">Versions</h4>
        <ul className="space-y-1 text-xs">{d.versions.map((v) => <li key={v.id}>v{v.n} - {v.state} - {when(v.at)} - <code>{v.hash}</code> - {v.title}</li>)}</ul></section>
      <section><h4 className="mb-2 font-semibold">Decision history</h4>
        {d.decisions.length === 0 ? <p className="text-sm text-muted-foreground">Nothing yet.</p> : <ul className="space-y-1 text-xs">{d.decisions.map((x, i) => <li key={i}>{when(x.at)} - {x.scope}.{x.action} by {x.actor}{x.reason ? ` - ${x.reason}` : ''}{x.note ? ` (${x.note})` : ''}</li>)}</ul>}</section>
      {d.reports.length > 0 && <section><h4 className="mb-2 font-semibold">Reports</h4><ul className="space-y-1 text-xs">{d.reports.map((r, i) => <li key={i}>{when(r.at)} - {r.reason} - {r.status}{r.details ? ` - ${r.details}` : ''} (reporter {r.reporter})</li>)}</ul></section>}
    </div>
  );
}

function Settings({ initial, reload }) {
  const [s, setS] = useState({ ...DEFAULT_SETTINGS, ...initial });
  const [msg, setMsg] = useState('');
  const save = async () => { const r = await mfetch('staff/settings', { method: 'PUT', body: s }); setMsg(r.ok ? 'Saved.' : `Error: ${r.data?.error}`); if (r.ok) reload(); };
  const toggle = (k, label, hint) => <label key={k} className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={Boolean(s[k])} onChange={(e) => setS((x) => ({ ...x, [k]: e.target.checked }))} /><span>{label}<span className="block text-xs text-muted-foreground">{hint}</span></span></label>;
  return (
    <div className="max-w-xl space-y-4">
      {toggle('submissions_open', 'Accept new requests', 'Turn off to pause all publishing and edits.')}
      {toggle('edits_need_review', 'Every edit of a live request needs review', 'Off: only edits that trigger the money check are held.')}
      {toggle('review_attachments', 'Requests with images need review', 'Off: images are published after the automatic check.')}
      {toggle('public_contact_enabled', 'Allow the optional public contact form', 'Master switch. Authors still opt in per request.')}
      {toggle('ai_moderation', 'Use the AI check when a provider is configured', 'Set COLLAB_AI_URL and COLLAB_AI_KEY on the server. The AI can only add flags.')}
      <div className="grid gap-3 sm:grid-cols-2">
        <div><label className="text-xs text-muted-foreground" htmlFor="mk-life">Days a request stays live</label><input id="mk-life" type="number" min={1} max={365} className={input} value={s.lifetime_days} onChange={(e) => setS((x) => ({ ...x, lifetime_days: Number(e.target.value) }))} /></div>
        <div><label className="text-xs text-muted-foreground" htmlFor="mk-inact">Days an inactive request waits before it is deleted</label><input id="mk-inact" type="number" min={1} max={90} className={input} value={s.inactive_days ?? 7} onChange={(e) => setS((x) => ({ ...x, inactive_days: Number(e.target.value) }))} /></div>
        <div><label className="text-xs text-muted-foreground" htmlFor="mk-thr">Reports that suspend a request</label><input id="mk-thr" type="number" min={1} max={20} className={input} value={s.report_threshold} onChange={(e) => setS((x) => ({ ...x, report_threshold: Number(e.target.value) }))} /></div>
      </div>
      <div className="flex items-center gap-3"><button className={btnMain} onClick={save}>Save settings</button>{msg && <span role="status" className="text-sm">{msg}</span>}</div>
    </div>
  );
}

function Categories() {
  const [rows, setRows] = useState(null);
  const [f, setF] = useState({ slug: '', en: '', ro: '' });
  const [msg, setMsg] = useState('');
  const load = useCallback(async () => { const r = await mfetch('staff/categories'); setRows(r.ok ? r.data.items : []); }, []);
  useEffect(() => { load(); }, [load]);
  const add = async () => { const r = await mfetch('staff/categories', { method: 'POST', body: { slug: f.slug, names: { en: f.en, ro: f.ro || f.en } } }); setMsg(r.ok ? 'Added. Other languages use the English name until you edit them.' : `Error: ${r.data?.error || 'failed'}`); if (r.ok) { setF({ slug: '', en: '', ro: '' }); load(); } };
  const toggle = async (c) => { await mfetch(`staff/categories/${c.slug}`, { method: 'PUT', body: { enabled: !c.enabled } }); load(); };
  return (
    <div className="space-y-4">
      {!rows ? <p className="text-sm text-muted-foreground">Loading...</p> : <ul className="divide-y divide-border/50 rounded-xl border border-border/60">{rows.map((c) => <li key={c.slug} className="flex items-center justify-between gap-2 p-3 text-sm"><span>{c.names?.en} <code className="text-xs text-muted-foreground">{c.slug}</code></span><label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={c.enabled !== false} onChange={() => toggle(c)} />enabled</label></li>)}</ul>}
      <div className="grid gap-2 sm:grid-cols-4"><input className={input} placeholder="slug_like_this" value={f.slug} onChange={(e) => setF({ ...f, slug: e.target.value })} /><input className={input} placeholder="English name" value={f.en} onChange={(e) => setF({ ...f, en: e.target.value })} /><input className={input} placeholder="Romanian name" value={f.ro} onChange={(e) => setF({ ...f, ro: e.target.value })} /><button className={btnMain} onClick={add}>Add category</button></div>
      {msg && <p role="status" className="text-sm">{msg}</p>}
    </div>
  );
}

export default function CollabAdmin({ ownerOnly = true }) {
  const [tab, setTab] = useState('queue');
  const [ov, setOv] = useState(null);
  const [items, setItems] = useState(null);
  const [picked, setPicked] = useState(null);
  const [filter, setFilter] = useState('');
  const [audit, setAudit] = useState(null);
  const [reports, setReports] = useState(null);
  const loadOv = useCallback(async () => { const r = await mfetch('staff/overview'); if (r.ok) setOv(r.data); }, []);
  const loadList = useCallback(async () => {
    const r = await mfetch(tab === 'queue' ? 'staff/queue' : `staff/list/${filter}`);
    setItems(r.ok ? r.data.items : []);
  }, [tab, filter]);
  useEffect(() => { loadOv(); }, [loadOv]);
  useEffect(() => { if (tab === 'queue' || tab === 'all') { setItems(null); loadList(); } }, [tab, filter, loadList]);
  useEffect(() => { if (tab === 'audit') mfetch('staff/audit').then((r) => setAudit(r.ok ? r.data.items : [])); if (tab === 'reports') mfetch('staff/reports').then((r) => setReports(r.ok ? r.data.items : [])); }, [tab]);
  const tabs = [['queue', `Moderation queue${ov ? ` (${ov.queue})` : ''}`], ['reports', `Reports${ov ? ` (${ov.reports})` : ''}`], ['all', 'All requests'], ...(ownerOnly ? [['settings', 'Settings'], ['categories', 'Categories']] : []), ['audit', 'Audit log']];
  if (picked) return <div><button className={`${btn} mb-4`} onClick={() => { setPicked(null); loadList(); loadOv(); }}>Back to list</button><Detail id={picked} onDone={loadOv} /></div>;
  return (
    <div className="space-y-4">
      {ov && <p className="text-sm text-muted-foreground">{Object.entries(ov.by_status).map(([k, v]) => `${k}: ${v}`).join(' | ') || 'No requests yet'} | applications: {ov.applications} | suspended: {ov.suspended}</p>}
      <div role="tablist" className="flex flex-wrap gap-2">{tabs.map(([id, label]) => <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={`${btn} ${tab === id ? 'border-[#e6cd8c]/70 bg-[#e6cd8c]/10' : ''}`}>{label}</button>)}</div>
      {(tab === 'queue' || tab === 'all') && (
        <>
          {tab === 'all' && <select className={`${input} max-w-xs`} value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Status filter"><option value="">All statuses</option>{['draft', 'pending_review', 'pending_server', 'needs_changes', 'published', 'rejected', 'suspended', 'expired'].map((s) => <option key={s} value={s}>{s}</option>)}</select>}
          {!items ? <p className="text-sm text-muted-foreground">Loading...</p> : items.length === 0 ? <p className="rounded-xl border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground">{tab === 'queue' ? 'The queue is empty.' : 'Nothing found.'}</p> : (
            <ul className="space-y-2">{items.map((it) => (
              <li key={it.id}><button type="button" onClick={() => setPicked(it.id)} className="w-full rounded-xl border border-border/60 bg-card/50 p-3 text-left hover:border-[#e6cd8c]/50">
                <span className="block font-medium">{it.title}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">{it.author?.name} | {when(it.queued_at || it.updated_at)}{it.reasons ? ` | ${it.reasons.map((r) => REASON_LABEL[r] || r).join(', ')} | risk ${it.risk}` : ` | ${it.status}`}{it.edit ? ' | edit' : ''}{it.escalated ? ' | escalated' : ''}</span>
              </button></li>))}</ul>)}
        </>)}
      {tab === 'reports' && (!reports ? <p className="text-sm text-muted-foreground">Loading...</p> : reports.length === 0 ? <p className="text-sm text-muted-foreground">No open reports.</p> : <ul className="space-y-2">{reports.map((r) => <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/60 p-3 text-sm"><span>{r.reason}: {r.details || '-'} <span className="text-xs text-muted-foreground">({when(r.at)})</span></span><span className="flex gap-2"><button className={btn} onClick={() => setPicked(r.request_id)}>Open</button><button className={btn} onClick={async () => { await mfetch(`staff/reports/${r.id}/dismiss`, { method: 'POST' }); setReports(null); mfetch('staff/reports').then((x) => setReports(x.ok ? x.data.items : [])); loadOv(); }}>Dismiss</button></span></li>)}</ul>)}
      {tab === 'settings' && ov && <Settings initial={ov.settings} reload={loadOv} />}
      {tab === 'categories' && <Categories />}
      {tab === 'audit' && (!audit ? <p className="text-sm text-muted-foreground">Loading...</p> : <ul className="space-y-1 text-xs">{audit.map((a, i) => <li key={i}>{when(a.at)} - {a.actor} - {a.action} - {a.target}</li>)}</ul>)}
    </div>
  );
}

'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

const STATUSES = ['open', 'reviewing', 'appealed', 'removed', 'restricted', 'suspended', 'blocked', 'dismissed'];
const ACTIONS = [['review', 'Mark as reviewing'], ['dismiss', 'Dismiss'], ['remove_content', 'Remove image and music'], ['restrict_uploads', 'Restrict uploads (30 days)'], ['suspend_customization', 'Suspend customization'], ['suspend_account', 'Suspend account (30 days)'], ['block_account', 'Block account'], ['unblock_account', 'Unblock account'], ['restore', 'Restore']];

async function call(path, init) {
  try {
    const r = await fetch(`/api/${path}`, { cache: 'no-store', ...init, headers: init?.body ? { 'Content-Type': 'application/json' } : undefined });
    return { ok: r.ok, data: await r.json().catch(() => ({})) };
  } catch {
    return { ok: false, data: {} };
  }
}

function AccountForm({ onDone }) {
  const [target, setTarget] = useState('');
  const [action, setAction] = useState('suspend_account');
  const [days, setDays] = useState(30);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    if (!target.trim() || busy) return;
    if (action === 'block_account' && !window.confirm('Block this Discord account from using profile customization and public profile features?')) return;
    setBusy(true);
    const r = await call('owner/account-moderation', { method: 'POST', body: JSON.stringify({ target, action, days, note }) });
    setBusy(false);
    if (r.ok) { toast.success(`Done: ${r.data.status}`); setTarget(''); setNote(''); onDone(); } else toast.error(r.data?.error === 'not_found' ? 'No Wody profile found for that Discord ID or username.' : 'Could not apply the action.');
  };
  return (
    <Card className="space-y-3 border-border/60 p-4 text-sm">
      <h3 className="font-bold">Suspend or block a Discord account</h3>
      <form onSubmit={submit} className="grid gap-2 sm:grid-cols-2">
        <input aria-label="Discord ID or profile username" className="rounded-lg border border-border/60 bg-background/40 p-2 text-xs" placeholder="Discord ID or profile username" maxLength={40} value={target} onChange={(e) => setTarget(e.target.value)} />
        <select aria-label="Action" className="rounded-lg border border-border/60 bg-background/40 p-2 text-xs" value={action} onChange={(e) => setAction(e.target.value)}>
          <option value="suspend_account">Suspend (temporary)</option>
          <option value="block_account">Block (permanent until unblocked)</option>
          <option value="unblock_account">Unblock / lift suspension</option>
        </select>
        {action === 'suspend_account' ? <input aria-label="Days" type="number" min={1} max={365} className="rounded-lg border border-border/60 bg-background/40 p-2 text-xs" value={days} onChange={(e) => setDays(e.target.value)} /> : null}
        <input aria-label="Note" className="rounded-lg border border-border/60 bg-background/40 p-2 text-xs sm:col-span-2" placeholder="Reason (kept in the history)" maxLength={800} value={note} onChange={(e) => setNote(e.target.value)} />
        <div className="sm:col-span-2"><Button type="submit" size="sm" disabled={busy || !target.trim()}>{busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : null}Apply</Button></div>
      </form>
      <p className="text-xs text-muted-foreground">Blocked or suspended accounts cannot edit their profile page, profile card or public profile data, and their public profile is hidden. The action is stored with the date and your note.</p>
    </Card>
  );
}

export default function ReportsAdmin() {
  const [status, setStatus] = useState('open');
  const [items, setItems] = useState(null);
  const [busy, setBusy] = useState('');
  const [notes, setNotes] = useState({});
  const load = useCallback(async () => {
    setItems(null);
    const r = await call(`owner/content-reports?status=${status}`);
    setItems(r.ok ? r.data.items || [] : []);
  }, [status]);
  useEffect(() => { load(); }, [load]);
  const act = async (id, action) => {
    setBusy(id + action);
    const r = await call(`owner/content-reports/${id}`, { method: 'POST', body: JSON.stringify({ action, note: notes[id] || '' }) });
    setBusy('');
    if (r.ok) { toast.success(`Done: ${r.data.status}`); load(); } else toast.error('Could not apply the action.');
  };
  return (
    <div className="space-y-4">
      <AccountForm onDone={load} />
      <div className="flex flex-wrap items-center gap-2">
        {STATUSES.map((s) => <Button key={s} size="sm" variant={status === s ? 'default' : 'outline'} onClick={() => setStatus(s)}>{s}</Button>)}
      </div>
      {items === null ? <Loader2 className="h-5 w-5 animate-spin" aria-label="Loading" /> : items.length === 0 ? <p className="text-sm text-muted-foreground">No reports with this status.</p> : items.map((r) => (
        <Card key={r.id} className="space-y-2 border-border/60 p-4 text-sm">
          <div className="flex flex-wrap items-center gap-2"><b>{r.kind}</b><span className="text-muted-foreground">on @{r.target_username}</span><span className="rounded-full border border-border px-2 py-0.5 text-xs">{r.status}</span><span className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</span></div>
          <p className="whitespace-pre-wrap">{r.reason}</p>
          {r.claimant ? <p className="text-xs text-muted-foreground">Claimant: {r.claimant.name} ({r.claimant.email}). Work: {r.claimant.work}{r.claimant.work_url ? ` (${r.claimant.work_url})` : ''}</p> : null}
          {r.appeal ? <p className="rounded-lg border border-sky-400/30 bg-sky-400/5 p-2 text-xs">Appeal: {r.appeal.message}</p> : null}
          <textarea aria-label="Decision note" className="min-h-14 w-full rounded-lg border border-border/60 bg-background/40 p-2 text-xs" placeholder="Decision note (kept in the history)" maxLength={800} value={notes[r.id] || ''} onChange={(e) => setNotes((n) => ({ ...n, [r.id]: e.target.value }))} />
          <div className="flex flex-wrap gap-2">{ACTIONS.map(([a, label]) => <Button key={a} size="sm" variant="outline" disabled={Boolean(busy)} onClick={() => act(r.id, a)}>{busy === r.id + a ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}{label}</Button>)}</div>
        </Card>
      ))}
    </div>
  );
}

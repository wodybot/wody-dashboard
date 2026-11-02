'use client';
// Owner Panel > Panel Access. Owner only: grant or revoke access to the community
// management part of the Owner Panel by Discord user ID. The server enforces every
// rule (owner only, Discord lookup, single-use challenge, typed confirmations).
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, ShieldCheck, Trash2, UserCheck, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { proxiedImageUrl } from '@/lib/utils';
import { auditTitle, auditIcon, auditRole, auditOutcome, auditDetail } from '@/lib/audit-labels';

async function call(url, options) {
  try {
    const res = await fetch(url, options);
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, data };
  } catch {
    return { ok: false, data: { error: 'network' } };
  }
}
const post = (url, body) => call(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

const ERRORS = {
  invalid_id: 'That is not a valid Discord user ID.',
  is_owner: 'The owner already has full access.',
  user_not_found: 'Discord does not know this user.',
  is_bot: 'Bot accounts cannot be given access.',
  already_granted: 'This user already has access.',
  limit_reached: 'The maximum number of delegates is reached.',
  challenge_invalid: 'The verification expired. Verify the user again.',
  confirm_id_mismatch: 'The confirmation ID does not match.',
  confirm_phrase_mismatch: 'The confirmation phrase is not correct.',
  rate_limited: 'Too many attempts. Try again in a minute.',
  forbidden: 'Only the owner can do this.',
};
const msg = (d) => ERRORS[d?.error] || 'Something went wrong.';
const fmt = (v) => (v ? new Date(v).toLocaleString() : '-');

export default function OwnerAccess() {
  const [state, setState] = useState({ loading: true, data: null, error: false });
  const [id, setId] = useState('');
  const [candidate, setCandidate] = useState(null);
  const [days, setDays] = useState(30);
  const [confirmId, setConfirmId] = useState('');
  const [phrase, setPhrase] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true }));
    const r = await call('/api/owner/access');
    setState({ loading: false, data: r.ok ? r.data : null, error: !r.ok });
  }, []);
  useEffect(() => { load(); }, [load]);

  function reset() { setId(''); setCandidate(null); setConfirmId(''); setPhrase(''); }

  async function verify() {
    setBusy(true);
    const r = await post('/api/owner/access/verify', { user_id: id.trim() });
    setBusy(false);
    if (!r.ok) return toast.error(msg(r.data));
    setCandidate({ ...r.data.user, token: r.data.token });
    setConfirmId(''); setPhrase('');
  }
  async function grant() {
    setBusy(true);
    const r = await post('/api/owner/access/grant', { user_id: candidate.id, token: candidate.token, days, confirm_id: confirmId.trim(), confirm_phrase: phrase.trim() });
    setBusy(false);
    if (!r.ok) {
      if (r.data?.error === 'challenge_invalid') reset();
      return toast.error(msg(r.data));
    }
    toast.success('Access granted');
    reset(); load();
  }
  async function revoke(userId) {
    if (!window.confirm('Revoke access for this user now?')) return;
    const r = await post('/api/owner/access/revoke', { user_id: userId });
    if (!r.ok) return toast.error(msg(r.data));
    toast.success('Access revoked');
    load();
  }

  const d = state.data;
  const phraseNeeded = d?.phrase || 'GRANT ACCESS';
  return (
    <div className="space-y-6">
      <Card className="p-4 sm:p-5 bg-card/60 border-border/50 space-y-4">
        <div>
          <div className="flex items-center gap-2 font-semibold"><ShieldCheck className="w-4 h-4 text-[#e08a4e]" /> Give access to the community management part</div>
          <p className="text-xs text-muted-foreground mt-1">
            A delegate sees only Community Discovery in the Owner Panel. Never license keys, premium, bans, or this page. Access expires on its own and can be revoked at any time. Every sign in and every action is posted to the audit channel.
          </p>
        </div>
        {!candidate ? (
          <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
            <div className="flex-1 min-w-0">
              <Label htmlFor="delegate-id" className="text-xs">Discord user ID</Label>
              <Input id="delegate-id" inputMode="numeric" autoComplete="off" value={id} onChange={(e) => setId(e.target.value.replace(/\D/g, '').slice(0, 25))} placeholder="123456789012345678" />
            </div>
            <Button onClick={verify} disabled={busy || id.length < 15} className="sm:w-40">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <><UserCheck className="w-4 h-4 mr-2" /> Verify user</>}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-background/50 p-3">
              {candidate.avatar_url && <img src={proxiedImageUrl(candidate.avatar_url)} alt="" width="40" height="40" className="w-10 h-10 rounded-full" />}
              <div className="min-w-0">
                <div className="font-semibold truncate">{candidate.username}</div>
                <div className="text-xs text-muted-foreground truncate">@{candidate.handle} - {candidate.id}</div>
              </div>
            </div>
            <div className="grid sm:grid-cols-3 gap-3">
              <div>
                <Label htmlFor="delegate-days" className="text-xs">Access lasts</Label>
                <select id="delegate-days" value={days} onChange={(e) => setDays(Number(e.target.value))} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                  {(d?.expiry_choices || [1, 7, 30, 90]).map((n) => <option key={n} value={n}>{n} {n === 1 ? 'day' : 'days'}</option>)}
                </select>
              </div>
              <div>
                <Label htmlFor="delegate-confirm-id" className="text-xs">Type the ID again</Label>
                <Input id="delegate-confirm-id" inputMode="numeric" autoComplete="off" value={confirmId} onChange={(e) => setConfirmId(e.target.value.replace(/\D/g, '').slice(0, 25))} />
              </div>
              <div>
                <Label htmlFor="delegate-phrase" className="text-xs">Type: {phraseNeeded}</Label>
                <Input id="delegate-phrase" autoComplete="off" value={phrase} onChange={(e) => setPhrase(e.target.value)} />
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={grant} disabled={busy || confirmId !== candidate.id || phrase.trim() !== phraseNeeded}>
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Grant access'}
              </Button>
              <Button variant="outline" onClick={reset} disabled={busy}>Cancel</Button>
            </div>
            <p className="text-[11px] text-muted-foreground">The verification is valid for 5 minutes and can be used once.</p>
          </div>
        )}
      </Card>

      <Card className="p-4 sm:p-5 bg-card/60 border-border/50">
        <div className="flex items-center justify-between mb-3">
          <div className="font-semibold">People with access {d ? `(${d.delegates.length}/${d.max})` : ''}</div>
          <Button size="sm" variant="ghost" onClick={load} aria-label="Refresh"><RefreshCw className="w-4 h-4" /></Button>
        </div>
        {state.loading && !d ? <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          : state.error ? <p className="text-sm text-muted-foreground">Could not load the list.</p>
          : !d?.delegates.length ? <p className="text-sm text-muted-foreground">Nobody has delegated access right now.</p>
          : (
            <ul className="divide-y divide-border/50">
              {d.delegates.map((p) => (
                <li key={p.user_id} className="flex items-center gap-3 py-2.5">
                  {p.avatar_url && <img src={proxiedImageUrl(p.avatar_url)} alt="" width="32" height="32" className="w-8 h-8 rounded-full" />}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{p.username || p.user_id}</div>
                    <div className="text-[11px] text-muted-foreground truncate">{p.user_id} - until {fmt(p.expires_at)}{p.expired ? ' (expired)' : ''}</div>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => revoke(p.user_id)}><Trash2 className="w-3.5 h-3.5 mr-1" /> Revoke</Button>
                </li>
              ))}
            </ul>
          )}
      </Card>

      <Card className="p-4 sm:p-5 bg-card/60 border-border/50">
        <div className="font-semibold mb-3">Recent activity</div>
        {!d?.audit?.length ? <p className="text-sm text-muted-foreground">No activity recorded yet.</p> : (
          <ul className="space-y-2 max-h-96 overflow-y-auto">
            {d.audit.map((a, i) => (
              <li key={i} className="flex gap-3 rounded-lg border border-border/40 bg-background/40 px-3 py-2.5">
                <span className="text-base leading-6 shrink-0" aria-hidden="true">{auditIcon(a.action, a.outcome)}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="text-sm font-medium">{auditTitle(a.action)}</span>
                    <span className={`rounded-full border px-2 py-px text-[10px] font-medium ${a.outcome === 'ok' ? 'border-emerald-500/40 text-emerald-400' : a.outcome === 'denied' ? 'border-red-500/40 text-red-400' : a.outcome === 'warn' ? 'border-amber-500/40 text-amber-400' : 'border-border text-muted-foreground'}`}>{auditOutcome(a.outcome)}</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">{a.actor_name || a.actor_id} · {auditRole(a.role)} · {fmt(a.at)}</div>
                  {(a.target || a.detail) && <div className="text-xs text-muted-foreground/90 mt-1 break-words">{[a.target, auditDetail(a.detail)].filter(Boolean).join(' · ')}</div>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

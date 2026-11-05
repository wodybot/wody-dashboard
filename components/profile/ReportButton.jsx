'use client';

import { useState } from 'react';
import { Flag, Loader2 } from 'lucide-react';
import { input, lab, btn, btnMain } from '@/components/collab/ProfileParts';

export default function ReportButton({ username, labels, complaintHref }) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState('image');
  const [reason, setReason] = useState('');
  const [state, setState] = useState({ busy: false, msg: null, ok: false });
  const send = async () => {
    setState({ busy: true, msg: null, ok: false });
    try {
      const res = await fetch('/api/content-report', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind, target: username, reason, location: 'profile_page' }) });
      const data = await res.json().catch(() => ({}));
      if (res.ok) setState({ busy: false, ok: true, msg: data.duplicate ? labels.dupe : labels.sent });
      else setState({ busy: false, ok: false, msg: labels.error });
    } catch {
      setState({ busy: false, ok: false, msg: labels.error });
    }
  };
  if (!open) return <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"><Flag className="h-3.5 w-3.5" aria-hidden="true" />{labels.button}</button>;
  return (
    <section aria-label={labels.title} className="rounded-2xl border border-border/60 bg-card/60 p-4 text-left">
      <h3 className="mb-3 text-sm font-bold">{labels.title}</h3>
      <label className={lab} htmlFor="rp-kind">{labels.kind}</label>
      <select id="rp-kind" className={input} value={kind} onChange={(e) => setKind(e.target.value)}>
        {['image', 'profile', 'prohibited', 'abuse'].map((k) => <option key={k} value={k}>{labels[k]}</option>)}
      </select>
      <label className={`${lab} mt-3`} htmlFor="rp-reason">{labels.reason}</label>
      <textarea id="rp-reason" className={`${input} min-h-20`} value={reason} maxLength={1500} onChange={(e) => setReason(e.target.value)} />
      <p className="mt-2 text-xs text-muted-foreground"><a href={complaintHref} className="text-[#e6cd8c] underline-offset-2 hover:underline">{labels.rights}</a></p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={send} disabled={state.busy || state.ok || reason.trim().length < 10} className={`${btnMain} disabled:opacity-50`}>{state.busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}{labels.send}</button>
        <button type="button" onClick={() => setOpen(false)} className={btn}>{labels.cancel}</button>
      </div>
      <p role="status" aria-live="polite" className={`mt-2 min-h-5 text-sm ${state.ok ? 'text-emerald-300' : 'text-red-300'}`}>{state.msg}</p>
    </section>
  );
}

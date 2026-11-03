'use client';
import { useState } from 'react';
import { ShieldCheck, Trash2 } from 'lucide-react';
import { mfetch } from './client';

export default function OwnerBar({ requestId, status }) {
  const [step, setStep] = useState(0);
  const [state, setState] = useState({ busy: false, msg: '', done: false });
  async function remove() {
    setState({ busy: true, msg: '', done: false });
    const r = await mfetch('staff/delete', { method: 'POST', body: { request_id: requestId } });
    if (r.ok) { setState({ busy: false, msg: '', done: true }); setTimeout(() => { window.location.href = '/collab'; }, 900); return; }
    setState({ busy: false, msg: r.data?.error === 'not_found' ? 'This post is already removed.' : 'Could not remove the post. Try again.', done: false });
    setStep(0);
  }
  return (
    <section aria-label="Owner panel" className="mb-6 rounded-2xl border border-[#e6cd8c]/40 bg-[#e6cd8c]/5 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-sm font-semibold text-[#f3e1b0]"><ShieldCheck className="h-4 w-4" aria-hidden="true" />Owner panel <span className="rounded-full border border-border/60 px-2 py-0.5 text-[11px] font-normal text-muted-foreground">{status}</span></p>
        {state.done ? <p role="status" className="text-sm text-emerald-400">Post removed.</p> : step === 0 ? (
          <button type="button" onClick={() => setStep(1)} className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/60 px-3 py-1.5 text-sm font-medium text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4" aria-hidden="true" />Delete post</button>
        ) : (
          <div className="flex flex-wrap items-center justify-end gap-2">
            <span className="text-sm text-muted-foreground">Remove this post for everyone?</span>
            <button type="button" disabled={state.busy} onClick={remove} className="rounded-lg bg-destructive px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60">Yes, delete</button>
            <button type="button" disabled={state.busy} onClick={() => setStep(0)} className="rounded-lg border border-border/70 px-3 py-1.5 text-sm">Cancel</button>
          </div>
        )}
      </div>
      {state.msg && <p role="alert" className="mt-2 text-sm text-destructive">{state.msg}</p>}
    </section>
  );
}

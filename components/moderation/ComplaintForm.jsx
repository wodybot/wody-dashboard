'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { input, lab, btnMain } from '@/components/collab/ProfileParts';

export default function ComplaintForm({ labels, initialUser }) {
  const [f, setF] = useState({ kind: 'copyright', target: initialUser || '', claimant_name: '', claimant_email: '', work_description: '', work_url: '', reason: '', confirm_accurate: false, confirm_authorized: false });
  const [state, setState] = useState({ busy: false, msg: null, ok: false });
  const set = (patch) => setF((s) => ({ ...s, ...patch }));
  const submit = async (e) => {
    e.preventDefault();
    setState({ busy: true, msg: null, ok: false });
    try {
      const res = await fetch('/api/content-report', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...f, location: 'complaint_form' }) });
      const data = await res.json().catch(() => ({}));
      if (res.ok) setState({ busy: false, ok: true, msg: labels.sent.replace('{id}', data.id || '') });
      else setState({ busy: false, ok: false, msg: res.status === 404 ? labels.notFound : res.status === 429 ? labels.rate : labels.error });
    } catch {
      setState({ busy: false, ok: false, msg: labels.error });
    }
  };
  const ready = f.target.trim().length >= 2 && f.claimant_name.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.claimant_email) && f.work_description.trim() && f.reason.trim().length >= 10 && f.confirm_accurate && f.confirm_authorized;
  return (
    <form onSubmit={submit} className="mt-8 space-y-4 rounded-2xl border border-border/60 bg-card/40 p-5">
      <div>
        <label className={lab} htmlFor="cf-kind">{labels.kind}</label>
        <select id="cf-kind" className={input} value={f.kind} onChange={(e) => set({ kind: e.target.value })}>
          <option value="copyright">{labels.copyright}</option>
          <option value="trademark">{labels.trademark}</option>
        </select>
      </div>
      <div>
        <label className={lab} htmlFor="cf-target">{labels.target}</label>
        <input id="cf-target" className={input} value={f.target} maxLength={40} onChange={(e) => set({ target: e.target.value })} />
        <p className="mt-1 text-xs text-muted-foreground">{labels.targetHint}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div><label className={lab} htmlFor="cf-name">{labels.name}</label><input id="cf-name" className={input} value={f.claimant_name} maxLength={120} onChange={(e) => set({ claimant_name: e.target.value })} /></div>
        <div><label className={lab} htmlFor="cf-email">{labels.email}</label><input id="cf-email" type="email" className={input} value={f.claimant_email} maxLength={160} onChange={(e) => set({ claimant_email: e.target.value })} /></div>
      </div>
      <div><label className={lab} htmlFor="cf-work">{labels.work}</label><textarea id="cf-work" className={`${input} min-h-20`} value={f.work_description} maxLength={800} onChange={(e) => set({ work_description: e.target.value })} /></div>
      <div><label className={lab} htmlFor="cf-url">{labels.workUrl}</label><input id="cf-url" className={input} inputMode="url" value={f.work_url} maxLength={300} onChange={(e) => set({ work_url: e.target.value })} /></div>
      <div><label className={lab} htmlFor="cf-reason">{labels.reason}</label><textarea id="cf-reason" className={`${input} min-h-24`} value={f.reason} maxLength={1500} onChange={(e) => set({ reason: e.target.value })} /></div>
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1 h-4 w-4 accent-[#e6cd8c]" checked={f.confirm_accurate} onChange={(e) => set({ confirm_accurate: e.target.checked })} /><span>{labels.accurate}</span></label>
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1 h-4 w-4 accent-[#e6cd8c]" checked={f.confirm_authorized} onChange={(e) => set({ confirm_authorized: e.target.checked })} /><span>{labels.authorized}</span></label>
      <button type="submit" disabled={!ready || state.busy} className={`${btnMain} disabled:opacity-50`}>{state.busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}{state.busy ? labels.sending : labels.send}</button>
      <p role="status" aria-live="polite" className={`min-h-5 text-sm ${state.ok ? 'text-emerald-300' : 'text-red-300'}`}>{state.msg}</p>
    </form>
  );
}

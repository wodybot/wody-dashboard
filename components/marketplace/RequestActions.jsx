'use client';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Flag, Mail, Send, CheckCircle2 } from 'lucide-react';
import { mfetch } from './client';
import { REPORT_REASONS } from '@/lib/marketplace/constants';

const input = 'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
const label = 'mb-1 block text-xs font-medium text-muted-foreground';

export function errText(t, data) {
  const has = (k) => typeof t.has === 'function' && t.has(k);
  if (!data) return t('err.generic');
  const first = data.errors?.[0];
  if (first) {
    const field = String(first.field).split('.')[0];
    const f = has(`field.${field}`) ? t(`field.${field}`) : field;
    const m = has(`err.${first.code}`) ? t(`err.${first.code}`, first.params || {}) : first.code;
    return `${f} ${m}`;
  }
  return has(`err.${data.error}`) ? t(`err.${data.error}`) : t('err.generic');
}

function Panel({ icon: Icon, title, children }) {
  return (
    <section className="mt-6 rounded-3xl border border-border/60 bg-card/60 p-5 sm:p-6">
      <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold"><Icon className="h-4 w-4 text-[#e6cd8c]" aria-hidden="true" />{title}</h2>
      {children}
    </section>
  );
}

function ApplyForm({ request }) {
  const t = useTranslations('marketplace');
  const [f, setF] = useState({ intro: '', experience: '', skills: '', portfolio: '', approach: '', duration: '', answers: request.questions.map(() => '') });
  const [state, setState] = useState({ busy: false, msg: '', ok: false });
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  async function submit(e) {
    e.preventDefault();
    setState({ busy: true, msg: '', ok: false });
    const body = { ...f, skills: f.skills.split(',').map((x) => x.trim()).filter(Boolean), portfolio: f.portfolio.split('\n').map((x) => x.trim()).filter(Boolean) };
    const r = await mfetch(`request/${request.id}/apply`, { method: 'POST', body });
    setState({ busy: false, ok: r.ok, msg: r.ok ? t('apply.sent') : errText(t, r.data) });
  }
  if (state.ok) return <p role="status" className="flex items-center gap-2 text-sm"><CheckCircle2 className="h-4 w-4 text-emerald-400" aria-hidden="true" />{state.msg}</p>;
  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <p className="text-xs text-muted-foreground">{t('apply.noPrice')}</p>
      <div><label className={label} htmlFor="ap-intro">{t('field.intro')}</label><textarea id="ap-intro" required minLength={20} maxLength={1500} rows={4} value={f.intro} onChange={set('intro')} className={input} /></div>
      <div><label className={label} htmlFor="ap-exp">{t('field.experience')}</label><textarea id="ap-exp" maxLength={1500} rows={3} value={f.experience} onChange={set('experience')} className={input} /></div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div><label className={label} htmlFor="ap-skills">{t('field.skills')}</label><input id="ap-skills" maxLength={300} value={f.skills} onChange={set('skills')} className={input} placeholder={t('apply.skillsHint')} /></div>
        <div><label className={label} htmlFor="ap-dur">{t('field.duration')}</label><input id="ap-dur" maxLength={80} value={f.duration} onChange={set('duration')} className={input} /></div>
      </div>
      <div><label className={label} htmlFor="ap-port">{t('field.portfolio')}</label><textarea id="ap-port" rows={2} maxLength={1500} value={f.portfolio} onChange={set('portfolio')} className={input} placeholder={t('apply.portfolioHint')} /></div>
      <div><label className={label} htmlFor="ap-app">{t('field.approach')}</label><textarea id="ap-app" maxLength={1500} rows={3} value={f.approach} onChange={set('approach')} className={input} /></div>
      {request.questions.map((q, i) => (
        <div key={i}><label className={label} htmlFor={`ap-q${i}`}>{q}</label><textarea id={`ap-q${i}`} required maxLength={600} rows={2} value={f.answers[i]} onChange={(e) => setF((s) => ({ ...s, answers: s.answers.map((a, j) => (j === i ? e.target.value : a)) }))} className={input} /></div>
      ))}
      {state.msg && <p role="alert" className="text-sm text-destructive">{state.msg}</p>}
      <button type="submit" disabled={state.busy} className="inline-flex items-center gap-2 rounded-lg bg-[#c1701f] px-5 py-2 text-sm font-semibold text-white hover:bg-[#a65e1a] disabled:opacity-60"><Send className="h-4 w-4" aria-hidden="true" />{t('apply.submit')}</button>
    </form>
  );
}

function ContactForm({ request }) {
  const t = useTranslations('marketplace');
  const [ch, setCh] = useState(null);
  const [f, setF] = useState({ name: '', reply_to: '', body: '', answer: '', website: '' });
  const [state, setState] = useState({ busy: false, msg: '', ok: false });
  const load = async () => { const r = await mfetch(`request/${request.id}/contact-challenge`); if (r.ok) setCh(r.data); };
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  async function submit(e) {
    e.preventDefault();
    setState({ busy: true, msg: '', ok: false });
    const r = await mfetch(`request/${request.id}/contact`, { method: 'POST', body: { ...f, challenge_id: ch?.id } });
    setState({ busy: false, ok: r.ok, msg: r.ok ? t('contact.sent') : errText(t, r.data) });
    if (!r.ok) { setF((s) => ({ ...s, answer: '' })); load(); }
  }
  if (state.ok) return <p role="status" className="flex items-center gap-2 text-sm"><CheckCircle2 className="h-4 w-4 text-emerald-400" aria-hidden="true" />{state.msg}</p>;
  return (
    <form onSubmit={submit} className="space-y-3" noValidate>
      <p className="text-xs text-muted-foreground">{t('contact.text')}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div><label className={label} htmlFor="ct-name">{t('contact.name')}</label><input id="ct-name" maxLength={60} value={f.name} onChange={set('name')} className={input} /></div>
        <div><label className={label} htmlFor="ct-reply">{t('contact.replyTo')}</label><input id="ct-reply" maxLength={120} value={f.reply_to} onChange={set('reply_to')} className={input} placeholder={t('contact.replyHint')} /></div>
      </div>
      <div><label className={label} htmlFor="ct-body">{t('contact.message')}</label><textarea id="ct-body" rows={4} maxLength={1500} value={f.body} onChange={set('body')} className={input} /></div>
      {/* honeypot: real people never see or fill it */}
      <div className="absolute -left-[9999px] h-0 w-0 overflow-hidden" aria-hidden="true"><label>Website<input tabIndex={-1} autoComplete="off" value={f.website} onChange={set('website')} /></label></div>
      <div className="flex flex-wrap items-end gap-3">
        <div><label className={label} htmlFor="ct-ans">{ch ? t('contact.captcha', { q: ch.question }) : t('loading')}</label><input id="ct-ans" inputMode="numeric" value={f.answer} onChange={set('answer')} className={`${input} w-28`} /></div>
        <button type="submit" disabled={state.busy || !ch} className="inline-flex items-center gap-2 rounded-lg bg-[#c1701f] px-5 py-2 text-sm font-semibold text-white hover:bg-[#a65e1a] disabled:opacity-60"><Send className="h-4 w-4" aria-hidden="true" />{t('contact.send')}</button>
      </div>
      {state.msg && <p role="alert" className="text-sm text-destructive">{state.msg}</p>}
    </form>
  );
}

function ReportForm({ request }) {
  const t = useTranslations('marketplace');
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ reason: 'scam', details: '' });
  const [state, setState] = useState({ busy: false, msg: '', ok: false });
  async function submit(e) {
    e.preventDefault();
    setState({ busy: true, msg: '', ok: false });
    const r = await mfetch(`request/${request.id}/report`, { method: 'POST', body: f });
    setState({ busy: false, ok: r.ok, msg: r.ok ? t('report.sent') : errText(t, r.data) });
  }
  if (!open) return <button type="button" onClick={() => setOpen(true)} className="mt-6 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"><Flag className="h-3.5 w-3.5" aria-hidden="true" />{t('report.open')}</button>;
  if (state.ok) return <p role="status" className="mt-6 text-sm">{state.msg}</p>;
  return (
    <form onSubmit={submit} className="mt-6 space-y-3 rounded-2xl border border-border/60 p-4">
      <div><label className={label} htmlFor="rp-reason">{t('report.reason')}</label>
        <select id="rp-reason" value={f.reason} onChange={(e) => setF((s) => ({ ...s, reason: e.target.value }))} className={input}>{REPORT_REASONS.map((r) => <option key={r} value={r}>{t(`report.reasons.${r}`)}</option>)}</select></div>
      <div><label className={label} htmlFor="rp-details">{t('report.details')}</label><textarea id="rp-details" rows={3} maxLength={600} value={f.details} onChange={(e) => setF((s) => ({ ...s, details: e.target.value }))} className={input} /></div>
      {state.msg && <p role="alert" className="text-sm text-destructive">{state.msg}</p>}
      <div className="flex gap-2"><button type="submit" disabled={state.busy} className="rounded-lg bg-destructive px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{t('report.send')}</button><button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-border/70 px-4 py-2 text-sm">{t('cancel')}</button></div>
    </form>
  );
}

export default function RequestActions({ request, signedIn }) {
  const t = useTranslations('marketplace');
  const loginHref = `/api/auth/login?next=${encodeURIComponent(`/marketplace/${request.id}`)}`;
  return (
    <>
      <Panel icon={Send} title={t('apply.title')}>
        {signedIn ? <ApplyForm request={request} /> : (
          <p className="text-sm text-muted-foreground">{t('apply.loginNeeded')} <a href={loginHref} className="font-medium text-foreground underline underline-offset-4">{t('apply.login')}</a></p>
        )}
      </Panel>
      {request.public_contact && <Panel icon={Mail} title={t('contact.title')}><ContactForm request={request} /></Panel>}
      {signedIn ? <ReportForm request={request} /> : null}
    </>
  );
}

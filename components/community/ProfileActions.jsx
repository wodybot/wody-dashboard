'use client';
import { useCallback, useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Flag, Heart, Loader2, Star, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { REPORT_REASONS, LIMITS } from '@/lib/community/constants';
import { ConfirmDialog } from '@/components/module-kit';

async function api(path, { method = 'GET', body } = {}) {
  try {
    const r = await fetch(`/api/community/${path}`, { method, headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined });
    return { ok: r.ok, status: r.status, data: await r.json().catch(() => ({})) };
  } catch { return { ok: false, status: 0, data: { error: 'unreachable' } }; }
}

export function useViewer(slug) {
  const [state, setState] = useState({ loading: true, user: false, favorite: false, review: null, isAdmin: false });
  const load = useCallback(async () => {
    const r = await api(`me/state?slug=${encodeURIComponent(slug)}`);
    setState(r.status === 401 ? { loading: false, user: false, favorite: false, review: null, isAdmin: false } : { loading: false, user: true, favorite: Boolean(r.data.favorite), review: r.data.review || null, isAdmin: r.data.is_admin === true });
  }, [slug]);
  useEffect(() => { load(); }, [load]);
  return { ...state, reload: load, setState };
}

export function ViewPing({ slug }) {
  useEffect(() => {
    const id = setTimeout(() => { api('public/view', { method: 'POST', body: { slug } }); }, 1500);
    return () => clearTimeout(id);
  }, [slug]);
  return null;
}

function loginHref(slug) { return `/api/auth/login?next=${encodeURIComponent(`/server/${slug}`)}`; }

export function ProfileButtons({ slug, viewer }) {
  const t = useTranslations('community');
  const [busy, setBusy] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const toggle = async () => {
    if (!viewer.user) { window.location.assign(loginHref(slug)); return; }
    setBusy(true);
    const r = viewer.favorite ? await api(`me/favorites?slug=${encodeURIComponent(slug)}`, { method: 'DELETE' }) : await api('me/favorites', { method: 'POST', body: { slug } });
    setBusy(false);
    if (r.ok) { viewer.setState((s) => ({ ...s, favorite: !viewer.favorite })); toast.success(viewer.favorite ? t('favorites.removed') : t('favorites.added')); } else toast.error(t(r.status === 429 ? 'errors.rate_limited' : 'errors.generic'));
  };
  return (
    <>
      <Button type="button" variant="outline" onClick={toggle} disabled={busy || viewer.loading} aria-pressed={viewer.favorite} className="h-auto min-h-12 w-full justify-center py-2 leading-tight gap-2 rounded-[var(--cm-radius-btn)] border border-white/25 bg-white/5 px-4 text-base font-semibold text-white hover:bg-white/10 hover:text-white">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Heart className={`h-4 w-4 ${viewer.favorite ? 'fill-rose-500 text-rose-500' : ''}`} />}{viewer.favorite ? t('favorites.saved') : t('favorites.add')}
      </Button>
      <Button type="button" variant="outline" onClick={() => (viewer.user ? setReportOpen(true) : window.location.assign(loginHref(slug)))} className="h-auto min-h-12 w-full justify-center py-2 leading-tight gap-2 rounded-[var(--cm-radius-btn)] border border-white/25 bg-white/5 px-4 text-base font-semibold text-white hover:bg-white/10 hover:text-white">
        <Flag className="h-4 w-4" />{t('report.button')}
      </Button>
      {reportOpen ? <ReportDialog slug={slug} onClose={() => setReportOpen(false)} /> : null}
    </>
  );
}

function ReportDialog({ slug, onClose }) {
  const t = useTranslations('community');
  const [reason, setReason] = useState('');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async () => {
    setBusy(true); setError('');
    const r = await api('me/report', { method: 'POST', body: { slug, reason, text } });
    setBusy(false);
    if (r.ok) { toast.success(t('report.sent')); onClose(); } else setError(t.has(`errors.${r.data?.error}`) ? t(`errors.${r.data.error}`) : t('errors.generic'));
  };
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>{t('report.title')}</DialogTitle><DialogDescription>{t('report.text')}</DialogDescription></DialogHeader>
        <fieldset className="space-y-2">
          <legend className="sr-only">{t('report.reason')}</legend>
          {REPORT_REASONS.map((r) => (
            <label key={r} className="flex cursor-pointer items-center gap-2 rounded-md border border-border/60 px-3 py-2 text-sm has-[:checked]:border-primary">
              <input type="radio" name="reason" value={r} checked={reason === r} onChange={() => setReason(r)} className="accent-[#e6cd8c]" />{t(`report.reasons.${r}`)}
            </label>
          ))}
        </fieldset>
        <Textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={LIMITS.reportText} rows={3} placeholder={t('report.details')} aria-label={t('report.details')} />
        {error ? <p role="alert" className="text-sm text-red-400">{error}</p> : null}
        <DialogFooter className="gap-2"><Button variant="outline" onClick={onClose}>{t('common.cancel')}</Button><Button onClick={submit} disabled={!reason || busy}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}{t('report.submit')}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Stars({ value, onChange, size = 'h-5 w-5' }) {
  const t = useTranslations('community');
  return (
    <div role={onChange ? 'radiogroup' : 'img'} aria-label={t('reviews.rating', { value: value || 0 })} className="inline-flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => {
        const star = <Star className={`${size} ${n <= value ? 'fill-amber-400 text-amber-400' : 'text-white/30'}`} aria-hidden="true" />;
        return onChange
          ? <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={t('reviews.rating', { value: n })} onClick={() => onChange(n)} className="rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">{star}</button>
          : <span key={n}>{star}</span>;
      })}
    </div>
  );
}

export function ReviewsBlock({ slug, summary, viewer }) {
  const t = useTranslations('community');
  const locale = useLocale();
  const [data, setData] = useState({ items: [], total: 0, page: 0 });
  const [loading, setLoading] = useState(true);
  const [rating, setRating] = useState(viewer.review?.rating || 0);
  const [text, setText] = useState(viewer.review?.text || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const load = useCallback(async (page = 0) => {
    setLoading(true);
    const r = await api(`public/reviews/${encodeURIComponent(slug)}?page=${page}`);
    if (r.ok) setData(r.data);
    setLoading(false);
  }, [slug]);
  useEffect(() => { load(0); }, [load]);
  useEffect(() => { if (viewer.review) { setRating(viewer.review.rating); setText(viewer.review.text); } }, [viewer.review]);
  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [removed, setRemoved] = useState([]);
  const removeReview = async () => {
    if (!toDelete) return;
    setDeleting(true);
    const r = await api(`admin/reviews/${encodeURIComponent(toDelete.id)}`, { method: 'PATCH', body: { decision: 'removed', reason: 'Removed from the public page' } });
    setDeleting(false);
    if (r.ok) {
      setRemoved((list) => [...list, toDelete.rating]);
      setData((d) => ({ ...d, total: Math.max(0, d.total - 1), items: d.items.filter((x) => x.id !== toDelete.id) }));
      setToDelete(null);
      toast.success(t('reviews.deleted'));
    } else toast.error(t.has(`errors.${r.data?.error}`) ? t(`errors.${r.data.error}`) : t('errors.generic'));
  };
  const shown = (() => {
    if (!summary?.count || !removed.length) return summary;
    const count = summary.count - removed.length;
    if (count <= 0) return { ...summary, count: 0, average: 0 };
    const avg = (summary.average * summary.count - removed.reduce((a, b) => a + b, 0)) / count;
    return { ...summary, count, average: Math.round(Math.max(1, Math.min(5, avg)) * 10) / 10 };
  })();
  const submit = async () => {
    setBusy(true); setError('');
    const r = await api('me/review', { method: 'POST', body: { slug, rating, text } });
    setBusy(false);
    if (r.ok) { toast.success(r.data.status === 'pending' ? t('reviews.pending') : t('reviews.thanks')); viewer.reload(); load(0); }
    else setError(t.has(`errors.${r.data?.error}`) ? t(`errors.${r.data.error}`, r.data?.extra || {}) : t('errors.generic'));
  };
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        {shown?.count ? <><span className="text-3xl font-bold">{shown.average}</span><Stars value={Math.round(shown.average)} /><span className="text-sm text-white/60">{t('reviews.count', { count: shown.count })}</span></> : <p className="text-sm text-white/60">{t('reviews.none')}</p>}
      </div>
      {viewer.user ? (
        <div className="space-y-3 rounded-xl border border-white/10 bg-black/20 p-4">
          <h3 className="text-sm font-semibold">{viewer.review ? t('reviews.edit') : t('reviews.write')}</h3>
          {viewer.review?.status === 'pending' ? <p className="text-xs text-amber-300">{t('reviews.pending')}</p> : null}
          <Stars value={rating} onChange={setRating} size="h-7 w-7" />
          <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} maxLength={LIMITS.review[1]} placeholder={t('reviews.placeholder')} aria-label={t('reviews.placeholder')} className="bg-black/30" />
          <p className="text-xs text-white/50">{t('reviews.rules')}</p>
          {error ? <p role="alert" className="text-sm text-red-300">{error}</p> : null}
          <Button onClick={submit} disabled={busy || !rating || text.trim().length < LIMITS.review[0]} className="rounded-[var(--cm-radius-btn)] bg-[color:var(--cm-primary)] text-[color:var(--cm-on-primary)] hover:brightness-110">{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}{t('reviews.submit')}</Button>
        </div>
      ) : (
        <a href={loginHref(slug)} className="inline-flex rounded-[var(--cm-radius-btn)] border border-white/25 px-4 py-2 text-sm hover:bg-white/10">{t('reviews.login')}</a>
      )}
      <ul className="space-y-3" aria-busy={loading}>
        {data.items.map((r, i) => (
          <li key={r.id || i} className="relative rounded-xl border border-white/10 bg-black/20 p-4">
            {viewer.isAdmin && r.id ? (
              <button type="button" onClick={() => setToDelete(r)} title={t('reviews.delete')} aria-label={t('reviews.delete')}
                className="absolute right-2.5 top-2.5 inline-flex h-7 w-7 items-center justify-center rounded-full border border-red-400/40 bg-red-500/15 text-red-300 transition hover:bg-red-500/30 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-300">
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            ) : null}
            <div className={`flex flex-wrap items-center gap-2 ${viewer.isAdmin ? 'pr-9' : ''}`}><Stars value={r.rating} size="h-4 w-4" /><span className="text-sm font-medium">{r.author}</span><time className="text-xs text-white/50" dateTime={r.date}>{new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(r.date))}</time></div>
            <p className="mt-2 whitespace-pre-line break-words text-sm text-white/85">{r.text}</p>
          </li>
        ))}
      </ul>
      {data.total > data.items.length + data.page * 10 ? <Button variant="outline" size="sm" onClick={() => load(data.page + 1)}>{t('common.next')}</Button> : null}
      {viewer.isAdmin ? (
        <ConfirmDialog open={Boolean(toDelete)} onOpenChange={(o) => { if (!o && !deleting) setToDelete(null); }}
          title={t('reviews.deleteTitle')} description={t('reviews.deleteText', { author: toDelete?.author || '' })}
          confirmLabel={t('reviews.deleteConfirm')} onConfirm={removeReview} busy={deleting} />
      ) : null}
    </div>
  );
}

export default function ProfileInteractive({ slug, summary, part }) {
  const viewer = useViewer(slug);
  if (part === 'buttons') return <ProfileButtons slug={slug} viewer={viewer} />;
  return <ReviewsBlock slug={slug} summary={summary} viewer={viewer} />;
}

'use client';
// Single application review page for the Wody admins: everything about a listing in one place.
import { useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { ArrowLeft, CheckCircle2, ExternalLink, Loader2, RefreshCw, ShieldAlert, ShieldCheck, Star, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ConfirmDialog, LoadingOrError, NativeSelect } from '@/components/module-kit';
import { DevicePreview } from '@/components/community/OwnerEditors';
import { StatusBadge, Timeline } from '@/components/community/StatusParts';
import { cfetch, useCApi } from '@/components/community/client';
import { previewProfile } from '@/lib/community/preview';
import { catalogName } from '@/lib/community/names';
import { CHANGE_AREAS, REJECT_REASONS, CHECKLIST_ITEMS, FEATURED_PLACEMENTS, LIMITS } from '@/lib/community/constants';

function Kv({ k, children }) { return <div className="flex flex-wrap justify-between gap-x-4 gap-y-0.5 py-1 text-sm"><dt className="text-muted-foreground">{k}</dt><dd className="min-w-0 break-words text-right">{children}</dd></div>; }
const dt = (d, locale) => (d ? new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(d)) : '-');

export default function AdminReview({ id, onBack }) {
  const t = useTranslations('community');
  const locale = useLocale();
  const api = useCApi(`admin/listing/${id}`);
  const d = api.data;
  const [checklist, setChecklist] = useState({});
  const [modal, setModal] = useState(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [verify, setVerify] = useState(null);
  useEffect(() => { if (d) { setChecklist(d.listing.checklist || {}); setVerify(d.verification); } }, [d]);

  const act = async (action, body = {}, method = 'POST') => {
    setBusy(true);
    const r = await cfetch(`admin/listing/${id}/${action}`, { method, body });
    setBusy(false);
    if (r.ok) { toast.success(t('admin.done')); setModal(null); api.reload(); return true; }
    const e = r.data?.error;
    toast.error(t.has(`errors.${e}`) ? t(`errors.${e}`) : t('errors.generic'));
    return false;
  };
  const toggleCheck = (key) => { const next = { ...checklist, [key]: !checklist[key] }; setChecklist(next); cfetch(`admin/listing/${id}/checklist`, { method: 'PUT', body: { checklist: next } }); };
  const recheck = async () => { const r = await cfetch(`admin/listing/${id}/recheck`, { method: 'POST' }); if (r.ok) setVerify(r.data.verification); };

  const catalog = d?.catalog;
  const profile = useMemo(() => (d ? { ...previewProfile(d.listing.content, d.listing, d.listing.guild_id), badges: [], verified: d.listing.badges.includes('verified') } : null), [d]);
  const pendingKind = d && (d.listing.status === 'pending_review' ? 'new' : d.listing.status === 'published' && d.listing.update_state === 'pending' ? 'update' : null);
  const L = d?.listing;
  const allChecked = CHECKLIST_ITEMS.every((k) => checklist[k]);

  return (
    <div>
      <Button variant="ghost" onClick={onBack} className="mb-4 gap-2"><ArrowLeft className="h-4 w-4" />{t('admin.back')}</Button>
      <LoadingOrError loading={api.loading} error={api.error} data={d} onRetry={api.reload}>
        {d ? (
          <div className="grid gap-5 xl:grid-cols-[1fr_24rem]">
            <div className="space-y-5">
              <Card className="p-5">
                <div className="flex flex-wrap items-center gap-3"><h2 className="text-xl font-bold">{L.content.name}</h2><StatusBadge status={L.status} updateState={L.update_state} /><Badge variant="outline" className="font-mono">{t('status.version')} {L.version}</Badge></div>
                {pendingKind ? (
                  <div className="mt-4 flex flex-wrap gap-2 rounded-xl border border-emerald-400/25 bg-emerald-500/[0.06] p-3">
                    <Button className="gap-2 bg-emerald-600 hover:bg-emerald-700" onClick={() => setModal('approve')}><CheckCircle2 className="h-4 w-4" />{t('admin.approve')}</Button>
                    <Button variant="outline" onClick={() => setModal('changes')}>{t('admin.requestChanges')}</Button>
                    <Button variant="outline" className="border-red-500/40 text-red-300" onClick={() => setModal('reject')}>{t('admin.reject')}</Button>
                  </div>
                ) : null}
                <dl className="mt-3 divide-y divide-border/40">
                  <Kv k={t('admin.fields.server')}>{L.content.name}</Kv>
                  <Kv k={t('admin.fields.serverId')}><span className="font-mono">{L.guild_id}</span></Kv>
                  <Kv k={t('admin.fields.owner')}>{L.owner_name || '-'} <span className="font-mono text-xs text-muted-foreground">{L.owner_id}</span></Kv>
                  <Kv k={t('stats.members')}>{L.stats?.member_count ?? t('stats.unavailable')}</Kv>
                  <Kv k={t('admin.fields.slug')}><a className="inline-flex items-center gap-1 font-mono text-[#e08a4e] hover:underline" href={`/${d?.settings?.url_prefix || 'server'}/${L.slug}`} target="_blank" rel="noreferrer">/{d?.settings?.url_prefix || 'server'}/{L.slug}<ExternalLink className="h-3 w-3" /></a></Kv>
                  <Kv k={t('admin.fields.submitted')}>{dt(L.submitted_at, locale)}</Kv>
                </dl>
              </Card>

              <Card className="p-5">
                <div className="flex items-center justify-between gap-3"><h3 className="font-semibold">{t('admin.verification.title')}</h3><Button size="sm" variant="outline" onClick={recheck} className="gap-1.5"><RefreshCw className="h-3.5 w-3.5" />{t('admin.verification.recheck')}</Button></div>
                {verify ? (
                  <ul className="mt-3 space-y-2 text-sm">
                    <li className="flex items-center gap-2">{verify.bot_in_guild ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <XCircle className="h-4 w-4 text-red-400" />}{verify.bot_in_guild ? t('admin.verification.botIn') : t('admin.verification.botOut')}</li>
                    {verify.guild ? (<>
                      <li className="flex items-center gap-2">{verify.owner_matches ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <ShieldAlert className="h-4 w-4 text-amber-400" />}{verify.owner_matches ? t('admin.verification.ownerMatches') : t('admin.verification.ownerDiffers', { id: verify.guild.owner_id })}</li>
                      <li className="text-muted-foreground">{t('admin.verification.live', { members: verify.guild.members ?? '-', online: verify.guild.online ?? '-', boosts: verify.guild.boosts ?? '-' })}</li>
                      {verify.guild.features?.length ? <li className="flex flex-wrap gap-1.5">{verify.guild.features.map((f) => <Badge key={f} variant="secondary">{f}</Badge>)}</li> : null}
                    </>) : null}
                    <li className="flex items-center gap-2">{verify.invite.status === 'valid' ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <XCircle className="h-4 w-4 text-red-400" />}{t(`owner.invite.${verify.invite.status}`)}</li>
                  </ul>
                ) : null}
              </Card>

              {d.diff_live?.length ? (
                <Card className="p-5"><h3 className="mb-2 font-semibold">{t('admin.changesVsLive')}</h3>
                  <ul className="space-y-0.5 font-mono text-xs">{d.diff_live.map((c, i) => <li key={i} className={c.op === '+' ? 'text-emerald-400' : c.op === '-' ? 'text-red-400' : 'text-amber-300'}>{c.op} {t(`fields.${c.field.split('.')[0]}`)}</li>)}</ul></Card>
              ) : null}

              <Card className="p-5">
                <h3 className="mb-3 font-semibold">{t('admin.listing')}</h3>
                <dl className="divide-y divide-border/40">
                  <Kv k={t('fields.category')}>{catalogName(t, 'categories', catalog.categories.find((c) => c.slug === L.content.category) || L.content.category, locale)}</Kv>
                  <Kv k={t('fields.tags')}>{L.content.tags.map((x) => catalogName(t, 'tags', catalog.tags.find((c) => c.slug === x) || x, locale)).join(', ') || '-'}</Kv>
                  <Kv k={t('fields.languages')}>{L.content.languages.join(', ') || '-'}</Kv>
                  <Kv k={t('fields.features')}>{L.content.features.map((x) => catalogName(t, 'features', catalog.features.find((c) => c.slug === x) || x, locale)).join(', ') || '-'}</Kv>
                  <Kv k={t('fields.theme')}>{t(`themes.${L.content.theme.preset}`)}</Kv>
                  {Object.entries(L.content.socials).map(([k, u]) => <Kv key={k} k={t(`social.${k}`)}><a className="break-all text-[#e08a4e] hover:underline" href={u} target="_blank" rel="nofollow noreferrer">{u}</a></Kv>)}
                </dl>
              </Card>

              <div><h3 className="mb-2 font-semibold">{t('admin.exactPreview')}</h3><DevicePreview profile={profile} catalog={catalog} /></div>
            </div>

            <div className="space-y-5">
              <Card className="p-5">
                <h3 className="mb-3 font-semibold">{t('admin.checklist.title')}</h3>
                <ul className="space-y-2">{CHECKLIST_ITEMS.map((k) => <li key={k}><label className="flex cursor-pointer items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(checklist[k])} onChange={() => toggleCheck(k)} className="accent-[#e6cd8c]" />{t(`admin.checklist.${k}`)}</label></li>)}</ul>
              </Card>

              <Card className="space-y-2 p-5">
                <h3 className="mb-1 font-semibold">{t('admin.actions')}</h3>
                {pendingKind ? (<>
                  <Button className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700" onClick={() => setModal('approve')}><CheckCircle2 className="h-4 w-4" />{t('admin.approve')}</Button>
                  <Button variant="outline" className="w-full" onClick={() => setModal('changes')}>{t('admin.requestChanges')}</Button>
                  <Button variant="outline" className="w-full border-red-500/40 text-red-300" onClick={() => setModal('reject')}>{t('admin.reject')}</Button>
                </>) : null}
                {['published', 'approved'].includes(L.status) ? <Button variant="outline" className="w-full" onClick={() => setModal('changes')}>{t('admin.requestChanges')}</Button> : null}
                {['published', 'approved'].includes(L.status) ? <Button variant="outline" className="w-full border-red-500/40 text-red-300" onClick={() => setModal('suspend')}>{t('admin.suspend')}</Button> : null}
                <Button variant="outline" className="w-full border-red-500/40 text-red-300" onClick={() => setModal('delete')}>{t('admin.deleteListing')}</Button>
                {['published', 'approved', 'suspended'].includes(L.status) ? <Button variant="outline" className="w-full" onClick={() => setModal('unpublish')}>{t('admin.unpublish')}</Button> : null}
                {['approved', 'unpublished', 'suspended'].includes(L.status) && L.live ? <Button variant="outline" className="w-full" onClick={() => act('publish')}>{t('admin.publish')}</Button> : null}
                {L.status === 'published' ? <Button variant="outline" className="w-full gap-2" onClick={() => setModal('feature')}><Star className="h-4 w-4" />{L.featured ? t('admin.editFeatured') : t('admin.feature')}</Button> : null}
                <Button variant="outline" className="w-full gap-2" onClick={() => setModal('badges')}><ShieldCheck className="h-4 w-4" />{t('admin.badges')}</Button>
                <Button variant="ghost" className="w-full" onClick={() => setModal('category')}>{t('admin.changeCategory')}</Button>
                {L.last_review ? <p className="pt-2 text-xs text-muted-foreground">{t('admin.lastDecision', { type: t(`review.${L.last_review.type}`) })}</p> : null}
              </Card>

              <Card className="p-5">
                <h3 className="mb-1 font-semibold">{t('admin.notes.title')}</h3>
                <p className="mb-3 text-xs text-muted-foreground">{t('admin.notes.private')}</p>
                <ul className="mb-3 space-y-2">{L.notes.map((n) => <li key={n.id} className="rounded-lg bg-secondary/40 p-2.5 text-sm"><p className="whitespace-pre-line break-words">{n.text}</p><p className="mt-1 text-[11px] text-muted-foreground">{n.by_name || n.by} · {dt(n.at, locale)}</p></li>)}</ul>
                <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={LIMITS.note} placeholder={t('admin.notes.placeholder')} aria-label={t('admin.notes.title')} />
                <Button size="sm" className="mt-2" disabled={!note.trim() || busy} onClick={async () => { if (await act('note', { text: note })) setNote(''); }}>{t('admin.notes.add')}</Button>
              </Card>

              {d.reports.length ? <Card className="p-5"><h3 className="mb-2 font-semibold">{t('admin.reports.forListing')}</h3><ul className="space-y-1.5 text-sm">{d.reports.map((r) => <li key={r.id} className="flex items-center justify-between gap-2"><span>{t(`report.reasons.${r.reason}`)}</span><Badge variant="outline">{t(`admin.reports.status.${r.status}`)}</Badge></li>)}</ul></Card> : null}
              <Card className="p-5"><h3 className="mb-3 font-semibold">{t('history.timeline')}</h3><Timeline items={d.timeline} admin /></Card>
              <Card className="p-5"><h3 className="mb-3 font-semibold">{t('history.versions')}</h3>
                <ul className="space-y-3">{d.versions.map((v) => <li key={v.version}><p className="text-sm font-semibold"><span className="mr-1 inline-flex rounded-full border border-border/70 bg-secondary/40 px-2 py-0.5 font-mono text-[11px]">{t('status.version')} {v.version}</span> <span className="text-xs font-normal text-muted-foreground">{dt(v.at, locale)}</span></p><ul className="mt-1 font-mono text-xs">{v.changes.map((c, i) => <li key={i} className={c.op === '+' ? 'text-emerald-400' : c.op === '-' ? 'text-red-400' : 'text-amber-300'}>{c.op} {t(`fields.${c.field.split('.')[0]}`)}</li>)}</ul></li>)}</ul></Card>
            </div>
          </div>
        ) : null}
      </LoadingOrError>

      <ConfirmDialog open={modal === 'approve'} onOpenChange={(o) => !o && setModal(null)} destructive={false} title={t('admin.approveTitle')} description={allChecked ? t('admin.approveText') : t('admin.approveChecklist')} confirmLabel={t('admin.approve')} busy={busy} onConfirm={() => act('approve', { checklist })} />
      {modal === 'changes' ? <ReasonDialog title={t('admin.requestChanges')} confirm={t('admin.requestChanges')} areas busy={busy} onClose={() => setModal(null)} onSubmit={(v) => act('request-changes', { areas: v.areas, message: v.message })} /> : null}
      {modal === 'reject' ? <ReasonDialog title={t('admin.reject')} confirm={t('admin.reject')} presets={REJECT_REASONS} busy={busy} destructive onClose={() => setModal(null)} onSubmit={(v) => act('reject', { reason: v.preset, message: v.message })} /> : null}
      <ConfirmDialog open={modal === 'delete'} onOpenChange={(o) => !o && setModal(null)} title={t('owner.delete.confirmTitle')} description={t('owner.delete.confirmText')} confirmLabel={t('owner.delete.confirm')} busy={busy} onConfirm={async () => { setBusy(true); const r = await cfetch(`admin/listing/${id}/delete`, { method: 'DELETE' }); setBusy(false); setModal(null); if (r.ok) { toast.success(t('admin.done')); onBack?.(); } else toast.error(t('errors.generic')); }} />
      {modal === 'suspend' ? <ReasonDialog title={t('admin.suspend')} confirm={t('admin.suspend')} busy={busy} destructive onClose={() => setModal(null)} onSubmit={(v) => act('suspend', { reason: v.message })} /> : null}
      {modal === 'unpublish' ? <ReasonDialog title={t('admin.unpublish')} confirm={t('admin.unpublish')} optional busy={busy} onClose={() => setModal(null)} onSubmit={(v) => act('unpublish', { reason: v.message })} /> : null}
      {modal === 'feature' ? <FeatureDialog current={L.featured} busy={busy} onClose={() => setModal(null)} onSave={(v) => act('feature', v, 'PUT')} onRemove={() => act('feature', {}, 'DELETE')} /> : null}
      {modal === 'badges' ? <BadgesDialog catalog={catalog} current={L.badges} busy={busy} onClose={() => setModal(null)} onSave={(badges) => act('badges', { badges }, 'PUT')} /> : null}
      {modal === 'category' ? <CategoryDialog catalog={catalog} current={L.content} busy={busy} onClose={() => setModal(null)} onSave={(v) => act('category', v, 'PUT')} /> : null}
    </div>
  );
}

function ReasonDialog({ title, confirm, areas = false, presets = null, optional = false, destructive = false, busy, onClose, onSubmit }) {
  const t = useTranslations('community');
  const [message, setMessage] = useState('');
  const [picked, setPicked] = useState([]);
  const [preset, setPreset] = useState(presets ? presets[0] : '');
  const valid = optional || (presets ? (preset !== 'other' || message.trim().length > 0) : message.trim().length > 0);
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>{areas ? t('admin.changesText') : presets ? t('admin.rejectText') : t('admin.reasonText')}</DialogDescription></DialogHeader>
        {areas ? <fieldset><legend className="mb-2 text-sm font-medium">{t('admin.areas')}</legend><div className="flex flex-wrap gap-2">{CHANGE_AREAS.map((a) => <label key={a} className="cursor-pointer"><input type="checkbox" className="peer sr-only" checked={picked.includes(a)} onChange={() => setPicked((p) => (p.includes(a) ? p.filter((x) => x !== a) : [...p, a]))} /><span className="inline-block rounded-full border border-border/60 px-3 py-1 text-sm peer-checked:border-[#e6cd8c] peer-checked:bg-[#e6cd8c]/20 peer-focus-visible:ring-2 peer-focus-visible:ring-ring">{t(`changeAreas.${a}`)}</span></label>)}</div></fieldset> : null}
        {presets ? <fieldset className="space-y-1.5"><legend className="mb-1 text-sm font-medium">{t('admin.reason')}</legend>{presets.map((p) => <label key={p} className="flex cursor-pointer items-center gap-2 rounded-md border border-border/60 px-3 py-2 text-sm has-[:checked]:border-[#e6cd8c]"><input type="radio" name="preset" value={p} checked={preset === p} onChange={() => setPreset(p)} className="accent-[#e6cd8c]" />{t(`reject.${p}`)}</label>)}</fieldset> : null}
        <div><label htmlFor="msg" className="mb-1 block text-sm font-medium">{t('admin.message')}{optional || presets ? null : ' *'}</label><Textarea id="msg" value={message} onChange={(e) => setMessage(e.target.value)} rows={4} maxLength={LIMITS.message} /></div>
        <DialogFooter className="gap-2"><Button variant="outline" onClick={onClose}>{t('common.cancel')}</Button><Button disabled={!valid || busy} onClick={() => onSubmit({ message, areas: picked, preset })} className={destructive ? 'bg-red-600 text-white hover:bg-red-700' : ''}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}{confirm}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FeatureDialog({ current, busy, onClose, onSave, onRemove }) {
  const t = useTranslations('community');
  const iso = (d, plus = 0) => new Date((d ? new Date(d).getTime() : Date.now()) + plus).toISOString().slice(0, 16);
  const [v, setV] = useState({ placement: current?.placement || 'home', priority: current?.priority ?? 10, start: iso(current?.start), end: iso(current?.end, current ? 0 : 7 * 86400_000) });
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>{t('admin.feature')}</DialogTitle><DialogDescription>{t('admin.featureText')}</DialogDescription></DialogHeader>
        <div className="space-y-3">
          <div><label className="mb-1 block text-sm">{t('admin.placement')}</label><NativeSelect value={v.placement} onChange={(x) => setV({ ...v, placement: x })} label={t('admin.placement')} options={FEATURED_PLACEMENTS.map((p) => ({ value: p, label: t(`admin.placements.${p}`) }))} /></div>
          <div><label className="mb-1 block text-sm" htmlFor="prio">{t('admin.priority')}</label><Input id="prio" type="number" min={0} max={100} value={v.priority} onChange={(e) => setV({ ...v, priority: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3"><div><label className="mb-1 block text-sm" htmlFor="fs">{t('admin.start')}</label><Input id="fs" type="datetime-local" value={v.start} onChange={(e) => setV({ ...v, start: e.target.value })} /></div><div><label className="mb-1 block text-sm" htmlFor="fe">{t('admin.end')}</label><Input id="fe" type="datetime-local" value={v.end} onChange={(e) => setV({ ...v, end: e.target.value })} /></div></div>
        </div>
        <DialogFooter className="gap-2">{current ? <Button variant="outline" onClick={onRemove} disabled={busy}>{t('admin.removeFeatured')}</Button> : null}<Button onClick={() => onSave({ ...v, start: new Date(v.start).toISOString(), end: new Date(v.end).toISOString() })} disabled={busy}>{t('common.save')}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BadgesDialog({ catalog, current, busy, onClose, onSave }) {
  const t = useTranslations('community');
  const locale = useLocale();
  const [sel, setSel] = useState(current);
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>{t('admin.badges')}</DialogTitle><DialogDescription>{t('admin.badgesText')}</DialogDescription></DialogHeader>
        <ul className="space-y-2">{catalog.badges.map((b) => <li key={b.key}><label className="flex cursor-pointer items-center gap-3 rounded-lg border border-border/60 px-3 py-2 text-sm"><input type="checkbox" checked={sel.includes(b.key)} onChange={() => setSel((s) => (s.includes(b.key) ? s.filter((x) => x !== b.key) : [...s, b.key]))} className="accent-[#e6cd8c]" /><span className="h-3 w-3 rounded-full" style={{ background: b.color }} aria-hidden="true" />{catalogName(t, 'badges', b, locale)}</label></li>)}</ul>
        <DialogFooter><Button variant="outline" onClick={onClose}>{t('common.cancel')}</Button><Button onClick={() => onSave(sel)} disabled={busy}>{t('common.save')}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CategoryDialog({ catalog, current, busy, onClose, onSave }) {
  const t = useTranslations('community');
  const locale = useLocale();
  const [cat, setCat] = useState(current.category);
  const [sub, setSub] = useState(current.subcategory || '');
  const subs = catalog.categories.filter((c) => c.parent === cat);
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>{t('admin.changeCategory')}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <NativeSelect value={cat} onChange={(v) => { setCat(v); setSub(''); }} label={t('fields.category')} options={catalog.categories.filter((c) => !c.parent).map((c) => ({ value: c.slug, label: catalogName(t, 'categories', c, locale) }))} />
          <NativeSelect value={sub} onChange={setSub} label={t('fields.subcategory')} options={[{ value: '', label: t('common.none') }, ...subs.map((c) => ({ value: c.slug, label: catalogName(t, 'categories', c, locale) }))]} />
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>{t('common.cancel')}</Button><Button onClick={() => onSave({ category: cat, subcategory: sub })} disabled={busy}>{t('common.save')}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

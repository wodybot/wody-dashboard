'use client';
// Server owner panel for Community Discovery. Permissions shown here are a convenience:
// every action is checked again on the server (lib/community/api-owner.js).
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import {
  AlertTriangle, BarChart3, Bell, CheckCircle2, Clock, Compass, Eye, ExternalLink, History, LayoutList, Link2, Loader2, Palette, Send, ShieldCheck, Sparkles, Users, UserCog, UserPlus, Trash2, XCircle, Info, Minus, Pencil, Plus, GitCommitHorizontal, CircleDot,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ConfirmDialog, LoadingOrError, ModuleTabs, NativeSelect, Section, useErrorText } from '@/components/module-kit';
import { discordCdnUrl } from '@/lib/utils';
import { Link } from '@/i18n/navigation';
import { COMMUNITY_CHANGED, cfetch, useCApi } from '@/components/community/client';
import { OwnerProfile, OwnerDesign, OwnerSections, OwnerSocial, OwnerPreview } from '@/components/community/OwnerEditors';
import { StatusBadge, Timeline } from '@/components/community/StatusParts';
import { completion } from '@/lib/community/validation';
import { MANAGER_ROLES, MANAGER_PERMISSIONS, ROLE_PRESETS } from '@/lib/community/constants';

const STEP_TABS = [['profile', 'profile'], ['design', 'design'], ['social', 'social'], ['profile', 'features'], ['sections', 'sections'], ['preview', 'preview']];

export default function OwnerPanel({ guildId, standalone = false }) {
  const t = useTranslations('community');
  const api = useCApi(`owner/${guildId}`);
  const err = api.error;
  return (
    <LoadingOrError loading={api.loading} error={err && api.status !== 403 ? err : null} data={api.data} onRetry={api.reload}>
      {api.status === 403 && !api.data ? <Card className="p-8 text-center"><p className="font-semibold">{t('owner.noAccess')}</p><p className="mt-1 text-sm text-muted-foreground">{t('owner.noAccessText')}</p></Card> : null}
      {api.data && !api.data.listing ? <CreateListing guildId={guildId} data={api.data} onCreated={api.reload} /> : null}
      {api.data?.listing ? <Editor guildId={guildId} data={api.data} api={api} standalone={standalone} /> : null}
    </LoadingOrError>
  );
}

function guildIcon(g) { return g?.icon ? discordCdnUrl(`https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png?size=128`) : null; }

function CreateListing({ guildId, data, onCreated }) {
  const t = useTranslations('community');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const g = data.guild;
  const create = async () => {
    setBusy(true); setError('');
    const r = await cfetch(`owner/${guildId}`, { method: 'POST', body: {} });
    setBusy(false);
    if (r.ok) { toast.success(t('owner.created')); onCreated(); } else setError(t.has(`errors.${r.data?.error}`) ? t(`errors.${r.data.error}`) : t('errors.generic'));
  };
  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="text-center">
        <Compass className="mx-auto mb-3 h-9 w-9 text-[#e08a4e]" aria-hidden="true" />
        <h2 className="text-2xl font-bold">{t('owner.createTitle')}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{t('owner.createText')}</p>
      </div>
      <Card className="p-5">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('owner.step', { current: 1, total: 8 })} · {t('wizard.server')}</p>
        <div className="flex items-center gap-4">
          {guildIcon(g) ? <img src={guildIcon(g)} alt="" className="h-16 w-16 rounded-2xl" /> : <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-secondary text-xl font-bold" aria-hidden="true">{g?.name?.slice(0, 1)}</div>}
          <dl className="grid flex-1 gap-1 text-sm">
            <div className="flex flex-wrap gap-x-2"><dt className="text-muted-foreground">{t('owner.serverName')}</dt><dd className="font-medium">{g?.name}</dd></div>
            <div className="flex flex-wrap gap-x-2"><dt className="text-muted-foreground">{t('owner.serverId')}</dt><dd className="font-mono">{g?.id}</dd></div>
            <div className="flex flex-wrap gap-x-2"><dt className="text-muted-foreground">{t('owner.permissions')}</dt><dd>{(g?.permissions || []).map((p) => t(`owner.perm.${p}`)).join(', ') || '-'}</dd></div>
          </dl>
        </div>
        <p className="mt-4 flex items-start gap-2 text-xs text-muted-foreground"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" aria-hidden="true" />{t('owner.verifyNote')}</p>
        {error ? <p role="alert" className="mt-3 text-sm text-red-400">{error}</p> : null}
        <Button onClick={create} disabled={busy} className="gradient-primary mt-5 w-full gap-2">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}{t('owner.createButton')}</Button>
      </Card>
    </div>
  );
}

function Editor({ guildId, data, api, standalone }) {
  const t = useTranslations('community');
  const [tab, setTab] = useState('overview');
  const [state, setState] = useState(data.listing);
  const [draft, setDraft] = useState(data.listing.content);
  const [errors, setErrors] = useState([]);
  const [saving, setSaving] = useState(false);
  const options = data.options;
  const perms = new Set(state.perms);
  const canEdit = perms.has('edit') && !state.locked && state.status !== 'suspended';
  const dirty = JSON.stringify(draft) !== JSON.stringify(state.content);
  const done = useMemo(() => completion(draft, options.settings), [draft, options.settings]);
  useEffect(() => { setState(data.listing); setDraft(data.listing.content); }, [data]);
  // Refresh the listing when a notification arrives, unless there are unsaved edits.
  const dirtyRef = useRef(false);
  dirtyRef.current = dirty;
  useEffect(() => {
    const onNotified = () => { if (!dirtyRef.current) api?.reload?.(); };
    window.addEventListener('wody:community-notified', onNotified);
    return () => window.removeEventListener('wody:community-notified', onNotified);
  }, [api]);

  // Editing a field drops the save errors that belong to it, so an old message
  // (for example "This invite belongs to another server") never sticks around
  // next to a value that was already corrected.
  const set = (patch) => {
    setDraft((d) => ({ ...d, ...patch }));
    const keys = Object.keys(patch || {});
    setErrors((prev) => (prev.length ? prev.filter((e) => !keys.some((k) => e?.field === k || String(e?.field || '').startsWith(`${k}.`))) : prev));
  };
  const adopt = (listing) => { setState(listing); setDraft(listing.content); };
  // Uploading an image must not discard unsaved text edits.
  const adoptImages = (listing) => { setState(listing); setDraft((d) => ({ ...d, banner_id: listing.content.banner_id, background_id: listing.content.background_id })); };

  const save = async () => {
    const patch = {};
    for (const k of Object.keys(draft)) if (JSON.stringify(draft[k]) !== JSON.stringify(state.content[k])) patch[k] = draft[k];
    delete patch.staff_roles; delete patch.banner_id; delete patch.background_id;
    if (!Object.keys(patch).length) return true;
    setSaving(true); setErrors([]);
    const r = await cfetch(`owner/${guildId}/content`, { method: 'PUT', body: patch });
    setSaving(false);
    if (r.ok) { adopt(r.data.listing); toast.success(t('owner.saved')); return true; }
    if (r.data?.error === 'validation_failed') setErrors(r.data.errors || []);
    else toast.error(t.has(`errors.${r.data?.error}`) ? t(`errors.${r.data.error}`) : t('errors.generic'));
    return false;
  };

  const [submitOpen, setSubmitOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [terms, setTerms] = useState(false);
  useEffect(() => { if (!submitOpen) setTerms(false); }, [submitOpen]);
  const submit = async () => {
    setSubmitting(true);
    if (dirty && !(await save())) { setSubmitting(false); setSubmitOpen(false); return; }
    const r = await cfetch(`owner/${guildId}/submit`, { method: 'POST', body: { accept_terms: terms } });
    setSubmitting(false); setSubmitOpen(false);
    if (r.ok) { adopt(r.data.listing); toast.success(t('owner.submitted')); setTab('status'); }
    else {
      const e = r.data?.error;
      toast.error(e === 'incomplete' ? t('owner.incompleteMissing', { fields: (r.data.missing || []).map((m) => t(`completion.${m}`)).join(', ') }) : (t.has(`errors.${e}`) ? t(`errors.${e}`, r.data?.extra || {}) : t('errors.generic')));
    }
  };

  const tabs = [
    { key: 'overview', label: t('owner.tabs.overview'), icon: LayoutList }, { key: 'profile', label: t('owner.tabs.profile'), icon: Users },
    { key: 'design', label: t('owner.tabs.design'), icon: Palette }, { key: 'sections', label: t('owner.tabs.sections'), icon: LayoutList },
    { key: 'social', label: t('owner.tabs.social'), icon: Link2 }, { key: 'preview', label: t('owner.tabs.preview'), icon: Eye },
    ...(perms.has('analytics') ? [{ key: 'analytics', label: t('owner.tabs.analytics'), icon: BarChart3 }] : []),
    { key: 'status', label: t('owner.tabs.status'), icon: Clock }, { key: 'history', label: t('owner.tabs.history'), icon: History },
    ...(perms.has('managers') ? [{ key: 'managers', label: t('owner.tabs.managers'), icon: UserCog }] : []),
  ];
  const canSubmit = perms.has('submit') && !state.locked && ['draft', 'changes_requested', 'rejected'].includes(state.status) || (perms.has('submit') && state.status === 'published' && state.update_state !== 'pending');

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex flex-wrap items-center gap-3 text-2xl font-bold">{t('owner.title')}<StatusBadge status={state.status} updateState={state.update_state} /></h2>
          <p className="mt-1 text-sm text-muted-foreground">{state.content.name} · {t(`owner.role.${state.role}`)}</p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <NotificationsBell />
          {state.status === 'published' ? <Button asChild variant="outline" className="min-w-0 flex-1 justify-center gap-2 sm:flex-none"><Link href={`/${state.url_prefix || 'server'}/${state.slug}`} target="_blank"><Eye className="h-4 w-4" aria-hidden="true" />{t('owner.viewPublic')}<ExternalLink className="h-3.5 w-3.5 opacity-70" aria-hidden="true" /></Link></Button> : null}
          {canSubmit ? <Button onClick={() => setSubmitOpen(true)} disabled={!done.ok} title={!done.ok ? t('owner.fixFirst') : undefined} className="gradient-primary min-w-0 flex-1 justify-center gap-2 sm:flex-none"><Send className="h-4 w-4" />{state.status === 'published' ? t('owner.submitChanges') : state.status === 'draft' ? t('owner.submit') : t('owner.resubmit')}</Button> : null}
        </div>
      </div>
      {state.locked ? <Card role="status" className="mb-5 border-amber-400/30 bg-amber-400/[0.05] p-4 text-sm"><Clock className="mr-2 inline h-4 w-4 text-amber-400" aria-hidden="true" />{t('owner.lockedNotice')}</Card> : null}
      {state.unavailable ? <Card role="alert" className="mb-5 border-red-400/30 bg-red-400/[0.05] p-4 text-sm"><AlertTriangle className="mr-2 inline h-4 w-4 text-red-400" aria-hidden="true" />{t('owner.unavailableNotice')}</Card> : null}
      {state.invite_status === 'invalid' ? <Card role="alert" className="mb-5 border-red-400/30 bg-red-400/[0.05] p-4 text-sm"><AlertTriangle className="mr-2 inline h-4 w-4 text-red-400" aria-hidden="true" />{t('owner.inviteUnavailable')}</Card> : null}
      <ModuleTabs tabs={tabs} active={tab} onChange={setTab} />

      {tab === 'overview' ? <Overview state={state} done={done} setTab={setTab} draft={draft} /> : null}
      {tab === 'profile' ? <OwnerProfile urlPrefix={state.url_prefix} guildId={guildId} draft={draft} set={set} options={options} errors={errors} disabled={!canEdit} /> : null}
      {tab === 'design' ? <OwnerDesign guildId={guildId} draft={draft} set={set} options={options} errors={errors} disabled={!canEdit} adopt={adoptImages} /> : null}
      {tab === 'sections' ? <OwnerSections draft={draft} set={set} options={options} disabled={!canEdit} /> : null}
      {tab === 'social' ? <OwnerSocial draft={draft} set={set} options={options} errors={errors} disabled={!canEdit} /> : null}
      {/* Always mounted: the preview frame loads in the background as soon as the
          editor opens, so the Preview tab (and every change after a save) is instant. */}
      <div className={tab === 'preview' ? '' : 'hidden'} aria-hidden={tab !== 'preview'}>
        <OwnerPreview draft={draft} state={state} options={options} guildId={guildId} active={tab === 'preview'} />
      </div>
      {tab === 'analytics' ? <Analytics guildId={guildId} /> : null}
      {tab === 'status' ? <StatusTab state={state} done={done} guildId={guildId} /> : null}
      {tab === 'history' ? <HistoryTab state={state} /> : null}
      {tab === 'managers' ? <Managers guildId={guildId} /> : null}

      {['profile', 'design', 'social', 'sections'].includes(tab) && canEdit ? (
        <div className="sticky bottom-3 z-20 mt-6">
          <Card className={`border p-3 shadow-lg backdrop-blur ${errors.length ? 'border-red-400/40 bg-background/95' : dirty ? 'border-[#e6cd8c]/50 bg-background/90' : 'border-border/50 bg-background/70'}`}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-2.5 text-sm" role="status">
                {errors.length ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-red-400/40 bg-red-500/10 px-3 py-1 font-medium text-red-300"><XCircle className="h-4 w-4" aria-hidden="true" />{t('owner.fixErrors', { count: errors.length })}</span>
                ) : dirty ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-[#e6cd8c]/50 bg-[#e6cd8c]/10 px-3 py-1 font-medium text-[#f0c08e]"><CircleDot className="h-4 w-4" aria-hidden="true" />{t('owner.unsaved')}</span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/40 bg-emerald-500/10 px-3 py-1 font-medium text-emerald-300"><CheckCircle2 className="h-4 w-4" aria-hidden="true" />{t('owner.allSaved')}</span>
                )}
                <span className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-secondary/30 px-3 py-1 text-xs">
                  <span className="text-muted-foreground">{t('completion.label')}</span>
                  <span className="h-1.5 w-16 overflow-hidden rounded-full bg-secondary" aria-hidden="true"><span className={`block h-full rounded-full ${done.percent >= 100 ? 'bg-emerald-400' : 'bg-[#e08a4e]'}`} style={{ width: `${done.percent}%` }} /></span>
                  <span className={`font-semibold tabular-nums ${done.percent >= 100 ? 'text-emerald-300' : 'text-[#f0c08e]'}`}>{done.percent}%</span>
                </span>
              </div>
              <div className="flex justify-end gap-2">
                {dirty ? <Button variant="outline" onClick={() => { setDraft(state.content); setErrors([]); }} disabled={saving}>{t('common.discard')}</Button> : null}
                <Button onClick={save} disabled={!dirty || saving} className="gradient-primary">{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}{t('common.save')}</Button>
              </div>
            </div>
            {errors.length ? <SaveErrors errors={errors} onGo={setTab} /> : null}
          </Card>
        </div>
      ) : null}
      <ConfirmDialog open={submitOpen} onOpenChange={setSubmitOpen} destructive={false} title={t('owner.submitConfirmTitle')} description={t('owner.submitConfirmText')} confirmLabel={t('owner.submit')} onConfirm={submit} busy={submitting} confirmDisabled={!terms}>
        <label className="flex items-start gap-2.5 rounded-lg border border-border/60 bg-secondary/30 p-3 text-sm">
          <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-[#c46a2d]" />
          <span>{t.rich('owner.terms.label', {
            terms: (c) => <Link href="/terms" target="_blank" className="text-[#e08a4e] underline">{c}</Link>,
            privacy: (c) => <Link href="/privacy" target="_blank" className="text-[#e08a4e] underline">{c}</Link>,
          })}</span>
        </label>
      </ConfirmDialog>
    </div>
  );
}

// Which editor tab holds a field, so each listed error can jump straight to it.
function tabOfField(field = '') {
  if (field.startsWith('socials')) return 'social';
  if (field.startsWith('sections')) return 'sections';
  if (field.startsWith('theme') || field.startsWith('banner') || field.startsWith('background')) return 'design';
  return 'profile';
}

// Readable name of a field from the validation errors ("socials.youtube", "theme.primary", "name"...).
function useFieldLabel() {
  const t = useTranslations('community');
  return (field = '') => {
    const [head, sub] = field.split('.');
    if (head === 'socials' && sub && t.has(`social.${sub}`)) return t(`social.${sub}`);
    if (head === 'theme' && sub) {
      if (t.has(`fields.color_${sub}`)) return t(`fields.color_${sub}`);
      if (t.has(`fields.${sub}`)) return t(`fields.${sub}`);
    }
    if (t.has(`fields.${head}`)) return t(`fields.${head}`);
    return field;
  };
}

// The problems behind "Fix N errors before saving", listed in their own box under the save bar.
function SaveErrors({ errors, onGo }) {
  const { errorText } = useErrorText();
  const label = useFieldLabel();
  return (
    <ul role="alert" className="mt-3 max-h-48 space-y-1.5 overflow-y-auto rounded-lg border border-red-400/35 bg-red-500/[0.07] p-3">
      {errors.map((e, i) => (
        <li key={`${e.field}-${e.code}-${i}`}>
          <button type="button" onClick={() => onGo(tabOfField(e.field))} className="flex w-full items-start gap-2 rounded-md px-1 py-0.5 text-left text-sm text-red-300 hover:bg-red-500/10">
            <XCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="min-w-0"><span className="font-semibold text-red-200">{label(e.field)}</span><span className="text-red-300/90"> · {errorText(e)}</span></span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function Overview({ state, done, setTab, draft }) {
  const t = useTranslations('community');
  const steps = [
    ['server', true, 'overview'], ['profile', Boolean(draft.name && draft.description && draft.category), 'profile'], ['design', Boolean(draft.banner_id), 'design'],
    ['social', Boolean(Object.keys(draft.socials || {}).length), 'social'], ['features', Boolean(draft.features?.length), 'profile'],
    ['sections', true, 'sections'], ['preview', true, 'preview'], ['submit', state.status !== 'draft', 'status'],
  ];
  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
      <div className="space-y-5">
        <Card className="p-5">
          <div className="flex items-center justify-between gap-3"><h3 className="font-semibold">{t('completion.title', { percent: done.percent })}</h3><span className="text-sm text-muted-foreground">{done.ok ? t('completion.ready') : t('completion.notReady')}</span></div>
          <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-secondary" role="progressbar" aria-valuenow={done.percent} aria-valuemin={0} aria-valuemax={100} aria-label={t('completion.label')}><div className="h-full rounded-full bg-gradient-to-r from-[#e6cd8c] to-[#e6cd8c] transition-all motion-reduce:transition-none" style={{ width: `${done.percent}%` }} /></div>
          {done.missing.some((m) => m.required) ? (
            <div className="mt-4"><p className="text-sm font-medium">{t('completion.missing')}</p>
              <ul className="mt-2 space-y-1">{done.missing.filter((m) => m.required).map((m) => (
                <li key={m.key} className="flex items-center gap-2 text-sm"><AlertTriangle className="h-3.5 w-3.5 text-amber-400" aria-hidden="true" />{t(`completion.${m.key}`)}</li>
              ))}</ul></div>
          ) : <p className="mt-4 flex items-center gap-2 text-sm text-emerald-400"><CheckCircle2 className="h-4 w-4" aria-hidden="true" />{t('completion.complete')}</p>}
        </Card>
        {state.last_review ? <ReviewMessage review={state.last_review} /> : null}
      </div>
      <Card className="p-5">
        <h3 className="mb-3 font-semibold">{t('owner.setup')}</h3>
        <ol className="space-y-2">
          {steps.map(([key, ok, target], i) => (
            <li key={key}><button type="button" onClick={() => setTab(target)} className="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-secondary/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#e6cd8c]">
              <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs ${ok ? 'bg-emerald-500/20 text-emerald-400' : 'bg-secondary text-muted-foreground'}`}>{ok ? <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> : i + 1}</span>{t(`wizard.${key}`)}
            </button></li>
          ))}
        </ol>
        <dl className="mt-5 grid grid-cols-2 gap-3 border-t border-border/50 pt-4 text-sm">
          <div><dt className="text-muted-foreground">{t('analytics.favorites')}</dt><dd className="text-lg font-semibold">{state.counters.favorites}</dd></div>
          <div><dt className="text-muted-foreground">{t('analytics.reviews')}</dt><dd className="text-lg font-semibold">{state.counters.reviews}</dd></div>
        </dl>
      </Card>
    </div>
  );
}

export function ReviewMessage({ review }) {
  const t = useTranslations('community');
  const tone = review.type === 'approved' ? 'border-emerald-400/30 bg-emerald-500/[0.05]' : 'border-amber-400/30 bg-amber-400/[0.05]';
  return (
    <Card className={`p-5 ${tone}`} role="status">
      <h3 className="font-semibold">{t(`review.${review.type}`)}</h3>
      {review.reason ? <p className="mt-1 text-sm text-muted-foreground">{t(`reject.${review.reason}`)}</p> : null}
      {review.fields?.length ? <p className="mt-2 flex flex-wrap gap-1.5">{review.fields.map((f) => <Badge key={f} variant="secondary">{t(`changeAreas.${f}`)}</Badge>)}</p> : null}
      {review.message ? <p className="mt-2 whitespace-pre-line break-words rounded-lg bg-black/20 p-3 text-sm">{review.message}</p> : null}
    </Card>
  );
}

function StatusTab({ state, done, guildId }) {
  const t = useTranslations('community');
  const [delOpen, setDelOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const remove = async () => {
    setDeleting(true);
    const r = await cfetch(`owner/${guildId}/listing`, { method: 'DELETE' });
    setDeleting(false); setDelOpen(false);
    if (r.ok) { toast.success(t('owner.delete.done')); window.location.reload(); }
    else toast.error(t.has(`errors.${r.data?.error}`) ? t(`errors.${r.data.error}`) : t('errors.generic'));
  };
  const locale = useLocale();
  const fmt = (d) => (d ? new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(d)) : '-');
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card className="p-5">
        <div className="flex items-center gap-3"><StatusBadge status={state.status} updateState={state.update_state} large /></div>
        <p className="mt-3 text-sm text-muted-foreground">{t(`statusText.${state.update_state === 'pending' ? 'update_pending' : state.update_state === 'changes_requested' ? 'update_changes' : state.status}`)}</p>
        {state.status === 'pending_review' || state.update_state === 'pending' ? <p className="mt-3 rounded-lg bg-secondary/40 p-3 text-sm">{t('owner.submittedMessage')}</p> : null}
        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between gap-3"><dt className="text-muted-foreground">{t('status.submittedAt')}</dt><dd>{fmt(state.submitted_at)}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-muted-foreground">{t('status.updatedAt')}</dt><dd>{fmt(state.updated_at)}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-muted-foreground">{t('status.version')}</dt><dd><VersionPill n={state.version || 0} /></dd></div>
          {state.published_at ? <div className="flex justify-between gap-3"><dt className="text-muted-foreground">{t('status.publishedAt')}</dt><dd>{fmt(state.published_at)}</dd></div> : null}
        </dl>
      </Card>
      <div className="space-y-5">
        {state.last_review ? <ReviewMessage review={state.last_review} /> : <Card className="p-5 text-sm text-muted-foreground">{t('status.noMessage')}</Card>}
        <Card className="p-5"><h3 className="mb-2 text-sm font-semibold">{t('status.legend')}</h3>
          <ul className="space-y-1.5 text-xs text-muted-foreground">{['draft', 'pending_review', 'changes_requested', 'approved', 'published', 'rejected', 'suspended', 'unpublished'].map((s) => <li key={s} className="flex items-start gap-2"><StatusBadge status={s} /><span>{t(`statusText.${s}`)}</span></li>)}</ul>
        </Card>
        {state.can_delete ? (
          <Card className="border-red-500/30 p-5">
            <h3 className="text-sm font-semibold">{t('owner.delete.title')}</h3>
            <p className="mt-1 text-xs text-muted-foreground">{t('owner.delete.text')}</p>
            <Button variant="outline" onClick={() => setDelOpen(true)} className="mt-3 gap-2 border-red-500/40 text-red-400"><Trash2 className="h-4 w-4" />{t('owner.delete.button')}</Button>
          </Card>
        ) : null}
      </div>
      <ConfirmDialog open={delOpen} onOpenChange={setDelOpen} title={t('owner.delete.confirmTitle')} description={t('owner.delete.confirmText')} confirmLabel={t('owner.delete.confirm')} onConfirm={remove} busy={deleting} />
    </div>
  );
}

export function VersionPill({ n, current = false }) {
  const t = useTranslations('community');
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[11px] font-semibold ${current ? 'border-[#e6cd8c]/50 bg-[#e6cd8c]/15 text-[#f0c08e]' : 'border-border/70 bg-secondary/40 text-foreground/90'}`}>
      <GitCommitHorizontal className="h-3 w-3" aria-hidden="true" />{t('status.version')} {n}
    </span>
  );
}

const CHANGE_STYLE = {
  '+': [Plus, 'border-emerald-400/35 bg-emerald-500/10 text-emerald-300', 'added'],
  '-': [Minus, 'border-red-400/35 bg-red-500/10 text-red-300', 'removed'],
  '~': [Pencil, 'border-amber-400/35 bg-amber-500/10 text-amber-200', 'changed'],
};

function HistoryTab({ state }) {
  const t = useTranslations('community');
  const latest = state.versions.length ? Math.max(...state.versions.map((v) => v.version)) : null;
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card className="p-5"><h3 className="mb-5 flex items-center gap-2 font-semibold"><History className="h-4 w-4 text-[#e08a4e]" aria-hidden="true" />{t('history.timeline')}</h3><Timeline items={state.timeline} /></Card>
      <Card className="p-5">
        <h3 className="mb-5 flex items-center gap-2 font-semibold"><GitCommitHorizontal className="h-4 w-4 text-[#e08a4e]" aria-hidden="true" />{t('history.versions')}</h3>
        {state.versions.length === 0 ? <p className="text-sm text-muted-foreground">{t('history.noVersions')}</p> : (
          <ul className="space-y-3">{state.versions.map((v) => (
            <li key={v.version} className="rounded-xl border border-border/60 bg-secondary/10 p-3">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <VersionPill n={v.version} current={v.version === latest} />
                {v.version === latest ? <span className="text-[11px] font-semibold uppercase tracking-wide text-[#e08a4e]">{t('history.current')}</span> : null}
              </div>
              {v.changes.length ? (
                <ul className="flex flex-wrap gap-1.5">{v.changes.map((c, i) => {
                  const [Icon, tone, word] = CHANGE_STYLE[c.op] || CHANGE_STYLE['~'];
                  return (
                    <li key={i} className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs ${tone}`} title={t(`history.${word}`)}>
                      <Icon className="h-3 w-3" aria-hidden="true" /><span className="sr-only">{t(`history.${word}`)}: </span>
                      {t(`fields.${c.field.split('.')[0]}`)}{c.field.startsWith('socials.') ? ` (${t(`social.${c.field.split('.')[1]}`)})` : ''}
                    </li>
                  );
                })}</ul>
              ) : <p className="text-xs text-muted-foreground">{t('history.noChanges')}</p>}
            </li>
          ))}</ul>
        )}
      </Card>
    </div>
  );
}

function Analytics({ guildId }) {
  const t = useTranslations('community');
  const [range, setRange] = useState(30);
  const api = useCApi(`owner/${guildId}/analytics?range=${range}`);
  const [Chart, setChart] = useState(null);
  useEffect(() => { import('@/components/community/AnalyticsChart').then((m) => setChart(() => m.default)); }, []);
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex max-w-2xl items-start gap-2 rounded-xl border border-border/60 bg-secondary/20 px-3 py-2 text-sm text-muted-foreground"><Info className="mt-0.5 h-4 w-4 shrink-0 text-[#e08a4e]" aria-hidden="true" />{t('analytics.note')}</p>
        <div className="max-w-[10rem]"><NativeSelect value={range} onChange={(v) => setRange(Number(v))} label={t('analytics.range')} options={[7, 30, 90].map((n) => ({ value: n, label: t('analytics.days', { count: n }) }))} /></div>
      </div>
      <LoadingOrError loading={api.loading} error={api.error} data={api.data} onRetry={api.reload}>
        {api.data?.disabled ? <Card className="p-6 text-sm text-muted-foreground">{t('analytics.disabled')}</Card> : api.data ? (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
              {[['views', api.data.totals.views], ['uniques', api.data.totals.uniques], ['invite_clicks', api.data.totals.invite_clicks], ['favorites', api.data.totals.favorites], ['reviews', api.data.totals.reviews]].map(([k, v]) => (
                <Card key={k} className="p-4"><div className="text-xs text-muted-foreground">{t(`analytics.${k}`)}</div><div className="mt-1 text-2xl font-semibold">{v}</div></Card>
              ))}
            </div>
            <Card className="p-4">{Chart ? <Chart data={api.data.series} series={['views', 'uniques', 'invite_clicks']} labelFor={(k) => t(`analytics.${k}`)} /> : <div className="h-64" />}</Card>
          </>
        ) : null}
      </LoadingOrError>
    </div>
  );
}

const ID_RE = /^\d{17,20}$/;
const ROLE_ICON = { manager: UserCog, editor: Pencil, analytics: BarChart3 };
const samePerms = (a, b) => a.length === b.length && a.every((p) => b.includes(p));

function PermToggle({ perm, checked, onChange, disabled, compact = false }) {
  const t = useTranslations('community');
  return (
    <label className={`flex cursor-pointer items-start gap-3 rounded-lg border p-2.5 transition ${checked ? 'border-[#e6cd8c]/50 bg-[#e6cd8c]/10' : 'border-border/60 hover:bg-secondary/30'} ${disabled ? 'pointer-events-none opacity-60' : ''}`}>
      <input type="checkbox" checked={checked} onChange={onChange} disabled={disabled} className="mt-0.5 h-4 w-4 shrink-0 accent-[#e6cd8c]" />
      <span className="min-w-0">
        <span className="block text-sm font-medium">{t(`managers.perm.${perm}`)}</span>
        {!compact ? <span className="block text-xs text-muted-foreground">{t(`managers.permDesc.${perm}`)}</span> : null}
      </span>
    </label>
  );
}

function ManagerRow({ m, guildId, onChanged, onRemove }) {
  const t = useTranslations('community');
  const locale = useLocale();
  const [role, setRole] = useState(m.role);
  const [perms, setPerms] = useState(m.permissions);
  const [saving, setSaving] = useState(false);
  const dirty = role !== m.role || !samePerms(perms, m.permissions);
  const save = async () => {
    setSaving(true);
    const r = await cfetch(`owner/${guildId}/managers`, { method: 'PATCH', body: { user_id: m.user_id, role, permissions: perms } });
    setSaving(false);
    if (r.ok) { toast.success(t('managers.saved')); onChanged(); } else toast.error(t('errors.generic'));
  };
  const Icon = ROLE_ICON[role] || Users;
  const initial = (m.name || m.user_id).slice(0, 1).toUpperCase();
  return (
    <li className="rounded-xl border border-border/60 bg-secondary/10 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#e6cd8c]/20 font-bold text-[#f0c08e]" aria-hidden="true">{initial}</span>
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium">{m.name || m.user_id}</div>
          <div className="truncate font-mono text-xs text-muted-foreground">{m.user_id}{m.added_at ? <span className="font-sans"> · {t('managers.addedOn', { date: new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(m.added_at)) })}</span> : null}</div>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-background/40 px-2.5 py-1 text-xs font-medium"><Icon className="h-3.5 w-3.5 text-[#e08a4e]" aria-hidden="true" />{samePerms(perms, ROLE_PRESETS[role] || []) ? t(`owner.role.${role}`) : t('managers.custom')}</span>
        <Button size="icon" variant="ghost" onClick={() => onRemove(m.user_id)} aria-label={t('managers.remove')} title={t('managers.remove')}><Trash2 className="h-4 w-4 text-red-400" /></Button>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-[12rem_1fr]">
        <NativeSelect value={role} onChange={(v) => { setRole(v); setPerms(ROLE_PRESETS[v]); }} label={t('managers.role')} options={MANAGER_ROLES.map((r) => ({ value: r, label: t(`owner.role.${r}`) }))} />
        <div className="grid gap-2 sm:grid-cols-3">
          {MANAGER_PERMISSIONS.map((p) => <PermToggle key={p} perm={p} compact checked={perms.includes(p)} onChange={() => setPerms((x) => (x.includes(p) ? x.filter((y) => y !== p) : [...x, p]))} />)}
        </div>
      </div>
      {dirty ? (
        <div className="mt-3 flex justify-end gap-2">
          <Button size="sm" variant="outline" onClick={() => { setRole(m.role); setPerms(m.permissions); }} disabled={saving}>{t('common.discard')}</Button>
          <Button size="sm" className="gradient-primary" onClick={save} disabled={saving || !perms.length}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}{t('common.save')}</Button>
        </div>
      ) : null}
    </li>
  );
}

function Managers({ guildId }) {
  const t = useTranslations('community');
  const api = useCApi(`owner/${guildId}/managers`);
  const [form, setForm] = useState({ user_id: '', role: 'editor', permissions: ROLE_PRESETS.editor });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [removing, setRemoving] = useState(null);
  const items = api.data?.items || [];
  const max = api.data?.max || 10;
  const idOk = ID_RE.test(form.user_id);
  const full = items.length >= max;
  const togglePerm = (p) => setForm((f) => ({ ...f, permissions: f.permissions.includes(p) ? f.permissions.filter((x) => x !== p) : [...f.permissions, p] }));
  const add = async () => {
    setBusy(true); setErr('');
    const r = await cfetch(`owner/${guildId}/managers`, { method: 'POST', body: form });
    setBusy(false);
    if (r.ok) { toast.success(t('managers.added')); setForm({ user_id: '', role: 'editor', permissions: ROLE_PRESETS.editor }); api.reload(); }
    else setErr(r.data?.errors?.[0] ? t(`errors.${r.data.errors[0].code}`) : t.has(`errors.${r.data?.error}`) ? t(`errors.${r.data.error}`) : t('errors.generic'));
  };
  const remove = async () => {
    const r = await cfetch(`owner/${guildId}/managers?user_id=${removing}`, { method: 'DELETE' });
    setRemoving(null);
    if (r.ok) { toast.success(t('managers.removed')); api.reload(); } else toast.error(t('errors.generic'));
  };
  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_24rem]">
      <Card className="p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 font-semibold"><Users className="h-4 w-4 text-[#e08a4e]" aria-hidden="true" />{t('managers.title')}</h3>
          {api.data ? <span className="rounded-full border border-border/70 bg-secondary/30 px-2.5 py-0.5 text-xs tabular-nums text-muted-foreground">{t('managers.count', { count: items.length, max })}</span> : null}
        </div>
        <LoadingOrError loading={api.loading} error={api.error} data={api.data} onRetry={api.reload}>
          {items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border/70 p-8 text-center text-sm text-muted-foreground"><UserPlus className="h-6 w-6 text-[#e08a4e]" aria-hidden="true" />{t('managers.empty')}</div>
          ) : (
            <ul className="space-y-3">{items.map((m) => <ManagerRow key={`${m.user_id}:${m.role}:${m.permissions.join(',')}`} m={m} guildId={guildId} onChanged={api.reload} onRemove={setRemoving} />)}</ul>
          )}
        </LoadingOrError>
        <p className="mt-4 flex items-start gap-2 text-xs text-muted-foreground"><ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" aria-hidden="true" />{t('managers.note')}</p>
      </Card>
      <Card className="h-fit p-5">
        <h3 className="mb-4 flex items-center gap-2 font-semibold"><UserPlus className="h-4 w-4 text-[#e08a4e]" aria-hidden="true" />{t('managers.add')}</h3>
        <label className="mb-1 block text-sm font-medium" htmlFor="mgr-id">{t('managers.userId')}</label>
        <Input id="mgr-id" inputMode="numeric" autoComplete="off" value={form.user_id} aria-invalid={form.user_id.length > 0 && !idOk} onChange={(e) => setForm({ ...form, user_id: e.target.value.replace(/\D/g, '').slice(0, 20) })} placeholder="123456789012345678" className={form.user_id.length > 0 && !idOk ? 'border-red-400/60' : ''} />
        <p className={`mt-1 text-xs ${form.user_id.length > 0 && !idOk ? 'text-red-400' : 'text-muted-foreground'}`}>{form.user_id.length > 0 && !idOk ? t('managers.idInvalid') : t('managers.userIdHint')}</p>
        <fieldset className="mt-4"><legend className="mb-1.5 text-sm font-medium">{t('managers.role')}</legend>
          <div className="space-y-2">{MANAGER_ROLES.map((r) => {
            const Icon = ROLE_ICON[r];
            const on = form.role === r;
            return (
              <label key={r} className={`flex cursor-pointer items-start gap-3 rounded-lg border p-2.5 transition ${on ? 'border-[#e6cd8c]/60 bg-[#e6cd8c]/10' : 'border-border/60 hover:bg-secondary/30'}`}>
                <input type="radio" name="mgr-role" checked={on} onChange={() => setForm({ ...form, role: r, permissions: ROLE_PRESETS[r] })} className="mt-1 accent-[#e6cd8c]" />
                <Icon className="mt-0.5 h-4 w-4 shrink-0 text-[#e08a4e]" aria-hidden="true" />
                <span className="min-w-0"><span className="block text-sm font-medium">{t(`owner.role.${r}`)}</span><span className="block text-xs text-muted-foreground">{t(`managers.roleDesc.${r}`)}</span></span>
              </label>
            );
          })}</div>
        </fieldset>
        <fieldset className="mt-4"><legend className="mb-1.5 text-sm font-medium">{t('managers.permissions')}</legend>
          <div className="space-y-2">{MANAGER_PERMISSIONS.map((p) => <PermToggle key={p} perm={p} checked={form.permissions.includes(p)} onChange={() => togglePerm(p)} />)}</div>
        </fieldset>
        {err ? <p role="alert" className="mt-3 rounded-lg border border-red-400/30 bg-red-500/10 p-2.5 text-sm text-red-300">{err}</p> : null}
        <Button onClick={add} disabled={busy || !idOk || !form.permissions.length || full} className="gradient-primary mt-4 w-full gap-2">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}{t('managers.addButton')}</Button>
      </Card>
      <ConfirmDialog open={Boolean(removing)} onOpenChange={(o) => { if (!o) setRemoving(null); }} title={t('managers.removeTitle')} description={t('managers.removeText')} confirmLabel={t('managers.remove')} onConfirm={remove} />
    </div>
  );
}

export function NotificationsBell({ admin = false }) {
  const t = useTranslations('community');
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const path = admin ? 'admin/notifications' : 'owner/notifications';
  const api = useCApi(path);
  const unread = api.data?.unread || 0;
  const reload = api.reload;
  // Live updates: refresh right after any change made here, when the tab
  // comes back into view, and every few seconds while it is visible (for
  // decisions made by someone else), so nothing waits for a page refresh.
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    let timer = null;
    const refresh = () => { if (document.visibilityState === 'visible') reload(); };
    const soon = () => { clearTimeout(timer); timer = setTimeout(reload, 250); };
    window.addEventListener(COMMUNITY_CHANGED, soon);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    const poll = setInterval(refresh, 10000);
    return () => {
      clearTimeout(timer); clearInterval(poll);
      window.removeEventListener(COMMUNITY_CHANGED, soon);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [reload]);
  // A new notification (approved, rejected, changes requested...) also
  // refreshes the open listing, so its status updates on screen at once.
  const lastUnread = useRef(null);
  useEffect(() => {
    if (api.data == null) return;
    if (lastUnread.current !== null && unread > lastUnread.current) window.dispatchEvent(new Event('wody:community-notified'));
    lastUnread.current = unread;
  }, [api.data, unread]);
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);
  const markRead = async () => {
    lastUnread.current = 0;
    // Clear the badge at once, then confirm with the server.
    api.setData((d) => (d ? { ...d, unread: 0 } : d));
    await cfetch(path, { method: 'POST' }); reload();
  };
  return (
    <div className="relative">
      <Button variant="outline" size="icon" onClick={() => { setOpen((o) => !o); if (!open && unread) markRead(); }} aria-expanded={open} aria-label={t('notifications.title', { count: unread })} className="relative">
        <Bell className="h-4 w-4" />{unread ? <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">{unread}</span> : null}
      </Button>
      {open ? (
        <>
        {/* Tap outside to close. On phones the list is a sheet pinned to the top of the screen (an absolute box
            anchored to the small bell button slid off the edge of the screen when the bell wrapped to the left). */}
        <button type="button" tabIndex={-1} aria-hidden="true" onClick={() => setOpen(false)} className="fixed inset-0 z-40 cursor-default bg-black/40 sm:bg-transparent" />
        <div role="dialog" aria-label={t('notifications.heading')} className="fixed inset-x-3 top-16 z-50 max-h-[75vh] overflow-hidden rounded-xl border border-border bg-popover p-2 shadow-xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-80 sm:max-w-[85vw]">
          <p className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('notifications.heading')}</p>
          {(api.data?.items || []).length === 0 ? <p className="p-3 text-sm text-muted-foreground">{t('notifications.empty')}</p> : (
            <ul className="max-h-[60vh] overflow-y-auto sm:max-h-80">{api.data.items.map((n) => (
              <li key={n.id} className="rounded-lg px-2 py-2 text-sm hover:bg-secondary/50"><p className="font-medium">{t(`notifications.types.${n.type}`, { name: n.name || n.slug || '' })}</p>{n.params?.message ? <p className="line-clamp-2 text-xs text-muted-foreground">{n.params.message}</p> : null}<time className="text-[11px] text-muted-foreground" dateTime={n.at}>{new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(n.at))}</time></li>
            ))}</ul>
          )}
        </div>
        </>
      ) : null}
    </div>
  );
}

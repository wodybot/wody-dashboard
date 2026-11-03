'use client';
import PolicyConsent from '@/components/profile/PolicyConsent';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
  Ban, Briefcase, Check, IdCard, Link2, CircleCheck, Clock, History, Hourglass, Info, Lock, MessageSquare, Pause, Pencil, Plus,
  Send, Server as ServerIcon, Settings, ShieldAlert, Trash2, UserRound, Eye, EyeOff, LayoutDashboard, Globe, TreePalm, Heart, X, Palette,
} from 'lucide-react';
import { Footer, TopNav } from '@/components/nav';
import { Link } from '@/i18n/navigation';
import { discordCdnUrl } from '@/lib/utils';
import { mfetch, fmtDate } from '@/components/collab/client';
import { errText } from '@/components/collab/RequestActions';
import HumanCheck from '@/components/human-check';
import { Editor, Applications, MyApplications, ServersTab, PrefsTab, StatusChip, input, lab, btn, btnMain } from '@/components/collab/ProfileParts';
import SocialLinks, { SOCIAL_ICONS } from '@/components/profile/SocialLinks';
import ProfileCardTab from '@/components/profile/ProfileCardTab';
import ProfilePageTab from '@/components/profile/ProfilePageTab';
import ProfileCardPreview from '@/components/profile/ProfileCardPreview';
import { normalizeConfig } from '@/lib/profile-card';
import { SOCIALS, NOTIF_DEFAULTS, LIMITS } from '@/lib/collab/constants';

const TABS = [
  { id: 'requests', icon: Briefcase },
  { id: 'applications', icon: Send },
  { id: 'messages', icon: MessageSquare },
  { id: 'servers', icon: ServerIcon },
  { id: 'card', icon: IdCard },
  { id: 'page', icon: Palette },
  { id: 'settings', icon: Settings },
];

const TONE = {
  published: { box: 'border-emerald-400/35 bg-emerald-400/[0.06]', text: 'text-emerald-300', Icon: CircleCheck },
  assigned: { box: 'border-emerald-400/35 bg-emerald-400/[0.06]', text: 'text-emerald-300', Icon: CircleCheck },
  closed: { box: 'border-border/60 bg-card/40', text: 'text-muted-foreground', Icon: Pause },
  draft: { box: 'border-border/60 bg-card/40', text: 'text-muted-foreground', Icon: Pencil },
  pending_verification: { box: 'border-sky-400/35 bg-sky-400/[0.06]', text: 'text-sky-300', Icon: Clock },
  approved: { box: 'border-sky-400/35 bg-sky-400/[0.06]', text: 'text-sky-300', Icon: Clock },
  pending_review: { box: 'border-amber-400/35 bg-amber-400/[0.06]', text: 'text-amber-300', Icon: Hourglass },
  pending_server: { box: 'border-amber-400/35 bg-amber-400/[0.06]', text: 'text-amber-300', Icon: Hourglass },
  needs_changes: { box: 'border-amber-400/35 bg-amber-400/[0.06]', text: 'text-amber-300', Icon: Pencil },
  rejected: { box: 'border-red-400/40 bg-red-400/[0.07]', text: 'text-red-300', Icon: Ban },
  suspended: { box: 'border-red-400/40 bg-red-400/[0.07]', text: 'text-red-300', Icon: ShieldAlert },
  expired: { box: 'border-border/60 bg-card/40', text: 'text-muted-foreground', Icon: Clock },
};
const statusKey = (r) => (r.status === 'published' ? (r.accepted_application_id ? 'assigned' : r.closed_at ? 'closed' : 'published') : r.status);
const isVisible = (r) => r.status === 'published' && !r.closed_at && (!r.expires_at || new Date(r.expires_at) > new Date());

function Avatar({ identity }) {
  const src = identity?.avatar ? `https://cdn.discordapp.com/avatars/${identity.id}/${identity.avatar}.png?size=128` : 'https://cdn.discordapp.com/embed/avatars/0.png';
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={discordCdnUrl(src)} alt="" className="h-20 w-20 shrink-0 rounded-full border-2 border-[#e6cd8c]/60 object-cover sm:h-24 sm:w-24" />;
}

function Switch({ id, checked, onChange, label, hint, disabled = false }) {
  return (
    <label htmlFor={id} className={`flex items-start gap-3 rounded-xl border border-border/60 bg-card/40 p-3 ${disabled ? 'opacity-60' : 'cursor-pointer hover:border-border'}`}>
      <span className="relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center">
        <input id={id} type="checkbox" role="switch" className="peer sr-only" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
        <span aria-hidden="true" className="absolute inset-0 rounded-full border border-border bg-secondary transition-colors peer-checked:border-[#e6cd8c] peer-checked:bg-[#e6cd8c] peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[#e6cd8c]" />
        <span aria-hidden="true" className="absolute left-0.5 h-5 w-5 rounded-full bg-foreground transition-transform peer-checked:translate-x-5 peer-checked:bg-[#1a1208] motion-reduce:transition-none" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{label}</span>
        {hint && <span className="mt-0.5 block text-xs text-muted-foreground">{hint}</span>}
      </span>
    </label>
  );
}

function ProfileSkeleton({ label }) {
  const bar = 'rounded-md bg-muted/60 motion-safe:animate-pulse';
  return (
    <div role="status" aria-live="polite" aria-busy="true" className="space-y-5">
      <span className="sr-only">{label}</span>
      <div aria-hidden="true" className="rounded-3xl border border-border/50 bg-card/40 p-5 sm:p-7">
        <div className="flex items-center gap-4">
          <div className={`h-20 w-20 shrink-0 rounded-full ${bar}`} />
          <div className="min-w-0 flex-1 space-y-2.5">
            <div className={`h-7 w-40 max-w-full ${bar}`} />
            <div className={`h-4 w-28 ${bar}`} />
          </div>
        </div>
        <div className={`mt-5 h-4 w-full max-w-md ${bar}`} />
        <div className={`mt-4 h-10 w-full rounded-lg sm:w-56 ${bar}`} />
        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[0, 1, 2, 3].map((i) => <div key={i} className={`h-[76px] rounded-2xl ${bar}`} />)}
        </div>
      </div>
      <div aria-hidden="true" className="flex gap-2 overflow-hidden">
        {[28, 36, 24, 26, 30].map((w, i) => <div key={i} className={`h-10 shrink-0 rounded-full ${bar}`} style={{ width: `${w * 4}px` }} />)}
      </div>
      <div aria-hidden="true" className="space-y-3">
        {[0, 1].map((i) => <div key={i} className={`h-24 w-full rounded-2xl ${bar}`} />)}
      </div>
    </div>
  );
}

function Hero({ pf, onGoSettings }) {
  const t = useTranslations('profile');
  const tn = useTranslations('nav');
  const locale = useLocale();
  const id = pf.identity;
  const has = Object.keys(pf.socials || {}).length > 0;
  const stats = [
    { k: 'live', n: pf.stats.live },
    { k: 'requests', n: pf.stats.requests },
    { k: 'applications', n: pf.stats.applications },
    { k: 'unread', n: pf.stats.unread_messages },
  ];
  return (
    <section aria-label={t('hero.aria')} className="relative overflow-hidden rounded-3xl border border-[#e6cd8c]/25 bg-gradient-to-br from-[#e6cd8c]/[0.09] via-card/60 to-card/40 p-5 sm:p-7">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
        <div className="flex items-center gap-4">
          <Avatar identity={id} />
          <div className="min-w-0 sm:hidden">
            <h1 className="truncate text-2xl font-black">{id.name}</h1>
            <p className="truncate text-sm text-muted-foreground">@{id.username}</p>
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="hidden truncate text-3xl font-black sm:block">{id.name}</h1>
          <p className="hidden truncate text-sm text-muted-foreground sm:block">@{id.username}{pf.member_since ? ` · ${t('hero.memberSince', { date: fmtDate(pf.member_since, locale) })}` : ''}</p>
          {pf.away?.active && (
            <p data-away="on" className="mt-2 inline-flex max-w-full items-start gap-2 rounded-2xl border border-sky-400/40 bg-sky-400/10 px-3 py-2 text-sm text-sky-200">
              <TreePalm className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="min-w-0 break-words"><b>{t('away.badge')}</b>{pf.away.until ? ` · ${t('away.until', { date: fmtDate(pf.away.until, locale) })}` : ''}{pf.away.note ? <span className="block text-xs text-sky-100/90">{pf.away.note}</span> : null}</span>
            </p>
          )}
          <p className="mt-2 flex items-start gap-1.5 text-xs text-muted-foreground"><Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />{t('hero.discordNote')}</p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            {has ? <SocialLinks socials={pf.socials} label={t('hero.socialsAria')} /> : <p className="text-sm text-muted-foreground">{t('hero.noSocials')}</p>}
            <button type="button" onClick={onGoSettings} className={btn}><Pencil className="h-3.5 w-3.5" aria-hidden="true" />{has ? t('hero.editLinks') : t('hero.addLinks')}</button>
          </div>
          <div className="mt-4 flex w-full flex-col gap-2 sm:w-56">
            {pf.public_path && <Link href={pf.public_path} data-view-profile className={`${btnMain} h-10 w-full justify-center`}><Eye className="h-4 w-4" aria-hidden="true" />{t('hero.viewPublic')}</Link>}
            <Link href="/dashboard" className={`${pf.public_path ? btn : btnMain} h-10 w-full justify-center`}><LayoutDashboard className="h-4 w-4" aria-hidden="true" />{tn('dashboard')}</Link>
            <Link href="/servers/favorites" className={`${btn} h-10 w-full justify-center`}><Heart className="h-4 w-4 text-rose-300" aria-hidden="true" />{tn('resourceLinks.favorites.label')}</Link>
          </div>
        </div>
      </div>
      <dl className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.k} className="rounded-2xl border border-border/50 bg-background/40 px-3 py-2.5">
            <dd className="text-2xl font-black tabular-nums text-[#e6cd8c]">{s.n}</dd>
            <dt className="text-xs text-muted-foreground">{t(`stats.${s.k}`)}</dt>
          </div>
        ))}
      </dl>
    </section>
  );
}

function Fact({ label, value, icon: Icon }) {
  return (
    <div className="min-w-0 rounded-xl border border-border/50 bg-background/30 px-3 py-2">
      <dt className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">{Icon && <Icon className="h-3 w-3" aria-hidden="true" />}{label}</dt>
      <dd className="mt-0.5 break-words text-sm font-medium">{value}</dd>
    </div>
  );
}

function reasonText(t, reason) {
  if (!reason) return '';
  return reason === 'reports' ? t('suspended.reasons.reports') : reason;
}

function StatusPanel({ r }) {
  const t = useTranslations('profile');
  const tc = useTranslations('collab');
  const locale = useLocale();
  const key = statusKey(r);
  const tone = TONE[key] || TONE.draft;
  const { Icon } = tone;
  const visible = isVisible(r);
  const pending = r.pending_state && r.pending_state !== 'pending_verification' ? r.pending_state : null;
  const heldBy = (r.review_reasons || []).filter((x) => ['money', 'suspicious_content', 'guard_error', 'edit_policy', 'attachments', 'reports'].includes(x));
  const label = key === 'assigned' ? t('status.assigned') : key === 'closed' ? t('status.closed') : tc(`status.${key}`);
  const why = r.status === 'suspended' ? (r.suspended?.reason || r.decision?.reason) : (key === 'rejected' || key === 'needs_changes' ? r.decision?.reason : null);
  return (
    <div className={`mt-3 rounded-2xl border p-3.5 ${tone.box}`} data-status={key}>
      <div className="flex items-start gap-3">
        <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${tone.text}`} aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{t('requests.currentStatus')}</p>
          <p className={`text-base font-bold ${tone.text}`}>{label}</p>
          <p className="mt-1 text-sm text-foreground/90">{t(`statusInfo.${key}`)}</p>
        </div>
      </div>
      {r.status === 'suspended' && (
        <div className="mt-3 rounded-xl border border-red-400/30 bg-red-400/10 p-3 text-sm" role="alert">
          <p className="font-semibold text-red-200">{t('suspended.title')}</p>
          <p className="mt-1 text-red-100/90">{r.suspended?.automatic ? t('suspended.byReports') : t('suspended.byTeam')}{r.suspended?.at ? ` ${t('suspended.since', { date: fmtDate(r.suspended.at, locale) })}` : ''}</p>
          {why && <p className="mt-1 break-words"><b>{t('requests.reason')}:</b> {reasonText(t, why)}</p>}
          <p className="mt-2 text-xs text-red-100/80">{t('suspended.next')}</p>
        </div>
      )}
      {r.status !== 'suspended' && why && (
        <p className="mt-3 break-words rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 text-sm text-amber-100"><b>{t('requests.reason')}:</b> {reasonText(t, why)}</p>
      )}
      {(r.status === 'pending_review' || pending === 'pending_review') && heldBy.length > 0 && (
        <ul className="mt-3 list-disc space-y-0.5 pl-5 text-xs text-muted-foreground">{heldBy.map((x) => <li key={x}>{t(`heldBy.${x}`)}</li>)}</ul>
      )}
      {r.status === 'published' && pending && (
        <p className="mt-3 flex items-start gap-2 rounded-xl border border-border/60 bg-background/30 p-2.5 text-xs"><Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#e6cd8c]" aria-hidden="true" />{t('requests.pendingEdit', { state: tc(`status.${pending}`) })}</p>
      )}
      <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Fact icon={visible ? Eye : EyeOff} label={t('requests.visibility')} value={visible ? t('requests.visibleYes') : t('requests.visibleNo')} />
        <Fact label={t('requests.audience')} value={r.origin_guild_id ? t('requests.audienceServer', { name: r.origin_guild_name || r.origin_guild_id }) : t('requests.audienceAll')} />
        <Fact label={t('requests.applications')} value={String(r.applications)} />
        <Fact label={t('requests.updated')} value={r.updated_at ? fmtDate(r.updated_at, locale) : '-'} />
        {r.published_at && <Fact label={t('requests.publishedOn')} value={fmtDate(r.published_at, locale)} />}
        {r.expires_at && r.status === 'published' && <Fact label={r.closed_at ? t('requests.wouldExpire') : t('requests.expires')} value={fmtDate(r.expires_at, locale)} />}
        {r.expires_at && r.status === 'expired' && <Fact label={t('requests.expiredOn')} value={fmtDate(r.expires_at, locale)} />}
        {r.created_at && <Fact label={t('requests.created')} value={fmtDate(r.created_at, locale)} />}
      </dl>
    </div>
  );
}

function HistoryList({ id }) {
  const t = useTranslations('profile');
  const tc = useTranslations('collab');
  const locale = useLocale();
  const [data, setData] = useState(null);
  useEffect(() => { mfetch(`me/requests/${id}`).then((r) => setData(r.ok ? r.data : { decisions: [], versions: [] })); }, [id]);
  if (!data) return <p className="mt-2 text-xs text-muted-foreground">{tc('loading')}</p>;
  const rows = [
    ...(data.decisions || []).map((d) => ({ at: d.at, text: (typeof t.has === 'function' && t.has(`history.action.${d.action}`) ? t(`history.action.${d.action}`) : String(d.action)) + (d.scope ? ` (${t(`history.scope.${d.scope === 'server' ? 'server' : 'global'}`)})` : ''), reason: d.reason })),
    ...(data.versions || []).map((v) => ({ at: v.at, text: t('history.version', { n: v.n }) })),
  ].filter((x) => x.at).sort((a, b) => new Date(b.at) - new Date(a.at));
  if (!rows.length) return <p className="mt-2 text-xs text-muted-foreground">{t('history.none')}</p>;
  return (
    <ol className="mt-2 space-y-1.5 border-l border-border/60 pl-4">
      {rows.map((x, i) => (
        <li key={i} className="relative text-xs">
          <span className="absolute -left-[21px] top-1 h-2 w-2 rounded-full bg-[#e6cd8c]" aria-hidden="true" />
          <span className="font-medium">{x.text}</span><span className="text-muted-foreground"> · {fmtDate(x.at, locale)}</span>
          {x.reason && <span className="block break-words text-muted-foreground">{reasonText(t, x.reason)}</span>}
        </li>
      ))}
    </ol>
  );
}

function RequestCard({ r, onEdit, onApps, onAct, onRemove }) {
  const t = useTranslations('profile');
  const tc = useTranslations('collab');
  const [showHistory, setShowHistory] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const canEdit = r.status !== 'suspended' && r.status !== 'pending_verification';
  const canDelete = r.status !== 'suspended' && r.status !== 'pending_verification';
  const remove = async () => { setBusy(true); const ok = await onRemove(r); setBusy(false); if (ok) setConfirm(false); };
  return (
    <li className="rounded-2xl border border-border/60 bg-card/50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="break-words font-semibold">{r.title || tc('untitled')}</p>
        </div>
        <StatusChip status={r.status} pending={r.pending_state} />
      </div>
      <StatusPanel r={r} />
      <p className="mt-2 flex items-start gap-1.5 text-xs text-muted-foreground" data-audience={r.origin_guild_id ? 'server' : 'global'}>
        <Globe className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>{!r.origin_guild_id ? tc('audience.global') : (r.status === 'pending_server' || r.pending_state === 'pending_server') ? tc('audience.serverWaiting', { name: r.origin_guild_name || '' }) : tc('audience.server', { name: r.origin_guild_name || '' })}</span>
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {canEdit && <button className={btn} onClick={() => onEdit(r)}><Pencil className="h-3.5 w-3.5" aria-hidden="true" />{tc('requests.edit')}</button>}
        {r.status === 'published' && <Link className={btn} href={`/collab/${r.id}`}>{tc('view')}</Link>}
        {r.status === 'published' && <button className={btn} onClick={() => onApps(r)}>{tc('requests.applications', { n: r.applications })}</button>}
        {r.status === 'published' && !r.closed_at && <button className={btn} onClick={() => onAct(r.id, '/close')}>{tc('requests.close')}</button>}
        {r.status === 'published' && r.closed_at && !r.accepted_application_id && <button className={btn} onClick={() => onAct(r.id, '/reopen')}>{tc('requests.reopen')}</button>}
        {r.status === 'expired' && <button className={btn} onClick={() => onAct(r.id, '/renew')}>{tc('requests.renew')}</button>}
        {r.pending_state && r.pending_state !== 'pending_verification' && <button className={btn} onClick={() => onAct(r.id, '/discard')}>{tc('requests.discard')}</button>}
        {r.status !== 'draft' && <button className={btn} aria-expanded={showHistory} onClick={() => setShowHistory((v) => !v)}><History className="h-3.5 w-3.5" aria-hidden="true" />{t('requests.history')}</button>}
        {canDelete && <button className={`${btn} border-red-400/40 text-red-300 hover:border-red-400`} onClick={() => setConfirm(true)}><Trash2 className="h-3.5 w-3.5" aria-hidden="true" />{t('requests.delete')}</button>}
      </div>
      {r.status === 'suspended' && <p className="mt-2 text-xs text-muted-foreground">{t('requests.removeBlocked')}</p>}
      {showHistory && <HistoryList id={r.id} />}
      {confirm && (
        <div role="alertdialog" aria-label={t('requests.deleteTitle')} className="mt-3 rounded-xl border border-red-400/40 bg-red-400/10 p-3">
          <p className="text-sm font-semibold text-red-200">{t('requests.deleteTitle')}</p>
          <p className="mt-1 text-xs text-red-100/90">{r.status === 'draft' ? t('requests.deleteDraftText') : t('requests.deleteText')}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button className={`${btn} border-red-400/60 bg-red-500/20 text-red-100`} disabled={busy} onClick={remove}><Trash2 className="h-3.5 w-3.5" aria-hidden="true" />{t('requests.deleteYes')}</button>
            <button className={btn} disabled={busy} onClick={() => setConfirm(false)}>{t('requests.keep')}</button>
          </div>
        </div>
      )}
    </li>
  );
}

function CollabsTab({ data, reload, cats, guilds, locked }) {
  const t = useTranslations('profile');
  const tc = useTranslations('collab');
  const [view, setView] = useState(null);
  const [msg, setMsg] = useState({ ok: false, text: '' });
  const [initial, setInitial] = useState(null);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const q = new URLSearchParams(window.location.search);
    if (!q.get('new')) return;
    const guild = /^\d{15,25}$/.test(q.get('guild') || '') ? q.get('guild') : '';
    const category = /^[a-z][a-z0-9_]{2,39}$/.test(q.get('category') || '') ? q.get('category') : '';
    setInitial(guild ? { guild, category } : null);
    setView({ kind: 'edit', id: null });
  }, []);
  const act = async (id, path, method = 'POST') => { const r = await mfetch(`me/requests/${id}${path}`, { method }); setMsg({ ok: false, text: r.ok ? '' : errText(tc, r.data) }); reload(); };
  const remove = async (r) => {
    const res = await mfetch(`me/requests/${r.id}`, { method: 'DELETE' });
    setMsg({ ok: res.ok, text: res.ok ? t('requests.deleted') : errText(tc, res.data) });
    await reload();
    return res.ok;
  };
  const activeCount = data.requests.filter((r) => ['published', 'pending_review', 'pending_server', 'pending_verification'].includes(r.status)).length;
  if (view?.kind === 'edit') return <Editor id={view.id} cats={cats} guilds={guilds} initial={view.id ? null : initial} onClose={() => { setView(null); reload(); }} onSaved={reload} />;
  if (view?.kind === 'apps') return <Applications req={view.req} onClose={() => { setView(null); reload(); }} />;
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">{t('requests.title')}</h2>
        <button className={btnMain} onClick={() => setView({ kind: 'edit', id: null })} disabled={locked}><Plus className="h-4 w-4" aria-hidden="true" />{t('requests.new')}</button>
      </div>
      <p className="mb-3 text-xs text-muted-foreground" data-slots={activeCount}>{t('requests.slots', { used: activeCount, max: LIMITS.active })}</p>
      {msg.text && <p role={msg.ok ? 'status' : 'alert'} className={`mb-3 text-sm ${msg.ok ? 'text-emerald-300' : 'text-destructive'}`}>{msg.text}</p>}
      {data.requests.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground">{t('requests.none')}</p>
      ) : (
        <ul className="space-y-3">
          {data.requests.map((r) => <RequestCard key={r.id} r={r} onEdit={(x) => setView({ kind: 'edit', id: x.id })} onApps={(x) => setView({ kind: 'apps', req: x })} onAct={act} onRemove={remove} />)}
        </ul>
      )}
    </div>
  );
}

function MessagesTab({ reload }) {
  const t = useTranslations('profile');
  const tc = useTranslations('collab');
  const locale = useLocale();
  const [items, setItems] = useState(null);
  const [open, setOpen] = useState(null);
  const [reply, setReply] = useState({});
  const [passes, setPasses] = useState({});
  const [checkRound, setCheckRound] = useState(0);
  const [state, setState] = useState({ busy: false, text: '', ok: false });
  const [fresh, setFresh] = useState(new Set());
  const load = useCallback(async (first = false) => {
    const a = await mfetch('me/inbox');
    const list = a.ok ? a.data.items : [];
    setItems(list);
    if (first) setFresh(new Set(list.filter((m) => !m.mine && !m.read).map((m) => m.id)));
    if (a.ok) { await mfetch('me/inbox/read', { method: 'POST' }); reload(); }
  }, [reload]);
  useEffect(() => { load(true); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const threads = useMemo(() => {
    const by = new Map();
    for (const m of items || []) {
      const key = m.application_id || `v:${m.request_id}`;
      if (!by.has(key)) by.set(key, { key, applicationId: m.application_id, kind: m.application_id ? 'application' : 'visitor', title: m.title, other: m.other, items: [] });
      const th = by.get(key);
      th.items.push(m);
      if (!th.title && m.title) th.title = m.title;
    }
    const arr = [...by.values()].map((th) => {
      th.items.sort((x, y) => new Date(x.at) - new Date(y.at));
      th.last = th.items[th.items.length - 1];
      th.unread = th.items.some((m) => fresh.has(m.id));
      return th;
    });
    return arr.sort((x, y) => new Date(y.last.at) - new Date(x.last.at));
  }, [items, fresh]);

  const send = async (th) => {
    const body = (reply[th.key] || '').trim();
    if (!body || !passes[th.key]) return;
    setState({ busy: true, text: '', ok: false });
    const r = await mfetch(`me/applications/${th.applicationId}/message`, { method: 'POST', body: { body, pass: passes[th.key] } });
    setCheckRound((n) => n + 1);
    setState({ busy: false, ok: r.ok, text: r.ok ? t('messages.sent') : errText(tc, r.data) });
    if (r.ok) { setReply((x) => ({ ...x, [th.key]: '' })); load(); }
  };
  if (!items) return <p className="text-sm text-muted-foreground">{tc('loading')}</p>;
  const who = (m, th) => (m.mine ? t('messages.you') : m.kind === 'public' ? `${m.name || t('messages.visitor')} (${t('messages.visitor')})` : th.other && th.other !== 'author' ? th.other : t('messages.theAuthor'));
  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-2 text-lg font-semibold">{t('messages.title')}</h2>
        {threads.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground">{t('messages.none')}</p>
        ) : (
          <ul className="space-y-2.5">
            {threads.map((th) => {
              const isOpen = open === th.key;
              return (
                <li key={th.key} className={`rounded-2xl border ${th.unread ? 'border-[#e6cd8c]/50 bg-[#e6cd8c]/[0.05]' : 'border-border/60 bg-card/50'}`}>
                  <button type="button" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : th.key)} className="flex w-full items-start gap-3 rounded-2xl p-3.5 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e6cd8c]">
                    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border/60 bg-secondary/60">{th.kind === 'visitor' ? <UserRound className="h-4 w-4" aria-hidden="true" /> : <MessageSquare className="h-4 w-4" aria-hidden="true" />}</span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2"><span className="truncate text-sm font-semibold">{th.title || tc('untitled')}</span>{th.unread && <span className="shrink-0 rounded-full bg-[#e6cd8c] px-1.5 text-[10px] font-bold text-[#1a1208]">{t('messages.new')}</span>}</span>
                      <span className="block truncate text-xs text-muted-foreground">{who(th.last, th)} · {fmtDate(th.last.at, locale)}</span>
                      {!isOpen && <span className="mt-1 block truncate text-sm text-foreground/80">{th.last.body}</span>}
                    </span>
                  </button>
                  {isOpen && (
                    <div className="border-t border-border/50 p-3.5">
                      <ul className="space-y-2">
                        {th.items.map((m) => (
                          <li key={m.id} className={`max-w-[92%] rounded-2xl px-3 py-2 text-sm ${m.mine ? 'ml-auto bg-[#e6cd8c]/15 text-foreground' : 'bg-secondary/60'}`}>
                            <p className="text-[11px] text-muted-foreground">{who(m, th)} · {fmtDate(m.at, locale)}</p>
                            <p className="mt-0.5 whitespace-pre-wrap break-words">{m.body}</p>
                            {m.reply_to && <p className="mt-1 break-words text-xs text-muted-foreground">{t('messages.contactLeft')}: {m.reply_to}</p>}
                          </li>
                        ))}
                      </ul>
                      {th.applicationId ? (
                        <form className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap" onSubmit={(e) => { e.preventDefault(); send(th); }}>
                          <label className="sr-only" htmlFor={`rp-${th.key}`}>{t('messages.reply')}</label>
                          <textarea id={`rp-${th.key}`} rows={2} maxLength={1500} className={`${input} min-h-[44px] flex-1`} placeholder={t('messages.replyPlaceholder')} value={reply[th.key] || ''} onChange={(e) => setReply((x) => ({ ...x, [th.key]: e.target.value }))} />
                          <HumanCheck purpose="collab_message" ctx={String(th.applicationId)} resetKey={checkRound} onPass={(p) => setPasses((x) => ({ ...x, [th.key]: p }))} />
                          <button type="submit" className={`${btnMain} self-end`} disabled={state.busy || !passes[th.key] || (reply[th.key] || '').trim().length < 5}><Send className="h-4 w-4" aria-hidden="true" />{t('messages.send')}</button>
                        </form>
                      ) : <p className="mt-3 text-xs text-muted-foreground">{t('messages.visitorNote')}</p>}
                      {state.text && <p role={state.ok ? 'status' : 'alert'} className={`mt-2 text-sm ${state.ok ? 'text-emerald-300' : 'text-destructive'}`}>{state.text}</p>}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function AwayCard({ pf, onSaved }) {
  const t = useTranslations('profile');
  const tc = useTranslations('collab');
  const [on, setOn] = useState(Boolean(pf.away?.active));
  const [note, setNote] = useState(pf.away?.note || '');
  const [until, setUntil] = useState(pf.away?.until || '');
  const [state, setState] = useState({ busy: false, ok: false, text: '' });
  const save = async (e) => {
    e.preventDefault();
    setState({ busy: true, ok: false, text: '' });
    const r = await mfetch('me/profile', { method: 'PUT', body: { away: { on, note, until } } });
    if (r.ok) { setState({ busy: false, ok: true, text: t('away.saved') }); onSaved(); return; }
    const code = r.data?.errors?.[0]?.code;
    setState({ busy: false, ok: false, text: code && typeof tc.has === 'function' && tc.has(`err.${code}`) ? tc(`err.${code}`) : errText(tc, r.data) });
  };
  return (
    <form onSubmit={save} className="rounded-2xl border border-sky-400/25 bg-card/50 p-4 sm:p-5" noValidate>
      <h2 className="flex items-center gap-2 text-lg font-semibold"><TreePalm className="h-5 w-5 text-sky-300" aria-hidden="true" />{t('away.title')}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{t('away.text')}</p>
      <div className="mt-4"><Switch id="away-on" checked={on} onChange={setOn} label={t('away.switch')} hint={t('away.switchHint')} /></div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div><label htmlFor="away-note" className={lab}>{t('away.note')}</label><input id="away-note" className={input} maxLength={120} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('away.notePh')} /></div>
        <div><label htmlFor="away-until" className={lab}>{t('away.untilLabel')}</label><input id="away-until" type="date" className={input} value={until} onChange={(e) => setUntil(e.target.value)} /></div>
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">{t('away.visible')}</p>
      <div className="mt-4 flex flex-wrap items-center justify-end gap-3">
        <button type="submit" className={btnMain} disabled={state.busy}><Check className="h-4 w-4" aria-hidden="true" />{t('away.save')}</button>
        {state.text && <span role={state.ok ? 'status' : 'alert'} className={`text-sm ${state.ok ? 'text-emerald-300' : 'text-destructive'}`}>{state.text}</span>}
      </div>
    </form>
  );
}

function TikTokRow({ tt, hidden, setHidden, busy, msg, onConnect, onDisconnect }) {
  const t = useTranslations('profile');
  const on = Boolean(tt?.connected);
  const Icon = SOCIAL_ICONS.tiktok;
  return (
    <div data-tiktok-row className="mt-4 rounded-xl border border-border/60 bg-card/40 p-3">
      <div className="flex flex-wrap items-center gap-3">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border/60 bg-secondary/60"><Icon className="h-[18px] w-[18px]" /></span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">TikTok</p>
          <p className="truncate text-xs text-muted-foreground">{on ? `@${tt.username}` : t('socials.tiktok.none')}</p>
        </div>
        <span role="status" className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${on ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-300' : 'border-border/60 text-muted-foreground'}`}>
          <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${on ? 'bg-emerald-400' : 'bg-muted-foreground/60'}`} />{on ? t('socials.tiktok.connected') : t('socials.tiktok.disconnected')}
        </span>
        {on
          ? <button type="button" onClick={onDisconnect} disabled={busy} className={btn}>{t('socials.tiktok.disconnect')}</button>
          : tt?.available !== false ? <button type="button" onClick={onConnect} disabled={busy} className={btnMain}>{t('socials.tiktok.connect')}</button> : null}
      </div>
      {on && <div className="mt-3"><Switch id="soc-tiktok-hide" checked={hidden} onChange={setHidden} label={t('socials.tiktok.hide')} hint={t('socials.tiktok.hideHint')} /></div>}
      {msg && <p role="alert" className="mt-2 text-xs text-destructive">{msg}</p>}
    </div>
  );
}

function SocialsCard({ pf, onSaved }) {
  const t = useTranslations('profile');
  const tc = useTranslations('collab');
  const typed = SOCIALS.filter((s) => s.id !== 'tiktok');
  const [vals, setVals] = useState(() => Object.fromEntries(typed.map((s) => [s.id, pf.socials?.[s.id] || ''])));
  const [ttHidden, setTtHidden] = useState(Boolean(pf.tiktok?.hidden));
  const [ttBusy, setTtBusy] = useState(false);
  const [ttMsg, setTtMsg] = useState('');
  const [share, setShare] = useState(Boolean(pf.share_socials));
  const [consent, setConsent] = useState(false);
  const [shown, setShown] = useState(() => new Set(typed.filter((s) => pf.socials?.[s.id]).map((s) => s.id)));
  const [state, setState] = useState({ busy: false, ok: false, text: '', fields: {} });
  const save = async (e) => {
    e.preventDefault();
    if (!consent) return;
    setState({ busy: true, ok: false, text: '', fields: {} });
    const r = await mfetch('me/profile', { method: 'PUT', body: { socials: vals, share_socials: share, tiktok_hidden: ttHidden, policy_accepted: true } });
    if (r.ok) {
      setVals((v) => ({ ...v, ...Object.fromEntries(typed.map((s) => [s.id, r.data.socials?.[s.id] || ''])) }));
      setShown(new Set(typed.filter((s) => r.data.socials?.[s.id]).map((s) => s.id)));
      setState({ busy: false, ok: true, text: t('socials.saved'), fields: {} });
      setConsent(false);
      onSaved();
      return;
    }
    if (r.data?.error === 'account_blocked') { setState({ busy: false, ok: false, text: t('consent.blocked'), fields: {} }); return; }
    const fields = {};
    for (const er of r.data?.errors || []) fields[er.field] = (typeof tc.has === 'function' && tc.has(`err.${er.code}`)) ? tc(`err.${er.code}`, er.params || {}) : t(`socials.err.${er.code}`);
    setState({ busy: false, ok: false, text: Object.keys(fields).length ? t('socials.fix') : errText(tc, r.data), fields });
  };
  return (
    <form onSubmit={save} className="rounded-2xl border border-border/60 bg-card/50 p-4 sm:p-5" noValidate>
      <h2 className="text-lg font-semibold">{t('socials.title')}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{t('socials.text')}</p>
      <p className="mt-1 text-xs text-muted-foreground">{t('socials.publicNote')}</p>
      <TikTokRow tt={pf.tiktok} hidden={ttHidden} setHidden={setTtHidden} busy={ttBusy} msg={ttMsg} onConnect={async () => {
        setTtBusy(true); setTtMsg('');
        try {
          const r = await fetch('/api/tiktok-link', { method: 'POST', credentials: 'same-origin' }); const d = await r.json();
          if (r.ok && d.url) { window.location.assign(d.url); return; }
          setTtMsg(t(d.error === 'provider_unavailable' ? 'socials.tiktok.unavailable' : 'socials.tiktok.failed'));
        } catch { setTtMsg(t('socials.tiktok.failed')); }
        setTtBusy(false);
      }} onDisconnect={async () => {
        setTtBusy(true); setTtMsg('');
        try { const r = await fetch('/api/tiktok-link', { method: 'DELETE', credentials: 'same-origin' }); if (!r.ok) throw new Error('x'); onSaved(); } catch { setTtMsg(t('socials.tiktok.failed')); }
        setTtBusy(false);
      }} />
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {typed.filter((s) => shown.has(s.id)).map((s) => {
          const Icon = SOCIAL_ICONS[s.id];
          const bad = state.fields[s.id];
          return (
            <div key={s.id}>
              <label htmlFor={`soc-${s.id}`} className={`${lab} flex items-center gap-1.5`}><Icon className="h-3.5 w-3.5" />{s.label}</label>
              <div className="flex items-center gap-2">
                <input id={`soc-${s.id}`} className={`${input} min-w-0 flex-1 ${bad ? 'border-destructive' : ''}`} value={vals[s.id]} maxLength={200} inputMode="url" autoCapitalize="none" autoCorrect="off" spellCheck={false}
                  placeholder={s.placeholder} aria-invalid={bad ? 'true' : undefined} aria-describedby={bad ? `soc-${s.id}-e` : undefined}
                  onChange={(e) => setVals((v) => ({ ...v, [s.id]: e.target.value }))} />
                <button type="button" onClick={() => { setVals((v) => ({ ...v, [s.id]: '' })); setShown((c) => { const n = new Set(c); n.delete(s.id); return n; }); }}
                  aria-label={`${t('socials.remove')}: ${s.label}`} title={t('socials.remove')}
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-card/40 text-muted-foreground transition-colors hover:border-destructive/60 hover:text-destructive"><X className="h-4 w-4" aria-hidden="true" /></button>
              </div>
              {bad && <p id={`soc-${s.id}-e`} className="mt-1 text-xs text-destructive">{bad}</p>}
            </div>
          );
        })}
      </div>
      {typed.some((s) => !shown.has(s.id)) && (
        <div className="mt-4">
          <p className={lab}>{t('socials.add')}</p>
          <ul className="mt-1.5 flex flex-wrap gap-2">
            {typed.filter((s) => !shown.has(s.id)).map((s) => {
              const Icon = SOCIAL_ICONS[s.id];
              return (
                <li key={s.id}>
                  <button type="button" onClick={() => setShown((c) => new Set(c).add(s.id))} aria-label={`${t('socials.add')}: ${s.label}`} title={s.label}
                    className="inline-flex h-10 items-center gap-1.5 rounded-full border border-border/60 bg-secondary/40 px-3 text-xs font-medium text-muted-foreground transition-colors hover:border-[#e6cd8c] hover:text-foreground">
                    <Icon className="h-4 w-4" /><span>{s.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      <div className="mt-4"><Switch id="soc-share" checked={share} onChange={setShare} label={t('socials.share')} hint={t('socials.shareHint')} /></div>
      <div className="mt-4 flex flex-wrap items-center justify-end gap-3">
        <PolicyConsent ns="profile" checked={consent} onChange={setConsent} className="mt-3" />
        <button type="submit" className={`${btnMain} mt-3`} disabled={state.busy || !consent}><Check className="h-4 w-4" aria-hidden="true" />{t('socials.save')}</button>
        {state.text && <span role={state.ok ? 'status' : 'alert'} className={`text-sm ${state.ok ? 'text-emerald-300' : 'text-destructive'}`}>{state.text}</span>}
      </div>
    </form>
  );
}

function NotifCard({ pf, onSaved }) {
  const t = useTranslations('profile');
  const tc = useTranslations('collab');
  const [n, setN] = useState({ ...NOTIF_DEFAULTS, ...(pf.notif || {}) });
  const [state, setState] = useState({ busy: false, ok: false, text: '' });
  const set = (k) => (v) => setN((x) => ({ ...x, [k]: v }));
  const save = async () => {
    setState({ busy: true, ok: false, text: '' });
    const r = await mfetch('me/profile', { method: 'PUT', body: { notif: n } });
    setState({ busy: false, ok: r.ok, text: r.ok ? t('notif.saved') : errText(tc, r.data) });
    if (r.ok) onSaved();
  };
  const groups = ['status', 'applications', 'messages'];
  return (
    <section className="rounded-2xl border border-border/60 bg-card/50 p-4 sm:p-5">
      <h2 className="text-lg font-semibold">{t('notif.title')}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{t('notif.text')}</p>
      <div className="mt-4 space-y-2">
        <Switch id="nf-inapp" checked={n.inapp} onChange={set('inapp')} label={t('notif.inapp')} hint={t('notif.inappHint')} />
        <Switch id="nf-dm" checked={n.dm} onChange={set('dm')} label={t('notif.dm')} hint={t('notif.dmHint')} />
      </div>
      <p className="mb-2 mt-5 text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('notif.what')}</p>
      <div className="space-y-2">
        {groups.map((g) => <Switch key={g} id={`nf-${g}`} checked={n[g]} onChange={set(g)} label={t(`notif.group.${g}`)} hint={t(`notif.groupHint.${g}`)} />)}
      </div>
      <p className="mt-3 flex items-start gap-2 text-xs text-muted-foreground"><Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#e6cd8c]" aria-hidden="true" />{t('notif.critical')}</p>
      <div className="mt-4 flex flex-wrap items-center justify-end gap-3">
        <button type="button" className={btnMain} onClick={save} disabled={state.busy}><Check className="h-4 w-4" aria-hidden="true" />{t('notif.save')}</button>
        {state.text && <span role={state.ok ? 'status' : 'alert'} className={`text-sm ${state.ok ? 'text-emerald-300' : 'text-destructive'}`}>{state.text}</span>}
      </div>
    </section>
  );
}

function SettingsTab({ pf, cats, reloadProfile }) {
  const t = useTranslations('profile');
  return (
    <div className="space-y-6">
      <AwayCard key={`${pf.away?.active}-${pf.away?.until}-${pf.away?.note}`} pf={pf} onSaved={reloadProfile} />
      <SocialsCard pf={pf} onSaved={reloadProfile} />
      <NotifCard pf={pf} onSaved={reloadProfile} />
      <section className="rounded-2xl border border-border/60 bg-card/50 p-4 sm:p-5">
        <h2 className="mb-2 text-lg font-semibold">{t('prefs.title')}</h2>
        <PrefsTab cats={cats} />
      </section>
      <p className="text-xs text-muted-foreground">{t('legal.before')} <Link href="/privacy" className="underline underline-offset-4">{t('legal.privacy')}</Link> {t('legal.and')} <Link href="/terms" className="underline underline-offset-4">{t('legal.terms')}</Link>.</p>
    </div>
  );
}

function CardShowcase({ pf, onEdit }) {
  const t = useTranslations('profileCard');
  const locale = useLocale();
  const [card, setCard] = useState(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    let live = true;
    fetch('/api/profile-card', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).then((d) => { if (live && d?.config) setCard(normalizeConfig(d.config)); }).catch(() => {});
    return () => { live = false; };
  }, []);
  const id = pf.identity;
  const path = `${locale === 'en' ? '' : `/${locale}`}/profile/${encodeURIComponent(id.username)}`;
  const src = id.avatar ? `https://cdn.discordapp.com/avatars/${id.id}/${id.avatar}.png?size=256` : 'https://cdn.discordapp.com/embed/avatars/0.png';
  const copy = async () => {
    try { await navigator.clipboard.writeText(`${window.location.origin}${path}`); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { }
  };
  if (!card) return null;
  return (
    <section aria-label={t('showcaseTitle')} className="mt-5 rounded-3xl border border-[#e6cd8c]/25 bg-card/40 p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-black">{t('showcaseTitle')}</h2>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={onEdit} className={btn}><Pencil className="h-3.5 w-3.5" aria-hidden="true" />{t('editCard')}</button>
          <button type="button" onClick={copy} className={btn}><Link2 className="h-3.5 w-3.5" aria-hidden="true" />{copied ? t('linkCopied') : t('copyLink')}</button>
          <Link href={`/profile/${encodeURIComponent(id.username)}`} className={btn}><Globe className="h-3.5 w-3.5" aria-hidden="true" />{t('viewPublic')}</Link>
        </div>
      </div>
      <div className="mx-auto max-w-3xl" style={{ borderRadius: 26, boxShadow: `0 0 70px -22px ${card.accent}` }}>
        <ProfileCardPreview cfg={card} name={id.name || id.username} avatarSrc={discordCdnUrl(src)} tagline={pf.member_since ? t('tagline', { date: fmtDate(pf.member_since, locale) }) : ''} />
      </div>
    </section>
  );
}

export default function ProfileClient() {
  const t = useTranslations('profile');
  const tc = useTranslations('collab');
  const locale = useLocale();
  const [tab, setTab] = useState('requests');
  const [auth, setAuth] = useState('loading');
  const [ov, setOv] = useState(null);
  const [pf, setPf] = useState(null);
  const [gl, setGl] = useState({ guilds: [], unavailable: false });
  const [cats, setCats] = useState([]);

  const reloadProfile = useCallback(async () => { const r = await mfetch('me/profile'); if (r.ok) setPf(r.data); }, []);
  const reload = useCallback(async () => {
    const r = await mfetch('me/overview');
    if (r.status === 401) { setAuth('out'); window.location.assign(`/api/auth/login?next=${encodeURIComponent((locale === 'en' ? '' : `/${locale}`) + '/profile')}`); return; }
    if (r.ok) { setOv(r.data); setAuth('in'); }
    await reloadProfile();
    const g = await mfetch('me/guilds'); if (g.ok) setGl(g.data);
  }, [reloadProfile, locale]);
  useEffect(() => {
    reload();
    mfetch('categories').then((r) => { if (r.ok) setCats(r.data.categories); });
    const q = new URLSearchParams(window.location.search).get('tab');
    if (TABS.some((x) => x.id === q)) setTab(q);
  }, [reload]);
  const go = (id) => {
    setTab(id);
    try { const u = new URL(window.location.href); u.searchParams.set('tab', id); window.history.replaceState(null, '', u); } catch { }
  };

  return (
    <div className="min-h-screen">
      <TopNav />
      <main id="main-content" className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
        {auth === 'out' ? (
          <div className="rounded-3xl border border-border/60 p-10 text-center">
            <UserRound className="mx-auto mb-3 h-8 w-8 text-[#e6cd8c]" aria-hidden="true" />
            <h1 className="text-2xl font-black">{t('pageTitle')}</h1>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{t('signInText')}</p>
            <a href={`/api/auth/login?next=${encodeURIComponent((locale === 'en' ? '/profile' : `/${locale}/profile`) + (typeof window !== 'undefined' && /^\?(?:[a-z_]+=[A-Za-z0-9_]*&?)+$/.test(window.location.search) ? window.location.search : ''))}`} className={`${btnMain} mt-5`}>{tc('apply.login')}</a>
          </div>
        ) : auth === 'loading' || !pf || !ov ? (
          <ProfileSkeleton label={tc('loading')} />
        ) : (
          <>
            <Hero pf={pf} onGoSettings={() => go('settings')} />
            {tab !== 'card' && tab !== 'page' && <CardShowcase pf={pf} onEdit={() => go('card')} />}
            <div role="tablist" aria-label={t('pageTitle')} className="mk-scroll sticky top-0 z-10 -mx-4 mt-6 mb-6 flex gap-2 overflow-x-auto bg-background/85 px-4 py-2 backdrop-blur sm:mx-0 sm:px-0" style={{ scrollbarWidth: 'none' }}>
              {TABS.map(({ id, icon: Icon }) => (
                <button key={id} role="tab" id={`tab-${id}`} aria-selected={tab === id} aria-controls="profile-panel" onClick={() => go(id)}
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e6cd8c] ${tab === id ? 'border-[#e6cd8c] bg-[#e6cd8c] text-[#1a1208]' : 'border-border/60 hover:border-[#e6cd8c]/60'}`}>
                  <Icon className="h-4 w-4" aria-hidden="true" />{t(`tab.${id}`)}
                  {id === 'messages' && pf.stats.unread_messages > 0 && <span className="ml-1 rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">{pf.stats.unread_messages}</span>}
                </button>
              ))}
            </div>
            <div role="tabpanel" id="profile-panel" aria-labelledby={`tab-${tab}`}>
              {tab === 'requests' && <CollabsTab data={ov} reload={reload} cats={cats} guilds={gl.guilds} locked={false} />}
              {tab === 'applications' && <MyApplications data={ov} reload={reload} />}
              {tab === 'messages' && <MessagesTab reload={reload} />}
              {tab === 'servers' && <ServersTab guilds={gl.guilds} unavailable={gl.unavailable} reload={reload} />}
              {tab === 'card' && <ProfileCardTab identity={pf.identity} />}
              {tab === 'page' && <ProfilePageTab identity={pf.identity} onGoCard={() => go('card')} />}
              {tab === 'settings' && <SettingsTab pf={pf} cats={cats} reloadProfile={reloadProfile} />}
            </div>
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}

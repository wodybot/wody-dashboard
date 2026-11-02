'use client';
// Wody admin panel for Community Discovery. The API refuses everyone except the Wody
// owner/admin accounts, so this component can be mounted anywhere without leaking data.
import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import {
  BarChart3, Clock, Compass, FileClock, Flag, Gauge, History, Inbox, Layers, ListChecks, MessageSquare, Settings2, ShieldCheck, Star, Tag, XCircle, PauseCircle, MessageSquareWarning, Rocket, Award,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { LoadingOrError, NativeSelect, Pager } from '@/components/module-kit';
import { StatusBadge } from '@/components/community/StatusParts';
import AdminReview from '@/components/community/AdminReview';
import { CatalogManager, BadgeManager } from '@/components/community/AdminCatalog';
import { NotificationsBell } from '@/components/community/OwnerPanel';
import { cfetch, useCApi } from '@/components/community/client';
import { REPORT_STATUSES } from '@/lib/community/constants';

const NAV = [
  ['overview', Gauge], ['applications', Inbox], ['pending', FileClock], ['published', Rocket], ['changes', MessageSquareWarning], ['rejected', XCircle], ['suspended', PauseCircle],
  ['reports', Flag], ['featured', Star], ['badges', Award], ['categories', Layers], ['tags', Tag], ['reviews', MessageSquare], ['analytics', BarChart3], ['audit', History], ['settings', Settings2],
];
const NAV_ICON = Object.fromEntries(NAV);
// Same sections, grouped so the review work, moderation and catalog
// management are easy to find.
const NAV_GROUPS = [
  { label: 'Listings', keys: ['overview', 'applications', 'pending', 'published', 'changes', 'rejected', 'suspended'] },
  { label: 'Moderation', keys: ['reports', 'reviews', 'audit'] },
  { label: 'Catalog', keys: ['featured', 'badges', 'categories', 'tags'] },
  { label: 'Insights & settings', keys: ['analytics', 'settings'] },
];
const STATUS_OF = { applications: '', pending: 'pending_all', published: 'published', changes: 'changes_requested', rejected: 'rejected', suspended: 'suspended' };
const fmt = (d, locale) => (d ? new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(d)) : '-');

export default function AdminPanel() {
  const t = useTranslations('community');
  const [section, setSection] = useState('overview');
  const [review, setReview] = useState(null);
  const open = (id) => setReview(id);
  if (review) return <AdminReview id={review} onBack={() => setReview(null)} />;
  return (
    <div className="grid gap-5 xl:grid-cols-[13rem_minmax(0,1fr)]">
      {/* Below xl the Owner Panel's own sidebar already takes room, so this
          nav is a single grouped picker instead of a strip that had to be
          scrolled sideways; from xl up it is a grouped vertical list. */}
      <nav aria-label={t('admin.title')} className="xl:sticky xl:top-4 xl:self-start min-w-0">
        <div className="xl:hidden">
          <select
            value={section}
            onChange={(e) => setSection(e.target.value)}
            aria-label={t('admin.title')}
            className="h-10 w-full rounded-lg border border-border/60 bg-card/70 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#e6cd8c]/50"
          >
            {NAV_GROUPS.map((g) => (
              <optgroup key={g.label} label={g.label}>
                {g.keys.map((key) => <option key={key} value={key}>{t(`admin.nav.${key}`)}</option>)}
              </optgroup>
            ))}
          </select>
        </div>
        <div className="hidden xl:block space-y-4">
          {NAV_GROUPS.map((g) => (
            <div key={g.label}>
              <div className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">{g.label}</div>
              <ul className="space-y-0.5">
                {g.keys.map((key) => {
                  const Icon = NAV_ICON[key];
                  return (
                    <li key={key}><button type="button" onClick={() => setSection(key)} aria-current={section === key ? 'page' : undefined}
                      className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#e6cd8c] motion-reduce:transition-none ${section === key ? 'bg-[#e6cd8c]/20 text-[#f2c091]' : 'text-muted-foreground hover:bg-secondary/50'}`}>
                      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" /><span className="min-w-0 truncate">{t(`admin.nav.${key}`)}</span></button></li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </nav>
      <div className="min-w-0">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><h2 className="flex items-center gap-2 text-2xl font-bold"><Compass className="h-6 w-6 text-[#e08a4e]" aria-hidden="true" />{t(`admin.nav.${section}`)}</h2><NotificationsBell admin /></div>
        {section === 'overview' ? <Overview setSection={setSection} /> : null}
        {STATUS_OF[section] !== undefined ? <Applications key={section} status={STATUS_OF[section]} onOpen={open} /> : null}
        {section === 'reports' ? <Reports onOpen={open} /> : null}
        {section === 'featured' ? <Featured onOpen={open} /> : null}
        {section === 'badges' ? <BadgeManager /> : null}
        {section === 'categories' ? <CatalogManager kind="categories" /> : null}
        {section === 'tags' ? <><CatalogManager kind="tags" /><div className="mt-10"><h3 className="mb-3 text-lg font-semibold">{t('admin.nav.features')}</h3><CatalogManager kind="features" /></div></> : null}
        {section === 'reviews' ? <Reviews /> : null}
        {section === 'analytics' ? <AdminAnalytics /> : null}
        {section === 'audit' ? <Audit /> : null}
        {section === 'settings' ? <SettingsForm /> : null}
      </div>
    </div>
  );
}

function Overview({ setSection }) {
  const t = useTranslations('community');
  const api = useCApi('admin/overview');
  const [Chart, setChart] = useState(null);
  useEffect(() => { import('@/components/community/AnalyticsChart').then((m) => setChart(() => m.default)); }, []);
  const d = api.data;
  return (
    <LoadingOrError loading={api.loading} error={api.error} data={d} onRetry={api.reload}>
      {d ? (
        <div className="space-y-5">
          <section aria-label={t('admin.overview.statusTitle')}>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('admin.overview.statusTitle')}</h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
              {[['total', 'total', 'applications', 'bg-slate-400'], ['pending', 'pending', 'pending', 'bg-amber-400'], ['published', 'published', 'published', 'bg-emerald-400'], ['changes_requested', 'changes_requested', 'changes', 'bg-sky-400'], ['rejected', 'rejected', 'rejected', 'bg-red-400'], ['suspended', 'suspended', 'suspended', 'bg-orange-400'], ['reports', 'reports', 'reports', 'bg-fuchsia-400']].map(([k, label, target, dot]) => (
                <button key={k} type="button" onClick={() => setSection(target)} className="group rounded-xl border border-border/60 bg-card/50 p-4 text-left transition-colors hover:border-[#e6cd8c]/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#e6cd8c]">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground"><span className={`h-2 w-2 shrink-0 rounded-full ${dot}`} aria-hidden="true" /><span className="truncate">{t(`admin.overview.${label}`)}</span></div>
                  <div className="mt-2 text-3xl font-semibold tabular-nums">{d.totals[k]}</div>
                </button>
              ))}
            </div>
          </section>
          <section aria-label={t('admin.overview.todayTitle')}>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('admin.overview.todayTitle')}</h3>
            <div className="grid gap-3 sm:grid-cols-3">
              {[['submissions', d.today.submissions], ['approvals', d.today.approvals], ['rejections', d.today.rejections]].map(([k, v]) => (
                <Card key={k} className="flex items-center justify-between gap-3 p-4"><div className="text-sm text-muted-foreground">{t(`admin.overview.today_${k}`)}</div><div className="text-3xl font-semibold tabular-nums">{v}</div></Card>
              ))}
            </div>
          </section>
          {d.warnings.invalid_invites || d.warnings.unavailable ? <Card role="status" className="border-amber-400/30 bg-amber-400/[0.05] p-4 text-sm">{t('admin.overview.warnings', { invites: d.warnings.invalid_invites, unavailable: d.warnings.unavailable })}</Card> : null}
          <Card className="p-4"><h3 className="mb-2 text-sm font-semibold">{t('admin.overview.flow')}</h3>{Chart ? <Chart data={d.series} series={['submissions', 'approvals', 'rejections']} labelFor={(k) => t(`admin.overview.${k}`)} /> : <div className="h-64" />}</Card>
        </div>
      ) : null}
    </LoadingOrError>
  );
}

function Applications({ status, onOpen }) {
  const t = useTranslations('community');
  const locale = useLocale();
  const [f, setF] = useState({ q: '', category: '', language: '', min_members: '', max_members: '', from: '', to: '', sort: 'newest' });
  const [applied, setApplied] = useState(f);
  const [page, setPage] = useState(0);
  const params = new URLSearchParams({ ...(status ? { status } : {}), page: String(page) });
  for (const [k, v] of Object.entries(applied)) if (v) params.set(k, v);
  const api = useCApi(`admin/applications?${params}`);
  const cat = useCApi('public/catalog');
  const submit = (e) => { e.preventDefault(); setPage(0); setApplied(f); };
  const field = 'h-9 w-full rounded-md border border-input bg-background px-2 text-sm';
  return (
    <div>
      <form onSubmit={submit} className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4" role="search" aria-label={t('admin.filters')}>
        <Input value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} placeholder={t('admin.searchPlaceholder')} aria-label={t('admin.searchPlaceholder')} className="h-9 lg:col-span-2" />
        <select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} className={field} aria-label={t('fields.category')}><option value="">{t('filters.all')}</option>{(cat.data?.categories || []).filter((c) => !c.parent).map((c) => <option key={c.slug} value={c.slug}>{t.has(`catalog.categories.${c.slug}`) ? t(`catalog.categories.${c.slug}`) : c.names?.en || c.slug}</option>)}</select>
        <select value={f.language} onChange={(e) => setF({ ...f, language: e.target.value })} className={field} aria-label={t('filters.language')}><option value="">{t('filters.all')}</option>{['en', 'ro', 'fr', 'it', 'de', 'es', 'pt', 'nl', 'tr', 'ru', 'pl'].map((l) => <option key={l} value={l}>{t(`languages.${l}`)}</option>)}</select>
        <Input type="number" min={0} value={f.min_members} onChange={(e) => setF({ ...f, min_members: e.target.value })} placeholder={t('admin.minMembers')} aria-label={t('admin.minMembers')} className="h-9" />
        <Input type="number" min={0} value={f.max_members} onChange={(e) => setF({ ...f, max_members: e.target.value })} placeholder={t('admin.maxMembers')} aria-label={t('admin.maxMembers')} className="h-9" />
        <Input type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} aria-label={t('admin.from')} className="h-9" />
        <Input type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} aria-label={t('admin.to')} className="h-9" />
        <select value={f.sort} onChange={(e) => setF({ ...f, sort: e.target.value })} className={field} aria-label={t('results.sort')}>{['newest', 'oldest', 'largest', 'smallest'].map((s) => <option key={s} value={s}>{t(`admin.sort.${s}`)}</option>)}</select>
        <Button type="submit" className="h-9">{t('filters.apply')}</Button>
      </form>
      <LoadingOrError loading={api.loading} error={api.error} data={api.data} onRetry={api.reload}>
        {api.data && api.data.items.length === 0 ? <Card className="p-10 text-center text-sm text-muted-foreground">{t('admin.empty')}</Card> : null}
        {api.data && api.data.items.length ? (
          <>
          {/* Phones: one card per application, nothing to scroll sideways. */}
          <ul className="space-y-3 md:hidden">{api.data.items.map((r) => (
            <li key={r.id}><Card className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0"><div className="font-medium break-words">{r.name}</div><div className="font-mono text-xs text-muted-foreground break-all">{r.slug}</div></div>
                <Button size="sm" onClick={() => onOpen(r.id)} className="shrink-0">{t('admin.review')}</Button>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <StatusBadge status={r.status} updateState={r.update_state} />{r.unavailable ? <Badge variant="destructive" className="text-[10px]">{t('admin.unavailable')}</Badge> : null}
                <span>{r.owner_name || r.owner_id}</span><span>{r.members ?? '-'}</span><span className="uppercase">{r.languages.join(', ')}</span><span>{fmt(r.submitted_at, locale)}</span>
              </div>
            </Card></li>))}</ul>
          <div className="hidden md:block rounded-xl border border-border/60">
            <table className="w-full table-auto text-sm">
              <thead className="bg-secondary/40 text-left text-xs uppercase tracking-wide text-muted-foreground"><tr>{['server', 'owner', 'members', 'category', 'language', 'submitted', 'status', ''].map((h) => <th key={h} scope="col" className={`px-3 py-2 font-medium ${['owner', 'category', 'language'].includes(h) ? 'hidden 2xl:table-cell' : ''}`}>{h ? t(`admin.table.${h}`) : <span className="sr-only">{t('admin.table.actions')}</span>}</th>)}</tr></thead>
              <tbody className="divide-y divide-border/40">{api.data.items.map((r) => (
                <tr key={r.id} className="hover:bg-secondary/20">
                  <td className="px-3 py-2 max-w-[16rem]"><div className="font-medium break-words">{r.name}</div><div className="font-mono text-xs text-muted-foreground break-all">{r.slug}</div></td>
                  <td className="hidden 2xl:table-cell px-3 py-2 break-words">{r.owner_name || r.owner_id}</td>
                  <td className="px-3 py-2">{r.members ?? '-'}</td>
                  <td className="hidden 2xl:table-cell px-3 py-2">{r.category ? (t.has(`catalog.categories.${r.category}`) ? t(`catalog.categories.${r.category}`) : r.category) : '-'}</td>
                  <td className="hidden 2xl:table-cell px-3 py-2 uppercase">{r.languages.join(', ')}</td>
                  <td className="whitespace-nowrap px-3 py-2">{fmt(r.submitted_at, locale)}</td>
                  <td className="px-3 py-2"><StatusBadge status={r.status} updateState={r.update_state} />{r.unavailable ? <Badge variant="destructive" className="ml-1 text-[10px]">{t('admin.unavailable')}</Badge> : null}</td>
                  <td className="px-3 py-2 text-right"><Button size="sm" onClick={() => onOpen(r.id)}>{t('admin.review')}</Button></td>
                </tr>))}</tbody>
            </table>
          </div>
          </>
        ) : null}
        {api.data ? <Pager page={page} total={api.data.total} perPage={20} onChange={setPage} /> : null}
      </LoadingOrError>
    </div>
  );
}

function Reports({ onOpen }) {
  const t = useTranslations('community');
  const locale = useLocale();
  const [status, setStatus] = useState('open');
  const [page, setPage] = useState(0);
  const api = useCApi(`admin/reports?status=${status}&page=${page}`);
  const [working, setWorking] = useState(null);
  const update = async (id, body) => { setWorking(id); const r = await cfetch(`admin/reports/${id}`, { method: 'PATCH', body }); setWorking(null); if (r.ok) { toast.success(t('admin.done')); api.reload(); } else toast.error(t.has(`errors.${r.data?.error}`) ? t(`errors.${r.data.error}`) : t('errors.generic')); };
  return (
    <div>
      <div className="mb-4 max-w-xs"><NativeSelect value={status} onChange={(v) => { setStatus(v); setPage(0); }} label={t('admin.reports.statusFilter')} options={[...REPORT_STATUSES, ''].map((s) => ({ value: s, label: s ? t(`admin.reports.status.${s}`) : t('filters.all') }))} /></div>
      <LoadingOrError loading={api.loading} error={api.error} data={api.data} onRetry={api.reload}>
        {api.data?.items.length === 0 ? <Card className="p-10 text-center text-sm text-muted-foreground">{t('admin.reports.empty')}</Card> : null}
        <ul className="space-y-3">{(api.data?.items || []).map((r) => (
          <li key={r.id}><Card className="p-4">
            <div className="flex flex-wrap items-center justify-between gap-2"><div><span className="font-semibold">{r.name || r.slug}</span> <Badge variant="outline">{t(`admin.reports.status.${r.status}`)}</Badge> <Badge variant="secondary">{t(`report.reasons.${r.reason}`)}</Badge></div><span className="text-xs text-muted-foreground">{fmt(r.at, locale)} · {t('admin.reports.by', { name: r.reporter })}</span></div>
            {r.text ? <p className="mt-2 whitespace-pre-line break-words rounded-lg bg-secondary/40 p-2.5 text-sm">{r.text}</p> : null}
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => onOpen(r.listing_id)}>{t('admin.review')}</Button>
              <Button size="sm" variant="outline" disabled={working === r.id || r.status === 'investigating'} onClick={() => update(r.id, { status: 'investigating' })}>{t('admin.reports.investigate')}</Button>
              <Button size="sm" variant="outline" disabled={working === r.id} onClick={() => update(r.id, { status: 'resolved', resolution: 'resolved' })}>{t('admin.reports.resolve')}</Button>
              <Button size="sm" variant="ghost" disabled={working === r.id} onClick={() => update(r.id, { status: 'dismissed', resolution: 'dismissed' })}>{t('admin.reports.dismiss')}</Button>
            </div>
          </Card></li>))}</ul>
        {api.data ? <Pager page={page} total={api.data.total} perPage={20} onChange={setPage} /> : null}
      </LoadingOrError>
      <p className="mt-4 text-xs text-muted-foreground">{t('admin.reports.actionsNote')}</p>
    </div>
  );
}

function Featured({ onOpen }) {
  const t = useTranslations('community');
  const locale = useLocale();
  const api = useCApi('admin/featured');
  return (
    <LoadingOrError loading={api.loading} error={api.error} data={api.data} onRetry={api.reload}>
      <p className="mb-4 text-sm text-muted-foreground">{t('admin.featuredText')}</p>
      {api.data?.items.length === 0 ? <Card className="p-10 text-center text-sm text-muted-foreground">{t('admin.featuredEmpty')}</Card> : (
        <ul className="space-y-2">{(api.data?.items || []).map((f) => <li key={f.id}><Card className="flex flex-wrap items-center justify-between gap-3 p-4"><div><div className="font-medium">{f.name}</div><div className="text-xs text-muted-foreground">{t(`admin.placements.${f.placement}`)} · {t('admin.priority')} {f.priority} · {fmt(f.start, locale)} - {fmt(f.end, locale)}</div></div><div className="flex items-center gap-2">{new Date(f.end) > new Date() ? <Badge className="bg-emerald-600/80">{t('admin.active')}</Badge> : <Badge variant="outline">{t('admin.ended')}</Badge>}<Button size="sm" onClick={() => onOpen(f.id)}>{t('admin.review')}</Button></div></Card></li>)}</ul>
      )}
    </LoadingOrError>
  );
}

function Reviews() {
  const t = useTranslations('community');
  const locale = useLocale();
  const [status, setStatus] = useState('pending');
  const [page, setPage] = useState(0);
  const api = useCApi(`admin/reviews?status=${status}&page=${page}`);
  const decide = async (id, decision) => { const r = await cfetch(`admin/reviews/${id}`, { method: 'PATCH', body: { decision } }); if (r.ok) { toast.success(t('admin.done')); api.reload(); } else toast.error(t('errors.generic')); };
  return (
    <div>
      <div className="mb-4 max-w-xs"><NativeSelect value={status} onChange={(v) => { setStatus(v); setPage(0); }} label={t('admin.reports.statusFilter')} options={['pending', 'approved', 'rejected', 'removed'].map((s) => ({ value: s, label: t(`admin.reviews.status.${s}`) }))} /></div>
      <LoadingOrError loading={api.loading} error={api.error} data={api.data} onRetry={api.reload}>
        {api.data?.items.length === 0 ? <Card className="p-10 text-center text-sm text-muted-foreground">{t('admin.reviews.empty')}</Card> : null}
        <ul className="space-y-3">{(api.data?.items || []).map((r) => (
          <li key={r.id}><Card className="p-4">
            <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-semibold">{r.name || r.slug} <span className="text-amber-400" aria-label={t('reviews.rating', { value: r.rating })}>{'★'.repeat(r.rating)}</span></span><span className="text-xs text-muted-foreground">{r.author} · {fmt(r.at, locale)}</span></div>
            <p className="mt-2 whitespace-pre-line break-words text-sm">{r.text}</p>
            <div className="mt-3 flex gap-2">
              {r.status !== 'approved' ? <Button size="sm" onClick={() => decide(r.id, 'approved')}>{t('admin.reviews.approve')}</Button> : null}
              {r.status !== 'rejected' ? <Button size="sm" variant="outline" onClick={() => decide(r.id, 'rejected')}>{t('admin.reviews.reject')}</Button> : null}
              {r.status !== 'removed' ? <Button size="sm" variant="ghost" onClick={() => decide(r.id, 'removed')}>{t('admin.reviews.remove')}</Button> : null}
            </div>
          </Card></li>))}</ul>
        {api.data ? <Pager page={page} total={api.data.total} perPage={20} onChange={setPage} /> : null}
      </LoadingOrError>
    </div>
  );
}

function AdminAnalytics() {
  const t = useTranslations('community');
  const [range, setRange] = useState(30);
  const api = useCApi(`admin/analytics?range=${range}`);
  const [Chart, setChart] = useState(null);
  useEffect(() => { import('@/components/community/AnalyticsChart').then((m) => setChart(() => m.default)); }, []);
  const d = api.data;
  return (
    <div className="space-y-5">
      <div className="max-w-[10rem]"><NativeSelect value={range} onChange={(v) => setRange(Number(v))} label={t('analytics.range')} options={[7, 30, 90].map((n) => ({ value: n, label: t('analytics.days', { count: n }) }))} /></div>
      <LoadingOrError loading={api.loading} error={api.error} data={d} onRetry={api.reload}>
        {d ? (<>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{['draft', 'pending_review', 'published', 'changes_requested', 'rejected', 'suspended', 'unpublished', 'approved'].map((s) => <Card key={s} className="p-4"><div className="text-xs text-muted-foreground">{t(`status.labels.${s}`)}</div><div className="mt-1 text-2xl font-semibold">{d.statuses[s] || 0}</div></Card>)}</div>
          <Card className="p-4"><h3 className="mb-2 text-sm font-semibold">{t('admin.overview.flow')}</h3>{Chart ? <Chart data={d.series} series={['submissions', 'approvals', 'rejections']} labelFor={(k) => t(`admin.overview.${k}`)} /> : <div className="h-64" />}</Card>
          <Card className="p-4"><h3 className="mb-2 text-sm font-semibold">{t('admin.traffic')}</h3>{Chart ? <Chart data={d.series} series={['views', 'invite_clicks']} labelFor={(k) => t(`analytics.${k}`)} /> : <div className="h-64" />}</Card>
          <div className="grid gap-5 md:grid-cols-2">
            <Card className="p-4"><h3 className="mb-2 text-sm font-semibold">{t('admin.popularCategories')}</h3><ul className="space-y-1 text-sm">{d.categories.map((c) => <li key={c.key} className="flex justify-between"><span>{t.has(`catalog.categories.${c.key}`) ? t(`catalog.categories.${c.key}`) : c.key}</span><span className="text-muted-foreground">{c.n}</span></li>)}</ul></Card>
            <Card className="p-4"><h3 className="mb-2 text-sm font-semibold">{t('admin.languagesTitle')}</h3><ul className="space-y-1 text-sm">{d.languages.map((c) => <li key={c.key} className="flex justify-between"><span>{t.has(`languages.${c.key}`) ? t(`languages.${c.key}`) : c.key}</span><span className="text-muted-foreground">{c.n}</span></li>)}</ul></Card>
          </div>
        </>) : null}
      </LoadingOrError>
    </div>
  );
}

function Audit() {
  const t = useTranslations('community');
  const locale = useLocale();
  const [page, setPage] = useState(0);
  const [action, setAction] = useState('');
  const api = useCApi(`admin/audit?page=${page}${action ? `&action=${encodeURIComponent(action)}` : ''}`);
  const ACTIONS = ['listing_approved', 'listing_rejected', 'changes_requested', 'listing_suspended', 'listing_unpublished', 'listing_published', 'listing_featured', 'listing_unfeatured', 'badge_added', 'badge_removed', 'category_changed', 'review_moderated', 'note_added', 'settings_changed'];
  const show = (v) => (v == null ? '' : typeof v === 'string' ? v : JSON.stringify(v));
  return (
    <div>
      <div className="mb-4 max-w-xs"><NativeSelect value={action} onChange={(v) => { setAction(v); setPage(0); }} label={t('admin.audit.action')} options={[{ value: '', label: t('filters.all') }, ...ACTIONS.map((a) => ({ value: a, label: t(`admin.audit.actions.${a}`) }))]} /></div>
      <LoadingOrError loading={api.loading} error={api.error} data={api.data} onRetry={api.reload}>
        {api.data?.items.length === 0 ? <Card className="p-10 text-center text-sm text-muted-foreground">{t('admin.audit.empty')}</Card> : (
          <ul className="divide-y divide-border/40 rounded-xl border border-border/60">{(api.data?.items || []).map((r) => (
            <li key={r.id} className="grid gap-1 p-3 text-sm md:grid-cols-[10rem_minmax(0,1fr)] md:gap-4">
              <div className="text-xs text-muted-foreground">{fmt(r.at, locale)}<div className="mt-0.5 text-foreground/80 break-words">{r.admin_name || r.admin || '-'}</div></div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1"><span className="font-medium">{t.has(`admin.audit.actions.${r.action}`) ? t(`admin.audit.actions.${r.action}`) : r.action}</span><span className="text-muted-foreground break-words">{r.name || r.target || '-'}</span></div>
                {r.reason ? <div className="mt-1 break-words text-muted-foreground">{r.reason}</div> : null}
                {r.old != null || r.new != null ? <div className="mt-1 break-all font-mono text-xs text-muted-foreground">{show(r.old)} → {show(r.new)}</div> : null}
              </div>
            </li>))}</ul>
        )}
        {api.data ? <Pager page={page} total={api.data.total} perPage={30} onChange={setPage} /> : null}
      </LoadingOrError>
    </div>
  );
}

const SETTING_KEYS = [
  ['require_checklist', 'bool'], ['auto_publish_on_approve', 'bool'], ['require_invite', 'bool'], ['require_banner', 'bool'], ['min_members', 'num'], ['max_listings_per_user', 'num'],
  ['featured_slots', 'num'], ['reviews_enabled', 'bool'], ['reviews_require_moderation', 'bool'], ['reviews_min_account_days', 'num'], ['reports_enabled', 'bool'], ['reports_rate_limit_per_day', 'num'],
  ['analytics_enabled', 'bool'], ['discovery_page_size', 'num'], ['url_prefix', 'text'], ['bump_cooldown_hours', 'num'],
];

function SettingsForm() {
  const t = useTranslations('community');
  const api = useCApi('admin/settings');
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState([]);
  useEffect(() => { if (api.data) setForm(api.data.settings); }, [api.data]);
  const save = async () => {
    setSaving(true); setErrors([]);
    const r = await cfetch('admin/settings', { method: 'PUT', body: form });
    setSaving(false);
    if (r.ok) { toast.success(t('admin.done')); api.reload(); } else if (r.data?.errors) setErrors(r.data.errors); else toast.error(t('errors.generic'));
  };
  return (
    <LoadingOrError loading={api.loading} error={api.error} data={form} onRetry={api.reload}>
      {form ? (
        <Card className="space-y-4 p-5">
          {SETTING_KEYS.map(([key, type]) => (
            <div key={key} className="flex flex-wrap items-center justify-between gap-3 border-b border-border/40 pb-3 last:border-0">
              <div className="min-w-0 flex-1"><label htmlFor={`s-${key}`} className="text-sm font-medium">{t(`admin.settings.${key}`)}</label><p className="text-xs text-muted-foreground">{t(`admin.settings.${key}Hint`)}</p>{errors.filter((e) => e.field === key).map((e, i) => <p key={i} role="alert" className="text-xs text-red-400">{t.has(`errors.${e.code}`) ? t(`errors.${e.code}`, e.params || { min: 0, max: 0 }) : t('errors.generic')}</p>)}</div>
              {type === 'bool' ? <Switch id={`s-${key}`} checked={Boolean(form[key])} onCheckedChange={(v) => setForm({ ...form, [key]: v })} /> : type === 'text' ? <Input id={`s-${key}`} value={form[key] ?? ''} maxLength={24} onChange={(e) => setForm({ ...form, [key]: e.target.value.toLowerCase() })} className="h-9 w-40 font-mono" /> : <Input id={`s-${key}`} type="number" min={0} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value === '' ? '' : Number(e.target.value) })} className="h-9 w-28" />}
            </div>
          ))}
          <div className="flex justify-end"><Button onClick={save} disabled={saving} className="gradient-primary">{t('common.save')}</Button></div>
        </Card>
      ) : null}
    </LoadingOrError>
  );
}

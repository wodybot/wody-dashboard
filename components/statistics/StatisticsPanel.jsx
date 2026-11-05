'use client';
// Dashboard > Statistics: Overview, Channel Intelligence, Community Health, Historical Analytics, Reports and Settings.
// The page never writes Statistics data: every analysis and every change is a request to the bot, which validates it and answers.
// Only aggregate counters are shown: no message text, no member names.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Activity, BarChart3, Download, FileText, HeartPulse, History, Layers, Loader2, RefreshCw, Search, Settings as SettingsIcon, ShieldCheck, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ConfirmDialog, ModuleTabs, NativeSelect, Section, SwitchRow } from '@/components/module-kit';
import { SaveBar } from '@/components/dashboard-kit';
import { RANGES, DEFAULT_RANGE, RETENTION, TZ, THRESHOLD_DEFAULTS, THRESHOLD_KEYS, CLASSES, HISTORY_WEEKS, MAX_COMPARE, ACCESS } from '@/lib/statistics/constants';
import { formatNumber, dayLabel, scoreColor } from '@/lib/statistics/chart-math';
import { BarChart, CLASS_COLORS, COLORS, Delta, Donut, Gauge, Heatmap, LineChart, Meter, SERIES, Sparkline } from './charts';

/** Calls /api/statistics/<path>. Never throws: { ok, status, data }. */
export async function st(path, { method = 'GET', body } = {}) {
  try {
    const res = await fetch(`/api/statistics/${path}`, { method, headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined });
    if ((res.headers.get('content-type') || '').includes('application/pdf')) return { ok: res.ok, status: res.status, blob: await res.blob(), data: {} };
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  } catch {
    return { ok: false, status: 0, data: { error: 'unreachable' } };
  }
}

function useStats(path) {
  const [state, setState] = useState({ loading: Boolean(path), data: null, error: null });
  const seq = useRef(0);
  const load = useCallback(async (extra = '') => {
    if (!path) return;
    const id = ++seq.current;
    setState((s) => ({ ...s, loading: true }));
    const r = await st(path + extra);
    if (id !== seq.current) return;
    setState({ loading: false, data: r.ok ? r.data : null, error: r.ok ? null : (r.data?.error || 'generic') });
  }, [path]);
  useEffect(() => { load(); }, [load]);
  return { ...state, reload: load };
}

function useApiText() {
  const t = useTranslations('statistics');
  return useCallback((code) => (code && t.has(`api.${code}`) ? t(`api.${code}`) : t('api.generic')), [t]);
}

function Toast({ note }) {
  if (!note) return null;
  return <p role="status" className={`rounded-md border px-3 py-2 text-sm ${note.tone === 'error' ? 'border-red-400/40 bg-red-500/10 text-red-300' : 'border-emerald-400/40 bg-emerald-500/10 text-emerald-300'}`}>{note.text}</p>;
}

function Kpi({ label, value, sub, delta, color }) {
  return (
    <Card className="p-4">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums" style={color ? { color } : undefined}>{value}</p>
      <p className="mt-1 flex min-h-[1.25rem] flex-wrap items-center gap-2 text-xs text-muted-foreground">{delta !== undefined && delta !== null ? <Delta value={delta} /> : null}{sub}</p>
    </Card>
  );
}

// ---------------------------------------------------------------------------------------------- shared lines of text
function useSentences() {
  const t = useTranslations('statistics');
  const num = (v) => { const r = Math.round(v * 10) / 10; return Number.isInteger(r) ? String(r) : String(r); };
  const trend = (x) => t(`trend.${x.key}.${x.direction}`, { value: num(Math.abs(x.value ?? 0)) });
  const rec = (r) => {
    const params = {};
    for (const [k, v] of Object.entries(r.params || {})) params[k] = k === 'names' ? v.join(', ') : typeof v === 'number' ? num(v) : v;
    return t(`rec.${r.key}`, params);
  };
  return { trend, rec, num };
}

function Bullets({ items, empty }) {
  if (!items.length) return empty ? <p className="text-sm text-muted-foreground">{empty}</p> : null;
  return <ul className="space-y-2 text-sm leading-relaxed">{items.map((x, i) => <li key={i} className="flex gap-2"><span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#e6cd8c]" /><span>{x}</span></li>)}</ul>;
}

function Reasons({ a }) {
  const t = useTranslations('statistics');
  const p = a.period;
  const lines = [];
  if (a.reasons.includes('no_collection')) lines.push(t('reason.no_collection'));
  else if (a.reasons.includes('few_days')) lines.push(t('reason.few_days'));
  if (p.covered_days && p.covered_days < p.days) lines.push(t('line.coverage', { covered: p.covered_days, days: p.days }));
  if (!lines.length) return null;
  return <div className="rounded-lg border border-amber-400/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-200/90">{lines.map((l, i) => <p key={i}>{l}</p>)}</div>;
}

// ---------------------------------------------------------------------------------------------- set up card
// ---------------------------------------------------------------------------------------------- overview
function OverviewTab({ a, locale }) {
  const t = useTranslations('statistics');
  const { trend, rec } = useSentences();
  const o = a.overview; const g = a.growth; const h = a.health;
  const keys = a.daily.keys.map(dayLabel);
  const weekdays = [0, 1, 2, 3, 4, 5, 6].map((i) => t(`weekday.${i}`));
  const messages = [{ name: t('chart.this_period'), color: COLORS.accent, values: a.daily.messages, area: true }];
  if (a.can_compare) messages.push({ name: t('chart.previous_period'), color: COLORS.faint, values: a.daily.previous_messages, dashed: true });
  const fmt = (v) => formatNumber(v, locale);
  return (
    <div className="space-y-6">
      <Reasons a={a} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label={t('kpi.messages')} value={fmt(o.messages)} delta={o.messages_change} sub={o.messages_change !== null ? t('kpi.vs_previous') : null} />
        <Kpi label={t('kpi.participants')} value={fmt(o.participants)} delta={a.engagement.participants_change} sub={t('kpi.estimate')} />
        <Kpi label={t('kpi.members')} value={fmt(o.members)} sub={g.net === null ? null : `${g.net > 0 ? '+' : ''}${fmt(g.net)} ${t('kpi.net')}`} />
        <Kpi label={t('kpi.health')} value={h.score ?? '-'} color={h.score === null ? undefined : scoreColor(h.score)} sub={h.score === null ? null : t(`band.${h.band}`)} />
      </div>
      <Card className="p-4 sm:p-5">
        <h3 className="mb-3 font-semibold">{t('chart.messages_day')}</h3>
        <LineChart title={t('chart.messages_day')} labels={keys} series={messages} locale={locale} gapLabel={t('chart.gap_note')} emptyLabel={t('nodata')} />
      </Card>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="p-4 sm:p-5">
          <h3 className="mb-3 font-semibold">{t('chart.participants_day')} <span className="text-xs font-normal text-muted-foreground">({t('kpi.estimate')})</span></h3>
          <LineChart title={t('chart.participants_day')} labels={keys} series={[{ name: t('kpi.participants'), color: COLORS.blue, values: a.daily.participants, area: true }]} locale={locale} height={220} gapLabel={t('chart.gap_note')} emptyLabel={t('nodata')} />
        </Card>
        <Card className="p-4 sm:p-5">
          <h3 className="mb-3 font-semibold">{t('chart.hours')} <span className="text-xs font-normal text-muted-foreground">(UTC{a.tz_offset >= 0 ? '+' : ''}{a.tz_offset})</span></h3>
          <BarChart title={t('chart.hours')} labels={Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))} values={a.hours.some((v) => v > 0) ? a.hours : a.hours.map(() => null)} color={COLORS.blue} highlight={a.peak_hour} locale={locale} height={220} showValues={false} emptyLabel={t('nodata')} />
        </Card>
      </div>
      <Card className="p-4 sm:p-5">
        <h3 className="mb-1 font-semibold">{t('chart.heatmap')}</h3>
        <p className="mb-3 text-xs text-muted-foreground">{t('chart.heatmap_note')}</p>
        <Heatmap title={t('chart.heatmap')} matrix={a.heatmap} weekdays={weekdays} locale={locale} unit={t('overview.perHour')} emptyLabel={t('nodata')} />
        {a.peak_hour !== null ? <p className="mt-3 text-sm text-muted-foreground">{t('line.peak_hour', { hour: `${String(a.peak_hour).padStart(2, '0')}:00`, share: a.peak_share === null ? '-' : Math.round(a.peak_share) })}</p> : null}
      </Card>
      <Card className="space-y-3 p-4 sm:p-5">
        <h3 className="font-semibold">{t('overview.whatChanged')}</h3>
        <Bullets items={a.trends.map(trend)} empty={t('overview.noTrends')} />
        {a.recommendations.length ? <><h3 className="pt-2 font-semibold">{t('overview.observations')}</h3><Bullets items={a.recommendations.map(rec)} /></> : null}
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------- channels
const SORTS = ['messages', 'change', 'participants', 'rate'];

function ChannelsTab({ guildId, a, locale, period }) {
  const t = useTranslations('statistics');
  const apiText = useApiText();
  const { rec } = useSentences();
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState('messages');
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState([]);
  const [cmp, setCmp] = useState({ loading: false, data: null, error: null });
  const rows = a.channels;
  const classes = a.overview.channels.classes;
  const name = (r) => r.name || t('deletedChannel');
  const shown = useMemo(() => {
    let list = rows.filter((r) => (filter === 'all' || r.class === filter) && (!q || name(r).toLowerCase().includes(q.toLowerCase())));
    const key = { messages: (r) => r.messages, change: (r) => (r.change === null ? -Infinity : r.change), participants: (r) => r.participants, rate: (r) => r.rate ?? -1 }[sort];
    list = [...list].sort((x, y) => key(y) - key(x) || x.rank - y.rank);
    return list.slice(0, 100);
  }, [rows, filter, sort, q]); // eslint-disable-line react-hooks/exhaustive-deps
  const toggle = (id) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length >= MAX_COMPARE ? p : [...p, id]));
  const compare = async () => {
    setCmp({ loading: true, data: null, error: null });
    const r = await st(`guilds/${guildId}/compare?${period}&channels=${picked.join(',')}`);
    setCmp(r.ok ? { loading: false, data: r.data.compare, error: null } : { loading: false, data: null, error: r.data?.error || 'generic' });
  };
  const fmt = (v) => formatNumber(v, locale);
  const keys = a.daily.keys.map(dayLabel);
  const chip = (key, label, count) => (
    <button key={key} type="button" onClick={() => setFilter(key)} aria-pressed={filter === key}
      className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${filter === key ? 'border-[#e6cd8c]/60 bg-[#e6cd8c]/15 text-[#f2c091]' : 'border-border/60 text-muted-foreground hover:text-foreground'}`}>
      {label}{count !== undefined ? <span className="ml-1.5 opacity-70">{count}</span> : null}
    </button>
  );
  return (
    <div className="space-y-6">
      <Reasons a={a} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <Card className="p-4 sm:p-5">
          <h3 className="mb-1 font-semibold">{t('chart.classes')}</h3>
          <p className="mb-4 text-xs text-muted-foreground">{t('chart.class_note')}</p>
          <Donut title={t('chart.classes')} locale={locale} rows={CLASSES.map((k) => ({ label: t(`class.${k}`), value: classes ? classes[k] : 0, color: CLASS_COLORS[k] }))}
            centerValue={classes ? String(Object.values(classes).reduce((x, y) => x + y, 0)) : '-'} centerLabel={t('chart.channels')} emptyLabel={t('nodata')} />
        </Card>
        <Card className="space-y-3 p-4 sm:p-5">
          <h3 className="font-semibold">{t('channels.highlights')}</h3>
          <Bullets items={[
            a.overview.channels.top ? t('line.top_channel', { name: name(a.overview.channels.top), messages: fmt(a.overview.channels.top.messages), share: Math.round(a.overview.channels.top.share) }) : null,
            a.overview.channels.top_growth ? t('line.top_growth', { name: name(a.overview.channels.top_growth), change: Math.round(a.overview.channels.top_growth.change) }) : null,
            a.overview.channels.top_decline ? t('line.top_decline', { name: name(a.overview.channels.top_decline), change: Math.round(Math.abs(a.overview.channels.top_decline.change)) }) : null,
            ...a.recommendations.filter((r) => ['quiet_channels', 'concentrated', 'channel_surge', 'channel_decline', 'few_voices'].includes(r.key)).map(rec),
          ].filter(Boolean)} empty={t('channels.nothingStands')} />
        </Card>
      </div>
      <Card className="space-y-4 p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="mr-2 font-semibold">{t('chart.ranking')}</h3>
          {chip('all', t('channels.all'), rows.length)}
          {CLASSES.map((k) => chip(k, t(`class.${k}`), classes ? classes[k] : undefined))}
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_14rem]">
          <div className="relative"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('channels.search')} aria-label={t('channels.search')} className="pl-9" /></div>
          <NativeSelect value={sort} onChange={setSort} label={t('channels.sortBy')} options={SORTS.map((s) => ({ value: s, label: t(`channels.sort.${s}`) }))} />
        </div>
        {!shown.length ? <p className="py-6 text-center text-sm text-muted-foreground">{rows.length ? t('channels.noMatch') : t('nodata')}</p> : (
          <div className="-mx-2 overflow-x-auto px-2">
            <table className="w-full min-w-[44rem] text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr><th className="w-8 pb-2" /><th className="pb-2 font-medium">{t('channels.col.channel')}</th><th className="pb-2 font-medium">{t('channels.col.class')}</th><th className="pb-2 text-right font-medium">{t('kpi.messages')}</th>
                  <th className="pb-2 text-right font-medium">{t('channels.col.share')}</th><th className="pb-2 text-right font-medium">{t('kpi.participants')}</th><th className="pb-2 text-right font-medium">{t('channels.col.change')}</th><th className="pb-2 pl-4 font-medium">{t('channels.col.trend')}</th></tr>
              </thead>
              <tbody>
                {shown.map((r) => {
                  const id = r.channel_id;
                  return (
                    <tr key={id} className="border-t border-border/40">
                      <td className="py-2"><input type="checkbox" checked={picked.includes(id)} onChange={() => toggle(id)} disabled={!picked.includes(id) && picked.length >= MAX_COMPARE} aria-label={t('channels.pick', { name: name(r) })} className="h-4 w-4 accent-[#e6cd8c]" /></td>
                      <td className="max-w-[14rem] truncate py-2 font-medium">{r.deleted ? <span className="italic text-muted-foreground">{name(r)}</span> : `#${name(r)}`}</td>
                      <td className="py-2">{r.class ? <span className="inline-flex items-center gap-1.5 text-xs"><i className="inline-block h-2 w-2 rounded-full" style={{ background: CLASS_COLORS[r.class] }} />{t(`class.${r.class}`)}</span> : <span className="text-xs text-muted-foreground">-</span>}</td>
                      <td className="py-2 text-right tabular-nums">{fmt(r.messages)}</td>
                      <td className="py-2 text-right tabular-nums text-muted-foreground">{Math.round(r.share)}%</td>
                      <td className="py-2 text-right tabular-nums text-muted-foreground">{fmt(r.participants)}</td>
                      <td className="py-2 text-right">{r.new_activity ? <span className="text-xs font-semibold text-sky-300">{t('channels.new')}</span> : r.change === null ? <span className="text-xs text-muted-foreground">-</span> : <Delta value={r.change} />}</td>
                      <td className="py-2 pl-4"><Sparkline values={r.daily} color={CLASS_COLORS[r.class] || COLORS.accent} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {a.channels.length > 100 || a.channels_total > 100 ? <p className="text-xs text-muted-foreground">{t('channels.capped', { n: 100 })}</p> : null}
      </Card>
      <Card className="space-y-4 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h3 className="font-semibold">{t('channels.compareTitle')}</h3><p className="text-xs text-muted-foreground">{t('channels.compareHint', { max: MAX_COMPARE })}</p></div>
          <Button variant="outline" onClick={compare} disabled={picked.length < 2 || cmp.loading} className="gap-2">{cmp.loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Layers className="h-4 w-4" />}{t('channels.compare', { n: picked.length })}</Button>
        </div>
        {cmp.error ? <Toast note={{ tone: 'error', text: apiText(cmp.error) }} /> : null}
        {cmp.data ? (
          <>
            <LineChart title={t('channels.compareTitle')} labels={cmp.data.keys.map(dayLabel)} locale={locale} gapLabel={t('chart.gap_note')} emptyLabel={t('nodata')}
              series={cmp.data.channels.map((c, i) => ({ name: c.deleted ? t('deletedChannel') : `#${c.name}`, color: SERIES[i % SERIES.length], values: c.daily }))} />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {cmp.data.channels.map((c, i) => (
                <Card key={c.channel_id} className="p-3">
                  <p className="flex items-center gap-2 text-sm font-semibold"><i className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: SERIES[i % SERIES.length] }} />{c.deleted ? t('deletedChannel') : `#${c.name}`}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{t('channels.cmpLine', { messages: fmt(c.messages), participants: fmt(c.participants), share: Math.round(c.share_of_selection) })}</p>
                </Card>
              ))}
            </div>
          </>
        ) : null}
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------- health
function HealthTab({ a, locale }) {
  const t = useTranslations('statistics');
  const { rec } = useSentences();
  const h = a.health; const g = a.growth;
  const keys = a.daily.keys.map(dayLabel);
  return (
    <div className="space-y-6">
      <Reasons a={a} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <Card className="p-4 sm:p-5">
          <h3 className="mb-3 font-semibold">{t('chart.health')}</h3>
          <Gauge title={t('chart.health')} score={h.score} caption={h.score === null ? null : t(`band.${h.band}`)} />
          {h.score === null ? <p className="mt-3 text-center text-sm text-muted-foreground">{t(`reason.score_${h.reason || 'few_days'}`)}</p> : null}
          <p className="mt-4 text-xs leading-relaxed text-muted-foreground">{t('chart.score_note')}</p>
        </Card>
        <Card className="space-y-4 p-4 sm:p-5">
          <div><h3 className="font-semibold">{t('health.factors')}</h3><p className="text-xs text-muted-foreground">{t('health.factorsHint')}</p></div>
          {h.factors.length ? h.factors.map((f) => (
            <div key={f.key} className="space-y-1.5">
              <div className="flex items-baseline justify-between gap-3 text-sm"><span className="font-medium">{t(`factor.${f.key}`)}</span><span className="text-xs text-muted-foreground">{f.value === null ? t('health.noData') : `${Math.round(f.value)} / 100`} · {t('health.weight', { n: f.weight })}</span></div>
              <Meter value={f.value} color={f.effect === 'positive' ? COLORS.green : f.effect === 'negative' ? COLORS.red : COLORS.gold} label={t(`factor.${f.key}`)} />
              <p className="text-xs text-muted-foreground">{t(`health.explain.${f.key}`)}</p>
            </div>
          )) : <p className="text-sm text-muted-foreground">{t(`reason.score_${h.reason || 'few_days'}`)}</p>}
        </Card>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label={t('kpi.joined')} value={formatNumber(g.joined, locale)} delta={g.joined_change} />
        <Kpi label={t('kpi.left')} value={formatNumber(g.left, locale)} delta={g.left_change === null ? null : -g.left_change} sub={null} />
        <Kpi label={t('health.netGrowth')} value={g.net === null ? '-' : `${g.net > 0 ? '+' : ''}${formatNumber(g.net, locale)}`} sub={g.growth_rate_pct === null ? null : `${g.growth_rate_pct > 0 ? '+' : ''}${g.growth_rate_pct}%`} />
        <Kpi label={t('health.participation')} value={a.engagement.participation_rate === null ? '-' : `${a.engagement.participation_rate}%`} sub={t('health.participationHint')} />
      </div>
      <Card className="p-4 sm:p-5">
        <h3 className="mb-1 font-semibold">{t('chart.members')}</h3><p className="mb-3 text-xs text-muted-foreground">{t('chart.members_note')}</p>
        <LineChart title={t('chart.members')} labels={keys} locale={locale} fit series={[{ name: t('kpi.members'), color: COLORS.green, values: g.series.length ? g.series : keys.map(() => null), area: true }]} emptyLabel={t('nodata_members')} />
      </Card>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="p-4 sm:p-5"><h3 className="mb-3 font-semibold">{t('chart.joins')}</h3><BarChart title={t('chart.joins')} labels={keys} values={g.joins_daily} color={COLORS.green} locale={locale} height={200} emptyLabel={t('nodata_members')} /></Card>
        <Card className="p-4 sm:p-5"><h3 className="mb-3 font-semibold">{t('chart.leaves')}</h3><BarChart title={t('chart.leaves')} labels={keys} values={g.leaves_daily} color={COLORS.red} locale={locale} height={200} emptyLabel={t('nodata_members')} /></Card>
      </div>
      <Card className="space-y-3 p-4 sm:p-5">
        <h3 className="font-semibold">{t('overview.observations')}</h3>
        <Bullets items={a.recommendations.map(rec)} empty={t('health.noObservations')} />
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------- history
function HistoryTab({ guildId, locale }) {
  const t = useTranslations('statistics');
  const apiText = useApiText();
  const [weeks, setWeeks] = useState(26);
  const { loading, data, error, reload } = useStats(`guilds/${guildId}/history?weeks=${weeks}`);
  const rows = data?.history?.weeks || [];
  const labels = rows.map((w) => { const d = new Date(`${w.start}T00:00:00Z`); return `${String(d.getUTCDate()).padStart(2, '0')}.${String(d.getUTCMonth() + 1).padStart(2, '0')}`; });
  const none = rows.length > 0 && rows.every((w) => w.covered_days === 0);
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h3 className="font-semibold">{t('history.title')}</h3><p className="text-xs text-muted-foreground">{t('history.hint')}</p></div>
        <div className="flex items-center gap-2">
          <NativeSelect value={String(weeks)} onChange={(v) => setWeeks(Number(v))} label={t('history.range')} options={HISTORY_WEEKS.map((w) => ({ value: String(w), label: t('history.weeks', { n: w }) }))} className="w-40" />
          <Button variant="outline" size="icon" onClick={() => reload()} aria-label={t('refresh')}><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></Button>
        </div>
      </div>
      {error ? <Toast note={{ tone: 'error', text: apiText(error) }} /> : null}
      {loading && !data ? <Card className="p-8 text-center text-sm text-muted-foreground"><Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />{t('loading')}</Card> : null}
      {data ? (
        <>
          {none ? <p className="rounded-lg border border-amber-400/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-200/90">{t('history.noneCollected')}</p> : null}
          <Card className="p-4 sm:p-5"><h3 className="mb-3 font-semibold">{t('history.messagesWeek')}</h3>
            <BarChart title={t('history.messagesWeek')} labels={labels} values={rows.map((w) => w.messages)} color={COLORS.accent} locale={locale} height={240} emptyLabel={t('nodata')} /></Card>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card className="p-4 sm:p-5"><h3 className="mb-3 font-semibold">{t('history.participantsWeek')} <span className="text-xs font-normal text-muted-foreground">({t('kpi.estimate')})</span></h3>
              <LineChart title={t('history.participantsWeek')} labels={labels} locale={locale} height={220} series={[{ name: t('kpi.participants'), color: COLORS.blue, values: rows.map((w) => w.participants), area: true }]} gapLabel={t('chart.gap_note')} emptyLabel={t('nodata')} /></Card>
            <Card className="p-4 sm:p-5"><h3 className="mb-3 font-semibold">{t('history.channelsWeek')}</h3>
              <LineChart title={t('history.channelsWeek')} labels={labels} locale={locale} height={220} series={[{ name: t('chart.channels'), color: COLORS.teal, values: rows.map((w) => w.active_channels), area: true }]} gapLabel={t('chart.gap_note')} emptyLabel={t('nodata')} /></Card>
          </div>
          <Card className="p-4 sm:p-5">
            <h3 className="mb-3 font-semibold">{t('history.table')}</h3>
            <div className="-mx-2 max-h-96 overflow-auto px-2">
              <table className="w-full min-w-[32rem] text-sm">
                <thead className="sticky top-0 bg-card text-left text-xs text-muted-foreground"><tr><th className="pb-2 font-medium">{t('history.weekOf')}</th><th className="pb-2 text-right font-medium">{t('kpi.messages')}</th><th className="pb-2 text-right font-medium">{t('history.perDay')}</th><th className="pb-2 text-right font-medium">{t('kpi.participants')}</th><th className="pb-2 text-right font-medium">{t('history.activeChannels')}</th><th className="pb-2 text-right font-medium">{t('history.days')}</th></tr></thead>
                <tbody>
                  {[...rows].reverse().map((w) => (
                    <tr key={w.start} className="border-t border-border/40">
                      <td className="py-1.5">{w.start}</td>
                      <td className="py-1.5 text-right tabular-nums">{w.messages === null ? <span className="text-muted-foreground">{t('history.noData')}</span> : formatNumber(w.messages, locale)}</td>
                      <td className="py-1.5 text-right tabular-nums text-muted-foreground">{formatNumber(w.per_day, locale)}</td>
                      <td className="py-1.5 text-right tabular-nums text-muted-foreground">{formatNumber(w.participants, locale)}</td>
                      <td className="py-1.5 text-right tabular-nums text-muted-foreground">{formatNumber(w.active_channels, locale)}</td>
                      <td className="py-1.5 text-right tabular-nums text-muted-foreground">{w.covered_days}/{w.days}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------- reports
function ReportsTab({ guildId, settings, days, readOnly }) {
  const t = useTranslations('statistics');
  const apiText = useApiText();
  const [range, setRange] = useState(days);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(null);
  const make = async () => {
    setBusy(true); setNote(null);
    const r = await st(`guilds/${guildId}/report`, { method: 'POST', body: { days: range } });
    setBusy(false);
    if (!r.ok || !r.blob) { setNote({ tone: 'error', text: apiText(r.data?.error) }); return; }
    const url = URL.createObjectURL(r.blob);
    const link = document.createElement('a');
    link.href = url; link.download = `wody-statistics-${guildId}-${new Date().toISOString().slice(0, 10)}.pdf`;
    document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    setNote({ tone: 'ok', text: t('reports.ready') });
  };
  const pages = ['overview', 'channels', 'health', 'activity', 'notes'];
  return (
    <div className="space-y-6">
      <Section title={t('reports.title')} description={t('reports.intro')} icon={FileText}>
        <ul className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
          {pages.map((p) => <li key={p} className="rounded-lg border border-border/50 bg-secondary/10 px-3 py-2"><b className="block">{t(`reports.pages.${p}.title`)}</b><span className="text-xs text-muted-foreground">{t(`reports.pages.${p}.text`)}</span></li>)}
        </ul>
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-48"><label className="mb-1.5 block text-xs text-muted-foreground">{t('reports.period')}</label>
            <NativeSelect value={String(range)} onChange={(v) => setRange(Number(v))} label={t('reports.period')} options={RANGES.map((r) => ({ value: String(r), label: t('period.days', { n: r }) }))} /></div>
          <Button onClick={make} disabled={busy || readOnly} className="gap-2">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}{t('reports.generate')}</Button>
        </div>
        <Toast note={note} />
        {!settings.enabled && !settings.coverage?.length ? <p className="text-xs text-amber-200/90">{t('reports.needsData')}</p> : null}
        <p className="text-xs text-muted-foreground">{t('reports.privacy')}</p>
      </Section>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------- settings
function SettingsTab({ guildId, settings, onSaved, readOnly }) {
  const t = useTranslations('statistics');
  const apiText = useApiText();
  const [draft, setDraft] = useState(settings);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(null);
  const [confirmPurge, setConfirmPurge] = useState(false);
  const [filter, setFilter] = useState('');
  const list = useStats(`guilds/${guildId}/channels`);
  useEffect(() => { setDraft(settings); }, [settings]);
  const same = (x, y) => JSON.stringify(x) === JSON.stringify(y);
  const patch = {};
  for (const k of ['enabled', 'retention_days', 'access', 'tz_offset', 'excluded_channels', 'excluded_categories', 'thresholds']) if (!same(draft[k], settings[k])) patch[k] = draft[k];
  const dirty = Object.keys(patch).length > 0;
  const th = draft.thresholds;
  const orderOk = th.very_active > th.active && th.active > th.moderate && th.moderate > th.low && th.low >= 0;
  const retentionOk = Number.isInteger(draft.retention_days) && draft.retention_days >= RETENTION.min && draft.retention_days <= RETENTION.max;
  const save = async () => {
    setBusy(true); setNote(null);
    const r = await st(`guilds/${guildId}/settings`, { method: 'PATCH', body: patch });
    setBusy(false);
    if (r.ok) { setNote({ tone: 'ok', text: t('settings.saved') }); onSaved(); return; }
    const code = r.data?.code;
    setNote({ tone: 'error', text: code && t.has(`err.${code}`) ? t(`err.${code}`) : apiText(r.data?.error) });
  };
  const purge = async () => {
    setBusy(true);
    const r = await st(`guilds/${guildId}/purge`, { method: 'POST', body: { confirm: true } });
    setBusy(false); setConfirmPurge(false);
    setNote(r.ok ? { tone: 'ok', text: t('settings.purged', { n: r.data?.deleted ?? 0 }) } : { tone: 'error', text: apiText(r.data?.error) });
    if (r.ok) onSaved();
  };
  const channels = list.data?.channels || []; const categories = list.data?.categories || [];
  const toggleList = (field, id) => setDraft((d) => ({ ...d, [field]: d[field].includes(id) ? d[field].filter((x) => x !== id) : [...d[field], id] }));
  const match = (x) => !filter || x.name.toLowerCase().includes(filter.toLowerCase());
  const setThreshold = (k, v) => setDraft((d) => ({ ...d, thresholds: { ...d.thresholds, [k]: v === '' ? '' : Number(v) } }));
  const tzOptions = Array.from({ length: TZ.max - TZ.min + 1 }, (_, i) => TZ.min + i).map((h) => ({ value: String(h), label: h === 0 ? 'UTC' : `UTC${h > 0 ? '+' : ''}${h}` }));
  return (
    <div className="space-y-6">
      <Toast note={note} />
      <Section title={t('settings.collection')} description={t('settings.collectionHint')} icon={Activity}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium" htmlFor="st-retention">{t('settings.retention')}</label>
            <div className="flex gap-2">
              <Input id="st-retention" type="number" min={RETENTION.min} max={RETENTION.max} value={draft.retention_days} onChange={(e) => setDraft({ ...draft, retention_days: e.target.value === '' ? '' : Number(e.target.value) })} disabled={readOnly} aria-invalid={!retentionOk} />
              <NativeSelect value="" onChange={(v) => v && setDraft({ ...draft, retention_days: Number(v) })} label={t('settings.presets')} className="w-32" options={[{ value: '', label: t('settings.presets') }, ...RETENTION.presets.map((n) => ({ value: String(n), label: t('period.days', { n }) }))]} />
            </div>
            <p className={`mt-1 text-xs ${retentionOk ? 'text-muted-foreground' : 'text-red-400'}`}>{t('settings.retentionHint', { min: RETENTION.min, max: RETENTION.max })}</p>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">{t('settings.access')}</label>
            <NativeSelect value={draft.access} onChange={(v) => setDraft({ ...draft, access: v })} label={t('settings.access')} disabled={readOnly} options={ACCESS.map((x) => ({ value: x, label: t(`settings.accessOptions.${x}`) }))} />
            <p className="mt-1 text-xs text-muted-foreground">{t('settings.accessHint')}</p>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">{t('settings.tz')}</label>
            <NativeSelect value={String(draft.tz_offset)} onChange={(v) => setDraft({ ...draft, tz_offset: Number(v) })} label={t('settings.tz')} disabled={readOnly} options={tzOptions} />
            <p className="mt-1 text-xs text-muted-foreground">{t('settings.tzHint')}</p>
          </div>
        </div>
      </Section>
      <Section title={t('settings.thresholds')} description={t('settings.thresholdsHint')} icon={BarChart3}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {THRESHOLD_KEYS.map((k) => (
            <div key={k}><label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium" htmlFor={`st-th-${k}`}><i className="inline-block h-2 w-2 rounded-full" style={{ background: CLASS_COLORS[k] }} />{t(`class.${k}`)}</label>
              <Input id={`st-th-${k}`} type="number" min={0} step="any" value={th[k]} onChange={(e) => setThreshold(k, e.target.value)} disabled={readOnly} aria-invalid={!orderOk} /></div>
          ))}
        </div>
        <p className={`text-xs ${orderOk ? 'text-muted-foreground' : 'text-red-400'}`}>{orderOk ? t('settings.thresholdsFormula') : t('err.thresholds_order')}</p>
        <Button variant="outline" size="sm" onClick={() => setDraft({ ...draft, thresholds: { ...THRESHOLD_DEFAULTS } })} disabled={readOnly}>{t('settings.resetThresholds')}</Button>
      </Section>
      <Section title={t('settings.excluded')} description={t('settings.excludedHint')} icon={Layers}>
        {list.loading && !list.data ? <p className="text-sm text-muted-foreground">{t('loading')}</p> : list.error ? <Toast note={{ tone: 'error', text: apiText(list.error) }} /> : (
          <>
            <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder={t('channels.search')} aria-label={t('channels.search')} />
            <div className="max-h-72 space-y-3 overflow-y-auto rounded-lg border border-border/50 p-3">
              {categories.filter(match).length ? <div><p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('settings.categories')}</p>
                {categories.filter(match).map((c) => <label key={c.id} className="flex items-center gap-2 py-1 text-sm"><input type="checkbox" className="h-4 w-4 accent-[#e6cd8c]" checked={draft.excluded_categories.includes(c.id)} onChange={() => toggleList('excluded_categories', c.id)} disabled={readOnly} />{c.name}</label>)}</div> : null}
              <div><p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('settings.channelsLabel')}</p>
                {channels.filter(match).map((c) => (
                  <label key={c.id} className="flex items-center gap-2 py-1 text-sm"><input type="checkbox" className="h-4 w-4 accent-[#e6cd8c]" checked={draft.excluded_channels.includes(c.id)} onChange={() => toggleList('excluded_channels', c.id)} disabled={readOnly} />
                    #{c.name}{c.visible ? null : <span className="text-xs text-amber-300/90">{t('settings.cannotSee')}</span>}</label>
                ))}
                {!channels.filter(match).length ? <p className="text-xs text-muted-foreground">{t('channels.noMatch')}</p> : null}</div>
            </div>
          </>
        )}
      </Section>
      <Section title={t('settings.privacyTitle')} description={t('settings.privacyIntro')} icon={ShieldCheck}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-emerald-400/30 bg-emerald-500/5 p-3"><p className="mb-1 text-sm font-semibold">{t('settings.stored')}</p><p className="text-xs leading-relaxed text-muted-foreground">{t('settings.storedText')}</p></div>
          <div className="rounded-lg border border-red-400/30 bg-red-500/5 p-3"><p className="mb-1 text-sm font-semibold">{t('settings.notStored')}</p><p className="text-xs leading-relaxed text-muted-foreground">{t('settings.notStoredText')}</p></div>
        </div>
        <p className="text-xs text-muted-foreground">{t('settings.privacyNote')}</p>
      </Section>
      <Section title={t('settings.danger')} description={t('settings.dangerHint')} icon={Trash2}>
        <Button variant="outline" className="gap-2 border-red-400/40 text-red-300 hover:bg-red-500/10" onClick={() => setConfirmPurge(true)} disabled={readOnly || busy}><Trash2 className="h-4 w-4" />{t('settings.purge')}</Button>
      </Section>
      <ConfirmDialog open={confirmPurge} onOpenChange={setConfirmPurge} title={t('settings.purgeTitle')} description={t('settings.purgeText')} confirmLabel={t('settings.purgeConfirm')} onConfirm={purge} busy={busy} />
      {readOnly ? null : <SaveBar dirty={dirty} saving={busy} disabled={!orderOk || !retentionOk} onSave={save} onDiscard={() => setDraft(settings)} />}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------- the panel
const TABS = [
  { key: 'overview', icon: BarChart3 }, { key: 'channels', icon: Layers }, { key: 'health', icon: HeartPulse },
  { key: 'history', icon: History }, { key: 'reports', icon: FileText }, { key: 'settings', icon: SettingsIcon },
];

export default function StatisticsPanel({ guildId }) {
  const t = useTranslations('statistics');
  const locale = useLocale();
  const apiText = useApiText();
  const [tab, setTab] = useState('overview');
  const [days, setDays] = useState(DEFAULT_RANGE);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(null);
  const settingsQ = useStats(`guilds/${guildId}/settings`);
  const period = `days=${days}`;
  const overview = useStats(`guilds/${guildId}/overview?${period}`);
  const settings = settingsQ.data?.settings;
  const analysisTab = ['overview', 'channels', 'health'].includes(tab);
  const a = overview.data?.analysis;
  const tabs = TABS.map((x) => ({ ...x, label: t(`tab.${x.key}`) }));
  const collecting = Boolean(settings?.enabled);
  // the dashboard sidebar shows this module as active only while counting is on
  useEffect(() => { if (settings) window.dispatchEvent(new CustomEvent('wody:statistics-state', { detail: { guildId, enabled: Boolean(settings.enabled) } })); }, [settings, guildId]);
  const afterSave = () => { settingsQ.reload(); overview.reload('&force=1'); };
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="flex flex-wrap items-center gap-3 text-xl font-bold">{t('title')}
            {settings ? <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${collecting ? 'border-emerald-400/40 bg-emerald-500/10 text-emerald-300' : 'border-border/60 bg-secondary/20 text-muted-foreground'}`}><i className={`inline-block h-1.5 w-1.5 rounded-full ${collecting ? 'bg-emerald-400' : 'bg-muted-foreground'}`} />{collecting ? t('status.on') : t('status.off')}</span> : null}
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        {analysisTab ? (
          <div className="flex flex-wrap items-center gap-2">
            <div role="group" aria-label={t('period.label')} className="flex overflow-hidden rounded-lg border border-border/60">
              {RANGES.map((r) => <button key={r} type="button" aria-pressed={days === r} onClick={() => setDays(r)} className={`px-3 py-1.5 text-sm font-medium transition-colors ${days === r ? 'bg-[#e6cd8c]/20 text-[#f2c091]' : 'text-muted-foreground hover:bg-white/[0.04] hover:text-foreground'}`}>{t('period.short', { n: r })}</button>)}
            </div>
            <Button variant="outline" size="icon" onClick={() => overview.reload('&force=1')} aria-label={t('refresh')} disabled={overview.loading}><RefreshCw className={`h-4 w-4 ${overview.loading ? 'animate-spin' : ''}`} /></Button>
          </div>
        ) : null}
      </div>
      <ModuleTabs tabs={tabs} active={tab} onChange={setTab} />
      <Toast note={note} />
      {settingsQ.error ? <Toast note={{ tone: 'error', text: apiText(settingsQ.error) }} /> : null}
      {analysisTab ? (
        overview.error && !a ? (
          <Card className="space-y-3 p-8 text-center"><p className="text-sm text-muted-foreground">{apiText(overview.error)}</p><Button variant="outline" onClick={() => overview.reload()} className="gap-2"><RefreshCw className="h-4 w-4" />{t('retry')}</Button></Card>
        ) : !a ? <Card className="p-10 text-center text-sm text-muted-foreground"><Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />{t('loading')}</Card> : (
          <div className={overview.loading ? 'opacity-70 transition-opacity' : 'transition-opacity'}>
            {tab === 'overview' ? <OverviewTab a={a} locale={locale} /> : null}
            {tab === 'channels' ? <ChannelsTab guildId={guildId} a={a} locale={locale} period={period} /> : null}
            {tab === 'health' ? <HealthTab a={a} locale={locale} /> : null}
          </div>
        )
      ) : null}
      {tab === 'history' ? <HistoryTab guildId={guildId} locale={locale} /> : null}
      {tab === 'reports' && settings ? <ReportsTab guildId={guildId} settings={settings} days={days} /> : null}
      {tab === 'settings' && settings ? <SettingsTab guildId={guildId} settings={settings} onSaved={afterSave} /> : null}
    </div>
  );
}

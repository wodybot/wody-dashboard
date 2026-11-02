'use client';
// Invite Tracking statistics: the same numbers as the bot's /statistics (lib/invite-stats.js is checked against the bot's
// own maths), for the last 7, 14, 30 or 90 days. Only joins Wody recorded are counted, which the page says openly.
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LoadingOrError, useApi } from '@/components/module-kit';
import { STAT_RANGES } from '@/lib/invite-stats';

const JOIN = '#e6cd8c';
const LEAVE = '#f87171';
const NET = '#34d399';

function Kpi({ label, value, hint }) {
  return (
    <Card className="bg-card/60 p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
      {hint ? <div className="mt-1 text-[11px] leading-snug text-muted-foreground">{hint}</div> : null}
    </Card>
  );
}

function Bars({ values, labels, color = JOIN, title }) {
  const max = Math.max(1, ...values);
  return (
    <div className="flex h-28 items-end gap-[3px]" role="img" aria-label={title}>
      {values.map((v, i) => (
        <div key={i} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1" title={`${labels[i]}: ${v}`}>
          <div className="w-full rounded-t" style={{ height: `${Math.max(v ? 4 : 1, (v / max) * 100)}%`, background: v ? color : 'rgba(148,163,184,0.25)' }} />
        </div>
      ))}
    </div>
  );
}

function DailyChart({ stats, t }) {
  const W = 720; const H = 230; const pad = { l: 34, r: 10, t: 12, b: 24 };
  const n = stats.days;
  const maxUp = Math.max(1, ...stats.joins);
  const maxDown = Math.max(1, ...stats.leaves);
  const innerH = H - pad.t - pad.b;
  const zero = pad.t + (innerH * maxUp) / (maxUp + maxDown);
  const unit = innerH / (maxUp + maxDown);
  const slot = (W - pad.l - pad.r) / n;
  const bw = Math.max(2, Math.min(18, slot * 0.62));
  const cum = stats.net_cumulative;
  const cmin = Math.min(0, ...cum); const cmax = Math.max(0, ...cum);
  const cy = (v) => pad.t + innerH - ((v - cmin) / Math.max(1, cmax - cmin)) * innerH;
  const x = (i) => pad.l + slot * i + slot / 2;
  const every = n > 45 ? 10 : n > 20 ? 5 : n > 10 ? 2 : 1;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={t('chartLabel')}>
      <line x1={pad.l} x2={W - pad.r} y1={zero} y2={zero} stroke="currentColor" strokeOpacity="0.25" />
      {[maxUp, Math.round(maxUp / 2)].filter((v, i, a) => v > 0 && a.indexOf(v) === i).map((v) => (
        <g key={v}><line x1={pad.l} x2={W - pad.r} y1={zero - v * unit} y2={zero - v * unit} stroke="currentColor" strokeOpacity="0.08" /><text x={pad.l - 6} y={zero - v * unit + 3} textAnchor="end" fontSize="9" fill="currentColor" opacity="0.55">{v}</text></g>
      ))}
      {stats.joins.map((v, i) => (
        <g key={i}>
          <title>{`${stats.day_list[i]}: +${v} / -${stats.leaves[i]}`}</title>
          {v ? <rect x={x(i) - bw / 2} y={zero - v * unit} width={bw} height={v * unit} rx="2" fill={JOIN} /> : null}
          {stats.leaves[i] ? <rect x={x(i) - bw / 2} y={zero} width={bw} height={stats.leaves[i] * unit} rx="2" fill={LEAVE} opacity="0.85" /> : null}
          {i % every === 0 ? <text x={x(i)} y={H - 8} textAnchor="middle" fontSize="9" fill="currentColor" opacity="0.55">{stats.day_list[i].slice(5)}</text> : null}
        </g>
      ))}
      <polyline fill="none" stroke={NET} strokeWidth="2" strokeLinejoin="round" points={cum.map((v, i) => `${x(i)},${cy(v)}`).join(' ')} />
    </svg>
  );
}

function Rows({ rows, empty, render }) {
  if (!rows.length) return <p className="text-xs text-muted-foreground">{empty}</p>;
  const max = Math.max(1, ...rows.map((r) => r.n));
  return (
    <ul className="space-y-1.5">
      {rows.map((r) => (
        <li key={r.key} className="text-xs">
          <div className="flex justify-between gap-2"><span className="min-w-0 truncate">{render(r)}</span><span className="tabular-nums text-muted-foreground">{r.n}</span></div>
          <div className="mt-1 h-1 rounded bg-secondary/50"><div className="h-1 rounded" style={{ width: `${(r.n / max) * 100}%`, background: JOIN }} /></div>
        </li>
      ))}
    </ul>
  );
}

export default function InviteStats({ guildId }) {
  const t = useTranslations('guildSettings.invites.statistics');
  const [days, setDays] = useState(30);
  const api = useApi(guildId, `invites/statistics?days=${days}`);
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-xs leading-relaxed text-muted-foreground">{t('note')}</p>
        <div className="flex gap-1.5" role="group" aria-label={t('range')}>
          {STAT_RANGES.map((d) => (
            <Button key={d} size="sm" variant={d === days ? 'default' : 'outline'} aria-pressed={d === days} onClick={() => setDays(d)}>{t('days', { n: d })}</Button>
          ))}
        </div>
      </div>
      <LoadingOrError loading={api.loading} error={api.error} data={api.data} onRetry={api.reload}>
        {api.data ? <Body stats={api.data} t={t} /> : null}
      </LoadingOrError>
    </div>
  );
}

function Body({ stats, t }) {
  const tot = stats.totals;
  const weekdayNames = t.raw('weekdays');
  const sourceRows = Object.entries(stats.sources).map(([key, n]) => ({ key, n }));
  const ageRows = Object.entries(stats.ages).map(([key, n]) => ({ key, n }));
  const net = tot.net > 0 ? `+${tot.net}` : String(tot.net);
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label={t('kpi.joins')} value={tot.joins.toLocaleString()} hint={t('kpi.avg', { n: tot.avg_per_day })} />
        <Kpi label={t('kpi.leaves')} value={tot.leaves.toLocaleString()} />
        <Kpi label={t('kpi.net')} value={net} hint={t('kpi.netHint')} />
        <Kpi label={t('kpi.retention')} value={tot.retention === null ? '-' : `${tot.retention}%`} hint={t('kpi.retentionHint')} />
        <Kpi label={t('kpi.quick')} value={tot.quick_leavers.toLocaleString()} hint={t('kpi.quickHint')} />
        <Kpi label={t('kpi.fake')} value={tot.fake.toLocaleString()} hint={t('kpi.fakeHint')} />
        <Kpi label={t('kpi.best')} value={tot.best_day === null ? '-' : stats.day_list[tot.best_day].slice(5)} hint={tot.best_day === null ? undefined : t('kpi.bestHint', { n: stats.joins[tot.best_day] })} />
        <Kpi label={t('kpi.still')} value={tot.still_here.toLocaleString()} />
      </div>

      <Card className="bg-card/60 p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold">{t('chartTitle', { n: stats.days })}</h3>
          <div className="flex gap-3 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1.5"><i className="inline-block h-2 w-2 rounded-sm" style={{ background: JOIN }} />{t('legend.joins')}</span>
            <span className="flex items-center gap-1.5"><i className="inline-block h-2 w-2 rounded-sm" style={{ background: LEAVE }} />{t('legend.leaves')}</span>
            <span className="flex items-center gap-1.5"><i className="inline-block h-0.5 w-3" style={{ background: NET }} />{t('legend.net')}</span>
          </div>
        </div>
        <DailyChart stats={stats} t={t} />
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="bg-card/60 p-4"><h3 className="mb-3 text-sm font-semibold">{t('weekdaysTitle')}</h3><Bars values={stats.weekdays} labels={weekdayNames} title={t('weekdaysTitle')} />
          <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">{weekdayNames.map((d) => <span key={d}>{d}</span>)}</div></Card>
        <Card className="bg-card/60 p-4"><h3 className="mb-3 text-sm font-semibold">{t('hoursTitle')}</h3><Bars values={stats.hours} labels={stats.hours.map((_, i) => `${String(i).padStart(2, '0')}:00 UTC`)} title={t('hoursTitle')} color="#7dd3fc" />
          <div className="mt-1 flex justify-between text-[10px] text-muted-foreground"><span>00</span><span>06</span><span>12</span><span>18</span><span>23</span></div></Card>
        <Card className="bg-card/60 p-4"><h3 className="mb-3 text-sm font-semibold">{t('invitersTitle')}</h3>
          <Rows rows={stats.inviters.map((r) => ({ key: r.id, n: r.joins, ...r }))} empty={t('noInviters')} render={(r) => r.name || r.id} /></Card>
        <Card className="bg-card/60 p-4"><h3 className="mb-3 text-sm font-semibold">{t('codesTitle')}</h3>
          <Rows rows={stats.codes.map((r) => ({ key: r.code, n: r.joins, ...r }))} empty={t('noCodes')} render={(r) => <code>{r.code}</code>} /></Card>
        <Card className="bg-card/60 p-4"><h3 className="mb-3 text-sm font-semibold">{t('sourcesTitle')}</h3>
          <Rows rows={sourceRows} empty={t('noData')} render={(r) => t(`sources.${r.key}`)} /></Card>
        <Card className="bg-card/60 p-4"><h3 className="mb-3 text-sm font-semibold">{t('agesTitle')}</h3>
          <Rows rows={ageRows} empty={t('noData')} render={(r) => t(`ages.${r.key}`)} /></Card>
      </div>
    </div>
  );
}

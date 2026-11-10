'use client';
// A two-month calendar for a server season: days taken by Wody (a Wody season or dates the Owner blocked) are marked, the days of the
// season being edited are highlighted, and a click picks the first and the last day. The rule itself lives in lib/battlepass/schedule.js.
import { useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

const DAY = 86400000;
const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };

function Month({ year, month, busy, from, to, onPick, locale, t }) {
  const first = new Date(year, month, 1);
  const lead = (first.getDay() + 6) % 7;                       // Monday first
  const count = new Date(year, month + 1, 0).getDate();
  const names = useMemo(() => {
    const f = new Intl.DateTimeFormat(locale, { weekday: 'narrow' });
    return Array.from({ length: 7 }, (_, i) => f.format(new Date(2024, 0, 1 + i)));
  }, [locale]);
  const cells = [...Array(lead).fill(null), ...Array.from({ length: count }, (_, i) => new Date(year, month, i + 1))];
  const today = startOfDay(new Date()).getTime();
  return (
    <div className="min-w-[15rem] flex-1">
      <p className="mb-2 text-center text-sm font-semibold capitalize">{new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(first)}</p>
      <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-muted-foreground" aria-hidden="true">{names.map((n, i) => <span key={i}>{n}</span>)}</div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {cells.map((d, i) => {
          if (!d) return <span key={`e${i}`} />;
          const s = d.getTime(); const e = s + DAY;
          const hit = busy.filter((r) => new Date(r.starts_at).getTime() < e && (r.ends_at ? new Date(r.ends_at).getTime() > s : true));
          const kind = hit.some((r) => r.kind === 'global') ? 'global' : hit.length ? 'blocked' : null;
          const mine = from !== null && s >= startOfDay(from).getTime() && s <= startOfDay(to ?? from).getTime();
          const clash = mine && kind;
          const past = s < today;
          const tone = clash ? 'bg-red-500/30 text-red-100 ring-1 ring-red-400/70' : mine ? 'bg-[#e6cd8c]/25 text-[#f2c091] ring-1 ring-[#e6cd8c]/60' : kind === 'global' ? 'bg-sky-500/20 text-sky-200' : kind === 'blocked' ? 'bg-amber-500/20 text-amber-200' : 'hover:bg-white/10';
          const label = `${d.toLocaleDateString(locale, { dateStyle: 'long' })}${hit.length ? `: ${hit.map((r) => r.name || t(`calendar.kind.${r.kind}`)).join(', ')}` : ''}`;
          return (
            <button key={s} type="button" disabled={past} onClick={() => onPick(d)} title={label} aria-label={label} aria-pressed={mine}
              className={`h-9 rounded-md text-xs tabular-nums transition disabled:cursor-not-allowed disabled:opacity-30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#e6cd8c] ${tone}`}>
              {d.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function BusyCalendar({ busy = [], start, end, onPick }) {
  const locale = useLocale();
  const t = useTranslations('battlepass');
  const [offset, setOffset] = useState(0);
  const [anchor, setAnchor] = useState(null);
  const base = new Date(); base.setDate(1); base.setMonth(base.getMonth() + offset);
  const next = new Date(base); next.setMonth(next.getMonth() + 1);
  const from = start ? new Date(start) : null;
  const to = end ? new Date(end) : null;

  const pick = (day) => {
    if (!onPick) return;
    if (!anchor) { setAnchor(day); onPick({ starts_at: startOfDay(day).toISOString(), ends_at: null }); return; }
    const [a, b] = day < anchor ? [day, anchor] : [anchor, day];
    const last = new Date(b); last.setHours(23, 59, 0, 0);
    setAnchor(null);
    onPick({ starts_at: startOfDay(a).toISOString(), ends_at: last.toISOString() });
  };

  return (
    <div className="rounded-xl border border-border/60 bg-background/30 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <Button type="button" variant="ghost" size="icon" aria-label={t('calendar.prev')} disabled={offset <= 0} onClick={() => setOffset((o) => Math.max(0, o - 1))}><ChevronLeft className="h-4 w-4" /></Button>
        <p className="text-xs text-muted-foreground">{anchor ? t('calendar.pickEnd') : t('calendar.pickStart')}</p>
        <Button type="button" variant="ghost" size="icon" aria-label={t('calendar.next')} disabled={offset >= 24} onClick={() => setOffset((o) => o + 1)}><ChevronRight className="h-4 w-4" /></Button>
      </div>
      <div className="flex flex-wrap gap-6">
        <Month year={base.getFullYear()} month={base.getMonth()} busy={busy} from={from} to={to} onPick={pick} locale={locale} t={t} />
        <Month year={next.getFullYear()} month={next.getMonth()} busy={busy} from={from} to={to} onPick={pick} locale={locale} t={t} />
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-muted-foreground">
        <li className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-sky-500/40" aria-hidden="true" />{t('calendar.kind.global')}</li>
        <li className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-amber-500/40" aria-hidden="true" />{t('calendar.kind.blocked')}</li>
        <li className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-[#e6cd8c]/40" aria-hidden="true" />{t('calendar.yours')}</li>
        <li className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-red-500/50" aria-hidden="true" />{t('calendar.clash')}</li>
      </ul>
    </div>
  );
}

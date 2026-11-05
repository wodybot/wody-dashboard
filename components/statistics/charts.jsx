'use client';
// Charts of Wody Statistics, drawn as inline SVG (the site loads nothing from outside). Every chart measures its own width, so text keeps
// its real size on a phone; x labels are thinned so none overlap; days without collected data are gaps, never zeros; each chart has an
// accessible name and a hover or keyboard tooltip.
import { useEffect, useMemo, useRef, useState } from 'react';
import { areaPathOf, dayLabel, formatNumber, heatMix, labelIndexes, nearestIndex, niceTicks, pathOf, rangeTicks, runs, scale, scoreColor, signedTicks } from '@/lib/statistics/chart-math';

export const COLORS = {
  accent: '#e88a4e', blue: '#60a5fa', green: '#34d399', red: '#f87171', gold: '#fbbf24', violet: '#a78bfa', teal: '#2dd4bf', pink: '#f472b6', faint: '#7b8294',
};
export const CLASS_COLORS = { very_active: COLORS.green, active: COLORS.teal, moderate: COLORS.blue, low: COLORS.gold, inactive: COLORS.faint };
export const SERIES = [COLORS.accent, COLORS.blue, COLORS.teal, COLORS.violet, COLORS.gold];

function useWidth(fallback = 640) {
  const ref = useRef(null);
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const apply = () => setWidth(Math.max(240, Math.round(el.getBoundingClientRect().width)));
    apply();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

const TEXT = { fill: 'currentColor', fillOpacity: 0.62, fontSize: 11 };

function Frame({ title, description, children, className = '' }) {
  return (
    <figure className={`relative ${className}`} aria-label={title}>
      {children}
      {description ? <figcaption className="sr-only">{description}</figcaption> : null}
    </figure>
  );
}

function Tooltip({ x, y, width, children }) {
  if (x === null) return null;
  const flip = x > width * 0.6;
  return (
    <div
      role="status" className="pointer-events-none absolute z-10 min-w-[8rem] rounded-lg border border-border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-lg"
      style={{ left: flip ? 'auto' : Math.min(x + 12, width - 140), right: flip ? Math.max(width - x + 12, 0) : 'auto', top: Math.max(y - 8, 0) }}
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------- line / area
/** series: [{ name, color, values: (number | null)[], area?, dashed? }]; labels: strings, one per value. */
export function LineChart({ title, labels, series, locale = 'en', height = 260, signed = false, fit = false, gapLabel, emptyLabel, formatValue }) {
  const [ref, width] = useWidth();
  const [hover, setHover] = useState(null);
  const fmt = formatValue || ((v) => formatNumber(v, locale));
  const all = series.flatMap((s) => s.values).filter((v) => v !== null && v !== undefined);
  const margin = { l: 46, r: 14, t: 14, b: 28 };
  const plot = { x0: margin.l, x1: width - margin.r, y0: margin.t, y1: height - margin.b };
  const n = Math.max(...series.map((s) => s.values.length), 0);
  const geo = useMemo(() => {
    if (!all.length) return null;
    const hi = Math.max(...all); const lo = Math.min(...all);
    const t = signed ? signedTicks(lo, hi) : fit ? rangeTicks(lo, hi) : { min: 0, ...niceTicks(hi) };
    const y = scale(t.min, t.max, plot.y1, plot.y0);
    const x = (i) => (n > 1 ? plot.x0 + (i / (n - 1)) * (plot.x1 - plot.x0) : (plot.x0 + plot.x1) / 2);
    return { t, y, x };
  }, [all.length, n, width, height, signed, fit, series]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!geo) return <EmptyChart title={title} text={emptyLabel} height={height} />;
  const { t, y, x } = geo;
  const idx = labelIndexes(n, plot.x1 - plot.x0, 38);
  const gaps = Array.from({ length: n }, (_, i) => i).filter((i) => series.every((s) => s.values[i] === null || s.values[i] === undefined));
  const onMove = (e) => {
    const r = ref.current.getBoundingClientRect();
    setHover(nearestIndex(e.clientX - r.left, plot.x0, plot.x1, n));
  };
  const hx = hover === null ? null : x(hover);
  return (
    <Frame title={title} description={series.map((s) => `${s.name}: ${s.values.map((v) => (v === null ? '-' : fmt(v))).join(', ')}`).join('. ')}>
      <div ref={ref} className="relative" onMouseMove={onMove} onMouseLeave={() => setHover(null)} onFocus={() => setHover(n - 1)} onBlur={() => setHover(null)}
        onKeyDown={(e) => { if (e.key === 'ArrowLeft') setHover((h) => Math.max(0, (h ?? n) - 1)); if (e.key === 'ArrowRight') setHover((h) => Math.min(n - 1, (h ?? -1) + 1)); if (e.key === 'Escape') setHover(null); }} tabIndex={0}>
        <svg width={width} height={height} role="img" aria-label={title} className="block select-none overflow-visible">
          <title>{title}</title>
          {t.ticks.map((tk) => (
            <g key={tk}>
              <line x1={plot.x0} x2={plot.x1} y1={y(tk)} y2={y(tk)} stroke="currentColor" strokeOpacity={tk === 0 && signed ? 0.35 : 0.1} />
              <text x={plot.x0 - 8} y={y(tk)} textAnchor="end" dominantBaseline="middle" {...TEXT}>{fmt(tk)}</text>
            </g>
          ))}
          {idx.map((i) => <text key={i} x={x(i)} y={plot.y1 + 18} textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'} {...TEXT}>{labels[i]}</text>)}
          {gaps.map((i) => <rect key={`g${i}`} x={x(i) - 1.5} y={plot.y1 - 5} width={3} height={5} rx={1} fill="currentColor" fillOpacity={0.3} />)}
          {series.map((s) => runs(s.values).map((r, k) => {
            const pts = r.map(([i, v]) => [x(i), y(v)]);
            return (
              <g key={`${s.name}${k}`}>
                {s.area && pts.length > 1 ? <path d={areaPathOf(pts, signed ? y(0) : plot.y1)} fill={s.color} fillOpacity={0.16} /> : null}
                <path d={pathOf(pts)} fill="none" stroke={s.color} strokeWidth={s.dashed ? 1.8 : 2.4} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={s.dashed ? '5 5' : undefined} strokeOpacity={s.dashed ? 0.7 : 1} />
              </g>
            );
          }))}
          {hover !== null ? <line x1={hx} x2={hx} y1={plot.y0} y2={plot.y1} stroke="currentColor" strokeOpacity={0.25} /> : null}
          {hover !== null ? series.map((s) => (s.values[hover] === null || s.values[hover] === undefined ? null : <circle key={s.name} cx={hx} cy={y(s.values[hover])} r={4} fill={s.color} stroke="hsl(var(--background))" strokeWidth={2} />)) : null}
        </svg>
        <Tooltip x={hx} y={margin.t} width={width}>
          {hover !== null ? (
            <>
              <p className="mb-1 font-semibold">{labels[hover]}</p>
              {series.map((s) => (
                <p key={s.name} className="flex items-center justify-between gap-4"><span className="flex items-center gap-1.5"><i className="inline-block h-2 w-2 rounded-sm" style={{ background: s.color }} />{s.name}</span><b>{s.values[hover] === null || s.values[hover] === undefined ? '-' : fmt(s.values[hover])}</b></p>
              ))}
            </>
          ) : null}
        </Tooltip>
      </div>
      <Legend series={series} gap={gaps.length && gapLabel ? gapLabel : null} />
    </Frame>
  );
}

function Legend({ series, gap }) {
  const shown = series.length > 1 || series.some((s) => s.dashed);
  if (!shown && !gap) return null;
  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {shown ? series.map((s) => <span key={s.name} className="flex items-center gap-1.5"><i className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: s.color, opacity: s.dashed ? 0.6 : 1 }} />{s.name}</span>) : null}
      {gap ? <span>{gap}</span> : null}
    </div>
  );
}

function EmptyChart({ title, text, height }) {
  return (
    <div role="img" aria-label={title} className="flex items-center justify-center rounded-xl border border-dashed border-border/60 bg-secondary/10 px-4 text-center text-sm text-muted-foreground" style={{ height: Math.min(height, 180) }}>
      {text}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------- bars
export function BarChart({ title, labels, values, color = COLORS.blue, highlight = null, locale = 'en', height = 220, emptyLabel, showValues = null, formatValue }) {
  const [ref, width] = useWidth();
  const [hover, setHover] = useState(null);
  const fmt = formatValue || ((v) => formatNumber(v, locale));
  const real = values.filter((v) => v !== null && v !== undefined);
  const margin = { l: 46, r: 12, t: 16, b: 28 };
  const n = values.length;
  if (!real.length || Math.max(...real) <= 0) return <EmptyChart title={title} text={emptyLabel} height={height} />;
  const t = niceTicks(Math.max(...real));
  const plot = { x0: margin.l, x1: width - margin.r, y0: margin.t, y1: height - margin.b };
  const y = scale(0, t.max, plot.y1, plot.y0);
  const slot = (plot.x1 - plot.x0) / n;
  const bw = Math.min(40, Math.max(3, slot * 0.66));
  const mid = (i) => plot.x0 + slot * (i + 0.5);
  const idx = labelIndexes(n, plot.x1 - plot.x0 - slot, 38);
  const values_ = showValues ?? (n <= 14 && slot > 34);
  return (
    <Frame title={title} description={values.map((v, i) => `${labels[i]}: ${v === null ? '-' : fmt(v)}`).join(', ')}>
      <div ref={ref} className="relative" onMouseLeave={() => setHover(null)}>
        <svg width={width} height={height} role="img" aria-label={title} className="block select-none">
          <title>{title}</title>
          {t.ticks.map((tk) => (
            <g key={tk}><line x1={plot.x0} x2={plot.x1} y1={y(tk)} y2={y(tk)} stroke="currentColor" strokeOpacity={0.1} /><text x={plot.x0 - 8} y={y(tk)} textAnchor="end" dominantBaseline="middle" {...TEXT}>{fmt(tk)}</text></g>
          ))}
          {idx.map((i) => <text key={i} x={mid(i)} y={plot.y1 + 18} textAnchor="middle" {...TEXT}>{labels[i]}</text>)}
          {values.map((v, i) => {
            if (v === null || v === undefined) return <rect key={i} x={mid(i) - 1.5} y={plot.y1 - 5} width={3} height={5} rx={1} fill="currentColor" fillOpacity={0.3} />;
            const h = Math.max(v > 0 ? 2 : 0, plot.y1 - y(v));
            return (
              <g key={i} onMouseEnter={() => setHover(i)}>
                <rect x={mid(i) - slot / 2} y={plot.y0} width={slot} height={plot.y1 - plot.y0} fill="transparent" />
                <rect x={mid(i) - bw / 2} y={plot.y1 - h} width={bw} height={h} rx={Math.min(6, bw / 2)} fill={color} fillOpacity={highlight === null || highlight === i ? (hover === i ? 1 : 0.88) : 0.4} />
                {values_ && v > 0 ? <text x={mid(i)} y={plot.y1 - h - 6} textAnchor="middle" fill="currentColor" fontSize={11} fontWeight={600}>{fmt(v)}</text> : null}
              </g>
            );
          })}
        </svg>
        <Tooltip x={hover === null ? null : mid(hover)} y={margin.t} width={width}>
          {hover !== null ? <><p className="font-semibold">{labels[hover]}</p><p>{values[hover] === null ? '-' : fmt(values[hover])}</p></> : null}
        </Tooltip>
      </div>
    </Frame>
  );
}

// ---------------------------------------------------------------------------------------------- donut
export function Donut({ title, rows, centerValue, centerLabel, locale = 'en', emptyLabel }) {
  const data = rows.filter((r) => r.value > 0);
  const total = data.reduce((a, r) => a + r.value, 0);
  const [hover, setHover] = useState(null);
  if (!total) return <EmptyChart title={title} text={emptyLabel} height={160} />;
  const R = 70; const r = 46; const C = 2 * Math.PI * ((R + r) / 2); const sw = R - r;
  let acc = 0;
  return (
    <Frame title={title} description={data.map((d) => `${d.label}: ${d.value}`).join(', ')} className="flex flex-wrap items-center gap-6">
      <svg width={160} height={160} viewBox="0 0 160 160" role="img" aria-label={title} className="shrink-0">
        <title>{title}</title>
        <g transform="rotate(-90 80 80)">
          {data.map((d, i) => {
            const len = (d.value / total) * C;
            const gap = data.length > 1 ? 2 : 0;
            const el = (
              <circle key={d.label} cx={80} cy={80} r={(R + r) / 2} fill="none" stroke={d.color} strokeWidth={hover === i ? sw + 4 : sw} strokeDasharray={`${Math.max(len - gap, 0.1)} ${C}`} strokeDashoffset={-acc}
                onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} />
            );
            acc += len;
            return el;
          })}
        </g>
        <text x={80} y={78} textAnchor="middle" dominantBaseline="middle" fill="currentColor" fontSize={26} fontWeight={700}>{hover === null ? centerValue : formatNumber(data[hover].value, locale)}</text>
        <text x={80} y={100} textAnchor="middle" fill="currentColor" fillOpacity={0.6} fontSize={11}>{hover === null ? centerLabel : data[hover].label}</text>
      </svg>
      <ul className="min-w-[10rem] flex-1 space-y-1.5 text-sm">
        {data.map((d, i) => (
          <li key={d.label} className="flex items-center justify-between gap-4" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
            <span className="flex items-center gap-2"><i className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: d.color }} />{d.label}</span>
            <span className="text-muted-foreground"><b className="text-foreground">{formatNumber(d.value, locale)}</b> · {Math.round((d.value / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </Frame>
  );
}

// ---------------------------------------------------------------------------------------------- heatmap
export function Heatmap({ title, matrix, weekdays, locale = 'en', unit = '', emptyLabel, lowLabel = '0' }) {
  const [ref, width] = useWidth();
  const [hover, setHover] = useState(null);
  const peak = Math.max(0, ...matrix.flat());
  if (!(peak > 0)) return <EmptyChart title={title} text={emptyLabel} height={160} />;
  const left = 38; const top = 4; const cw = (width - left) / 24; const ch = Math.max(16, Math.min(28, cw * 1.3));
  const height = top + 7 * ch + 24;
  const hourIdx = labelIndexes(24, width - left - cw, 22).filter((h) => h < 24);
  return (
    <Frame title={title} description={`${lowLabel} - ${formatNumber(peak, locale)}`}>
      <div ref={ref} className="relative" onMouseLeave={() => setHover(null)}>
        <svg width={width} height={height} role="img" aria-label={title} className="block select-none">
          <title>{title}</title>
          {weekdays.map((d, wd) => <text key={d} x={left - 8} y={top + wd * ch + ch / 2} textAnchor="end" dominantBaseline="middle" {...TEXT}>{d}</text>)}
          {matrix.map((row, wd) => row.map((v, h) => (
            <rect key={`${wd}-${h}`} x={left + h * cw + 1} y={top + wd * ch + 1} width={Math.max(1, cw - 2)} height={ch - 2} rx={4} fill={`rgb(${heatMix(v, peak).join(',')})`}
              stroke={hover && hover[0] === wd && hover[1] === h ? 'currentColor' : 'none'} onMouseEnter={() => setHover([wd, h])} />
          )))}
          {hourIdx.map((h) => <text key={h} x={left + h * cw + cw / 2} y={top + 7 * ch + 16} textAnchor="middle" {...TEXT}>{String(h).padStart(2, '0')}</text>)}
        </svg>
        <Tooltip x={hover ? left + hover[1] * cw + cw / 2 : null} y={top + (hover ? hover[0] * ch : 0)} width={width}>
          {hover ? <><p className="font-semibold">{weekdays[hover[0]]} {String(hover[1]).padStart(2, '0')}:00</p><p>{formatNumber(matrix[hover[0]][hover[1]], locale)} {unit}</p></> : null}
        </Tooltip>
      </div>
      <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
        <span>{lowLabel}</span>
        <i className="h-2.5 w-28 rounded-full" style={{ background: `linear-gradient(90deg, rgb(${heatMix(0, 1).join(',')}), rgb(${heatMix(1, 1).join(',')}))` }} />
        <span>{formatNumber(peak, locale)} {unit}</span>
      </div>
    </Frame>
  );
}

// ---------------------------------------------------------------------------------------------- gauge
export function Gauge({ title, score, caption, size = 220 }) {
  const color = scoreColor(score);
  const R = size / 2 - 16; const cx = size / 2; const cy = size / 2 + 4;
  const arc = (from, to) => {
    const a = (d) => [cx + R * Math.cos((Math.PI * d) / 180), cy + R * Math.sin((Math.PI * d) / 180)];
    const [x0, y0] = a(from); const [x1, y1] = a(to);
    return `M${x0.toFixed(2)},${y0.toFixed(2)}A${R},${R} 0 ${to - from > 180 ? 1 : 0} 1 ${x1.toFixed(2)},${y1.toFixed(2)}`;
  };
  return (
    <Frame title={title} description={score === null || score === undefined ? '' : `${score} / 100`}>
      <svg width={size} height={size * 0.68} viewBox={`0 0 ${size} ${size * 0.68}`} role="img" aria-label={`${title}: ${score ?? '-'}`} className="mx-auto block">
        <title>{title}</title>
        <path d={arc(180, 360)} fill="none" stroke="currentColor" strokeOpacity={0.12} strokeWidth={18} strokeLinecap="round" />
        {typeof score === 'number' && score > 0 ? <path d={arc(180, 180 + 180 * Math.min(100, score) / 100)} fill="none" stroke={color} strokeWidth={18} strokeLinecap="round" /> : null}
        <text x={cx} y={cy - 22} textAnchor="middle" fill="currentColor" fontSize={46} fontWeight={700}>{score ?? '-'}</text>
        <text x={cx} y={cy + 4} textAnchor="middle" fill="currentColor" fillOpacity={0.55} fontSize={13}>/ 100</text>
      </svg>
      {caption ? <p className="mt-1 text-center text-base font-semibold" style={{ color }}>{caption}</p> : null}
    </Frame>
  );
}

// ---------------------------------------------------------------------------------------------- small pieces
export function Sparkline({ values, color = COLORS.accent, width = 96, height = 28 }) {
  const real = values.filter((v) => v !== null && v !== undefined);
  if (real.length < 2) return <span className="inline-block text-xs text-muted-foreground" style={{ width }}>-</span>;
  const hi = Math.max(...real, 1);
  const x = (i) => 2 + (i / (values.length - 1)) * (width - 4);
  const y = scale(0, hi, height - 3, 3);
  return (
    <svg width={width} height={height} aria-hidden="true" className="block">
      {runs(values).map((r, k) => <path key={k} d={pathOf(r.map(([i, v]) => [x(i), y(v)]))} fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />)}
    </svg>
  );
}

export function Delta({ value, className = '' }) {
  if (value === null || value === undefined) return null;
  const tone = value > 0 ? 'text-emerald-400 bg-emerald-500/10' : value < 0 ? 'text-red-400 bg-red-500/10' : 'text-muted-foreground bg-secondary/30';
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${tone} ${className}`}>{value > 0 ? '▲ ' : value < 0 ? '▼ ' : ''}{Math.abs(Math.round(value))}%</span>;
}

export function Meter({ value, color, label }) {
  const v = value === null || value === undefined ? null : Math.max(0, Math.min(100, value));
  return (
    <div role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={v ?? undefined} className="h-2 w-full overflow-hidden rounded-full bg-secondary/40">
      {v === null ? null : <div className="h-full rounded-full" style={{ width: `${Math.max(v, 3)}%`, background: color }} />}
    </div>
  );
}

export { dayLabel };

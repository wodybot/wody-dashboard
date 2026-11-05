// Pure maths of the Statistics charts (ticks, scales, paths with gaps, label thinning). No React, no DOM: tested on its own.

/** A "nice" top value and ticks from 0: 87 -> 100 with 0, 25, 50, 75, 100. */
export function niceTicks(top, count = 5) {
  if (!(top > 0) || !Number.isFinite(top)) return { max: 4, ticks: [0, 1, 2, 3, 4] };
  const raw = top / Math.max(1, count - 1);
  const mag = 10 ** Math.floor(Math.log10(raw));
  let step = mag;
  for (const m of [1, 2, 2.5, 5, 10]) { step = m * mag; if (step * (count - 1) >= top) break; }
  const n = Math.ceil(top / step - 1e-9);
  const ticks = Array.from({ length: n + 1 }, (_, i) => +(step * i).toFixed(10));
  return { max: ticks[ticks.length - 1], ticks };
}

/** Ticks for a range that crosses zero (growth): symmetric around 0. */
export function signedTicks(lo, hi, count = 5) {
  const span = Math.max(Math.abs(lo), Math.abs(hi), 1);
  const { ticks } = niceTicks(span, Math.max(3, Math.ceil(count / 2) + 1));
  const all = [...new Set([...ticks.map((t) => -t), ...ticks])].sort((a, b) => a - b);
  return { min: all[0], max: all[all.length - 1], ticks: all };
}

/** Ticks for a curve that should not start at zero (member counts): a nice window around the data, never narrower than the data. */
export function rangeTicks(lo, hi, count = 5) {
  if (![lo, hi].every(Number.isFinite)) return { min: 0, max: 4, ticks: [0, 1, 2, 3, 4] };
  const span = Math.max(hi - lo, Math.abs(hi) * 0.02, 4);
  const { ticks } = niceTicks(span, count);
  const step = ticks.length > 1 ? ticks[1] - ticks[0] : 1;
  const min = Math.max(0, Math.floor((lo - (span - (hi - lo)) / 2) / step) * step);
  const out = [];
  for (let v = min; v < hi + step - 1e-9 || out.length < 2; v += step) out.push(+v.toFixed(10));
  return { min: out[0], max: out[out.length - 1], ticks: out };
}

export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** Linear scale from [d0, d1] to [r0, r1]. */
export function scale(d0, d1, r0, r1) {
  const span = d1 - d0 || 1;
  return (v) => r0 + ((v - d0) / span) * (r1 - r0);
}

/** Runs of consecutive numbers: null or undefined values are gaps (days without collected data), never zero. */
export function runs(values) {
  const out = [];
  let cur = [];
  values.forEach((v, i) => {
    if (v === null || v === undefined || Number.isNaN(v)) { if (cur.length) out.push(cur); cur = []; } else cur.push([i, v]);
  });
  if (cur.length) out.push(cur);
  return out;
}

/** SVG path text for one run of points [[x, y], ...]; a single point becomes a tiny horizontal tick so it stays visible. */
export function pathOf(points) {
  if (!points.length) return '';
  if (points.length === 1) { const [x, y] = points[0]; return `M${x.toFixed(2)},${y.toFixed(2)}h0.01`; }
  return points.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(2)},${y.toFixed(2)}`).join('');
}

export function areaPathOf(points, baseY) {
  if (points.length < 2) return '';
  const first = points[0]; const last = points[points.length - 1];
  return `${pathOf(points)}L${last[0].toFixed(2)},${baseY.toFixed(2)}L${first[0].toFixed(2)},${baseY.toFixed(2)}Z`;
}

/** Which of n labels to print so that none overlap: every k-th one, always keeping the last when it fits. */
export function labelIndexes(n, width, labelWidth) {
  if (n <= 0) return [];
  const slot = n > 1 ? width / (n - 1) : width;
  const step = Math.max(1, Math.ceil((labelWidth + 12) / Math.max(slot, 1)));
  const idx = [];
  for (let i = 0; i < n; i += step) idx.push(i);
  if (idx[idx.length - 1] !== n - 1) {
    if (idx.length && (n - 1 - idx[idx.length - 1]) * slot < labelWidth + 12) idx.pop();
    idx.push(n - 1);
  }
  return idx;
}

/** 12 · 1,234 · 12.3k · 4.5M (locale aware separators for the small numbers). */
export function formatNumber(v, locale = 'en') {
  if (v === null || v === undefined || Number.isNaN(v)) return '-';
  const a = Math.abs(v);
  const nf = (x, o) => new Intl.NumberFormat(locale, o).format(x);
  if (a >= 1e6) return `${nf(v / 1e6, { maximumFractionDigits: 1 })}M`;
  if (a >= 1e4) return `${nf(v / 1e3, { maximumFractionDigits: 1 })}k`;
  if (Number.isInteger(v)) return nf(v);
  return nf(v, { maximumFractionDigits: a >= 1 ? 1 : 2 });
}

/** 20261005 -> "05.10" */
export function dayLabel(key) {
  const k = Number(key);
  return `${String(k % 100).padStart(2, '0')}.${String(Math.floor(k / 100) % 100).padStart(2, '0')}`;
}

/** Index of the data point nearest to a pointer x inside [x0, x1], for n points. */
export function nearestIndex(x, x0, x1, n) {
  if (n <= 1) return 0;
  return clamp(Math.round(((x - x0) / (x1 - x0 || 1)) * (n - 1)), 0, n - 1);
}

/** Heat colour mix: 0 gives the panel colour, 1 the accent (both [r, g, b]). Values are eased so small numbers stay visible. */
export function heatMix(v, peak, from = [38, 40, 50], to = [232, 138, 78]) {
  if (!(v > 0) || !(peak > 0)) return from;
  const t = (v / peak) ** 0.6;
  return from.map((c, i) => Math.round(c + (to[i] - c) * t));
}

/** Score band colour, same thresholds as the bot. */
export function scoreColor(score) {
  if (score === null || score === undefined) return '#6b7280';
  return score >= 80 ? '#34d399' : score >= 60 ? '#2dd4bf' : score >= 40 ? '#fbbf24' : '#f87171';
}

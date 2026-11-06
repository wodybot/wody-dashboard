// XP curve. Same functions and the same vectors as wody_battlepass/curve.py.
import { LIMITS } from './constants.js';

const toInt = (v, d) => { const n = Math.trunc(Number(v)); return Number.isFinite(n) ? n : d; };

export function resolveCosts(curve, count, overrides = {}) {
  const kind = curve?.type || 'fixed';
  let costs;
  if (kind === 'custom') {
    const raw = (curve.costs || []).map((x) => toInt(x, 0));
    const fill = raw.length ? raw[raw.length - 1] : 100;
    costs = [...raw, ...Array(Math.max(0, count)).fill(fill)].slice(0, count);
  } else if (kind === 'progressive') {
    const base = toInt(curve.base ?? 100, 100); const step = toInt(curve.step ?? 25, 25);
    costs = Array.from({ length: count }, (_, i) => base + step * i);
  } else {
    const base = toInt(curve?.base ?? 100, 100);
    costs = Array(count).fill(base);
  }
  for (const [level, xp] of Object.entries(overrides || {})) {
    const n = toInt(level, 0);
    if (n >= 1 && n <= count) costs[n - 1] = toInt(xp, 0);
  }
  return costs;
}

export function thresholds(costs) {
  let total = 0;
  return costs.map((c) => { total += toInt(c, 0); return total; });
}

/** [level, xp inside the level, xp still needed (null at the last level)] */
export function levelForXp(thr, xp) {
  const x = Math.max(0, toInt(xp, 0));
  let level = 0;
  while (level < thr.length && thr[level] <= x) level += 1;      // bisect_right
  const start = level > 0 ? thr[level - 1] : 0;
  if (level >= thr.length) return [thr.length, x - start, null];
  return [level, x - start, thr[level] - x];
}

/** [[field, code], ...] */
export function validateCosts(costs, { seasonXpCap = null } = {}) {
  if (!costs || !costs.length) return [['levels', 'required']];
  const errors = [];
  if (costs.length > LIMITS.MAX_LEVELS) errors.push(['levels', 'too_many']);
  let total = 0;
  costs.forEach((c, i) => {
    if (typeof c !== 'number' || !Number.isInteger(c) || c < 1) errors.push([`levels.${i + 1}.xp`, 'invalid_xp']);
    else if (c > LIMITS.MAX_LEVEL_XP) { errors.push([`levels.${i + 1}.xp`, 'xp_too_high', { max: LIMITS.MAX_LEVEL_XP }]); total += c; }
    else total += c;
  });
  if (total > LIMITS.MAX_TOTAL_XP) errors.push(['levels', 'total_too_high', { max: LIMITS.MAX_TOTAL_XP }]);
  else if (seasonXpCap && seasonXpCap > 0 && total > seasonXpCap) errors.push(['levels', 'unreachable', { total, cap: seasonXpCap }]);
  return errors;
}

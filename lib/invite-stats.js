export const STAT_RANGES = [7, 14, 30, 90];
const QUICK_LEAVE_MS = 24 * 3600 * 1000;
const AGE_BUCKETS = [['lt1d', 1], ['lt7d', 7], ['lt30d', 30], ['lt1y', 365]];
const dayKey = (d) => d.toISOString().slice(0, 10);

export function statWindow(days, now = new Date()) {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const start = new Date(today - (days - 1) * 86400000);
  const end = new Date(today + 86400000);
  return { start, end, dayList: Array.from({ length: days }, (_, i) => dayKey(new Date(start.getTime() + i * 86400000))) };
}

export function buildStatistics(docs, days, now = new Date()) {
  const { start, end, dayList } = statWindow(days, now);
  const index = new Map(dayList.map((d, i) => [d, i]));
  const joins = Array(days).fill(0);
  const leaves = Array(days).fill(0);
  const weekdays = Array(7).fill(0);
  const hours = Array(24).fill(0);
  const inviters = new Map();
  const codes = new Map();
  const sources = new Map();
  const ages = new Map();
  let fake = 0; let quick = 0; let stillHere = 0; let totalJoined = 0;
  const inWindow = (d) => d && d >= start && d < end;
  for (const d of docs) {
    const joined = d.joined_at ? new Date(d.joined_at) : null;
    const leftAt = d.left && d.left_at ? new Date(d.left_at) : null;
    if (inWindow(leftAt)) leaves[index.get(dayKey(leftAt))] += 1;
    if (!inWindow(joined)) continue;
    totalJoined += 1;
    joins[index.get(dayKey(joined))] += 1;
    weekdays[(joined.getUTCDay() + 6) % 7] += 1;
    hours[joined.getUTCHours()] += 1;
    const isFake = Boolean(d.fake);
    if (isFake) fake += 1;
    if (d.left) { if (leftAt && leftAt - joined <= QUICK_LEAVE_MS) quick += 1; } else stillHere += 1;
    if (d.inviter_id && d.counted && !isFake) inviters.set(String(d.inviter_id), (inviters.get(String(d.inviter_id)) || 0) + 1);
    if (d.code && d.inviter_id) codes.set(d.code, (codes.get(d.code) || 0) + 1);
    const src = d.source === 'vanity' ? 'vanity' : d.inviter_id ? 'invite' : 'unknown';
    sources.set(src, (sources.get(src) || 0) + 1);
    if (d.account_created_at) {
      const age = (joined - new Date(d.account_created_at)) / 86400000;
      const bucket = (AGE_BUCKETS.find(([, limit]) => age < limit) || ['older'])[0];
      ages.set(bucket, (ages.get(bucket) || 0) + 1);
    }
  }
  const top = (m) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  const netDaily = joins.map((j, i) => j - leaves[i]);
  let run = 0;
  const cumulative = netDaily.map((v) => (run += v));
  const totalLeft = leaves.reduce((a, b) => a + b, 0);
  let bestDay = null;
  if (totalJoined) bestDay = joins.reduce((best, v, i) => (v > joins[best] ? i : best), 0);
  return {
    days, day_list: dayList, joins, leaves, net_daily: netDaily, net_cumulative: cumulative, weekdays, hours,
    inviters: top(inviters), codes: top(codes), sources: ['invite', 'vanity', 'unknown'].filter((k) => sources.get(k)).map((k) => [k, sources.get(k)]),
    ages: ['lt1d', 'lt7d', 'lt30d', 'lt1y', 'older'].filter((k) => ages.get(k)).map((k) => [k, ages.get(k)]),
    totals: {
      joins: totalJoined, leaves: totalLeft, net: totalJoined - totalLeft, fake, quick_leavers: quick, still_here: stillHere,
      retention: totalJoined ? Math.round((100 * stillHere) / totalJoined) : null, best_day: bestDay, avg_per_day: Math.round((totalJoined / days) * 10) / 10,
    },
  };
}

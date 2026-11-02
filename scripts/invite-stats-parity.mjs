// Checks lib/invite-stats.js against the numbers the bot's invites/stats.py computed for the same joins.
// Run:  node scripts/invite-stats-parity.mjs
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = resolve(new URL('..', import.meta.url).pathname);
const dir = mkdtempSync(join(tmpdir(), 'stats-parity-'));
writeFileSync(join(dir, 'invite-stats.mjs'), readFileSync(join(root, 'lib/invite-stats.js'), 'utf8'));
const { buildStatistics } = await import(pathToFileURL(join(dir, 'invite-stats.mjs')).href);
const fx = JSON.parse(readFileSync(join(root, 'scripts/invite-stats-parity.json'), 'utf8'));
const now = new Date(fx.now);
let bad = 0;
for (const c of fx.cases) {
  const got = buildStatistics(fx.docs, c.days, now);
  const e = c.expect;
  const norm = (o) => JSON.parse(JSON.stringify(o, (k, v) => (typeof v === 'number' && !Number.isInteger(v) ? Math.round(v * 10) / 10 : v)));
  const pairs = (rows) => rows.map(([k, n]) => [String(k), n]);
  // Python breaks ties by first appearance and JS by insertion order (the same), so lists are compared as they are.
  const checks = {
    joins: [got.joins, e.joins], leaves: [got.leaves, e.leaves], net_daily: [got.net_daily, e.net_daily], net_cumulative: [got.net_cumulative, e.net_cumulative],
    weekdays: [got.weekdays, e.weekdays], hours: [got.hours, e.hours], day_list: [got.day_list, e.day_list], totals: [norm(got.totals), norm(e.totals)],
    inviters: [pairs(got.inviters), pairs(e.inviters)], codes: [pairs(got.codes), pairs(e.codes)], sources: [pairs(got.sources), pairs(e.sources)], ages: [pairs(got.ages), pairs(e.ages)],
  };
  for (const [k, [a, b]] of Object.entries(checks)) if (JSON.stringify(a) !== JSON.stringify(b)) { bad += 1; console.log(`MISMATCH ${c.days}d ${k}\n  js    ${JSON.stringify(a)}\n  python${JSON.stringify(b)}`); }
}
console.log(bad ? `${bad} mismatches` : `all ${fx.cases.length} ranges agree`);
process.exit(bad ? 1 : 0);

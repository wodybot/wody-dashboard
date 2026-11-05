import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { CLASSES, ACCESS, THRESHOLD_KEYS } from '../../lib/statistics/constants.js';

const root = path.resolve(import.meta.dirname, '../..');
const LANGS = ['en', 'ro', 'fr', 'it', 'de', 'es', 'nl', 'pt', 'tr'];
const load = (l, ns = 'statistics') => JSON.parse(fs.readFileSync(path.join(root, 'messages', `${l}.json`), 'utf8'))[ns];
const flat = (o, p = '', out = {}) => {
  for (const [k, v] of Object.entries(o)) (v && typeof v === 'object' ? flat(v, `${p}${k}.`, out) : (out[`${p}${k}`] = v));
  return out;
};
const params = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
const en = flat(load('en'));

test('every locale has exactly the English statistics keys with the same placeholders', () => {
  for (const l of LANGS) {
    const m = flat(load(l));
    assert.deepEqual(Object.keys(m).sort(), Object.keys(en).sort(), `${l} key set`);
    for (const k of Object.keys(en)) {
      assert.equal(typeof m[k], 'string', `${l} ${k}`);
      assert.ok(m[k].trim().length > 0, `${l} ${k} is empty`);
      assert.equal(params(m[k]), params(en[k]), `${l} ${k} placeholders`);
      assert.ok(!/[—–­]/.test(m[k]), `${l} ${k} has a dash or soft hyphen`);
      assert.ok(!m[k].includes("'"), `${l} ${k} has a straight apostrophe`);
      assert.ok(!/\{wy:|\*\*/.test(m[k]), `${l} ${k} has bot markup`);
    }
  }
});

test('every message the panel asks for exists', () => {
  const src = fs.readFileSync(path.join(root, 'components/statistics/StatisticsPanel.jsx'), 'utf8');
  const need = new Set();
  for (const m of src.matchAll(/\bt\('([A-Za-z0-9_.]+)'/g)) need.add(m[1]);
  const expand = (prefix, list, suffix = '') => list.forEach((x) => need.add(`${prefix}${x}${suffix}`));
  expand('class.', CLASSES);
  expand('settings.accessOptions.', ACCESS);
  expand('tab.', ['overview', 'channels', 'health', 'history', 'reports', 'settings']);
  expand('weekday.', [0, 1, 2, 3, 4, 5, 6]);
  expand('band.', ['attention', 'developing', 'healthy', 'thriving']);
  expand('factor.', ['growth', 'participation', 'stability', 'distribution', 'vitality']);
  expand('health.explain.', ['growth', 'participation', 'stability', 'distribution', 'vitality']);
  expand('channels.sort.', ['messages', 'change', 'participants', 'rate']);
  expand('reason.score_', ['few_days', 'few_factors']);
  expand('reports.pages.', ['overview', 'channels', 'health', 'activity', 'notes'], '.title');
  expand('reports.pages.', ['overview', 'channels', 'health', 'activity', 'notes'], '.text');
  for (const k of ['activity.up', 'activity.down', 'participation.up', 'participation.down', 'members.up', 'members.down', 'peak_hours.concentrated', 'concentration.high']) need.add(`trend.${k}`);
  for (const k of ['quiet_channels', 'concentrated', 'channel_surge', 'channel_decline', 'few_voices', 'low_participation', 'more_leaves', 'peak_hours']) need.add(`rec.${k}`);
  for (const k of ['generic', 'unauthenticated', 'forbidden', 'guild_unavailable', 'bot_unreachable', 'rate_limited', 'invalid_period', 'invalid_range', 'invalid_channels', 'invalid_body', 'invalid', 'invalid_id', 'confirm_required', 'confirm', 'validation_failed', 'failed', 'internal_error', 'account_blocked', 'guild_banned', 'temporarily_unavailable', 'forbidden_origin', 'unreachable', 'not_found', 'method_not_allowed']) need.add(`api.${k}`);
  for (const k of ['thresholds_order', 'invalid', 'invalid_choice', 'invalid_id', 'invalid_number', 'out_of_range', 'too_many', 'unknown_field']) need.add(`err.${k}`);
  THRESHOLD_KEYS.forEach((k) => need.add(`class.${k}`));
  const missing = [...need].filter((k) => typeof en[k] !== 'string');
  assert.deepEqual(missing, []);
});

test('the dashboard module is registered', () => {
  const src = fs.readFileSync(path.join(root, 'app/[locale]/dashboard/[guildId]/GuildDashboardClient.jsx'), 'utf8');
  assert.match(src, /key: 'statistics'/);
  assert.match(src, /case 'statistics'/);
  assert.match(src, /NON_TOGGLEABLE_KEYS = new Set\([^)]*'statistics'/);
});

test('the help page namespace is complete in every language', () => {
  const h = flat(load('en', 'statisticsHelp'));
  for (const k of ['seo.title', 'seo.description', 'seo.breadcrumb', 'title', 'intro', 'summaryTitle', 'summary', 'back']) assert.equal(typeof h[k], 'string', k);
  for (const k of ['what', 'start', 'privacy', 'participants', 'score', 'classes', 'retention', 'access', 'accuracy']) { assert.equal(typeof h[`faq.${k}.q`], 'string', k); assert.equal(typeof h[`faq.${k}.a`], 'string', k); }
  for (const l of LANGS) {
    const m = flat(load(l, 'statisticsHelp'));
    assert.deepEqual(Object.keys(m).sort(), Object.keys(h).sort(), `${l} key set`);
    for (const [k, v] of Object.entries(m)) {
      assert.ok(v.trim().length > 0, `${l} ${k}`);
      assert.ok(!/[\u2014\u2013\u00ad]/.test(v), `${l} ${k} dash`);
      assert.ok(!v.includes("'"), `${l} ${k} apostrophe`);
    }
    assert.ok(m['seo.title'].length <= 110, `${l} title length`);
    assert.ok(m['seo.description'].length <= 320, `${l} description length`);
  }
});

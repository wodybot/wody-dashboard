import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { MODES, POWERUPS, RARITIES, DEF_KINDS, ACHIEVEMENT_METRICS, CHALLENGE_TYPES, COMPETITION_MODES } from '../../lib/counting/constants.js';
import { SECTIONS, GOAL_TYPES, GOAL_UNITS, MESSAGE_KEYS, STRIKE_ACTIONS, EVENT_KEYS, FAIL_ACTIONS, LANGS } from '../../lib/counting/schema.js';

const root = path.resolve(import.meta.dirname, '../..');
const load = (l) => JSON.parse(fs.readFileSync(path.join(root, 'messages', `${l}.json`), 'utf8')).counting;
const flat = (o, p = '', out = {}) => {
  for (const [k, v] of Object.entries(o)) (v && typeof v === 'object' ? flat(v, `${p}${k}.`, out) : (out[`${p}${k}`] = v));
  return out;
};
const params = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
const en = flat(load('en'));

test('every locale has exactly the English counting keys with the same placeholders', () => {
  for (const l of LANGS) {
    const m = flat(load(l));
    assert.deepEqual(Object.keys(m).sort(), Object.keys(en).sort(), `${l} key set`);
    for (const k of Object.keys(en)) {
      assert.equal(typeof m[k], 'string', `${l} ${k}`);
      assert.ok(m[k].trim().length > 0, `${l} ${k} is empty`);
      assert.equal(params(m[k]), params(en[k]), `${l} ${k} placeholders`);
      assert.ok(!/[—–­]/.test(m[k]), `${l} ${k} has a dash or soft hyphen`);
      assert.ok(!m[k].includes("'"), `${l} ${k} has a straight apostrophe`);
    }
  }
});

test('every setting, enum and tab the panels draw has a message', () => {
  const need = [];
  MODES.forEach((x) => need.push(`mode.${x}`));
  POWERUPS.forEach((x) => need.push(`powerup.${x}`));
  RARITIES.forEach((x) => need.push(`rarity.${x}`));
  DEF_KINDS.forEach((x) => need.push(`admin.defs.kind.${x}`));
  ACHIEVEMENT_METRICS.forEach((x) => need.push(`admin.defs.metric.${x}`));
  CHALLENGE_TYPES.forEach((x) => need.push(`admin.defs.challengeType.${x}`));
  COMPETITION_MODES.forEach((x) => need.push(`competitionMode.${x}`));
  GOAL_TYPES.forEach((x) => need.push(`goalType.${x}`));
  GOAL_UNITS.forEach((x) => need.push(`goalUnit.${x}`));
  MESSAGE_KEYS.forEach((x) => need.push(`messageKey.${x}`));
  STRIKE_ACTIONS.forEach((x) => need.push(`strike.${x}`));
  EVENT_KEYS.forEach((x) => need.push(`cfg.notify.events.${x}`));
  FAIL_ACTIONS.forEach((x) => need.push(`cfgOptions.value.${x}`));
  for (const sec of SECTIONS) {
    need.push(`sections.${sec.id}`);
    for (const f of sec.fields) if (!(sec.id === 'notify' && f.key === 'channel_id')) need.push(`cfg.${sec.id}.${f.key}`);
  }
  const missing = need.filter((k) => typeof en[k] !== 'string');
  assert.deepEqual(missing, []);
});

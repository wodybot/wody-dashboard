// Wody Battle Pass dashboard unit tests. They run the same JSON vectors as the bot (tests/test_battlepass.py).
// Run: npm run test:battlepass
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const vec = (n) => JSON.parse(readFileSync(join(here, 'vectors', `battlepass_${n}.json`), 'utf8'));
const C = await import('../../lib/battlepass/constants.js');
const curve = await import('../../lib/battlepass/curve.js');
const prio = await import('../../lib/battlepass/priority.js');
const rw = await import('../../lib/battlepass/rewards.js');

test('curve vectors', () => {
  for (const c of vec('curve').curves) {
    const costs = curve.resolveCosts(c.curve, c.count, c.overrides);
    assert.deepEqual(costs, c.costs, c.name);
    assert.deepEqual(curve.thresholds(costs), c.thr, c.name);
  }
});
test('level vectors', () => {
  for (const c of vec('curve').levels) assert.deepEqual(curve.levelForXp(c.thr, c.xp), [c.level, c.into, c.need], `xp ${c.xp}`);
});
test('curve validation refuses impossible passes', () => {
  assert.deepEqual(curve.validateCosts([100, 100]), []);
  assert.deepEqual(curve.validateCosts([100, 0]), [['levels.2.xp', 'invalid_xp']]);
  assert.deepEqual(curve.validateCosts([C.LIMITS.MAX_LEVEL_XP + 1]), [['levels.1.xp', 'xp_too_high']]);
  assert.deepEqual(curve.validateCosts([1000, 1000], { seasonXpCap: 1500 }), [['levels', 'unreachable']]);
  assert.deepEqual(curve.validateCosts([1000, 1000], { seasonXpCap: 2000 }), []);
  assert.deepEqual(curve.validateCosts([]), [['levels', 'required']]);
  assert.deepEqual(curve.validateCosts([1.5]), [['levels.1.xp', 'invalid_xp']]);
});

const withId = (s) => ({ ...s, _id: s.id });
test('priority: resolve vectors', () => {
  const v = vec('priority'); const now = new Date(v.now);
  for (const c of v.resolve) {
    const [season, reason] = prio.resolveForGuild(c.seasons.map(withId), c.guild_id, c.premium, now);
    assert.equal(season ? season.id : null, c.expect, c.name);
    assert.equal(reason, c.reason, c.name);
  }
});
test('priority: activation vectors', () => {
  const v = vec('priority'); const now = new Date(v.now);
  for (const c of v.activation) {
    const [ok, reason] = prio.activationCheck(withId(c.candidate), c.others.map(withId), { premium: c.premium, ownerOk: c.owner_ok, now });
    assert.deepEqual([ok, reason], [c.ok, c.reason], c.name);
  }
});
test('priority: dates are applied without a timer', () => {
  const now = new Date('2026-11-05T12:00:00Z');
  assert.equal(prio.effectiveStatus({ status: 'scheduled', starts_at: '2026-11-05T11:00:00Z' }, now), C.ACTIVE);
  assert.equal(prio.effectiveStatus({ status: 'active', starts_at: '2026-12-01T00:00:00Z' }, now), C.SCHEDULED);
  assert.equal(prio.effectiveStatus({ status: 'active', ends_at: '2026-11-05T12:00:00Z' }, now), C.COMPLETED);
  assert.equal(prio.effectiveStatus({ status: 'paused', ends_at: '2020-01-01T00:00:00Z' }, now), C.PAUSED);
});
test('priority: a Global season suspends running server seasons', () => {
  const now = new Date('2026-11-05T12:00:00Z');
  const list = [{ _id: 'a', scope: 'guild', guild_id: '1', status: 'active' }, { _id: 'b', scope: 'guild', guild_id: '2', status: 'paused' }];
  assert.deepEqual(prio.seasonsToSuspendOnGlobalStart(list, now).map((s) => s._id), ['a']);
});

test('reward vectors', () => {
  const v = vec('rewards'); const now = new Date(v.now);
  for (const c of v.rewards) {
    const protection = { ...C.DEFAULT_PROTECTION, ...(c.protection || {}) };
    const args = { seasonStatus: c.status, level: c.level, xp: c.xp, claimed: c.claimed, protection, now };
    if (c.reward) assert.equal(rw.rewardState(c.reward, args), c.state, c.name);
    assert.deepEqual(rw.claimDecision(c.reward, args), c.claim, c.name);
  }
});
test('quest windows and collections', () => {
  assert.equal(rw.periodKey('day', new Date('2026-11-05T23:59:00Z')), '20261105');
  assert.equal(rw.periodKey('week', new Date('2026-11-05T12:00:00Z')), '2026W45');
  assert.equal(rw.periodKey('week', new Date('2027-01-01T12:00:00Z')), '2026W53');
  assert.equal(rw.periodKey('season', new Date()), 'season');
  assert.deepEqual(rw.collectionProgress({ reward_ids: ['a', 'b', 'c'] }, new Set(['a', 'c'])), [2, 3]);
});

// ---- season validation
const { cleanSeason, totalXp } = await import('../../lib/battlepass/validate.js');
const theme = await import('../../lib/battlepass/page-theme.js');
const baseSeason = () => ({
  name: 'Autumn Pass', level_count: 5, curve: { type: 'fixed', base: 100 },
  rewards: [
    { id: 'r1', name: 'First badge', type: 'badge', level: 1 },
    { id: 'r2', name: 'Frame', type: 'frame', level: 3, rarity: 'rare', claim_mode: 'auto_claim' },
    { id: 'done', name: 'Complete', type: 'badge', level: 5 },
  ],
  quests: [{ id: 'q1', name: 'Chat', metric: 'messages', target: 10, xp_reward: 20, reward_id: 'r1' }],
  achievements: [{ id: 'a1', name: 'Climber', conditions: [{ metric: 'level', target: 3 }], reward_id: 'r2' }],
  collections: [{ id: 'c1', name: 'Set', reward_ids: ['r1', 'r2'], completion_reward_id: 'done' }],
});
const codes = (r) => r.errors.map((e) => `${e.field}:${e.code}`);

test('season: a complete valid season is accepted and stored as levels', () => {
  const r = cleanSeason(baseSeason(), { scope: 'global' });
  assert.deepEqual(r.errors, []);
  assert.equal(r.doc.levels.length, 5);
  assert.equal(totalXp(r.doc), 500);
  assert.equal(r.doc.scope, 'global');
  assert.equal(r.doc.status, undefined);                 // status is never taken from the input
  assert.equal(r.doc.rewards[1].claim_mode, 'auto_claim');
});
test('season: scope and status in the request are ignored', () => {
  const r = cleanSeason({ ...baseSeason(), scope: 'global', status: 'active', guild_id: '1' }, { scope: 'guild' });
  assert.equal(r.doc.scope, 'guild');
  assert.equal(r.doc.status, undefined);
  assert.equal(r.doc.guild_id, undefined);
});
test('season: server seasons cannot exceed the Premium ceilings, global seasons can go higher', () => {
  const input = { ...baseSeason(), xp: { multiplier: 3, message: { xp: 80, cooldown_seconds: 10 } } };
  const guild = cleanSeason(input, { scope: 'guild' });
  assert.ok(codes(guild).includes('xp.multiplier:out_of_range'));
  assert.ok(codes(guild).includes('xp.message.xp:out_of_range'));
  assert.ok(codes(guild).includes('xp.message.cooldown_seconds:out_of_range'));
  const global = cleanSeason({ ...input, xp: { multiplier: 3, message: { xp: 80, cooldown_seconds: 10 } } }, { scope: 'global' });
  assert.deepEqual(global.errors, []);
});
test('season: protections cannot be switched off in a server season', () => {
  const r = cleanSeason({ ...baseSeason(), xp: { message: { duplicate_protection: false, spam_protection: false }, voice: { exclude_afk: false, allow_alone: true } } }, { scope: 'guild' });
  assert.equal(r.doc.xp.message.duplicate_protection, true);
  assert.equal(r.doc.xp.message.spam_protection, true);
  assert.equal(r.doc.xp.voice.exclude_afk, true);
  assert.equal(r.doc.xp.voice.allow_alone, false);
});
test('season: impossible curves and broken references are refused', () => {
  const tooBig = cleanSeason({ ...baseSeason(), curve: { type: 'fixed', base: 100000 }, level_count: 100 }, { scope: 'guild' });
  assert.ok(codes(tooBig).includes('levels:unreachable'));
  const refs = cleanSeason({ ...baseSeason(), quests: [{ id: 'q', name: 'x', metric: 'messages', target: 1, reward_id: 'nope' }] }, { scope: 'global' });
  assert.ok(codes(refs).includes('quests.1.reward_id:unknown_reward'));
  const dup = cleanSeason({ ...baseSeason(), rewards: [{ id: 'a', name: 'x' }, { id: 'a', name: 'y' }] }, { scope: 'global' });
  assert.ok(codes(dup).includes('rewards.2.id:duplicate'));
  const inside = cleanSeason({ ...baseSeason(), collections: [{ id: 'c', name: 'c', reward_ids: ['r1'], completion_reward_id: 'r1' }] }, { scope: 'global' });
  assert.ok(codes(inside).includes('collections.1.completion_reward_id:inside_collection'));
  const metric = cleanSeason({ ...baseSeason(), quests: [{ id: 'q', name: 'x', metric: 'eval', target: 1 }] }, { scope: 'global' });
  assert.ok(codes(metric).includes('quests.1.metric:invalid_choice'));
  const dates = cleanSeason({ ...baseSeason(), starts_at: '2026-12-01T00:00:00Z', ends_at: '2026-11-01T00:00:00Z' }, { scope: 'global' });
  assert.ok(codes(dates).includes('ends_at:before_start'));
});
test('season: names are required and text is cleaned', () => {
  assert.ok(codes(cleanSeason({ ...baseSeason(), name: '   ' }, { scope: 'global' })).includes('name:required'));
  const r = cleanSeason({ ...baseSeason(), rewards: [{ id: 'r1', name: '<b>Hi</b>\u0000', level: 1 }] }, { scope: 'global' });
  assert.ok(!/[<>\u0000]/.test(r.doc.rewards[0].name));
});
test('season: translations are limited to supported languages', () => {
  const r = cleanSeason({ ...baseSeason(), i18n: { ro: { name: 'Sezonul toamnei' }, xx: { name: 'x' } } }, { scope: 'global' });
  assert.deepEqual(codes(r), ['i18n.xx:invalid_choice']);
  assert.equal(cleanSeason({ ...baseSeason(), i18n: { ro: { name: 'Sezonul toamnei' } } }, { scope: 'global' }).doc.i18n.ro.name, 'Sezonul toamnei');
});

// ---- page theme
test('theme: every option is checked and unknown fields are refused', () => {
  assert.deepEqual(theme.validateThemePatch({ particles: 'snow', glow: 50, accent: '#FFAA00', sound_pack: 'arcade', volume: 30 }), { particles: 'snow', glow: 50, accent: '#ffaa00', sound_pack: 'arcade', volume: 30 });
  for (const bad of [{ particles: 'lava' }, { glow: 101 }, { accent: 'red' }, { volume: 1.5 }, { css: 'body{}' }, { script: 'x' }, { ambient: 'http://x.com/a.mp3' }, { image: 'javascript:alert(1)' }, { hide: ['nope'] }, { order: ['hero', 'hero'] }]) {
    assert.throws(() => theme.validateThemePatch(bad), undefined, JSON.stringify(bad));
  }
});
test('theme: a stored invalid value falls back to the default', () => {
  const t = theme.normalizeTheme({ particles: 'lava', accent: '#123456', hide: ['quests'] });
  assert.equal(t.particles, theme.THEME_DEFAULT.particles);
  assert.equal(t.accent, '#123456');
  assert.deepEqual(t.hide, ['quests']);
  assert.equal(t.order.length, theme.THEME_SECTIONS.length);
});
test('theme: presets bring their own colors', () => {
  assert.equal(theme.themeColors({ mode: 'preset', preset: 'gold' }).accent, '#facc15');
  assert.equal(theme.themeColors({ mode: 'solid', from: '#111111', to: '#222222', accent: '#abcdef', accent2: '#fedcba' }).to, '#111111');
});

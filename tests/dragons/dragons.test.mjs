// Dragons: validation, the stats formula, the API (who may save, what is kept) and the texts in 9 languages.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const { state } = await import('../battlepass/stubs/state.mjs');
const { makeDb } = await import('../battlepass/fake-db.mjs');
const { handle } = await import('../../lib/dragons/api.js');
const { defaultDragon, normalizeDragon, normalizeDragons, dragonStats } = await import('../../lib/dragons/schema.js');
const K = await import('../../lib/dragons/constants.js');
const { hasPictograph } = await import('../../lib/no-emoji.js');

const MANAGER = '2000000000000000001'; const MEMBER = '3000000000000000001'; const G1 = '4000000000000000001'; const G2 = '4000000000000000002';
function fresh() { state.db = makeDb(); state.session = null; state.blocked = new Set(); state.guilds = [{ id: G1, owner: false, permissions: '32' }, { id: G2, owner: false, permissions: '0' }]; }
async function call(method, path, { body, user } = {}) {
  state.session = user ? { user: { id: user }, accessToken: 'token' } : null;
  const request = new Request(`https://wody.test/api/dragons/${path}`, { method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const res = await handle({ request, db: state.db, parts: path.split('/'), method });
  return { status: res.status, body: await res.json() };
}

test('a dragon is validated: fixed choices, colors, bounded numbers and plain names', () => {
  const ok = normalizeDragon({ id: 'eduardor', name: '  Eduardor  ', type: 'fire', level: 50, rarity: 'legendary', size: 'huge', personality: 'aggressive', scale_color: '#8B1E1E', fire_color: '#FF6A00' });
  assert.equal(ok.ok, true); assert.equal(ok.dragon.name, 'Eduardor'); assert.equal(ok.dragon.scale_color, '#8b1e1e');
  for (const [patch, field] of [[{ type: 'plasma' }, 'type'], [{ scale_color: 'red' }, 'scale_color'], [{ level: 0 }, 'level'], [{ level: 101 }, 'level'], [{ name: 'x'.repeat(33) }, 'name'], [{ name: 'see https://evil.example' }, 'name'], [{ id: 'Bad Id' }, 'id'], [{ behavior: { breath_seconds: 1 } }, 'behavior.breath_seconds']]) {
    const r = normalizeDragon({ ...defaultDragon('fire', 'd1'), ...patch }); assert.equal(r.ok, false, field); assert.equal(r.field, field);
  }
  assert.equal(normalizeDragon({ id: 'a', name: '<b>Hi</b>' }).dragon.name, 'bHi/b', 'markup characters are removed');
  assert.equal(normalizeDragons(Array.from({ length: K.MAX_DRAGONS + 1 }, (_, i) => ({ id: `d${i}` }))).error, 'too_many');
  assert.equal(normalizeDragons([{ id: 'a' }, { id: 'a' }]).error, 'duplicate_id');
});

test('stats follow level, rarity, size and personality (same formula as the bot)', () => {
  const s = dragonStats({ level: 50, rarity: 'legendary', size: 'huge', personality: 'aggressive' });
  assert.deepEqual(s, { attack: 18343, defense: 13703, life: 56550 });
  const low = dragonStats({ level: 1, rarity: 'common', size: 'small', personality: 'playful' });
  assert.ok(low.attack < s.attack && low.defense < s.defense && low.life < s.life);
  assert.equal(dragonStats({ level: 10, rarity: 'rare', size: 'large', personality: 'protective' }).defense > dragonStats({ level: 10, rarity: 'rare', size: 'large', personality: 'calm' }).defense, true);
});

test('API: only managers of that server save; the stored copy is the validated one', async () => {
  fresh();
  assert.equal((await call('GET', `guilds/${G1}`)).status, 401);
  assert.equal((await call('GET', `guilds/${G2}`, { user: MEMBER })).status, 403, 'no manage permission');
  const get = await call('GET', `guilds/${G1}`, { user: MANAGER }); assert.deepEqual(get.body.dragons, []);
  const bad = await call('PUT', `guilds/${G1}`, { user: MANAGER, body: { dragons: [{ id: 'a', type: 'plasma' }] } }); assert.equal(bad.status, 400); assert.equal(bad.body.field, 'type');
  const put = await call('PUT', `guilds/${G1}`, { user: MANAGER, body: { dragons: [{ id: 'eduardor', name: 'Eduardor', type: 'fire', level: 50, rarity: 'legendary', evil: 'x' }] } });
  assert.equal(put.status, 200); assert.equal(put.body.dragons[0].evil, undefined); assert.equal(put.body.dragons[0].size, 'large');
  const again = await call('GET', `guilds/${G1}`, { user: MANAGER }); assert.equal(again.body.dragons[0].name, 'Eduardor'); assert.equal(again.body.dragons[0].level, 50);
  const turnOff = await call('PUT', `guilds/${G1}`, { user: MANAGER, body: { dragons: [{ id: 'eduardor', enabled: false, animations: { roar: false } }] } });
  assert.equal(turnOff.body.dragons[0].enabled, false); assert.equal(turnOff.body.dragons[0].animations.roar, false); assert.equal(turnOff.body.dragons[0].name, 'Eduardor', 'unspecified fields keep their saved value');
  const empty = await call('PUT', `guilds/${G1}`, { user: MANAGER, body: { dragons: [] } }); assert.deepEqual(empty.body.dragons, []);
});

test('texts: every key the page uses exists in all 9 languages, clean of emoji and long dashes, with the right apostrophe', () => {
  const need = ['title', 'add', 'remove', 'customize', 'preview', 'levelN', 'progressHint', 'emptyTitle', 'emptyText', 'stageLabel'];
  const lists = { tabs: ['animations', 'behavior', 'effects', 'sounds', 'progress'], types: K.TYPES, sizes: K.SIZES, personalities: K.PERSONALITIES, personalityText: K.PERSONALITIES, rarities: K.RARITIES, animations: K.ANIMATIONS, behaviors: K.BEHAVIORS, effects: K.EFFECTS, sounds: ['enabled', 'volume', ...K.SOUNDS], stats: ['attack', 'defense', 'life'] };
  for (const loc of ['en', 'ro', 'fr', 'it', 'de', 'es', 'nl', 'pt', 'tr']) {
    const m = JSON.parse(readFileSync(new URL(`../../messages/${loc}.json`, import.meta.url), 'utf8')); const d = m.dragons;
    for (const k of need) assert.ok(d[k], `${loc}.${k}`);
    for (const [g, keys] of Object.entries(lists)) for (const k of keys) assert.ok(d[g]?.[k], `${loc}.${g}.${k}`);
    for (const e of ['generic', 'network', 'forbidden', 'invalid_choice', 'invalid_color', 'too_many', 'rate_limited']) assert.ok(d.errors[e], `${loc}.errors.${e}`);
    assert.ok(m.modules.dragons.title && m.modules.dragons.description, `${loc} module`);
    const text = JSON.stringify([d, m.modules.dragons]);
    assert.equal(/[\u2013\u2014]/.test(text), false, `${loc} long dash`); assert.equal(hasPictograph(text), false, `${loc} emoji`); assert.equal(/\w'\w/.test(text), false, `${loc} straight apostrophe`);
  }
});

test('the artwork layers exist for every type', () => {
  for (const type of K.TYPES) for (const part of ['wing_far', 'tail', 'body', 'head', 'jaw', 'wing_near']) assert.ok(existsSync(new URL(`../../public/themes/rig/${type}/${part}.png`, import.meta.url)), `${type}/${part}`);
});

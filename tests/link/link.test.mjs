// Wody Link dashboard unit tests. Run: node --import ./tests/link/register.mjs --test tests/link/
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const C = await import('../../lib/link/constants.js');
const cfg = await import('../../lib/link/config.js');
const perms = await import('../../lib/link/perms.js');
const owner = await import('../../lib/link/owner.js');

// ---- ownership (the only criterion is guild.owner_id)
test('ownership: only the Discord owner id counts', () => {
  assert.equal(owner.isOwnerOf({ owner_id: '111111111111111111' }, '111111111111111111'), true);
  assert.equal(owner.isOwnerOf({ owner_id: '111111111111111111' }, '222222222222222222'), false);
});
test('ownership: administrator, manage server and roles do not matter', () => {
  const guild = { owner_id: '111111111111111111', permissions: '8', roles: ['admin'] };
  assert.equal(owner.isOwnerOf(guild, '222222222222222222'), false);
});
test('ownership: missing data is never ownership', () => {
  assert.equal(owner.isOwnerOf(null, '1'), false);
  assert.equal(owner.isOwnerOf({}, '1'), false);
  assert.equal(owner.isOwnerOf({ owner_id: '1' }, ''), false);
  assert.equal(owner.isOwnerOf({ owner_id: '1' }, undefined), false);
});

// ---- ids
test('snowflake parsing rejects non ids', () => {
  assert.equal(cfg.snow('123456789012345678'), '123456789012345678');
  for (const bad of ['', 'abc', '12', '1; DROP', null, undefined, {}, ['1'], '-123456789012345678', '1.5e17']) assert.equal(cfg.snow(bad), null);
});
test('pairKey is order independent', () => {
  assert.equal(cfg.pairKey('300000000000000000', '200000000000000000'), cfg.pairKey('200000000000000000', '300000000000000000'));
});
test('parseSide reports bad ids per field', () => {
  const errors = [];
  cfg.parseSide(errors, 'a', { guild_id: 'x', channel_id: '123456789012345678' });
  assert.deepEqual(errors.map((e) => e.field), ['a.guild_id']);
});

// ---- name
test('name validation', () => {
  let errors = [];
  assert.equal(cfg.cleanName(errors, '  My   bridge ', 'x'), 'My bridge');
  assert.equal(errors.length, 0);
  errors = []; cfg.cleanName(errors, '   ', 'x'); assert.equal(errors[0].code, 'required');
  errors = []; const long = cfg.cleanName(errors, 'a'.repeat(200), 'x'); assert.equal(errors[0].code, 'too_long'); assert.equal(long.length, C.NAME_MAX);
  errors = []; assert.equal(cfg.cleanName(errors, 'a\u0000b', 'x'), 'a b');
});

// ---- translation
test('translation: off by default and validated', () => {
  assert.equal(C.DEFAULT_TRANSLATION.enabled, false);
  let errors = [];
  assert.equal(cfg.cleanTranslation(errors, undefined).enabled, false);
  errors = []; cfg.cleanTranslation(errors, { enabled: true, a_lang: 'en', b_lang: 'en' });
  assert.equal(errors[0].code, 'same_language');
  errors = []; cfg.cleanTranslation(errors, { a_lang: 'xx' }); assert.equal(errors[0].code, 'invalid_choice');
  errors = []; cfg.cleanTranslation(errors, 'nope'); assert.equal(errors[0].code, 'invalid');
  errors = []; const ok = cfg.cleanTranslation(errors, { enabled: true, a_lang: 'ro', b_lang: 'en' });
  assert.equal(errors.length, 0); assert.equal(ok.enabled, true);
});

// ---- anti-spam
test('anti-spam: bounds enforced, defaults kept', () => {
  let errors = [];
  const out = cfg.cleanAntispam(errors, { max_messages: 5 });
  assert.equal(out.max_messages, 5); assert.equal(out.window_seconds, C.DEFAULT_ANTISPAM.window_seconds); assert.equal(errors.length, 0);
  for (const [k, [lo, hi]] of Object.entries(C.ANTISPAM_BOUNDS)) {
    errors = []; cfg.cleanAntispam(errors, { [k]: lo - 1 }); assert.ok(errors.length >= 1, `${k} below`);
    errors = []; cfg.cleanAntispam(errors, { [k]: hi + 1 }); assert.ok(errors.length >= 1, `${k} above`);
    errors = []; cfg.cleanAntispam(errors, { [k]: lo }); cfg.cleanAntispam(errors, { [k]: hi }); assert.equal(errors.length, 0, `${k} edges`);
  }
  errors = []; cfg.cleanAntispam(errors, [1]); assert.equal(errors[0].code, 'invalid');
  errors = []; cfg.cleanAntispam(errors, { max_messages: 'abc' }); assert.ok(errors.length >= 1);
});

// ---- bot permission computation
const GUILD = { id: '1', owner_id: '9', roles: [
  { id: '1', permissions: String(1n << 10n) },                                   // @everyone: view only
  { id: '5', permissions: String((1n << 11n) | (1n << 16n)) },                    // send + history
] };
test('perms: eligible needs view, send and history', () => {
  const ch = { id: '10', permission_overwrites: [] };
  const can = perms.botCan(perms.channelPermissions({ guild: GUILD, botId: '2', botRoleIds: ['5'], channel: ch }));
  assert.equal(perms.eligible(can), true);
  const noRole = perms.botCan(perms.channelPermissions({ guild: GUILD, botId: '2', botRoleIds: [], channel: ch }));
  assert.equal(perms.eligible(noRole), false);
});
test('perms: a channel deny overwrite removes the permission', () => {
  const ch = { id: '10', permission_overwrites: [{ id: '5', type: 0, allow: '0', deny: String(1n << 11n) }] };
  const can = perms.botCan(perms.channelPermissions({ guild: GUILD, botId: '2', botRoleIds: ['5'], channel: ch }));
  assert.equal(can.send, false); assert.equal(perms.eligible(can), false);
});
test('perms: bot specific overwrite wins and administrator is full access', () => {
  const ch = { id: '10', permission_overwrites: [{ id: '2', type: 1, allow: String(1n << 11n), deny: '0' }] };
  const can = perms.botCan(perms.channelPermissions({ guild: GUILD, botId: '2', botRoleIds: [], channel: ch }));
  assert.equal(can.send, true);
  const admin = { ...GUILD, roles: [{ id: '1', permissions: '0' }, { id: '7', permissions: String(1n << 3n) }] };
  assert.equal(perms.eligible(perms.botCan(perms.channelPermissions({ guild: admin, botId: '2', botRoleIds: ['7'], channel: { permission_overwrites: [] } }))), true);
});

// ---- the bot and the dashboard must agree on limits
test('constants stay in step with the bot', () => {
  const py = readFileSync(join(here, '../../../../bot/export/wody_link/constants.py'), 'utf8');
  for (const [k, v] of Object.entries(C.DEFAULT_ANTISPAM)) {
    if (typeof v === 'number') assert.match(py, new RegExp(`"${k}":\\s*${v}\\b`), `default ${k}`);
  }
  for (const [k, [lo, hi]] of Object.entries(C.ANTISPAM_BOUNDS)) {
    assert.match(py, new RegExp(`"${k}":\\s*\\(${lo},\\s*${hi}\\)`), `bounds ${k}`);
  }
  for (const lang of C.TRANSLATION_LANGUAGES) assert.ok(py.includes(`"${lang}"`), `language ${lang}`);
});

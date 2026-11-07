import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { PERMISSION_KEYS, channelOf, cleanPerms, errorKind, titleKey } from '../../lib/error-log.js';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const LOCALES = ['en', 'ro', 'fr', 'it', 'de', 'es', 'nl', 'pt', 'tr'];
const log = (l) => JSON.parse(fs.readFileSync(path.join(ROOT, `messages/${l}.json`), 'utf8')).guildSettings.common.errorLog;

test('codes map to the right kind of explanation', () => {
  const cases = {
    missing_bot_permissions: 'permissions', log_missing_permissions: 'permissions', missing_manage_guild: 'permissions',
    reward_missing_manage_roles: 'permissions', feed_no_permission: 'permissions',
    channel_missing: 'channel', board_channel_missing: 'channel', feed_channel_missing: 'channel',
    role_missing: 'role_missing', level_reward_role_missing: 'role_missing',
    role_too_high: 'role_order', reward_role_hierarchy: 'role_order', role_not_assignable: 'role_managed', reward_role_managed: 'role_managed',
    card_render_failed: 'card', feed_not_found: 'feed_source', feed_bad_data: 'feed_passing', feed_unavailable: 'feed_passing',
    feed_blocked: 'feed_input', module_disabled: 'module_disabled', internal_error: 'internal', reward_nick_owner: 'owner_nick',
    delivery_failed: 'refused', transcript_send_failed: 'refused', '': 'generic', something_new: 'generic',
  };
  for (const [code, kind] of Object.entries(cases)) assert.equal(errorKind(code), kind, code);
});

test('every kind, title and permission has a text in all nine languages', () => {
  const kinds = ['permissions', 'channel', 'role_missing', 'role_order', 'role_managed', 'card', 'feed_source', 'feed_passing', 'feed_input',
    'module_disabled', 'internal', 'owner_nick', 'refused', 'generic'];
  const en = log('en');
  for (const l of LOCALES) {
    const m = log(l);
    for (const k of kinds) assert.ok(m.help[k], `${l} help.${k}`);
    for (const p of PERMISSION_KEYS) assert.ok(m.perms[p], `${l} perms.${p}`);
    for (const c of Object.keys(en.codes)) assert.ok(m.codes[c], `${l} codes.${c}`);
    for (const k of ['missingLabel', 'whereChannel', 'whereServer', 'whereRole', 'fixPermissionsChannel', 'fixPermissionsServer', 'fixRoleOrder', 'detailLabel', 'unknownChannel', 'unknownRole', 'theRole']) assert.ok(m[k], `${l} ${k}`);
  }
});

test('titles, permissions and channels are read safely', () => {
  const has = (k) => k === 'codes.missing_bot_permissions' || k === 'codes.missing_permissions';
  assert.equal(titleKey('missing_bot_permissions', has), 'codes.missing_bot_permissions');
  assert.equal(titleKey('welcome_missing_permissions', has), 'codes.missing_permissions');
  assert.equal(titleKey('nothing', has), null);
  assert.deepEqual(cleanPerms(['send_messages', 'evil', 'view_channel', 'send_messages']), ['view_channel', 'send_messages']);
  assert.deepEqual(cleanPerms(null), []);
  assert.equal(channelOf({ channel_id: '123' }), '123');
  assert.equal(channelOf({ detail: 'Could not post in <#123456789012345678>.' }), '123456789012345678');
  assert.equal(channelOf({ detail: 'nothing' }), null);
});

// Busy dates (Wody seasons and the Owner's blocked ranges), the publish checklist and custom rewards.
import test from 'node:test';
import assert from 'node:assert/strict';

const { state } = await import('./stubs/state.mjs');
const { makeDb } = await import('./fake-db.mjs');
const { handle } = await import('../../lib/battlepass/api.js');
const { OWNER_ID } = await import('./stubs/owner-access.mjs');
const { scheduleConflicts, busyRanges, cleanBlock, readiness } = await import('../../lib/battlepass/schedule.js');
const { cleanSeason } = await import('../../lib/battlepass/validate.js');

const OWNER = OWNER_ID; const MANAGER = '2000000000000000001'; const G1 = '4000000000000000001';
const DAY = 86400000;
const BASE = Math.floor(Date.now() / 1000) * 1000;
const at = (days) => new Date(BASE + days * DAY).toISOString();

function fresh() {
  state.db = makeDb(); state.session = null; state.delegates = new Set(); state.blocked = new Set();
  state.guilds = [{ id: G1, owner: false, permissions: '32' }];
  state.db.collection('premium_servers').insertOne({ guild_id: BigInt(G1), active: true });
  return state.db;
}
async function call(method, path, { body, user } = {}) {
  state.session = user ? { user: { id: user }, accessToken: 'token' } : null;
  const url = new URL(`https://wody.test/api/battlepass/${path}`);
  const request = new Request(url, { method, headers: { origin: 'https://wody.test', 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const res = await handle({ request, db: state.db, parts: path.split('/').filter(Boolean), method, url });
  return { status: res.status, body: await res.json() };
}
const season = (over = {}) => ({
  name: 'Autumn', level_count: 5, curve: { type: 'fixed', base: 100 },
  rewards: [{ id: 'r1', name: 'Badge', type: 'badge', level: 1 }, { id: 'r2', name: 'Frame', type: 'frame', level: 3 }], ...over,
});

test('pure rule: a window collides with a Wody season and with a blocked range, and free dates pass', () => {
  const now = new Date();
  const globals = [{ id: 'g', scope: 'global', status: 'scheduled', name: 'Wody', starts_at: at(10), ends_at: at(20) }];
  const blocks = [{ id: 'b', starts_at: at(30), ends_at: at(35), reason: 'Event' }];
  const mine = (a, b) => ({ id: 'x', scope: 'guild', status: 'draft', starts_at: at(a), ends_at: at(b) });
  assert.equal(scheduleConflicts(mine(0, 5), globals, blocks, now).length, 0);
  assert.equal(scheduleConflicts(mine(15, 25), globals, blocks, now)[0].kind, 'global');
  assert.equal(scheduleConflicts(mine(32, 40), globals, blocks, now)[0].kind, 'blocked');
  assert.equal(scheduleConflicts(mine(20, 30), globals, blocks, now).length, 0, 'ranges that only touch do not collide');
  assert.equal(busyRanges(globals, blocks, now).length, 2);
});

test('pure rule: blocked ranges are validated', () => {
  assert.equal(cleanBlock({ starts_at: at(1), ends_at: at(2), reason: ' Big event ' }).range.reason, 'Big event');
  assert.equal(cleanBlock({ starts_at: at(2), ends_at: at(1) }).error, 'end_before_start');
  assert.equal(cleanBlock({ starts_at: at(-5), ends_at: at(-1) }).error, 'in_the_past');
  assert.equal(cleanBlock({ starts_at: 'x', ends_at: at(1) }).error, 'invalid_dates');
});

test('checklist depends on the start date and on the scope', () => {
  const now = new Date();
  const base = { name: 'A', level_count: 5, rewards: [{ id: 'r' }], xp: { message: { enabled: true } }, status: 'draft' };
  const later = readiness({ ...base, starts_at: at(3), ends_at: at(9) }, { scope: 'guild', now });
  assert.equal(later.later, true);
  assert.ok(later.items.find((i) => i.id === 'start_future'));
  assert.equal(later.ready, true);
  const over = readiness({ ...base, starts_at: at(-9), ends_at: at(-1) }, { scope: 'guild', now });
  assert.equal(over.ready, false);
  assert.equal(over.items.find((i) => i.id === 'end_not_past').ok, false);
  const empty = readiness({ ...base, rewards: [] }, { scope: 'global', now });
  assert.equal(empty.ready, false);
  assert.equal(empty.items.find((i) => i.id === 'rewards').required, true);
  assert.equal(readiness(base, { scope: 'guild', now, conflicts: [{ kind: 'global' }] }).ready, false);
});

test('owner blocks dates, a server cannot publish over them and sees them on its calendar', async () => {
  fresh();
  assert.equal((await call('POST', 'owner/blocked', { user: MANAGER, body: { starts_at: at(5), ends_at: at(15) } })).status, 403);
  const made = await call('POST', 'owner/blocked', { user: OWNER, body: { starts_at: at(5), ends_at: at(15), reason: 'Winter event' } });
  assert.equal(made.status, 201);
  assert.equal(made.body.blocked.length, 1);

  const cal = await call('GET', `guilds/${G1}/calendar`, { user: MANAGER });
  assert.equal(cal.status, 200);
  assert.equal(cal.body.busy[0].kind, 'blocked');
  assert.equal(cal.body.busy[0].name, 'Winter event');

  const created = await call('POST', `guilds/${G1}/seasons`, { user: MANAGER, body: season({ starts_at: at(10), ends_at: at(20) }) });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  const id = created.body.season.id;
  const detail = await call('GET', `guilds/${G1}/seasons/${id}`, { user: MANAGER });
  assert.equal(detail.body.readiness.ready, false);
  assert.ok(detail.body.busy.length === 1);
  const refused = await call('POST', `guilds/${G1}/seasons/${id}/activate`, { user: MANAGER });
  assert.equal(refused.status, 409);
  assert.equal(refused.body.reason, 'wody_busy');

  const free = await call('PATCH', `guilds/${G1}/seasons/${id}`, { user: MANAGER, body: season({ starts_at: at(20), ends_at: at(30) }) });
  assert.equal(free.status, 200, JSON.stringify(free.body));
  const ok = await call('POST', `guilds/${G1}/seasons/${id}/activate`, { user: MANAGER });
  assert.equal(ok.status, 200, JSON.stringify(ok.body));

  const removed = await call('DELETE', `owner/blocked/${made.body.blocked[0].id}`, { user: OWNER });
  assert.equal(removed.body.blocked.length, 0);
});

test('a scheduled Wody season is busy for server seasons too', async () => {
  fresh();
  const g = await call('POST', 'owner/seasons', { user: OWNER, body: season({ name: 'Wody Winter', starts_at: at(4), ends_at: at(40) }) });
  assert.equal(g.status, 201);
  assert.equal((await call('POST', `owner/seasons/${g.body.season.id}/activate`, { user: OWNER })).status, 200);
  const cal = await call('GET', `guilds/${G1}/calendar`, { user: MANAGER });
  assert.equal(cal.body.busy[0].kind, 'global');
  assert.equal(cal.body.busy[0].name, 'Wody Winter');
  const mine = await call('POST', `guilds/${G1}/seasons`, { user: MANAGER, body: season({ starts_at: at(10), ends_at: at(20) }) });
  const refused = await call('POST', `guilds/${G1}/seasons/${mine.body.season.id}/activate`, { user: MANAGER });
  assert.equal(refused.body.reason, 'wody_busy');
  assert.equal(refused.body.conflicts[0].name, 'Wody Winter');
});

test('custom rewards: shape, colour and claim settings are cleaned; a role is only for server seasons', () => {
  const rewards = [{ id: 'c1', name: 'Founder', type: 'custom', level: 1, badge: { shape: 'shield', color: '#FFAA00' }, claim: { label: 'Take it', message: 'Welcome', dm: true, role_id: '123456789012345678' } }];
  const guild = cleanSeason(season({ rewards }), { scope: 'guild', existing: null, limits: {} });
  assert.deepEqual(guild.errors, []);
  const r = guild.doc.rewards[0];
  assert.equal(r.type, 'custom');
  assert.deepEqual(r.badge, { shape: 'shield', color: '#ffaa00' });
  assert.deepEqual(r.claim, { label: 'Take it', message: 'Welcome', dm: true, role_id: '123456789012345678' });
  const global = cleanSeason(season({ rewards }), { scope: 'global', existing: null, limits: {} });
  assert.ok(global.errors.some((e) => /claim\.role_id/.test(JSON.stringify(e))));
  const bad = cleanSeason(season({ rewards: [{ id: 'c', name: 'x', type: 'badge', level: 1, badge: { color: 'red' }, claim: { label: 'y'.repeat(40) } }] }), { scope: 'guild', existing: null, limits: {} });
  assert.ok(bad.errors.length >= 2);
});

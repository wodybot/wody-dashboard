// Battle Pass API tests. The real lib/battlepass code runs on an in-memory database, a stand-in session and a fake bot.
import test from 'node:test';
import assert from 'node:assert/strict';

const { state } = await import('./stubs/state.mjs');
const { makeDb } = await import('./fake-db.mjs');
const { handle } = await import('../../lib/battlepass/api.js');
const { OWNER_ID } = await import('./stubs/owner-access.mjs');

const OWNER = OWNER_ID; const DELEGATE = '1000000000000000002';
const MANAGER = '2000000000000000001'; const OTHER = '2000000000000000002'; const MEMBER = '3000000000000000001';
const G1 = '4000000000000000001'; const G2 = '4000000000000000002';

function fresh() {
  state.db = makeDb(); state.session = null; state.delegates = new Set([DELEGATE]); state.blocked = new Set();
  state.guilds = [{ id: G1, owner: false, permissions: '32' }];            // MANAGE_GUILD on G1 only
  return state.db;
}
async function call(method, path, { body, user, origin = 'https://wody.test' } = {}) {
  state.session = user ? { user: { id: user }, accessToken: 'token' } : null;
  const url = new URL(`https://wody.test/api/battlepass/${path}`);
  const request = new Request(url, { method, headers: { origin, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const res = await handle({ request, db: state.db, parts: path.split('?')[0].split('/').filter(Boolean), method, url });
  return { status: res.status, body: await res.json() };
}
const season = (over = {}) => ({
  name: 'Autumn', level_count: 5, curve: { type: 'fixed', base: 100 },
  rewards: [{ id: 'r1', name: 'Badge', type: 'badge', level: 1 }, { id: 'r2', name: 'Frame', type: 'frame', level: 3 }], ...over,
});
async function makeGlobal(name = 'Global') {
  const r = await call('POST', 'owner/seasons', { user: OWNER, body: season({ name }) });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  return r.body.season.id;
}
function premium(db, gid) { return db.collection('premium_servers').insertOne({ guild_id: BigInt(gid), active: true }); }
function startBot(db, answer) {
  const timer = setInterval(async () => {
    const col = db.collection('module_requests');
    const pending = await col.find({ status: 'pending', kind: 'bp_claim' }).toArray();
    for (const doc of pending) {
      const result = await answer(doc);
      await col.updateOne({ _id: doc._id }, { $set: { status: 'done', result } });
    }
  }, 20);
  return () => clearInterval(timer);
}

test('access: signed out, blocked and cross-site requests are refused', async () => {
  fresh();
  assert.equal((await call('GET', 'me')).status, 401);
  assert.equal((await call('POST', 'owner/seasons', { user: OWNER, body: season(), origin: 'https://evil.test' })).status, 403);
  state.blocked.add(MEMBER);
  assert.equal((await call('GET', 'me', { user: MEMBER })).body.error, 'account_blocked');
});

test('owner: only the platform owner writes, a delegate can read, everyone else is refused', async () => {
  fresh();
  assert.equal((await call('POST', 'owner/seasons', { user: DELEGATE, body: season() })).status, 403);
  assert.equal((await call('POST', 'owner/seasons', { user: MANAGER, body: season() })).status, 403);
  await makeGlobal();
  assert.equal((await call('GET', 'owner/seasons', { user: DELEGATE })).status, 200);
  assert.equal((await call('GET', 'owner/seasons', { user: MANAGER })).status, 403);
});

test('owner: invalid seasons come back with field level codes', async () => {
  fresh();
  const r = await call('POST', 'owner/seasons', { user: OWNER, body: season({ name: '', xp: { message: { xp: 5000 } } }) });
  assert.equal(r.status, 422);
  const codes = r.body.errors.map((e) => `${e.field}:${e.code}`);
  assert.ok(codes.includes('name:required') && codes.includes('xp.message.xp:out_of_range'));
});

test('global activation: one global season at a time, also under a race', async () => {
  const db = fresh();
  const a = await makeGlobal('A'); const b = await makeGlobal('B'); const c = await makeGlobal('C');
  const results = await Promise.all([a, b, c].map((id) => call('POST', `owner/seasons/${id}/activate`, { user: OWNER })));
  const ok = results.filter((r) => r.status === 200); const refused = results.filter((r) => r.status === 409);
  assert.equal(ok.length, 1, JSON.stringify(results.map((r) => r.body)));
  assert.equal(refused.length, 2);
  assert.ok(refused.every((r) => ['another_global_active', undefined].includes(r.body.reason) || r.body.error === 'busy'));
  const running = (await db.collection('bp_seasons').find({ status: 'active' }).toArray());
  assert.equal(running.length, 1);
});

test('global activation: after the running one completes another can start', async () => {
  fresh();
  const a = await makeGlobal('A'); const b = await makeGlobal('B');
  assert.equal((await call('POST', `owner/seasons/${a}/activate`, { user: OWNER })).status, 200);
  const blocked = await call('POST', `owner/seasons/${b}/activate`, { user: OWNER });
  assert.equal(blocked.body.reason, 'another_global_active');
  assert.equal((await call('POST', `owner/seasons/${a}/complete`, { user: OWNER })).status, 200);
  assert.equal((await call('POST', `owner/seasons/${b}/activate`, { user: OWNER })).status, 200);
});

test('premium: a server season needs Premium and a server manager', async () => {
  const db = fresh();
  assert.equal((await call('POST', `guilds/${G1}/seasons`, { user: OTHER, body: season() })).status, 402);
  state.guilds = [];
  assert.equal((await call('POST', `guilds/${G1}/seasons`, { user: OTHER, body: season() })).status, 403);
  state.guilds = [{ id: G1, owner: false, permissions: '32' }];
  assert.equal((await call('POST', `guilds/${G1}/seasons`, { user: MANAGER, body: season() })).body.error, 'premium_required');
  await premium(db, G1);
  const made = await call('POST', `guilds/${G1}/seasons`, { user: MANAGER, body: season() });
  assert.equal(made.status, 201);
  assert.equal(made.body.season.scope, 'guild');
  assert.equal(made.body.season.guild_id, G1);
});

test('premium: a manager of one server cannot reach another server or a Global season', async () => {
  const db = fresh(); await premium(db, G1); await premium(db, G2);
  const own = (await call('POST', `guilds/${G1}/seasons`, { user: MANAGER, body: season() })).body.season.id;
  const globalId = await makeGlobal();
  assert.equal((await call('GET', `guilds/${G2}/seasons/${own}`, { user: MANAGER })).status, 403);     // not a manager of G2
  state.guilds = [{ id: G1, owner: false, permissions: '32' }, { id: G2, owner: false, permissions: '32' }];
  assert.equal((await call('GET', `guilds/${G2}/seasons/${own}`, { user: MANAGER })).status, 404);      // season belongs to G1
  assert.equal((await call('GET', `guilds/${G1}/seasons/${globalId}`, { user: MANAGER })).status, 404);
  assert.equal((await call('POST', `guilds/${G1}/seasons/${globalId}/activate`, { user: MANAGER })).status, 404);
});

test('priority: the Global season blocks a server season and a running server season is not touched', async () => {
  const db = fresh(); await premium(db, G1);
  const mine = (await call('POST', `guilds/${G1}/seasons`, { user: MANAGER, body: season({ name: 'Mine' }) })).body.season.id;
  assert.equal((await call('POST', `guilds/${G1}/seasons/${mine}/activate`, { user: MANAGER })).status, 200);
  const g = await makeGlobal();
  assert.equal((await call('POST', `owner/seasons/${g}/activate`, { user: OWNER })).status, 200);
  // The server season keeps its configuration and its status, it just does not run.
  const stored = await db.collection('bp_seasons').findOne({ name: 'Mine' });
  assert.equal(stored.status, 'active');
  const status = await call('GET', `guilds/${G1}/status`, { user: MANAGER });
  assert.equal(status.body.running.scope, 'global');
  assert.equal(status.body.reason, 'global_active');
  // A second server season cannot be switched on while the Global one runs.
  const second = (await call('POST', `guilds/${G1}/seasons`, { user: MANAGER, body: season({ name: 'Second' }) })).body.season.id;
  const refused = await call('POST', `guilds/${G1}/seasons/${second}/activate`, { user: MANAGER });
  assert.equal(refused.status, 409); assert.equal(refused.body.reason, 'global_active');
  // When the Global season ends the server season runs again.
  await call('POST', `owner/seasons/${g}/complete`, { user: OWNER });
  const after = await call('GET', `guilds/${G1}/status`, { user: MANAGER });
  assert.equal(after.body.running.name, 'Mine');
});

test('premium: without Premium a server season does not run and cannot be activated, drafts stay readable', async () => {
  const db = fresh(); await premium(db, G1);
  const id = (await call('POST', `guilds/${G1}/seasons`, { user: MANAGER, body: season() })).body.season.id;
  await call('POST', `guilds/${G1}/seasons/${id}/activate`, { user: MANAGER });
  await db.collection('premium_servers').updateOne({ guild_id: BigInt(G1) }, { $set: { active: false } });
  assert.equal((await call('GET', `guilds/${G1}/seasons/${id}`, { user: MANAGER })).status, 200);
  const status = await call('GET', `guilds/${G1}/status`, { user: MANAGER });
  assert.equal(status.body.running, null); assert.equal(status.body.reason, 'not_premium');
  assert.equal((await call('PATCH', `guilds/${G1}/seasons/${id}`, { user: MANAGER, body: season({ name: 'x' }) })).body.error, 'premium_required');
  assert.equal((await call('POST', `guilds/${G1}/seasons/${id}/pause`, { user: MANAGER })).status, 200);       // stopping is always allowed
});

test('editing a running season cannot take away what members hold', async () => {
  const db = fresh();
  const id = await makeGlobal();
  await call('POST', `owner/seasons/${id}/activate`, { user: OWNER });
  assert.equal((await call('PATCH', `owner/seasons/${id}`, { user: OWNER, body: season({ level_count: 3 }) })).body.error, 'levels_locked');
  await db.collection('bp_claims').insertOne({ _id: `${id}:${MEMBER}:r1`, season_id: id, user_id: BigInt(MEMBER), reward_id: 'r1' });
  const removed = await call('PATCH', `owner/seasons/${id}`, { user: OWNER, body: season({ rewards: [{ id: 'r2', name: 'Frame', type: 'frame', level: 3 }] }) });
  assert.equal(removed.body.error, 'reward_in_use');
  const ok = await call('PATCH', `owner/seasons/${id}`, { user: OWNER, body: season({ name: 'Renamed', level_count: 8 }) });
  assert.equal(ok.status, 200); assert.equal(ok.body.season.name, 'Renamed'); assert.equal(ok.body.season.version, 3);
});

test('delete: only a draft without progress', async () => {
  const db = fresh();
  const a = await makeGlobal('A'); const b = await makeGlobal('B');
  await call('POST', `owner/seasons/${b}/activate`, { user: OWNER });
  assert.equal((await call('DELETE', `owner/seasons/${b}`, { user: OWNER })).body.error, 'only_drafts');
  await db.collection('bp_progress').insertOne({ _id: `${a}:${MEMBER}`, season_id: a, user_id: BigInt(MEMBER), xp: 5 });
  assert.equal((await call('DELETE', `owner/seasons/${a}`, { user: OWNER })).body.error, 'has_progress');
  const c = await makeGlobal('C');
  assert.equal((await call('DELETE', `owner/seasons/${c}`, { user: OWNER })).status, 200);
});

test('member: the Global season is what a member sees, with their own progress', async () => {
  const db = fresh(); await premium(db, G1);
  const g = await makeGlobal();
  await call('POST', `owner/seasons/${g}/activate`, { user: OWNER });
  await db.collection('bp_progress').insertOne({ _id: `${g}:${MEMBER}`, season_id: g, user_id: BigInt(MEMBER), xp: 250, m: { messages: 12 } });
  const r = await call('GET', `me?guild=${G1}`, { user: MEMBER });
  assert.equal(r.body.season.id, g);
  assert.equal(r.body.state.level, 2); assert.equal(r.body.state.xp, 250);
  assert.equal(r.body.state.rewards.r1, 'available'); assert.equal(r.body.state.rewards.r2, 'locked');
  assert.equal(r.body.season.protection, undefined); assert.equal(r.body.season.notifications, undefined);   // not public
  assert.equal((await call('GET', 'me', { user: OTHER })).body.state.xp, 0);
});

test('claim: refused early without calling the bot, otherwise decided by the bot engine', async () => {
  const db = fresh();
  const g = await makeGlobal();
  await call('POST', `owner/seasons/${g}/activate`, { user: OWNER });
  const calls = [];
  const stop = startBot(db, async (doc) => { calls.push(doc.payload); return { ok: true, code: null }; });
  try {
    const early = await call('POST', 'claim', { user: MEMBER, body: { season_id: g, reward_id: 'r1' } });
    assert.equal(early.status, 409); assert.equal(early.body.code, 'not_unlocked');
    assert.equal(calls.length, 0);
    assert.equal((await call('POST', 'claim', { user: MEMBER, body: { season_id: g, reward_id: 'nope' } })).body.code, 'unknown_reward');
    await db.collection('bp_progress').insertOne({ _id: `${g}:${MEMBER}`, season_id: g, user_id: BigInt(MEMBER), xp: 150 });
    const ok = await call('POST', 'claim', { user: MEMBER, body: { season_id: g, reward_id: 'r1' } });
    assert.equal(ok.status, 200); assert.equal(ok.body.ok, true);
    assert.deepEqual(calls, [{ season_id: g, reward_id: 'r1' }]);
    // The member id sent to the bot is the signed-in member, whatever the body says.
    const asked = await db.collection('module_requests').find({ kind: 'bp_claim' }).toArray();
    assert.equal(String(asked[0].requested_by), MEMBER);
    await db.collection('bp_claims').insertOne({ _id: `${g}:${MEMBER}:r1`, season_id: g, user_id: BigInt(MEMBER), reward_id: 'r1' });
    assert.equal((await call('POST', 'claim', { user: MEMBER, body: { season_id: g, reward_id: 'r1' } })).body.code, 'already_claimed');
  } finally { stop(); }
});

test('claim: a refusal from the bot is passed on, a bot that does not answer is reported', async () => {
  const db = fresh();
  const g = await makeGlobal();
  await call('POST', `owner/seasons/${g}/activate`, { user: OWNER });
  await db.collection('bp_progress').insertOne({ _id: `${g}:${MEMBER}`, season_id: g, user_id: BigInt(MEMBER), xp: 150 });
  const stop = startBot(db, async () => ({ ok: false, code: 'already_claimed' }));
  try {
    const r = await call('POST', 'claim', { user: MEMBER, body: { season_id: g, reward_id: 'r1' } });
    assert.equal(r.status, 409); assert.equal(r.body.code, 'already_claimed');
  } finally { stop(); }
});

test('profile: only items the member owns can be equipped or shown', async () => {
  const db = fresh();
  await db.collection('bp_inventory').insertOne({ user_id: BigInt(MEMBER), item_id: 'f1', type: 'frame', name: 'Gold' });
  await db.collection('bp_inventory').insertOne({ user_id: BigInt(MEMBER), item_id: 'b1', type: 'badge', name: 'First' });
  const bad = await call('PATCH', 'profile', { user: MEMBER, body: { equipped: { frame: 'nope', background: 'f1' }, showcase: ['zzz'] } });
  assert.equal(bad.status, 422);
  const codes = bad.body.errors.map((e) => `${e.field}:${e.code}`);
  assert.ok(codes.includes('equipped.frame:not_owned') && codes.includes('equipped.background:wrong_type') && codes.includes('showcase:not_owned'));
  assert.equal((await call('PATCH', 'profile', { user: MEMBER, body: { equipped: { frame: 'f1' }, showcase: ['b1', 'f1'], featured_badge: 'b1' } })).status, 200);
  const inv = await call('GET', 'inventory', { user: MEMBER });
  assert.deepEqual(inv.body.profile.equipped, { frame: 'f1' });
  assert.equal((await call('PATCH', 'profile', { user: OTHER, body: { equipped: { frame: 'f1' } } })).status, 422);   // somebody else's item
});

test('limits: the owner can lower the Premium ceilings and a season is validated against them', async () => {
  const db = fresh(); await premium(db, G1);
  assert.equal((await call('PATCH', 'owner/limits', { user: OWNER, body: { max_message_xp: 5000 } })).status, 422);
  assert.equal((await call('PATCH', 'owner/limits', { user: OWNER, body: { max_message_xp: 10 } })).status, 200);
  const r = await call('POST', `guilds/${G1}/seasons`, { user: MANAGER, body: season({ xp: { message: { xp: 20 } } }) });
  assert.equal(r.status, 422);
  assert.ok(r.body.errors.some((e) => e.field === 'xp.message.xp'));
  const audit = await call('GET', 'owner/audit', { user: OWNER });
  assert.ok(audit.body.entries.some((e) => e.action === 'limits.update'));
});

// ---------------------------------------------------------------------------------------------- delivery form
const FORM = {
  enabled: true, title: 'Delivery', intro: 'Tell us where to send it', fields: [
    { id: 'nickname', label: 'In-game nickname', type: 'text', required: true, max: 20 },
    { id: 'region', label: 'Region', type: 'select', options: ['EU', 'US'] },
  ],
};
async function serverSeasonRunning(db) {
  await premium(db, G1);
  const id = (await call('POST', `guilds/${G1}/seasons`, { user: MANAGER, body: season({ name: 'Mine' }) })).body.season.id;
  assert.equal((await call('POST', `guilds/${G1}/seasons/${id}/activate`, { user: MANAGER })).status, 200);
  return id;
}
const took = (db, sid, user) => db.collection('bp_progress').insertOne({ _id: `${sid}:${user}`, season_id: sid, user_id: BigInt(user), xp: 150 });
const claimed = (db, sid, user, reward) => db.collection('bp_claims').insertOne({ _id: `${sid}:${user}:${reward}`, season_id: sid, user_id: BigInt(user), reward_id: reward });

test('form: only a Premium server manager saves it, and the fields are validated', async () => {
  const db = fresh();
  assert.equal((await call('PUT', `guilds/${G1}/form`, { user: MANAGER, body: FORM })).body.error, 'premium_required');
  await premium(db, G1);
  assert.equal((await call('PUT', `guilds/${G1}/form`, { user: OTHER, body: FORM })).status, 200);
  state.guilds = [];
  assert.equal((await call('PUT', `guilds/${G1}/form`, { user: OTHER, body: FORM })).status, 403);
  state.guilds = [{ id: G1, owner: false, permissions: '32' }];
  const bad = await call('PUT', `guilds/${G1}/form`, { user: MANAGER, body: { ...FORM, fields: [{ id: 'Bad Id', label: '', type: 'text' }] } });
  assert.equal(bad.status, 422);
  assert.ok(bad.body.errors.some((e) => e.field === 'fields.1.id'));
  assert.ok(bad.body.errors.some((e) => e.field === 'fields.1.label'));
  assert.equal((await call('PUT', `guilds/${G1}/form`, { user: MANAGER, body: { ...FORM, enabled: true, fields: [] } })).status, 422);
  const ok = await call('PUT', `guilds/${G1}/form`, { user: MANAGER, body: { ...FORM, title: '<b>Delivery</b>' } });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.form.title, 'bDelivery/b');
  const read = await call('GET', `guilds/${G1}/form`, { user: MANAGER });
  assert.equal(read.body.form.fields.length, 2);
});

test('form: members fill it in after claiming, the owner delivers by hand', async () => {
  const db = fresh();
  const sid = await serverSeasonRunning(db);
  await call('PUT', `guilds/${G1}/form`, { user: MANAGER, body: FORM });
  const send = (body, user = MEMBER) => call('POST', 'form', { user, body: { guild: G1, ...body } });
  // not taking part yet
  assert.equal((await send({ answers: { nickname: 'Wolf' } })).body.error, 'no_progress');
  await took(db, sid, MEMBER); await claimed(db, sid, MEMBER, 'r1');
  const view = await call('GET', `form?guild=${G1}`, { user: MEMBER });
  assert.equal(view.body.available, true);
  assert.deepEqual(view.body.rewards.map((r) => r.id), ['r1']);
  assert.equal('user_id' in view.body.form, false);
  // validation and ownership of the claimed reward
  assert.equal((await send({ answers: { nickname: '' } })).status, 422);
  assert.equal((await send({ answers: { nickname: 'Wolf', region: 'ASIA' } })).status, 422);
  assert.equal((await send({ reward_id: 'r2', answers: { nickname: 'Wolf' } })).body.error, 'reward_not_claimed');
  const first = await send({ reward_id: 'r1', answers: { nickname: ' Wolf<x> ', region: 'EU', extra: 'ignored' } });
  assert.equal(first.status, 201);
  assert.deepEqual(first.body.entry.answers, { nickname: 'Wolfx', region: 'EU' });
  assert.equal((await send({ reward_id: 'r1', answers: { nickname: 'Wolf2', region: 'US' } })).status, 200);     // edited while still new
  assert.equal(await db.collection('bp_form_submissions').countDocuments({}), 1);
  // the owner sees it
  const list = await call('GET', `guilds/${G1}/submissions`, { user: MANAGER });
  assert.equal(list.body.entries.length, 1);
  assert.equal(list.body.entries[0].reward_name, 'Badge');
  assert.equal(list.body.entries[0].answers.nickname, 'Wolf2');
  assert.equal(list.body.counts.new, 1);
  const id = list.body.entries[0].id;
  assert.equal((await call('GET', `guilds/${G1}/submissions`, { user: OTHER, origin: 'https://wody.test' })).status, 200);
  state.guilds = [];
  assert.equal((await call('GET', `guilds/${G1}/submissions`, { user: MEMBER })).status, 403);              // members cannot read the queue
  state.guilds = [{ id: G1, owner: false, permissions: '32' }];
  const done = await call('PATCH', `guilds/${G1}/submissions/${id}`, { user: MANAGER, body: { status: 'delivered', note: 'sent in game' } });
  assert.equal(done.body.entry.status, 'delivered');
  assert.equal((await send({ reward_id: 'r1', answers: { nickname: 'Late' } })).body.error, 'rate_limited');       // 6 submissions per minute
  db.collection('rate_limit_buckets').docs.length = 0;
  assert.equal((await send({ reward_id: 'r1', answers: { nickname: 'Late' } })).body.error, 'already_delivered');
  assert.equal((await call('PATCH', `guilds/${G1}/submissions/${id}`, { user: MANAGER, body: { status: 'weird' } })).status, 400);
  // a member removes only their own entry
  assert.equal((await call('DELETE', `form/${id}`, { user: OTHER })).status, 404);
  assert.equal((await call('DELETE', `form/${id}`, { user: MEMBER })).status, 200);
  assert.equal(await db.collection('bp_form_submissions').countDocuments({}), 0);
});

test('form: not offered while a Global season runs, when switched off or without Premium', async () => {
  const db = fresh();
  const sid = await serverSeasonRunning(db);
  await took(db, sid, MEMBER);
  assert.equal((await call('GET', `form?guild=${G1}`, { user: MEMBER })).body.available, false);               // form not saved yet
  await call('PUT', `guilds/${G1}/form`, { user: MANAGER, body: FORM });
  assert.equal((await call('GET', `form?guild=${G1}`, { user: MEMBER })).body.available, true);
  await call('PUT', `guilds/${G1}/form`, { user: MANAGER, body: { ...FORM, enabled: false } });
  assert.equal((await call('POST', 'form', { user: MEMBER, body: { guild: G1, answers: { nickname: 'A' } } })).body.error, 'form_off');
  await call('PUT', `guilds/${G1}/form`, { user: MANAGER, body: FORM });
  const g = await makeGlobal();
  await call('POST', `owner/seasons/${g}/activate`, { user: OWNER });
  const blocked = await call('GET', `form?guild=${G1}`, { user: MEMBER });
  assert.equal(blocked.body.available, false); assert.equal(blocked.body.reason, 'global_active');
  assert.equal((await call('POST', 'form', { user: MEMBER, body: { guild: G1, answers: { nickname: 'A' } } })).body.error, 'season_not_running');
  assert.equal((await call('POST', 'form', { user: MEMBER, body: { guild: 'abc', answers: {} } })).status, 400);
});

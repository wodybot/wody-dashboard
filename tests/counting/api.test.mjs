// Counting API tests. The real lib/counting code runs on an in-memory database, a stand-in session and a fake bot that records
// what it was asked to do (the website never writes Counting data itself).
import test from 'node:test';
import assert from 'node:assert/strict';

const { state } = await import('../battlepass/stubs/state.mjs');
const { makeDb } = await import('../battlepass/fake-db.mjs');
const { handle } = await import('../../lib/counting/api.js');
const { OWNER_ID } = await import('../battlepass/stubs/owner-access.mjs');

const OWNER = OWNER_ID; const DELEGATE = '1000000000000000002';
const MANAGER = '2000000000000000001'; const MEMBER = '3000000000000000001';
const G1 = '4000000000000000001'; const G2 = '4000000000000000002';
const C1 = '5000000000000000001'; const C2 = '5000000000000000002'; const C3 = '5000000000000000003'; const C4 = '5000000000000000004';

function fresh() {
  state.db = makeDb(); state.session = null; state.delegates = new Set([DELEGATE]); state.blocked = new Set();
  state.guilds = [{ id: G1, owner: false, permissions: '32' }];
  return state.db;
}
async function call(method, path, { body, user, origin = 'https://wody.test' } = {}) {
  state.session = user ? { user: { id: user }, accessToken: 'token' } : null;
  const url = new URL(`https://wody.test/api/counting/${path}`);
  const request = new Request(url, { method, headers: { origin, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const res = await handle({ request, db: state.db, parts: path.split('?')[0].split('/').filter(Boolean), method, url });
  return { status: res.status, body: await res.json() };
}
const game = (id, guild, over = {}) => ({
  _id: BigInt(id), guild_id: BigInt(guild), name: `Game ${id.slice(-1)}`, mode: 'classic', status: 'active', ver: 3,
  cfg: { visibility: { public: true, web: true }, notify: { channel_id: '777' } }, state: { value: '41', index: 41, highest_index: 80, session: 2, saves: 1 },
  stats: { total_valid: 500, total_errors: 20, sessions: 2 }, created_at: new Date('2026-10-01'), updated_at: new Date('2026-11-01'), ...over,
});
function seed(db) {
  const c = db.collection('ct_games');
  return Promise.all([
    c.insertOne(game(C1, G1)),
    c.insertOne(game(C2, G1, { cfg: { visibility: { public: false, web: true } } })),              // private
    c.insertOne(game(C3, G2, { mode: 'roman', stats: { total_valid: 900, total_errors: 1, sessions: 1 }, state: { value: 'X', index: 10, highest_index: 150 } })),
    c.insertOne(game(C4, G2, { status: 'archived' })),
  ]);
}
function startBot(db, answer = () => ({ ok: true })) {
  const asked = [];
  const timer = setInterval(async () => {
    const col = db.collection('module_requests');
    const pending = await col.find({ status: 'pending', kind: 'ct_action' }).toArray();
    for (const doc of pending) {
      asked.push(doc);
      const result = await answer(doc);
      await col.updateOne({ _id: doc._id }, { $set: { status: 'done', result } });
    }
  }, 15);
  return { asked, stop: () => clearInterval(timer) };
}

test('access: cross-site writes, signed out members and blocked accounts are refused', async () => {
  fresh();
  assert.equal((await call('POST', `guilds/${G1}/games`, { user: MANAGER, body: {}, origin: 'https://evil.test' })).status, 403);
  assert.equal((await call('GET', 'me')).status, 401);
  assert.equal((await call('GET', 'owner/overview')).status, 401);
  state.blocked.add(MEMBER);
  assert.equal((await call('GET', 'me', { user: MEMBER })).body.error, 'account_blocked');
});

test('public: only public, running games are listed and nothing private is exposed', async () => {
  const db = fresh(); await seed(db);
  const r = await call('GET', 'public/games');
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.games.map((g) => g.channel_id).sort(), [C1, C3].sort());
  assert.equal(r.body.games[0].channel_id, C3);                       // sorted by record
  const text = JSON.stringify(r.body);
  assert.ok(!text.includes('guild_id') && !text.includes('cfg') && !text.includes('777'), 'no server id, settings or notice channel');
  assert.equal((await call('GET', `public/games/${C2}`)).status, 404);   // private
  assert.equal((await call('GET', `public/games/${C4}`)).status, 404);   // archived
  assert.equal((await call('GET', 'public/games/abc')).status, 404);
  assert.equal((await call('GET', 'public/games?mode=drop')).status, 400);
  assert.deepEqual((await call('GET', 'public/games?mode=roman')).body.games.map((g) => g.channel_id), [C3]);
  assert.deepEqual((await call('GET', 'public/games?q=game%201')).body.games.map((g) => g.channel_id), [C1]);
  const s = await call('GET', 'public/summary');
  assert.deepEqual([s.body.games, s.body.total_valid, s.body.highest], [2, 1400, 150]);
});

test('public game page: state, top counters, rounds and daily totals, names only', async () => {
  const db = fresh(); await seed(db);
  await db.collection('ct_contrib').insertOne({ _id: `${C1}:1`, channel_id: BigInt(C1), user_id: BigInt('9000000000000000001'), valid: 30 });
  await db.collection('ct_contrib').insertOne({ _id: `${C1}:2`, channel_id: BigInt(C1), user_id: BigInt('9000000000000000002'), valid: 70 });
  await db.collection('ct_history').insertOne({ channel_id: BigInt(C1), guild_id: BigInt(G1), session: 1, final_index: 40, highest_index: 40, participants: 2, duration_s: 90, reason: 'error', ended_at: new Date() });
  const day = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  await db.collection('ct_daily').insertOne({ channel_id: BigInt(C1), day, valid: 12, errors: 1 });
  const r = await call('GET', `public/games/${C1}`);
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.counters.map((c) => c.valid), [70, 30]);
  assert.match(r.body.counters[0].name, /^…0002$/);
  assert.equal(r.body.history[0].final_index, 40);
  assert.deepEqual(r.body.daily, [{ day, valid: 12, errors: 1 }]);
  assert.ok(!JSON.stringify(r.body).includes('user_id'));
});

test('public leaderboard: global rows only, validated board name', async () => {
  const db = fresh();
  await db.collection('ct_players').insertOne({ _id: '0:1', guild_id: 0n, user_id: BigInt('9000000000000000001'), valid: 10, best_streak: 4, record: 12, xp: 5 });
  await db.collection('ct_players').insertOne({ _id: '0:2', guild_id: 0n, user_id: BigInt('9000000000000000002'), valid: 99, best_streak: 2, record: 9, xp: 1 });
  await db.collection('ct_players').insertOne({ _id: `${G1}:2`, guild_id: BigInt(G1), user_id: BigInt('9000000000000000002'), valid: 1000 });
  const r = await call('GET', 'public/leaderboard?board=valid');
  assert.deepEqual(r.body.rows.map((x) => [x.rank, x.value]), [[1, 99], [2, 10]]);
  assert.equal((await call('GET', 'public/leaderboard?board=record')).body.rows[0].value, 12);
  assert.equal((await call('GET', 'public/leaderboard?board=evil')).status, 400);
});

test('member: sees only their own counters', async () => {
  const db = fresh();
  await db.collection('ct_players').insertOne({ _id: `${G1}:${MEMBER}`, guild_id: BigInt(G1), user_id: BigInt(MEMBER), valid: 90, errors: 10, best_streak: 7, record: 50, xp: 200 });
  await db.collection('ct_players').insertOne({ _id: `${G1}:other`, guild_id: BigInt(G1), user_id: 99n, valid: 5000 });
  const r = await call('GET', `me?guild=${G1}`, { user: MEMBER });
  assert.equal(r.body.guild.valid, 90); assert.equal(r.body.guild.accuracy, 90); assert.equal(r.body.total, null);
  assert.equal((await call('GET', 'me?guild=zzz', { user: MEMBER })).status, 400);
});

test('server manager: lists only their server and every change is a request to the bot', async () => {
  const db = fresh(); await seed(db);
  const bot = startBot(db);
  state.guilds = [];
  assert.equal((await call('GET', `guilds/${G1}/games`, { user: MEMBER })).status, 403);              // no Manage Server
  state.guilds = [{ id: G1, owner: false, permissions: '32' }];
  assert.equal((await call('GET', `guilds/${G2}/games`, { user: MANAGER })).status, 403);
  const list = await call('GET', `guilds/${G1}/games`, { user: MANAGER });
  assert.equal(list.status, 200);
  assert.deepEqual(list.body.games.map((g) => g.channel_id).sort(), [C1, C2].sort());
  assert.ok(list.body.games[0].cfg, 'managers see the settings');

  assert.equal((await call('POST', `guilds/${G1}/games`, { user: MANAGER, body: { channel_id: 'x', mode: 'classic' } })).status, 400);
  assert.equal((await call('POST', `guilds/${G1}/games`, { user: MANAGER, body: { channel_id: C3, mode: 'rm -rf' } })).status, 400);
  const made = await call('POST', `guilds/${G1}/games`, { user: MANAGER, body: { channel_id: C3, mode: 'roman', name: 'Romans', config: { rules: { math: false } } } });
  assert.equal(made.status, 200, JSON.stringify(made.body));
  const asked = bot.asked.at(-1);
  assert.equal(String(asked.guild_id), G1); assert.equal(String(asked.requested_by), MANAGER);
  assert.deepEqual([asked.payload.action, asked.payload.mode, asked.payload.name], ['create_game', 'roman', 'Romans']);
  assert.deepEqual(asked.payload.config, { rules: { math: false } });

  const patch = await call('PATCH', `guilds/${G1}/games/${C1}`, { user: MANAGER, body: { config: { rules: { solo: true } } } });
  assert.equal(patch.status, 200);
  assert.equal(bot.asked.at(-1).payload.action, 'update_game');
  assert.equal((await call('PATCH', `guilds/${G1}/games/${C3}`, { user: MANAGER, body: {} })).status, 404);          // C3 belongs to G2
  db.collection('module_requests').docs.length = 0;                      // the per-server limit is tested on its own below
  for (const action of ['reset', 'pause', 'resume', 'archive', 'grant_save']) {
    assert.equal((await call('POST', `guilds/${G1}/games/${C1}/${action}`, { user: MANAGER, body: { amount: 99 } })).status, 200);
    assert.equal(bot.asked.at(-1).payload.action, action);
  }
  assert.equal(bot.asked.at(-1).payload.amount, 10, 'amount is capped');
  assert.equal((await call('POST', `guilds/${G1}/games/${C1}/format`, { user: MANAGER })).status, 404);
  bot.stop();
});

test('server manager: the bot refusing a value comes back as field level errors', async () => {
  const db = fresh(); await seed(db);
  const bot = startBot(db, () => ({ ok: false, errors: [{ field: 'rules.rate_per_min', code: 'out_of_range' }] }));
  const r = await call('PATCH', `guilds/${G1}/games/${C1}`, { user: MANAGER, body: { config: { rules: { rate_per_min: 99999 } } } });
  assert.equal(r.status, 422); assert.equal(r.body.errors[0].field, 'rules.rate_per_min');
  bot.stop();
  const dead = await call('GET', `guilds/${G1}/competitions`, { user: MANAGER });
  assert.equal(dead.status, 200);
});

test('server manager: competitions are scoped to the server', async () => {
  const db = fresh();
  await db.collection('ct_competitions').insertOne({ _id: 'aaaaaaaaaaaa', guild_id: BigInt(G1), name: 'Mine', status: 'active', starts_at: new Date(), ends_at: new Date() });
  await db.collection('ct_competitions').insertOne({ _id: 'bbbbbbbbbbbb', guild_id: BigInt(G2), name: 'Theirs', status: 'active', starts_at: new Date(), ends_at: new Date() });
  const r = await call('GET', `guilds/${G1}/competitions`, { user: MANAGER });
  assert.deepEqual(r.body.competitions.map((c) => c.name), ['Mine']);
  const bot = startBot(db);
  assert.equal((await call('DELETE', `guilds/${G1}/competitions/bbbbbbbbbbbb`, { user: MANAGER })).status, 200);       // the bot decides the owner of the id
  assert.equal(String(bot.asked.at(-1).guild_id), G1, 'the server in the request is the signed in manager server');
  assert.equal((await call('DELETE', `guilds/${G1}/competitions/not-an-id`, { user: MANAGER })).status, 404);
  bot.stop();
});

test('owner: only the owner writes, a delegate reads, others are refused; everything goes to the bot', async () => {
  const db = fresh(); await seed(db);
  const bot = startBot(db);
  assert.equal((await call('PATCH', 'owner/config', { user: DELEGATE, body: { enabled: false } })).status, 403);
  assert.equal((await call('GET', 'owner/overview', { user: MANAGER })).status, 403);
  const ov = await call('GET', 'owner/overview', { user: DELEGATE });
  assert.deepEqual([ov.body.games, ov.body.active, ov.body.total_valid, ov.body.highest], [4, 3, 2400, 150]);
  assert.equal((await call('PATCH', 'owner/config', { user: OWNER, body: { limits: { max_saves: 5 } } })).status, 200);
  assert.deepEqual(bot.asked.at(-1).payload, { action: 'owner_global', patch: { limits: { max_saves: 5 } } });
  assert.equal(String(bot.asked.at(-1).requested_by), OWNER);
  assert.equal((await call('POST', 'owner/defs', { user: OWNER, body: { kind: 'weapon', id: 'x' } })).status, 400);
  assert.equal((await call('POST', 'owner/defs', { user: OWNER, body: { kind: 'badge', id: 'night_owl', name: 'Night Owl' } })).status, 200);
  assert.equal((await call('DELETE', 'owner/defs/badge/night_owl', { user: OWNER })).status, 200);
  assert.equal(bot.asked.at(-1).payload.action, 'owner_def_delete');
  assert.equal((await call('DELETE', 'owner/defs/badge/Bad%20Id', { user: OWNER })).status, 404);
  assert.equal((await call('POST', 'owner/seasons', { user: OWNER, body: { name: 'S1' } })).status, 200);
  assert.equal((await call('POST', 'owner/seasons/not-an-id/pause', { user: OWNER })).status, 404);
  assert.equal((await call('POST', 'owner/seasons/aaaaaaaaaaaa/pause', { user: OWNER })).status, 200);
  assert.equal(bot.asked.at(-1).payload.status, 'paused');
  const force = await call('POST', `owner/games/${C3}/pause`, { user: OWNER });
  assert.equal(force.status, 200);
  assert.equal(String(bot.asked.at(-1).guild_id), G2, 'the owner action is addressed to the server that owns the game');
  assert.equal((await call('POST', `owner/games/${C1}/delete`, { user: OWNER })).status, 404);
  bot.stop();
});

test('owner: reads of definitions, stats and the audit log', async () => {
  const db = fresh();
  await db.collection('ct_defs').insertOne({ _id: 'd1', kind: 'badge', id: 'first', name: 'First', scope: 'global', enabled: true });
  await db.collection('ct_defs').insertOne({ _id: 'd2', kind: 'challenge', id: 'ch', name: 'Ch', scope: 'global', enabled: true });
  assert.equal((await call('GET', 'owner/defs?kind=badge', { user: DELEGATE })).body.defs.length, 1);
  assert.equal((await call('GET', 'owner/defs?kind=zzz', { user: DELEGATE })).status, 400);
  const day = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  await db.collection('ct_daily').insertOne({ channel_id: 1n, day, valid: 5, errors: 1 });
  await db.collection('ct_daily').insertOne({ channel_id: 2n, day, valid: 7, errors: 0 });
  const st = await call('GET', 'owner/stats', { user: OWNER });
  assert.deepEqual(st.body.daily, [{ day, valid: 12, errors: 1 }]);
  await db.collection('ct_audit').insertOne({ at: new Date(), actor: 1n, action: 'global.update', target: 'config', changes: {}, result: 'ok' });
  assert.equal((await call('GET', 'owner/audit', { user: OWNER })).body.rows[0].action, 'global.update');
});

test('bot requests are limited per server so a click storm cannot flood the queue', async () => {
  const db = fresh(); await seed(db);
  const bot = startBot(db);
  let limited = 0;
  for (let i = 0; i < 16; i += 1) {
    const r = await call('POST', `guilds/${G1}/games/${C1}/pause`, { user: MANAGER, body: {} });
    if (r.status === 429) limited += 1;
  }
  bot.stop();
  assert.ok(limited >= 1 && limited < 16);
});

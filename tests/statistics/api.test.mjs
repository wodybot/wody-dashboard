// Statistics API tests: the real lib/statistics code on an in-memory database, a stand-in session and a fake bot that records what it was asked.
import test from 'node:test';
import assert from 'node:assert/strict';

const { state } = await import('../battlepass/stubs/state.mjs');
const { makeDb } = await import('../battlepass/fake-db.mjs');
const { handle, cleanPatch, periodOf } = await import('../../lib/statistics/api.js');

const MANAGER = '2000000000000000001'; const MEMBER = '3000000000000000001';
const G1 = '4000000000000000001'; const G2 = '4000000000000000002';
const C1 = '5000000000000000001'; const C2 = '5000000000000000002';

function fresh() {
  state.db = makeDb(); state.session = null; state.delegates = new Set(); state.blocked = new Set();
  state.guilds = [{ id: G1, owner: false, permissions: '32' }, { id: G2, owner: false, permissions: '0' }];
  return state.db;
}
async function call(method, path, { body, user = MANAGER, origin = 'https://wody.test' } = {}) {
  state.session = user ? { user: { id: user }, accessToken: 'token' } : null;
  const url = new URL(`https://wody.test/api/statistics/${path}`);
  const request = new Request(url, { method, headers: { origin, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const res = await handle({ request, db: state.db, parts: path.split('?')[0].split('/').filter(Boolean), method });
  const isPdf = (res.headers.get('content-type') || '').includes('pdf');
  return { status: res.status, headers: res.headers, body: isPdf ? Buffer.from(await res.arrayBuffer()) : await res.json() };
}
function startBot(db, answer = () => ({ ok: true })) {
  const asked = [];
  const timer = setInterval(async () => {
    const col = db.collection('module_requests');
    const pending = await col.find({ status: 'pending' }).toArray();
    for (const doc of pending) {
      if (!['stats_query', 'stats_action'].includes(doc.kind)) continue;
      asked.push(doc);
      const result = await answer(doc);
      if (result && result.__fail) await col.updateOne({ _id: doc._id }, { $set: { status: 'failed', error_code: result.__fail } });
      else await col.updateOne({ _id: doc._id }, { $set: { status: 'done', result } });
    }
  }, 15);
  return { asked, stop: () => clearInterval(timer) };
}

test('access: signed out, blocked, cross-site writes, other servers and members without Manage Server are refused', async () => {
  fresh();
  assert.equal((await call('GET', `guilds/${G1}/settings`, { user: null })).status, 401);
  assert.equal((await call('PATCH', `guilds/${G1}/settings`, { body: { enabled: true }, origin: 'https://evil.test' })).status, 403);
  assert.equal((await call('GET', `guilds/${G2}/settings`)).status, 403);           // a server where the member cannot manage
  assert.equal((await call('GET', 'guilds/123/settings')).status, 400);              // not a snowflake
  assert.equal((await call('GET', `guilds/${'9'.repeat(18)}/settings`)).status, 403);
  state.blocked.add(MEMBER);
  assert.equal((await call('GET', `guilds/${G1}/settings`, { user: MEMBER })).body.error, 'account_blocked');
  assert.equal((await call('GET', 'public/summary')).status, 404);                   // there is nothing public
  assert.equal((await call('DELETE', `guilds/${G1}/settings`)).status, 405);
});

test('settings are read straight from the database and the salt never leaves it', async () => {
  const db = fresh();
  let r = await call('GET', `guilds/${G1}/settings`);
  assert.equal(r.body.settings.enabled, false);
  assert.equal(r.body.settings.configured, false);
  assert.equal(r.body.settings.retention_days, 90);
  await db.collection('stats_settings').insertOne({ _id: BigInt(G1), enabled: true, retention_days: 120, access: 'everyone', excluded_channels: [C1], excluded_categories: [], tz_offset: 2,
    thresholds: { very_active: 80, active: 20, moderate: 4, low: 0.5 }, coverage: [[20261001, null]], salt: 'deadbeefdeadbeefdeadbeefdeadbeef' });
  r = await call('GET', `guilds/${G1}/settings`);
  assert.deepEqual([r.body.settings.enabled, r.body.settings.retention_days, r.body.settings.access, r.body.settings.tz_offset], [true, 120, 'everyone', 2]);
  assert.deepEqual(r.body.settings.excluded_channels, [C1]);
  assert.equal(r.body.settings.collecting_since, 20261001);
  assert.ok(!JSON.stringify(r.body).includes('deadbeef') && !('salt' in r.body.settings));
});

test('changing settings: the patch is checked here and again by the bot, and the bot decides', async () => {
  const db = fresh();
  const bot = startBot(db, (doc) => (doc.payload.patch.retention_days === 31 ? { ok: false, error: 'out_of_range', settings: {} } : { ok: true, settings: { enabled: true } }));
  try {
    const ok = await call('PATCH', `guilds/${G1}/settings`, { body: { enabled: true, retention_days: 60, tz_offset: -5, access: 'everyone', excluded_channels: [C1, C2] } });
    assert.equal(ok.status, 200);
    assert.equal(bot.asked.at(-1).kind, 'stats_action');
    assert.equal(bot.asked.at(-1).payload.action, 'settings');
    assert.deepEqual(bot.asked.at(-1).payload.patch.excluded_channels, [C1, C2]);
    assert.equal(String(bot.asked.at(-1).requested_by), MANAGER);
    const refused = await call('PATCH', `guilds/${G1}/settings`, { body: { retention_days: 31 } });
    assert.equal(refused.status, 422); assert.equal(refused.body.code, 'out_of_range');
    const before = bot.asked.length;
    for (const body of [{}, { enabled: 'yes' }, { retention_days: 10 }, { retention_days: 400 }, { retention_days: 45.5 }, { access: 'nobody' }, { tz_offset: 15 }, { excluded_channels: ['abc'] },
      { excluded_channels: Array(101).fill(C1) }, { thresholds: { very_active: 1 } }, { thresholds: { very_active: -1, active: 1, moderate: 1, low: 1 } }, { salt: 'x' }, { enabled: true, unknown: 1 }]) {
      assert.equal((await call('PATCH', `guilds/${G1}/settings`, { body })).status, 400, JSON.stringify(body));
    }
    assert.equal(bot.asked.length, before, 'nothing invalid reaches the bot');
  } finally { bot.stop(); }
});

test('the analysis, history, channel list and comparison are relayed with a validated period', async () => {
  const db = fresh();
  const bot = startBot(db, (doc) => ({ ok: true, kind: doc.payload.kind, echo: doc.payload }));
  try {
    let r = await call('GET', `guilds/${G1}/overview?days=7&back=1`);
    assert.equal(r.status, 200); assert.deepEqual([bot.asked.at(-1).kind, bot.asked.at(-1).payload.kind, bot.asked.at(-1).payload.days, bot.asked.at(-1).payload.back], ['stats_query', 'overview', 7, 1]);
    r = await call('GET', `guilds/${G1}/overview?first=2026-10-01&last=2026-10-20`);
    assert.equal(r.status, 200); assert.equal(bot.asked.at(-1).payload.first, '2026-10-01');
    for (const q of ['days=5', 'days=30&back=13', 'days=30&back=-1', 'first=2026-10-20&last=2026-10-01', 'first=2026-13-01&last=2026-14-01', 'first=2026-10-01']) {
      assert.equal((await call('GET', `guilds/${G1}/overview?${q}`)).status, 400, q);
    }
    r = await call('GET', `guilds/${G1}/history?weeks=26`);
    assert.equal(r.status, 200); assert.equal(bot.asked.at(-1).payload.weeks, 26);
    assert.equal((await call('GET', `guilds/${G1}/history?weeks=7`)).status, 400);
    assert.equal((await call('GET', `guilds/${G1}/channels`)).status, 200);
    r = await call('GET', `guilds/${G1}/compare?days=30&channels=${C1},${C2}`);
    assert.equal(r.status, 200); assert.deepEqual(bot.asked.at(-1).payload.channels, [C1, C2]);
    assert.equal((await call('GET', `guilds/${G1}/compare?days=30&channels=${C1}`)).status, 400);
    assert.equal((await call('GET', `guilds/${G1}/compare?days=30&channels=${C1},x`)).status, 400);
    assert.equal((await call('GET', `guilds/${G1}/compare?days=30&channels=${[C1, C2, C1, C2, C1, C2].join(',')}`)).status, 400);
  } finally { bot.stop(); }
});

test('bot problems become clear statuses: not in the server, forbidden, unreachable', async () => {
  const db = fresh();
  const bot = startBot(db, () => ({ __fail: 'guild_unavailable' }));
  try {
    const r = await call('GET', `guilds/${G1}/overview?days=30`);
    assert.equal(r.status, 409); assert.equal(r.body.error, 'guild_unavailable');
  } finally { bot.stop(); }
  const b2 = startBot(db, () => ({ __fail: 'forbidden' }));
  try { assert.equal((await call('PATCH', `guilds/${G1}/settings`, { body: { enabled: true } })).status, 403); } finally { b2.stop(); }
});

test('without a bot the request times out as bot_unreachable and leaves nothing queued', async () => {
  const db = fresh();
  const started = Date.now();
  const { askBot } = await import('../../lib/statistics/store.js');
  const res = await askBot(db, { kind: 'stats_query', guildId: G1, userId: MANAGER, payload: { kind: 'overview' }, waitMs: 120 });
  assert.equal(res.error, 'bot_unreachable'); assert.ok(Date.now() - started < 2000);
  assert.equal(await db.collection('module_requests').countDocuments({ status: 'pending' }), 0);
});

test('a burst of requests is limited before it floods the bot queue', async () => {
  const db = fresh();
  const { askBot } = await import('../../lib/statistics/store.js');
  const bot = startBot(db);
  try {
    const answers = [];
    for (let i = 0; i < 6; i += 1) answers.push((await askBot(db, { kind: 'stats_action', guildId: G1, userId: MANAGER, payload: {}, burst: 3 })).error || 'ok');
    assert.deepEqual(answers, ['ok', 'ok', 'ok', 'rate_limited', 'rate_limited', 'rate_limited']);
  } finally { bot.stop(); }
});

test('the PDF report is relayed as a download and the file name is sanitised', async () => {
  const db = fresh();
  const pdf = Buffer.from('%PDF-1.4 test').toString('base64');
  const bot = startBot(db, (doc) => ({ ok: true, filename: doc.payload.days === 7 ? '../../evil name.pdf' : 'wody-statistics-1.pdf', pdf_b64: pdf }));
  try {
    const r = await call('POST', `guilds/${G1}/report`, { body: { days: 30 } });
    assert.equal(r.status, 200);
    assert.equal(r.headers.get('content-type'), 'application/pdf');
    assert.match(r.headers.get('content-disposition'), /attachment; filename="wody-statistics-1\.pdf"/);
    assert.equal(r.body.subarray(0, 5).toString(), '%PDF-');
    const odd = await call('POST', `guilds/${G1}/report`, { body: { days: 7 } });
    assert.match(odd.headers.get('content-disposition'), /filename="wody-statistics\.pdf"/);
    assert.equal((await call('POST', `guilds/${G1}/report`, { body: { days: 31 } })).status, 400);
    assert.equal((await call('POST', `guilds/${G1}/report`, { body: { days: 30 }, origin: 'https://evil.test' })).status, 403);
  } finally { bot.stop(); }
});

test('deleting the data needs an explicit confirmation', async () => {
  const db = fresh();
  const bot = startBot(db, () => ({ ok: true, deleted: 12 }));
  try {
    assert.equal((await call('POST', `guilds/${G1}/purge`, { body: {} })).body.error, 'confirm_required');
    assert.equal((await call('POST', `guilds/${G1}/purge`, { body: { confirm: 'true' } })).status, 400);
    assert.equal(bot.asked.length, 0);
    const r = await call('POST', `guilds/${G1}/purge`, { body: { confirm: true } });
    assert.equal(r.status, 200); assert.equal(r.body.deleted, 12);
    assert.equal(bot.asked[0].payload.action, 'purge');
  } finally { bot.stop(); }
});

test('helpers: periodOf and cleanPatch on their own', () => {
  assert.deepEqual(periodOf(new URL('https://x.test/?days=90')), { days: 90, back: 0 });
  assert.equal(periodOf(new URL('https://x.test/?days=1')), null);
  assert.deepEqual(cleanPatch({ enabled: false }), { enabled: false });
  assert.equal(cleanPatch(null), null);
  assert.equal(cleanPatch([]), null);
});

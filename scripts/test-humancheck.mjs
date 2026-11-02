// Run: SESSION_SECRET=anything-long node scripts/test-humancheck.mjs
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import * as H from '../lib/humancheck.js';
import { buildPuzzle } from '../lib/humancheck-shapes.js';

process.env.SESSION_SECRET ||= 'test-secret-1234567890';
const used = new Set();
const db = { collection: () => ({
  createIndex: async () => {},
  insertOne: async (d) => { if (used.has(d._id)) { const e = new Error('dup'); e.code = 11000; throw e; } used.add(d._id); },
}) };
const human = { how: 'pointer', trusted: true, moves: 22, path: 400, lead: 1200, press: 90, shown: 3000, langs: 2, sw: 1200, sh: 800, focus: true, visible: true, soft: false, webdriver: false };
const solve = (tok, bits) => { let n = 0; while (!H.proofOk(tok, n, bits)) n += 1; return n; };
const aged = (c) => { // make the challenge look old enough
  const p = JSON.parse(Buffer.from(c.token.split('.')[0], 'base64url')); return p; };
let ok = 0; const t = async (name, fn) => { await fn(); ok += 1; console.log('ok', name); };

await t('person passes with a pass token', async () => {
  const c = H.startChallenge('collab_contact', 'g1:u1');
  const body = { token: c.token, nonce: solve(c.token, c.difficulty), signals: human };
  // too fast right after issue
  assert.equal((await H.checkTick(db, body, async () => ({}))).reason, 'too_fast');
  await new Promise((r) => setTimeout(r, 950));
  const r = await H.checkTick(db, body, async () => ({}));
  assert.equal(r.status, 'pass');
  assert.equal(await H.consumePass(db, r.pass, 'collab_contact', 'g1:u1'), true);
  assert.equal(await H.consumePass(db, r.pass, 'collab_contact', 'g1:u1'), false, 'pass is single use');
});
await t('pass is bound to purpose and context', async () => {
  const c = H.startChallenge('collab_apply', 'req1');
  await new Promise((r) => setTimeout(r, 950));
  const r = await H.checkTick(db, { token: c.token, nonce: solve(c.token, c.difficulty), signals: human }, async () => ({}));
  assert.equal(await H.consumePass(db, r.pass, 'collab_message', 'req1'), false);
  assert.equal(await H.consumePass(db, r.pass, 'collab_apply', 'req2'), false);
  assert.equal(await H.consumePass(db, r.pass, 'collab_apply', 'req1'), true);
});
await t('challenge cannot be replayed', async () => {
  const c = H.startChallenge('collab_contact', 'x');
  await new Promise((r) => setTimeout(r, 950));
  const body = { token: c.token, nonce: solve(c.token, c.difficulty), signals: human };
  assert.equal((await H.checkTick(db, body, async () => ({}))).status, 'pass');
  assert.equal((await H.checkTick(db, body, async () => ({}))).reason, 'replayed');
});
await t('wrong proof of work and forged tokens are refused', async () => {
  const c = H.startChallenge('verify', 'x');
  await new Promise((r) => setTimeout(r, 950));
  assert.equal((await H.checkTick(db, { token: c.token, nonce: '1', signals: human }, async () => ({}))).reason, 'proof');
  const forged = c.token.replace(/.$/, (ch) => (ch === 'A' ? 'B' : 'A'));
  assert.equal((await H.checkTick(db, { token: forged, nonce: '1', signals: human }, async () => ({}))).reason, 'invalid');
  assert.equal(await H.consumePass(db, 'garbage', 'verify', 'x'), false);
  assert.equal(H.startChallenge('nope', 'x'), null);
});
await t('scripted clicks are denied, doubtful ones get a puzzle', async () => {
  assert.equal(H.decide({ ...human, trusted: false }, 3000).verdict, 'deny');
  assert.equal(H.decide({ how: 'none' }, 3000).verdict, 'deny');
  assert.equal(H.decide({ ...human, webdriver: true, moves: 0, path: 0, lead: 0, press: 5 }, 3000).verdict, 'deny');
  const mid = H.decide({ how: 'pointer', trusted: true, moves: 0, path: 0, lead: 0, press: 80, shown: 2000, langs: 1, sw: 1000, sh: 800, focus: true, visible: true }, 3000);
  assert.equal(mid.verdict, 'puzzle');
  assert.equal(H.decide({ how: 'key', trusted: true, press: 80, shown: 3000, langs: 1, sw: 1000, sh: 800, focus: true, visible: true }, 3000).verdict, 'pass');
  assert.equal(H.decide({ how: 'touch', trusted: true, press: 90, moves: 1, mobile: true, shown: 3000, langs: 1, sw: 400, sh: 800, focus: true, visible: true }, 3000).verdict, 'pass');
});
const masks = new Map();
const maker = async (c, r, n) => { const spec = H.newPuzzleSpec(); const token = H.sealPuzzle(c, spec.mask, r, n); masks.set(token, spec.mask); return { token, round: r + 1, total: n }; };
const rightPicks = (token) => [...masks.get(token)].map((ch, i) => (ch === '1' ? i : -1)).filter((i) => i >= 0);
const wrongPicks = (token) => [...masks.get(token)].map((ch, i) => (ch === '0' ? i : -1)).filter((i) => i >= 0);
const pause = (ms) => new Promise((r) => setTimeout(r, ms));

await t('verification page: heavy proof of work and exactly one puzzle, even after a clean tick', async () => {
  const c = H.startChallenge('verify', 'g:u');
  assert.ok(c.difficulty >= 18);
  await pause(950);
  let r = await H.checkTick(db, { token: c.token, nonce: solve(c.token, c.difficulty), signals: human }, maker);
  assert.equal(r.status, 'puzzle'); assert.equal(r.puzzle.total, 1); assert.equal(r.puzzle.round, 1);
  assert.equal((await H.checkPuzzle(db, { token: r.puzzle.token, picks: [] }, maker)).reason, 'too_fast');
  await pause(2600);
  const tok = r.puzzle.token;
  r = await H.checkPuzzle(db, { token: tok, picks: rightPicks(tok) }, maker);
  assert.equal(r.status, 'pass');
  assert.equal(await H.consumePass(db, r.pass, 'verify', 'g:u'), true);
  assert.equal(await H.consumePass(db, r.pass, 'verify', 'g:u'), false);
  assert.equal((await H.checkPuzzle(db, { token: tok, picks: rightPicks(tok) }, maker)).reason, 'replayed');
});
await t('a wrong answer ends the attempt and the puzzle cannot be retried', async () => {
  const c = H.startChallenge('verify', 'g:u2'); await pause(950);
  const r = await H.checkTick(db, { token: c.token, nonce: solve(c.token, c.difficulty), signals: human }, maker);
  await pause(2600);
  const tok = r.puzzle.token;
  const bad = await H.checkPuzzle(db, { token: tok, picks: wrongPicks(tok) }, maker);
  assert.equal(bad.reason, 'wrong'); assert.ok(!bad.pass && !bad.puzzle);
  assert.equal((await H.checkPuzzle(db, { token: tok, picks: rightPicks(tok) }, maker)).reason, 'replayed');
});
await t('a puzzle answer is bound to its own challenge (another page cannot use it)', async () => {
  const c = H.startChallenge('verify', 'g:u3'); await pause(950);
  const r = await H.checkTick(db, { token: c.token, nonce: solve(c.token, c.difficulty), signals: human }, maker);
  await pause(2600);
  const out = await H.checkPuzzle(db, { token: r.puzzle.token, picks: rightPicks(r.puzzle.token) }, maker);
  assert.equal(out.status, 'pass');
  assert.equal(await H.consumePass(db, out.pass, 'verify', 'g:other'), false);
});
await t('doubtful tick on the verification page also gets one puzzle', async () => {
  const c = H.startChallenge('verify', 'g:u4'); await pause(950);
  const doubt = { how: 'pointer', trusted: true, moves: 0, path: 0, lead: 0, press: 80, shown: 2000, langs: 1, sw: 1000, sh: 800, focus: true, visible: true };
  const r = await H.checkTick(db, { token: c.token, nonce: solve(c.token, c.difficulty), signals: doubt }, maker);
  assert.equal(r.puzzle.total, 1);
});
await t('puzzle data never contains the answer or shape names, and every outline has the same point count', async () => {
  const p = buildPuzzle({ id: 'a', p: 'verify', x: 'y' }, 0, 3);
  const s = JSON.stringify(p);
  for (const w of H.SHAPES) assert.ok(!s.includes(w), w);
  assert.ok(!('mask' in p));
  assert.equal(p.tiles.length, 9);
  const counts = new Set([p.sample.d, ...p.tiles.map((x) => x.d)].map((d) => d.split('L').length));
  assert.equal(counts.size, 1);
});
console.log(`${ok} tests passed`);

// Wody Human Check: the "I'm not a robot" system of the site, written for Wody and nothing else.
//
// What it does, in order, every time a visitor ticks the box:
//   1. The server hands out a signed, short lived challenge (stateless: an HMAC signed token, nothing is stored yet).
//   2. The browser solves a small proof of work (a SHA-256 search). One person never notices it, a script that
//      fires thousands of requests pays for every single one of them.
//   3. The browser also sends how the tick happened (pointer path, press time, keyboard, timing, a few browser
//      facts). The server scores it. These values are used for the score only and are never stored.
//   4. A clear pass gets a one-use pass token. A doubtful result gets a picture puzzle (rendered by the server,
//      the answer never leaves the server). A clear failure gets a new challenge.
//   5. The page that is being protected (verify, contact, apply, message) spends the pass token ONCE, bound to its
//      own purpose and context, so a token for one form can never open another.
//
// Nothing here uses a cookie, local storage, session storage, an IP address or any other site. All state is in the
// signed tokens and in short lived one-use records in our own database (they expire on their own).
import crypto from 'crypto';

export const PURPOSES = Object.freeze(['verify', 'collab_contact', 'collab_apply', 'collab_message']);

const CHALLENGE_TTL_MS = 5 * 60_000;
const PASS_TTL_MS = 5 * 60_000;
const PUZZLE_TTL_MS = 3 * 60_000;
export const MIN_TICK_MS = 900;          // from the moment the challenge was issued to the tick
export const MIN_PUZZLE_MS = 1500;       // from the moment the puzzle was issued to the answer
export const DIFFICULTY_BITS = 15;       // about 32 thousand hashes on average, a fraction of a second

// Settings per purpose. The member verification page is the strict one: a much heavier proof of work and one
// picture puzzle that must be answered right (always, even after a clean tick). The Collab forms
// stay light, a person writing a message should not be put through a long test every time.
export const SETTINGS = Object.freeze({
  verify: { bits: 18, roundsClean: 1, roundsDoubt: 1, minPuzzleMs: 2500 },
});
const settingsOf = (purpose) => SETTINGS[purpose] || { bits: DIFFICULTY_BITS, roundsClean: 0, roundsDoubt: 1, minPuzzleMs: MIN_PUZZLE_MS };

const SCORE_PASS = 60;                   // at or above: passed at once
const SCORE_PUZZLE = 20;                 // between this and the pass line: a puzzle; below: try again

function secret() {
  const s = process.env.HUMANCHECK_SECRET || process.env.SESSION_SECRET || '';
  if (s.length < 8) throw new Error('humancheck_no_secret');
  return s;
}
const b64 = (v) => Buffer.from(v).toString('base64url');
const mac = (data) => crypto.createHmac('sha256', secret()).update(data).digest('base64url');
const rid = (n = 12) => crypto.randomBytes(n).toString('base64url');

function seal(payload) {
  const p = b64(JSON.stringify(payload));
  return `${p}.${mac(`hc1:${p}`)}`;
}

function open(token) {
  if (typeof token !== 'string' || token.length > 1500) return null;
  const parts = token.split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  const want = Buffer.from(mac(`hc1:${parts[0]}`));
  const got = Buffer.from(parts[1]);
  if (want.length !== got.length || !crypto.timingSafeEqual(want, got)) return null;
  try {
    const o = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
    return o && typeof o === 'object' && !Array.isArray(o) ? o : null;
  } catch { return null; }
}

export const ctxHash = (ctx) => crypto.createHash('sha256').update(`ctx:${String(ctx ?? '')}`).digest('base64url').slice(0, 16);

// -------------------------------------------------------------------------------------------- challenge
export function startChallenge(purpose, ctx) {
  if (!PURPOSES.includes(purpose)) return null;
  const iat = Date.now();
  const token = seal({ k: 'c', id: rid(), p: purpose, x: ctxHash(ctx), iat, exp: iat + CHALLENGE_TTL_MS, d: settingsOf(purpose).bits, s: rid(6) });
  return { token, difficulty: settingsOf(purpose).bits, ttl: CHALLENGE_TTL_MS };
}

export function leadingZeroBits(buf) {
  let bits = 0;
  for (const byte of buf) {
    if (byte === 0) { bits += 8; continue; }
    bits += Math.clz32(byte) - 24;
    break;
  }
  return bits;
}

export function proofOk(token, nonce, bits) {
  if (!/^\d{1,12}$/.test(String(nonce))) return false;
  const h = crypto.createHash('sha256').update(`${token}:${nonce}`).digest();
  return leadingZeroBits(h) >= bits;
}

// -------------------------------------------------------------------------------------------- scoring
const num = (v, min, max) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : 0;
};

// Returns { score, hard } where hard means "never a person" (an untrusted, synthetic click).
export function scoreSignals(raw, elapsedMs) {
  const s = raw && typeof raw === 'object' ? raw : {};
  const how = ['pointer', 'touch', 'key'].includes(s.how) ? s.how : 'none';
  let score = 45;
  let hard = false;

  if (s.trusted !== true) { hard = true; score -= 100; }                 // dispatched by a script, not by a person
  if (s.webdriver === true) score -= 60;                                   // an automation flag of the browser
  if (s.focus === false) score -= 25;
  if (s.visible === false) score -= 40;

  const moves = num(s.moves, 0, 500);
  const path = num(s.path, 0, 100000);
  const lead = num(s.lead, 0, 600000);      // ms from the first pointer movement to the tick
  const press = num(s.press, 0, 60000);     // ms the pointer or key was held
  const shown = num(s.shown, 0, 3600000);   // ms the box was on screen before the tick

  if (how === 'pointer') {
    if (moves >= 6) score += 18; else if (moves >= 2) score += 6; else score -= 30;
    if (path >= 25) score += 6;
    if (lead >= 250 && lead <= 15000) score += 8;
    if (press >= 35 && press <= 600) score += 12; else score -= 12;
    if (s.centered === true) score -= 10;                                  // always the exact middle of the box
  } else if (how === 'touch') {
    if (press >= 25 && press <= 800) score += 15; else score -= 12;
    if (moves >= 1) score += 5;
    if (s.mobile === true) score += 8; else score -= 10;                  // a touch tick on a machine that is not a touch device
  } else if (how === 'key') {
    if (press >= 20 && press <= 1500) score += 12; else score -= 8;
    if (shown >= 1200) score += 10;
    score += 10;                                                           // keyboard use is a normal way to use the box
  } else {
    score -= 40;
  }

  if (shown < 700) score -= 25; else if (shown >= 1500) score += 6;
  if (elapsedMs < 1400) score -= 8;

  const langs = num(s.langs, 0, 50);
  if (langs === 0) score -= 15;
  if (s.sw === 0 || s.sh === 0) score -= 40;
  if (s.soft === true) score -= 15;                                        // software rendering typical of headless browsers
  if (s.cores === 0) score -= 5;
  return { score: Math.round(score), hard };
}

export function decide(raw, elapsedMs) {
  const { score, hard } = scoreSignals(raw, elapsedMs);
  if (hard) return { verdict: 'deny', score };
  if (score >= SCORE_PASS) return { verdict: 'pass', score };
  if (score >= SCORE_PUZZLE) return { verdict: 'puzzle', score };
  return { verdict: 'deny', score };
}

// -------------------------------------------------------------------------------------------- one-use ledger
async function markUsed(db, key, ttlMs) {
  try {
    await db.collection('humancheck_used').insertOne({ _id: key, expires_at: new Date(Date.now() + ttlMs) });
    return true;
  } catch (e) {
    if (e?.code === 11000) return false;
    throw e;
  }
}

let indexed = false;
export async function ensureIndex(db) {
  if (indexed) return;
  indexed = true;
  try { await db.collection('humancheck_used').createIndex({ expires_at: 1 }, { expireAfterSeconds: 0 }); } catch { /* the records are also ignored once old */ }
}

export function issuePass(payload, score) {
  const iat = Date.now();
  return seal({ k: 'p', id: payload.id, p: payload.p, x: payload.x, iat, exp: iat + PASS_TTL_MS, sc: score });
}

// -------------------------------------------------------------------------------------------- check
// body: { token, nonce, signals }  ->  { status: 'pass', pass } | { status: 'puzzle', ... } | { status: 'retry', reason }
export async function checkTick(db, body, makePuzzle) {
  const c = open(body?.token);
  if (!c || c.k !== 'c' || !PURPOSES.includes(c.p)) return { status: 'retry', reason: 'invalid' };
  const now = Date.now();
  if (now > c.exp) return { status: 'retry', reason: 'expired' };
  const elapsed = now - c.iat;
  if (elapsed < MIN_TICK_MS) return { status: 'retry', reason: 'too_fast' };
  if (!proofOk(body.token, body.nonce, Number(c.d) || DIFFICULTY_BITS)) return { status: 'retry', reason: 'proof' };
  await ensureIndex(db);
  if (!(await markUsed(db, `c:${c.id}`, CHALLENGE_TTL_MS + 60_000))) return { status: 'retry', reason: 'replayed' };

  const d = decide(body.signals, elapsed);
  if (d.verdict === 'deny') return { status: 'retry', reason: 'denied' };
  const cfg = settingsOf(c.p);
  const rounds = d.verdict === 'pass' ? cfg.roundsClean : cfg.roundsDoubt;
  if (rounds > 0) return { status: 'puzzle', puzzle: await makePuzzle({ id: c.id, p: c.p, x: c.x }, 0, rounds) };
  return { status: 'pass', pass: issuePass(c, d.score) };
}

// -------------------------------------------------------------------------------------------- puzzle
export const SHAPES = Object.freeze(['circle', 'triangle', 'square', 'pentagon', 'star', 'cross']);

// The server-side description of one puzzle. `mask` is which of the nine tiles show the target shape.
export function newPuzzleSpec() {
  const target = SHAPES[crypto.randomInt(SHAPES.length)];
  // square and pentagon are hard to tell apart once jittered, so they are never used as each other's decoy:
  // one puzzle has to be fair for a person at first sight.
  const twin = { square: 'pentagon', pentagon: 'square' }[target];
  const others = SHAPES.filter((x) => x !== target && x !== twin);
  const correct = new Set();
  const want = 3 + crypto.randomInt(2);
  while (correct.size < want) correct.add(crypto.randomInt(9));
  const tiles = [];
  for (let i = 0; i < 9; i += 1) {
    tiles.push({
      shape: correct.has(i) ? target : others[crypto.randomInt(others.length)],
      hue: crypto.randomInt(360), rot: crypto.randomInt(360), size: 34 + crypto.randomInt(14),
      dx: crypto.randomInt(-9, 10), dy: crypto.randomInt(-9, 10), seed: crypto.randomInt(1 << 30),
    });
  }
  const mask = tiles.map((_, i) => (correct.has(i) ? '1' : '0')).join('');
  const sample = { shape: target, hue: crypto.randomInt(360), rot: crypto.randomInt(360), size: 40, dx: 0, dy: 0, seed: crypto.randomInt(1 << 30) };
  return { tiles, sample, mask };
}

export function sealPuzzle(challenge, mask, round = 0, total = 1) {
  const iat = Date.now();
  const id = rid();
  return seal({ k: 'z', id, cid: challenge.id, p: challenge.p, x: challenge.x, r: round, n: total, iat, exp: iat + PUZZLE_TTL_MS, a: mac(`hcp:${id}:${mask}`) });
}

// body: { token, picks: [0..8] }
export async function checkPuzzle(db, body, makePuzzle) {
  const z = open(body?.token);
  if (!z || z.k !== 'z' || !PURPOSES.includes(z.p)) return { status: 'retry', reason: 'invalid' };
  const now = Date.now();
  if (now > z.exp) return { status: 'retry', reason: 'expired' };
  if (now - z.iat < settingsOf(z.p).minPuzzleMs) return { status: 'retry', reason: 'too_fast' };
  const picks = Array.isArray(body.picks) ? body.picks : [];
  if (picks.length > 9 || !picks.every((n) => Number.isInteger(n) && n >= 0 && n < 9)) return { status: 'retry', reason: 'invalid' };
  await ensureIndex(db);
  if (!(await markUsed(db, `z:${z.id}`, PUZZLE_TTL_MS + 60_000))) return { status: 'retry', reason: 'replayed' };   // one attempt per puzzle
  const set = new Set(picks);
  const mask = Array.from({ length: 9 }, (_, i) => (set.has(i) ? '1' : '0')).join('');
  const want = Buffer.from(z.a);
  const got = Buffer.from(mac(`hcp:${z.id}:${mask}`));
  if (want.length !== got.length || !crypto.timingSafeEqual(want, got)) return { status: 'retry', reason: 'wrong' };
  // Right answer. The next round only exists after this one is right, and the pass only after the last round.
  if (z.r + 1 < z.n) return { status: 'puzzle', puzzle: await makePuzzle({ id: z.cid, p: z.p, x: z.x }, z.r + 1, z.n) };
  return { status: 'pass', pass: issuePass({ id: z.cid, p: z.p, x: z.x }, 50) };
}

// -------------------------------------------------------------------------------------------- spending a pass
// Used by the page being protected. `purpose` and `ctx` are what THAT page expects; a pass made for anything else fails.
export async function consumePass(db, pass, purpose, ctx) {
  const p = open(pass);
  if (!p || p.k !== 'p' || p.p !== purpose || p.x !== ctxHash(ctx)) return false;
  if (Date.now() > p.exp) return false;
  try {
    await ensureIndex(db);
    return await markUsed(db, `p:${p.id}`, PASS_TTL_MS + 60_000);
  } catch {
    return false;
  }
}

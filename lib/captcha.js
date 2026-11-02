// FILE: captcha.js
// PUNE ÎN: lib/captcha.js  (fișier nou)
//
// Helpers of the Captcha module (account age, same-origin check). The arithmetic challenge below is no longer used: the verify page now uses the Wody Human Check (lib/humancheck.js).
//
// Why this exists: before it, "verification" meant "you are logged into
// Discord and you are a member of this server". Both of those are true for
// any scripted account too, so the module gated nothing. A self-hosted
// arithmetic challenge is not a replacement for a full CAPTCHA service
// (hCaptcha/Turnstile), and it is not claimed to be: a determined attacker
// who writes a parser for it will pass. What it does stop is the actual
// threat these servers face, generic join-and-grab bots and replayed
// requests, and it does so without shipping visitor data to a third party,
// which keeps the privacy policy accurate.
//
// The challenge is graded SERVER-SIDE only. The browser never receives the
// expected answer, so it cannot be read out of the page source or the
// network response.

import crypto from 'crypto';

// How long a challenge stays valid. Long enough for a real person to read
// and answer it, short enough that a harvested challenge is useless.
export const CHALLENGE_TTL_MS = 5 * 60_000;

// Wrong answers allowed on ONE challenge before it is burned. A person who
// mistypes gets another go; a script guessing at random gets three tries per
// issued challenge instead of unlimited tries against the same question.
export const MAX_CHALLENGE_ATTEMPTS = 3;

// A human has to read the question, move to the field and type. Anything
// faster than this came from something that parsed the DOM. Deliberately
// conservative: this is roughly half the time a fast, prepared human needs,
// so it rejects automation without ever rejecting a real visitor.
export const MIN_SOLVE_MS = 1200;

// Upper bound on how stale a client-reported solve time may be before we
// stop trusting it at all (the challenge TTL already covers the real case;
// this only guards absurd values).
export const MAX_SOLVE_MS = CHALLENGE_TTL_MS;

/**
 * Build one arithmetic question: always plain two-term addition, "a + b".
 *
 * Kept deliberately simple (only addition, never subtraction or
 * multiplication) so it reads identically and stays trivially easy on
 * every device and in every one of the nine languages this page is
 * served in, while still being unpredictable: a and b are each drawn
 * from 1-50, giving 2,500 distinct ordered questions (well over 1,000)
 * since "3 + 41" and "41 + 3" are different question text even though
 * the answer-checking below doesn't care which operand came first.
 */
export function generateChallenge() {
  const a = rnd(1, 50);
  const b = rnd(1, 50);
  return { question: `${a} + ${b}`, answer: a + b };
}

function rnd(min, max) {
  return crypto.randomInt(min, max + 1);
}

export function newChallengeId() {
  return crypto.randomBytes(18).toString('base64url');
}

/**
 * Compare a submitted answer to the expected one.
 *
 * Accepts a string or a number and tolerates surrounding whitespace, but
 * nothing else: an empty field, a non-numeric value or a float never counts
 * as correct.
 */
export function answerMatches(submitted, expected) {
  if (submitted === null || submitted === undefined) return false;
  const raw = String(submitted).trim();
  if (!/^-?\d{1,6}$/.test(raw)) return false;
  return Number(raw) === Number(expected);
}

/**
 * Discord snowflakes embed their creation time, so account age is free to
 * check here: no extra API call, and nothing the client can forge, since the
 * id comes from the server-side session, not from the request body.
 *
 * Brand-new throwaway accounts are the single strongest signal of an
 * automated join wave, but the threshold is opt-in per guild (0 = off) so
 * turning the module on never silently locks out legitimate new Discord
 * users on servers that don't want that.
 */
const DISCORD_EPOCH_MS = 1420070400000;

export function accountCreatedAt(userId) {
  try {
    return new Date(Number(BigInt(String(userId)) >> 22n) + DISCORD_EPOCH_MS);
  } catch {
    return null;
  }
}

export function accountAgeDays(userId) {
  const created = accountCreatedAt(userId);
  if (!created) return null;
  return (Date.now() - created.getTime()) / 86_400_000;
}

/**
 * Same-origin check for the public verification endpoint.
 *
 * The main dashboard API already does this for every mutation
 * (isTrustedOrigin in app/api/[[...path]]/route.js); this endpoint is the
 * one place that grants a Discord role, and it was the only mutating route
 * in the app without the check. SameSite=Lax on the session cookie means a
 * cross-site POST wouldn't carry credentials anyway, so this is
 * defense-in-depth rather than a hole being closed, but the role-granting
 * endpoint should not be the weakest of the two.
 */
export function isTrustedOrigin(request) {
  const origin = request.headers.get('origin');
  if (!origin) return false;
  const base = process.env.NEXT_PUBLIC_BASE_URL;
  if (!base) return true;
  try {
    const normalize = (h) => h.replace(/^www\./, '');
    return normalize(new URL(origin).host) === normalize(new URL(base).host);
  } catch {
    return false;
  }
}

// clientIp() was removed on request: this module (and the verification
// route that uses it) must never read, log or store a visitor's IP address.
// The verify endpoint relies solely on the per-Discord-account rate limit
// for anti-abuse instead.


import crypto from 'crypto';

export const CHALLENGE_TTL_MS = 5 * 60_000;

export const MAX_CHALLENGE_ATTEMPTS = 3;

export const MIN_SOLVE_MS = 1200;

export const MAX_SOLVE_MS = CHALLENGE_TTL_MS;

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

export function answerMatches(submitted, expected) {
  if (submitted === null || submitted === undefined) return false;
  const raw = String(submitted).trim();
  if (!/^-?\d{1,6}$/.test(raw)) return false;
  return Number(raw) === Number(expected);
}

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


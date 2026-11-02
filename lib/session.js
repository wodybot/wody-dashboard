import crypto from 'crypto';
import { cookies } from 'next/headers';
import { getDb } from '@/lib/mongo';

// The SESSION_SECRET guard below runs lazily, on first actual use (signing
// or verifying a cookie), instead of eagerly at module import. Next.js
// imports this module during `next build`'s "Collecting page data" step,
// which also runs with NODE_ENV=production, so the eager version threw
// during every production build that didn't have SESSION_SECRET set in the
// *build* environment, even though the app only needs it at *runtime*. This
// keeps the exact same protection (a production server still refuses to
// sign a single cookie with the known dev secret) without blocking builds.
let _secret;
function getSecret() {
  if (_secret) return _secret;
  if (process.env.NODE_ENV === 'production' && !process.env.SESSION_SECRET) {
    // A missing SESSION_SECRET in production means every session/state cookie
    // gets signed with a value anyone can find in this source file, don't
    // run on a known-bad secret.
    throw new Error(
      'SESSION_SECRET is not set. Generate one with `openssl rand -hex 32` and set it in your environment before running in production.'
    );
  }
  _secret = process.env.SESSION_SECRET || 'dev-secret';
  return _secret;
}
const COOKIE_NAME = 'wody_session';
const STATE_COOKIE_NAME = 'wody_oauth_state';
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days
const STATE_MAX_AGE_SECONDS = 10 * 60; // 10 minutes, just long enough for the OAuth round trip

function sign(data) {
  return crypto.createHmac('sha256', getSecret()).update(data).digest('base64url');
}

function pack(value) {
  return `${value}.${sign(value)}`;
}

function unpack(token) {
  if (!token) return null;
  const [value, sig] = token.split('.');
  if (!value || !sig) return null;
  // Constant-time comparison, matching consumeOAuthState() below. A plain
  // !== short-circuits on the first differing byte, which in principle
  // leaks how much of a forged signature was correct and lets an attacker
  // rebuild it one byte at a time. That attack is not practical over a
  // network against an HMAC, but this is the one comparison standing
  // between a forged cookie and a valid session, so it should not be the
  // only place in this file that skips the safe primitive.
  const expected = Buffer.from(sign(value));
  const provided = Buffer.from(sig);
  if (expected.length !== provided.length) return null;
  if (!crypto.timingSafeEqual(expected, provided)) return null;
  return value;
}

// ---------------------------------------------------------------------------
// Session storage.
//
// The cookie itself never carries the Discord access/refresh tokens or any
// other sensitive payload, it only carries a random, unguessable session
// id, signed so a tampered or forged cookie value is rejected outright.
// The actual session data (tokens, cached user profile, expiry) lives
// server-side, in the `sessions` collection. This means:
//   - stealing the cookie value alone is useless without also reaching the
//     database, and
//   - logout (or an admin action) can truly invalidate a session, since
//     revocation just means deleting the server-side record.
// ---------------------------------------------------------------------------

function generateSessionId() {
  return crypto.randomBytes(32).toString('base64url');
}

// Public pages (the homepage first of all) call this on every request. A
// failure here (database hiccup, missing SESSION_SECRET) must never take the
// whole page down for a signed-in visitor: it is treated as "not signed in"
// and logged, the page itself still loads.
export async function getSession() {
  try {
    return await readSession();
  } catch (error) {
    console.error('getSession failed, treating the visitor as signed out', error);
    return null;
  }
}

async function readSession() {
  const store = await cookies();
  const sessionId = unpack(store.get(COOKIE_NAME)?.value);
  if (!sessionId) return null;

  const db = await getDb();
  const doc = await db.collection('sessions').findOne({ _id: sessionId });
  if (!doc) return null;

  if (doc.exp && doc.exp < Date.now()) {
    await db.collection('sessions').deleteOne({ _id: sessionId });
    return null;
  }

  return {
    user: doc.user,
    accessToken: doc.accessToken,
    refreshToken: doc.refreshToken,
    exp: doc.exp,
  };
}

export async function setSession(payload) {
  // Always issue a brand-new session id on (re)login rather than reusing
  // whatever was there before, so a pre-authentication cookie can never be
  // "adopted" into an authenticated session (session fixation protection).
  await clearSession();

  const sessionId = generateSessionId();
  const db = await getDb();
  await db.collection('sessions').insertOne({
    _id: sessionId,
    accessToken: payload.accessToken,
    refreshToken: payload.refreshToken,
    user: payload.user,
    exp: payload.exp,
    // Separate from `exp` on purpose. `exp` is the Discord access token's
    // expiry, stored as a millisecond number, which a MongoDB TTL index
    // cannot act on (TTL only understands BSON dates). Without a date
    // field, nothing ever deleted session documents: getSession() only
    // removes one if that exact session is used again after expiring, so
    // every abandoned login, every logout that never happened and every
    // expired session simply accumulated in the collection forever.
    // This field is what the TTL index in lib/mongo.js keys off, and it
    // tracks the cookie's own 7-day lifetime, after which the session is
    // unusable regardless of the token state.
    expires_at: new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000),
    createdAt: new Date(),
  });

  const store = await cookies();
  store.set(COOKIE_NAME, pack(sessionId), {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export async function clearSession() {
  const store = await cookies();
  const sessionId = unpack(store.get(COOKIE_NAME)?.value);
  if (sessionId) {
    const db = await getDb();
    await db.collection('sessions').deleteOne({ _id: sessionId });
  }
  store.delete(COOKIE_NAME);
}

// ---------------------------------------------------------------------------
// OAuth `state` handling (CSRF protection for the login flow).
//
// A random value is generated and stored in a short-lived, HttpOnly cookie
// before redirecting to Discord, then compared against the `state` Discord
// sends back to the callback. This prevents an attacker from tricking a
// victim into completing an OAuth flow initiated by the attacker (login
// CSRF), since the callback only succeeds if the state cookie set on the
// victim's own browser matches.
// ---------------------------------------------------------------------------

export async function issueOAuthState() {
  const state = crypto.randomBytes(24).toString('base64url');
  const store = await cookies();
  store.set(STATE_COOKIE_NAME, pack(state), {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: STATE_MAX_AGE_SECONDS,
  });
  return state;
}

export async function consumeOAuthState(candidate) {
  const store = await cookies();
  const expected = unpack(store.get(STATE_COOKIE_NAME)?.value);
  store.delete(STATE_COOKIE_NAME);
  if (!expected || !candidate) return false;
  // Constant-time comparison to avoid leaking the expected value through
  // response-timing differences.
  const a = Buffer.from(expected);
  const b = Buffer.from(candidate);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export const COOKIE = COOKIE_NAME;

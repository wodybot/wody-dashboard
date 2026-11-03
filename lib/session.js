import crypto from 'crypto';
import { cookies } from 'next/headers';
import { getDb } from '@/lib/mongo';

let _secret;
function getSecret() {
  if (_secret) return _secret;
  if (process.env.NODE_ENV === 'production' && !process.env.SESSION_SECRET) {
    throw new Error(
      'SESSION_SECRET is not set. Generate one with `openssl rand -hex 32` and set it in your environment before running in production.'
    );
  }
  _secret = process.env.SESSION_SECRET || 'dev-secret';
  return _secret;
}
const COOKIE_NAME = 'wody_session';
const STATE_COOKIE_NAME = 'wody_oauth_state';
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;
const STATE_MAX_AGE_SECONDS = 10 * 60;

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
  const expected = Buffer.from(sign(value));
  const provided = Buffer.from(sig);
  if (expected.length !== provided.length) return null;
  if (!crypto.timingSafeEqual(expected, provided)) return null;
  return value;
}


function generateSessionId() {
  return crypto.randomBytes(32).toString('base64url');
}

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
  await clearSession();

  const sessionId = generateSessionId();
  const db = await getDb();
  await db.collection('sessions').insertOne({
    _id: sessionId,
    accessToken: payload.accessToken,
    refreshToken: payload.refreshToken,
    user: payload.user,
    exp: payload.exp,
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
  const a = Buffer.from(expected);
  const b = Buffer.from(candidate);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export const COOKIE = COOKIE_NAME;

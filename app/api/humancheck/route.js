// Public endpoint of the Wody Human Check (see lib/humancheck.js). No cookie is read or set, no address is read,
// nothing is stored except short lived one-use records that delete themselves.
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongo';
import { isTrustedOrigin } from '@/lib/captcha';
import { PURPOSES, startChallenge, checkTick, checkPuzzle } from '@/lib/humancheck';
import { buildPuzzle } from '@/lib/humancheck-shapes';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const json = (data, init = {}) => NextResponse.json(data, { ...init, headers: { 'Cache-Control': 'no-store, private', ...(init.headers || {}) } });

// One shared, generous ceiling. It is not tied to a person, a network or a device, so a VPN never matters.
async function busy(db) {
  const now = Date.now();
  const win = now - (now % 60_000);
  try {
    const r = await db.collection('rate_limit_buckets').findOneAndUpdate(
      { _id: `humancheck:all:${win}` },
      { $inc: { count: 1 }, $setOnInsert: { expires_at: new Date(win + 120_000) } },
      { upsert: true, returnDocument: 'after' },
    );
    return (r?.count ?? r?.value?.count ?? 0) > 4000;
  } catch { return false; }
}

export async function GET(request) {
  const u = new URL(request.url);
  const purpose = u.searchParams.get('purpose') || '';
  if (!PURPOSES.includes(purpose)) return json({ error: 'bad_request' }, { status: 400 });
  const db = await getDb();
  if (await busy(db)) return json({ error: 'rate_limited' }, { status: 429 });
  const c = startChallenge(purpose, u.searchParams.get('ctx') || '');
  return json(c);
}

export async function POST(request) {
  if (!isTrustedOrigin(request)) return json({ error: 'forbidden_origin' }, { status: 403 });
  const raw = await request.text().catch(() => '');
  if (raw.length > 6000) return json({ error: 'bad_request' }, { status: 413 });
  let body = {};
  try { body = JSON.parse(raw); } catch { return json({ error: 'bad_request' }, { status: 400 }); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return json({ error: 'bad_request' }, { status: 400 });
  const db = await getDb();
  if (await busy(db)) return json({ error: 'rate_limited' }, { status: 429 });
  if (body.action === 'tick') return json(await checkTick(db, body, async (c, r, n) => buildPuzzle(c, r, n)));
  if (body.action === 'puzzle') return json(await checkPuzzle(db, body, async (c, r, n) => buildPuzzle(c, r, n)));
  return json({ error: 'bad_request' }, { status: 400 });
}

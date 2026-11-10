import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongo';
import { sweepExpired } from '@/lib/collab/lifecycle.js';
import { sweepListings } from '@/lib/community/lifecycle.js';
import { loadPrefix } from '@/lib/community/db.js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function authorized(request) {
  const expected = process.env.CRON_SECRET;
  return Boolean(expected) && request.headers.get('authorization') === `Bearer ${expected}`;
}

async function handler(request) {
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const db = await getDb();
    await loadPrefix(db).catch(() => {});
    await sweepExpired(db, { force: true });
    const servers = await sweepListings(db, { force: true });
    return NextResponse.json({ ok: true, servers });
  } catch (e) {
    console.error('lifecycle cron failed', e?.message);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

export async function GET(request) { return handler(request); }
export async function POST(request) { return handler(request); }

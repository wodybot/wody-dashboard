// Unified notifications API (bell in the header). Everything is scoped to the signed in user.
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { trustedOrigin } from '@/lib/owner-access';
import { ndb, listFor, markRead } from '@/lib/notifications';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

const json = (data, status = 200) => NextResponse.json(data, { status, headers: { 'Cache-Control': 'no-store, private' } });

async function limited(db, key, max) {
  const windowMs = 60_000;
  const start = Date.now() - (Date.now() % windowMs);
  try {
    const r = await db.collection('rate_limit_buckets').findOneAndUpdate(
      { _id: `nt:${key}:${start}` },
      { $inc: { count: 1 }, $setOnInsert: { expires_at: new Date(start + windowMs * 2) } },
      { upsert: true, returnDocument: 'after' },
    );
    return (r?.count ?? r?.value?.count ?? 0) > max;
  } catch { return false; }
}

export async function GET(request, context) {
  try {
    const params = await context.params;
    if ((params?.path || []).length) return json({ error: 'not_found' }, 404);
    const session = await getSession();
    if (!session?.user?.id) return json({ error: 'unauthorized' }, 401);
    const db = await ndb();
    const uid = String(session.user.id);
    if (await limited(db, `r:${uid}`, 120)) return json({ error: 'rate_limited' }, 429);
    const summary = new URL(request.url).searchParams.get('summary') === '1';
    return json(await listFor(db, uid, { summary }));
  } catch (e) {
    console.error('[notifications]', e?.message || e);
    return json({ error: 'internal_error' }, 500);
  }
}

export async function POST(request, context) {
  try {
    const params = await context.params;
    if ((params?.path || []).join('/') !== 'read') return json({ error: 'not_found' }, 404);
    if (!trustedOrigin(request)) return json({ error: 'forbidden' }, 403);
    const session = await getSession();
    if (!session?.user?.id) return json({ error: 'unauthorized' }, 401);
    const db = await ndb();
    const uid = String(session.user.id);
    if (await limited(db, `w:${uid}`, 60)) return json({ error: 'rate_limited' }, 429);
    let body = {};
    try { const text = await request.text(); body = text.length < 8192 && text ? JSON.parse(text) : {}; } catch { return json({ error: 'bad_request' }, 400); }
    await markRead(db, uid, { ids: body?.ids, all: body?.all === true });
    return json({ ok: true, ...(await listFor(db, uid, { summary: true })) });
  } catch (e) {
    console.error('[notifications]', e?.message || e);
    return json({ error: 'internal_error' }, 500);
  }
}

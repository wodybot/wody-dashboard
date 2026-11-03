import { mdb } from '@/lib/marketplace/db';
import { handle } from '@/lib/marketplace/api';
import { err, fromError } from '@/lib/marketplace/api-util';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

async function run(request, context, method) {
  try {
    const params = await context.params;
    const parts = (params?.path || []).map(String);
    if (parts.length > 8 || parts.some((p) => p.length > 80)) return err('not_found', 404);
    const db = await mdb();
    const res = await handle({ request, db, parts, method, url: new URL(request.url) });
    return res || err('not_found', 404);
  } catch (e) {
    return fromError(e);
  }
}
export const GET = (r, c) => run(r, c, 'GET');
export const POST = (r, c) => run(r, c, 'POST');
export const PUT = (r, c) => run(r, c, 'PUT');
export const DELETE = (r, c) => run(r, c, 'DELETE');

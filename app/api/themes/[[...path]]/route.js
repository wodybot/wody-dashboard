import { getDb } from '@/lib/mongo';
import { handle, err } from '@/lib/themes/api';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';
export const maxDuration = 30;

async function run(request, context, method) {
  try {
    const params = await context.params;
    const parts = (params?.path || []).map(String);
    if (parts.length > 5 || parts.some((p) => p.length > 64)) return err('not_found', 404);
    const db = await getDb();
    return await handle({ request, db, parts, method });
  } catch (e) {
    console.error('[themes] unhandled', e);
    return err('internal_error', 500);
  }
}

export const GET = (r, c) => run(r, c, 'GET');
export const POST = (r, c) => run(r, c, 'POST');
export const PUT = (r, c) => run(r, c, 'PUT');
export const PATCH = (r, c) => run(r, c, 'PATCH');
export const DELETE = (r, c) => run(r, c, 'DELETE');

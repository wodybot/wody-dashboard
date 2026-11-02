// Wody Community Discovery API. One entry point, three clearly separated surfaces:
//   public / me / join / img / icon   visitors (some need a signed-in Discord account)
//   owner/*                           a server's own listing, checked per request
//   admin/*                           Wody owner/admin accounts only
// Permissions are decided in lib/community/api-*.js, never in the browser.
import { cdb } from '@/lib/community/db';
import { handlePublic } from '@/lib/community/api-public';
import { handleOwner } from '@/lib/community/api-owner';
import { handleAdmin } from '@/lib/community/api-admin';
import { json, err, fromError } from '@/lib/community/api-util';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

async function run(request, context, method) {
  try {
    const params = await context.params;
    const parts = (params?.path || []).map(String);
    if (parts.some((p) => p.length > 80)) return err('not_found', 404);
    const url = new URL(request.url);
    const db = await cdb();
    const ctx = { request, db, parts, method, url };
    const res = (await handleAdmin(ctx)) || (await handleOwner(ctx)) || (await handlePublic(ctx));
    return res || err('not_found', 404);
  } catch (e) {
    return fromError(e);
  }
}

export const GET = (r, c) => run(r, c, 'GET');
export const POST = (r, c) => run(r, c, 'POST');
export const PUT = (r, c) => run(r, c, 'PUT');
export const PATCH = (r, c) => run(r, c, 'PATCH');
export const DELETE = (r, c) => run(r, c, 'DELETE');

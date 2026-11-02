// GET /api/site-image/<id>: a picture the owner uploaded (public, it is shown on every page). Served with the type
// found in the file itself, nosniff, and a long cache (an id never changes its content).
import { loadSiteImage } from '@/lib/site-images';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_request, context) {
  const { id } = await context.params;
  let row = null;
  try { row = await loadSiteImage(id); } catch { /* treated as missing */ }
  if (!row?.data) return new Response(null, { status: 404, headers: { 'Cache-Control': 'no-store' } });
  const bytes = row.data.buffer ? Buffer.from(row.data.buffer) : Buffer.from(row.data);
  return new Response(bytes, {
    headers: {
      'Content-Type': row.mime,
      'Content-Length': String(bytes.length),
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; sandbox",
    },
  });
}

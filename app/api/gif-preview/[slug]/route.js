import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { getDb } from '@/lib/mongo';
import { loadBlob, blobBytes } from '@/lib/gifstudio/store';
import { promoteDue, publishedBySlug } from '@/lib/gifstudio/publish';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Public, permanent address of a published GIF: /api/gif-preview/<slug>.gif (or .png for the static fallback).
// The address never changes and never expires. The file behind it is the published version; caches are revalidated with an ETag.
export async function GET(request, { params }) {
  const { slug: raw } = await params;
  const m = /^([a-z0-9][a-z0-9-]{2,63})\.(gif|png)$/.exec(String(raw || ''));
  if (!m) return new NextResponse('Not found', { status: 404 });
  try {
    const db = await getDb();
    await promoteDue(db);
    const item = await publishedBySlug(db, m[1]);
    const ver = item && (item.versions || []).find((v) => v.v === item.published_version);
    if (!ver) return new NextResponse('Not found', { status: 404 });
    const blob = await loadBlob(db, m[2] === 'png' ? ver.png_id : ver.blob_id);
    const data = blobBytes(blob);
    if (!data) return new NextResponse('Not found', { status: 404 });
    const etag = `"${crypto.createHash('sha1').update(String(blob._id)).digest('hex').slice(0, 20)}"`;
    const headers = {
      'Content-Type': m[2] === 'png' ? 'image/png' : 'image/gif', 'Cache-Control': 'public, max-age=300, stale-while-revalidate=86400',
      ETag: etag, 'Last-Modified': new Date(item.published_at || ver.at).toUTCString(), 'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; sandbox", 'Cross-Origin-Resource-Policy': 'cross-origin', 'Access-Control-Allow-Origin': '*',
    };
    if (request.headers.get('if-none-match') === etag) return new NextResponse(null, { status: 304, headers });
    return new NextResponse(data, { headers: { ...headers, 'Content-Length': String(data.length) } });
  } catch (e) {
    console.error('[gif-preview]', e?.message || e);
    return new NextResponse('Unavailable', { status: 503 });
  }
}

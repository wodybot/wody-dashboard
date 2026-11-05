import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongo';
import { GIF_MODULES } from '@/lib/gifstudio/constants';
import { listItems, loadBlob, blobBytes } from '@/lib/gifstudio/store';
import { promoteDue } from '@/lib/gifstudio/publish';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const SITE = (process.env.NEXT_PUBLIC_BASE_URL || 'https://wody.online').replace(/\/+$/, '');

// Stable address of the animated preview of a module: /api/gif-preview/for/<module>.<locale>.gif
// It serves the published GIF of that module in that language, then English, then any language. With none published it
// forwards to the static image so the link always shows a picture.
export async function GET(request, { params }) {
  const { name } = await params;
  const m = /^([a-z]+)(?:\.([a-z]{2}))?\.(gif|png)$/.exec(String(name || ''));
  if (!m || !GIF_MODULES.includes(m[1])) return new NextResponse('Not found', { status: 404 });
  const fallback = () => NextResponse.redirect(`${SITE}/opengraph-image`, 302);
  try {
    const db = await getDb();
    await promoteDue(db);
    const rows = (await listItems(db)).filter((i) => i.module === m[1] && i.status !== 'archived' && i.published_version);
    const pick = rows.find((i) => i.config?.locale === (m[2] || 'en')) || rows.find((i) => i.config?.locale === 'en') || rows[0];
    const ver = pick && (pick.versions || []).find((v) => v.v === pick.published_version);
    if (!ver) return fallback();
    const data = blobBytes(await loadBlob(db, m[3] === 'png' ? ver.png_id : ver.blob_id));
    if (!data) return fallback();
    return new NextResponse(data, {
      headers: {
        'Content-Type': m[3] === 'png' ? 'image/png' : 'image/gif', 'Content-Length': String(data.length),
        'Cache-Control': 'public, max-age=300, stale-while-revalidate=86400', 'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'none'; sandbox", 'Cross-Origin-Resource-Policy': 'cross-origin', 'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (e) {
    console.error('[gif-preview-for]', e?.message || e);
    return fallback();
  }
}

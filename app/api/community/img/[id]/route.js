import { NextResponse } from 'next/server';
import sharp from 'sharp';
import { cdb, C } from '@/lib/community/db';
import { handlePublic } from '@/lib/community/api-public';
import { fromError } from '@/lib/community/api-util';

// Public listing pictures. A fast path for the pictures everybody can see: one small database read, a resized
// copy that is kept in memory and cached for a year by the browser and the CDN. Private pictures (an owner
// previewing a draft) still go through the regular handler, which checks who is asking.
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const WIDTHS = [320, 480, 640, 960, 1280, 1600];
const MAX_BYTES = 24 * 1024 * 1024;
const publicCache = new Map();
const resized = new Map();
let resizedBytes = 0;
const ID_RE = /^[a-f0-9]{24}$/;

const notFound = () => new NextResponse('Not found', { status: 404, headers: { 'Cache-Control': 'public, max-age=60' } });

function pickWidth(raw) {
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return WIDTHS.find((w) => w >= n) || WIDTHS[WIDTHS.length - 1];
}

async function isPublicImage(db, img) {
  const hit = publicCache.get(String(img._id));
  if (hit && Date.now() - hit.at < 60_000) return hit.ok;
  const listing = await db.collection(C.listings).findOne({ _id: img.listing_id }, { projection: { status: 1, 'live.banner_id': 1, 'live.background_id': 1 } });
  const used = [listing?.live?.banner_id, listing?.live?.background_id].filter(Boolean).map(String);
  const ok = listing?.status === 'published' && used.includes(String(img._id));
  if (publicCache.size > 2000) publicCache.clear();
  publicCache.set(String(img._id), { at: Date.now(), ok });
  return ok;
}

function remember(key, value) {
  resized.set(key, value);
  resizedBytes += value.buf.length;
  while (resizedBytes > MAX_BYTES && resized.size) {
    const oldest = resized.keys().next().value;
    resizedBytes -= resized.get(oldest).buf.length;
    resized.delete(oldest);
  }
}

const HEADERS = (type, length, etag) => ({
  'Content-Type': type, 'Content-Length': String(length), ETag: etag, 'X-Content-Type-Options': 'nosniff',
  'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'", 'Cross-Origin-Resource-Policy': 'same-site',
  'Cache-Control': 'public, max-age=31536000, s-maxage=31536000, immutable',
});

export async function GET(request, context) {
  try {
    const { id } = await context.params;
    if (!ID_RE.test(String(id))) return notFound();
    const url = new URL(request.url);
    const width = pickWidth(url.searchParams.get('w'));
    const etag = `"${id}-${width}"`;
    if (request.headers.get('if-none-match') === etag) return new NextResponse(null, { status: 304, headers: { ETag: etag, 'Cache-Control': 'public, max-age=31536000, immutable' } });

    const cached = resized.get(etag);
    if (cached) return new NextResponse(cached.buf, { headers: HEADERS(cached.type, cached.buf.length, etag) });

    const db = await cdb();
    const { ObjectId } = await import('mongodb');
    const img = await db.collection(C.images).findOne({ _id: new ObjectId(id) });
    if (!img) return notFound();
    if (!(await isPublicImage(db, img))) {
      const res = await handlePublic({ request, db, parts: ['img', id], method: 'GET', url });
      return res || notFound();
    }
    const raw = Buffer.isBuffer(img.data) ? img.data : Buffer.from(img.data.buffer || img.data);
    let out = { buf: raw, type: img.mime };
    // Animated pictures stay as they are; everything else is shrunk to the size the page really shows.
    if (width && img.mime !== 'image/gif' && (!img.w || img.w > width)) {
      try {
        out = { buf: await sharp(raw).rotate().resize({ width, withoutEnlargement: true }).webp({ quality: 74, effort: 3 }).toBuffer(), type: 'image/webp' };
      } catch { out = { buf: raw, type: img.mime }; }
    }
    remember(etag, out);
    return new NextResponse(out.buf, { headers: HEADERS(out.type, out.buf.length, etag) });
  } catch (e) {
    return fromError(e);
  }
}

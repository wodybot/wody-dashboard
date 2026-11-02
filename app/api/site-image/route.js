// POST /api/site-image  (owner only, multipart field "file")  ->  { url: "/api/site-image/<id>" }
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { OWNER_ID } from '@/lib/content';
import { storeSiteImage, validateSiteImage, SITE_IMAGE_MAX_BYTES } from '@/lib/site-images';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const reply = (body, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

function trustedOrigin(request) {
  const origin = request.headers.get('origin');
  if (!origin) return false;
  const base = process.env.NEXT_PUBLIC_BASE_URL;
  if (!base) return true;
  try {
    const n = (h) => h.replace(/^www\./, '');
    return n(new URL(origin).host) === n(new URL(base).host);
  } catch { return false; }
}

export async function POST(request) {
  if (!trustedOrigin(request)) return reply({ error: 'forbidden_origin' }, 403);
  const session = await getSession();
  if (!session?.user) return reply({ error: 'unauthenticated' }, 401);
  if (String(session.user.id) !== String(OWNER_ID)) return reply({ error: 'forbidden' }, 403);
  let form;
  try { form = await request.formData(); } catch { return reply({ error: 'invalid_body' }, 400); }
  const file = form.get('file');
  if (!file || typeof file.arrayBuffer !== 'function') return reply({ error: 'invalid_body' }, 400);
  if (file.size > SITE_IMAGE_MAX_BYTES) return reply({ error: 'image_too_large' }, 413);
  const buffer = Buffer.from(await file.arrayBuffer());
  const check = validateSiteImage(buffer);
  if (check.error) return reply({ error: check.error }, check.error === 'image_too_large' ? 413 : 400);
  const url = await storeSiteImage(buffer, check.info, session.user.id);
  return reply({ url });
}

import { ImageResponse } from 'next/og';
import { readFile } from 'fs/promises';
import path from 'path';
import { ObjectId } from 'mongodb';
import { getDb } from '@/lib/mongo';
import { loadSiteImage } from '@/lib/site-images';
import { SITE_IMAGE_PATH_RE } from '@/lib/site-image-path';
import { proxiedImageUrl } from '@/lib/utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const interRegular = readFile(path.join(process.cwd(), 'assets/fonts/Inter-Regular.ttf'));
const interBold = readFile(path.join(process.cwd(), 'assets/fonts/Inter-Bold.ttf'));
const TAG = { Feature: '#e08a4e', Fix: '#38bdf8', Announcement: '#a78bfa', Update: '#d4c5b0' };
const W = 1200;
const H = 630;

async function backgroundDataUri(ref) {
  if (!ref || !SITE_IMAGE_PATH_RE.test(ref)) return null;
  try {
    const row = await loadSiteImage(ref.split('/').pop());
    if (!row?.data) return null;
    let bytes = row.data.buffer ? Buffer.from(row.data.buffer) : Buffer.from(row.data);
    try {
      const sharp = (await import('sharp')).default;
      bytes = await sharp(bytes, { animated: false }).resize(W, H, { fit: 'cover' }).jpeg({ quality: 86 }).toBuffer();
      return `data:image/jpeg;base64,${bytes.toString('base64')}`;
    } catch {
      return row.mime === 'image/png' || row.mime === 'image/jpeg' ? `data:${row.mime};base64,${bytes.toString('base64')}` : null;
    }
  } catch {
    return null;
  }
}

export async function GET(_request, context) {
  const { id } = await context.params;
  let doc = null;
  try { doc = await (await getDb()).collection('updates').findOne({ _id: new ObjectId(id) }); } catch { }
  if (!doc) return new Response(null, { status: 404 });

  const bg = await backgroundDataUri(doc.image_url);
  const tag = String(doc.tag || 'Update');
  const accent = TAG[tag] || TAG.Update;
  const date = new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(doc.created_at));
  const title = String(doc.title || '');
  const size = title.length > 70 ? 50 : title.length > 40 ? 60 : 72;
  const credits = (doc.credits || []).slice(0, 4);

  return new ImageResponse(
    (
      <div style={{ display: 'flex', position: 'relative', width: W, height: H, background: 'linear-gradient(135deg, #2a1509 0%, #120a06 100%)', fontFamily: 'Inter' }}>
        {bg ? <img src={proxiedImageUrl(bg)} width={W} height={H} style={{ position: 'absolute', top: 0, left: 0, width: W, height: H, objectFit: 'cover' }} /> : (
          <div style={{ display: 'flex', position: 'absolute', top: -160, right: -120, width: 620, height: 620, borderRadius: 620, background: 'radial-gradient(circle, rgba(224,138,78,0.30) 0%, rgba(224,138,78,0) 70%)' }} />
        )}
        <div style={{ display: 'flex', position: 'absolute', top: 0, left: 0, width: W, height: H, background: 'linear-gradient(180deg, rgba(10,6,4,0.35) 0%, rgba(10,6,4,0.35) 30%, rgba(10,6,4,0.88) 100%)' }} />
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', position: 'absolute', top: 0, left: 0, width: W, height: H, padding: '52px 64px' }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 46, height: 46, borderRadius: 12, background: 'linear-gradient(160deg, #8a3c14 0%, #6B2E10 100%)', border: '1px solid rgba(216,154,92,0.6)' }}>
              <span style={{ display: 'flex', color: '#fff', fontSize: 26, fontWeight: 700 }}>W</span>
            </div>
            <span style={{ display: 'flex', marginLeft: 14, color: '#fff', fontSize: 20, fontWeight: 700, letterSpacing: 4 }}>WODY</span>
            <span style={{ display: 'flex', marginLeft: 18, padding: '6px 16px', borderRadius: 999, border: `1.5px solid ${accent}`, color: accent, fontSize: 18, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase' }}>{tag}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', color: '#fff', fontSize: size, fontWeight: 700, lineHeight: 1.08, letterSpacing: -1.5, maxWidth: 1060 }}>{title}</div>
            <div style={{ display: 'flex', width: 84, height: 4, borderRadius: 4, background: accent, marginTop: 26, marginBottom: 22 }} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#e9ddcc', fontSize: 22 }}>
              <span style={{ display: 'flex' }}>{date}</span>
              {credits.length ? (
                <span style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', color: '#cdbba2' }}>
                  <span style={{ display: 'flex', marginRight: 12, letterSpacing: 2, fontSize: 17, fontWeight: 700, color: accent, whiteSpace: 'nowrap' }}>CREDITS:</span>
                  <span style={{ display: 'flex', whiteSpace: 'nowrap' }}>{credits.map((c) => c.name).join('  ·  ')}</span>
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    ),
    {
      width: W,
      height: H,
      fonts: [
        { name: 'Inter', data: await interRegular, weight: 400, style: 'normal' },
        { name: 'Inter', data: await interBold, weight: 700, style: 'normal' },
      ],
      headers: { 'Cache-Control': 'public, max-age=3600' },
    },
  );
}

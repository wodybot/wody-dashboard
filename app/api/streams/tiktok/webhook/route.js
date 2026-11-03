import crypto from 'crypto';
import { getDb } from '@/lib/mongo';
import { verifyWebhook } from '@/lib/streams/tiktok';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

const res = (status, body = '') => new Response(body, { status });

export async function POST(request) {
  try {
    const raw = await request.text();
    if (!verifyWebhook(request.headers.get('tiktok-signature'), raw)) return res(401, 'invalid signature');
    let event;
    try { event = JSON.parse(raw); } catch { return res(400, 'bad request'); }
    const db = await getDb();
    try {
      await db.collection('stream_webhook_events').insertOne({ _id: crypto.createHash('sha256').update(raw).digest('hex'), created_at: new Date() });
    } catch (e) {
      if (e?.code === 11000) return res(200);
      throw e;
    }
    if (event?.event === 'authorization.removed' && event.user_openid) {
      await db.collection('stream_tiktok_connections').updateMany(
        { open_id: String(event.user_openid) },
        { $set: { status: 'revoked', status_reason: 'authorization_removed', updated_at: new Date() }, $unset: { access_token_enc: '', refresh_token_enc: '' } },
      );
      await db.collection('user_tiktok_links').deleteMany({ open_id: String(event.user_openid) });
    }
    return res(200);
  } catch (e) {
    console.error('[TikTok webhook] handler failed', e);
    return res(500);
  }
}

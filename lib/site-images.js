import { ObjectId } from 'mongodb';
import { getDb } from '@/lib/mongo';
import { sniffImage } from '@/lib/community/images';

export const SITE_IMAGE_MAX_BYTES = 3 * 1024 * 1024;
export const SITE_IMAGE_PATH_RE = /^\/api\/site-image\/[a-f0-9]{24}$/;
const KEEP = 12;

export function validateSiteImage(buf) {
  if (!buf || !buf.length) return { error: 'image_empty' };
  if (buf.length > SITE_IMAGE_MAX_BYTES) return { error: 'image_too_large' };
  const info = sniffImage(buf);
  if (!info) return { error: 'image_invalid' };
  if (info.w < 16 || info.h < 8 || info.w > 8000 || info.h > 8000) return { error: 'image_dimensions' };
  return { info };
}

export async function storeSiteImage(buffer, info, userId) {
  const db = await getDb();
  const col = db.collection('site_images');
  const res = await col.insertOne({ mime: info.mime, w: info.w, h: info.h, size: buffer.length, data: buffer, by: String(userId || ''), created_at: new Date() });
  const old = await col.find({}, { projection: { _id: 1 } }).sort({ created_at: -1 }).skip(KEEP).toArray();
  if (old.length) await col.deleteMany({ _id: { $in: old.map((r) => r._id) } });
  return `/api/site-image/${res.insertedId}`;
}

export async function loadSiteImage(id) {
  if (!/^[a-f0-9]{24}$/.test(String(id || ''))) return null;
  const db = await getDb();
  return db.collection('site_images').findOne({ _id: new ObjectId(id) });
}

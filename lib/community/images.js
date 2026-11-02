// Secure image handling for listing banners and backgrounds. Files are checked by
// their real bytes (never by the file name or the browser supplied type), SVG and
// anything unknown is refused, and nothing is executed or re-served with a guessed type.
import { ObjectId } from 'mongodb';
import { toLong } from '@/lib/mongo';
import { C } from './db.js';
import { IMAGE_RULES, LIMITS } from './constants.js';

export function sniffImage(buf) {
  if (!buf || buf.length < 24) return null;
  // PNG
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { mime: 'image/png', w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
  }
  // GIF
  const gif = buf.toString('ascii', 0, 6);
  if (gif === 'GIF87a' || gif === 'GIF89a') return { mime: 'image/gif', w: buf.readUInt16LE(6), h: buf.readUInt16LE(8) };
  // JPEG: walk the markers up to the first start-of-frame
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i + 9 < buf.length) {
      if (buf[i] !== 0xff) { i += 1; continue; }
      const marker = buf[i + 1];
      if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) { i += 2; continue; }
      const len = buf.readUInt16BE(i + 2);
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        return { mime: 'image/jpeg', h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
      }
      i += 2 + len;
    }
    return null;
  }
  // WEBP
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
    const kind = buf.toString('ascii', 12, 16);
    if (kind === 'VP8 ') return { mime: 'image/webp', w: buf.readUInt16LE(26) & 0x3fff, h: buf.readUInt16LE(28) & 0x3fff };
    if (kind === 'VP8L') {
      const b = buf.readUInt32LE(21);
      return { mime: 'image/webp', w: (b & 0x3fff) + 1, h: ((b >> 14) & 0x3fff) + 1 };
    }
    if (kind === 'VP8X') return { mime: 'image/webp', w: 1 + buf.readUIntLE(24, 3), h: 1 + buf.readUIntLE(27, 3) };
  }
  return null;
}

export function validateImage(buf, kind) {
  const rules = IMAGE_RULES[kind];
  if (!rules) return { error: 'invalid_kind' };
  const max = kind === 'banner' ? LIMITS.bannerBytes : LIMITS.backgroundBytes;
  if (!buf || !buf.length) return { error: 'image_empty' };
  if (buf.length > max) return { error: 'image_too_large', params: { max: Math.round(max / 1024 / 1024) } };
  const info = sniffImage(buf);
  if (!info) return { error: 'image_invalid' };
  if (info.w < rules.minW || info.h < rules.minH) return { error: 'image_too_small', params: { w: rules.minW, h: rules.minH } };
  if (info.w > rules.maxW || info.h > rules.maxH) return { error: 'image_too_big_dimensions', params: { w: rules.maxW, h: rules.maxH } };
  return { info };
}

export async function storeImage(db, { listingId, kind, buffer, info, userId }) {
  const res = await db.collection(C.images).insertOne({
    listing_id: listingId, kind, mime: info.mime, w: info.w, h: info.h, size: buffer.length, data: buffer, by: toLong(userId), created_at: new Date(),
  });
  return String(res.insertedId);
}

export async function loadImage(db, id) {
  if (!/^[a-f0-9]{24}$/.test(String(id || ''))) return null;
  return db.collection(C.images).findOne({ _id: new ObjectId(id) });
}

// Remove images of a listing that neither the draft nor the live version uses.
export async function pruneImages(db, listing) {
  const keep = new Set([listing.content?.banner_id, listing.content?.background_id, listing.live?.banner_id, listing.live?.background_id].filter(Boolean).map(String));
  const rows = await db.collection(C.images).find({ listing_id: listing._id }, { projection: { _id: 1 } }).toArray();
  const drop = rows.filter((r) => !keep.has(String(r._id))).map((r) => r._id);
  if (drop.length) await db.collection(C.images).deleteMany({ _id: { $in: drop } });
  return drop.length;
}

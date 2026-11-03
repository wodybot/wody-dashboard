import { ObjectId } from 'mongodb';
import { toLong } from '@/lib/mongo';
import { C } from './db.js';
import { LIMITS, REPORT_REASONS, REPORT_STATUSES } from './constants.js';
import { CommunityError, addAudit, addTimeline, notifyAdmins, computeScore } from './lifecycle.js';
import { bumpDaily } from './analytics.js';
import { cleanBlock, cleanLine } from './validation.js';

export async function addFavorite(db, userId, listing) {
  try {
    await db.collection(C.favorites).insertOne({ user_id: toLong(userId), listing_id: listing._id, at: new Date() });
  } catch (e) { if (e?.code === 11000) return false; throw e; }
  await db.collection(C.listings).updateOne({ _id: listing._id }, { $inc: { 'counters.favorites': 1 } });
  await bumpDaily(db, listing._id, 'favorites');
  return true;
}
export async function removeFavorite(db, userId, listing) {
  const res = await db.collection(C.favorites).deleteOne({ user_id: toLong(userId), listing_id: listing._id });
  if (res.deletedCount) await db.collection(C.listings).updateOne({ _id: listing._id, 'counters.favorites': { $gt: 0 } }, { $inc: { 'counters.favorites': -1 } });
  return Boolean(res.deletedCount);
}
export async function isFavorite(db, userId, listingId) {
  return Boolean(await db.collection(C.favorites).findOne({ user_id: toLong(userId), listing_id: listingId }, { projection: { _id: 1 } }));
}
export async function favoriteListings(db, userId, { publicCard, catalog }) {
  const rows = await db.collection(C.favorites).find({ user_id: toLong(userId) }).sort({ at: -1 }).limit(200).toArray();
  if (!rows.length) return [];
  const listings = await db.collection(C.listings).find({ _id: { $in: rows.map((r) => r.listing_id) }, status: 'published' }).toArray();
  const order = new Map(rows.map((r, i) => [String(r.listing_id), i]));
  return listings.sort((a, b) => order.get(String(a._id)) - order.get(String(b._id))).map((l) => publicCard(l, catalog));
}

export async function recomputeRating(db, listingId) {
  const agg = await db.collection(C.reviews).aggregate([
    { $match: { listing_id: listingId, status: 'approved' } }, { $group: { _id: null, n: { $sum: 1 }, sum: { $sum: '$rating' } } },
  ]).toArray();
  const n = agg[0]?.n || 0; const sum = agg[0]?.sum || 0;
  await db.collection(C.listings).updateOne({ _id: listingId }, { $set: { 'counters.reviews': n, 'counters.rating_sum': sum } });
  const l = await db.collection(C.listings).findOne({ _id: listingId });
  if (l?.pub) await db.collection(C.listings).updateOne({ _id: listingId }, { $set: { 'pub.score': computeScore(l) } });
}

export async function submitReview(db, { listing, userId, authorName, rating, text, settings, isMember, isStaff }) {
  if (!settings.reviews_enabled) throw new CommunityError('reviews_disabled', 403);
  if (isStaff || String(listing.owner_id) === String(userId)) throw new CommunityError('own_listing', 403);
  if (!isMember) throw new CommunityError('not_member', 403);
  const r = Number(rating);
  if (!Number.isInteger(r) || r < 1 || r > 5) throw new CommunityError('invalid_rating', 400);
  const body = cleanBlock(text, LIMITS.review[1] + 1);
  if (body.length < LIMITS.review[0]) throw new CommunityError('review_too_short', 400, { min: LIMITS.review[0] });
  if (body.length > LIMITS.review[1]) throw new CommunityError('review_too_long', 400, { max: LIMITS.review[1] });
  if (/https?:\/\/|discord\.gg\//i.test(body)) throw new CommunityError('review_links', 400);
  const now = new Date();
  const status = settings.reviews_require_moderation === false ? 'approved' : 'pending';
  const existing = await db.collection(C.reviews).findOne({ listing_id: listing._id, user_id: toLong(userId) });
  if (existing) {
    await db.collection(C.reviews).updateOne({ _id: existing._id }, { $set: { rating: r, text: body, status, updated_at: now, author_name: cleanLine(authorName, 40) } });
  } else {
    try {
      await db.collection(C.reviews).insertOne({ listing_id: listing._id, user_id: toLong(userId), author_name: cleanLine(authorName, 40) || 'Member', rating: r, text: body, status, created_at: now, updated_at: now });
    } catch (e) { if (e?.code === 11000) throw new CommunityError('duplicate_review', 409); throw e; }
    await bumpDaily(db, listing._id, 'reviews');
  }
  await recomputeRating(db, listing._id);
  return { status, updated: Boolean(existing) };
}

export async function listReviews(db, listingId, { page = 0, size = 10 }) {
  const filter = { listing_id: listingId, status: 'approved' };
  const [total, rows] = await Promise.all([
    db.collection(C.reviews).countDocuments(filter),
    db.collection(C.reviews).find(filter).sort({ created_at: -1 }).skip(page * size).limit(size).toArray(),
  ]);
  return { total, page, items: rows.map((r) => ({ id: String(r._id), author: r.author_name, rating: r.rating, text: r.text, date: r.created_at })) };
}

export async function moderateReview(db, review, admin, decision, reason = '') {
  if (!['approved', 'rejected', 'removed'].includes(decision)) throw new CommunityError('invalid_state', 400);
  const listing = await db.collection(C.listings).findOne({ _id: review.listing_id });
  await db.collection(C.reviews).updateOne({ _id: review._id }, { $set: { status: decision, moderated_by: toLong(admin), moderated_at: new Date(), moderation_reason: String(reason || '').slice(0, 300) } });
  await recomputeRating(db, review.listing_id);
  await addAudit(db, { admin, action: 'review_moderated', listing, reason: `${decision}${reason ? `: ${reason}` : ''}`, old: review.status, next: decision });
}

export async function createReport(db, { listing, userId, reason, text, settings }) {
  if (!settings.reports_enabled) throw new CommunityError('reports_disabled', 403);
  if (!REPORT_REASONS.includes(reason)) throw new CommunityError('invalid_reason', 400);
  const body = cleanBlock(text, LIMITS.reportText);
  if (reason === 'other' && body.length < 10) throw new CommunityError('message_required', 400);
  const dup = await db.collection(C.reports).findOne({ listing_id: listing._id, reporter_id: toLong(userId), status: { $in: ['open', 'investigating'] } }, { projection: { _id: 1 } });
  if (dup) throw new CommunityError('duplicate_report', 409);
  const doc = { listing_id: listing._id, reporter_id: toLong(userId), reason, text: body, status: 'open', created_at: new Date(), handled_by: null, resolution: null };
  const res = await db.collection(C.reports).insertOne(doc);
  await notifyAdmins(db, 'new_report', listing, { reason });
  return String(res.insertedId);
}

export async function updateReport(db, report, admin, { status, resolution = '' }) {
  if (!REPORT_STATUSES.includes(status)) throw new CommunityError('invalid_state', 400);
  await db.collection(C.reports).updateOne({ _id: report._id }, { $set: { status, handled_by: toLong(admin), resolution: String(resolution || '').slice(0, 500), updated_at: new Date() } });
  const listing = await db.collection(C.listings).findOne({ _id: report.listing_id });
  await addAudit(db, { admin, action: `report_${status}`, listing, reason: String(resolution || '').slice(0, 200), old: report.status, next: status });
  if (listing) await addTimeline(db, listing, `report_${status}`, { actor: admin, kind: 'admin', ownerVisible: false });
}

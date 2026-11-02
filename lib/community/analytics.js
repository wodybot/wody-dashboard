// Cookie free analytics. A visitor is counted through a salted hash that rotates
// every day and is never stored longer than two days; no IP address, no user agent
// and no identifier is written to the database, and nothing is stored in the browser.
import crypto from 'node:crypto';
import { C } from './db.js';

const BOT_UA = /bot|crawl|spider|slurp|preview|facebookexternalhit|embedly|curl|wget|python|node-fetch|axios|headless|lighthouse|monitor|uptime/i;

export function dayKey(d = new Date()) { return d.toISOString().slice(0, 10); }

export function visitorHash(headers) {
  const ip = (headers.get('x-forwarded-for') || headers.get('x-real-ip') || '').split(',')[0].trim();
  const ua = headers.get('user-agent') || '';
  if (!ua || BOT_UA.test(ua)) return null;
  const salt = `${process.env.SESSION_SECRET || 'wody'}:${dayKey()}`;
  return crypto.createHash('sha256').update(`${salt}|${ip}|${ua}`).digest('hex').slice(0, 24);
}

// kind: 'view' (deduplicated per half hour), 'click' (per ten minutes)
export async function recordEvent(db, listing, kind, hash, now = new Date()) {
  if (!hash) return false;
  const day = dayKey(now);
  const bucket = Math.floor(now.getTime() / (kind === 'view' ? 30 * 60_000 : 10 * 60_000));
  const inc = {};
  try {
    await db.collection(C.visits).insertOne({ k: `${kind}:${listing._id}:${bucket}:${hash}`, at: now });
  } catch (e) {
    if (e?.code === 11000) return false;
    throw e;
  }
  if (kind === 'view') {
    inc.views = 1;
    try { await db.collection(C.visits).insertOne({ k: `uniq:${listing._id}:${day}:${hash}`, at: now }); inc.uniques = 1; } catch (e) { if (e?.code !== 11000) throw e; }
  } else inc.invite_clicks = 1;
  await db.collection(C.analytics).updateOne({ listing_id: listing._id, day }, { $inc: inc, $setOnInsert: { listing_id: listing._id, day } }, { upsert: true });
  const total = kind === 'view' ? { 'counters.views_total': 1, ...(inc.uniques ? { 'counters.uniques_30d': 1 } : {}) } : { 'counters.invite_clicks_total': 1 };
  await db.collection(C.listings).updateOne({ _id: listing._id }, { $inc: total });
  return true;
}

export async function bumpDaily(db, listingId, field, by = 1, now = new Date()) {
  await db.collection(C.analytics).updateOne({ listing_id: listingId, day: dayKey(now) }, { $inc: { [field]: by }, $setOnInsert: { listing_id: listingId, day: dayKey(now) } }, { upsert: true });
}

function days(range) { return Math.max(1, Math.min(90, Number(range) || 30)); }

export async function listingAnalytics(db, listing, range = 30) {
  const n = days(range);
  const since = dayKey(new Date(Date.now() - (n - 1) * 86400_000));
  const rows = await db.collection(C.analytics).find({ listing_id: listing._id, day: { $gte: since } }).sort({ day: 1 }).toArray();
  const byDay = new Map(rows.map((r) => [r.day, r]));
  const series = [];
  for (let i = n - 1; i >= 0; i -= 1) {
    const d = dayKey(new Date(Date.now() - i * 86400_000));
    const r = byDay.get(d) || {};
    series.push({ day: d, views: r.views || 0, uniques: r.uniques || 0, invite_clicks: r.invite_clicks || 0, favorites: r.favorites || 0, reviews: r.reviews || 0 });
  }
  const sum = (k) => series.reduce((a, x) => a + x[k], 0);
  return {
    range: n, series,
    totals: { views: sum('views'), uniques: sum('uniques'), invite_clicks: sum('invite_clicks'), favorites: listing.counters?.favorites || 0, reviews: listing.counters?.reviews || 0 },
  };
}

export async function adminAnalytics(db, range = 30) {
  const n = days(range);
  const since = new Date(Date.now() - n * 86400_000);
  const sinceDay = dayKey(since);
  const [daily, timeline, statusCounts, byCategory, byLanguage] = await Promise.all([
    db.collection(C.analytics).aggregate([
      { $match: { day: { $gte: sinceDay } } },
      { $group: { _id: '$day', views: { $sum: '$views' }, invite_clicks: { $sum: '$invite_clicks' } } },
    ]).toArray(),
    db.collection(C.timeline).aggregate([
      { $match: { at: { $gte: since }, type: { $in: ['submitted', 'resubmitted', 'approved', 'rejected'] } } },
      { $group: { _id: { day: { $dateToString: { format: '%Y-%m-%d', date: '$at' } }, type: '$type' }, n: { $sum: 1 } } },
    ]).toArray(),
    db.collection(C.listings).aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]).toArray(),
    db.collection(C.listings).aggregate([{ $match: { status: 'published' } }, { $group: { _id: '$pub.category', n: { $sum: 1 } } }, { $sort: { n: -1 } }, { $limit: 12 }]).toArray(),
    db.collection(C.listings).aggregate([{ $match: { status: 'published' } }, { $unwind: '$pub.languages' }, { $group: { _id: '$pub.languages', n: { $sum: 1 } } }, { $sort: { n: -1 } }, { $limit: 12 }]).toArray(),
  ]);
  const d = new Map(daily.map((x) => [x._id, x]));
  const t = new Map();
  for (const x of timeline) t.set(`${x._id.day}:${x._id.type}`, x.n);
  const series = [];
  for (let i = n - 1; i >= 0; i -= 1) {
    const day = dayKey(new Date(Date.now() - i * 86400_000));
    series.push({
      day, views: d.get(day)?.views || 0, invite_clicks: d.get(day)?.invite_clicks || 0,
      submissions: (t.get(`${day}:submitted`) || 0) + (t.get(`${day}:resubmitted`) || 0), approvals: t.get(`${day}:approved`) || 0, rejections: t.get(`${day}:rejected`) || 0,
    });
  }
  return {
    range: n, series, statuses: Object.fromEntries(statusCounts.map((x) => [x._id, x.n])),
    categories: byCategory.map((x) => ({ key: x._id, n: x.n })), languages: byLanguage.map((x) => ({ key: x._id, n: x.n })),
  };
}

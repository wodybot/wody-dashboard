// WODY unified notifications: one list for every system (bot and dashboard).
//
// Sources, merged on read and never copied, so each system keeps its own storage:
//   u  user_notifications            written by the bot and by dashboard systems (new)
//   c  community_notifications       Community Discovery, addressed to one user
//   m  marketplace_notifications     Collab, addressed to one user
//   s  computed for Wody staff       open review work (never stored, disappears when handled)
//
// The text is NOT stored. Each item carries a type and plain parameters, and the
// dashboard writes the sentence in the viewer's language (messages `bell.types`).
import { getDb } from '@/lib/mongo';
import { OWNER_ID, getDelegate } from '@/lib/owner-access';
import { notifTab } from '@/lib/collab/constants';

export const COLL = 'user_notifications';
const OTHER = { c: 'community_notifications', m: 'marketplace_notifications' };
const ID_RE = /^([ucm]):([a-f0-9]{24})$/;
const TYPE_RE = /^[a-z][a-z0-9_]{2,40}$/;
const LIST_LIMIT = 30;

// Only paths inside the site may be linked from a notification.
export function safeUrl(url) {
  const s = String(url || '');
  return /^\/(?!\/)[A-Za-z0-9\-_/.?=&#%]{0,200}$/.test(s) && !s.includes('..') ? s : null;
}

// Parameters are shown as text only. Keep primitives, cut their length, drop the rest.
export function cleanParams(params) {
  const out = {};
  for (const [k, v] of Object.entries(params && typeof params === 'object' ? params : {}).slice(0, 12)) {
    if (!/^[a-z][a-zA-Z0-9_]{0,24}$/.test(k)) continue;
    if (typeof v === 'string') out[k] = v.replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, 160);
    else if (typeof v === 'number' && Number.isFinite(v)) out[k] = v;
  }
  return out;
}

let ready = null;
export async function ndb() {
  const db = await getDb();
  if (!ready) {
    ready = Promise.all([
      db.collection(COLL).createIndex({ to: 1, created_at: -1 }),
      db.collection(COLL).createIndex({ to: 1, read: 1 }),
      db.collection(COLL).createIndex({ created_at: 1 }, { expireAfterSeconds: 90 * 24 * 3600 }),
      db.collection(COLL).createIndex({ to: 1, dedupe: 1 }, { unique: true, partialFilterExpression: { dedupe: { $type: 'string' } } }),
    ]).catch((e) => { ready = null; console.error('notification indexes', e?.message); });
  }
  await ready;
  return db;
}

// Best effort, never throws: a notification must not break the action behind it.
export async function pushNotification(db, userId, type, params = {}, { url = null, guildId = null, dedupe = null } = {}) {
  const to = String(userId || '');
  if (!/^\d{15,25}$/.test(to) || !TYPE_RE.test(String(type))) return false;
  try {
    await db.collection(COLL).insertOne({
      to, type: String(type), params: cleanParams(params), url: safeUrl(url), guild_id: guildId ? String(guildId) : null,
      dedupe: dedupe ? String(dedupe).slice(0, 120) : null, created_at: new Date(), read: false, source: 'dashboard',
    });
    return true;
  } catch (e) {
    if (e?.code !== 11000) console.error('push notification', e?.message);
    return false;
  }
}

async function isStaff(db, uid) {
  if (uid === OWNER_ID) return true;
  if (String(process.env.COMMUNITY_ADMIN_IDS || '').split(',').map((s) => s.trim()).includes(uid)) return true;
  return Boolean(await getDelegate(db, uid));
}

const iso = (d) => (d instanceof Date ? d.toISOString() : d ? new Date(d).toISOString() : null);

function normalize(src, r) {
  const at = iso(r.created_at);
  const read = Boolean(r.read);
  if (src === 'c') return { id: `c:${r._id}`, src, type: `community_${r.type}`, params: cleanParams({ name: r.name || r.slug || '' }), url: '/dashboard/community', at, read };
  if (src === 'm') return { id: `m:${r._id}`, src, type: `marketplace_${r.type}`, params: cleanParams({ title: r.params?.title || '', reason: r.params?.reason || '' }), url: `/profile?tab=${notifTab(r.type)}`, at, read };
  return { id: `u:${r._id}`, src, type: r.type, params: cleanParams(r.params), url: safeUrl(r.url), at, read };
}

// Open work for Wody staff. Counts, so there is nothing to mark as read and nothing stale.
async function staffItems(db) {
  const out = [];
  const now = new Date().toISOString();
  try {
    const [mq, mr, cq] = await Promise.all([
      db.collection('marketplace_requests').countDocuments({ review_queue: 'global' }),
      db.collection('marketplace_reports').countDocuments({ status: 'open' }),
      db.collection('community_listings').countDocuments({ status: 'pending_review' }),
    ]);
    if (mq) out.push({ id: 's:marketplace_queue', src: 's', type: 'staff_marketplace_queue', params: { count: mq }, url: '/dashboard/panel', at: now, read: false });
    if (mr) out.push({ id: 's:marketplace_reports', src: 's', type: 'staff_marketplace_reports', params: { count: mr }, url: '/dashboard/panel', at: now, read: false });
    if (cq) out.push({ id: 's:community_review', src: 's', type: 'staff_community_review', params: { count: cq }, url: '/dashboard/panel', at: now, read: false });
  } catch (e) { console.error('staff notifications', e?.message); }
  return out;
}

// { items, unread }. `summary` skips the item lists and only counts.
export async function listFor(db, userId, { summary = false } = {}) {
  const uid = String(userId);
  const staff = await isStaff(db, uid);
  const st = staff ? await staffItems(db) : [];
  const counts = await Promise.all([
    db.collection(COLL).countDocuments({ to: uid, read: false }),
    db.collection(OTHER.c).countDocuments({ to: uid, read: false }),
    db.collection(OTHER.m).countDocuments({ to: uid, read: false }),
  ]);
  const unread = counts.reduce((a, b) => a + b, 0) + st.length;
  if (summary) return { unread, items: [] };
  const [u, c, m] = await Promise.all([
    db.collection(COLL).find({ to: uid }).sort({ created_at: -1 }).limit(LIST_LIMIT).toArray(),
    db.collection(OTHER.c).find({ to: uid }).sort({ created_at: -1 }).limit(LIST_LIMIT).toArray(),
    db.collection(OTHER.m).find({ to: uid }).sort({ created_at: -1 }).limit(LIST_LIMIT).toArray(),
  ]);
  const items = [...u.map((r) => normalize('u', r)), ...c.map((r) => normalize('c', r)), ...m.map((r) => normalize('m', r))]
    .sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, LIST_LIMIT);
  return { unread, items: [...st, ...items] };
}

// Marks only the caller's own notifications. Anything else in `ids` is ignored.
export async function markRead(db, userId, { ids = [], all = false } = {}) {
  const uid = String(userId);
  const now = new Date();
  if (all) {
    await Promise.all([COLL, OTHER.c, OTHER.m].map((name) => db.collection(name).updateMany({ to: uid, read: false }, { $set: { read: true, read_at: now } })));
    return;
  }
  const by = { u: [], c: [], m: [] };
  for (const raw of (Array.isArray(ids) ? ids : []).slice(0, 50)) {
    const m = ID_RE.exec(String(raw));
    if (m) by[m[1]].push(m[2]);
  }
  const { ObjectId } = await import('mongodb');
  const names = { u: COLL, c: OTHER.c, m: OTHER.m };
  await Promise.all(Object.entries(by).filter(([, v]) => v.length).map(([k, v]) => db.collection(names[k]).updateMany({ _id: { $in: v.map((x) => new ObjectId(x)) }, to: uid }, { $set: { read: true, read_at: now } })));
}

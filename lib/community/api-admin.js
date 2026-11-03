import { ObjectId } from 'mongodb';
import { toLong } from '@/lib/mongo';
import { getBotGuild, getInvite, getDiscordUserById } from '@/lib/discord';
import { C, getCatalog, getSettings, resetCatalogCache } from './db.js';
import { audit } from '@/lib/owner-audit';
import { trustedOrigin } from '@/lib/owner-access';
import { json, err, validation, readJson, limited, sessionUser, fromError, isCommunityAdmin, isWodyAdmin } from './api-util.js';
import {
  CommunityError, oid, deleteListing, approveListing, requestChanges, rejectListing, suspendListing, unpublishListing, publishListing, addInternalNote,
  setChecklist, setBadges, setFeatured, addAudit, derivePub, notifyOwners,
} from './lifecycle.js';
import { adminAnalytics } from './analytics.js';
import { moderateReview, updateReport } from './social.js';
import { diffContent } from './validation.js';
import { DEFAULT_SETTINGS, CHECKLIST_ITEMS, REPORT_STATUSES, RESERVED_PREFIXES, PREFIX_RE } from './constants.js';

const withTimeout = (p, ms = 2500) => Promise.race([p, new Promise((r) => setTimeout(() => r(null), ms))]);
const LOCALES = ['en', 'ro', 'fr', 'it', 'de', 'es', 'pt', 'nl', 'tr'];
const KINDS = { categories: C.categories, tags: C.tags, features: C.features };
const SLUG = /^[a-z0-9_]{2,40}(\.[a-z0-9_]{2,40})?$/;

const STATUS_FILTERS = {
  pending: { status: 'pending_review' },
  pending_all: { $or: [{ status: 'pending_review' }, { status: 'published', update_state: 'pending' }] },
  published: { status: 'published' },
  changes_requested: { $or: [{ status: 'changes_requested' }, { status: 'published', update_state: 'changes_requested' }] },
  rejected: { status: 'rejected' },
  suspended: { status: 'suspended' },
  unpublished: { status: 'unpublished' },
  approved: { status: 'approved' },
  draft: { status: 'draft' },
};

function row(l, owner) {
  return {
    id: String(l._id), slug: l.slug, name: l.content?.name, status: l.status, update_state: l.update_state || null,
    owner_id: String(l.owner_id), owner_name: owner?.name || null, members: l.stats?.member_count ?? null, category: l.content?.category,
    languages: l.content?.languages || [], submitted_at: l.submitted_at, updated_at: l.updated_at, version: l.version,
    invite_status: l.invite_status, unavailable: Boolean(l.unavailable), badges: l.badges || [], featured: l.featured ? { ...l.featured, by: undefined } : null,
  };
}

async function ownerNames(ids) {
  const out = new Map();
  await Promise.all([...new Set(ids.map(String))].slice(0, 30).map(async (id) => {
    const u = await withTimeout(getDiscordUserById(id).catch(() => null));
    if (u) out.set(id, { name: u.global_name || u.username });
  }));
  return out;
}

async function discordVerification(listing) {
  const gid = String(listing.guild_id);
  const out = { checked_at: new Date().toISOString(), bot_in_guild: false, guild: null, owner_matches: null, invite: { status: 'none' } };
  const guild = await withTimeout(getBotGuild(gid, { withCounts: true }).catch(() => null), 4000);
  if (guild) {
    out.bot_in_guild = true;
    out.guild = {
      name: guild.name, owner_id: guild.owner_id, members: guild.approximate_member_count ?? null, online: guild.approximate_presence_count ?? null,
      boosts: guild.premium_subscription_count ?? null, verification_level: guild.verification_level, features: (guild.features || []).filter((f) => ['VERIFIED', 'PARTNERED', 'COMMUNITY', 'DISCOVERABLE'].includes(f)),
    };
    out.owner_matches = String(guild.owner_id) === String(listing.owner_id);
  }
  const code = listing.content?.invite_code;
  if (code) {
    try {
      const inv = await withTimeout(getInvite(code), 4000);
      out.invite = !inv ? { status: 'not_found' } : String(inv.guild?.id) !== gid ? { status: 'wrong_server' } : inv.expires_at ? { status: 'expires' } : { status: 'valid' };
    } catch { out.invite = { status: 'unreachable' }; }
  }
  return out;
}

async function getListing(db, id) {
  const _id = oid(id);
  if (!_id) throw new CommunityError('not_found', 404);
  const l = await db.collection(C.listings).findOne({ _id });
  if (!l) throw new CommunityError('not_found', 404);
  return l;
}

function validateSettings(body) {
  const errors = []; const out = {};
  for (const [k, def] of Object.entries(DEFAULT_SETTINGS)) {
    if (body[k] === undefined) continue;
    if (typeof def === 'boolean') { if (typeof body[k] !== 'boolean') errors.push({ field: k, code: 'invalid_choice' }); else out[k] = body[k]; }
    else if (typeof def === 'number') {
      const n = Number(body[k]);
      if (!Number.isInteger(n) || n < 0 || n > 1_000_000) errors.push({ field: k, code: 'out_of_range', params: { min: 0, max: 1000000 } }); else out[k] = n;
    } else out[k] = String(body[k]).slice(0, 300);
  }
  if (out.url_prefix !== undefined) {
    out.url_prefix = out.url_prefix.trim().toLowerCase();
    if (!PREFIX_RE.test(out.url_prefix)) errors.push({ field: 'url_prefix', code: 'invalid_prefix' });
    else if (RESERVED_PREFIXES.includes(out.url_prefix)) errors.push({ field: 'url_prefix', code: 'prefix_reserved' });
  }
  if (out.discovery_page_size !== undefined && (out.discovery_page_size < 6 || out.discovery_page_size > 48)) errors.push({ field: 'discovery_page_size', code: 'out_of_range', params: { min: 6, max: 48 } });
  return { out, errors };
}

function cleanNames(names) {
  const out = {};
  if (names && typeof names === 'object') for (const l of LOCALES) if (typeof names[l] === 'string' && names[l].trim()) out[l] = names[l].trim().slice(0, 60);
  return out;
}

export async function handleAdmin(ctx) {
  const { request, db, parts, method } = ctx;
  if (parts[0] !== 'admin') return null;
  const s = await sessionUser();
  if (!s) return err('unauthenticated', 401);
  const actor = { id: s.user.id, name: s.user.global_name || s.user.username };
  if (!(await isCommunityAdmin(db, s.user.id))) {
    if (!(await limited(db, `denied:${s.user.id}`, 3, 300))) {
      await audit(db, { actor, role: 'user', action: 'community.admin.denied', outcome: 'denied', target: `${method} /${parts.join('/')}`, detail: 'no panel access', request });
    }
    return err('forbidden', 403);
  }
  const role = isWodyAdmin(s.user.id) ? 'owner' : 'delegate';
  if (method !== 'GET' && !trustedOrigin(request)) {
    await audit(db, { actor, role, action: 'community.admin.blocked', outcome: 'denied', target: `${method} /${parts.join('/')}`, detail: 'untrusted origin', request });
    return err('forbidden_origin', 403);
  }
  const res = await handleAdminInner(ctx, s);
  if (method !== 'GET' && res) {
    await audit(db, { actor, role, action: `community.${method.toLowerCase()}`, outcome: res.status < 400 ? 'ok' : 'denied', target: `/${parts.slice(1).join('/')}`, detail: `HTTP ${res.status}`, request });
  }
  return res;
}

async function handleAdminInner({ request, db, parts, method, url }, s) {
  const admin = String(s.user.id);
  if (await limited(db, `admin:${admin}`, 600, 60)) return err('rate_limited', 429);
  const [, sec, id, action] = parts;
  try {
    if (sec === 'overview' && method === 'GET') {
      const start = new Date(); start.setUTCHours(0, 0, 0, 0);
      const [statuses, reports, today, series, pendingReviews, unread, invalid, unavailable] = await Promise.all([
        db.collection(C.listings).aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]).toArray(),
        db.collection(C.reports).countDocuments({ status: { $in: ['open', 'investigating'] } }),
        db.collection(C.timeline).aggregate([{ $match: { at: { $gte: start }, type: { $in: ['submitted', 'resubmitted', 'approved', 'rejected'] } } }, { $group: { _id: '$type', n: { $sum: 1 } } }]).toArray(),
        adminAnalytics(db, 14),
        db.collection(C.listings).countDocuments({ $or: [{ status: 'pending_review' }, { status: 'published', update_state: 'pending' }] }),
        db.collection(C.notifications).countDocuments({ to: 'admin', read: false }),
        db.collection(C.listings).countDocuments({ status: 'published', invite_status: 'invalid' }),
        db.collection(C.listings).countDocuments({ unavailable: true }),
      ]);
      const st = Object.fromEntries(statuses.map((x) => [x._id, x.n]));
      const t = Object.fromEntries(today.map((x) => [x._id, x.n]));
      return json({
        totals: { total: statuses.reduce((a, x) => a + x.n, 0), pending: pendingReviews, published: st.published || 0, changes_requested: st.changes_requested || 0, rejected: st.rejected || 0, suspended: st.suspended || 0, reports },
        today: { submissions: (t.submitted || 0) + (t.resubmitted || 0), approvals: t.approved || 0, rejections: t.rejected || 0 },
        series: series.series, unread_notifications: unread, warnings: { invalid_invites: invalid, unavailable },
      });
    }

    if (sec === 'applications' && method === 'GET') {
      const sp = url.searchParams;
      const filter = { ...(STATUS_FILTERS[sp.get('status')] || {}) };
      const and = [];
      if (filter.$or) { and.push({ $or: filter.$or }); delete filter.$or; }
      if (sp.get('category')) filter['content.category'] = String(sp.get('category')).slice(0, 60);
      if (sp.get('language')) filter['content.languages'] = String(sp.get('language')).slice(0, 5);
      const min = Number(sp.get('min_members')); const max = Number(sp.get('max_members'));
      if (Number.isFinite(min) && min > 0) filter['stats.member_count'] = { ...(filter['stats.member_count'] || {}), $gte: min };
      if (Number.isFinite(max) && max > 0) filter['stats.member_count'] = { ...(filter['stats.member_count'] || {}), $lte: max };
      const from = sp.get('from') ? new Date(sp.get('from')) : null; const to = sp.get('to') ? new Date(sp.get('to')) : null;
      if (from && !Number.isNaN(from.getTime())) filter.submitted_at = { ...(filter.submitted_at || {}), $gte: from };
      if (to && !Number.isNaN(to.getTime())) filter.submitted_at = { ...(filter.submitted_at || {}), $lte: new Date(to.getTime() + 86400_000) };
      const q = String(sp.get('q') || '').trim().slice(0, 60);
      if (q) {
        const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        const idq = /^\d{15,25}$/.test(q) ? [{ guild_id: toLong(q) }, { owner_id: toLong(q) }] : [];
        and.push({ $or: [{ 'content.name': rx }, { slug: rx }, ...idq] });
      }
      if (and.length) filter.$and = and;
      const sortKey = { oldest: { submitted_at: 1 }, largest: { 'stats.member_count': -1 }, smallest: { 'stats.member_count': 1 }, newest: { submitted_at: -1 } }[sp.get('sort')] || { submitted_at: -1 };
      const page = Math.max(0, Number.parseInt(sp.get('page'), 10) || 0); const size = 20;
      const [total, rows] = await Promise.all([
        db.collection(C.listings).countDocuments(filter),
        db.collection(C.listings).find(filter, { projection: { internal_notes: 0, live: 0 } }).sort({ ...sortKey, _id: 1 }).skip(page * size).limit(size).toArray(),
      ]);
      const names = await ownerNames(rows.map((r) => r.owner_id));
      return json({ total, page, pages: Math.max(1, Math.ceil(total / size)), items: rows.map((r) => row(r, names.get(String(r.owner_id)))) });
    }

    if (sec === 'listing' && id) {
      const listing = await getListing(db, id);
      if (!action && method === 'GET') {
        const [versions, timeline, reports, pendingReviews, settings, catalog] = await Promise.all([
          db.collection(C.versions).find({ listing_id: listing._id }).sort({ version: -1 }).limit(30).toArray(),
          db.collection(C.timeline).find({ listing_id: listing._id }).sort({ at: -1 }).limit(200).toArray(),
          db.collection(C.reports).find({ listing_id: listing._id }).sort({ created_at: -1 }).limit(30).toArray(),
          db.collection(C.reviews).countDocuments({ listing_id: listing._id, status: 'pending' }),
          getSettings(db), getCatalog(db, { includeDisabled: true }),
        ]);
        const verification = await discordVerification(listing);
        const noteUsers = await ownerNames([...listing.internal_notes.map((n) => n.by), listing.owner_id]);
        const owner = noteUsers.get(String(listing.owner_id));
        return json({
          listing: {
            id: String(listing._id), guild_id: String(listing.guild_id), slug: listing.slug, status: listing.status, update_state: listing.update_state || null, version: listing.version,
            content: listing.content, live: listing.live, stats: listing.stats, unavailable: Boolean(listing.unavailable), invite_status: listing.invite_status,
            owner_id: String(listing.owner_id), owner_name: owner?.name || null, submitted_at: listing.submitted_at, updated_at: listing.updated_at, published_at: listing.published_at,
            created_at: listing.created_at, last_review: listing.last_review ? { ...listing.last_review, by: String(listing.last_review.by) } : null, checklist: listing.checklist || {},
            badges: listing.badges || [], featured: listing.featured, counters: listing.counters,
            notes: listing.internal_notes.map((n) => ({ id: n.id, by: String(n.by), by_name: noteUsers.get(String(n.by))?.name || null, text: n.text, at: n.at })),
          },
          diff_live: listing.live ? diffContent(listing.live, listing.content) : null,
          versions: versions.map((v) => ({ version: v.version, at: v.at, by: String(v.by), kind: v.kind, changes: v.changes })),
          timeline: timeline.map((t) => ({ type: t.type, at: t.at, kind: t.actor_kind, actor: t.actor_id ? String(t.actor_id) : null, reason: t.reason, message: t.message, meta: t.meta })),
          reports: reports.map((r) => ({ id: String(r._id), reason: r.reason, text: r.text, status: r.status, at: r.created_at })),
          pending_reviews: pendingReviews, verification, settings, catalog, checklist_items: CHECKLIST_ITEMS,
        });
      }
      const body = (await readJson(request)) || {};
      if (action === 'delete' && method === 'DELETE') { await deleteListing(db, listing, { actor: admin, kind: 'admin' }); return json({ ok: true }); }
      if (action === 'approve' && method === 'POST') {
        const settings = await getSettings(db);
        const next = await approveListing(db, listing, admin, { checklist: body.checklist, note: body.note }, settings);
        return json({ ok: true, status: next.status });
      }
      if (action === 'request-changes' && method === 'POST') { const n = await requestChanges(db, listing, admin, { areas: body.areas, message: body.message }); return json({ ok: true, status: n.status, update_state: n.update_state }); }
      if (action === 'reject' && method === 'POST') { const n = await rejectListing(db, listing, admin, { reason: body.reason, message: body.message }); return json({ ok: true, status: n.status }); }
      if (action === 'suspend' && method === 'POST') { const n = await suspendListing(db, listing, admin, { reason: body.reason }); return json({ ok: true, status: n.status }); }
      if (action === 'unpublish' && method === 'POST') { const n = await unpublishListing(db, listing, admin, { reason: body.reason }); return json({ ok: true, status: n.status }); }
      if (action === 'publish' && method === 'POST') { const n = await publishListing(db, listing, admin); return json({ ok: true, status: n.status }); }
      if (action === 'note' && method === 'POST') return json({ ok: true, note: await addInternalNote(db, listing, admin, body.text) });
      if (action === 'checklist' && method === 'PUT') return json({ ok: true, checklist: await setChecklist(db, listing, admin, body.checklist) });
      if (action === 'badges' && method === 'PUT') {
        const cat = await getCatalog(db, { includeDisabled: true });
        const n = await setBadges(db, listing, admin, body.badges, new Set(cat.badges.map((b) => b.key)));
        return json({ ok: true, badges: n.badges });
      }
      if (action === 'feature' && method === 'PUT') { const settings = await getSettings(db); const n = await setFeatured(db, listing, admin, body.featured === null ? null : body, settings); return json({ ok: true, featured: n.featured }); }
      if (action === 'feature' && method === 'DELETE') { const n = await setFeatured(db, listing, admin, null, {}); return json({ ok: true, featured: n.featured }); }
      if (action === 'category' && method === 'PUT') {
        const catalog = await getCatalog(db, { includeDisabled: true });
        const cats = new Set(catalog.categories.filter((c) => !c.parent).map((c) => c.slug));
        if (!cats.has(body.category)) return validation([{ field: 'category', code: 'invalid_choice' }]);
        const old = { category: listing.content.category, subcategory: listing.content.subcategory };
        const sub = catalog.categories.find((c) => c.slug === body.subcategory && c.parent === body.category) ? body.subcategory : '';
        const set = { 'content.category': body.category, 'content.subcategory': sub };
        if (listing.live) { set['live.category'] = body.category; set['live.subcategory'] = sub; set['pub.category'] = body.category; set['pub.subcategory'] = sub; }
        await db.collection(C.listings).updateOne({ _id: listing._id }, { $set: set });
        await addAudit(db, { admin, action: 'category_changed', listing, old, next: { category: body.category, subcategory: sub } });
        return json({ ok: true });
      }
      if (action === 'recheck' && method === 'POST') return json({ verification: await discordVerification(listing) });
    }

    if (sec === 'reports') {
      if (method === 'GET' && !id) {
        const st = url.searchParams.get('status');
        const filter = REPORT_STATUSES.includes(st) ? { status: st } : {};
        const page = Math.max(0, Number.parseInt(url.searchParams.get('page'), 10) || 0);
        const [total, rows] = await Promise.all([db.collection(C.reports).countDocuments(filter), db.collection(C.reports).find(filter).sort({ created_at: -1 }).skip(page * 20).limit(20).toArray()]);
        const listings = await db.collection(C.listings).find({ _id: { $in: rows.map((r) => r.listing_id) } }, { projection: { slug: 1, 'content.name': 1, status: 1 } }).toArray();
        const lm = new Map(listings.map((l) => [String(l._id), l]));
        const names = await ownerNames(rows.map((r) => r.reporter_id));
        return json({ total, page, items: rows.map((r) => ({ id: String(r._id), listing_id: String(r.listing_id), slug: lm.get(String(r.listing_id))?.slug, name: lm.get(String(r.listing_id))?.content?.name, listing_status: lm.get(String(r.listing_id))?.status, reporter: names.get(String(r.reporter_id))?.name || String(r.reporter_id), reason: r.reason, text: r.text, status: r.status, at: r.created_at, resolution: r.resolution })) });
      }
      if (method === 'PATCH' && id) {
        const _id = oid(id); const report = _id && await db.collection(C.reports).findOne({ _id });
        if (!report) return err('not_found', 404);
        const body = (await readJson(request)) || {};
        const listing = await db.collection(C.listings).findOne({ _id: report.listing_id });
        if (body.action && listing) {
          if (body.action === 'suspend') await suspendListing(db, listing, admin, { reason: body.reason || body.resolution });
          else if (body.action === 'unpublish') await unpublishListing(db, listing, admin, { reason: body.reason || body.resolution });
          else if (body.action === 'request_changes') await requestChanges(db, listing, admin, { areas: body.areas || ['other'], message: body.message || body.resolution });
          else return err('invalid_state');
        }
        await updateReport(db, report, admin, { status: body.status || (body.action ? 'resolved' : report.status), resolution: body.resolution });
        return json({ ok: true });
      }
    }

    if (sec === 'reviews') {
      if (method === 'GET' && !id) {
        const st = ['pending', 'approved', 'rejected', 'removed'].includes(url.searchParams.get('status')) ? url.searchParams.get('status') : 'pending';
        const page = Math.max(0, Number.parseInt(url.searchParams.get('page'), 10) || 0);
        const [total, rows] = await Promise.all([db.collection(C.reviews).countDocuments({ status: st }), db.collection(C.reviews).find({ status: st }).sort({ created_at: -1 }).skip(page * 20).limit(20).toArray()]);
        const listings = await db.collection(C.listings).find({ _id: { $in: rows.map((r) => r.listing_id) } }, { projection: { slug: 1, 'content.name': 1 } }).toArray();
        const lm = new Map(listings.map((l) => [String(l._id), l]));
        return json({ total, page, items: rows.map((r) => ({ id: String(r._id), slug: lm.get(String(r.listing_id))?.slug, name: lm.get(String(r.listing_id))?.content?.name, author: r.author_name, rating: r.rating, text: r.text, status: r.status, at: r.created_at })) });
      }
      if (method === 'PATCH' && id) {
        const _id = oid(id); const review = _id && await db.collection(C.reviews).findOne({ _id });
        if (!review) return err('not_found', 404);
        const body = (await readJson(request)) || {};
        await moderateReview(db, review, admin, body.decision, body.reason);
        return json({ ok: true });
      }
    }

    if (sec === 'featured' && method === 'GET') {
      const rows = await db.collection(C.listings).find({ featured: { $ne: null } }, { projection: { slug: 1, 'content.name': 1, featured: 1, status: 1 } }).sort({ 'featured.end': -1 }).limit(100).toArray();
      return json({ items: rows.map((l) => ({ id: String(l._id), slug: l.slug, name: l.content?.name, status: l.status, placement: l.featured.placement, priority: l.featured.priority, start: l.featured.start, end: l.featured.end })) });
    }

    if (sec === 'catalog' && id && KINDS[id]) {
      const coll = db.collection(KINDS[id]);
      const sub = action;
      if (method === 'GET' && !sub) {
        const rows = await coll.find({}).sort({ order: 1 }).toArray();
        const usage = await db.collection(C.listings).aggregate([{ $match: { status: { $ne: 'draft' } } }, { $group: { _id: id === 'categories' ? '$content.category' : id === 'tags' ? '$content.tags' : '$content.features', n: { $sum: 1 } } }]).toArray().catch(() => []);
        return json({ items: rows.map((r) => ({ id: String(r._id), slug: r.slug, parent: r.parent || null, order: r.order, enabled: r.enabled !== false, names: r.names || {}, seo_slug: r.seo_slug || null })), usage: usage.length });
      }
      if (method === 'POST' && !sub) {
        const body = (await readJson(request)) || {};
        const slug = String(body.slug || '').toLowerCase();
        if (!SLUG.test(slug)) return validation([{ field: 'slug', code: 'invalid_slug' }]);
        const names = cleanNames(body.names);
        if (!Object.keys(names).length) return validation([{ field: 'names', code: 'required' }]);
        const doc = { slug, order: Number(body.order) || (await coll.countDocuments({})) + 1, enabled: true, names, created_at: new Date() };
        if (id === 'categories') {
          doc.parent = body.parent ? String(body.parent) : null;
          if (doc.parent && !(await coll.findOne({ slug: doc.parent, parent: null }))) return validation([{ field: 'parent', code: 'invalid_choice' }]);
          doc.seo_slug = String(body.seo_slug || slug).toLowerCase().replace(/[^a-z0-9-]+/g, '-').slice(0, 60);
        }
        try { await coll.insertOne(doc); } catch (e) { if (e?.code === 11000) return err('duplicate', 409); throw e; }
        resetCatalogCache();
        await addAudit(db, { admin, action: `${id}_created`, target: slug, next: doc });
        return json({ ok: true }, { status: 201 });
      }
      if (method === 'POST' && sub === 'reorder') {
        const body = (await readJson(request)) || {};
        const ids = (Array.isArray(body.ids) ? body.ids : []).map(oid).filter(Boolean).slice(0, 500);
        await Promise.all(ids.map((_id, i) => coll.updateOne({ _id }, { $set: { order: i } })));
        resetCatalogCache();
        await addAudit(db, { admin, action: `${id}_reordered`, target: id });
        return json({ ok: true });
      }
      const _id = sub ? oid(sub) : null;
      if (_id && (method === 'PATCH' || method === 'DELETE')) {
        const doc = await coll.findOne({ _id });
        if (!doc) return err('not_found', 404);
        if (method === 'DELETE') {
          const field = id === 'categories' ? 'content.category' : id === 'tags' ? 'content.tags' : 'content.features';
          const used = await db.collection(C.listings).countDocuments({ [field]: doc.slug });
          if (used) return err('in_use', 409, { used });
          await coll.deleteOne({ _id });
          resetCatalogCache();
          await addAudit(db, { admin, action: `${id}_deleted`, target: doc.slug, old: doc });
          return json({ ok: true });
        }
        const body = (await readJson(request)) || {};
        const set = {};
        if (body.enabled !== undefined) set.enabled = Boolean(body.enabled);
        if (body.names !== undefined) set.names = cleanNames(body.names);
        if (body.order !== undefined && Number.isFinite(Number(body.order))) set.order = Number(body.order);
        if (id === 'categories' && body.seo_slug !== undefined) set.seo_slug = String(body.seo_slug).toLowerCase().replace(/[^a-z0-9-]+/g, '-').slice(0, 60);
        await coll.updateOne({ _id }, { $set: set });
        resetCatalogCache();
        await addAudit(db, { admin, action: `${id}_updated`, target: doc.slug, old: { enabled: doc.enabled, names: doc.names, seo_slug: doc.seo_slug }, next: set });
        return json({ ok: true });
      }
    }

    if (sec === 'badges') {
      const coll = db.collection(C.badges);
      if (method === 'GET') return json({ items: (await coll.find({}).toArray()).map((b) => ({ id: String(b._id), key: b.key, color: b.color, icon: b.icon, official: b.official !== false, names: b.names || {} })) });
      const body = (await readJson(request)) || {};
      if (method === 'POST') {
        const key = String(body.key || '').toLowerCase();
        if (!/^[a-z0-9_]{2,30}$/.test(key)) return validation([{ field: 'key', code: 'invalid_slug' }]);
        if (!/^#[0-9a-fA-F]{6}$/.test(body.color || '')) return validation([{ field: 'color', code: 'invalid_color' }]);
        try { await coll.insertOne({ key, color: body.color.toLowerCase(), icon: String(body.icon || 'star').slice(0, 30), official: true, names: cleanNames(body.names), created_at: new Date() }); } catch (e) { if (e?.code === 11000) return err('duplicate', 409); throw e; }
        resetCatalogCache();
        await addAudit(db, { admin, action: 'badge_created', target: key });
        return json({ ok: true }, { status: 201 });
      }
      const _id = oid(id);
      if (_id && method === 'PATCH') {
        const set = {};
        if (body.color !== undefined) { if (!/^#[0-9a-fA-F]{6}$/.test(body.color)) return validation([{ field: 'color', code: 'invalid_color' }]); set.color = body.color.toLowerCase(); }
        if (body.names !== undefined) set.names = cleanNames(body.names);
        await coll.updateOne({ _id }, { $set: set }); resetCatalogCache();
        await addAudit(db, { admin, action: 'badge_updated', target: String(id), next: set });
        return json({ ok: true });
      }
      if (_id && method === 'DELETE') {
        const b = await coll.findOne({ _id });
        if (!b) return err('not_found', 404);
        if (await db.collection(C.listings).countDocuments({ badges: b.key })) return err('in_use', 409);
        await coll.deleteOne({ _id }); resetCatalogCache();
        await addAudit(db, { admin, action: 'badge_deleted', target: b.key });
        return json({ ok: true });
      }
    }

    if (sec === 'analytics' && method === 'GET') return json(await adminAnalytics(db, url.searchParams.get('range')));

    if (sec === 'audit' && method === 'GET') {
      const sp = url.searchParams; const filter = {};
      if (sp.get('action')) filter.action = String(sp.get('action')).slice(0, 40);
      if (sp.get('target')) filter.target_slug = String(sp.get('target')).slice(0, 64);
      const page = Math.max(0, Number.parseInt(sp.get('page'), 10) || 0);
      const [total, rows] = await Promise.all([db.collection(C.audit).countDocuments(filter), db.collection(C.audit).find(filter).sort({ at: -1 }).skip(page * 30).limit(30).toArray()]);
      const names = await ownerNames(rows.map((r) => r.admin_id).filter(Boolean));
      return json({ total, page, items: rows.map((r) => ({ id: String(r._id), at: r.at, admin: r.admin_id ? String(r.admin_id) : null, admin_name: names.get(String(r.admin_id))?.name || null, action: r.action, target: r.target_slug || r.target, name: r.target_name, reason: r.reason, old: r.old, new: r.new })) });
    }

    if (sec === 'settings') {
      if (method === 'GET') return json({ settings: await getSettings(db) });
      if (method === 'PUT') {
        const body = (await readJson(request)) || {};
        const { out, errors } = validateSettings(body);
        if (errors.length) return validation(errors);
        const old = await getSettings(db);
        await db.collection(C.settings).updateOne({ _id: 'main' }, { $set: { ...out, updated_at: new Date() } }, { upsert: true });
        resetCatalogCache();
        await addAudit(db, { admin, action: 'settings_changed', old: Object.fromEntries(Object.keys(out).map((k) => [k, old[k]])), next: out });
        return json({ ok: true, settings: { ...old, ...out } });
      }
    }

    if (sec === 'notifications') {
      if (method === 'GET') {
        const rows = await db.collection(C.notifications).find({ to: 'admin' }).sort({ created_at: -1 }).limit(50).toArray();
        return json({ items: rows.map((n) => ({ id: String(n._id), type: n.type, slug: n.slug, name: n.name, params: n.params, at: n.created_at, read: n.read, listing_id: String(n.listing_id) })), unread: rows.filter((n) => !n.read).length });
      }
      if (method === 'POST') { await db.collection(C.notifications).updateMany({ to: 'admin', read: false }, { $set: { read: true } }); return json({ ok: true }); }
    }
  } catch (e) { return fromError(e); }
  return null;
}

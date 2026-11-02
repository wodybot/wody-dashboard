// Public + signed-in visitor API (discovery data, favorites, reviews, reports, images, join).
import { NextResponse } from 'next/server';
import { toLong } from '@/lib/mongo';
import { getUserGuilds, snowflakeDate } from '@/lib/discord';
import { C, getCatalog, getSettings } from './db.js';
import { json, err, readJson, limited, sessionUser, fromError, isCommunityAdmin, resolveAccess } from './api-util.js';
import { searchListings, discoveryHome, inviteAvailable } from './query.js';
import { visitorHash, recordEvent } from './analytics.js';
import { addFavorite, removeFavorite, isFavorite, favoriteListings, listReviews, submitReview, createReport } from './social.js';
import { publicCard } from './query.js';
import { loadImage } from './images.js';
import { SORTS, MEMBER_BANDS, ACTIVITY_LEVELS, SERVER_TYPES } from './constants.js';
import { oid } from './lifecycle.js';

const csv = (v, max = 8) => String(v || '').split(',').map((s) => s.trim()).filter(Boolean).slice(0, max);

export function parseSearchParams(sp) {
  const get = (k) => (typeof sp.get === 'function' ? sp.get(k) : sp[k]) || '';
  const sort = SORTS.includes(get('sort')) ? get('sort') : 'recommended';
  const members = MEMBER_BANDS.includes(get('members')) && get('members') !== 'any' ? get('members') : '';
  const activity = ACTIVITY_LEVELS.includes(get('activity')) && get('activity') !== 'any' ? get('activity') : '';
  return {
    q: String(get('q')).slice(0, 80), category: String(get('category')).slice(0, 60), subcategory: String(get('sub')).slice(0, 80),
    tags: csv(get('tags')), languages: csv(get('lang'), 5), features: csv(get('features')), members, activity,
    server_type: SERVER_TYPES.includes(get('type')) ? get('type') : '', sort, page: Math.max(0, Math.min(500, Number.parseInt(get('page'), 10) || 0)),
  };
}

const iconCache = new Map();
async function fetchIcon(listing) {
  const hash = listing.stats?.icon_hash;
  if (!hash || !/^(a_)?[a-f0-9]{32}$/.test(hash)) return null;
  const key = `${listing._id}:${hash}`;
  const hit = iconCache.get(key);
  if (hit && Date.now() - hit.at < 3600_000) return hit;
  const res = await fetch(`https://cdn.discordapp.com/icons/${String(listing.guild_id)}/${hash}.png?size=128`, { cache: 'no-store' });
  if (!res.ok) return null;
  const buf = Buffer.from(await res.arrayBuffer());
  const row = { at: Date.now(), buf };
  iconCache.set(key, row);
  if (iconCache.size > 300) iconCache.delete(iconCache.keys().next().value);
  return row;
}

async function publishedBySlug(db, slug) {
  return db.collection(C.listings).findOne({ slug: String(slug || '').toLowerCase().slice(0, 64), status: 'published' });
}

export async function handlePublic({ request, db, parts, method, url }) {
  const [head, a, b, c] = parts;

  if (method === 'GET' && head === 'public' && a === 'home') return json(await discoveryHome(db), { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } });

  if (method === 'GET' && head === 'public' && a === 'catalog') {
    const cat = await getCatalog(db);
    return json({ categories: cat.categories, tags: cat.tags, features: cat.features, badges: cat.badges }, { headers: { 'Cache-Control': 'public, s-maxage=120' } });
  }

  if (method === 'GET' && head === 'public' && a === 'search') {
    if (await limited(db, 'search:all', 3000, 60)) return err('rate_limited', 429);
    return json(await searchListings(db, parseSearchParams(url.searchParams)), { headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=120' } });
  }

  if (method === 'GET' && head === 'public' && a === 'reviews' && b) {
    const listing = await publishedBySlug(db, b);
    if (!listing) return err('not_found', 404);
    const page = Math.max(0, Number.parseInt(url.searchParams.get('page'), 10) || 0);
    return json(await listReviews(db, listing._id, { page, size: 10 }));
  }

  if (method === 'POST' && head === 'public' && a === 'view') {
    const body = await readJson(request);
    if (!body) return err('invalid_body');
    const settings = await getSettings(db);
    if (!settings.analytics_enabled) return json({ ok: true, counted: false });
    const listing = await publishedBySlug(db, body.slug);
    if (!listing) return err('not_found', 404);
    const hash = visitorHash(request.headers);
    const counted = await recordEvent(db, listing, 'view', hash);
    return json({ ok: true, counted });
  }

  if (method === 'GET' && head === 'join' && a) {
    const listing = await publishedBySlug(db, a);
    if (!listing || !inviteAvailable(listing)) return err('invite_unavailable', 404);
    const settings = await getSettings(db);
    if (settings.analytics_enabled) await recordEvent(db, listing, 'click', visitorHash(request.headers)).catch(() => {});
    return NextResponse.redirect(`https://discord.gg/${listing.live.invite_code}`, { status: 302, headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } });
  }

  if (method === 'GET' && head === 'icon' && a) {
    const listing = await publishedBySlug(db, a);
    if (!listing) return err('not_found', 404);
    const row = await fetchIcon(listing).catch(() => null);
    if (!row) return err('not_found', 404);
    return new NextResponse(row.buf, { headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400', 'X-Content-Type-Options': 'nosniff' } });
  }

  if (method === 'GET' && head === 'img' && a) {
    const img = await loadImage(db, a);
    if (!img) return err('not_found', 404);
    const listing = await db.collection(C.listings).findOne({ _id: img.listing_id });
    let isPublic = false;
    if (listing?.status === 'published' && listing.live) {
      const used = [listing.live.banner_id, listing.live.background_id].filter(Boolean).map(String);
      isPublic = used.includes(String(img._id));
    }
    if (!isPublic) {
      const s = await sessionUser();
      if (!s) return err('not_found', 404);
      if (!(await isCommunityAdmin(db, s.user.id))) {
        const access = await resolveAccess(db, s, listing ? String(listing.guild_id) : '0');
        if (!listing || !access.role) return err('not_found', 404);
      }
    }
    const buf = Buffer.isBuffer(img.data) ? img.data : Buffer.from(img.data.buffer || img.data);
    return new NextResponse(buf, {
      headers: {
        'Content-Type': img.mime, 'Content-Length': String(buf.length), 'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'", 'Cross-Origin-Resource-Policy': 'same-site',
        // Every upload gets a new id and its bytes never change, so a draft image can be cached by
        // the owner's own browser too (private): switching tabs and the live preview show it instantly.
        'Cache-Control': isPublic ? 'public, max-age=31536000, s-maxage=31536000, immutable' : 'private, max-age=86400, immutable',
      },
    });
  }

  // ---------------- signed-in visitor ----------------
  if (head === 'me') {
    const s = await sessionUser();
    if (!s) return err('unauthenticated', 401);
    const uid = String(s.user.id);
    if (await limited(db, `me:${uid}`, 90, 60)) return err('rate_limited', 429);

    if (a === 'favorites' && method === 'GET') {
      const catalog = await getCatalog(db);
      return json({ items: await favoriteListings(db, uid, { publicCard, catalog }) });
    }
    if (a === 'favorites' && method === 'POST') {
      const body = await readJson(request); const listing = body && await publishedBySlug(db, body.slug);
      if (!listing) return err('not_found', 404);
      if (await limited(db, `fav:${uid}`, 40, 3600)) return err('rate_limited', 429);
      await addFavorite(db, uid, listing);
      return json({ ok: true, favorite: true });
    }
    if (a === 'favorites' && method === 'DELETE') {
      const listing = await publishedBySlug(db, url.searchParams.get('slug'));
      if (!listing) return err('not_found', 404);
      await removeFavorite(db, uid, listing);
      return json({ ok: true, favorite: false });
    }
    if (a === 'state' && method === 'GET') {
      const listing = await publishedBySlug(db, url.searchParams.get('slug'));
      if (!listing) return err('not_found', 404);
      const review = await db.collection(C.reviews).findOne({ listing_id: listing._id, user_id: toLong(uid) });
      return json({ favorite: await isFavorite(db, uid, listing._id), review: review ? { rating: review.rating, text: review.text, status: review.status } : null, is_admin: await isCommunityAdmin(db, uid) });
    }
    if (a === 'review' && method === 'POST') {
      try {
        const body = await readJson(request); const listing = body && await publishedBySlug(db, body.slug);
        if (!listing) return err('not_found', 404);
        if (await limited(db, `review:${uid}`, 6, 3600)) return err('rate_limited', 429);
        const settings = await getSettings(db);
        const created = snowflakeDate(uid);
        if (settings.reviews_min_account_days && created && Date.now() - created.getTime() < settings.reviews_min_account_days * 86400_000) return err('account_too_new', 403);
        let guilds = [];
        try { guilds = await getUserGuilds(s.accessToken); } catch { return err('temporarily_unavailable', 503); }
        const isMember = guilds.some((g) => String(g.id) === String(listing.guild_id));
        const mgr = await db.collection(C.managers).findOne({ listing_id: listing._id, user_id: toLong(uid) }, { projection: { _id: 1 } });
        const g = guilds.find((x) => String(x.id) === String(listing.guild_id));
        const isStaff = Boolean(mgr) || Boolean(g?.owner);
        const r = await submitReview(db, { listing, userId: uid, authorName: s.user.global_name || s.user.username, rating: body.rating, text: body.text, settings, isMember, isStaff });
        return json({ ok: true, ...r });
      } catch (e) { return fromError(e); }
    }
    if (a === 'report' && method === 'POST') {
      try {
        const body = await readJson(request); const listing = body && await publishedBySlug(db, body.slug);
        if (!listing) return err('not_found', 404);
        const settings = await getSettings(db);
        if (await limited(db, `report:${uid}`, settings.reports_rate_limit_per_day || 10, 86400)) return err('rate_limited', 429);
        const id = await createReport(db, { listing, userId: uid, reason: body.reason, text: body.text, settings });
        return json({ ok: true, id });
      } catch (e) { return fromError(e); }
    }
    if (a === 'notifications' && method === 'GET') {
      const rows = await db.collection(C.notifications).find({ to: uid }).sort({ created_at: -1 }).limit(40).toArray();
      return json({ items: rows.map((n) => ({ id: String(n._id), type: n.type, slug: n.slug, name: n.name, params: n.params || {}, at: n.created_at, read: n.read })), unread: rows.filter((n) => !n.read).length });
    }
    if (a === 'notifications' && b === 'read' && method === 'POST') {
      await db.collection(C.notifications).updateMany({ to: uid, read: false }, { $set: { read: true } });
      return json({ ok: true });
    }
  }
  return null;
}

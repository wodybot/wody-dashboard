import crypto from 'crypto';
import { isAccountBlocked } from '@/lib/account-moderation';
import { ObjectId } from 'mongodb';
import { M, getCategories, getSettings, resetCategoryCache, auditLog } from './db.js';
import { PUBLIC_STATUS as LISTING_PUBLIC } from '@/lib/community/constants.js';
import { normalizeSocials, cleanNotif, cleanAway, awayActive, publicAway, publicSocials, tiktokState, identityFields } from './profile.js';
import { tiktokStatus } from '@/lib/streams/tiktok';
import { SERVER_CAT_LIMITS as LIMITS_CAT, STATUS, LIMITS, REPORT_REASONS, REJECT_REASONS, LOCALES, CATEGORY_RE, DEFAULT_SETTINGS, SERVER_CAT_PREFIX, isServerCat } from './constants.js';
import {
  json, err, readJson, limited, sessionUser, isStaff, actorOf, eligibleGuilds, isGuildOwner, sniffImage, trustedOrigin,
} from './api-util.js';
import {
  CollabError, oid, saveDraft, deleteDraft, submitRequest, decide, restore, discardPending, closeRequest, reopenRequest, renewRequest, reportRequest,
  applyToRequest, withdrawApplication, removeRequest, staffRemoveRequest, setApplicationStatus, selectApplication, sendMessage, diffContent, publicFilter, sweepExpired,
} from './lifecycle.js';
import { homeSections, recent, discover, forYou, recentlyUpdated, categoryStats, publicRequest } from './query.js';
import { findPersonalContact } from './guard.js';
import { cleanBlock, cleanLine } from './validation.js';
import { toLong } from '@/lib/mongo';
import { getGuildChannelsResult, getBotGuild, getGuildRolesResult, getGuildMemberRaw } from '@/lib/discord';
import { listGuildCategories, adminView as catView, serverCategorySlugs, createGuildCategory, updateGuildCategory, deleteGuildCategory, assertCategoryAccess, canPostInCategory } from './server-categories.js';
import { notifyOwnerChannelChange } from './announce.js';
import { fetchPublicImage } from './fetch-image.js';
import { consumePass } from '@/lib/humancheck';
import { OWNER_ID } from '@/lib/owner-access';

const MIME_OK = new Set(['image/jpeg', 'image/png', 'image/webp']);
const idsOf = (v) => String(v || '').split(',').map((s) => s.trim()).filter((s) => /^[a-f0-9]{24}$/.test(s)).slice(0, 300);
const snow = (v) => (/^\d{15,25}$/.test(String(v || '')) ? String(v) : null);
const catsFor = async (db, guildId) => {
  if (!guildId) return catSet(db);
  const own = await serverCategorySlugs(db, guildId);
  if (!own.size) throw new CollabError('server_no_categories', 400);
  return own;
};
const snowId = (v) => (/^\d{15,25}$/.test(String(v || '')) ? String(v) : '');
const staffOf = (session) => async (gid) => {
  const e = await eligibleGuilds(session);
  if (e.unavailable) throw new CollabError('discord_unavailable', 503);
  const g = e.guilds.find((x) => x.id === String(gid));
  return Boolean(g && (g.owner || g.manage));
};
const assertInServer = async (db, session, guildId) => {
  if (!guildId) return;
  const e = await eligibleGuilds(session);
  if (e.unavailable) throw new CollabError('discord_unavailable', 503);
  const g = e.guilds.find((x) => x.id === guildId);
  if (!g || !(await listedGuildIds(db, [g.id])).includes(g.id)) throw new CollabError('validation_failed', 400, { errors: [{ field: 'origin_guild_id', code: 'invalid_server' }] });
};
const memberOf = async (gid, uid) => (await getGuildMemberRaw(gid, uid)) || { roles: [] };
const catCtx = (session) => ({ userId: String(session.user.id), isStaffOfGuild: staffOf(session), getMember: memberOf });
const catSet = async (db) => new Set((await getCategories(db)).map((c) => c.slug));
const iso = (d) => (d ? new Date(d).toISOString() : null);

function ownerView(r) {
  return {
    id: String(r._id), status: r.status, pending_state: r.pending_state || null, content: r.content, live: r.live || null, review_queue: r.review_queue || null,
    review_reasons: r.review_reasons || [], decision: r.decision ? { action: r.decision.action, reason: r.decision.reason, scope: r.decision.scope, at: iso(r.decision.at) } : null,
    suspended: r.suspended ? { reason: r.suspended.reason, at: iso(r.suspended.at), automatic: r.suspended.by === 'system' } : null, origin_guild_id: r.origin_guild_id || null, origin_guild_name: r.origin_guild_name || null,
    created_at: iso(r.created_at), updated_at: iso(r.updated_at), published_at: iso(r.published_at), expires_at: iso(r.expires_at), closed_at: iso(r.closed_at),
    applications: r.app_count || 0, accepted_application_id: r.accepted_application_id ? String(r.accepted_application_id) : null, version_id: r.version_id ? String(r.version_id) : null,
  };
}

function modView(r, check, versions, decisions, reports) {
  const live = r.live || null;
  return {
    id: String(r._id), status: r.status, pending_state: r.pending_state || null, queue: r.review_queue, reasons: r.review_reasons || [], risk: r.risk ?? 0, escalated: Boolean(r.escalated),
    author: r.author, origin_guild_id: r.origin_guild_id, origin_guild_name: r.origin_guild_name, queued_at: iso(r.queued_at), created_at: iso(r.created_at), published_at: iso(r.published_at),
    analysed: r.content, version_id: r.version_id ? String(r.version_id) : null, live, live_version_id: r.live_version_id ? String(r.live_version_id) : null, diff: live ? diffContent(live, r.content) : [],
    suspended: r.suspended || null,
    check: check ? { id: String(check._id), version: check.version, flagged: check.flagged, risk: check.risk, financial: check.financial, signals: check.signals, ai: check.ai, error: check.error, false_positive: Boolean(check.false_positive), at: iso(check.at) } : null,
    versions: versions.map((v) => ({ id: String(v._id), n: v.n, state: v.state, hash: v.hash, at: iso(v.created_at), title: v.content?.title })),
    decisions: decisions.map((d) => ({ scope: d.scope, action: d.action, actor: d.actor, reason: d.reason, note: d.note, version_id: d.version_id, at: iso(d.at) })),
    reports: reports.map((x) => ({ reporter: x.reporter_id, reason: x.reason, details: x.details, status: x.status, at: iso(x.created_at) })),
  };
}

async function loadMod(db, id) {
  const _id = oid(id); if (!_id) return null;
  const r = await db.collection(M.requests).findOne({ _id });
  if (!r) return null;
  const [check, versions, decisions, reports] = await Promise.all([
    r.check_id ? db.collection(M.checks).findOne({ _id: r.check_id }) : null,
    db.collection(M.versions).find({ request_id: _id }).sort({ n: -1 }).limit(20).toArray(),
    db.collection(M.decisions).find({ request_id: _id }).sort({ at: -1 }).limit(50).toArray(),
    db.collection(M.reports).find({ request_id: _id }).sort({ created_at: -1 }).limit(50).toArray(),
  ]);
  return modView(r, check, versions, decisions, reports);
}

export async function handle({ request, db, parts, method, url }) {
  const [head, a, b, c, d] = parts;
  const mutating = method !== 'GET' && method !== 'HEAD';
  if (mutating && !trustedOrigin(request)) return err('forbidden_origin', 403);

  if (method === 'GET' && head === 'home') {
    const s = await sessionUser();
    const category = CATEGORY_RE.test(url.searchParams.get('category') || '') ? url.searchParams.get('category') : '';
    const seed = String(url.searchParams.get('seed') || crypto.randomBytes(6).toString('hex')).slice(0, 40);
    const guild = snowId(url.searchParams.get('guild'));
    return json(await homeSections(db, { userId: s?.user?.id, category, seed, guild }));
  }
  if (method === 'GET' && head === 'section') {
    if (await limited(db, 'sec:all', 6000, 60)) return err('rate_limited', 429);
    const s = await sessionUser();
    const category = CATEGORY_RE.test(url.searchParams.get('category') || '') ? url.searchParams.get('category') : '';
    const seed = String(url.searchParams.get('seed') || crypto.randomBytes(6).toString('hex')).slice(0, 40);
    const cursor = url.searchParams.get('cursor') || '';
    const guild = snowId(url.searchParams.get('guild'));
    if (a === 'recent') return json(await recent(db, { category, cursor, guild }));
    if (a === 'discover') return json(await discover(db, { seed, category, seen: idsOf(url.searchParams.get('seen')), guild }));
    if (a === 'for_you') return json(await forYou(db, s?.user?.id, { category, guild }));
    if (a === 'updated') return json(await recentlyUpdated(db, { category, guild }));
    return err('not_found', 404);
  }
  if (method === 'GET' && head === 'guild' && snowId(a) && b === 'categories') {
    if (await limited(db, 'gc:all', 3000, 60)) return err('rate_limited', 429);
    const rows = (await listGuildCategories(db, a, { includeDisabled: false })).filter((c) => c.slug);
    const s = await sessionUser();
    let staff = false;
    if (s && rows.length) { try { staff = await staffOf(s)(a); } catch { staff = false; } }
    const out = [];
    for (const c of rows) {
      let can = false; let reason = null;
      if (s) { const r = await canPostInCategory(c, { userId: String(s.user.id), staff, getMember: memberOf }); can = r.ok; reason = r.reason || null; }
      out.push({ slug: c.slug, name: c.name, access: c.access, can_post: can, reason });
    }
    const g = await getBotGuild(a).catch(() => null);
    return json({ guild: g ? { id: String(a), name: String(g.name || '').slice(0, 100) } : null, categories: out }, { headers: { 'Cache-Control': 'private, no-store' } });
  }
  if (method === 'GET' && head === 'categories') return json(await categoryStats(db), { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } });
  if (method === 'GET' && head === 'request' && a && !b) {
    const r = await publicRequest(db, a);
    return r ? json(r) : err('not_found', 404);
  }
  if (method === 'GET' && head === 'file' && a) {
    const _id = oid(a); if (!_id) return err('not_found', 404);
    const f = await db.collection(M.files).findOne({ _id });
    if (!f) return err('not_found', 404);
    let allowed = false;
    if (f.request_id) {
      const r = await db.collection(M.requests).findOne({ _id: f.request_id, ...publicFilter() }, { projection: { live: 1 } });
      allowed = Boolean(r?.live?.attachments?.includes(String(_id)));
    }
    if (!allowed) {
      const s = await sessionUser();
      if (s && (String(s.user.id) === f.owner_id || await isStaff(db, s.user.id))) allowed = true;
    }
    if (!allowed) return err('not_found', 404);
    return new Response(f.data.buffer ? Buffer.from(f.data.buffer) : f.data, { headers: { 'Content-Type': f.mime, 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; sandbox", 'Cache-Control': 'private, max-age=300' } });
  }

  if (head === 'request' && a && b === 'contact' && method === 'POST') {
    const settings = await getSettings(db);
    if (!settings.public_contact_enabled) return err('disabled', 403);
    if (await limited(db, 'pc:all', 600, 3600)) return err('rate_limited', 429);
    const body = await readJson(request, 8 * 1024); if (!body) return err('bad_request', 400);
    const _id = oid(a);
    const req = _id && await db.collection(M.requests).findOne({ _id, ...publicFilter() });
    if (!req || !req.live.public_contact) return err('not_found', 404);
    if (await limited(db, `pcr:${a}`, 10, 86400)) return err('rate_limited', 429);
    if (body.website) return json({ ok: true });
    if (!(await consumePass(db, String(body.pass || ''), 'collab_contact', String(a)))) return err('captcha_failed', 400);
    const name = cleanLine(body.name, LIMITS.contactName.max);
    const text = cleanBlock(body.body, LIMITS.message.max);
    const reply = cleanLine(body.reply_to, 120);
    const errors = [];
    if (text.length < LIMITS.message.min) errors.push({ field: 'body', code: 'too_short', params: { min: LIMITS.message.min } });
    if (!name) errors.push({ field: 'name', code: 'required' });
    if (!reply) errors.push({ field: 'reply_to', code: 'required' });
    if ((text.match(/https?:\/\//gi) || []).length > 2) errors.push({ field: 'body', code: 'too_many_links' });
    if (errors.length) return err('validation_failed', 400, { errors });
    await db.collection(M.messages).insertOne({ request_id: req._id, to_user_id: req.author_id, kind: 'public', name, reply_to: reply, body: text, created_at: new Date(), read: false });
    const { notifyUser } = await import('./notify.js');
    await notifyUser(db, req.author_id, 'message_new', { title: req.card.title, request_id: req._id });
    return json({ ok: true });
  }

  const needsAuth = ['me', 'server', 'staff', 'upload', 'apply', 'report'].includes(head) || (head === 'request' && ['apply', 'report'].includes(b));
  if (!needsAuth) return null;
  const session = await sessionUser();
  if (!session) return err('unauthorized', 401);
  const user = session.user;
  const uid = String(user.id);
  if (mutating && await limited(db, `w:${uid}`, 90, 60)) return err('rate_limited', 429);

  if (head === 'staff') {
    if (!(await isStaff(db, uid))) return err('not_found', 404);
    return handleStaff({ request, db, parts, method, url, session });
  }
  if (head === 'server') return handleServer({ request, db, parts, method, url, session });

  if (head === 'me') {
    if (a === 'overview' && method === 'GET') {
      const [reqs, apps, unread] = await Promise.all([
        db.collection(M.requests).find({ author_id: uid, status: { $ne: STATUS.DELETED } }).sort({ updated_at: -1 }).limit(100).toArray(),
        db.collection(M.applications).find({ applicant_id: uid }).sort({ created_at: -1 }).limit(100).toArray(),
        db.collection(M.messages).countDocuments({ to_user_id: uid, read: false }),
      ]);
      return json({ requests: reqs.map(ownerView).map(({ content, live, ...r }) => ({ ...r, title: content?.title || live?.title || '', category: content?.category || '' })), applications: apps.map((x) => ({ id: String(x._id), request_id: String(x.request_id), title: x.request_title, status: x.status, created_at: iso(x.created_at) })), unread });
    }
    if (a === 'guilds' && method === 'GET') {
      const g = await eligibleGuilds(session);
      const ids = g.guilds.map((x) => x.id);
      const rows = await db.collection(M.servers).find({ guild_id: { $in: ids } }).toArray();
      const by = new Map(rows.map((r) => [r.guild_id, r.require_approval]));
      const ann = new Map(rows.map((r) => [r.guild_id, { announce_channel_id: r.announce_channel_id || null, announce_channel_name: r.announce_channel_name || null }]));
      const listed = new Set((await listedGuildIds(db, ids)));
      return json({ unavailable: g.unavailable, guilds: g.guilds.map((x) => ({ ...x, require_approval: Boolean(by.get(x.id)), ...(ann.get(x.id) || { announce_channel_id: null, announce_channel_name: null }), listed: listed.has(x.id) })) });
    }
    if (a === 'profile') {
      if (method === 'GET') {
        const p = await db.collection(M.profiles).findOne({ user_id: uid });
        const ttLink = await db.collection('user_tiktok_links').findOne({ user_id: uid }, { projection: { username: 1, display_name: 1 } }).catch(() => null);
        const idf = identityFields(user);
        if (idf.username_lc) await db.collection(M.profiles).updateOne({ user_id: uid }, { $set: idf, $setOnInsert: { created_at: new Date() } }, { upsert: true }).catch(() => {});
        const identity = { id: uid, name: user.global_name || user.username || '', username: user.username || '', avatar: user.avatar || null };
        const [open, live, apps, unread, unreadNotes] = await Promise.all([
          db.collection(M.requests).countDocuments({ author_id: uid, status: { $nin: [STATUS.DELETED, STATUS.DRAFT] } }),
          db.collection(M.requests).countDocuments({ author_id: uid, status: STATUS.PUBLISHED }),
          db.collection(M.applications).countDocuments({ applicant_id: uid }),
          db.collection(M.messages).countDocuments({ to_user_id: uid, read: false }),
          db.collection(M.notifications).countDocuments({ to: uid, read: false }),
        ]);
        return json({
          identity, locale: p?.locale || null, pref_categories: p?.pref_categories || [], pref_tags: p?.pref_tags || [], skills: p?.skills || [],
          socials: publicSocials(p, ttLink), share_socials: Boolean(p?.share_socials), notif: cleanNotif(null, p?.notif),
          tiktok: tiktokState(p, ttLink, tiktokStatus().available), public_path: idf.username_lc ? `/profile/${idf.username_lc}` : null,
          away: { ...cleanAway(null, p?.away).out, active: awayActive(p?.away) },
          stats: { requests: open, live, applications: apps, unread_messages: unread, unread_notifications: unreadNotes },
          member_since: iso(p?.created_at),
        });
      }
      if (method === 'PUT') {
        const body = await readJson(request); if (!body) return err('bad_request', 400);
        if ('socials' in body || 'share_socials' in body) {
          if (body.policy_accepted !== true) return err('policy_acceptance_required', 400);
          if (await isAccountBlocked(db, uid)) return err('account_blocked', 403);
        }
        const set = { updated_at: new Date() };
        if ('pref_categories' in body) { const cats = await catSet(db); set.pref_categories = (Array.isArray(body.pref_categories) ? body.pref_categories : []).filter((x) => cats.has(x)).slice(0, 10); }
        if ('pref_tags' in body) set.pref_tags = [...new Set((Array.isArray(body.pref_tags) ? body.pref_tags : []).map((t) => cleanLine(t, LIMITS.tags.each).toLowerCase()).filter(Boolean))].slice(0, 20);
        if (LOCALES.includes(body.locale)) set.locale = body.locale;
        if ('socials' in body) {
          const r = normalizeSocials(body.socials);
          if (r.errors.length) return err('validation_failed', 400, { errors: r.errors });
          delete r.socials.tiktok;
          set.socials = r.socials;
        }
        if (typeof body.tiktok_hidden === 'boolean') set.tiktok_hidden = body.tiktok_hidden;
        Object.assign(set, identityFields(user));
        if (typeof body.share_socials === 'boolean') set.share_socials = body.share_socials;
        if ('notif' in body) {
          const cur = await db.collection(M.profiles).findOne({ user_id: uid }, { projection: { notif: 1 } });
          set.notif = cleanNotif(body.notif, cur?.notif);
        }
        if ('away' in body) {
          const cur = await db.collection(M.profiles).findOne({ user_id: uid }, { projection: { away: 1 } });
          const r = cleanAway(body.away, cur?.away);
          if (r.error) return err('validation_failed', 400, { errors: [{ field: 'away', code: r.error }] });
          if (r.out.note && findPersonalContact(r.out.note).length) return err('validation_failed', 400, { errors: [{ field: 'away', code: 'personal_contact' }] });
          set.away = r.out;
        }
        await db.collection(M.profiles).updateOne({ user_id: uid }, { $set: set, $setOnInsert: { created_at: new Date() } }, { upsert: true });
        const ttLink = await db.collection('user_tiktok_links').findOne({ user_id: uid }, { projection: { username: 1, display_name: 1 } }).catch(() => null);
        const after = await db.collection(M.profiles).findOne({ user_id: uid }, { projection: { socials: 1, tiktok_hidden: 1 } });
        return json({ ok: true, socials: publicSocials(after, ttLink), tiktok: tiktokState(after, ttLink, tiktokStatus().available), notif: set.notif, away: set.away ? { ...set.away, active: awayActive(set.away) } : undefined });
      }
    }
    if (a === 'notifications' && method === 'GET') {
      const rows = await db.collection(M.notifications).find({ to: uid }).sort({ created_at: -1 }).limit(40).toArray();
      return json({ items: rows.map((n) => ({ id: String(n._id), type: n.type, params: n.params, at: iso(n.created_at), read: n.read })) });
    }
    if (a === 'notifications' && b === 'read' && method === 'POST') {
      await db.collection(M.notifications).updateMany({ to: uid, read: false }, { $set: { read: true } });
      return json({ ok: true });
    }
    if (a === 'inbox' && method === 'GET') {
      const rows = await db.collection(M.messages).find({ $or: [{ to_user_id: uid }, { from_user_id: uid }] }).sort({ created_at: -1 }).limit(200).toArray();
      const reqIds = [...new Set(rows.map((m) => String(m.request_id)))].map(oid).filter(Boolean);
      const appIds = [...new Set(rows.filter((m) => m.application_id).map((m) => String(m.application_id)))].map(oid).filter(Boolean);
      const [reqRows, appRows] = await Promise.all([
        reqIds.length ? db.collection(M.requests).find({ _id: { $in: reqIds } }, { projection: { card: 1, content: 1, author_id: 1, status: 1 } }).toArray() : [],
        appIds.length ? db.collection(M.applications).find({ _id: { $in: appIds } }, { projection: { applicant: 1, applicant_id: 1, author_id: 1, request_title: 1 } }).toArray() : [],
      ]);
      const titleOf = new Map(reqRows.map((r) => [String(r._id), r.card?.title || r.content?.title || '']));
      const appOf = new Map(appRows.map((x) => [String(x._id), x]));
      return json({ items: rows.map((m) => ({ title: titleOf.get(String(m.request_id)) || appOf.get(String(m.application_id))?.request_title || '', other: m.application_id ? (() => { const x = appOf.get(String(m.application_id)); return x ? (x.applicant_id === uid ? 'author' : (x.applicant?.name || '')) : ''; })() : null, id: String(m._id), request_id: String(m.request_id), application_id: m.application_id ? String(m.application_id) : null, kind: m.kind, mine: m.from_user_id === uid, name: m.name || null, reply_to: m.to_user_id === uid ? m.reply_to || null : null, body: m.body, at: iso(m.created_at), read: m.read })) });
    }
    if (a === 'inbox' && b === 'read' && method === 'POST') {
      await db.collection(M.messages).updateMany({ to_user_id: uid, read: false }, { $set: { read: true } });
      return json({ ok: true });
    }

    if (a === 'requests') {
      if (!b && method === 'POST') {
        const body = await readJson(request); if (!body) return err('bad_request', 400);
        if (await limited(db, `cr:${uid}`, LIMITS.perDayCreate, 86400)) return err('rate_limited', 429);
        await assertInServer(db, session, snowId(body.origin_guild_id));
        const cats = await catsFor(db, snowId(body.origin_guild_id));
        await assertCategoryAccess(db, body, catCtx(session));
        const r = await saveDraft(db, user, null, body, { categories: cats });
        return json({ id: String(r._id) }, { status: 201 });
      }
      if (b && !c) {
        const _id = oid(b); if (!_id) return err('not_found', 404);
        if (method === 'GET') {
          const r = await db.collection(M.requests).findOne({ _id });
          if (!r || r.author_id !== uid || r.status === STATUS.DELETED) return err('not_found', 404);
          const decisions = await db.collection(M.decisions).find({ request_id: _id }).sort({ at: -1 }).limit(20).toArray();
          const versions = await db.collection(M.versions).find({ request_id: _id }).sort({ n: -1 }).limit(10).toArray();
          return json({ ...ownerView(r), decisions: decisions.map((x) => ({ scope: x.scope, action: x.action, reason: x.reason, at: iso(x.at) })), versions: versions.map((v) => ({ id: String(v._id), n: v.n, state: v.state, at: iso(v.created_at) })) });
        }
        if (method === 'PUT') {
          const body = await readJson(request); if (!body) return err('bad_request', 400);
          await assertInServer(db, session, snowId(body.origin_guild_id));
          const cats = await catsFor(db, snowId(body.origin_guild_id));
          await assertCategoryAccess(db, body, catCtx(session));
          await saveDraft(db, user, b, body, { categories: cats });
          return json({ ok: true });
        }
        if (method === 'DELETE') {
          const out = await removeRequest(db, user, b);
          if (out.outcome === 'removed') await auditLog(db, uid, 'author_removed', b, {});
          return json({ ok: true, outcome: out.outcome });
        }
      }
      if (b && c === 'submit' && method === 'POST') {
        if (await limited(db, `sub:${uid}`, LIMITS.perHourSubmit, 3600)) return err('rate_limited', 429);
        const elig = await eligibleGuilds(session);
        const cur = await db.collection(M.requests).findOne({ _id: oid(b), author_id: uid }, { projection: { content: 1 } });
        await assertInServer(db, session, snowId(cur?.content?.origin_guild_id));
        const cats = await catsFor(db, snowId(cur?.content?.origin_guild_id));
        if (cur?.content) await assertCategoryAccess(db, cur.content, catCtx(session));
        const out = await submitRequest(db, user, b, {
          categories: cats,
          originGuild: async (gid) => {
            if (elig.unavailable) throw new CollabError('discord_unavailable', 503);
            const g = elig.guilds.find((x) => x.id === gid);
            if (!g) return null;
            if (!(await listedGuildIds(db, [g.id])).includes(g.id)) return null;
            return { id: g.id, name: g.name };
          },
          hasFile: async (fid, req) => Boolean(await db.collection(M.files).findOne({ _id: oid(fid), owner_id: uid })),
        });
        const r = await db.collection(M.requests).findOne({ _id: oid(b) }, { projection: { content: 1 } });
        if (r?.content?.attachments?.length) await db.collection(M.files).updateMany({ _id: { $in: r.content.attachments.map(oid) }, owner_id: uid }, { $set: { request_id: oid(b) } });
        return json(out);
      }
      if (b && c === 'discard' && method === 'POST') { await discardPending(db, user, b); return json({ ok: true }); }
      if (b && c === 'close' && method === 'POST') { await closeRequest(db, user, b); return json({ ok: true }); }
      if (b && c === 'reopen' && method === 'POST') { await reopenRequest(db, user, b); return json({ ok: true }); }
      if (b && c === 'renew' && method === 'POST') { await renewRequest(db, user, b); return json({ ok: true }); }
      if (b && c === 'applications' && !d && method === 'GET') {
        const req = await db.collection(M.requests).findOne({ _id: oid(b) });
        if (!req || req.author_id !== uid) return err('not_found', 404);
        const rows = await db.collection(M.applications).find({ request_id: req._id, status: { $ne: 'withdrawn' } }).sort({ created_at: -1 }).limit(200).toArray();
        const profs = await db.collection(M.profiles).find({ user_id: { $in: [...new Set(rows.map((x) => x.applicant_id))] }, share_socials: true }, { projection: { user_id: 1, socials: 1, tiktok_hidden: 1 } }).toArray();
        const ttRows = await db.collection('user_tiktok_links').find({ user_id: { $in: profs.map((p) => p.user_id) } }, { projection: { user_id: 1, username: 1 } }).toArray().catch(() => []);
        const ttOf = new Map(ttRows.map((x) => [x.user_id, x]));
        const socialsOf = new Map(profs.map((p) => [p.user_id, publicSocials(p, ttOf.get(p.user_id))]));
        const awayProfs = await db.collection(M.profiles).find({ user_id: { $in: [...new Set(rows.map((x) => x.applicant_id))] }, 'away.on': true }, { projection: { user_id: 1, away: 1 } }).toArray();
        const awayOf = new Map(awayProfs.map((p) => [p.user_id, publicAway(p.away)]).filter(([, v]) => v));
        return json({ questions: req.live?.questions || [], items: rows.map((x) => ({ id: String(x._id), socials: socialsOf.get(x.applicant_id) || {}, away: awayOf.get(x.applicant_id) || null, applicant: x.applicant, intro: x.intro, experience: x.experience, skills: x.skills, portfolio: x.portfolio, approach: x.approach, duration: x.duration, answers: x.answers, status: x.status, at: iso(x.created_at) })) });
      }
      if (b && c === 'applications' && d && parts[5] && method === 'POST') {
        const act = parts[5];
        if (act === 'select') return json(await selectApplication(db, user, b, d));
        if (act === 'status') { const body = await readJson(request); await setApplicationStatus(db, user, b, d, body?.status); return json({ ok: true }); }
        if (act === 'message') { const body = await readJson(request); if (!(await consumePass(db, String(body?.pass || ''), 'collab_message', String(d)))) return err('captcha_failed', 400); await sendMessage(db, user, b, d, body?.body); return json({ ok: true }); }
      }
    }
    if (a === 'applications' && b && c === 'withdraw' && method === 'POST') { await withdrawApplication(db, user, b); return json({ ok: true }); }
    if (a === 'applications' && b && c === 'message' && method === 'POST') {
      const body = await readJson(request); const app = await db.collection(M.applications).findOne({ _id: oid(b) });
      if (!app) return err('not_found', 404);
      if (!(await consumePass(db, String(body?.pass || ''), 'collab_message', String(b)))) return err('captcha_failed', 400);
      await sendMessage(db, user, app.request_id, b, body?.body); return json({ ok: true });
    }
    return err('not_found', 404);
  }

  if (head === 'upload' && !a && method === 'POST') {
    if (await limited(db, `up:${uid}`, 20, 3600)) return err('rate_limited', 429);
    const settings = await getSettings(db);
    void settings;
    const len = Number(request.headers.get('content-length') || 0);
    if (len > LIMITS.attachments.bytes + 8192) return err('file_too_large', 413);
    let form; try { form = await request.formData(); } catch { return err('bad_request', 400); }
    const file = form.get('file');
    if (!file || typeof file === 'string' || file.size > LIMITS.attachments.bytes) return err('file_too_large', 413);
    const buf = Buffer.from(await file.arrayBuffer());
    const mime = sniffImage(buf);
    if (!mime || !MIME_OK.has(mime)) return err('file_type', 415);
    const count = await db.collection(M.files).countDocuments({ owner_id: uid, request_id: null });
    if (count >= 30) return err('too_many_files', 429);
    const name = cleanLine(String(file.name || 'image').replace(/\.[a-z0-9]+$/i, ''), 60);
    const r = await db.collection(M.files).insertOne({ owner_id: uid, request_id: null, name, mime, size: buf.length, data: buf, created_at: new Date() });
    return json({ id: String(r.insertedId), name, mime }, { status: 201 });
  }

  if (head === 'upload' && a === 'url' && method === 'POST') {
    if (await limited(db, `upu:${uid}`, 20, 3600)) return err('rate_limited', 429);
    const body = await readJson(request);
    const link = String(body?.url || '').trim();
    if (!link || link.length > 2048 || !/^https:\/\//i.test(link)) return err('bad_url', 400);
    const count = await db.collection(M.files).countDocuments({ owner_id: uid, request_id: null });
    if (count >= 30) return err('too_many_files', 429);
    let buf;
    try { buf = await fetchPublicImage(link, LIMITS.attachments.bytes); } catch (e) {
      const s = e && e.status;
      if (s === 413) return err('file_too_large', 413);
      if (s === 400) return err('bad_url', 400);
      if (s === 504) return err('url_timeout', 504);
      return err('url_failed', 502);
    }
    const mime = sniffImage(buf);
    if (!mime || !MIME_OK.has(mime)) return err('file_type', 415);
    let nm = 'image';
    try { nm = decodeURIComponent(new URL(link).pathname.split('/').pop() || 'image'); } catch { }
    const name = cleanLine(nm.replace(/\.[a-z0-9]+$/i, ''), 60) || 'image';
    const r = await db.collection(M.files).insertOne({ owner_id: uid, request_id: null, name, mime, size: buf.length, data: buf, created_at: new Date() });
    return json({ id: String(r.insertedId), name, mime }, { status: 201 });
  }

  if (head === 'request' && a && b === 'apply' && method === 'POST') {
    if (await limited(db, `ap:${uid}`, LIMITS.applyPerHour, 3600)) return err('rate_limited', 429);
    const body = await readJson(request); if (!body) return err('bad_request', 400);
    if (!(await consumePass(db, String(body.pass || ''), 'collab_apply', String(a)))) return err('captcha_failed', 400);
    return json(await applyToRequest(db, user, a, body), { status: 201 });
  }
  if (head === 'request' && a && b === 'report' && method === 'POST') {
    if (await limited(db, `rp:${uid}`, 20, 3600)) return err('rate_limited', 429);
    const body = await readJson(request); if (!body) return err('bad_request', 400);
    return json(await reportRequest(db, user, a, { reason: body.reason, details: body.details }, REPORT_REASONS));
  }
  return err('not_found', 404);
}

async function listedGuildIds(db, ids) {
  if (!ids.length) return [];
  try {
    const both = [...ids, ...ids.map((x) => toLong(x)).filter(Boolean)];
    const rows = await db.collection('community_listings').find({ guild_id: { $in: both }, status: LISTING_PUBLIC }, { projection: { guild_id: 1 } }).toArray();
    return rows.map((r) => String(r.guild_id));
  } catch { return []; }
}

async function handleServer({ request, db, parts, method, session }) {
  const [, gid, a, b] = parts;
  const guildId = snow(gid); if (!guildId) return err('not_found', 404);
  const own = await isGuildOwner(session, guildId);
  if (own.unavailable) return err('discord_unavailable', 503);
  const isOwn = own.ok;
  const canChannel = isOwn || Boolean(own.guild?.manage);
  if (!canChannel) return err('not_found', 404);
  if (!a && method === 'GET') {
    const s = await db.collection(M.servers).findOne({ guild_id: guildId });
    return json({ guild: own.guild, owner: isOwn, require_approval: Boolean(s?.require_approval), announce_channel_id: s?.announce_channel_id || null, announce_channel_name: s?.announce_channel_name || null });
  }
  if (a === 'channels' && method === 'GET') {
    const r = await getGuildChannelsResult(guildId);
    if (!r.ok) return err('discord_unavailable', 503);
    return json({ channels: (r.data || []).filter((c) => c.type === 0 || c.type === 5).sort((x, y) => (x.position || 0) - (y.position || 0)).map((c) => ({ id: String(c.id), name: String(c.name || '').slice(0, 100) })) });
  }
  if (a === 'settings' && method === 'PUT') {
    const body = await readJson(request); if (!body) return err('bad_request', 400);
    if ('require_approval' in body && !isOwn) return err('not_found', 404);
    const set = { updated_at: new Date(), updated_by: String(session.user.id) };
    const cur = await db.collection(M.servers).findOne({ guild_id: guildId });
    if ('require_approval' in body) set.require_approval = Boolean(body.require_approval);
    if ('announce_channel_id' in body) {
      const ch = body.announce_channel_id ? snow(body.announce_channel_id) : null;
      if (body.announce_channel_id && !ch) return err('bad_request', 400);
      if (ch) {
        const r = await getGuildChannelsResult(guildId);
        if (!r.ok) return err('discord_unavailable', 503);
        const found = (r.data || []).find((c) => String(c.id) === ch && (c.type === 0 || c.type === 5));
        if (!found) return err('bad_channel', 400);
        set.announce_channel_name = String(found.name || '').slice(0, 100);
      } else set.announce_channel_name = null;
      set.announce_channel_id = ch;
    }
    await db.collection(M.servers).updateOne({ guild_id: guildId }, { $set: set, $setOnInsert: { created_at: new Date() } }, { upsert: true });
    if ('require_approval' in set) await auditLog(db, session.user.id, 'server.require_approval', guildId, { on: set.require_approval });
    if ('announce_channel_id' in set) {
      await auditLog(db, session.user.id, 'server.announce_channel', guildId, { channel: set.announce_channel_id });
      if (!isOwn && (cur?.announce_channel_id || null) !== set.announce_channel_id) {
        const g = await getBotGuild(guildId).catch(() => null);
        const by = cleanLine(session.user.global_name || session.user.username || 'An administrator', 60);
        await notifyOwnerChannelChange(db, { ownerId: g?.owner_id, guildName: own.guild?.name || g?.name || '', byName: by, off: !set.announce_channel_id });
      }
    }
    return json({ ok: true, require_approval: 'require_approval' in set ? set.require_approval : Boolean(cur?.require_approval), announce_channel_id: 'announce_channel_id' in set ? set.announce_channel_id : cur?.announce_channel_id || null, announce_channel_name: 'announce_channel_name' in set ? set.announce_channel_name : cur?.announce_channel_name || null });
  }
  if (!isOwn) return err('not_found', 404);
  if (a === 'queue' && method === 'GET') {
    const rows = await db.collection(M.requests).find({ origin_guild_id: guildId, review_queue: 'server' }).sort({ queued_at: 1 }).limit(100).toArray();
    return json({ items: rows.map((r) => ({ id: String(r._id), author: r.author, queued_at: iso(r.queued_at), version_id: String(r.version_id), content: r.content, edit: Boolean(r.live), diff: r.live ? diffContent(r.live, r.content) : [] })) });
  }
  if (a === 'categories') {
    const roles = async (g) => getGuildRolesResult(g);
    const chans = async (g) => getGuildChannelsResult(g);
    if (!b && method === 'GET') {
      const rows = await listGuildCategories(db, guildId);
      const counts = await db.collection(M.requests).aggregate([{ $match: { category: { $in: rows.map((c) => c.slug) }, status: { $ne: STATUS.DELETED } } }, { $group: { _id: '$category', n: { $sum: 1 } } }]).toArray();
      const n = new Map(counts.map((x) => [x._id, x.n]));
      return json({ categories: rows.map((c) => ({ ...catView(c), posts: n.get(c.slug) || 0 })), max: LIMITS_CAT.perServer });
    }
    if (a === 'categories' && b === 'roles' && method === 'GET') {
      const r = await getGuildRolesResult(guildId);
      if (!r.ok) return err('discord_unavailable', 503);
      return json({ roles: (r.data || []).filter((x) => String(x.id) !== guildId && !x.managed).sort((x, y) => (y.position || 0) - (x.position || 0)).map((x) => ({ id: String(x.id), name: String(x.name || '').slice(0, 100), color: x.color || 0 })) });
    }
    if (!b && method === 'POST') {
      if (await limited(db, `scw:${session.user.id}`, 30, 3600)) return err('rate_limited', 429);
      const body = await readJson(request); if (!body) return err('bad_request', 400);
      const c = await createGuildCategory(db, guildId, session.user.id, body, { getRoles: roles, getChannels: chans });
      await auditLog(db, session.user.id, 'server.category_create', guildId, { slug: c.slug });
      return json({ category: catView(c) }, { status: 201 });
    }
    if (b && method === 'PUT') {
      if (await limited(db, `scw:${session.user.id}`, 60, 3600)) return err('rate_limited', 429);
      const body = await readJson(request); if (!body) return err('bad_request', 400);
      const c = await updateGuildCategory(db, guildId, b, session.user.id, body, { getRoles: roles, getChannels: chans, oid });
      await auditLog(db, session.user.id, 'server.category_update', guildId, { slug: c.slug });
      return json({ category: catView(c) });
    }
    if (b && method === 'DELETE') {
      const out = await deleteGuildCategory(db, guildId, b, { oid });
      await auditLog(db, session.user.id, 'server.category_delete', guildId, { id: String(b) });
      return json({ ok: true, ...out });
    }
    return err('not_found', 404);
  }
  if (a === 'decide' && method === 'POST') {
    const body = await readJson(request); if (!body) return err('bad_request', 400);
    const req = await db.collection(M.requests).findOne({ _id: oid(body.request_id) });
    if (!req || req.origin_guild_id !== guildId) return err('not_found', 404);
    if (!['approve', 'reject', 'changes'].includes(body.action)) return err('bad_action', 400);
    const out = await decide(db, { scope: 'server', actor: session.user.id, requestId: body.request_id, versionId: body.version_id, action: body.action, reason: body.reason, note: body.note });
    return json(out);
  }
  return err('not_found', 404);
}

async function handleStaff({ request, db, parts, method, session }) {
  const [, a, b, c] = parts;
  const actor = session.user.id;
  if ((a === 'settings' && method !== 'GET') || (a === 'categories' && method !== 'GET')) {
    if (String(actor) !== OWNER_ID) return err('not_found', 404);
  }
  if (a === 'overview' && method === 'GET') {
    const [queue, reports, byStatus, apps, suspended] = await Promise.all([
      db.collection(M.requests).countDocuments({ review_queue: 'global' }),
      db.collection(M.reports).countDocuments({ status: 'open' }),
      db.collection(M.requests).aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]).toArray(),
      db.collection(M.applications).countDocuments({}),
      db.collection(M.requests).countDocuments({ status: STATUS.SUSPENDED }),
    ]);
    return json({ queue, reports, suspended, applications: apps, by_status: Object.fromEntries(byStatus.map((x) => [x._id, x.n])), settings: await getSettings(db), reject_reasons: REJECT_REASONS });
  }
  if (a === 'queue' && method === 'GET') {
    const rows = await db.collection(M.requests).find({ review_queue: 'global' }).sort({ escalated: -1, queued_at: 1 }).limit(100).toArray();
    return json({ items: rows.map((r) => ({ id: String(r._id), title: r.content?.title || r.card?.title, author: r.author, reasons: r.review_reasons || [], risk: r.risk ?? 0, queued_at: iso(r.queued_at), status: r.status, edit: Boolean(r.live), escalated: Boolean(r.escalated), origin_guild_name: r.origin_guild_name || null })) });
  }
  if (a === 'request' && b && method === 'GET') {
    const v = await loadMod(db, b);
    return v ? json(v) : err('not_found', 404);
  }
  if (a === 'list' && method === 'GET') {
    const q = {};
    const st = parts[2];
    if (st && Object.values(STATUS).includes(st)) q.status = st;
    const rows = await db.collection(M.requests).find(q, { projection: { card: 1, content: 1, status: 1, author: 1, updated_at: 1, category: 1, app_count: 1 } }).sort({ updated_at: -1 }).limit(100).toArray();
    return json({ items: rows.map((r) => ({ id: String(r._id), title: r.content?.title || r.card?.title, status: r.status, author: r.author, updated_at: iso(r.updated_at), category: r.category || r.content?.category, applications: r.app_count || 0 })) });
  }
  if (a === 'decide' && method === 'POST') {
    const body = await readJson(request); if (!body) return err('bad_request', 400);
    if (!['approve', 'false_positive', 'reject', 'changes', 'suspend', 'escalate'].includes(body.action)) return err('bad_action', 400);
    const { audit } = await import('@/lib/owner-audit');
    const out = await decide(db, { scope: 'global', actor, requestId: body.request_id, versionId: body.version_id, action: body.action, reason: body.reason, note: body.note });
    await audit(db, { actor: actorOf(session), role: String(actor) === (process.env.DISCORD_OWNER_ID || '932582842351898644') ? 'owner' : 'delegate', action: `collab.${body.action}`, outcome: 'ok', target: String(body.request_id), detail: cleanLine(body.reason, 200), request });
    return json(out);
  }
  if (a === 'delete' && method === 'POST') {
    if (String(actor) !== OWNER_ID) return err('not_found', 404);
    const body = await readJson(request); if (!body) return err('bad_request', 400);
    const out = await staffRemoveRequest(db, { actor, requestId: body.request_id });
    const { audit } = await import('@/lib/owner-audit');
    await audit(db, { actor: actorOf(session), role: 'owner', action: 'collab.delete', outcome: 'ok', target: String(body.request_id), request });
    return json({ ok: true, outcome: out.outcome });
  }
  if (a === 'restore' && method === 'POST') {
    const body = await readJson(request); if (!body) return err('bad_request', 400);
    const out = await restore(db, { actor, requestId: body.request_id });
    const { audit } = await import('@/lib/owner-audit');
    await audit(db, { actor: actorOf(session), role: 'owner', action: 'collab.restore', outcome: 'ok', target: String(body.request_id), request });
    return json(out);
  }
  if (a === 'reports' && method === 'GET') {
    const rows = await db.collection(M.reports).find({ status: 'open' }).sort({ created_at: -1 }).limit(100).toArray();
    return json({ items: rows.map((x) => ({ id: String(x._id), request_id: String(x.request_id), reporter: x.reporter_id, reason: x.reason, details: x.details, at: iso(x.created_at) })) });
  }
  if (a === 'reports' && b && c === 'dismiss' && method === 'POST') {
    await db.collection(M.reports).updateOne({ _id: oid(b) }, { $set: { status: 'dismissed', by: String(actor), at: new Date() } });
    await auditLog(db, actor, 'report.dismiss', b);
    return json({ ok: true });
  }
  if (a === 'settings' && method === 'PUT') {
    const body = await readJson(request); if (!body) return err('bad_request', 400);
    const set = {};
    const num = (k, min, max) => { if (body[k] !== undefined) { const n = Number(body[k]); if (Number.isInteger(n) && n >= min && n <= max) set[k] = n; } };
    num('lifetime_days', 1, 365); num('inactive_days', 1, 90); num('report_threshold', 1, 20);
    for (const k of ['edits_need_review', 'review_attachments', 'public_contact_enabled', 'ai_moderation', 'submissions_open']) if (typeof body[k] === 'boolean') set[k] = body[k];
    if (!Object.keys(set).length) return err('validation_failed', 400);
    await db.collection(M.settings).updateOne({ _id: 'main' }, { $set: { ...set, updated_at: new Date() } }, { upsert: true });
    await auditLog(db, actor, 'settings.update', 'main', set);
    const { audit } = await import('@/lib/owner-audit');
    await audit(db, { actor: actorOf(session), role: 'owner', action: 'collab.settings', outcome: 'ok', target: 'settings', detail: JSON.stringify(set).slice(0, 300), request });
    return json({ ok: true, settings: { ...DEFAULT_SETTINGS, ...(await getSettings(db)) } });
  }
  if (a === 'categories') {
    if (method === 'GET') return json({ items: await getCategories(db, { includeDisabled: true }) });
    if (method === 'POST') {
      const body = await readJson(request); if (!body) return err('bad_request', 400);
      const slug = String(body.slug || '');
      if (!CATEGORY_RE.test(slug) || slug.startsWith(SERVER_CAT_PREFIX)) return err('validation_failed', 400, { errors: [{ field: 'slug', code: 'invalid' }] });
      const names = {};
      for (const l of LOCALES) names[l] = cleanLine(body.names?.[l] || body.names?.en, 40);
      if (!names.en) return err('validation_failed', 400, { errors: [{ field: 'names.en', code: 'required' }] });
      const order = await db.collection(M.categories).countDocuments({});
      try { await db.collection(M.categories).insertOne({ slug, icon: cleanLine(body.icon, 30) || 'Sparkles', names, order, enabled: true, created_at: new Date() }); } catch (e) { if (e?.code === 11000) return err('exists', 409); throw e; }
      resetCategoryCache(); await auditLog(db, actor, 'category.create', slug);
      return json({ ok: true }, { status: 201 });
    }
    if (method === 'PUT' && b) {
      const body = await readJson(request); if (!body) return err('bad_request', 400);
      const set = {};
      if (typeof body.enabled === 'boolean') set.enabled = body.enabled;
      if (body.names && typeof body.names === 'object') for (const l of LOCALES) if (body.names[l]) set[`names.${l}`] = cleanLine(body.names[l], 40);
      if (Number.isInteger(body.order)) set.order = body.order;
      if (!Object.keys(set).length) return err('validation_failed', 400);
      await db.collection(M.categories).updateOne({ slug: String(b) }, { $set: set });
      resetCategoryCache(); await auditLog(db, actor, 'category.update', b, set);
      return json({ ok: true });
    }
  }
  if (a === 'audit' && method === 'GET') {
    const rows = await db.collection(M.audit).find({}).sort({ at: -1 }).limit(100).toArray();
    return json({ items: rows.map((x) => ({ at: iso(x.at), actor: x.actor, action: x.action, target: x.target, detail: x.detail })) });
  }
  return err('not_found', 404);
}


import crypto from 'crypto';
import { ObjectId } from 'mongodb';
import { M, getCategories, getSettings, resetCategoryCache, auditLog } from './db.js';
import { STATUS, LIMITS, REPORT_REASONS, REJECT_REASONS, LOCALES, CATEGORY_RE, DEFAULT_SETTINGS } from './constants.js';
import {
  json, err, readJson, limited, sessionUser, ipHash, isStaff, actorOf, eligibleGuilds, isGuildOwner, sniffImage, trustedOrigin,
} from './api-util.js';
import {
  MarketplaceError, oid, saveDraft, deleteDraft, submitRequest, decide, restore, discardPending, closeRequest, reopenRequest, renewRequest, reportRequest,
  applyToRequest, withdrawApplication, setApplicationStatus, selectApplication, sendMessage, diffContent, publicFilter, sweepExpired,
} from './lifecycle.js';
import { homeSections, recent, discover, forYou, recentlyUpdated, categoryStats, publicRequest } from './query.js';
import { findPersonalContact } from './guard.js';
import { cleanBlock, cleanLine } from './validation.js';
import { generateChallenge } from '@/lib/captcha';
import { OWNER_ID } from '@/lib/owner-access';

const MIME_OK = new Set(['image/jpeg', 'image/png', 'image/webp']);
const idsOf = (v) => String(v || '').split(',').map((s) => s.trim()).filter((s) => /^[a-f0-9]{24}$/.test(s)).slice(0, 300);
const snow = (v) => (/^\d{15,25}$/.test(String(v || '')) ? String(v) : null);
const catSet = async (db) => new Set((await getCategories(db)).map((c) => c.slug));
const iso = (d) => (d ? new Date(d).toISOString() : null);

function ownerView(r) {
  return {
    id: String(r._id), status: r.status, pending_state: r.pending_state || null, content: r.content, live: r.live || null, review_queue: r.review_queue || null,
    review_reasons: r.review_reasons || [], decision: r.decision || null, suspended: r.suspended || null, origin_guild_id: r.origin_guild_id || null, origin_guild_name: r.origin_guild_name || null,
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
    return json(await homeSections(db, { userId: s?.user?.id, category, seed }));
  }
  if (method === 'GET' && head === 'section') {
    if (await limited(db, `sec:${ipHash(request)}`, 240, 60)) return err('rate_limited', 429);
    const s = await sessionUser();
    const category = CATEGORY_RE.test(url.searchParams.get('category') || '') ? url.searchParams.get('category') : '';
    const seed = String(url.searchParams.get('seed') || crypto.randomBytes(6).toString('hex')).slice(0, 40);
    const cursor = url.searchParams.get('cursor') || '';
    if (a === 'recent') return json(await recent(db, { category, cursor }));
    if (a === 'discover') return json(await discover(db, { seed, category, seen: idsOf(url.searchParams.get('seen')) }));
    if (a === 'for_you') return json(await forYou(db, s?.user?.id, { category }));
    if (a === 'updated') return json(await recentlyUpdated(db, { category }));
    return err('not_found', 404);
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

  if (head === 'request' && a && b === 'contact-challenge' && method === 'GET') {
    if (await limited(db, `cc:${ipHash(request)}`, 20, 60)) return err('rate_limited', 429);
    const ch = generateChallenge();
    const id = crypto.randomBytes(18).toString('base64url');
    await db.collection(M.challenges).insertOne({ _id: id, answer: ch.answer, request_id: a, created_at: new Date(), expires_at: new Date(Date.now() + 5 * 60_000) });
    return json({ id, question: ch.question });
  }
  if (head === 'request' && a && b === 'contact' && method === 'POST') {
    const settings = await getSettings(db);
    if (!settings.public_contact_enabled) return err('disabled', 403);
    const ip = ipHash(request);
    if (await limited(db, `pc:${ip}`, 3, 3600) || await limited(db, `pcd:${ip}`, 8, 86400)) return err('rate_limited', 429);
    const body = await readJson(request, 8 * 1024); if (!body) return err('bad_request', 400);
    const _id = oid(a);
    const req = _id && await db.collection(M.requests).findOne({ _id, ...publicFilter() });
    if (!req || !req.live.public_contact) return err('not_found', 404);
    if (await limited(db, `pcr:${a}`, 10, 86400)) return err('rate_limited', 429);
    if (body.website) return json({ ok: true });
    const ch = await db.collection(M.challenges).findOneAndDelete({ _id: String(body.challenge_id || ''), request_id: a });
    const chDoc = ch?.value !== undefined ? ch.value : ch;
    if (!chDoc || chDoc.expires_at < new Date() || String(body.answer).trim() !== String(chDoc.answer)) return err('captcha_failed', 400);
    const name = cleanLine(body.name, LIMITS.contactName.max);
    const text = cleanBlock(body.body, LIMITS.message.max);
    const reply = cleanLine(body.reply_to, 120);
    const errors = [];
    if (text.length < LIMITS.message.min) errors.push({ field: 'body', code: 'too_short', params: { min: LIMITS.message.min } });
    if (!name) errors.push({ field: 'name', code: 'required' });
    if (!reply) errors.push({ field: 'reply_to', code: 'required' });
    if ((text.match(/https?:\/\//gi) || []).length > 2) errors.push({ field: 'body', code: 'too_many_links' });
    if (errors.length) return err('validation_failed', 400, { errors });
    await db.collection(M.messages).insertOne({ request_id: req._id, to_user_id: req.author_id, kind: 'public', name, reply_to: reply, body: text, ip_hash: ip, created_at: new Date(), read: false });
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
        db.collection(M.requests).find({ author_id: uid }).sort({ updated_at: -1 }).limit(100).toArray(),
        db.collection(M.applications).find({ applicant_id: uid }).sort({ created_at: -1 }).limit(100).toArray(),
        db.collection(M.messages).countDocuments({ to_user_id: uid, read: false }),
      ]);
      return json({ requests: reqs.map(ownerView).map(({ content, live, ...r }) => ({ ...r, title: content?.title || live?.title || '', category: content?.category || '' })), applications: apps.map((x) => ({ id: String(x._id), request_id: String(x.request_id), title: x.request_title, status: x.status, created_at: iso(x.created_at) })), unread });
    }
    if (a === 'guilds' && method === 'GET') {
      const g = await eligibleGuilds(session);
      const rows = await db.collection(M.servers).find({ guild_id: { $in: g.guilds.map((x) => x.id) } }).toArray();
      const by = new Map(rows.map((r) => [r.guild_id, r.require_approval]));
      return json({ unavailable: g.unavailable, guilds: g.guilds.map((x) => ({ ...x, require_approval: Boolean(by.get(x.id)) })) });
    }
    if (a === 'profile') {
      if (method === 'GET') {
        const p = await db.collection(M.profiles).findOne({ user_id: uid });
        return json({ locale: p?.locale || null, pref_categories: p?.pref_categories || [], pref_tags: p?.pref_tags || [], skills: p?.skills || [] });
      }
      if (method === 'PUT') {
        const body = await readJson(request); if (!body) return err('bad_request', 400);
        const cats = await catSet(db);
        const set = { pref_categories: (Array.isArray(body.pref_categories) ? body.pref_categories : []).filter((x) => cats.has(x)).slice(0, 10), pref_tags: [...new Set((Array.isArray(body.pref_tags) ? body.pref_tags : []).map((t) => cleanLine(t, LIMITS.tags.each).toLowerCase()).filter(Boolean))].slice(0, 20), updated_at: new Date() };
        if (LOCALES.includes(body.locale)) set.locale = body.locale;
        await db.collection(M.profiles).updateOne({ user_id: uid }, { $set: set, $setOnInsert: { created_at: new Date() } }, { upsert: true });
        return json({ ok: true });
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
      const rows = await db.collection(M.messages).find({ $or: [{ to_user_id: uid }, { from_user_id: uid }] }).sort({ created_at: -1 }).limit(100).toArray();
      return json({ items: rows.map((m) => ({ id: String(m._id), request_id: String(m.request_id), application_id: m.application_id ? String(m.application_id) : null, kind: m.kind, mine: m.from_user_id === uid, name: m.name || null, reply_to: m.to_user_id === uid ? m.reply_to || null : null, body: m.body, at: iso(m.created_at), read: m.read })) });
    }
    if (a === 'inbox' && b === 'read' && method === 'POST') {
      await db.collection(M.messages).updateMany({ to_user_id: uid, read: false }, { $set: { read: true } });
      return json({ ok: true });
    }

    if (a === 'requests') {
      const cats = await catSet(db);
      if (!b && method === 'POST') {
        const body = await readJson(request); if (!body) return err('bad_request', 400);
        if (await limited(db, `cr:${uid}`, LIMITS.perDayCreate, 86400)) return err('rate_limited', 429);
        const r = await saveDraft(db, user, null, body, { categories: cats });
        return json({ id: String(r._id) }, { status: 201 });
      }
      if (b && !c) {
        const _id = oid(b); if (!_id) return err('not_found', 404);
        if (method === 'GET') {
          const r = await db.collection(M.requests).findOne({ _id });
          if (!r || r.author_id !== uid) return err('not_found', 404);
          const decisions = await db.collection(M.decisions).find({ request_id: _id }).sort({ at: -1 }).limit(20).toArray();
          const versions = await db.collection(M.versions).find({ request_id: _id }).sort({ n: -1 }).limit(10).toArray();
          return json({ ...ownerView(r), decisions: decisions.map((x) => ({ scope: x.scope, action: x.action, reason: x.reason, at: iso(x.at) })), versions: versions.map((v) => ({ id: String(v._id), n: v.n, state: v.state, at: iso(v.created_at) })) });
        }
        if (method === 'PUT') {
          const body = await readJson(request); if (!body) return err('bad_request', 400);
          await saveDraft(db, user, b, body, { categories: cats });
          return json({ ok: true });
        }
        if (method === 'DELETE') { await deleteDraft(db, user, b); return json({ ok: true }); }
      }
      if (b && c === 'submit' && method === 'POST') {
        if (await limited(db, `sub:${uid}`, LIMITS.perHourSubmit, 3600)) return err('rate_limited', 429);
        const elig = await eligibleGuilds(session);
        const out = await submitRequest(db, user, b, {
          categories: cats,
          originGuild: async (gid) => {
            if (elig.unavailable) throw new MarketplaceError('discord_unavailable', 503);
            const g = elig.guilds.find((x) => x.id === gid);
            return g ? { id: g.id, name: g.name } : null;
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
        return json({ questions: req.live?.questions || [], items: rows.map((x) => ({ id: String(x._id), applicant: x.applicant, intro: x.intro, experience: x.experience, skills: x.skills, portfolio: x.portfolio, approach: x.approach, duration: x.duration, answers: x.answers, status: x.status, at: iso(x.created_at) })) });
      }
      if (b && c === 'applications' && d && parts[5] && method === 'POST') {
        const act = parts[5];
        if (act === 'select') return json(await selectApplication(db, user, b, d));
        if (act === 'status') { const body = await readJson(request); await setApplicationStatus(db, user, b, d, body?.status); return json({ ok: true }); }
        if (act === 'message') { const body = await readJson(request); await sendMessage(db, user, b, d, body?.body); return json({ ok: true }); }
      }
    }
    if (a === 'applications' && b && c === 'withdraw' && method === 'POST') { await withdrawApplication(db, user, b); return json({ ok: true }); }
    if (a === 'applications' && b && c === 'message' && method === 'POST') {
      const body = await readJson(request); const app = await db.collection(M.applications).findOne({ _id: oid(b) });
      if (!app) return err('not_found', 404);
      await sendMessage(db, user, app.request_id, b, body?.body); return json({ ok: true });
    }
    return err('not_found', 404);
  }

  if (head === 'upload' && method === 'POST') {
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

  if (head === 'request' && a && b === 'apply' && method === 'POST') {
    if (await limited(db, `ap:${uid}`, LIMITS.applyPerHour, 3600)) return err('rate_limited', 429);
    const body = await readJson(request); if (!body) return err('bad_request', 400);
    return json(await applyToRequest(db, user, a, body), { status: 201 });
  }
  if (head === 'request' && a && b === 'report' && method === 'POST') {
    if (await limited(db, `rp:${uid}`, 20, 3600)) return err('rate_limited', 429);
    const body = await readJson(request); if (!body) return err('bad_request', 400);
    return json(await reportRequest(db, user, a, { reason: body.reason, details: body.details }, REPORT_REASONS));
  }
  return err('not_found', 404);
}

async function handleServer({ request, db, parts, method, session }) {
  const [, gid, a, b] = parts;
  const guildId = snow(gid); if (!guildId) return err('not_found', 404);
  const own = await isGuildOwner(session, guildId);
  if (own.unavailable) return err('discord_unavailable', 503);
  if (!own.ok) return err('not_found', 404);
  if (!a && method === 'GET') {
    const s = await db.collection(M.servers).findOne({ guild_id: guildId });
    return json({ guild: own.guild, require_approval: Boolean(s?.require_approval) });
  }
  if (a === 'settings' && method === 'PUT') {
    const body = await readJson(request); if (!body) return err('bad_request', 400);
    const on = Boolean(body.require_approval);
    await db.collection(M.servers).updateOne({ guild_id: guildId }, { $set: { require_approval: on, updated_at: new Date(), updated_by: String(session.user.id) }, $setOnInsert: { created_at: new Date() } }, { upsert: true });
    await auditLog(db, session.user.id, 'server.require_approval', guildId, { on });
    return json({ ok: true, require_approval: on });
  }
  if (a === 'queue' && method === 'GET') {
    const rows = await db.collection(M.requests).find({ origin_guild_id: guildId, review_queue: 'server' }).sort({ queued_at: 1 }).limit(100).toArray();
    return json({ items: rows.map((r) => ({ id: String(r._id), author: r.author, queued_at: iso(r.queued_at), version_id: String(r.version_id), content: r.content, edit: Boolean(r.live), diff: r.live ? diffContent(r.live, r.content) : [] })) });
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
    await audit(db, { actor: actorOf(session), role: String(actor) === (process.env.DISCORD_OWNER_ID || '932582842351898644') ? 'owner' : 'delegate', action: `marketplace.${body.action}`, outcome: 'ok', target: String(body.request_id), detail: cleanLine(body.reason, 200), request });
    return json(out);
  }
  if (a === 'restore' && method === 'POST') {
    const body = await readJson(request); if (!body) return err('bad_request', 400);
    const out = await restore(db, { actor, requestId: body.request_id });
    const { audit } = await import('@/lib/owner-audit');
    await audit(db, { actor: actorOf(session), role: 'owner', action: 'marketplace.restore', outcome: 'ok', target: String(body.request_id), request });
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
    num('lifetime_days', 1, 365); num('report_threshold', 1, 20);
    for (const k of ['edits_need_review', 'review_attachments', 'public_contact_enabled', 'ai_moderation', 'submissions_open']) if (typeof body[k] === 'boolean') set[k] = body[k];
    if (!Object.keys(set).length) return err('validation_failed', 400);
    await db.collection(M.settings).updateOne({ _id: 'main' }, { $set: { ...set, updated_at: new Date() } }, { upsert: true });
    await auditLog(db, actor, 'settings.update', 'main', set);
    const { audit } = await import('@/lib/owner-audit');
    await audit(db, { actor: actorOf(session), role: 'owner', action: 'marketplace.settings', outcome: 'ok', target: 'settings', detail: JSON.stringify(set).slice(0, 300), request });
    return json({ ok: true, settings: { ...DEFAULT_SETTINGS, ...(await getSettings(db)) } });
  }
  if (a === 'categories') {
    if (method === 'GET') return json({ items: await getCategories(db, { includeDisabled: true }) });
    if (method === 'POST') {
      const body = await readJson(request); if (!body) return err('bad_request', 400);
      const slug = String(body.slug || '');
      if (!CATEGORY_RE.test(slug)) return err('validation_failed', 400, { errors: [{ field: 'slug', code: 'invalid' }] });
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


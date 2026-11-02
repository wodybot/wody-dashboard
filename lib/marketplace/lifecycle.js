// WODY Marketplace: request lifecycle. Every transition is decided here, on the
// server, never in the UI. Rules in short:
//   - a request is published automatically unless the Financial Content Guard finds
//     money (or fails), a report pulls it back, a Wody-wide policy asks for review, or
//     the origin server's owner turned approval on
//   - Wody staff only see what is in the global queue (money, reports, guard errors)
//   - the owner of an origin server only sees requests of THAT server, and only when
//     that server turned approval on
//   - every approval names the exact version it approves; if the author changed the
//     request meanwhile the approval is refused (version_outdated)
//   - an edit of a live request never touches the live text until the new version is
//     cleared; the last published version stays for comparison and audit
import crypto from 'crypto';
import { ObjectId } from 'mongodb';
import { M, getSettings, auditLog } from './db.js';
import { STATUS, LIMITS } from './constants.js';
import { runGuard } from './guard.js';
import { validateRequest, validateApplication, diffContent, cleanLine, cleanBlock } from './validation.js';
import { notifyUser } from './notify.js';

export class MarketplaceError extends Error {
  constructor(code, status = 400, extra = {}) { super(code); this.code = code; this.status = status; this.extra = extra; }
}
const E = (code, status, extra) => new MarketplaceError(code, status, extra);

export function oid(id) {
  if (id instanceof ObjectId) return id;
  return /^[a-f0-9]{24}$/.test(String(id || '')) ? new ObjectId(String(id)) : null;
}
export const hashContent = (c) => crypto.createHash('sha256').update(JSON.stringify([
  c.title, c.description, c.outcome, c.requirements, c.category, c.tags, c.links, c.language, c.deadline, c.questions, c.attachments, c.contact_mode, c.public_contact, c.origin_guild_id,
])).digest('hex').slice(0, 32);

const DAY = 86_400_000;
const summaryOf = (c) => c.description.replace(/\s+/g, ' ').slice(0, LIMITS.cardSummary);
const cardOf = (c) => ({ title: c.title, summary: summaryOf(c), category: c.category, tags: c.tags, language: c.language, deadline: c.deadline });

// Public visibility: one definition used by every list, section and page.
export function publicFilter(now = new Date()) {
  return { status: STATUS.PUBLISHED, expires_at: { $gt: now }, closed_at: null };
}

function userLite(user) {
  return { id: String(user.id), name: cleanLine(user.global_name || user.username || 'User', 60), avatar: user.avatar ? String(user.avatar).slice(0, 64) : null };
}

async function findOwn(db, user, id) {
  const _id = oid(id); if (!_id) throw E('not_found', 404);
  const req = await db.collection(M.requests).findOne({ _id });
  // Same answer for "missing" and "someone else's": no way to probe other users' requests.
  if (!req || req.author_id !== String(user.id)) throw E('not_found', 404);
  return req;
}

async function logDecision(db, req, { scope, action, actor, version_id = null, reason = '', note = '', signals = null }) {
  await db.collection(M.decisions).insertOne({ request_id: req._id, scope, action, actor: String(actor), version_id: version_id ? String(version_id) : null, reason: cleanLine(reason, 300), note: cleanBlock(note, 1000), signals, at: new Date() });
  await auditLog(db, actor, `${scope}.${action}`, req._id, { reason: cleanLine(reason, 120) });
}

// ------------------------------------------------------------------- drafts
export async function saveDraft(db, user, id, input, { categories }) {
  const { content } = validateRequest(input, { categories });
  const now = new Date();
  const draftLike = { ...content, category: categories.has(content.category) ? content.category : '' };
  if (!id) {
    const drafts = await db.collection(M.requests).countDocuments({ author_id: String(user.id), status: STATUS.DRAFT });
    if (drafts >= LIMITS.drafts) throw E('too_many_drafts', 429, { max: LIMITS.drafts });
    const doc = {
      author_id: String(user.id), author: userLite(user), status: STATUS.DRAFT, content: draftLike, live: null, pending_state: null,
      origin_guild_id: null, created_at: now, updated_at: now, random_key: Math.random(), app_count: 0, closed_at: null,
    };
    const r = await db.collection(M.requests).insertOne(doc);
    return { ...doc, _id: r.insertedId };
  }
  const req = await findOwn(db, user, id);
  if (req.status === STATUS.SUSPENDED || req.status === STATUS.PENDING_VERIFICATION || req.pending_state === 'pending_verification') throw E('not_editable', 409);
  // Editing the working copy never touches the live text of a published request.
  // If the request was waiting in a queue, the analysed version is withdrawn from it:
  // the changed text must be analysed again at the next submit (an approval of the old
  // version can no longer be used).
  const set = { content: draftLike, updated_at: now };
  if (req.version_id) {
    await db.collection(M.versions).updateOne({ _id: req.version_id, state: { $in: ['pending', 'held'] } }, { $set: { state: 'superseded' } });
    set.version_id = null;
  }
  const unset = {};
  if (req.review_queue && req.status !== STATUS.SUSPENDED) {
    set.review_queue = null; unset.queued_at = '';
    if (req.live) set.pending_state = null; else set.status = STATUS.DRAFT;
  } else if (!req.live && [STATUS.NEEDS_CHANGES, STATUS.REJECTED].includes(req.status)) {
    set.status = STATUS.DRAFT;
  } else if (req.live && ['needs_changes', 'rejected'].includes(req.pending_state)) {
    set.pending_state = null;
  }
  await db.collection(M.requests).updateOne({ _id: req._id }, { $set: set, ...(Object.keys(unset).length ? { $unset: unset } : {}) });
  return { ...req, content: draftLike, updated_at: now };
}

export async function deleteDraft(db, user, id) {
  const req = await findOwn(db, user, id);
  if (req.status !== STATUS.DRAFT) throw E('not_editable', 409);
  await db.collection(M.requests).deleteOne({ _id: req._id, status: STATUS.DRAFT });
  await db.collection(M.files).deleteMany({ request_id: req._id });
}

// ------------------------------------------------------------------- submit
// ctx.originGuild(guildId) -> { id, name } | null  (membership and bot presence verified by the caller)
export async function submitRequest(db, user, id, { categories, originGuild, hasFile }) {
  const settings = await getSettings(db);
  if (!settings.submissions_open) throw E('submissions_closed', 503);
  const req = await findOwn(db, user, id);
  if ([STATUS.SUSPENDED].includes(req.status)) throw E('not_editable', 409);
  const { content, errors } = validateRequest(req.content, { categories });
  if (errors.length) throw E('validation_failed', 400, { errors });
  if (req.status !== STATUS.PUBLISHED || !req.live) {
    const active = await db.collection(M.requests).countDocuments({ author_id: req.author_id, status: { $in: [STATUS.PUBLISHED, STATUS.PENDING_REVIEW, STATUS.PENDING_SERVER, STATUS.PENDING_VERIFICATION] }, _id: { $ne: req._id } });
    if (active >= LIMITS.active) throw E('too_many_active', 429, { max: LIMITS.active });
  }
  if (content.attachments.length) {
    for (const fid of content.attachments) {
      if (!(await hasFile(fid, req))) throw E('validation_failed', 400, { errors: [{ field: 'attachments', code: 'file_missing' }] });
    }
  }
  let guild = null;
  if (content.origin_guild_id) {
    guild = await originGuild(content.origin_guild_id);
    if (!guild) throw E('validation_failed', 400, { errors: [{ field: 'origin_guild_id', code: 'invalid_server' }] });
  }
  const isEdit = Boolean(req.live);
  const now = new Date();
  const hash = hashContent(content);
  // Nothing changed since the last published text: nothing to do.
  if (isEdit && req.live_hash === hash && !req.pending_state) throw E('no_changes', 409);

  // A new version is recorded first (immutable), the previous pending one is superseded.
  if (req.version_id) await db.collection(M.versions).updateOne({ _id: req.version_id, state: { $in: ['pending', 'held'] } }, { $set: { state: 'superseded' } });
  const n = (await db.collection(M.versions).countDocuments({ request_id: req._id })) + 1;
  const ver = { request_id: req._id, n, hash, content, author_id: req.author_id, created_at: now, state: 'pending' };
  const vr = await db.collection(M.versions).insertOne(ver);
  const versionId = vr.insertedId;
  await db.collection(M.requests).updateOne({ _id: req._id }, {
    $set: { content, version_id: versionId, version_hash: hash, origin_guild_id: guild?.id || null, origin_guild_name: guild?.name || null, updated_at: now, ...(isEdit ? { pending_state: 'pending_verification' } : { status: STATUS.PENDING_VERIFICATION }) },
  });

  // Mandatory analysis. An error in the guard is NOT a pass.
  let check;
  try {
    const fileNames = [];
    for (const fid of content.attachments) { const f = await db.collection(M.files).findOne({ _id: oid(fid) }, { projection: { name: 1 } }); if (f?.name) fileNames.push(f.name); }
    check = await runGuard({
      fields: { title: content.title, description: content.description, outcome: content.outcome, requirements: content.requirements, tags: content.tags, questions: content.questions },
      links: content.links, names: fileNames, hasAttachments: content.attachments.length > 0, useAi: settings.ai_moderation,
    });
  } catch (e) {
    check = { version: 'error', flagged: true, risk: 100, financial: false, signals: [{ field: '*', type: 'guard_error', rule: 'guard_exception', risk: 100, excerpt: String(e?.message || e).slice(0, 80) }], blocked: [], checked: [], ai: { used: false }, error: 'guard_exception' };
  }
  if (check.blocked?.length) {
    // blocked links are a validation problem, not a moderation one
    await db.collection(M.versions).updateOne({ _id: versionId }, { $set: { state: 'rejected_validation' } });
    await db.collection(M.requests).updateOne({ _id: req._id }, { $set: isEdit ? { pending_state: null, version_id: null } : { status: STATUS.DRAFT, version_id: null } });
    throw E('validation_failed', 400, { errors: check.blocked.map((b) => ({ field: b.field.replace('link[', 'links.').replace(']', ''), code: `link_${b.reason}` })) });
  }
  const cr = await db.collection(M.checks).insertOne({ request_id: req._id, version_id: versionId, hash, at: now, ...check });
  const checkId = cr.insertedId;

  const reasons = [];
  if (check.error) reasons.push('guard_error');
  if (check.flagged && !check.error) reasons.push(check.financial ? 'money' : 'suspicious_content');
  if (isEdit && settings.edits_need_review) reasons.push('edit_policy');
  if (content.attachments.length && settings.review_attachments) reasons.push('attachments');

  const fresh = await db.collection(M.requests).findOne({ _id: req._id });
  return route(db, fresh, { versionId, hash, checkId, reasons, risk: check.risk, settings, guild });
}

async function serverNeedsApproval(db, guildId) {
  if (!guildId) return false;
  const s = await db.collection(M.servers).findOne({ guild_id: String(guildId) });
  return Boolean(s?.require_approval);
}

async function route(db, req, { versionId, hash, checkId, reasons, risk, settings, guild }) {
  const isEdit = Boolean(req.live);
  const now = new Date();
  const base = { check_id: checkId, risk, review_reasons: reasons, updated_at: now };
  if (reasons.length) {
    await db.collection(M.requests).updateOne({ _id: req._id }, { $set: { ...base, review_queue: 'global', queued_at: now, server_ok: false, ...(isEdit ? { pending_state: STATUS.PENDING_REVIEW } : { status: STATUS.PENDING_REVIEW }) } });
    await db.collection(M.versions).updateOne({ _id: versionId }, { $set: { state: 'held' } });
    await notifyUser(db, req.author_id, 'held_review', { title: req.content.title, request_id: req._id });
    return { outcome: 'pending_review', reasons, versionId: String(versionId) };
  }
  if (await serverNeedsApproval(db, req.content.origin_guild_id)) {
    await db.collection(M.requests).updateOne({ _id: req._id }, { $set: { ...base, review_queue: 'server', queued_at: now, ...(isEdit ? { pending_state: STATUS.PENDING_SERVER } : { status: STATUS.PENDING_SERVER }) } });
    await db.collection(M.versions).updateOne({ _id: versionId }, { $set: { state: 'held' } });
    await notifyUser(db, req.author_id, 'held_server', { title: req.content.title, request_id: req._id });
    return { outcome: 'pending_server', reasons: [], versionId: String(versionId) };
  }
  await publishVersion(db, req, { versionId, hash, settings, actor: 'system' });
  return { outcome: 'published', reasons: [], versionId: String(versionId) };
}

// Make the working copy the live text. Only ever called with the version the
// request is currently pinned to.
async function publishVersion(db, req, { versionId, hash, settings, actor }) {
  const now = new Date();
  const lifetime = (settings?.lifetime_days ?? 30) * DAY;
  const content = req.content;
  const first = !req.published_at;
  const upd = await db.collection(M.requests).updateOne(
    { _id: req._id, version_id: versionId },
    {
      $set: {
        status: STATUS.PUBLISHED, live: content, live_version_id: versionId, live_hash: hash, card: cardOf(content), category: content.category, tags: content.tags,
        language: content.language, origin_guild_id: content.origin_guild_id, published_at: req.published_at || now, updated_live_at: now, expires_at: new Date(now.getTime() + lifetime),
        pending_state: null, review_queue: null, review_reasons: [], server_ok: false, closed_at: null, suspended: null, updated_at: now, random_key: Math.random(),
      },
      $unset: { queued_at: '' },
    },
  );
  if (!upd.matchedCount) throw E('version_outdated', 409);
  await db.collection(M.versions).updateMany({ request_id: req._id, state: 'published' }, { $set: { state: 'superseded' } });
  await db.collection(M.versions).updateOne({ _id: versionId }, { $set: { state: 'published', published_at: now } });
  if (first || req.status !== STATUS.PUBLISHED) await notifyUser(db, req.author_id, 'published', { title: content.title, request_id: req._id });
  for (const t of content.tags) await db.collection(M.tags).updateOne({ slug: t }, { $inc: { uses: 1 }, $setOnInsert: { created_at: now } }, { upsert: true }).catch(() => {});
}

// ---------------------------------------------------- moderation (both scopes)
function pinnedVersion(req, versionId) {
  if (!req.version_id || String(req.version_id) !== String(versionId)) throw E('version_outdated', 409);
}
function inQueue(req, scope) {
  if (req.review_queue !== scope) throw E('not_in_queue', 409);
}
const isEditing = (req) => Boolean(req.live);

// action: approve | false_positive | reject | changes | suspend | escalate
export async function decide(db, { scope, actor, requestId, versionId, action, reason = '', note = '' }) {
  const _id = oid(requestId); if (!_id) throw E('not_found', 404);
  const req = await db.collection(M.requests).findOne({ _id });
  if (!req) throw E('not_found', 404);
  const settings = await getSettings(db);
  const title = req.content?.title || req.card?.title || '';

  if (action === 'suspend') {
    if (scope !== 'global') throw E('forbidden', 403);
    if (!reason) throw E('reason_required', 400);
    await db.collection(M.requests).updateOne({ _id }, { $set: { status: STATUS.SUSPENDED, suspended: { reason: cleanLine(reason, 300), at: new Date(), by: String(actor) }, review_queue: 'global', queued_at: req.queued_at || new Date(), updated_at: new Date() } });
    await logDecision(db, req, { scope, action, actor, reason, note });
    await notifyUser(db, req.author_id, 'suspended', { title, reason, request_id: _id });
    return { outcome: 'suspended' };
  }
  if (action === 'escalate') {
    if (scope !== 'global') throw E('forbidden', 403);
    await db.collection(M.requests).updateOne({ _id }, { $set: { escalated: true, review_queue: 'global', queued_at: req.queued_at || new Date() } });
    await logDecision(db, req, { scope, action, actor, reason, note });
    return { outcome: 'escalated' };
  }

  inQueue(req, scope);
  // A suspended request has no pinned pending version: its decision targets the live one.
  if (req.status !== STATUS.SUSPENDED) pinnedVersion(req, versionId);
  else if (String(req.live_version_id) !== String(versionId)) throw E('version_outdated', 409);

  if (action === 'approve' || action === 'false_positive') {
    if (req.status === STATUS.SUSPENDED) throw E('use_restore', 409);
    if (action === 'false_positive' && scope !== 'global') throw E('forbidden', 403);
    await logDecision(db, req, { scope, action, actor, version_id: versionId, reason, note });
    if (action === 'false_positive' && req.check_id) await db.collection(M.checks).updateOne({ _id: req.check_id }, { $set: { false_positive: true, false_positive_by: String(actor) } });
    // After the global decision, a server that asks for approval still gets its say.
    if (scope === 'global' && await serverNeedsApproval(db, req.content.origin_guild_id)) {
      await db.collection(M.requests).updateOne({ _id, version_id: req.version_id }, { $set: { review_queue: 'server', queued_at: new Date(), ...(isEditing(req) ? { pending_state: STATUS.PENDING_SERVER } : { status: STATUS.PENDING_SERVER }) } });
      await notifyUser(db, req.author_id, 'held_server', { title, request_id: _id });
      return { outcome: 'pending_server' };
    }
    await publishVersion(db, req, { versionId: req.version_id, hash: req.version_hash, settings, actor });
    return { outcome: 'published' };
  }
  if (action === 'reject' || action === 'changes') {
    if (!cleanLine(reason, 300)) throw E('reason_required', 400);
    const state = action === 'reject' ? STATUS.REJECTED : STATUS.NEEDS_CHANGES;
    await logDecision(db, req, { scope, action, actor, version_id: versionId, reason, note });
    const set = { review_queue: null, updated_at: new Date(), decision: { action, reason: cleanLine(reason, 300), scope, at: new Date() } };
    if (isEditing(req)) set.pending_state = state === STATUS.REJECTED ? 'rejected' : STATUS.NEEDS_CHANGES; else set.status = state;
    if (req.status === STATUS.SUSPENDED) { /* reject of a suspended live request */ set.status = STATUS.REJECTED; set.pending_state = null; }
    await db.collection(M.requests).updateOne({ _id }, { $set: set, $unset: { queued_at: '' } });
    await db.collection(M.versions).updateOne({ _id: req.version_id }, { $set: { state: action === 'reject' ? 'rejected' : 'changes_requested' } });
    await notifyUser(db, req.author_id, action === 'reject' ? 'rejected' : 'changes', { title, reason, request_id: _id });
    return { outcome: state };
  }
  throw E('bad_action', 400);
}

// Global only: put a suspended (or report-held) request back after a fresh check of the live text.
export async function restore(db, { actor, requestId }) {
  const _id = oid(requestId); const req = _id && await db.collection(M.requests).findOne({ _id });
  if (!req) throw E('not_found', 404);
  if (req.status !== STATUS.SUSPENDED || !req.live) throw E('not_suspended', 409);
  const c = req.live;
  const check = await runGuard({ fields: { title: c.title, description: c.description, outcome: c.outcome, requirements: c.requirements, tags: c.tags, questions: c.questions }, links: c.links, hasAttachments: c.attachments?.length > 0, useAi: true });
  if (check.flagged) throw E('recheck_flagged', 409, { signals: check.signals.slice(0, 10) });
  await db.collection(M.checks).insertOne({ request_id: req._id, version_id: req.live_version_id, hash: req.live_hash, at: new Date(), recheck: true, ...check });
  await db.collection(M.requests).updateOne({ _id }, { $set: { status: STATUS.PUBLISHED, review_queue: null, suspended: null, updated_at: new Date() }, $unset: { queued_at: '' } });
  await db.collection(M.reports).updateMany({ request_id: _id, status: 'open' }, { $set: { status: 'dismissed' } });
  await logDecision(db, req, { scope: 'global', action: 'restore', actor, version_id: req.live_version_id });
  return { outcome: 'published' };
}

// Author drops a pending edit and goes back to the live text.
export async function discardPending(db, user, id) {
  const req = await findOwn(db, user, id);
  if (!req.live) throw E('not_editable', 409);
  if (req.version_id) await db.collection(M.versions).updateOne({ _id: req.version_id, state: { $in: ['pending', 'held', 'changes_requested', 'rejected'] } }, { $set: { state: 'discarded' } });
  await db.collection(M.requests).updateOne({ _id: req._id }, { $set: { content: req.live, pending_state: null, version_id: null, review_queue: null, updated_at: new Date() }, $unset: { queued_at: '' } });
}

export async function closeRequest(db, user, id) {
  const req = await findOwn(db, user, id);
  await db.collection(M.requests).updateOne({ _id: req._id }, { $set: { closed_at: new Date(), updated_at: new Date() } });
}
export async function reopenRequest(db, user, id) {
  const req = await findOwn(db, user, id);
  if (req.accepted_application_id) throw E('already_assigned', 409);
  await db.collection(M.requests).updateOne({ _id: req._id }, { $set: { closed_at: null, updated_at: new Date() } });
}

// Lazy expiry; cheap to call on reads.
let lastSweep = 0;
export async function sweepExpired(db) {
  if (Date.now() - lastSweep < 60_000) return;
  lastSweep = Date.now();
  try { await db.collection(M.requests).updateMany({ status: STATUS.PUBLISHED, expires_at: { $lte: new Date() } }, { $set: { status: STATUS.EXPIRED } }); } catch { /* next time */ }
}
export async function renewRequest(db, user, id) {
  const req = await findOwn(db, user, id);
  if (!req.live || ![STATUS.EXPIRED, STATUS.PUBLISHED].includes(req.status)) throw E('not_editable', 409);
  const settings = await getSettings(db);
  await db.collection(M.requests).updateOne({ _id: req._id }, { $set: { status: STATUS.PUBLISHED, expires_at: new Date(Date.now() + settings.lifetime_days * DAY), closed_at: null, updated_live_at: new Date() } });
}

// ------------------------------------------------------------------- reports
export async function reportRequest(db, user, id, { reason, details }, reasons) {
  const _id = oid(id); const req = _id && await db.collection(M.requests).findOne({ _id, ...publicFilter() });
  if (!req) throw E('not_found', 404);
  if (req.author_id === String(user.id)) throw E('own_request', 409);
  if (!reasons.includes(reason)) throw E('validation_failed', 400, { errors: [{ field: 'reason', code: 'invalid' }] });
  try {
    await db.collection(M.reports).insertOne({ request_id: _id, reporter_id: String(user.id), reason, details: cleanBlock(details, LIMITS.reportDetails), status: 'open', version_id: req.live_version_id, created_at: new Date() });
  } catch (e) { if (e?.code === 11000) throw E('already_reported', 409); throw e; }
  const settings = await getSettings(db);
  const open = await db.collection(M.reports).countDocuments({ request_id: _id, status: 'open' });
  if (open >= settings.report_threshold) {
    const r = await db.collection(M.requests).updateOne({ _id, status: STATUS.PUBLISHED }, { $set: { status: STATUS.SUSPENDED, suspended: { reason: 'reports', at: new Date(), by: 'system' }, review_queue: 'global', queued_at: new Date(), review_reasons: ['reports'] } });
    if (r.modifiedCount) await notifyUser(db, req.author_id, 'suspended', { title: req.card?.title, reason: 'reports', request_id: _id });
  } else {
    await db.collection(M.requests).updateOne({ _id }, { $set: { report_count: open } });
  }
  return { ok: true };
}

// -------------------------------------------------------------- applications
export async function applyToRequest(db, user, id, input) {
  const _id = oid(id); const req = _id && await db.collection(M.requests).findOne({ _id, ...publicFilter() });
  if (!req) throw E('not_found', 404);
  if (req.author_id === String(user.id)) throw E('own_request', 409);
  if (req.accepted_application_id) throw E('already_assigned', 409);
  const { content, errors } = validateApplication(input, { questions: req.live.questions });
  if (errors.length) throw E('validation_failed', 400, { errors });
  const now = new Date();
  try {
    const r = await db.collection(M.applications).insertOne({
      request_id: _id, request_title: req.card.title, author_id: req.author_id, applicant_id: String(user.id), applicant: userLite(user), category: req.category,
      ...content, status: 'sent', created_at: now, updated_at: now,
    });
    await db.collection(M.requests).updateOne({ _id }, { $inc: { app_count: 1 } });
    await notifyUser(db, req.author_id, 'application_new', { title: req.card.title, request_id: _id });
    return { id: String(r.insertedId) };
  } catch (e) { if (e?.code === 11000) throw E('already_applied', 409); throw e; }
}

export async function withdrawApplication(db, user, appId) {
  const _id = oid(appId); const a = _id && await db.collection(M.applications).findOne({ _id, applicant_id: String(user.id) });
  if (!a) throw E('not_found', 404);
  if (a.status === 'selected') throw E('already_assigned', 409);
  await db.collection(M.applications).updateOne({ _id }, { $set: { status: 'withdrawn', updated_at: new Date() } });
}

const APP_STATUS = new Set(['shortlisted', 'declined', 'sent']);
export async function setApplicationStatus(db, user, requestId, appId, status) {
  const req = await findOwn(db, user, requestId);
  if (!APP_STATUS.has(status)) throw E('bad_action', 400);
  const a = await db.collection(M.applications).findOne({ _id: oid(appId), request_id: req._id });
  if (!a || a.status === 'withdrawn' || a.status === 'selected') throw E('not_found', 404);
  await db.collection(M.applications).updateOne({ _id: a._id }, { $set: { status, updated_at: new Date() } });
}

// Single assignment. The first atomic update that sets accepted_application_id wins;
// two authors' clicks (or double clicks) can never select two candidates.
export async function selectApplication(db, user, requestId, appId) {
  const req = await findOwn(db, user, requestId);
  if (req.status !== STATUS.PUBLISHED) throw E('not_editable', 409);
  const a = await db.collection(M.applications).findOne({ _id: oid(appId), request_id: req._id });
  if (!a || ['withdrawn', 'declined'].includes(a.status)) throw E('not_found', 404);
  const now = new Date();
  const won = await db.collection(M.requests).updateOne({ _id: req._id, accepted_application_id: { $exists: false } }, { $set: { accepted_application_id: a._id, closed_at: now, updated_at: now } });
  if (!won.matchedCount) throw E('already_assigned', 409);
  await db.collection(M.applications).updateOne({ _id: a._id }, { $set: { status: 'selected', updated_at: now } });
  const others = await db.collection(M.applications).find({ request_id: req._id, _id: { $ne: a._id }, status: { $in: ['sent', 'shortlisted'] } }).toArray();
  await db.collection(M.applications).updateMany({ request_id: req._id, _id: { $ne: a._id }, status: { $in: ['sent', 'shortlisted'] } }, { $set: { status: 'declined', updated_at: now } });
  await notifyUser(db, a.applicant_id, 'application_selected', { title: req.card?.title || req.content.title, request_id: req._id });
  for (const o of others) await notifyUser(db, o.applicant_id, 'application_declined', { title: req.card?.title || req.content.title, request_id: req._id, dm: false });
  return { ok: true };
}

// ------------------------------------------------------------- internal inbox
export async function sendMessage(db, user, requestId, appId, body) {
  const text = cleanBlock(body, LIMITS.message.max);
  if (text.length < LIMITS.message.min) throw E('validation_failed', 400, { errors: [{ field: 'body', code: 'too_short', params: { min: LIMITS.message.min } }] });
  const a = await db.collection(M.applications).findOne({ _id: oid(appId), request_id: oid(requestId) });
  if (!a) throw E('not_found', 404);
  const me = String(user.id);
  if (me !== a.author_id && me !== a.applicant_id) throw E('not_found', 404);
  const to = me === a.author_id ? a.applicant_id : a.author_id;
  await db.collection(M.messages).insertOne({ request_id: a.request_id, application_id: a._id, from_user_id: me, to_user_id: to, body: text, kind: 'application', created_at: new Date(), read: false });
  await notifyUser(db, to, 'message_new', { title: a.request_title, request_id: a.request_id });
}

export { diffContent };

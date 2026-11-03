import crypto from 'crypto';
import { getDiscordUserById, avatarUrl } from '@/lib/discord';
import { audit, ensureAuditIndexes } from '@/lib/owner-audit';

export const OWNER_ID = process.env.DISCORD_OWNER_ID || '932582842351898644';
export const MAX_DELEGATES = 10;
export const EXPIRY_CHOICES = [1, 7, 30, 90];
export const GRANT_PHRASE = 'GRANT ACCESS';
const SNOWFLAKE = /^\d{15,25}$/;
const CHALLENGE_TTL_MS = 5 * 60 * 1000;

let indexed = false;
async function prepare(db) {
  if (indexed) return;
  indexed = true;
  await ensureAuditIndexes(db);
}

export async function getDelegate(db, userId) {
  const id = String(userId || '');
  if (!SNOWFLAKE.test(id) || id === OWNER_ID) return null;
  try {
    const d = await db.collection('owner_access').findOne({ _id: id, active: true });
    if (!d) return null;
    if (d.expires_at && new Date(d.expires_at).getTime() <= Date.now()) return null;
    return d;
  } catch { return null; }
}

export async function accessRole(db, userId) {
  if (String(userId) === OWNER_ID) return 'owner';
  return (await getDelegate(db, userId)) ? 'delegate' : null;
}

function actorOf(session) {
  const u = session.user || {};
  return { id: u.id, name: u.global_name || u.username };
}

function view(d) {
  return {
    user_id: d._id, username: d.username || null, avatar_url: d.avatar_url || null,
    added_at: d.added_at ? new Date(d.added_at).toISOString() : null,
    expires_at: d.expires_at ? new Date(d.expires_at).toISOString() : null,
    expired: Boolean(d.expires_at && new Date(d.expires_at).getTime() <= Date.now()),
    active: Boolean(d.active),
  };
}

const hash = (t) => crypto.createHash('sha256').update(String(t)).digest('hex');

export async function listAccess(db, session, request) {
  await prepare(db);
  if (!session?.user || String(session.user.id) !== OWNER_ID) return { status: 403, body: { error: 'forbidden' } };
  const [delegates, recent] = await Promise.all([
    db.collection('owner_access').find({ active: true }).sort({ added_at: -1 }).limit(50).toArray(),
    db.collection('owner_audit').find({}).sort({ at: -1 }).limit(40).toArray(),
  ]);
  return {
    status: 200,
    body: {
      max: MAX_DELEGATES, expiry_choices: EXPIRY_CHOICES, phrase: GRANT_PHRASE,
      delegates: delegates.map(view),
      audit: recent.map((a) => ({ at: a.at, actor_id: a.actor_id, actor_name: a.actor_name, role: a.role, action: a.action, outcome: a.outcome, target: a.target, detail: a.detail })),
    },
  };
}

export async function mutateAccess(db, session, request, action, body) {
  await prepare(db);
  const actor = actorOf(session);
  const deny = async (code, status, detail) => {
    await audit(db, { actor, role: 'owner', action: `access.${action}`, outcome: 'denied', target: String(body?.user_id || ''), detail: detail || code, request });
    return { status, body: { error: code } };
  };
  if (!session?.user || String(session.user.id) !== OWNER_ID) {
    await audit(db, { actor, role: 'delegate-or-user', action: `access.${action}`, outcome: 'denied', detail: 'not the owner', request });
    return { status: 403, body: { error: 'forbidden' } };
  }
  const id = String(body?.user_id || '').trim();
  if (!SNOWFLAKE.test(id)) return deny('invalid_id', 400, 'malformed user id');
  if (id === OWNER_ID) return deny('is_owner', 400, 'target is the owner');

  if (action === 'verify') {
    const u = await getDiscordUserById(id);
    if (!u) return deny('user_not_found', 404, 'Discord does not know this id');
    if (u.bot) return deny('is_bot', 400, 'target is a bot account');
    const existing = await db.collection('owner_access').findOne({ _id: id, active: true });
    if (existing && (!existing.expires_at || new Date(existing.expires_at).getTime() > Date.now())) return deny('already_granted', 409, 'already has access');
    const count = await db.collection('owner_access').countDocuments({ active: true });
    if (count >= MAX_DELEGATES) return deny('limit_reached', 409, 'delegate limit reached');
    const token = crypto.randomBytes(24).toString('base64url');
    await db.collection('owner_access_challenges').insertOne({
      _id: hash(token), owner: OWNER_ID, target: id, expires_at: new Date(Date.now() + CHALLENGE_TTL_MS),
    });
    await audit(db, { actor, role: 'owner', action: 'access.verify', outcome: 'info', target: `${u.username} (${id})`, detail: 'candidate looked up, awaiting confirmation', request });
    return { status: 200, body: { token, expires_in: CHALLENGE_TTL_MS / 1000, user: { id, username: u.global_name || u.username, handle: u.username, avatar_url: avatarUrl(u) } } };
  }

  if (action === 'grant') {
    const days = Number(body.days);
    if (!EXPIRY_CHOICES.includes(days)) return deny('invalid_expiry', 400, 'expiry not allowed');
    if (String(body.confirm_id || '').trim() !== id) return deny('confirm_id_mismatch', 400, 'confirmation id mismatch');
    if (String(body.confirm_phrase || '').trim() !== GRANT_PHRASE) return deny('confirm_phrase_mismatch', 400, 'confirmation phrase mismatch');
    const ch = await db.collection('owner_access_challenges').deleteOne({ _id: hash(body.token || ''), owner: OWNER_ID, target: id, expires_at: { $gt: new Date() } });
    if (!ch?.deletedCount) return deny('challenge_invalid', 400, 'verification missing or expired');
    const u = await getDiscordUserById(id);
    if (!u || u.bot) return deny('user_not_found', 404, 'account failed the final check');
    const count = await db.collection('owner_access').countDocuments({ active: true, _id: { $ne: id } });
    if (count >= MAX_DELEGATES) return deny('limit_reached', 409, 'delegate limit reached');
    const now = new Date();
    await db.collection('owner_access').updateOne(
      { _id: id },
      { $set: { active: true, username: u.global_name || u.username, avatar_url: avatarUrl(u), added_by: OWNER_ID, added_at: now, expires_at: new Date(now.getTime() + days * 86400000), revoked_at: null } },
      { upsert: true },
    );
    await audit(db, { actor, role: 'owner', action: 'access.grant', outcome: 'ok', target: `${u.username} (${id})`, detail: `community management access for ${days} day(s)`, request });
    return { status: 200, body: { ok: true } };
  }

  if (action === 'revoke') {
    const r = await db.collection('owner_access').updateOne({ _id: id, active: true }, { $set: { active: false, revoked_at: new Date(), revoked_by: OWNER_ID } });
    if (!r.matchedCount) return deny('not_found', 404, 'no active grant');
    await audit(db, { actor, role: 'owner', action: 'access.revoke', outcome: 'ok', target: id, detail: 'delegated access revoked', request });
    return { status: 200, body: { ok: true } };
  }
  return { status: 404, body: { error: 'not_found' } };
}

export function trustedOrigin(request) {
  const origin = request.headers.get('origin');
  if (!origin) return false;
  const base = process.env.NEXT_PUBLIC_BASE_URL;
  if (!base) return true;
  try {
    const n = (h) => h.replace(/^www\./, '');
    return n(new URL(origin).host) === n(new URL(base).host);
  } catch { return false; }
}

// FILE: route.js
// PUNE ÎN: app/api/verify/[guildId]/route.js
//
// Ruta publică pentru modulul Captcha. Este intenționat SEPARATĂ de
// app/api/[[...path]]/route.js: acel fișier cere peste tot canManage()
// (adică drepturi de administrare pe server) prin guardGuildAccess(), ceea
// ce e corect pentru panoul de configurare, dar greșit aici, orice membru
// obișnuit trebuie să se poată verifica pe el însuși, nu doar administratorii.
//
// Layers a request has to pass before a role is granted, in order:
//   1. Same-origin check (isTrustedOrigin), so this endpoint is no weaker
//      than every mutation on the main API.
//   2. Rate limit per Discord account. No IP address is read, logged or
//      stored anywhere in this route.
//   3. Verification cooldown per (guild, user).
//   4. Honeypot field: present in the form, hidden from humans, must be
//      empty. Form-filling bots populate every input they find.
//   5. Wody Human Check pass (lib/humancheck.js): a one-use token that proves
//      the visitor passed the "I am not a robot" box for THIS server and THIS
//      account only (proof of work, behaviour score, picture puzzle).
//   6. The minimum solve time is enforced inside the Human Check itself.
//   7. Optional minimum Discord account age, derived from the snowflake in
//      the server-side session, so it cannot be forged.
//   8. Membership confirmed through the Discord API with the bot token.
//   9. Role granted is the one the admin saved for THAT guild, never
//      anything taken from the request body.
import { NextResponse } from 'next/server';
import { getDb, toLong } from '@/lib/mongo';
import { getSession } from '@/lib/session';
import { getGuildMemberRaw, addGuildMemberRole, getBotGuild } from '@/lib/discord';
import { accountAgeDays, isTrustedOrigin } from '@/lib/captcha';
import { consumePass } from '@/lib/humancheck';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function json(data, init = {}) {
  return NextResponse.json(data, { ...init, headers: { 'Cache-Control': 'no-store, private', ...(init.headers || {}) } });
}

// No IP address is read, logged or stored anywhere in this module: this
// endpoint intentionally has no per-IP check. The only anti-abuse limit is
// the per-Discord-account one below, so nothing here can be used to track
// or bucket a visitor by network address.
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 8; // generous, a real person clicking "Verifică" a couple of times is fine

// Cooldown after ANY successful verification on a given (guild, user) pair:
// for COOLDOWN_MS afterwards, this endpoint always reports/blocks on the
// cooldown first, before even checking membership or role, regardless of
// whether the member still has the role, lost it by leaving and rejoining,
// or left and never came back. The dashboard/admin only cares that the same
// Discord account can't re-trigger verification on the same server more
// than once every 5 minutes; whether they're currently a member is a
// separate, secondary question that's only evaluated once the cooldown has
// actually elapsed.
const COOLDOWN_MS = 5 * 60_000;

async function cooldownRemainingMs(db, guildId, userId) {
  const last = await db.collection('captcha_verifications')
    .find({ guild_id: toLong(guildId), user_id: toLong(userId) })
    .sort({ verified_at: -1 })
    .limit(1)
    .toArray();
  if (!last.length) return 0;
  const elapsed = Date.now() - new Date(last[0].verified_at).getTime();
  return Math.max(0, COOLDOWN_MS - elapsed);
}

async function rateLimited(db, key, max = RATE_LIMIT_MAX) {
  const now = Date.now();
  const windowStart = now - (now % RATE_LIMIT_WINDOW_MS);
  const bucketId = `captcha_verify:${key}:${windowStart}`;
  try {
    const result = await db.collection('rate_limit_buckets').findOneAndUpdate(
      { _id: bucketId },
      { $inc: { count: 1 }, $setOnInsert: { expires_at: new Date(windowStart + RATE_LIMIT_WINDOW_MS * 2) } },
      { upsert: true, returnDocument: 'after' },
    );
    return (result?.count || 0) > max;
  } catch {
    return false;
  }
}

async function loadSettings(db, guildId) {
  return db.collection('captcha_settings').findOne({ guild_id: toLong(guildId) });
}

// Discord guild ids are numeric snowflakes. Anything else can only come from
// a hand-crafted URL, and letting it reach toLong() turned a bad request
// into an unhandled Long.fromString throw, i.e. an HTTP 500 on a route that
// anyone can hit without logging in.
function validGuildId(guildId) {
  return /^\d{5,25}$/.test(String(guildId || ''));
}

// GET: public status the verify page needs to render itself. Never leaks
// anything sensitive (no role id, no channel id, and never the challenge
// answer), only display texts plus whether the visitor is logged in /
// already verified, and the question itself when one applies.
export async function GET(request, { params }) {
  const { guildId } = await params;
  if (!validGuildId(guildId)) return json({ enabled: false }, { status: 400 });

  const db = await getDb();
  const settings = await loadSettings(db, guildId);
  if (!settings || !settings.enabled) {
    return json({ enabled: false });
  }
  const session = await getSession();
  const guild = await getBotGuild(guildId).catch(() => null);

  const texts = {
    heading: settings.page_heading || 'Member Verification',
    description: settings.page_description || 'Confirm you are a real person to get access to the server.',
    button_label: settings.page_button_label || 'Verify',
    success_heading: settings.page_success_heading || 'You are verified',
    success_message: settings.page_success_message || 'You can go back to Discord, your role has been granted.',
    already_verified_message: settings.page_already_verified_message || 'You are already verified on this server.',
    not_member_message: settings.page_not_member_message || 'You are not a member of this server. Join the server and try again.',
  };

  if (!session?.user) {
    return json({ enabled: true, authenticated: false, guild_name: guild?.name || null, texts });
  }

  // Cooldown first, before anything about current membership/role, see the
  // comment on COOLDOWN_MS above. Kept independent of is_member and
  // already_verified so it applies the same whether they still have the
  // role, lost it, or left the server entirely.
  const remainingMs = await cooldownRemainingMs(db, guildId, session.user.id);
  if (remainingMs > 0) {
    return json({
      enabled: true,
      authenticated: true,
      guild_name: guild?.name || null,
      user: { id: session.user.id, username: session.user.global_name || session.user.username },
      cooldown_seconds: Math.ceil(remainingMs / 1000),
      texts,
    });
  }

  let already_verified = false;
  let is_member = false;
  if (settings.role_id) {
    const member = await getGuildMemberRaw(guildId, session.user.id);
    is_member = !!member;
    if (member) {
      const roleIds = (member.roles || []).map(String);
      already_verified = roleIds.includes(String(settings.role_id));
    }
  }

  return json({
    enabled: true,
    authenticated: true,
    guild_name: guild?.name || null,
    user: { id: session.user.id, username: session.user.global_name || session.user.username },
    is_member,
    already_verified,
    cooldown_seconds: 0,
    check_ctx: `${guildId}:${session.user.id}`,
    texts,
  });
}

// POST: performs the actual verification + role grant.
export async function POST(request, { params }) {
  const { guildId } = await params;
  if (!validGuildId(guildId)) return json({ error: 'bad_request' }, { status: 400 });

  if (!isTrustedOrigin(request)) {
    return json({ error: 'forbidden_origin' }, { status: 403 });
  }

  const db = await getDb();
  const settings = await loadSettings(db, guildId);
  if (!settings || !settings.enabled) {
    return json({ error: 'captcha_disabled' }, { status: 400 });
  }
  if (!settings.role_id || !settings.channel_id) {
    return json({ error: 'not_configured' }, { status: 400 });
  }

  const session = await getSession();
  if (!session?.user) {
    return json({ error: 'unauthenticated' }, { status: 401 });
  }

  const rawBody = await request.json().catch(() => ({}));
  const body = (rawBody && typeof rawBody === 'object' && !Array.isArray(rawBody)) ? rawBody : {};

  // Per-account rate limit only. No IP address is read or stored by this
  // route: the earlier per-IP bucket has been removed on request, so nothing
  // here can be used to bucket or track a visitor by network address, only
  // by their own Discord account (already required to reach this point).
  if (await rateLimited(db, session.user.id)) {
    return json({ error: 'rate_limited' }, { status: 429 });
  }

  // Cooldown, same reasoning and same order as GET above. Checked before
  // membership/role so it can't be bypassed by leaving, rejoining, or having
  // the role manually removed and re-added.
  const remainingMs = await cooldownRemainingMs(db, guildId, session.user.id);
  if (remainingMs > 0) {
    return json({ error: 'cooldown', retry_after: Math.ceil(remainingMs / 1000) }, { status: 429 });
  }

  // Honeypot: the form renders this field off-screen with autocomplete off,
  // so a human never sees it and never fills it. Anything that blindly
  // populates every input in the DOM gives itself away here. Reported as a
  // generic challenge failure, with no hint about which check tripped.
  if (String(body.website || '').trim() !== '') {
    return json({ error: 'challenge_failed' }, { status: 400 });
  }

  // ---- Wody Human Check -----------------------------------------------
  // The pass is signed, bound to this purpose and to this exact (server, account)
  // pair, and can be spent only once. A pass earned anywhere else is refused.
  const passOk = await consumePass(db, String(body.pass || ''), 'verify', `${guildId}:${session.user.id}`);
  if (!passOk) {
    return json({ error: 'challenge_expired' }, { status: 400 });
  }

  // Optional per-guild minimum account age. Off by default (0), so enabling
  // the module never silently blocks legitimate new Discord users unless an
  // admin explicitly asks for it.
  const minAgeDays = Number(settings.min_account_age_days || 0);
  if (minAgeDays > 0) {
    const age = accountAgeDays(session.user.id);
    if (age !== null && age < minAgeDays) {
      return json({
        error: 'account_too_new',
        required_days: minAgeDays,
        account_age_days: Math.floor(age),
      }, { status: 403 });
    }
  }

  const member = await getGuildMemberRaw(guildId, session.user.id);
  if (!member) {
    return json({ error: 'not_member' }, { status: 403 });
  }

  const roleId = String(settings.role_id);
  const alreadyHasRole = (member.roles || []).map(String).includes(roleId);
  if (alreadyHasRole) {
    return json({ ok: true, already_verified: true });
  }

  const result = await addGuildMemberRole(guildId, session.user.id, roleId, 'Wody Captcha verification');
  if (!result.ok) {
    // Most common real-world cause: the bot's own top role sits below the
    // configured role, or the bot lost Manage Roles. Surface a message an
    // admin can actually act on instead of a bare 403/50013.
    return json({ error: 'role_grant_failed', detail: result.detail || `HTTP ${result.status}` }, { status: 502 });
  }

  await db.collection('captcha_verifications').insertOne({
    guild_id: toLong(guildId),
    user_id: toLong(session.user.id),
    role_id: toLong(roleId),
    verified_at: new Date(),
  });

  return json({ ok: true, already_verified: false });
}

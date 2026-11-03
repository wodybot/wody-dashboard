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

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 8;

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

function validGuildId(guildId) {
  return /^\d{5,25}$/.test(String(guildId || ''));
}

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

  if (await rateLimited(db, session.user.id)) {
    return json({ error: 'rate_limited' }, { status: 429 });
  }

  const remainingMs = await cooldownRemainingMs(db, guildId, session.user.id);
  if (remainingMs > 0) {
    return json({ error: 'cooldown', retry_after: Math.ceil(remainingMs / 1000) }, { status: 429 });
  }

  if (String(body.website || '').trim() !== '') {
    return json({ error: 'challenge_failed' }, { status: 400 });
  }

  const passOk = await consumePass(db, String(body.pass || ''), 'verify', `${guildId}:${session.user.id}`);
  if (!passOk) {
    return json({ error: 'challenge_expired' }, { status: 400 });
  }

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

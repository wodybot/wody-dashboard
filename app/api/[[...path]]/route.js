
import { CARD_FONT_IDS } from '@/lib/card-fonts';
import { configGroups, botComparison, liveChecks } from '@/lib/owner-config';
import { normalizePage, validatePagePatch } from '@/lib/profile-page';
import { loadPassport } from '@/lib/collab/public-profile';
import { loadProfilePass } from '@/lib/battlepass/profile';
import { applyPatch as applyProfilePatch, normalizeConfig as normalizeProfileConfig, PROFILE_CARD } from '@/lib/profile-card';
import { sniffImage as sniffProfileImage } from '@/lib/community/images';
import { ObjectId as ProfileObjectId } from 'mongodb';
import { M } from '@/lib/collab/db';
import { POLICY_VERSION, accountState, hasUserImage } from '@/lib/account-moderation';
import { NextResponse } from 'next/server';
import { getDb, toLong, serializeDoc, deserializeInput, Long } from '@/lib/mongo';
import { getSession, setSession, clearSession, issueOAuthState, consumeOAuthState } from '@/lib/session';
import {
  exchangeCode,
  getUser,
  getUserGuilds,
  getBotGuilds,
  joinCommunityGuild,
  getGuildChannels,
  getGuildChannelsResult,
  getGuildRolesResult,
  getGuildRoles,
  canManage,
  sendGuildMessage,
  editGuildMessage,
  deleteGuildMessage,
  addMessageReaction,
  getGuildMembersMap,
  getGuildMember,
  getBotUser,
  avatarUrl,
  guildIconUrl,
  getBotGuild,
  getBotGuildCounts,
  sendDirectMessage,
  setBotNickname,
  leaveGuild,
  embedToV2Payload,
  getDiscordUserById,
  getGuildMemberRaw,
  getGuildMembersProfileMap,
  searchGuildMembers,
} from '@/lib/discord';
import { isModuleRoute, handleModuleGet, handleModuleMutation } from '@/lib/modules/router';
import {
  resolveChannelId,
  subscribeToHub,
  unsubscribeFromHub,
  generateSecret,
  generateCallbackToken,
} from '@/lib/youtube';
import { getAutumnConfig, parseAutumnPatch, saveAutumnPatch } from '@/lib/autumn';
import { getSeasonConfig, parseSeasonPatch, saveSeasonPatch } from '@/lib/season-effects';
import { getShowcaseConfig, parseShowcasePatch, saveShowcasePatch, getShowcaseServers } from '@/lib/community-showcase';
import { getFooterSocials, parseFooterSocials, saveFooterSocials } from '@/lib/footer-socials';
import { getBotWelcomeConfig, saveBotWelcomeConfig } from '@/lib/bot-welcome';
import { getPromoBannerConfig, parsePromoBannerPatch, savePromoBannerPatch } from '@/lib/promo-banner';
import { getCountdownBannerConfig, parseCountdownBannerPatch, saveCountdownBannerPatch, withBackgroundSrc } from '@/lib/countdown-banner';
import { getOgEmbedConfig, parseOgEmbedPatch, saveOgEmbedPatch } from '@/lib/og-embed';
import { publishedBySlug } from '@/lib/gifstudio/publish';
import { getCareersRolesConfig, parseCareersRolesPatch, saveCareersRolesPatch } from '@/lib/careers-roles';
import { slugify, parseBlogPostInput, ensureUniqueSlug, BLOG_COLLECTION, readWithRetry } from '@/lib/blog';
import { UNLIMITED_LIMIT } from '@/lib/limits';
import { PARTNERS_COLLECTION, parsePartnerInput, serializePartner, getPublicPartners, getAllPartners } from '@/lib/partners';
import { parseStaffInput, STAFF_COLLECTION } from '@/lib/staff';
import { getDelegate, listAccess, mutateAccess } from '@/lib/owner-access';
import { audit } from '@/lib/owner-audit';
import { parseUpdateExtras, updateDiscordPayload } from '@/lib/updates';
import { parseAdvancedEmbed, linkButtonRows } from '@/lib/advanced-embed';

const YOUTUBE_NOTIFY_MAX_CHANNELS = Number(process.env.YOUTUBE_NOTIFY_MAX_CHANNELS || 3);

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const OWNER_ID = process.env.DISCORD_OWNER_ID || '932582842351898644';

const MODULE_TOGGLE_KEYS = [
  'welcome', 'goodbye', 'autorole',
  'moderation', 'automod', 'logging',
  'tickets', 'reaction_roles', 'auto_responses',
  'custom_commands', 'giveaways', 'scheduled_messages', 'forums',
  'levels', 'suggestions', 'captcha',
  'backups', 'temporary_voice', 'youtube_notify',
  'economy', 'blackjack', 'stream_notifications', 'birthdays', 'invite_tracking',
  'lookups', 'feeds', 'link',
  'counting', 'battlepass', 'theme_studio',
];

const PREMIUM_ONLY_TOGGLE_KEYS = new Set(['backups', 'temporary_voice', 'youtube_notify', 'economy', 'blackjack', 'stream_notifications', 'battlepass', 'theme_studio']);

const UPDATES_ANNOUNCE_CHANNEL_ID = process.env.UPDATES_ANNOUNCE_CHANNEL_ID || '1529784783847166032';

const SITE_URL = (process.env.NEXT_PUBLIC_BASE_URL || 'https://wody.online').replace(/\/+$/, '');

const UPDATE_THUMBNAIL_URL = `${SITE_URL}/api/status/bot-avatar`;

function stripEmoji(text) {
  return String(text || '')
    .replace(/[\u{1F1E6}-\u{1F1FF}\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}]/gu, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/ +\n/g, '\n')
    .trim();
}

const UPDATE_TAG_COLORS = {
  Feature: 0xc46a2d,
  Fix: 0x0ea5e9,
  Announcement: 0x8b5cf6,
  Update: 0x6b7280,
};

function updateEmbed(item) {
  const link = `[View this update on the website](${SITE_URL}/updates)`;
  const bodyRoom = 4096 - link.length - 4;
  const truncatedBody = item.body.length > bodyRoom
    ? `${item.body.slice(0, bodyRoom - 1)}…`
    : item.body;
  return {
    title: item.title.slice(0, 256),
    description: `${truncatedBody}\n\n${link}`,
    color: UPDATE_TAG_COLORS[item.tag] || UPDATE_TAG_COLORS.Update,
    footer: { text: item.tag },
    timestamp: item.created_at.toISOString(),
    thumbnail: { url: UPDATE_THUMBNAIL_URL },
  };
}

const RATE_LIMIT_WINDOW_MS = 10_000;
const RATE_LIMIT_MAX = 20;

async function rateLimited(db, key) {
  const now = Date.now();
  const windowStart = now - (now % RATE_LIMIT_WINDOW_MS);
  const bucketId = `${key}:${windowStart}`;
  try {
    const result = await db.collection('rate_limit_buckets').findOneAndUpdate(
      { _id: bucketId },
      {
        $inc: { count: 1 },
        $setOnInsert: { expires_at: new Date(windowStart + RATE_LIMIT_WINDOW_MS * 2) },
      },
      { upsert: true, returnDocument: 'after' },
    );
    return (result?.count || 0) > RATE_LIMIT_MAX;
  } catch (e) {
    console.error('rate limiter unavailable', e);
    return false;
  }
}

const DISCORD_LOOKUP_TIMEOUT_MS = 5000;
function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}

async function weightedPick(guildId, participantIds, roleWeights) {
  const weights = {};
  if (roleWeights && typeof roleWeights === 'object') {
    for (const [roleId, w] of Object.entries(roleWeights)) {
      const n = Number(w);
      if (Number.isFinite(n)) weights[String(roleId)] = Math.max(0.01, n);
    }
  }
  if (Object.keys(weights).length === 0) {
    return participantIds[Math.floor(Math.random() * participantIds.length)];
  }
  const pool = await Promise.all(participantIds.map(async (uid) => {
    const member = await withTimeout(getGuildMemberRaw(guildId, uid).catch(() => null), DISCORD_LOOKUP_TIMEOUT_MS);
    const roleIds = member?.roles || [];
    const matched = roleIds.map((r) => weights[String(r)]).filter((w) => typeof w === 'number');
    return [uid, matched.length ? Math.max(...matched) : 1];
  }));
  const total = pool.reduce((sum, [, w]) => sum + w, 0);
  if (total <= 0) return participantIds[Math.floor(Math.random() * participantIds.length)];
  let r = Math.random() * total;
  for (const [uid, w] of pool) {
    r -= w;
    if (r <= 0) return uid;
  }
  return pool[pool.length - 1][0];
}

function json(data, init = {}) {
  return NextResponse.json(data, {
    ...init,
    headers: { 'Cache-Control': 'no-store, private', ...(init.headers || {}) },
  });
}

async function guardGuildAccess(guildId) {
  // The ban check, the session and the user's server list are independent, so they are read together instead of one after another.
  const session = await getSession();
  if (!session?.accessToken) return { error: json({ error: 'unauthenticated' }, { status: 401 }) };
  const [blocked, guildsResult] = await Promise.all([
    getDb().then((db) => db.collection('guild_bans').findOne({ guild_id: String(guildId), active: true })),
    getUserGuilds(session.accessToken).then((v) => ({ ok: true, v }), () => ({ ok: false })),
  ]);
  if (blocked) {
    return { error: json({ error: 'guild_banned', message: 'This server is blocked from using Wody.' }, { status: 403 }) };
  }
  if (!guildsResult.ok) return { error: json({ error: 'temporarily_unavailable' }, { status: 503 }) };
  const guilds = guildsResult.v;
  const g = guilds.find((x) => x.id === guildId);
  if (!g || !canManage(g.permissions, g.owner)) {
    return { error: json({ error: 'forbidden' }, { status: 403 }) };
  }
  return { session, guild: g };
}

async function assertTextChannelInGuild(guildId, channelId) {
  if (!channelId) return false;
  try {
    const channels = await getGuildChannels(guildId);
    return (channels || []).some((c) => String(c.id) === String(channelId) && [0, 5].includes(Number(c.type)));
  } catch {
    return false;
  }
}

async function assertChannelInGuild(guildId, channelId) {
  if (!channelId) return false;
  try {
    const channels = await getGuildChannels(guildId);
    return (channels || []).some((c) => String(c.id) === String(channelId));
  } catch {
    return false;
  }
}

async function assertCategoryInGuild(guildId, categoryId) {
  if (!categoryId) return false;
  try {
    const channels = await getGuildChannels(guildId);
    return (channels || []).some((c) => String(c.id) === String(categoryId) && Number(c.type) === 4);
  } catch {
    return false;
  }
}

async function assertRoleInGuild(guildId, roleId) {
  if (!roleId) return true;
  try {
    const roles = await getGuildRoles(guildId);
    return (roles || []).some((r) => String(r.id) === String(roleId) && !r.managed);
  } catch {
    return false;
  }
}

function ticketPanelComponents(panel) {
  const options = Array.isArray(panel.options) ? panel.options : [];
  if (options.length > 1) {
    return [{ type: 1, components: [{
      type: 3, custom_id: 'wody:ticket:select',
      placeholder: String(panel.select_placeholder || 'Choose a ticket type…').slice(0, 150),
      options: options.slice(0, 25).map((o) => ({
        label: String(o.label || 'Ticket').slice(0, 100),
        value: String(o.id),
        ...(o.emoji ? { emoji: { id: String(o.emoji).match(/^<a?:[^:]+:(\d+)>$/)?.[1] || undefined, name: String(o.emoji).match(/^<a?:([^:]+):\d+>$/)?.[1] || (String(o.emoji).match(/^<a?:/) ? undefined : String(o.emoji)), animated: /^<a?:/.test(String(o.emoji)) } } : {}),
      })),
    }] }];
  }
  const o = options[0] || {};
  const emoji = String(panel.button_emoji || '{wy:ticket}');
  const custom = emoji.match(/^<a?:([^:]+):(\d+)>$/);
  return [{ type: 1, components: [{
    type: 2, style: Number.isInteger(panel.button_style) && [1,2,3,4].includes(panel.button_style) ? panel.button_style : 1, custom_id: 'wody:ticket:open',
    label: String(panel.button_label || 'Open ticket').slice(0, 80),
    ...(custom ? { emoji: { name: custom[1], id: custom[2], animated: emoji.startsWith('<a:') } } : { emoji: { name: emoji } }),
  }] }];
}

function captchaPanelEmbed(settings) {
  const embed = {
    title: String(settings.embed_title || 'Verificare membru').slice(0, 256),
    description: String(settings.embed_description || '').slice(0, 4096),
    color: Number.isFinite(parseInt(String(settings.embed_color || '').replace('#', ''), 16))
      ? parseInt(String(settings.embed_color).replace('#', ''), 16)
      : 0xe08a4e,
  };
  if (settings.embed_footer) embed.footer = { text: String(settings.embed_footer).slice(0, 2048) };
  if (settings.embed_image_url) embed.image = { url: String(settings.embed_image_url).slice(0, 2048) };
  return embed;
}

function captchaPanelComponents(settings, guildId) {
  const emoji = String(settings.button_emoji || '{wy:success}');
  const custom = emoji.match(/^<a?:([^:]+):(\d+)>$/);
  return [{ type: 1, components: [{
    type: 2, style: 5,
    label: String(settings.button_label || 'Verifica te').slice(0, 80),
    url: `${SITE_URL}/verify/${guildId}`,
    ...(custom ? { emoji: { name: custom[1], id: custom[2], animated: emoji.startsWith('<a:') } } : (emoji ? { emoji: { name: emoji } } : {})),
  }] }];
}

function ticketPanelEmbed(panel) {
  const embed = {
    title: String(panel.title || 'Tickets').slice(0, 256),
    description: String(panel.description || '').slice(0, 4096),
    color: Number(panel.color || 0xe08a4e),
  };
  const footer = panel.footer_text;
  if (footer) embed.footer = { text: String(footer).slice(0, 2048) };
  if (panel.panel_image_url) {
    if (panel.panel_image_position === 'thumbnail') embed.thumbnail = { url: String(panel.panel_image_url).slice(0, 2048) };
    else embed.image = { url: String(panel.panel_image_url).slice(0, 2048) };
  }
  return embed;
}

const TICKET_IMAGE_MODES = ['opener_avatar', 'server_avatar', 'custom', 'none'];

function sanitizeImageUrl(value) {
  if (!value) return null;
  const u = new URL(String(value));
  if (!['http:', 'https:'].includes(u.protocol)) throw new Error('bad_protocol');
  assertRoutableImageHost(u);
  return u.href.slice(0, 2048);
}

function assertRoutableImageHost(u) {
  const host = String(u.hostname || '').toLowerCase().replace(/\.$/, '');
  if (!host) throw new Error('bad_host');
  if (host.startsWith('[')) throw new Error('bad_host');
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) throw new Error('bad_host');
  if (!host.includes('.')) throw new Error('bad_host');
  if (host.endsWith('.local') || host.endsWith('.internal')) throw new Error('bad_host');
}

async function assertRolesInGuild(guildId, roleIds) {
  const ids = Array.from(new Set((roleIds || []).filter(Boolean).map(String)));
  if (ids.length === 0) return true;
  try {
    const roles = await getGuildRoles(guildId);
    const valid = new Set((roles || []).map((r) => String(r.id)));
    return ids.every((id) => valid.has(id));
  } catch {
    return false;
  }
}

async function assertChannelsInGuild(guildId, channelIds) {
  const ids = Array.from(new Set((channelIds || []).filter(Boolean).map(String)));
  if (ids.length === 0) return true;
  try {
    const channels = await getGuildChannels(guildId);
    const valid = new Set((channels || []).map((c) => String(c.id)));
    return ids.every((id) => valid.has(id));
  } catch {
    return false;
  }
}

function buttonEmojiPayload(raw) {
  const value = String(raw || '').trim();
  if (!value) return null;
  const custom = value.match(/^<a?:(\w+):(\d+)>$/);
  if (custom) return { name: custom[1], id: custom[2] };
  return { name: value };
}

async function assertChannelFieldsInGuild(guildId, data, fields) {
  const present = fields.filter((f) => data[f]);
  if (present.length === 0) return null;
  let channels;
  try {
    channels = await getGuildChannels(guildId);
  } catch {
    channels = [];
  }
  const validIds = new Set((channels || []).map((c) => String(c.id)));
  for (const f of present) {
    if (!validIds.has(String(data[f]))) return f;
  }
  return null;
}


const FREE_TICKET_PANEL_LIMIT = 1;

const MAX_TICKET_TYPES = 10;
const FREE_REACTION_PANEL_LIMIT = 1;
const FREE_AUTO_RESPONSE_LIMIT = 5;
const FREE_CUSTOM_COMMAND_LIMIT = 5;
const FREE_SCHEDULED_MESSAGE_LIMIT = 1;
const FREE_GIVEAWAY_LIMIT = 1;
const FREE_FORUM_LIMIT = 1;
const PREMIUM_UNLIMITED = UNLIMITED_LIMIT;

function keyStatus(doc) {
  if (!doc) return 'unknown';
  if (doc.revoked) return doc.revoked_reason === 'expired' ? 'expired' : 'revoked';
  if (doc.expires_at && new Date(doc.expires_at) < new Date()) return 'expired';
  if ((doc.activations_used || 0) >= (doc.activations_limit || 1)) return 'exhausted';
  return 'active';
}

async function deactivateServersForKey(db, keyValue, reason) {
  if (!keyValue) return 0;
  const result = await db.collection('premium_servers').updateMany(
    { key_value: keyValue, active: true },
    { $set: { active: false, suspended: true, suspended_reason: reason, revoked_at: new Date() } }
  );
  return result.modifiedCount || 0;
}

async function sweepExpiredPremium(db) {
  const now = new Date();
  const expired = await db.collection('premium_servers')
    .find({ active: true, expires_at: { $ne: null, $lt: now } })
    .toArray();
  if (expired.length === 0) return;
  const guildIds = expired.map((d) => d.guild_id);
  const keyValues = [...new Set(expired.map((d) => d.key_value).filter(Boolean))];
  await db.collection('premium_servers').updateMany(
    { guild_id: { $in: guildIds }, active: true },
    { $set: { active: false, suspended: true, suspended_reason: 'expired', revoked_at: now } }
  );
  if (keyValues.length > 0) {
    await db.collection('premium_keys').updateMany(
      { key: { $in: keyValues }, revoked: { $ne: true } },
      { $set: { revoked: true, revoked_reason: 'expired' } }
    );
  }
}

const VOTE_REDEEM_MIN = Math.max(1, Number(process.env.VOTE_REDEEM_MIN) || 7);

async function isGuildPremium(db, gidLong) {
  const doc = await db.collection('premium_servers').findOne({ guild_id: gidLong, active: true });
  if (!doc) return false;
  if (doc.suspended) return false;
  if (doc.expires_at && new Date(doc.expires_at) < new Date()) {
    const now = new Date();
    await db.collection('premium_servers').updateOne(
      { _id: doc._id },
      { $set: { active: false, suspended: true, suspended_reason: 'expired', revoked_at: now } }
    );
    if (doc.key_value) {
      await db.collection('premium_keys').updateOne(
        { key: doc.key_value, revoked: { $ne: true } },
        { $set: { revoked: true, revoked_reason: 'expired' } }
      );
    }
    return false;
  }
  return true;
}


async function unsubscribeIfOrphaned(db, youtubeChannelId) {
  const stillWatched = await db.collection('youtube_notify_channels').countDocuments(
    { youtube_channel_id: youtubeChannelId },
    { limit: 1 }
  );
  if (stillWatched) return;
  const sub = await db.collection('youtube_websub_subscriptions').findOne({ youtube_channel_id: youtubeChannelId });
  if (!sub) return;
  if (sub.callback_token) {
    await unsubscribeFromHub(youtubeChannelId, sub.callback_secret, sub.callback_token).catch(() => {});
  }
  await db.collection('youtube_websub_subscriptions').deleteOne({ _id: sub._id });
}

async function unwatchAllYoutubeChannels(db, gidLong) {
  const docs = await db.collection('youtube_notify_channels').find({ guild_id: gidLong }).toArray();
  await db.collection('youtube_notify_channels').deleteMany({ guild_id: gidLong });
  for (const doc of docs) {
    await unsubscribeIfOrphaned(db, doc.youtube_channel_id);
  }
}

const _youtubeNotifyHits = new Map();
async function youtubeNotifyRateLimit(guildId, limit = 20, windowMs = 60_000) {
  const now = Date.now();
  const key = String(guildId);
  const entry = _youtubeNotifyHits.get(key);
  if (!entry || now > entry.resetAt) {
    _youtubeNotifyHits.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  entry.count += 1;
  return entry.count <= limit;
}

async function logPremiumAudit(db, action, actorId, extra = {}) {
  try {
    await db.collection('premium_audit_log').insertOne({
      action,
      actor_id: actorId ? (toLong(actorId) || Long.ZERO) : Long.ZERO,
      ...extra,
      created_at: new Date(),
    });
  } catch (e) {
    console.error('premium_audit_log insert failed', e);
  }
}

async function mirrorModuleState(guildId, key, enabled) {
  try {
    const db = await getDb();
    await db.collection('guild_settings').updateOne(
      { guild_id: toLong(guildId) },
      { $set: { [`module_states.${key}`]: Boolean(enabled), updated_at: new Date() } },
      { upsert: true },
    );
  } catch (e) {
    console.error('mirrorModuleState failed', e);
  }
}

async function upsertOne(collection, guildId, data, actor) {
  const db = await getDb();
  const gidLong = toLong(guildId);
  const filter = { guild_id: gidLong };
  const payload = deserializeInput(data);
  payload.updated_at = new Date();
  const existing = await db.collection(collection).findOne(filter);
  const before = existing ? serializeDoc(existing) : null;
  if (existing) {
    await db.collection(collection).updateOne(filter, { $set: payload });
  } else {
    payload.created_at = new Date();
    payload.guild_id = gidLong;
    await db.collection(collection).insertOne(payload);
  }
  const after = serializeDoc(await db.collection(collection).findOne(filter));

  try {
    const diff = {};
    for (const k of Object.keys(data)) {
      const from = before ? (before[k] ?? null) : null;
      const to = after[k] ?? null;
      if (JSON.stringify(from) !== JSON.stringify(to)) diff[k] = { from, to };
    }
    if (Object.keys(diff).length > 0) {
      await db.collection('settings_audit').insertOne({
        guild_id: gidLong,
        collection,
        user_id: actor?.userId ? (toLong(actor.userId) || Long.ZERO) : Long.ZERO,
        diff,
        created_at: new Date(),
      });
    }
  } catch (e) {
    console.error('settings_audit insert failed', e);
  }

  return after;
}

async function findOrDefault(collection, guildId, defaults) {
  const db = await getDb();
  const doc = await db.collection(collection).findOne({ guild_id: toLong(guildId) });
  if (doc) return { guild_id: String(guildId), ...defaults, ...serializeDoc(doc) };
  return { guild_id: String(guildId), ...defaults };
}


function moduleHelpers() {
  return {
    serializeDoc, deserializeInput, toLong, isGuildPremium, assertChannelInGuild, assertTextChannelInGuild, assertRoleInGuild,
    getGuildMembersProfileMap, searchGuildMembers,
  };
}

const DISCORD_CDN_MEMORY_MAX = 400;
const DISCORD_CDN_MEMORY_TTL_MS = 6 * 60 * 60_000;
const discordCdnMemory = new Map();
let botAvatarMemory = { hit: null, at: 0 };
function discordCdnMemoryGet(key) {
  const hit = discordCdnMemory.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > DISCORD_CDN_MEMORY_TTL_MS) { discordCdnMemory.delete(key); return null; }
  return hit;
}
function discordCdnMemorySet(key, buf, type) {
  if (!buf || buf.length > 1024 * 1024) return;
  discordCdnMemory.set(key, { buf, type, at: Date.now() });
  while (discordCdnMemory.size > DISCORD_CDN_MEMORY_MAX) discordCdnMemory.delete(discordCdnMemory.keys().next().value);
}

const REPORT_KINDS = ['image', 'profile', 'copyright', 'trademark', 'prohibited', 'abuse'];
const REPORT_STATUS = ['open', 'reviewing', 'removed', 'restricted', 'suspended', 'blocked', 'dismissed', 'appealed'];
const REPORT_ACTIONS = ['review', 'dismiss', 'remove_content', 'restrict_uploads', 'suspend_customization', 'suspend_account', 'block_account', 'unblock_account', 'restore'];
const cleanText = (v, max) => String(v ?? '').replace(/[\p{Cc}\p{Cf}<>]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, max);

function publicModeration(m) {
  if (!m || typeof m !== 'object') return { uploads_restricted: false, suspended: false, account_blocked: false, account_until: null, notice: null };
  const until = m.uploads_restricted_until ? new Date(m.uploads_restricted_until) : null;
  return {
    uploads_restricted: Boolean(m.uploads_restricted && (!until || until > new Date())),
    suspended: m.suspended === true,
    account_blocked: accountState(m).blocked,
    account_until: accountState(m).until,
    notice: m.notice ? { at: m.notice.at, action: String(m.notice.action || ''), report_id: String(m.notice.report_id || '') } : null,
  };
}

async function handleGet(request, context) {
  const params = await context.params;
  const path = (params?.path || []).join('/');
  const url = new URL(request.url);

  if (path === 'discord-cdn') {
    const cdnPath = url.searchParams.get('path') || '';
    const DISCORD_CDN_PATH_RE = /^(?:icons\/\d{15,25}\/[a-zA-Z0-9_]+\.(?:png|jpe?g|webp|gif)|avatars\/\d{15,25}\/[a-zA-Z0-9_]+\.(?:png|jpe?g|webp|gif)|embed\/avatars\/[0-9]\.png)$/;
    if (!DISCORD_CDN_PATH_RE.test(cdnPath)) return new NextResponse(null, { status: 400 });
    const sizeParam = url.searchParams.get('size');
    const size = ['16', '32', '64', '128', '256', '512', '1024'].includes(sizeParam) ? sizeParam : null;
    const target = `https://cdn.discordapp.com/${cdnPath}${size ? `?size=${size}` : ''}`;
    const cdnHeaders = (type) => ({
      'Content-Type': type,
      'Cache-Control': 'public, max-age=2592000, s-maxage=2592000, immutable',
      'X-Content-Type-Options': 'nosniff',
    });
    const hit = discordCdnMemoryGet(target);
    if (hit) return new NextResponse(hit.buf, { headers: cdnHeaders(hit.type) });
    try {
      const upstream = await fetch(target, { cache: 'no-store' });
      if (!upstream.ok) throw new Error(`upstream cdn fetch failed: ${upstream.status}`);
      const buf = Buffer.from(await upstream.arrayBuffer());
      const type = upstream.headers.get('content-type') || 'image/png';
      discordCdnMemorySet(target, buf, type);
      return new NextResponse(buf, { headers: cdnHeaders(type) });
    } catch (e) {
      console.error('discord cdn proxy failed', e);
      return new NextResponse(null, { status: 404 });
    }
  }

  if (path === 'status/bot-avatar') {
    const warm = botAvatarMemory.hit && Date.now() - botAvatarMemory.at < 10 * 60_000 ? botAvatarMemory.hit : null;
    if (warm) {
      return new NextResponse(warm.buf, { headers: { 'Content-Type': warm.type, 'Cache-Control': 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400' } });
    }
    const botUser = await getBotUser().catch(() => null);
    const target = avatarUrl(botUser);
    if (!target) return new NextResponse(null, { status: 404 });
    try {
      const upstream = await fetch(target, { cache: 'no-store' });
      if (!upstream.ok) throw new Error(`upstream avatar fetch failed: ${upstream.status}`);
      const buf = await upstream.arrayBuffer();
      const type = upstream.headers.get('content-type') || 'image/png';
      if (buf.byteLength <= 1024 * 1024) botAvatarMemory = { hit: { buf, type }, at: Date.now() };
      return new NextResponse(buf, {
        headers: {
          'Content-Type': type,
          'Cache-Control': 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400',
        },
      });
    } catch (e) {
      console.error('bot avatar proxy failed', e);
      return new NextResponse(null, { status: 404 });
    }
  }

  if (path === 'status/bot') {
    const db = await getDb();
    const heartbeat = await db.collection('bot_status').findOne({ _id: 'heartbeat' });
    const lastBeat = heartbeat?.last_heartbeat ? new Date(heartbeat.last_heartbeat) : null;
    const online = !!lastBeat && (Date.now() - lastBeat.getTime()) < 90_000;
    const botUser = await getBotUser().catch(() => null);
    return json({
      online,
      last_heartbeat: lastBeat ? lastBeat.toISOString() : null,
      guild_count: online ? (heartbeat?.guild_count ?? null) : null,
      started_at: online && heartbeat?.started_at ? new Date(heartbeat.started_at).toISOString() : null,
      bot: botUser ? { username: botUser.username, avatar_url: '/api/status/bot-avatar' } : null,
    });
  }

  if (path === 'status/showcase') {
    const servers = await getShowcaseServers();
    return json({ servers });
  }

  if (path === 'site/community-showcase') {
    try {
      const config = await getShowcaseConfig();
      return json(config);
    } catch {
      return json({ error: 'unavailable' }, { status: 503 });
    }
  }

  if (path === 'site/promo-banner') {
    const config = await getPromoBannerConfig();
    return json(config);
  }

  if (path === 'site/footer-socials') {
    const config = await getFooterSocials();
    return json(config, { headers: { 'Cache-Control': 'public, max-age=60, s-maxage=60, stale-while-revalidate=300' } });
  }

  if (path === 'site/countdown-banner') {
    let config;
    try { config = withBackgroundSrc(await getCountdownBannerConfig()); } catch { return json({ error: 'unavailable' }, { status: 503 }); }
    return json({ ...config, server_time: Date.now() });
  }

  if (path === 'site/og-embed') {
    const config = await getOgEmbedConfig();
    return json(config);
  }

  if (path === 'site/careers-roles') {
    const config = await getCareersRolesConfig();
    return json(config);
  }

  if (path === 'updates') {
    const db = await getDb();
    const items = await db.collection('updates').find({}).sort({ created_at: -1 }).limit(100).toArray();
    return json({ items: items.map(serializeDoc) });
  }

  if (path === 'blog/latest') {
    try {
      const items = await readWithRetry(async () => {
        const db = await getDb();
        return db.collection(BLOG_COLLECTION)
          .find({ published: true }, { projection: { slug: 1, title: 1, excerpt: 1, cover_image_url: 1, published_at: 1 } })
          .sort({ published_at: -1 })
          .limit(3)
          .toArray();
      }, 2);
      return json(
        { items: items.map((p) => ({ slug: p.slug, title: p.title, excerpt: p.excerpt || '', cover_image_url: p.cover_image_url || '', published_at: p.published_at || null })) },
        { headers: { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=600' } },
      );
    } catch {
      return json({ items: [] }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
    }
  }

  if (path === 'blog') {
    const db = await getDb();
    const items = await db.collection(BLOG_COLLECTION)
      .find({ published: true })
      .sort({ published_at: -1 })
      .limit(200)
      .toArray();
    return json({ items: items.map(serializeDoc) });
  }

  const blogSlugMatch = path.match(/^blog\/([a-z0-9-]+)$/);
  if (blogSlugMatch) {
    const db = await getDb();
    const post = await db.collection(BLOG_COLLECTION).findOne({ slug: blogSlugMatch[1], published: true });
    if (!post) return json({ error: 'not_found' }, { status: 404 });
    return json(serializeDoc(post));
  }

  if (path === 'partners') {
    return json({ items: await getPublicPartners() }, { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } });
  }

  if (path === 'owner/partners') {
    const session = await getSession();
    if (!session?.user || session.user.id !== OWNER_ID) return json({ error: 'forbidden' }, { status: 403 });
    const db = await getDb();
    return json({ items: await getAllPartners(db) });
  }

  if (path === 'owner/blog') {
    const session = await getSession();
    if (!session?.user || session.user.id !== OWNER_ID) return json({ error: 'forbidden' }, { status: 403 });
    const db = await getDb();
    const items = await db.collection(BLOG_COLLECTION).find({}).sort({ created_at: -1 }).limit(500).toArray();
    return json({ items: items.map(serializeDoc) });
  }

  if (path === 'staff') {
    const db = await getDb();
    const docs = await db.collection(STAFF_COLLECTION)
      .find({})
      .sort({ hierarchy_position: 1, position: 1 })
      .toArray();
    const resolved = await Promise.all(docs.map(async (d) => {
      const user = await withTimeout(getDiscordUserById(d.discord_user_id).catch(() => null), DISCORD_LOOKUP_TIMEOUT_MS);
      if (!user) return null;
      return {
        id: String(d._id),
        discord_user_id: d.discord_user_id,
        rank: d.rank,
        hierarchy: d.hierarchy,
        position: d.position ?? 0,
        hierarchy_position: d.hierarchy_position ?? 0,
        name: user.global_name || user.username,
        avatar_url: avatarUrl(user),
        socials: d.socials || {},
      };
    }));
    return json({ items: resolved.filter(Boolean) });
  }

  const staffLookupMatch = path.match(/^staff\/lookup\/(\d{15,25})$/);
  if (staffLookupMatch) {
    const session = await getSession();
    if (!session?.user || session.user.id !== OWNER_ID) return json({ error: 'forbidden' }, { status: 403 });
    const user = await getDiscordUserById(staffLookupMatch[1]).catch(() => null);
    if (!user) return json({ error: 'not_found' }, { status: 404 });
    return json({
      discord_user_id: staffLookupMatch[1],
      name: user.global_name || user.username,
      avatar_url: avatarUrl(user),
    });
  }

  if (path === 'auth/me') {
    const session = await getSession();
    if (!session) return json({ user: null });
    return json({ user: session.user });
  }

  if (path === 'auth/login') {
    const redirectUri = process.env.DISCORD_REDIRECT_URI;
    const wantsJoin = url.searchParams.get('join') === '1';
    const scope = encodeURIComponent(wantsJoin ? 'identify guilds guilds.join' : 'identify guilds');
    const clientId = process.env.DISCORD_CLIENT_ID;
    const state = await issueOAuthState();
    const nextParam = url.searchParams.get('next');
    const safeNext = nextParam && nextParam.startsWith('/') && !nextParam.startsWith('//') && !nextParam.includes('://')
      ? nextParam
      : null;
    const stateValue = (safeNext || wantsJoin)
      ? `${state}|${safeNext ? encodeURIComponent(safeNext) : ''}${wantsJoin ? '|j' : ''}`
      : state;
    const authUrl = `https://discord.com/oauth2/authorize?response_type=code&client_id=${clientId}&scope=${scope}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(stateValue)}`;
    return NextResponse.redirect(authUrl);
  }

  if (path === 'auth/callback') {
    const code = url.searchParams.get('code');
    const rawState = url.searchParams.get('state') || '';
    const [state, encodedNext, joinFlag] = rawState.split('|');
    const stateOk = await consumeOAuthState(state);
    if (!stateOk) return NextResponse.redirect(`${SITE_URL}/?error=badstate`);
    if (!code) return NextResponse.redirect(`${SITE_URL}/?error=nocode`);
    const safeNext = encodedNext && decodeURIComponent(encodedNext).startsWith('/') ? decodeURIComponent(encodedNext) : null;
    try {
      const tok = await exchangeCode(code, process.env.DISCORD_REDIRECT_URI);
      const user = await getUser(tok.access_token);
      await setSession({
        accessToken: tok.access_token,
        refreshToken: tok.refresh_token,
        exp: Date.now() + (tok.expires_in - 60) * 1000,
        user: {
          id: user.id,
          username: user.username,
          global_name: user.global_name,
          discriminator: user.discriminator,
          avatar: user.avatar,
        },
      });
      try {
        const adb = await getDb();
        const role = String(user.id) === OWNER_ID ? 'owner' : ((await getDelegate(adb, user.id)) ? 'delegate' : null);
        if (role) {
          await audit(adb, { actor: { id: user.id, name: user.global_name || user.username }, role, action: 'login', outcome: 'ok', detail: 'signed in with Discord', request });
        }
      } catch (e) { console.error('login audit failed', e?.message || e); }
      if (joinFlag === 'j') {
        await joinCommunityGuild(user.id, tok.access_token).catch((e) => console.error('community join failed', e));
      }
      return NextResponse.redirect(`${SITE_URL}${safeNext || '/dashboard'}`);
    } catch (e) {
      return NextResponse.redirect(`${SITE_URL}/?error=auth`);
    }
  }

  if (path === 'auth/logout') {
    const hd = request.headers;
    const purpose = `${hd.get('sec-purpose') || ''} ${hd.get('purpose') || ''} ${hd.get('x-moz') || ''}`.toLowerCase();
    const fetchSite = hd.get('sec-fetch-site');
    const fetchMode = hd.get('sec-fetch-mode');
    const byPerson = hd.get('sec-fetch-user') === '?1';
    if (/prefetch|prerender/.test(purpose)
      || !byPerson
      || (fetchSite && !['same-origin', 'same-site', 'none'].includes(fetchSite))
      || (fetchMode && fetchMode !== 'navigate')) {
      return NextResponse.redirect(`${SITE_URL}/`);
    }
    await clearSession();
    return NextResponse.redirect(`${SITE_URL}/`);
  }

  if (path === 'guilds') {
    const session = await getSession();
    if (!session?.accessToken) return json({ error: 'unauthenticated' }, { status: 401 });
    const [userGuildsResult, botGuilds] = await Promise.all([
      getUserGuilds(session.accessToken).then((v) => ({ ok: true, v })).catch((e) => ({ ok: false, e })),
      getBotGuilds().catch(() => []),
    ]);
    if (!userGuildsResult.ok) {
      return json({ error: 'temporarily_unavailable' }, { status: 503 });
    }
    const userGuilds = userGuildsResult.v;
    const botSet = new Set(botGuilds.map((g) => g.id));
    const manageable = userGuilds.filter((g) => canManage(g.permissions, g.owner));
    return json({
      guilds: manageable.map((g) => ({
        id: g.id, name: g.name, icon: g.icon, owner: g.owner,
        bot_present: botSet.has(g.id),
      })),
    });
  }

  if (path === 'premium/keys') {
    const session = await getSession();
    if (!session?.user) return json({ error: 'unauthenticated' }, { status: 401 });
    if (session.user.id !== OWNER_ID) return json({ error: 'forbidden' }, { status: 403 });
    const db = await getDb();
    await sweepExpiredPremium(db);
    const keys = await db.collection('premium_keys').find({}).sort({ _id: -1 }).limit(100).toArray();
    return json({
      keys: keys.map((k) => ({ ...serializeDoc(k), status: keyStatus(k) })),
      is_owner: true,
    });
  }

  if (path === 'premium/servers') {
    const session = await getSession();
    if (!session?.user) return json({ error: 'unauthenticated' }, { status: 401 });
    if (session.user.id !== OWNER_ID) return json({ error: 'forbidden' }, { status: 403 });
    const db = await getDb();
    await sweepExpiredPremium(db);
    const docs = await db.collection('premium_servers').find({ active: true }).sort({ _id: -1 }).toArray();
    const byGuild = new Map();
    for (const d of docs) {
      const gid = String(d.guild_id);
      if (!byGuild.has(gid)) byGuild.set(gid, d);
    }
    const servers = [...byGuild.values()];
    const botGuilds = await getBotGuilds({ withCounts: true }).catch(() => []);
    const infoById = new Map(botGuilds.map((g) => [g.id, g]));
    return json({
      servers: servers.map((s) => {
        const info = infoById.get(String(s.guild_id));
        return {
          ...serializeDoc(s),
          guild_name: info?.name || null,
          guild_icon_url: info ? guildIconUrl(info) : null,
          member_count: info?.approximate_member_count ?? null,
          online_count: info?.approximate_presence_count ?? null,
        };
      }),
      is_owner: true,
    });
  }

  if (path === 'owner/invite-tracking') {
    const session = await getSession();
    if (!session?.user) return json({ error: 'unauthenticated' }, { status: 401 });
    if (session.user.id !== OWNER_ID) return json({ error: 'forbidden' }, { status: 403 });
    const db = await getDb();
    const since7 = new Date(Date.now() - 7 * 86400000);
    const since1 = new Date(Date.now() - 86400000);
    const [activeDocs, errors, errors7, joinsTotal, joins24h, codes] = await Promise.all([
      db.collection('guild_settings').find({ 'module_states.invite_tracking': true }, { projection: { guild_id: 1 } }).toArray(),
      db.collection('module_errors').find({ module: 'invite_tracking' }).sort({ created_at: -1 }).limit(15).toArray(),
      db.collection('module_errors').countDocuments({ module: 'invite_tracking', created_at: { $gte: since7 } }),
      db.collection('invite_joins').countDocuments({}),
      db.collection('invite_joins').countDocuments({ joined_at: { $gte: since1 } }),
      db.collection('invite_codes').countDocuments({ deleted: { $ne: true } }),
    ]);
    const activeIds = activeDocs.map((d) => d.guild_id);
    const withBaseline = new Set((await db.collection('invite_settings').find({ guild_id: { $in: activeIds }, baseline_at: { $exists: true } }, { projection: { guild_id: 1 } }).toArray()).map((d) => String(d.guild_id)));
    const noBaselineIds = activeIds.filter((g) => !withBaseline.has(String(g)));
    const names = new Map();
    const wanted = [...new Set([...noBaselineIds, ...errors.map((e) => e.guild_id)].map(String))].slice(0, 60);
    if (wanted.length) {
      const joinsDocs = await db.collection('bot_guild_joins').find({ guild_id: { $in: wanted.map((g) => toLong(g)) } }).toArray();
      for (const d of joinsDocs) names.set(String(d.guild_id), d.guild_name || null);
    }
    const label = (g) => ({ id: String(g), name: names.get(String(g)) || null });
    return json({
      is_owner: true,
      active_servers: activeIds.length,
      joins_total: joinsTotal, joins_24h: joins24h, codes_tracked: codes,
      errors_7d: errors7,
      errors: errors.map((e) => ({ ...label(e.guild_id), code: e.code || null, detail: e.detail || null, created_at: e.created_at })),
      sync_problems: noBaselineIds.slice(0, 50).map(label),
      sync_problems_total: noBaselineIds.length,
    });
  }

  const musicGet = path.match(/^profile-page\/music\/([a-f0-9]{24})$/);
  if (musicGet) {
    const session = await getSession();
    const gdb = await getDb();
    const track = await gdb.collection('profile_music').findOne({ _id: new ProfileObjectId(musicGet[1]) });
    if (!track || !AUDIO_MIME.has(track.mime)) return json({ error: 'not_found' }, { status: 404 });
    const mine = String(track.user) === String(session?.user?.id || '');
    const owner = await gdb.collection('profile_cards').findOne({ _id: String(track.user) }, { projection: { public: 1, share_public: 1, moderation: 1, 'page.music': 1 } });
    if (accountState(owner?.moderation).blocked || publicModeration(owner?.moderation).suspended) return json({ error: 'not_found' }, { status: 404 });
    if (!mine) {
      if (!owner || owner.public === false || owner.page?.music !== `/api/profile-page/music/${musicGet[1]}`) return json({ error: 'not_found' }, { status: 404 });
      if (!session?.user?.id && owner.share_public !== true) return json({ error: 'unauthenticated' }, { status: 401 });
    }
    const bytes = Buffer.from(track.data.buffer ? track.data.buffer : track.data);
    const base = { 'Content-Type': track.mime, 'Accept-Ranges': 'bytes', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; sandbox", 'Cache-Control': 'private, max-age=3600' };
    const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get('range') || '');
    if (range && (range[1] || range[2])) {
      let start = range[1] ? Number(range[1]) : Math.max(0, bytes.length - Number(range[2]));
      let end = range[1] && range[2] ? Number(range[2]) : bytes.length - 1;
      end = Math.min(end, bytes.length - 1);
      if (start > end || start >= bytes.length) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${bytes.length}` } });
      return new Response(bytes.subarray(start, end + 1), { status: 206, headers: { ...base, 'Content-Range': `bytes ${start}-${end}/${bytes.length}`, 'Content-Length': String(end - start + 1) } });
    }
    return new Response(bytes, { headers: { ...base, 'Content-Length': String(bytes.length) } });
  }

  const cardImage = path.match(/^profile-card\/image\/([a-f0-9]{24})$/);
  if (cardImage) {
    const session = await getSession();
    const gdb = await getDb();
    const img = await gdb.collection('profile_card_images').findOne({ _id: new ProfileObjectId(cardImage[1]) });
    if (!img || !PROFILE_IMAGE_MIME.has(img.mime)) return json({ error: 'not_found' }, { status: 404 });
    if (String(img.user) !== String(session?.user?.id || '')) {
      const owner = await gdb.collection('profile_cards').findOne({ _id: String(img.user) }, { projection: { public: 1, share_public: 1, 'cfg.bg_image': 1 } });
      if (!owner || owner.public === false || owner.cfg?.bg_image !== cardImage[1]) return json({ error: 'not_found' }, { status: 404 });
      if (!session?.user?.id && owner.share_public !== true) return json({ error: 'unauthenticated' }, { status: 401 });
    }
    return new Response(Buffer.from(img.data.buffer ? img.data.buffer : img.data), {
      headers: { 'Content-Type': img.mime, 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; sandbox", 'Cache-Control': 'private, max-age=86400, immutable' },
    });
  }
  if (path === 'profile-page') {
    const session = await getSession();
    if (!session?.user?.id) return json({ error: 'unauthenticated' }, { status: 401 });
    const doc = await (await getDb()).collection('profile_cards').findOne({ _id: String(session.user.id) }, { projection: { page: 1, moderation: 1 } });
    return json({ page: normalizePage(doc?.page), customized: Boolean(doc?.page && Object.keys(doc.page).length), moderation: publicModeration(doc?.moderation), passport: await loadPassport(await getDb(), session.user.id), pass: await loadProfilePass(await getDb(), session.user.id).catch(() => null) }, { headers: { 'Cache-Control': 'no-store' } });
  }
  if (path === 'owner/content-reports') {
    const session = await getSession();
    if (!session?.user || session.user.id !== OWNER_ID) return json({ error: 'forbidden' }, { status: 403 });
    const status = new URL(request.url).searchParams.get('status');
    const filter = REPORT_STATUS.includes(status) ? { status } : {};
    const rows = await (await getDb()).collection('content_reports').find(filter).sort({ created_at: -1 }).limit(100).toArray();
    return json({ items: rows.map((r) => ({ ...r, id: String(r._id), _id: undefined })) }, { headers: { 'Cache-Control': 'no-store' } });
  }
  if (path === 'profile-card') {
    const session = await getSession();
    if (!session?.user?.id) return json({ error: 'unauthenticated' }, { status: 401 });
    return json({ ...(await readProfileCard(await getDb(), session.user.id)), schema_version: 1 }, { headers: { 'Cache-Control': 'no-store' } });
  }

  if (path === 'owner/config-status') {
    const session = await getSession();
    if (!session?.user) return json({ error: 'unauthenticated' }, { status: 401 });
    if (session.user.id !== OWNER_ID) return json({ error: 'forbidden' }, { status: 403 });
    const groups = configGroups();
    let bot = null;
    try {
      const doc = await (await getDb()).collection('bot_status').findOne({ _id: 'config' });
      if (doc?.items) {
        bot = { updated_at: doc.updated_at ? new Date(doc.updated_at).toISOString() : null, items: doc.items.map((i) => ({ name: String(i.name), group: String(i.group), required: Boolean(i.required), info: String(i.info || ''), state: String(i.state) })), compare: botComparison(doc) };
      }
    } catch { }
    const all = [...groups.flatMap((g) => g.items), ...(bot?.items || [])];
    const bad = all.filter((i) => ['missing', 'invalid', 'placeholder'].includes(i.state));
    return json({ groups, bot, summary: { total: all.length, ok: all.filter((i) => i.state === 'ok').length, problems: bad.length, required_missing: all.filter((i) => i.required && i.state !== 'ok').length } }, { headers: { 'Cache-Control': 'no-store' } });
  }

  if (path === 'owner/config-live') {
    const session = await getSession();
    if (!session?.user) return json({ error: 'unauthenticated' }, { status: 401 });
    if (session.user.id !== OWNER_ID) return json({ error: 'forbidden' }, { status: 403 });
    let db = null;
    try { db = await getDb(); } catch { }
    const checks = db ? await liveChecks({ db }) : [{ id: 'mongo', label: 'Database answers', state: 'fail', detail: 'The database could not be reached with BOT_MONGO_URL.' }];
    return json({ checks, ran_at: new Date().toISOString() }, { headers: { 'Cache-Control': 'no-store' } });
  }

  if (path === 'owner/bot-welcome') {
    const session = await getSession();
    if (!session?.user) return json({ error: 'unauthenticated' }, { status: 401 });
    if (session.user.id !== OWNER_ID) return json({ error: 'forbidden' }, { status: 403 });
    return json({ ...(await getBotWelcomeConfig()), is_owner: true }, { headers: { 'Cache-Control': 'no-store' } });
  }

  if (path === 'owner/guilds/joined-7d' || path === 'owner/guilds/left-7d') {
    const session = await getSession();
    if (!session?.user) return json({ error: 'unauthenticated' }, { status: 401 });
    if (session.user.id !== OWNER_ID) return json({ error: 'forbidden' }, { status: 403 });
    const db = await getDb();
    const sevenDaysAgoUtc = new Date();
    sevenDaysAgoUtc.setUTCDate(sevenDaysAgoUtc.getUTCDate() - 7);
    const isJoined = path.endsWith('joined-7d');
    const [docs, others, live] = await Promise.all([
      db.collection(isJoined ? 'bot_guild_joins' : 'bot_guild_leaves')
        .find(isJoined ? { joined_at: { $gte: sevenDaysAgoUtc } } : { left_at: { $gte: sevenDaysAgoUtc } })
        .sort(isJoined ? { joined_at: -1 } : { left_at: -1 }).toArray(),
      db.collection(isJoined ? 'bot_guild_leaves' : 'bot_guild_joins')
        .find(isJoined ? { left_at: { $gte: sevenDaysAgoUtc } } : { joined_at: { $gte: sevenDaysAgoUtc } }).toArray(),
      getBotGuilds().catch(() => null),
    ]);
    const otherAt = new Map(others.map((o) => [String(o.guild_id), new Date(isJoined ? o.left_at : o.joined_at).getTime()]));
    const liveById = live ? new Map(live.map((g) => [String(g.id), g])) : null;
    const servers = [];
    for (const d of docs) {
      const id = String(d.guild_id);
      const at = new Date(isJoined ? d.joined_at : d.left_at).getTime();
      const other = otherAt.get(id);
      if (isJoined) {
        if (other && other > at) continue;
        if (liveById && !liveById.has(id)) continue;
      } else {
        if (other && other > at) continue;
        if (liveById && liveById.has(id)) continue;
      }
      const name = liveById?.get(id)?.name || d.guild_name || null;
      servers.push(isJoined ? { id, name, joined_at: d.joined_at } : { id, name, left_at: d.left_at });
    }
    return json({ servers, total: servers.length, is_owner: true });
  }

  if (path === 'premium/all-servers') {
    const session = await getSession();
    if (!session?.user) return json({ error: 'unauthenticated' }, { status: 401 });
    if (session.user.id !== OWNER_ID) return json({ error: 'forbidden' }, { status: 403 });
    const db = await getDb();
    await sweepExpiredPremium(db);
    const [botGuilds, premiumDocs] = await Promise.all([
      getBotGuilds({ withCounts: true }).catch(() => []),
      db.collection('premium_servers').find({ active: true }).toArray(),
    ]);
    const premiumGuildIds = new Set(premiumDocs.map((d) => String(d.guild_id)));
    const servers = (botGuilds || [])
      .map((g) => ({
        id: g.id,
        name: g.name,
        icon_url: guildIconUrl(g),
        member_count: g.approximate_member_count ?? null,
        online_count: g.approximate_presence_count ?? null,
        bot_is_guild_owner: !!g.owner,
        premium: premiumGuildIds.has(g.id),
      }))
      .sort((a, b) => (b.member_count || 0) - (a.member_count || 0));
    return json({ servers, total: servers.length, is_owner: true });
  }

  if (path === 'owner/guild-bans') {
    const session = await getSession();
    if (!session?.user) return json({ error: 'unauthenticated' }, { status: 401 });
    if (session.user.id !== OWNER_ID) return json({ error: 'forbidden' }, { status: 403 });
    const db = await getDb();
    const bans = await db.collection('guild_bans').find({}).sort({ updated_at: -1 }).toArray();
    return json({ bans: bans.map(serializeDoc), is_owner: true });
  }

  const ownerInfoMatch = path.match(/^owner\/guilds\/(\d+)\/owner-info$/);
  if (ownerInfoMatch) {
    const session = await getSession();
    if (!session?.user) return json({ error: 'unauthenticated' }, { status: 401 });
    if (session.user.id !== OWNER_ID) return json({ error: 'forbidden' }, { status: 403 });
    const [, guildId] = ownerInfoMatch;
    const guild = await getBotGuild(guildId).catch(() => null);
    if (!guild) return json({ error: 'guild_not_found' }, { status: 404 });
    const ownerId = guild.owner_id ? String(guild.owner_id) : null;
    let owner = null;
    if (ownerId) {
      const username = await getGuildMember(guildId, ownerId).catch(() => null);
      owner = { id: ownerId, username };
    }
    const db = await getDb();
    const lastSent = await db.collection('owner_dm_log').find({ guild_id: String(guildId) }).sort({ sent_at: -1 }).limit(1).toArray();
    return json({
      guild: { id: String(guild.id), name: guild.name || null, icon_url: guildIconUrl(guild) },
      owner,
      last_sent_at: lastSent[0]?.sent_at ? new Date(lastSent[0].sent_at).toISOString() : null,
    });
  }

  if (path === 'owner/access') {
    const session = await getSession();
    if (!session?.user) return json({ error: 'unauthenticated' }, { status: 401 });
    if (session.user.id !== OWNER_ID) return json({ error: 'forbidden' }, { status: 403 });
    const r = await listAccess(await getDb(), session, request);
    return json(r.body, { status: r.status });
  }

  if (path === 'premium/me') {
    const session = await getSession();
    if (!session?.user) return json({ user_id: null, is_owner: false });
    let isDelegate = false;
    if (session.user.id !== OWNER_ID) {
      try { isDelegate = Boolean(await getDelegate(await getDb(), session.user.id)); } catch { isDelegate = false; }
    }
    return json({
      user_id: session.user.id,
      is_owner: session.user.id === OWNER_ID,
      is_delegate: isDelegate,
    });
  }

  const guildMatch = path.match(/^guilds\/(\d+)\/(.+)$/);
  if (guildMatch) {
    const [, guildId, sub] = guildMatch;
    const guard = await guardGuildAccess(guildId);
    if (guard.error) return guard.error;
    const db = await getDb();
    const gidLong = toLong(guildId);

    if (isModuleRoute(sub)) {
      const handled = await handleModuleGet({
        sub, url, db, gidLong, guildId, session: guard.session, guild: guard.guild, h: moduleHelpers(),
      });
      if (handled) return handled;
    }

    if (sub === 'meta') {
      const [channelsResult, rolesResult] = await Promise.all([
        getGuildChannelsResult(guildId),
        getGuildRolesResult(guildId),
      ]);
      const channels = channelsResult.data;
      const roles = rolesResult.data;
      return json({
        incomplete: !channelsResult.ok || !rolesResult.ok,
        channels: (channels || []).filter((c) => [0, 5, 2, 4, 15].includes(c.type)).map((c) => ({
          id: c.id,
          name: c.name,
          type: c.type,
          parent_id: c.parent_id,
          available_tags: c.type === 15
            ? (Array.isArray(c.available_tags) ? c.available_tags.slice(0, 20).map((tag) => ({
                id: tag.id,
                name: tag.name,
                moderated: !!tag.moderated,
                emoji_name: tag.emoji_name || null,
              })) : [])
            : [],
        })),
        roles: (roles || []).filter((r) => r.name !== '@everyone').map((r) => ({
          id: r.id, name: r.name, color: r.color, position: r.position, managed: r.managed,
        })).sort((a, b) => b.position - a.position),
        guild: { id: guildId, name: guard.guild.name, icon: guard.guild.icon },
      });
    }

    if (sub === 'stats') {
      const today = new Date().toISOString().slice(0, 10);
      const growthReq = db.collection('guild_growth_daily').findOne({ guild_id: gidLong, date: today });
      const freshGuildReq = getBotGuildCounts(guildId).catch(() => null);

      const ALLOWED_HISTORY_DAYS = [7, 14, 30, 60, 90];
      const requestedDays = Number(url.searchParams.get('days'));
      const HISTORY_DAYS = ALLOWED_HISTORY_DAYS.includes(requestedDays) ? requestedDays : 14;
      const dayKeys = Array.from({ length: HISTORY_DAYS }, (_, i) => {
        const d = new Date();
        d.setUTCDate(d.getUTCDate() - (HISTORY_DAYS - 1 - i));
        return d.toISOString().slice(0, 10);
      });
      const historyReq = db.collection('guild_growth_daily')
        .find({ guild_id: gidLong, date: { $in: dayKeys } })
        .toArray();
      const [growth, freshGuild, historyDocs] = await Promise.all([growthReq, freshGuildReq, historyReq]);
      const members = Number(freshGuild?.approximate_member_count ?? freshGuild?.member_count ?? guard.guild.approximate_member_count ?? guard.guild.member_count ?? 0);
      const historyByDate = Object.fromEntries(historyDocs.map((d) => [d.date, d]));
      const history = dayKeys.map((date) => ({
        date,
        joins: Number(historyByDate[date]?.joins || 0),
        leaves: Number(historyByDate[date]?.leaves || 0),
      }));

      return json({ members, joins_today: Number(growth?.joins || 0), leaves_today: Number(growth?.leaves || 0), history });
    }

    if (sub === 'overview-stats') {
      const premium = await isGuildPremium(db, gidLong);
      if (!premium) return json({ premium: false });

      const today = new Date().toISOString().slice(0, 10);
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      const [freshGuild, growth, openTickets, recentErrors, modAgg] = await Promise.all([
        getBotGuildCounts(guildId).catch(() => null),
        db.collection('guild_growth_daily').findOne({ guild_id: gidLong, date: today }),
        db.collection('tickets').countDocuments({ guild_id: gidLong, closed: { $ne: true } }),
        db.collection('module_errors').countDocuments({ guild_id: gidLong, created_at: { $gte: sevenDaysAgo } }),
        db.collection('mod_logs').aggregate([
          { $match: { guild_id: gidLong, timestamp: { $gte: thirtyDaysAgo } } },
          { $group: { _id: '$action', count: { $sum: 1 } } },
        ]).toArray().catch(() => []),
      ]);

      const members = Number(freshGuild?.approximate_member_count ?? guard.guild.approximate_member_count ?? 0);
      const MOD_LOG_ACTION_MAP = { Warn: 'warn', Timeout: 'mute', Kick: 'kick', Ban: 'ban' };
      const moderation_30d = { warn: 0, kick: 0, ban: 0, mute: 0 };
      for (const row of modAgg) {
        const key = MOD_LOG_ACTION_MAP[row?._id];
        if (key) moderation_30d[key] = row.count;
      }
      moderation_30d.total = Object.values(moderation_30d).reduce((a, b) => a + b, 0);

      return json({
        premium: true,
        members,
        joins_today: Number(growth?.joins || 0),
        leaves_today: Number(growth?.leaves || 0),
        open_tickets: openTickets,
        recent_errors: recentErrors,
        moderation_30d,
      });
    }

    if (sub === 'settings') {
      return json(await findOrDefault('guild_settings', guildId, {
        language: 'en', language_explicit: false, setup_completed: false,
        admin_role_id: null, moderator_role_id: null, ticket_role_id: null,
        mod_log_channel_id: null, mod_log_enabled: false,
        suggestion_channel_id: null, level_channel_id: null,
        level_message: '{user.mention} reached **level {level}**!', level_up_embed: true,
        level_enabled: true, level_ignored_channel_ids: [],
        level_message_format: 'legacy', level_card_background_url: null,
        level_card_overlay_color: '#111827', level_card_overlay_opacity: 55,
        level_card_text_color: '#ffffff', level_card_color: '#57F287',
        level_card_avatar_ring: true, level_card_font: 'default', level_use_member_profile: false,
        level_image_mode: 'none', level_image_url: null,
        ticket_transcript_channel_id: null,
        temp_voice_hub_channel_id: null, temp_voice_category_id: null,
        temp_voice_name_template: null, temp_voice_default_user_limit: null,
        module_states: Object.fromEntries(MODULE_TOGGLE_KEYS.map((key) => [key, key === 'lookups' || key === 'feeds'])),
      }));
    }

    if (sub === 'welcome') {
      return json(await findOrDefault('welcome_settings', guildId, {
        enabled: false, channel_id: null,
        message: 'Welcome {user.mention} to **{guild.name}**!',
        title: 'Welcome, {user.name}!',
        footer: 'Enjoy your stay!',
        embed: true,
        color: '#57F287',
        image_mode: 'member_avatar',
        image_url: null,
        timestamp: true,
        dm_message: null, auto_role_id: null,
        dm_image_mode: 'none', dm_image_url: null,
        card_enabled: false,
        message_format: 'avatar',
        card_background_url: null,
        card_overlay_color: '#0f172a',
        card_overlay_opacity: 58,
        card_text_color: '#ffffff',
        card_font: 'default',
        card_avatar_mode: 'member',
        card_avatar_ring: true,
      }));
    }

    if (sub === 'goodbye') {
      return json(await findOrDefault('goodbye_settings', guildId, {
        enabled: false, channel_id: null,
        message: '{user.name} has left **{guild.name}**. We now have {member_count} members.',
        title: 'Goodbye, {user.name}!',
        footer: 'Thanks for being part of our community.',
        embed: true,
        color: '#e08a4e',
        image_mode: 'member_avatar',
        image_url: null,
        timestamp: true,
        card_enabled: false,
        message_format: 'avatar',
        card_background_url: null,
        card_overlay_color: '#0f172a',
        card_overlay_opacity: 58,
        card_text_color: '#ffffff',
        card_font: 'default',
        card_avatar_mode: 'member',
        card_avatar_ring: true,
      }));
    }

    if (sub === 'captcha') {
      return json(await findOrDefault('captcha_settings', guildId, {
        enabled: false,
        channel_id: null,
        role_id: null,
        embed_title: 'Member Verification',
        embed_description: 'Click the button below, sign in with Discord on the page that opens, then click Verify. Your role will be granted automatically.',
        embed_color: '#e08a4e',
        embed_image_url: null,
        embed_footer: '',
        button_label: 'Verify',
        button_emoji: '{wy:success}',
        page_heading: 'Member Verification',
        page_description: 'Confirm you are a real person to get access to the server.',
        page_button_label: 'Verify',
        page_success_heading: 'You are verified',
        page_success_message: 'You can go back to Discord, your role has been granted.',
        page_already_verified_message: 'You are already verified on this server.',
        page_not_member_message: 'You are not a member of this server. Join the server and try again.',
        message_id: null,
      }));
    }

    if (sub === 'automod') {
      return json(await findOrDefault('automod_settings', guildId, {
        anti_spam: false, anti_mention_spam: false, anti_invite: false,
        anti_link: false, anti_raid: false, anti_scam_links: false, image_scam: false, image_scam_action: 'delete',
        bad_words_filter: false, caps_filter: false, duplicate_filter: false,
        repeated_chars_filter: false, anti_phishing: false, message_length_filter: false,
        bad_words: [], spam_threshold: 5, spam_interval: 5, mention_threshold: 5,
        caps_threshold: 70, duplicate_window: 10, repeated_chars_threshold: 8, max_message_length: 2000,
        raid_join_threshold: 10, raid_window_seconds: 60, raid_new_account_days: 7,
        raid_action: 'kick', raid_lockdown_minutes: 10, raid_raise_verification: true, raid_alert_staff: true, raid_no_avatar: true,
        min_account_age_days: 0, new_member_link_minutes: 0, anti_mass_spam: false,
        anti_mass_spam_action: 'timeout', new_member_links_action: 'delete',
        strike_enabled: true, strike_threshold: 3, strike_decay_seconds: 3600,
        default_action: 'delete', escalation_action: 'timeout', timeout_seconds: 60,
        bad_words_action: 'delete', anti_spam_action: 'delete', anti_link_action: 'delete',
        anti_invite_action: 'delete', anti_mention_spam_action: 'delete', anti_scam_links_action: 'delete',
        caps_filter_action: 'delete', duplicate_filter_action: 'delete', repeated_chars_filter_action: 'delete',
        anti_phishing_action: 'delete', message_length_filter_action: 'delete',
        allowed_domains: [], log_channel_id: null, whitelist_role_ids: [],
        warn_message: '', timeout_message: '', unmute_message: '', kick_message: '', ban_message: '',
      }));
    }

    if (sub === 'auto_responses') {
      const list = await db.collection('auto_responses').find({ guild_id: gidLong }).toArray();
      const premium = await isGuildPremium(db, gidLong);
      const limit = premium ? PREMIUM_UNLIMITED : FREE_AUTO_RESPONSE_LIMIT;
      return json({ items: list.map(serializeDoc), limit, is_premium: premium });
    }

    if (sub === 'custom_commands') {
      const list = await db.collection('custom_commands').find({ guild_id: gidLong }).toArray();
      const premium = await isGuildPremium(db, gidLong);
      const limit = premium ? PREMIUM_UNLIMITED : FREE_CUSTOM_COMMAND_LIMIT;
      return json({ items: list.map(serializeDoc), limit, is_premium: premium });
    }

    if (sub === 'reaction_roles') {
      const list = await db.collection('reaction_roles').find({ guild_id: gidLong }).sort({ created_at: -1 }).toArray();
      const latest = list[0]?.created_at ? new Date(list[0].created_at).getTime() : 0;
      const cooldownRemaining = latest ? Math.max(0, 10 * 60 - Math.floor((Date.now() - latest) / 1000)) : 0;
      const premium = await isGuildPremium(db, gidLong);
      const limit = premium ? PREMIUM_UNLIMITED : FREE_REACTION_PANEL_LIMIT;
      return json({
        items: list.map((doc) => ({
          ...serializeDoc(doc),
          type: doc.type === 'button' ? 'button' : 'emoji',
        })),
        limit,
        is_premium: premium,
        cooldown_seconds: cooldownRemaining,
      });
    }

    if (sub === 'giveaways') {
      const list = await db.collection('giveaways').find({ guild_id: gidLong }).sort({ _id: -1 }).limit(50).toArray();
      const nameMap = await getGuildMembersMap(guildId, list.map((g) => g.host_id));
      const premium = await isGuildPremium(db, gidLong);
      const limit = premium ? PREMIUM_UNLIMITED : FREE_GIVEAWAY_LIMIT;
      const activeCount = await db.collection('giveaways').countDocuments({
        guild_id: gidLong,
        ended: { $ne: true },
      });
      return json({
        limit,
        active_count: activeCount,
        is_premium: premium,
        items: list.map((g) => {
          const { participants, ...rest } = serializeDoc(g);
          return {
            ...rest,
            host_name: nameMap.get(String(g.host_id)) || null,
            participant_count: Array.isArray(g.participants) ? g.participants.length : 0,
          };
        }),
      });
    }

    if (sub === 'errors') {
      const errors = await db.collection('module_errors').find({ guild_id: gidLong }).sort({ created_at: -1 }).limit(15).toArray();
      return json({ errors: errors.map(serializeDoc) });
    }

    if (sub === 'tickets') {
      const panels = await db.collection('ticket_panels').find({ guild_id: gidLong }).toArray();
      const tickets = await db.collection('tickets').find({ guild_id: gidLong, closed: { $ne: true } }).limit(50).toArray();
      const nameMap = await getGuildMembersMap(guildId, tickets.map((t) => t.user_id));

      const reviews = await db.collection('ticket_reviews')
        .find({ guild_id: gidLong })
        .sort({ _id: -1 })
        .limit(200)
        .toArray();
      const reviewNameMap = await getGuildMembersMap(guildId, reviews.map((r) => r.user_id));
      const reviewAgg = await db.collection('ticket_reviews').aggregate([
        { $match: { guild_id: gidLong } },
        { $group: { _id: null, avg: { $avg: '$rating' }, total: { $sum: 1 } } },
      ]).toArray();
      const errors = await db.collection('module_errors').find({ guild_id: gidLong, module: 'tickets' }).sort({ created_at: -1 }).limit(25).toArray();

      const premium = await isGuildPremium(db, gidLong);
      const maxPanels = premium ? PREMIUM_UNLIMITED : FREE_TICKET_PANEL_LIMIT;

      return json({
        panels: panels.map(serializeDoc),
        open_tickets: tickets.map((t) => ({ ...serializeDoc(t), user_name: nameMap.get(String(t.user_id)) || null })),
        reviews: reviews.map((r) => ({ ...serializeDoc(r), user_name: reviewNameMap.get(String(r.user_id)) || null })),
        review_avg: reviewAgg[0]?.avg || 0,
        review_total: reviewAgg[0]?.total || 0,
        errors: errors.map(serializeDoc),
        max_panels: maxPanels,
        is_premium: premium,
      });
    }

    if (sub === 'levels') {
      const top = await db.collection('levels').find({ guild_id: gidLong, $or: [{ xp: { $gt: 0 } }, { level: { $gt: 0 } }] }).sort({ level: -1, xp: -1 }).limit(25).toArray();
      const nameMap = await getGuildMembersMap(guildId, top.map((u) => u.user_id));
      return json({
        leaderboard: top.map((u) => ({ ...serializeDoc(u), user_name: nameMap.get(String(u.user_id)) || null })),
      });
    }

    if (sub === 'suggestions') {
      const list = await db.collection('suggestions').find({ guild_id: gidLong }).sort({ _id: -1 }).limit(50).toArray();
      return json({ items: list.map(serializeDoc) });
    }

    if (sub === 'premium') {
      const doc = await db.collection('premium_servers').findOne({ guild_id: gidLong }, { sort: { _id: -1 } });
      const voter = await db.collection('votes').findOne({ user_id: toLong(guard.session.user.id) }).catch(() => null);
      const votes = { days: Math.max(0, Number(voter?.credit_days) || 0), total: Number(voter?.total_votes) || 0, min: VOTE_REDEEM_MIN };
      if (!doc) return json({ premium: null, votes });
      const activatedByName = await getGuildMember(guildId, String(doc.activated_by)).catch(() => null);
      return json({ premium: { ...serializeDoc(doc), activated_by_name: activatedByName }, votes });
    }

    if (sub === 'backups') {
      const backups = await db.collection('backups')
        .find({ guild_id: gidLong })
        .project({ 'data': 0 })
        .sort({ created_at: -1 })
        .limit(5)
        .toArray();
      const missingNameIds = backups.filter((b) => !b.created_by_name && b.created_by).map((b) => b.created_by);
      const nameMap = missingNameIds.length ? await getGuildMembersMap(guildId, missingNameIds) : new Map();
      const meta = await db.collection('backup_meta').findOne({ guild_id: gidLong });
      const lastBackupAt = meta?.last_backup_at ? new Date(meta.last_backup_at) : null;
      const nextAllowedAt = lastBackupAt ? new Date(lastBackupAt.getTime() + 7 * 24 * 60 * 60 * 1000) : null;
      return json({
        backups: backups.map((b) => {
          const doc = serializeDoc(b);
          if (!doc.created_by_name) doc.created_by_name = nameMap.get(String(doc.created_by)) || null;
          return doc;
        }),
        last_backup_at: lastBackupAt ? lastBackupAt.toISOString() : null,
        next_allowed_at: nextAllowedAt ? nextAllowedAt.toISOString() : null,
        on_cooldown: !!(nextAllowedAt && nextAllowedAt.getTime() > Date.now()),
      });
    }

    if (sub === 'youtube-notify') {
      const premium = await isGuildPremium(db, gidLong);
      const settings = await db.collection('youtube_notify_settings').findOne({ guild_id: gidLong });
      const channels = await db.collection('youtube_notify_channels')
        .find({ guild_id: gidLong })
        .sort({ created_at: 1 })
        .toArray();
      return json({
        premium,
        max_channels: YOUTUBE_NOTIFY_MAX_CHANNELS,
        settings: settings ? serializeDoc(settings) : null,
        channels: channels.map(serializeDoc),
      });
    }

    if (sub === 'audit') {
      const entries = await db.collection('settings_audit')
        .find({ guild_id: gidLong })
        .sort({ created_at: -1 })
        .limit(100)
        .toArray();
      const nameMap = await getGuildMembersMap(guildId, entries.map((e) => e.user_id));
      return json({
        items: entries.map((e) => ({
          ...serializeDoc(e),
          user_name: nameMap.get(String(e.user_id)) || null,
        })),
      });
    }

    if (sub === 'forums') {
      const list = await db.collection('forums')
        .find({ guild_id: gidLong })
        .sort({ created_at: 1 })
        .toArray();
      const channels = await getGuildChannels(guildId);
      const channelMap = new Map((channels || []).map((channel) => [String(channel.id), channel]));
      const premium = await isGuildPremium(db, gidLong);
      const limit = premium ? PREMIUM_UNLIMITED : FREE_FORUM_LIMIT;
      return json({
        items: list.map((doc) => {
          const channel = channelMap.get(String(doc.channel_id));
          const tags = new Map((channel?.available_tags || []).map((tag) => [String(tag.id), tag]));
          return {
            ...serializeDoc(doc),
            channel_name: channel?.name || null,
            tags: (doc.default_tag_ids || []).map((id) => ({
              id: String(id),
              name: tags.get(String(id))?.name || 'Unknown tag',
            })),
          };
        }),
        limit,
        is_premium: premium,
      });
    }

    if (sub === 'scheduled_messages') {
      const list = await db.collection('scheduled_messages')
        .find({ guild_id: gidLong })
        .sort({ next_run: 1 })
        .toArray();
      const premium = await isGuildPremium(db, gidLong);
      const limit = premium
        ? PREMIUM_UNLIMITED
        : FREE_SCHEDULED_MESSAGE_LIMIT;
      const activeCount = await db.collection('scheduled_messages')
        .countDocuments({ guild_id: gidLong, active: true });
      return json({
        items: list.map(serializeDoc),
        limit,
        active_count: activeCount,
        is_premium: premium,
      });
    }
  }

  if (path === 'site/autumn') {
    const config = await getAutumnConfig();
    return json(config, { headers: { 'Cache-Control': 'no-store' } });
  }

  if (path === 'site/season-effects') {
    const config = await getSeasonConfig();
    return json(config, { headers: { 'Cache-Control': 'no-store' } });
  }

  return json({ error: 'not_found', path }, { status: 404 });
}

export async function GET(request, context) {
  try {
    return await handleGet(request, context);
  } catch (e) {
    console.error('Unhandled error in GET', e);
    return json({ error: 'internal_error' }, { status: 500 });
  }
}

async function safeHandleMutation(request, context) {
  let peek = null;
  try { peek = request.clone(); } catch { peek = null; }
  let response;
  try {
    response = await handleMutation(request, context);
  } catch (e) {
    console.error('Unhandled error in mutation handler', e);
    response = json({ error: 'internal_error' }, { status: 500 });
  }
  await auditOwnerMutation(request, context, response, peek);
  return response;
}

const OWNER_AUDIT_PATH = /^(owner\/(?!access\/)|premium\/(generate|keys|servers|revoke)|updates|blog|partners|staff|site\/)/;

function ownerActionLabel(method, path) {
  let m;
  if ((m = path.match(/^owner\/guild-bans\/(\d+)\/(ban|unban)$/))) return { action: m[2] === 'ban' ? 'Server banned' : 'Server unbanned', target: `server ${m[1]}` };
  if ((m = path.match(/^owner\/guilds\/(\d+)\/message-owner$/))) return { action: 'Message sent to a server owner', target: `server ${m[1]}` };
  if (path === 'premium/generate') return { action: 'Premium key generated', target: '' };
  if (path.startsWith('premium/')) return { action: `Premium ${method.toLowerCase()}`, target: path };
  if (path === 'owner/bot-welcome') return { action: 'Bot welcome message setting changed', target: '' };
  if (path.startsWith('site/')) return { action: 'Website setting changed', target: path.replace(/^site\//, '') };
  if (path === 'updates') return { action: method === 'DELETE' ? 'Update deleted' : 'Update posted', target: '' };
  if (path === 'blog') return { action: method === 'DELETE' ? 'Blog post deleted' : 'Blog post saved', target: '' };
  if (path === 'partners') return { action: method === 'DELETE' ? 'Partner removed' : 'Partner saved', target: '' };
  if (path === 'staff') return { action: method === 'DELETE' ? 'Team member removed' : 'Team member saved', target: '' };
  return { action: `${method} ${path}`.slice(0, 80), target: '' };
}

async function auditOwnerMutation(request, context, response, peek) {
  try {
    const params = await context.params;
    const path = (params?.path || []).join('/');
    if (!OWNER_AUDIT_PATH.test(path)) return;
    const session = await getSession();
    if (!session?.user) return;
    const status = response?.status || 0;
    if (status === 403 && request.headers.get('origin') == null) return;
    const isOwner = session.user.id === OWNER_ID;
    const { action, target } = ownerActionLabel(request.method, path);
    let detail = `HTTP ${status}`;
    if (/message-owner$/.test(path) && peek) {
      const sent = await peek.json().catch(() => ({}));
      const text = typeof sent?.message === 'string' ? sent.message.trim() : '';
      if (text) detail += ` \u00b7 ${text.length} characters: "${text.slice(0, 160)}${text.length > 160 ? '...' : ''}"`;
    }
    const db = await getDb();
    await audit(db, {
      actor: { id: session.user.id, name: session.user.global_name || session.user.username },
      role: isOwner ? 'owner' : 'user',
      action,
      outcome: status < 400 ? 'ok' : (status === 401 || status === 403 ? 'denied' : 'warn'),
      target,
      detail,
      request,
    });
  } catch (e) { console.error('owner mutation audit failed', e?.message || e); }
}

export async function POST(request, context) { return safeHandleMutation(request, context); }
export async function PUT(request, context) { return safeHandleMutation(request, context); }
export async function PATCH(request, context) { return safeHandleMutation(request, context); }
export async function DELETE(request, context) { return safeHandleMutation(request, context); }

function isTrustedOrigin(request) {
  const origin = request.headers.get('origin');
  if (!origin) return false;
  const base = process.env.NEXT_PUBLIC_BASE_URL;
  if (!base) return true;
  try {
    const normalize = (h) => h.replace(/^www\./, '');
    return normalize(new URL(origin).host) === normalize(new URL(base).host);
  } catch {
    return false;
  }
}


async function readProfileCard(db, userId) {
  const doc = await db.collection('profile_cards').findOne({ _id: String(userId) });
  const config = normalizeProfileConfig(doc?.cfg);
  let image = null;
  if (config.bg_image) {
    const img = await db.collection('profile_card_images').findOne({ _id: new ProfileObjectId(config.bg_image), user: String(userId) }, { projection: { mime: 1, w: 1, h: 1, size: 1 } }).catch(() => null);
    if (img) image = { id: config.bg_image, mime: img.mime, w: img.w, h: img.h, size: img.size };
    else config.bg_image = null;
  }
  return { config, image, public: doc?.public !== false, rev: Number(doc?.rev || 0), customized: Boolean(doc?.cfg && Object.keys(doc.cfg).length) };
}

const AUDIO_MIME = new Set(['audio/mpeg', 'audio/ogg', 'audio/mp4', 'audio/wav', 'audio/flac']);
const AUDIO_MAX_BYTES = 4 * 1024 * 1024;
function sniffAudio(b) {
  if (!b || b.length < 16) return null;
  if (b.toString('latin1', 0, 3) === 'ID3' || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0)) return 'audio/mpeg';
  if (b.toString('latin1', 0, 4) === 'OggS') return 'audio/ogg';
  if (b.toString('latin1', 4, 8) === 'ftyp') return 'audio/mp4';
  if (b.toString('latin1', 0, 4) === 'RIFF' && b.toString('latin1', 8, 12) === 'WAVE') return 'audio/wav';
  if (b.toString('latin1', 0, 4) === 'fLaC') return 'audio/flac';
  return null;
}

const PROFILE_IMAGE_MIME = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
async function hourlyLimited(db, key, max) {
  const hour = Math.floor(Date.now() / 3_600_000);
  try {
    const r = await db.collection('rate_limit_buckets').findOneAndUpdate({ _id: `${key}:${hour}` }, { $inc: { count: 1 }, $setOnInsert: { expires_at: new Date((hour + 2) * 3_600_000) } }, { upsert: true, returnDocument: 'after' });
    return (r?.count || 0) > max;
  } catch { return false; }
}

async function handleMutation(request, context) {
  if (!isTrustedOrigin(request)) {
    return json({ error: 'forbidden_origin' }, { status: 403 });
  }

  const params = await context.params;
  const path = (params?.path || []).join('/');
  const method = request.method;

  if (path === 'auth/logout' && method === 'POST') {
    await clearSession();
    return json({ ok: true });
  }

  const rateKey = request.cookies?.get?.('wody_session')?.value || 'anon';

  if (path === 'profile-page/music' && ['POST', 'DELETE'].includes(method)) {
    const session = await getSession();
    if (!session?.user?.id) return json({ error: 'unauthenticated' }, { status: 401 });
    const userId = String(session.user.id);
    const mdb = await getDb();
    if (await rateLimited(mdb, rateKey)) return json({ error: 'rate_limited' }, { status: 429 });
    if (method === 'DELETE') {
      await mdb.collection('profile_music').deleteMany({ user: userId });
      return json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
    }
    if (await hourlyLimited(mdb, `pcmusic:${userId}`, 6)) return json({ error: 'rate_limited' }, { status: 429 });
    const modDoc = await mdb.collection('profile_cards').findOne({ _id: userId }, { projection: { moderation: 1 } });
    const modState = publicModeration(modDoc?.moderation);
    if (accountState(modDoc?.moderation).blocked || modState.account_blocked) return json({ error: 'account_blocked' }, { status: 403 });
    if (modState.suspended) return json({ error: 'customization_suspended' }, { status: 403 });
    if (modState.uploads_restricted) return json({ error: 'uploads_restricted' }, { status: 403 });
    if (Number(request.headers.get('content-length') || 0) > AUDIO_MAX_BYTES + 16384) return json({ error: 'audio_too_large' }, { status: 413 });
    let form;
    try { form = await request.formData(); } catch { return json({ error: 'bad_request' }, { status: 400 }); }
    if (form.get('policy_accepted') !== 'true') return json({ error: 'policy_acceptance_required' }, { status: 400 });
    if (form.get('rights_accepted') !== 'true') return json({ error: 'rights_acceptance_required' }, { status: 400 });
    const file = form.get('file');
    if (!file || typeof file === 'string') return json({ error: 'audio_invalid' }, { status: 400 });
    if (file.size > AUDIO_MAX_BYTES) return json({ error: 'audio_too_large' }, { status: 413 });
    const buf = Buffer.from(await file.arrayBuffer());
    const mime = sniffAudio(buf);
    if (!mime) return json({ error: 'audio_invalid' }, { status: 415 });
    const made = await mdb.collection('profile_music').insertOne({ user: userId, mime, size: buf.length, data: buf, name: String(file.name || '').slice(0, 80), created_at: new Date(), rights_accepted_at: new Date(), rights_version: POLICY_VERSION });
    await mdb.collection('profile_music').deleteMany({ user: userId, _id: { $ne: made.insertedId } });
    return json({ url: `/api/profile-page/music/${made.insertedId}`, name: String(file.name || '').slice(0, 80) }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
  }

  if (path === 'profile-card/image' && ['POST', 'DELETE'].includes(method)) {
    const session = await getSession();
    if (!session?.user?.id) return json({ error: 'unauthenticated' }, { status: 401 });
    const userId = String(session.user.id);
    const idb = await getDb();
    if (await rateLimited(idb, rateKey)) return json({ error: 'rate_limited' }, { status: 429 });
    if (method === 'DELETE') {
      await idb.collection('profile_card_images').deleteMany({ user: userId });
      await idb.collection('profile_cards').updateOne({ _id: userId }, { $set: { 'cfg.bg_image': null, 'cfg.bg_mode': 'gradient', 'cfg.theme': 'custom', updated_at: new Date() }, $inc: { rev: 1 } }, { upsert: true });
      return json({ ...(await readProfileCard(idb, userId)), schema_version: 1 }, { headers: { 'Cache-Control': 'no-store' } });
    }
    if (await hourlyLimited(idb, `pcimg:${userId}`, 12)) return json({ error: 'rate_limited' }, { status: 429 });
    const modDoc = await idb.collection('profile_cards').findOne({ _id: userId }, { projection: { moderation: 1 } });
    if (accountState(modDoc?.moderation).blocked) return json({ error: 'account_blocked' }, { status: 403 });
    const max = PROFILE_CARD.imageMaxBytes;
    if (Number(request.headers.get('content-length') || 0) > max + 16384) return json({ error: 'image_too_large' }, { status: 413 });
    let form;
    try { form = await request.formData(); } catch { return json({ error: 'bad_request' }, { status: 400 }); }
    if (form.get('policy_accepted') !== 'true') return json({ error: 'policy_acceptance_required' }, { status: 400 });
    const file = form.get('file');
    if (!file || typeof file === 'string') return json({ error: 'image_invalid' }, { status: 400 });
    if (file.size > max) return json({ error: 'image_too_large' }, { status: 413 });
    const buf = Buffer.from(await file.arrayBuffer());
    const info = sniffProfileImage(buf);
    if (!info || !PROFILE_IMAGE_MIME.has(info.mime)) return json({ error: 'image_invalid' }, { status: 415 });
    if (info.w < 64 || info.h < 32 || info.w > 6000 || info.h > 6000 || info.w * info.h > 16_000_000) return json({ error: 'image_dimensions' }, { status: 400 });
    const created = await idb.collection('profile_card_images').insertOne({ user: userId, mime: info.mime, w: info.w, h: info.h, size: buf.length, data: buf, created_at: new Date() });
    await idb.collection('profile_card_images').deleteMany({ user: userId, _id: { $ne: created.insertedId } });
    const id = String(created.insertedId);
    await idb.collection('profile_cards').updateOne({ _id: userId }, { $set: { 'cfg.bg_image': id, 'cfg.bg_url': null, 'cfg.bg_mode': 'image', 'cfg.theme': 'custom', updated_at: new Date() }, $inc: { rev: 1 } }, { upsert: true });
    return json({ ...(await readProfileCard(idb, userId)), schema_version: 1 }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
  }

  const rawBody = await request.json().catch(() => ({}));
  const body = (rawBody && typeof rawBody === 'object' && !Array.isArray(rawBody)) ? rawBody : {};
  const db = await getDb();

  if (await rateLimited(db, rateKey)) {
    return json({ error: 'rate_limited' }, { status: 429 });
  }

  if (path === 'content-report' && method === 'POST') {
    const session = await getSession();
    const kind = String(body.kind || '');
    if (!REPORT_KINDS.includes(kind)) return json({ error: 'invalid_value', field: 'kind' }, { status: 400 });
    const reason = cleanText(body.reason, 1500);
    if (reason.length < 10) return json({ error: 'invalid_value', field: 'reason' }, { status: 400 });
    const target = cleanText(body.target, 40).toLowerCase().replace(/^@/, '');
    if (!target || !/^[a-z0-9_.-]{2,40}$/.test(target)) return json({ error: 'invalid_value', field: 'target' }, { status: 400 });
    const formal = kind === 'copyright' || kind === 'trademark';
    const claimant = formal ? {
      name: cleanText(body.claimant_name, 120),
      email: cleanText(body.claimant_email, 160),
      work: cleanText(body.work_description, 800),
      work_url: cleanText(body.work_url, 300),
      accurate: body.confirm_accurate === true,
      authorized: body.confirm_authorized === true,
    } : null;
    if (formal && (!claimant.name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(claimant.email) || !claimant.work || !claimant.accurate || !claimant.authorized)) {
      return json({ error: 'invalid_value', field: 'claimant' }, { status: 400 });
    }
    if (!formal && !session?.user?.id) return json({ error: 'unauthenticated' }, { status: 401 });
    const reporter = session?.user?.id ? String(session.user.id) : null;
    const profile = await db.collection(M.profiles).findOne({ username_lc: target }, { projection: { user_id: 1 } });
    if (!profile) return json({ error: 'not_found' }, { status: 404 });
    const since = new Date(Date.now() - 24 * 3600 * 1000);
    const dupe = reporter ? await db.collection('content_reports').findOne({ reporter_id: reporter, target_user_id: String(profile.user_id), kind, created_at: { $gt: since } }, { projection: { _id: 1 } }) : null;
    if (dupe) return json({ ok: true, duplicate: true });
    if (reporter && await hourlyLimited(db, `report:${reporter}`, 10)) return json({ error: 'rate_limited' }, { status: 429 });
    const doc = { kind, status: 'open', target_username: target, target_user_id: String(profile.user_id), reporter_id: reporter, reason, claimant, location: cleanText(body.location, 40) || 'profile_page', created_at: new Date(), history: [] };
    const res = await db.collection('content_reports').insertOne(doc);
    return json({ ok: true, id: String(res.insertedId) }, { status: 201 });
  }

  if (path === 'content-appeal' && method === 'POST') {
    const session = await getSession();
    if (!session?.user?.id) return json({ error: 'unauthenticated' }, { status: 401 });
    const userId = String(session.user.id);
    const message = cleanText(body.message, 1500);
    if (message.length < 10) return json({ error: 'invalid_value', field: 'message' }, { status: 400 });
    if (await hourlyLimited(db, `appeal:${userId}`, 3)) return json({ error: 'rate_limited' }, { status: 429 });
    const rows = await db.collection('content_reports').find({ target_user_id: userId, status: { $in: ['removed', 'restricted', 'suspended'] } }).sort({ created_at: -1 }).limit(1).toArray();
    if (!rows.length) return json({ error: 'not_found' }, { status: 404 });
    await db.collection('content_reports').updateOne({ _id: rows[0]._id }, { $set: { status: 'appealed', appeal: { message, at: new Date() } }, $push: { history: { at: new Date(), by: userId, action: 'appeal' } } });
    return json({ ok: true });
  }

  if (path.startsWith('owner/content-reports/') && method === 'POST') {
    const session = await getSession();
    if (!session?.user || session.user.id !== OWNER_ID) return json({ error: 'forbidden' }, { status: 403 });
    let oid;
    try { oid = new ProfileObjectId(path.split('/')[2]); } catch { return json({ error: 'not_found' }, { status: 404 }); }
    const action = String(body.action || '');
    if (!REPORT_ACTIONS.includes(action)) return json({ error: 'invalid_value', field: 'action' }, { status: 400 });
    const note = cleanText(body.note, 800);
    const report = await db.collection('content_reports').findOne({ _id: oid });
    if (!report) return json({ error: 'not_found' }, { status: 404 });
    const uid = report.target_user_id;
    const now = new Date();
    const cards = db.collection('profile_cards');
    let status = report.status;
    if (action === 'review') status = 'reviewing';
    if (action === 'dismiss') status = 'dismissed';
    if (action === 'remove_content') {
      await cards.updateOne({ _id: uid }, { $set: { 'page.image': null, 'page.music': null, 'page.mode': 'preset', 'moderation.notice': { at: now, action: 'remove_content', report_id: String(oid) } }, $inc: { 'moderation.violations': 1 }, $unset: { 'cfg.bg_url': '' } });
      await cards.updateOne({ _id: uid }, { $set: { 'cfg.bg_image': null, 'cfg.bg_mode': 'gradient' } });
      await db.collection('profile_card_images').deleteMany({ user: uid });
      status = 'removed';
    }
    if (action === 'restrict_uploads') {
      const days = Math.max(1, Math.min(365, Number(body.days) || 30));
      await cards.updateOne({ _id: uid }, { $set: { 'moderation.uploads_restricted': true, 'moderation.uploads_restricted_until': new Date(now.getTime() + days * 86400000), 'moderation.notice': { at: now, action: 'restrict_uploads', report_id: String(oid) } }, $inc: { 'moderation.violations': 1 } }, { upsert: true });
      status = 'restricted';
    }
    if (action === 'suspend_customization') {
      await cards.updateOne({ _id: uid }, { $set: { 'moderation.suspended': true, 'moderation.notice': { at: now, action: 'suspend_customization', report_id: String(oid) } }, $inc: { 'moderation.violations': 1 } }, { upsert: true });
      status = 'suspended';
    }
    if (action === 'suspend_account') {
      const days = Math.max(1, Math.min(365, Number(body.days) || 30));
      await cards.updateOne({ _id: uid }, { $set: { 'moderation.account_suspended_until': new Date(now.getTime() + days * 86400000), 'moderation.notice': { at: now, action: 'suspend_account', report_id: String(oid) } }, $inc: { 'moderation.violations': 1 } }, { upsert: true });
      status = 'suspended';
    }
    if (action === 'block_account') {
      await cards.updateOne({ _id: uid }, { $set: { 'moderation.account_blocked': true, 'moderation.notice': { at: now, action: 'block_account', report_id: String(oid) } }, $inc: { 'moderation.violations': 1 } }, { upsert: true });
      status = 'blocked';
    }
    if (action === 'unblock_account') {
      await cards.updateOne({ _id: uid }, { $set: { 'moderation.account_blocked': false }, $unset: { 'moderation.account_suspended_until': '' } });
      status = 'dismissed';
    }
    if (action === 'restore') {
      await cards.updateOne({ _id: uid }, { $set: { 'moderation.uploads_restricted': false, 'moderation.suspended': false, 'moderation.account_blocked': false }, $unset: { 'moderation.uploads_restricted_until': '', 'moderation.account_suspended_until': '', 'moderation.notice': '' } });
      status = 'dismissed';
    }
    await db.collection('content_reports').updateOne({ _id: oid }, { $set: { status, decided_at: now }, $push: { history: { at: now, by: String(session.user.id), action, note } } });
    return json({ ok: true, status });
  }

  if (path === 'owner/account-moderation' && method === 'POST') {
    const session = await getSession();
    if (!session?.user || session.user.id !== OWNER_ID) return json({ error: 'forbidden' }, { status: 403 });
    const action = String(body.action || '');
    if (!['suspend_account', 'block_account', 'unblock_account'].includes(action)) return json({ error: 'invalid_value', field: 'action' }, { status: 400 });
    const rawTarget = cleanText(body.target, 40).toLowerCase().replace(/^@/, '');
    let uid = /^\d{15,25}$/.test(rawTarget) ? rawTarget : null;
    if (!uid && /^[a-z0-9_.-]{2,40}$/.test(rawTarget)) {
      const p = await db.collection(M.profiles).findOne({ username_lc: rawTarget }, { projection: { user_id: 1 } });
      uid = p ? String(p.user_id) : null;
    }
    if (!uid) return json({ error: 'not_found' }, { status: 404 });
    if (uid === OWNER_ID) return json({ error: 'invalid_value', field: 'target' }, { status: 400 });
    const now = new Date();
    const note = cleanText(body.note, 800);
    const cards = db.collection('profile_cards');
    let status = 'dismissed';
    if (action === 'suspend_account') {
      const days = Math.max(1, Math.min(365, Number(body.days) || 30));
      await cards.updateOne({ _id: uid }, { $set: { 'moderation.account_suspended_until': new Date(now.getTime() + days * 86400000), 'moderation.notice': { at: now, action, report_id: '' } }, $inc: { 'moderation.violations': 1 } }, { upsert: true });
      status = 'suspended';
    } else if (action === 'block_account') {
      await cards.updateOne({ _id: uid }, { $set: { 'moderation.account_blocked': true, 'moderation.notice': { at: now, action, report_id: '' } }, $inc: { 'moderation.violations': 1 } }, { upsert: true });
      status = 'blocked';
    } else {
      await cards.updateOne({ _id: uid }, { $set: { 'moderation.account_blocked': false }, $unset: { 'moderation.account_suspended_until': '', 'moderation.notice': '' } });
    }
    await db.collection('content_reports').insertOne({ kind: 'owner_action', status, target_username: String(body.target || '').slice(0, 40), target_user_id: uid, reporter_id: null, reason: note || action, claimant: null, location: 'owner_panel', created_at: now, decided_at: now, history: [{ at: now, by: String(session.user.id), action, note }] });
    return json({ ok: true, status, user_id: uid });
  }

  if (path === 'profile-page' && ['PATCH', 'PUT', 'DELETE'].includes(method)) {
    const session = await getSession();
    if (!session?.user?.id) return json({ error: 'unauthenticated' }, { status: 401 });
    const userId = String(session.user.id);
    if (await rateLimited(db, `profilepage:${userId}`)) return json({ error: 'rate_limited' }, { status: 429 });
    if (method === 'DELETE') {
      await db.collection('profile_cards').updateOne({ _id: userId }, { $set: { page: {}, updated_at: new Date() } }, { upsert: true });
      return json({ page: normalizePage({}), customized: false }, { headers: { 'Cache-Control': 'no-store' } });
    }
    const { image_rights: _legacyRights, policy_accepted: policyAccepted, ...patchBody } = body;
    let clean;
    try { clean = validatePagePatch(patchBody); } catch (e) {
      return json({ error: 'invalid_value', field: String(e?.message || 'body') }, { status: 400 });
    }
    const mod = publicModeration((await db.collection('profile_cards').findOne({ _id: userId }, { projection: { moderation: 1 } }))?.moderation);
    if (mod.account_blocked) return json({ error: 'account_blocked' }, { status: 403 });
    if (mod.suspended) return json({ error: 'customization_suspended' }, { status: 403 });
    const touchesMedia = ('image' in clean && clean.image) || ('music' in clean && clean.music) || ('portfolio' in clean && clean.portfolio.some((x) => x.image));
    if (touchesMedia && mod.uploads_restricted) return json({ error: 'uploads_restricted' }, { status: 403 });
    if (Object.keys(clean).length && policyAccepted !== true) return json({ error: 'policy_acceptance_required' }, { status: 400 });
    if (Object.keys(clean).length) {
      const set = { updated_at: new Date(), 'page.policy_accepted_at': new Date().toISOString(), 'page.policy_version': POLICY_VERSION };
      for (const [k, v] of Object.entries(clean)) set[`page.${k}`] = v;
      await db.collection('profile_cards').updateOne({ _id: userId }, { $set: set }, { upsert: true });
      if ('music' in clean) {
        const keep = /^\/api\/profile-page\/music\/([a-f0-9]{24})$/.exec(clean.music || '');
        await db.collection('profile_music').deleteMany(keep ? { user: userId, _id: { $ne: new ProfileObjectId(keep[1]) } } : { user: userId }).catch(() => {});
      }
    }
    const doc = await db.collection('profile_cards').findOne({ _id: userId }, { projection: { page: 1 } });
    return json({ page: normalizePage(doc?.page), customized: Boolean(doc?.page && Object.keys(doc.page).length) }, { headers: { 'Cache-Control': 'no-store' } });
  }

  if (path === 'profile-visibility' && method === 'PUT') {
    const session = await getSession();
    if (!session?.user?.id) return json({ error: 'unauthenticated' }, { status: 401 });
    const userId = String(session.user.id);
    if (await rateLimited(db, `profilevis:${userId}`)) return json({ error: 'rate_limited' }, { status: 429 });
    if (typeof body.public !== 'boolean') return json({ error: 'invalid_value', field: 'public' }, { status: 400 });
    if (body.public === true) {
      if (body.policy_accepted !== true) return json({ error: 'policy_acceptance_required' }, { status: 400 });
      const doc = await db.collection('profile_cards').findOne({ _id: userId }, { projection: { moderation: 1 } });
      if (accountState(doc?.moderation).blocked) return json({ error: 'account_blocked' }, { status: 403 });
      await db.collection('profile_cards').updateOne({ _id: userId }, { $set: { share_public: true, share_public_at: new Date(), share_public_policy_version: POLICY_VERSION, updated_at: new Date() } }, { upsert: true });
    } else {
      await db.collection('profile_cards').updateOne({ _id: userId }, { $set: { share_public: false, updated_at: new Date() } }, { upsert: true });
    }
    return json({ share_public: body.public }, { headers: { 'Cache-Control': 'no-store' } });
  }

  if (path === 'profile-card' && ['PATCH', 'PUT', 'DELETE'].includes(method)) {
    const session = await getSession();
    if (!session?.user?.id) return json({ error: 'unauthenticated' }, { status: 401 });
    const userId = String(session.user.id);
    if (await rateLimited(db, `profilecard:${userId}`)) return json({ error: 'rate_limited' }, { status: 429 });
    if (method === 'DELETE') {
      await db.collection('profile_card_images').deleteMany({ user: userId });
      await db.collection('profile_cards').updateOne({ _id: userId }, { $set: { cfg: {}, updated_at: new Date() }, $inc: { rev: 1 } }, { upsert: true });
      return json({ ...(await readProfileCard(db, userId)), schema_version: 1 }, { headers: { 'Cache-Control': 'no-store' } });
    }
    const current = (await readProfileCard(db, userId)).config;
    const { public: wantPublic, policy_accepted: policyAccepted, ...designPatch } = body;
    if ('public' in body && typeof wantPublic !== 'boolean') return json({ error: 'invalid_value', field: 'public' }, { status: 400 });
    if (wantPublic === true && policyAccepted !== true) return json({ error: 'policy_acceptance_required' }, { status: 400 });
    if (wantPublic === true && (await db.collection('profile_cards').findOne({ _id: userId }, { projection: { moderation: 1 } }).then((d) => accountState(d?.moderation).blocked))) return json({ error: 'account_blocked' }, { status: 403 });
    let keys;
    try { ({ keys } = applyProfilePatch(current, designPatch)); } catch (e) {
      return json({ error: 'invalid_value', field: String(e?.message || 'body') }, { status: 400 });
    }
    if (keys.bg_url && policyAccepted !== true) return json({ error: 'policy_acceptance_required' }, { status: 400 });
    if (keys.bg_image) {
      const own = await db.collection('profile_card_images').findOne({ _id: new ProfileObjectId(keys.bg_image), user: userId }, { projection: { _id: 1 } }).catch(() => null);
      if (!own) return json({ error: 'invalid_value', field: 'bg_image' }, { status: 400 });
    }
    if (typeof wantPublic === 'boolean') {
      await db.collection('profile_cards').updateOne({ _id: userId }, { $set: { public: wantPublic, updated_at: new Date() }, $inc: { rev: 1 } }, { upsert: true });
    }
    if (Object.keys(keys).length) {
      const set = { updated_at: new Date() };
      for (const [k, v] of Object.entries(keys)) set[`cfg.${k}`] = v;
      await db.collection('profile_cards').updateOne({ _id: userId }, { $set: set, $inc: { rev: 1 } }, { upsert: true });
    }
    return json({ ...(await readProfileCard(db, userId)), schema_version: 1 }, { headers: { 'Cache-Control': 'no-store' } });
  }

  const accessMatch = path.match(/^owner\/access\/(verify|grant|revoke)$/);
  if (accessMatch && method === 'POST') {
    const session = await getSession();
    if (!session?.user) return json({ error: 'unauthenticated' }, { status: 401 });
    if (session.user.id !== OWNER_ID) {
      await audit(db, { actor: { id: session.user.id, name: session.user.global_name || session.user.username }, role: 'user', action: `access.${accessMatch[1]}`, outcome: 'denied', detail: 'not the owner', request });
      return json({ error: 'forbidden' }, { status: 403 });
    }
    if (await rateLimited(db, `access:${session.user.id}`)) return json({ error: 'rate_limited' }, { status: 429 });
    const r = await mutateAccess(db, session, request, accessMatch[1], body);
    return json(r.body, { status: r.status });
  }

  const banMatch = path.match(/^owner\/guild-bans\/(\d+)\/(ban|unban)$/);
  if (banMatch && method === 'POST') {
    const [, guildId, action] = banMatch;
    const session = await getSession();
    if (!session?.user) return json({ error: 'unauthenticated' }, { status: 401 });
    if (session.user.id !== OWNER_ID) return json({ error: 'forbidden' }, { status: 403 });

    const message = typeof body.message === 'string' ? body.message.trim().slice(0, 1800) : '';
    const now = new Date();

    if (action === 'unban') {
      await db.collection('guild_bans').updateOne(
        { guild_id: String(guildId) },
        { $set: { active: false, updated_at: now, unbanned_at: now, unbanned_by: OWNER_ID } },
        { upsert: false },
      );
      return json({ ok: true, guild_id: guildId, active: false });
    }

    await db.collection('guild_bans').updateOne(
      { guild_id: String(guildId) },
      { $set: {
        guild_id: String(guildId), active: true, message,
        banned_at: now, updated_at: now, banned_by: OWNER_ID,
        unbanned_at: null, unbanned_by: null,
      }},
      { upsert: true },
    );

    let guild = null;
    try { guild = await getBotGuild(guildId); } catch {}

    await db.collection('guild_bans').updateOne(
      { guild_id: String(guildId) },
      { $set: { name: guild?.name || null, icon_url: guildIconUrl(guild) } },
    );

    let dm_sent = false;
    let leave_ok = false;
    if (guild?.owner_id) {
      try {
        const content = message || 'Your server has been blocked from using Wody. The bot will now leave the server.';
        await sendDirectMessage(guild.owner_id, { content });
        dm_sent = true;
      } catch {}
    }
    try { leave_ok = await leaveGuild(guildId); } catch {}

    return json({
      ok: true, guild_id: guildId, active: true,
      owner_id: guild?.owner_id || null, dm_sent, leave_ok,
    });
  }

  const messageOwnerMatch = path.match(/^owner\/guilds\/(\d+)\/message-owner$/);
  if (messageOwnerMatch && method === 'POST') {
    const session = await getSession();
    if (!session?.user) return json({ error: 'unauthenticated' }, { status: 401 });
    if (session.user.id !== OWNER_ID) return json({ error: 'forbidden' }, { status: 403 });
    const [, guildId] = messageOwnerMatch;

    const message = typeof body.message === 'string' ? body.message.trim() : '';
    if (!message) return json({ error: 'empty_message' }, { status: 400 });
    if (message.length > 2000) return json({ error: 'message_too_long' }, { status: 400 });

    const guild = await getBotGuild(guildId).catch(() => null);
    if (!guild?.owner_id) return json({ error: 'owner_not_found' }, { status: 404 });

    try {
      await sendDirectMessage(guild.owner_id, { content: message });
    } catch (e) {
      return json({ error: 'dm_failed' }, { status: 502 });
    }

    const db = await getDb();
    await db.collection('owner_dm_log').insertOne({
      guild_id: String(guildId),
      guild_name: guild.name || null,
      owner_id: String(guild.owner_id),
      message,
      sent_at: new Date(),
      sent_by: OWNER_ID,
    });

    return json({ ok: true, owner_id: String(guild.owner_id) });
  }

  if (path === 'premium/generate' && method === 'POST') {
    const session = await getSession();
    if (!session?.user) return json({ error: 'unauthenticated' }, { status: 401 });
    if (session.user.id !== OWNER_ID) return json({ error: 'forbidden' }, { status: 403 });
    const { randomBytes } = await import('crypto');
    const key = `WODY-${randomBytes(2).toString('hex').toUpperCase()}-${randomBytes(2).toString('hex').toUpperCase()}-${randomBytes(2).toString('hex').toUpperCase()}`;
    const days = Math.max(1, Math.min(3650, Number(body.days) || 30));
    const activationsLimit = Math.max(1, Math.min(100, Number(body.activations_limit) || 1));
    const note = String(body.note || '').slice(0, 200);
    const item = {
      key,
      created_by: toLong(session.user.id) || Long.ZERO,
      activations_limit: activationsLimit,
      activations_used: 0,
      expires_at: new Date(Date.now() + days * 24 * 60 * 60 * 1000),
      revoked: false,
      used_by_guilds: [],
      note,
      created_at: new Date(),
    };
    await db.collection('premium_keys').insertOne(item);
    await logPremiumAudit(db, 'generate_key', session.user.id, {
      key, days, activations_limit: activationsLimit,
    });
    return json(serializeDoc(item));
  }

  const revokeMatch = path.match(/^premium\/keys\/(.+)\/revoke$/);
  if (revokeMatch && method === 'POST') {
    const session = await getSession();
    if (!session?.user || session.user.id !== OWNER_ID)
      return json({ error: 'forbidden' }, { status: 403 });
    const keyValue = revokeMatch[1];
    const keyDoc = await db.collection('premium_keys').findOne({ key: keyValue });
    if (!keyDoc) return json({ error: 'not_found' }, { status: 404 });
    await db.collection('premium_keys').updateOne(
      { key: keyValue },
      { $set: { revoked: true, revoked_reason: 'manual' } }
    );
    const serversRemoved = await deactivateServersForKey(db, keyValue, 'key_revoked');
    await logPremiumAudit(db, 'revoke_key', session.user.id, { key: keyValue, servers_removed: serversRemoved });
    return json({ ok: true, servers_removed: serversRemoved });
  }

  const removeServerMatch = path.match(/^premium\/servers\/(\d+)\/remove$/);
  if (removeServerMatch && method === 'POST') {
    const session = await getSession();
    if (!session?.user || session.user.id !== OWNER_ID)
      return json({ error: 'forbidden' }, { status: 403 });
    const targetGid = toLong(removeServerMatch[1]);
    const activeDocs = await db.collection('premium_servers')
      .find({ guild_id: targetGid, active: true }).toArray();
    const keyValues = [...new Set(activeDocs.map((d) => d.key_value).filter(Boolean))];
    await db.collection('premium_servers').updateMany(
      { guild_id: targetGid, active: true },
      { $set: { active: false, suspended: true, suspended_reason: 'removed_by_owner', revoked_at: new Date() } }
    );
    let keysRevoked = 0;
    for (const kv of keyValues) {
      const stillActive = await db.collection('premium_servers').countDocuments({ key_value: kv, active: true });
      if (stillActive === 0) {
        const r = await db.collection('premium_keys').updateOne(
          { key: kv, revoked: { $ne: true } },
          { $set: { revoked: true, revoked_reason: 'server_removed' } }
        );
        keysRevoked += r.modifiedCount || 0;
      }
    }
    await logPremiumAudit(db, 'remove_server', session.user.id, { guild_id: targetGid, keys_revoked: keysRevoked });
    return json({ ok: true, keys_revoked: keysRevoked });
  }

  if (path === 'updates' && method === 'POST') {
    const session = await getSession();
    if (!session?.user || session.user.id !== OWNER_ID)
      return json({ error: 'forbidden' }, { status: 403 });
    const title = stripEmoji(body.title).slice(0, 150);
    const content = stripEmoji(body.body).slice(0, 5000);
    const tag = String(body.tag || 'Update').trim().slice(0, 40) || 'Update';
    if (!title || !content) return json({ error: 'invalid' }, { status: 400 });
    const extras = parseUpdateExtras(body);
    if (!extras.ok) return json({ error: extras.error }, { status: 400 });
    const item = {
      title,
      body: content,
      tag,
      ...extras.patch,
      created_by: toLong(session.user.id) || Long.ZERO,
      created_at: new Date(),
    };
    const r = await db.collection('updates').insertOne(item);
    const saved = { ...item, _id: r.insertedId };

    let discordPosted = false;
    try {
      await sendGuildMessage(UPDATES_ANNOUNCE_CHANNEL_ID, updateDiscordPayload(saved, { siteUrl: SITE_URL, avatarUrl: UPDATE_THUMBNAIL_URL }));
      discordPosted = true;
    } catch (e) {
      console.error('updates: failed to post Discord announcement', e);
    }

    return json({ ...serializeDoc(saved), discord_posted: discordPosted });
  }

  const updateDelMatch = path.match(/^updates\/([\w-]+)$/);
  if (updateDelMatch && method === 'DELETE') {
    const session = await getSession();
    if (!session?.user || session.user.id !== OWNER_ID)
      return json({ error: 'forbidden' }, { status: 403 });
    const { ObjectId } = await import('mongodb');
    let objId;
    try { objId = new ObjectId(updateDelMatch[1]); } catch { return json({ error: 'invalid_id' }, { status: 400 }); }
    const result = await db.collection('updates').deleteOne({ _id: objId });
    if (result.deletedCount === 0) return json({ error: 'not_found' }, { status: 404 });
    return json({ ok: true });
  }

  if (path === 'blog' && method === 'POST') {
    const session = await getSession();
    if (!session?.user || session.user.id !== OWNER_ID) return json({ error: 'forbidden' }, { status: 403 });
    const parsed = parseBlogPostInput(body, { partial: false });
    if (!parsed.ok) return json({ error: parsed.error }, { status: 400 });
    const baseSlug = parsed.patch.slug || slugify(parsed.patch.title) || 'post';
    const slug = await ensureUniqueSlug(db, baseSlug);
    const published = parsed.patch.published !== false;
    const now = new Date();
    const item = {
      ...parsed.patch,
      slug,
      published,
      published_at: published ? now : null,
      created_at: now,
      updated_at: now,
      created_by: toLong(session.user.id) || Long.ZERO,
    };
    const r = await db.collection(BLOG_COLLECTION).insertOne(item);
    return json(serializeDoc({ ...item, _id: r.insertedId }));
  }

  const blogEditMatch = path.match(/^blog\/([a-f0-9]{24})$/);
  if (blogEditMatch && (method === 'PUT' || method === 'PATCH')) {
    const session = await getSession();
    if (!session?.user || session.user.id !== OWNER_ID) return json({ error: 'forbidden' }, { status: 403 });
    const parsed = parseBlogPostInput(body, { partial: true });
    if (!parsed.ok) return json({ error: parsed.error }, { status: 400 });
    const { ObjectId } = await import('mongodb');
    let objId;
    try { objId = new ObjectId(blogEditMatch[1]); } catch { return json({ error: 'invalid_id' }, { status: 400 }); }
    const existing = await db.collection(BLOG_COLLECTION).findOne({ _id: objId });
    if (!existing) return json({ error: 'not_found' }, { status: 404 });

    const patch = { ...parsed.patch, updated_at: new Date() };
    if ('slug' in patch) {
      patch.slug = await ensureUniqueSlug(db, patch.slug, objId);
    }
    if (patch.published === true && !existing.published_at) {
      patch.published_at = new Date();
    }

    await db.collection(BLOG_COLLECTION).updateOne({ _id: objId }, { $set: patch });
    const updated = await db.collection(BLOG_COLLECTION).findOne({ _id: objId });
    return json(serializeDoc(updated));
  }

  if (path === 'partners' && method === 'POST') {
    const session = await getSession();
    if (!session?.user || session.user.id !== OWNER_ID) return json({ error: 'forbidden' }, { status: 403 });
    const parsed = parsePartnerInput(body, { partial: false });
    if (!parsed.ok) return json({ error: parsed.error, field: parsed.field || null }, { status: 400 });
    const count = await db.collection(PARTNERS_COLLECTION).countDocuments({});
    if (count >= 200) return json({ error: 'limit_reached' }, { status: 400 });
    const now = new Date();
    const doc = { ...parsed.patch, created_at: now, updated_at: now };
    const r = await db.collection(PARTNERS_COLLECTION).insertOne(doc);
    return json(serializePartner({ ...doc, _id: r.insertedId }));
  }
  const partnerMatch = path.match(/^partners\/([a-f0-9]{24})$/);
  if (partnerMatch && (method === 'PUT' || method === 'PATCH' || method === 'DELETE')) {
    const session = await getSession();
    if (!session?.user || session.user.id !== OWNER_ID) return json({ error: 'forbidden' }, { status: 403 });
    const { ObjectId } = await import('mongodb');
    let objId;
    try { objId = new ObjectId(partnerMatch[1]); } catch { return json({ error: 'invalid_id' }, { status: 400 }); }
    if (method === 'DELETE') {
      const res = await db.collection(PARTNERS_COLLECTION).deleteOne({ _id: objId });
      return res.deletedCount ? json({ ok: true }) : json({ error: 'not_found' }, { status: 404 });
    }
    const parsed = parsePartnerInput(body, { partial: true });
    if (!parsed.ok) return json({ error: parsed.error, field: parsed.field || null }, { status: 400 });
    const res = await db.collection(PARTNERS_COLLECTION).findOneAndUpdate(
      { _id: objId }, { $set: { ...parsed.patch, updated_at: new Date() } }, { returnDocument: 'after' },
    );
    const doc = res?.value !== undefined && res?.ok !== undefined ? res.value : res;
    if (!doc) return json({ error: 'not_found' }, { status: 404 });
    return json(serializePartner(doc));
  }

  const blogDelMatch = path.match(/^blog\/([a-f0-9]{24})$/);
  if (blogDelMatch && method === 'DELETE') {
    const session = await getSession();
    if (!session?.user || session.user.id !== OWNER_ID) return json({ error: 'forbidden' }, { status: 403 });
    const { ObjectId } = await import('mongodb');
    let objId;
    try { objId = new ObjectId(blogDelMatch[1]); } catch { return json({ error: 'invalid_id' }, { status: 400 }); }
    const result = await db.collection(BLOG_COLLECTION).deleteOne({ _id: objId });
    if (result.deletedCount === 0) return json({ error: 'not_found' }, { status: 404 });
    return json({ ok: true });
  }

  if (path === 'staff' && method === 'POST') {
    const session = await getSession();
    if (!session?.user || session.user.id !== OWNER_ID) return json({ error: 'forbidden' }, { status: 403 });
    const parsed = parseStaffInput(body, { partial: false });
    if (!parsed.ok) return json({ error: parsed.error }, { status: 400 });
    const user = await getDiscordUserById(parsed.patch.discord_user_id).catch(() => null);
    if (!user) return json({ error: 'discord_user_not_found' }, { status: 400 });
    const item = { ...parsed.patch, position: parsed.patch.position ?? 0, hierarchy_position: parsed.patch.hierarchy_position ?? 0, created_at: new Date() };
    const r = await db.collection(STAFF_COLLECTION).insertOne(item);
    return json(serializeDoc({ ...item, _id: r.insertedId }));
  }

  const staffEditMatch = path.match(/^staff\/([a-f0-9]{24})$/);
  if (staffEditMatch && (method === 'PUT' || method === 'PATCH')) {
    const session = await getSession();
    if (!session?.user || session.user.id !== OWNER_ID) return json({ error: 'forbidden' }, { status: 403 });
    const parsed = parseStaffInput(body, { partial: true });
    if (!parsed.ok) return json({ error: parsed.error }, { status: 400 });
    const { ObjectId } = await import('mongodb');
    let objId;
    try { objId = new ObjectId(staffEditMatch[1]); } catch { return json({ error: 'invalid_id' }, { status: 400 }); }
    const result = await db.collection(STAFF_COLLECTION).updateOne({ _id: objId }, { $set: parsed.patch });
    if (result.matchedCount === 0) return json({ error: 'not_found' }, { status: 404 });
    return json({ ok: true });
  }

  const staffDelMatch = path.match(/^staff\/([a-f0-9]{24})$/);
  if (staffDelMatch && method === 'DELETE') {
    const session = await getSession();
    if (!session?.user || session.user.id !== OWNER_ID) return json({ error: 'forbidden' }, { status: 403 });
    const { ObjectId } = await import('mongodb');
    let objId;
    try { objId = new ObjectId(staffDelMatch[1]); } catch { return json({ error: 'invalid_id' }, { status: 400 }); }
    const result = await db.collection(STAFF_COLLECTION).deleteOne({ _id: objId });
    if (result.deletedCount === 0) return json({ error: 'not_found' }, { status: 404 });
    return json({ ok: true });
  }

  if (path === 'site/autumn' && (method === 'PUT' || method === 'PATCH')) {
    const session = await getSession();
    if (!session?.user) return json({ error: 'unauthenticated' }, { status: 401 });
    if (session.user.id !== OWNER_ID) return json({ error: 'forbidden' }, { status: 403 });
    const parsed = parseAutumnPatch(body);
    if (!parsed.ok) return json({ error: parsed.error }, { status: 400 });
    const config = await saveAutumnPatch(parsed.patch, session.user.id);
    return json(config);
  }

  if (path === 'site/season-effects' && (method === 'PUT' || method === 'PATCH')) {
    const session = await getSession();
    if (!session?.user) return json({ error: 'unauthenticated' }, { status: 401 });
    if (session.user.id !== OWNER_ID) return json({ error: 'forbidden' }, { status: 403 });
    const parsed = parseSeasonPatch(body);
    if (!parsed.ok) return json({ error: parsed.error }, { status: 400 });
    const config = await saveSeasonPatch(parsed.patch, session.user.id);
    return json(config);
  }

  if (path === 'site/community-showcase' && (method === 'PUT' || method === 'PATCH')) {
    const session = await getSession();
    if (!session?.user) return json({ error: 'unauthenticated' }, { status: 401 });
    if (session.user.id !== OWNER_ID) return json({ error: 'forbidden' }, { status: 403 });
    const parsed = parseShowcasePatch(body);
    if (!parsed.ok) return json({ error: parsed.error }, { status: 400 });
    const config = await saveShowcasePatch(parsed.patch, session.user.id);
    return json(config);
  }

  if (path === 'owner/bot-welcome' && (method === 'PUT' || method === 'PATCH')) {
    const session = await getSession();
    if (!session?.user) return json({ error: 'unauthenticated' }, { status: 401 });
    if (session.user.id !== OWNER_ID) return json({ error: 'forbidden' }, { status: 403 });
    if (!body || typeof body.guild_join_welcome !== 'boolean') return json({ error: 'invalid_body' }, { status: 400 });
    const config = await saveBotWelcomeConfig(body.guild_join_welcome, session.user.id);
    return json({ ...config, is_owner: true });
  }

  if (path === 'site/promo-banner' && (method === 'PUT' || method === 'PATCH')) {
    const session = await getSession();
    if (!session?.user) return json({ error: 'unauthenticated' }, { status: 401 });
    if (session.user.id !== OWNER_ID) return json({ error: 'forbidden' }, { status: 403 });
    const parsed = parsePromoBannerPatch(body);
    if (!parsed.ok) return json({ error: parsed.error }, { status: 400 });
    const config = await savePromoBannerPatch(parsed.patch, session.user.id);
    return json(config);
  }

  if (path === 'site/footer-socials' && (method === 'PUT' || method === 'PATCH')) {
    const session = await getSession();
    if (!session?.user) return json({ error: 'unauthenticated' }, { status: 401 });
    if (session.user.id !== OWNER_ID) return json({ error: 'forbidden' }, { status: 403 });
    const parsed = parseFooterSocials(body);
    if (!parsed.ok) return json({ error: parsed.error, errors: parsed.errors || [] }, { status: 400 });
    const config = await saveFooterSocials(parsed.links, session.user.id);
    return json(config);
  }

  if (path === 'site/countdown-banner' && (method === 'PUT' || method === 'PATCH')) {
    const session = await getSession();
    if (!session?.user) return json({ error: 'unauthenticated' }, { status: 401 });
    if (session.user.id !== OWNER_ID) return json({ error: 'forbidden' }, { status: 403 });
    const parsed = parseCountdownBannerPatch(body);
    if (!parsed.ok) return json({ error: parsed.error }, { status: 400 });
    const config = await saveCountdownBannerPatch(parsed.patch, session.user.id);
    return json(config);
  }

  if (path === 'site/og-embed' && (method === 'PUT' || method === 'PATCH')) {
    const session = await getSession();
    if (!session?.user) return json({ error: 'unauthenticated' }, { status: 401 });
    if (session.user.id !== OWNER_ID) return json({ error: 'forbidden' }, { status: 403 });
    const parsed = parseOgEmbedPatch(body);
    if (!parsed.ok) return json({ error: parsed.error }, { status: 400 });
    if (parsed.patch.preview_gif) {
      // only a GIF that is published right now can be chosen for the Discord preview
      const gif = await publishedBySlug(await getDb(), parsed.patch.preview_gif);
      if (!gif) return json({ error: 'gif_not_published' }, { status: 409 });
    }
    const config = await saveOgEmbedPatch(parsed.patch, session.user.id);
    return json(config);
  }

  if (path === 'site/careers-roles' && (method === 'PUT' || method === 'PATCH')) {
    const session = await getSession();
    if (!session?.user) return json({ error: 'unauthenticated' }, { status: 401 });
    if (session.user.id !== OWNER_ID) return json({ error: 'forbidden' }, { status: 403 });
    const parsed = parseCareersRolesPatch(body);
    if (!parsed.ok) return json({ error: parsed.error }, { status: 400 });
    const config = await saveCareersRolesPatch(parsed.patch, session.user.id);
    return json(config);
  }

  const guildMatch = path.match(/^guilds\/(\d+)\/(.+)$/);
  if (!guildMatch) return json({ error: 'not_found' }, { status: 404 });
  const [, guildId, sub] = guildMatch;

  const guard = await guardGuildAccess(guildId);
  if (guard.error) return guard.error;

  const gidLong = toLong(guildId);

  if (isModuleRoute(sub)) {
    const handled = await handleModuleMutation({
      sub, method, body, db, gidLong, guildId, session: guard.session, guild: guard.guild, h: moduleHelpers(),
    });
    if (handled) return handled;
  }

  if (sub === 'premium/activate' && method === 'POST') {
    const session = await getSession();
    const rawKey = String(body.key || '').trim().toUpperCase();
    if (!rawKey) return json({ error: 'missing_key' }, { status: 400 });

    const now = new Date();
    const consumed = await db.collection('premium_keys').findOneAndUpdate(
      {
        key: rawKey,
        revoked: { $ne: true },
        $or: [{ expires_at: null }, { expires_at: { $exists: false } }, { expires_at: { $gt: now } }],
        $expr: { $lt: [{ $ifNull: ['$activations_used', 0] }, { $ifNull: ['$activations_limit', 1] }] },
      },
      { $inc: { activations_used: 1 }, $addToSet: { used_by_guilds: gidLong } },
      { returnDocument: 'after' },
    );

    if (!consumed) {
      const doc = await db.collection('premium_keys').findOne({ key: rawKey });
      if (!doc) return json({ error: 'invalid_key' }, { status: 404 });
      if (doc.revoked) return json({ error: 'revoked' }, { status: 400 });
      if (doc.expires_at && new Date(doc.expires_at) < now) return json({ error: 'expired' }, { status: 400 });
      return json({ error: 'exhausted' }, { status: 400 });
    }

    await db.collection('premium_servers').updateMany({ guild_id: gidLong }, { $set: { active: false } });

    const activation = {
      guild_id: gidLong,
      key_id: String(consumed._id),
      key_value: rawKey,
      activated_by: toLong(session.user.id) || Long.ZERO,
      expires_at: consumed.expires_at ? new Date(consumed.expires_at) : null,
      active: true,
      suspended: false,
      suspended_reason: null,
      activated_at: new Date(),
    };
    await db.collection('premium_servers').insertOne(activation);
    await logPremiumAudit(db, 'activate_key', session?.user?.id, { key: rawKey, guild_id: gidLong });
    return json({ ok: true, activation: serializeDoc(activation) });
  }

  if (sub === 'premium/redeem-votes' && method === 'POST') {
    const session = await getSession();
    const userLong = toLong(session.user.id);
    const before = await db.collection('votes').findOneAndUpdate(
      { user_id: userLong, credit_days: { $gte: VOTE_REDEEM_MIN } },
      { $set: { credit_days: 0 } },
      { returnDocument: 'before' },
    );
    if (!before) {
      const doc = await db.collection('votes').findOne({ user_id: userLong });
      return json({ error: 'not_enough_votes', days: Math.max(0, Number(doc?.credit_days) || 0), min: VOTE_REDEEM_MIN }, { status: 400 });
    }
    const days = Number(before.credit_days) || 0;
    const refund = () => db.collection('votes').updateOne({ user_id: userLong }, { $inc: { credit_days: days } });
    try {
      const now = new Date();
      const current = await db.collection('premium_servers').findOne(
        { guild_id: gidLong, active: true, suspended: { $ne: true } }, { sort: { _id: -1 } },
      );
      let expires;
      if (current) {
        if (!current.expires_at) { await refund(); return json({ error: 'premium_no_end' }, { status: 400 }); }
        expires = new Date(Math.max(new Date(current.expires_at).getTime(), now.getTime()) + days * 86400000);
        await db.collection('premium_servers').updateOne({ _id: current._id }, { $set: { expires_at: expires }, $inc: { vote_days: days } });
      } else {
        expires = new Date(now.getTime() + days * 86400000);
        await db.collection('premium_servers').insertOne({
          guild_id: gidLong, key_id: null, key_value: null, source: 'votes', activated_by: userLong,
          expires_at: expires, active: true, suspended: false, suspended_reason: null, activated_at: now, vote_days: days,
        });
      }
      await db.collection('votes').updateOne({ user_id: userLong }, { $inc: { redeemed_days: days } });
      await logPremiumAudit(db, 'redeem_votes', session?.user?.id, { guild_id: gidLong, days });
      return json({ ok: true, days, expires_at: expires.toISOString() });
    } catch (err) {
      await refund();
      console.error('redeem-votes failed', err);
      return json({ error: 'redeem_failed' }, { status: 500 });
    }
  }

  if (sub === 'modules/toggle' && method === 'POST') {
    const session = await getSession();
    const key = String(body.key || '').trim();
    const enabled = !!body.enabled;

    if (!MODULE_TOGGLE_KEYS.includes(key)) {
      return json({ error: 'invalid_module', field: 'key' }, { status: 400 });
    }

    if (enabled && PREMIUM_ONLY_TOGGLE_KEYS.has(key)) {
      const premium = await isGuildPremium(db, gidLong);
      if (!premium) {
        return json({ error: 'premium_required', field: 'key' }, { status: 403 });
      }
    }

    const filter = { guild_id: gidLong };
    const existing = await db.collection('guild_settings').findOneAndUpdate(
      filter,
      { $set: { [`module_states.${key}`]: enabled, updated_at: new Date() } },
      { upsert: true, returnDocument: 'before' },
    );
    const before = (key === 'invite_tracking' || key === 'link') ? existing?.module_states?.[key] === true : existing?.module_states?.[key] !== false;
    if (key === 'invite_tracking' && before !== enabled) {
      await db.collection('invite_settings').updateOne(filter, { $unset: { baseline_at: '' } }).catch(() => {});
    }

    if (key === 'welcome') {
      await db.collection('welcome_settings').updateOne(filter, { $set: { enabled, updated_at: new Date() } }, { upsert: true });
    } else if (key === 'goodbye') {
      await db.collection('goodbye_settings').updateOne(filter, { $set: { enabled, updated_at: new Date() } }, { upsert: true });
    } else if (key === 'captcha') {
      await db.collection('captcha_settings').updateOne(filter, { $set: { enabled, updated_at: new Date() } }, { upsert: true });
    } else if (key === 'levels') {
      await db.collection('guild_settings').updateOne(filter, { $set: { level_enabled: enabled, updated_at: new Date() } }, { upsert: true });
    } else if (key === 'autorole') {
    }

    if (before !== enabled) {
      try {
        await db.collection('settings_audit').insertOne({
          guild_id: gidLong,
          collection: 'guild_settings',
          user_id: session?.user?.id ? (toLong(session.user.id) || Long.ZERO) : Long.ZERO,
          diff: { [`module_states.${key}`]: { from: before, to: enabled } },
          created_at: new Date(),
        });
      } catch (e) {
        console.error('settings_audit insert failed', e);
      }
    }

    return json({ ok: true, key, enabled });
  }


  if (sub === 'youtube-notify/discord-channel' && method === 'POST') {
    if (!(await youtubeNotifyRateLimit(guildId))) return json({ error: 'rate_limited' }, { status: 429 });
    const premium = await isGuildPremium(db, gidLong);
    if (!premium) return json({ error: 'premium_required' }, { status: 403 });

    const session = await getSession();
    const channelId = String(body.channel_id || '').trim();
    if (!channelId) return json({ error: 'missing_channel' }, { status: 400 });
    if (!(await assertChannelInGuild(guildId, channelId))) {
      return json({ error: 'invalid_channel' }, { status: 400 });
    }

    const roleId = body.mention_role_id ? String(body.mention_role_id).trim() : null;
    if (roleId && !(await assertRoleInGuild(guildId, roleId))) {
      return json({ error: 'invalid_role' }, { status: 400 });
    }
    const liveRoleId = body.live_mention_role_id ? String(body.live_mention_role_id).trim() : null;
    if (liveRoleId && !(await assertRoleInGuild(guildId, liveRoleId))) {
      return json({ error: 'invalid_role' }, { status: 400 });
    }

    const message = body.message != null ? String(body.message).slice(0, 1800) : '';
    const liveMessage = body.live_message != null ? String(body.live_message).slice(0, 1800) : '';
    const fmt = (v) => (v === 'plain' ? 'plain' : 'embed');

    const notifyVideos = body.notify_videos !== false;
    const notifyLive = body.notify_live !== false;
    if (!notifyVideos && !notifyLive) return json({ error: 'nothing_selected' }, { status: 400 });

    const now = new Date();
    await db.collection('youtube_notify_settings').updateOne(
      { guild_id: gidLong },
      {
        $set: {
          guild_id: gidLong,
          channel_id: toLong(channelId),
          mention_role_id: roleId ? toLong(roleId) : null,
          message,
          message_format: fmt(body.message_format),
          live_mention_role_id: liveRoleId ? toLong(liveRoleId) : null,
          live_message: liveMessage,
          live_message_format: fmt(body.live_message_format),
          notify_videos: notifyVideos,
          notify_live: notifyLive,
          updated_at: now,
        },
        $setOnInsert: { created_by: toLong(session.user.id) || Long.ZERO, created_at: now },
      },
      { upsert: true }
    );
    const doc = await db.collection('youtube_notify_settings').findOne({ guild_id: gidLong });
    return json({ ok: true, settings: serializeDoc(doc) });
  }

  if (sub === 'youtube-notify/discord-channel' && method === 'DELETE') {
    if (!(await youtubeNotifyRateLimit(guildId))) return json({ error: 'rate_limited' }, { status: 429 });
    await unwatchAllYoutubeChannels(db, gidLong);
    await db.collection('youtube_notify_settings').deleteOne({ guild_id: gidLong });
    return json({ ok: true });
  }

  if (sub === 'youtube-notify/channels' && method === 'POST') {
    if (!(await youtubeNotifyRateLimit(guildId))) return json({ error: 'rate_limited' }, { status: 429 });
    const premium = await isGuildPremium(db, gidLong);
    if (!premium) return json({ error: 'premium_required' }, { status: 403 });

    const settings = await db.collection('youtube_notify_settings').findOne({ guild_id: gidLong });
    if (!settings) return json({ error: 'discord_channel_not_configured' }, { status: 400 });

    const rawUrl = String(body.url || '').trim();
    if (!rawUrl) return json({ error: 'missing_url' }, { status: 400 });

    let resolved;
    try {
      resolved = await resolveChannelId(rawUrl);
    } catch (e) {
      return json({ error: 'resolve_failed', message: String(e?.message || e) }, { status: 400 });
    }

    let watched = await db.collection('youtube_notify_channels').findOne({
      guild_id: gidLong,
      youtube_channel_id: resolved.channelId,
    });

    if (!watched) {
      const existingCount = await db.collection('youtube_notify_channels').countDocuments({ guild_id: gidLong });
      if (existingCount >= YOUTUBE_NOTIFY_MAX_CHANNELS) {
        return json({ error: 'channel_limit_reached', max: YOUTUBE_NOTIFY_MAX_CHANNELS }, { status: 400 });
      }

      const session = await getSession();
      const now = new Date();
      const doc = {
        guild_id: gidLong,
        youtube_channel_id: resolved.channelId,
        youtube_channel_title: resolved.title || '',
        youtube_channel_url: `https://www.youtube.com/channel/${resolved.channelId}`,
        created_by: toLong(session.user.id) || Long.ZERO,
        created_at: now,
      };
      const insertRes = await db.collection('youtube_notify_channels').insertOne(doc);
      watched = { _id: insertRes.insertedId, ...doc };
    }

    const now = new Date();
    let sub2 = await db.collection('youtube_websub_subscriptions').findOne({
      youtube_channel_id: resolved.channelId,
    });

    const renewBefore = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const needsSubscribe = !sub2
      || sub2.status !== 'verified'
      || !sub2.expires_at
      || new Date(sub2.expires_at) <= renewBefore
      || !sub2.callback_token
      || !sub2.callback_secret
      || !sub2.last_subscribed_at;

    if (needsSubscribe) {
      const secret = sub2?.callback_secret || generateSecret();
      const callbackToken = sub2?.callback_token || generateCallbackToken();

      console.info('[YouTube WebSub] Starting subscribe/repair', {
        channelId: resolved.channelId,
        previousStatus: sub2?.status || 'missing',
        hasLastSubscribedAt: Boolean(sub2?.last_subscribed_at),
      });

      const subscriptionData = {
        youtube_channel_id: resolved.channelId,
        topic: `https://www.youtube.com/feeds/videos.xml?channel_id=${resolved.channelId}`,
        callback_secret: secret,
        callback_token: callbackToken,
        status: 'pending',
        last_subscribed_at: now,
        last_renew_attempt_at: now,
        last_error: null,
        updated_at: now,
      };

      if (!sub2) {
        sub2 = {
          ...subscriptionData,
          lease_seconds: null,
          expires_at: null,
          created_at: now,
        };
        await db.collection('youtube_websub_subscriptions').insertOne(sub2);
      } else {
        await db.collection('youtube_websub_subscriptions').updateOne(
          { _id: sub2._id },
          { $set: subscriptionData }
        );
        sub2 = { ...sub2, ...subscriptionData };
      }

      const { ok, detail } = await subscribeToHub(
        resolved.channelId,
        secret,
        callbackToken
      );

      if (!ok) {
        console.error('[YouTube WebSub] Subscribe/repair failed', {
          channelId: resolved.channelId,
          detail,
        });

        await db.collection('youtube_websub_subscriptions').updateOne(
          { youtube_channel_id: resolved.channelId },
          { $set: { status: 'error', last_error: detail, updated_at: new Date() } }
        );

        return json({
          ok: true,
          warning: `Channel is saved, but the YouTube hub did not accept the subscription (${detail}). The dashboard will retry automatically.`,
          channel: serializeDoc(watched),
        });
      }

      console.info('[YouTube WebSub] Hub accepted subscription request', {
        channelId: resolved.channelId,
        detail,
      });
    } else {
      console.info('[YouTube WebSub] Existing verified subscription is healthy; reuse', {
        channelId: resolved.channelId,
      });
    }

    return json({
      ok: true,
      repaired: needsSubscribe,
      channel: serializeDoc(watched),
    });
  }

  if (sub.startsWith('youtube-notify/channels/') && method === 'DELETE') {
    if (!(await youtubeNotifyRateLimit(guildId))) return json({ error: 'rate_limited' }, { status: 429 });
    const itemId = sub.slice('youtube-notify/channels/'.length);
    const { ObjectId } = await import('mongodb');
    let objectId;
    try {
      objectId = new ObjectId(itemId);
    } catch {
      return json({ error: 'invalid_id' }, { status: 400 });
    }
    const doc = await db.collection('youtube_notify_channels').findOne({ _id: objectId, guild_id: gidLong });
    if (!doc) return json({ error: 'not_found' }, { status: 404 });

    await db.collection('youtube_notify_channels').deleteOne({ _id: objectId });
    await unsubscribeIfOrphaned(db, doc.youtube_channel_id);
    return json({ ok: true });
  }


  if (sub === 'premium/deactivate' && method === 'POST') {
    const session = await getSession();
    if (!guard.guild.owner && session?.user?.id !== OWNER_ID) {
      return json({ error: 'forbidden' }, { status: 403 });
    }
    const result = await db.collection('premium_servers').updateMany({ guild_id: gidLong, active: true }, { $set: { active: false } });
    if (result.modifiedCount > 0) {
      try {
        await db.collection('settings_audit').insertOne({
          guild_id: gidLong,
          collection: 'premium_servers',
          user_id: session?.user?.id ? (toLong(session.user.id) || Long.ZERO) : Long.ZERO,
          diff: { active: { from: true, to: false } },
          created_at: new Date(),
        });
      } catch (e) {
        console.error('settings_audit insert failed', e);
      }
    }
    return json({ ok: true });
  }


  if (sub === 'settings' && (method === 'PUT' || method === 'PATCH')) {
    const session = await getSession();
    const allowed = ['language', 'admin_role_id', 'moderator_role_id',
      'ticket_role_id',
      'mod_log_channel_id', 'mod_log_enabled', 'suggestion_channel_id', 'level_channel_id',
      'level_message', 'level_up_embed', 'level_enabled', 'level_ignored_channel_ids',
      'level_channel_multipliers', 'level_rewards', 'level_role_bonuses',
      'level_message_format', 'level_card_background_url', 'level_card_overlay_color',
      'level_card_overlay_opacity', 'level_card_text_color', 'level_card_color',
      'level_card_avatar_ring', 'level_card_font', 'level_card_size', 'level_card_gradient', 'level_image_mode', 'level_image_url', 'level_use_member_profile',
      'ticket_transcript_channel_id', 'temp_voice_hub_channel_id', 'temp_voice_category_id',
      'temp_voice_name_template', 'temp_voice_default_user_limit', 'bot_nickname'];
    const data = {};
    for (const k of allowed) if (k in body) data[k] = body[k];
    if (hasUserImage(data, new URL(process.env.NEXT_PUBLIC_BASE_URL || 'https://wody.online').host) && body.rights_confirmed !== true) return json({ error: 'rights_confirmation_required' }, { status: 400 });
    if ('bot_nickname' in data) {
      const nick = String(data.bot_nickname ?? '').replace(/[\u0000-\u001f]/g, '').trim();
      if (nick.length > 32) return json({ error: 'nickname_too_long', field: 'bot_nickname' }, { status: 400 });
      if (/@everyone|@here|```/i.test(nick)) return json({ error: 'nickname_not_allowed', field: 'bot_nickname' }, { status: 400 });
      const r = await setBotNickname(guildId, nick);
      if (!r.ok) {
        const code = r.status === 403 ? 'missing_change_nickname' : r.status === 400 ? 'nickname_not_allowed' : 'discord_unavailable';
        return json({ error: code, field: 'bot_nickname' }, { status: r.status === 403 || r.status === 400 ? 400 : 502 });
      }
      data.bot_nickname = nick || null;
    }
    if (data.level_card_size != null && !['compact', 'balanced', 'banner', 'aurora'].includes(data.level_card_size)) {
      return json({ error: 'invalid_value', field: 'level_card_size' }, { status: 400 });
    }
    if (data.level_card_gradient != null && !['ember', 'aurora', 'sunset', 'ocean', 'neon', 'royal', 'forest', 'midnight', 'coast', 'dusk', 'skyline', 'miami'].includes(data.level_card_gradient)) {
      return json({ error: 'invalid_value', field: 'level_card_gradient' }, { status: 400 });
    }
    if ('language' in data) {
      if (!['en', 'ro', 'fr', 'it', 'de', 'es', 'pt', 'nl', 'tr'].includes(data.language)) {
        return json({ error: 'invalid_language', field: 'language' }, { status: 400 });
      }
      data.language_explicit = true;
    }
    const badField = await assertChannelFieldsInGuild(guildId, data,
      ['mod_log_channel_id', 'suggestion_channel_id', 'level_channel_id',
       'ticket_transcript_channel_id', 'temp_voice_hub_channel_id']);
    if (badField) return json({ error: 'invalid_channel', field: badField }, { status: 400 });
    if ('temp_voice_category_id' in data && data.temp_voice_category_id
        && !(await assertCategoryInGuild(guildId, data.temp_voice_category_id))) {
      return json({ error: 'invalid_channel', field: 'temp_voice_category_id' }, { status: 400 });
    }
    if ('temp_voice_name_template' in data) {
      data.temp_voice_name_template = data.temp_voice_name_template
        ? String(data.temp_voice_name_template).trim().slice(0, 100) || null
        : null;
    }
    if ('temp_voice_default_user_limit' in data) {
      const raw = data.temp_voice_default_user_limit;
      if (raw === null || raw === '' || raw === undefined) {
        data.temp_voice_default_user_limit = null;
      } else {
        const n = Number(raw);
        if (!Number.isInteger(n) || n < 0 || n > 99) {
          return json({ error: 'invalid_value', field: 'temp_voice_default_user_limit' }, { status: 400 });
        }
        data.temp_voice_default_user_limit = n;
      }
    }

    for (const roleField of ['admin_role_id', 'moderator_role_id', 'ticket_role_id']) {
      if (data[roleField] && !(await assertRoleInGuild(guildId, data[roleField]))) {
        return json({ error: 'invalid_role', field: roleField }, { status: 400 });
      }
    }
    if ('level_enabled' in data && typeof data.level_enabled !== 'boolean') {
      return json({ error: 'invalid_boolean', field: 'level_enabled' }, { status: 400 });
    }
    if ('level_message_format' in data && !['legacy', 'plain', 'embed', 'card'].includes(data.level_message_format)) {
      return json({ error: 'invalid_level_message_format', field: 'level_message_format' }, { status: 400 });
    }
    if ('level_use_member_profile' in data) data.level_use_member_profile = data.level_use_member_profile === true;
    if ('level_card_font' in data && !CARD_FONT_IDS.includes(data.level_card_font) && data.level_card_font !== 'bold') {
      return json({ error: 'invalid_level_card_font', field: 'level_card_font' }, { status: 400 });
    }
    for (const field of ['level_card_overlay_color', 'level_card_text_color', 'level_card_color']) {
      if (field in data && !/^#[0-9a-fA-F]{6}$/.test(String(data[field]))) {
        return json({ error: 'invalid_color', field }, { status: 400 });
      }
    }
    if ('level_card_overlay_opacity' in data) {
      const value = Number(data.level_card_overlay_opacity);
      if (!Number.isFinite(value) || value < 0 || value > 100) {
        return json({ error: 'invalid_opacity', field: 'level_card_overlay_opacity' }, { status: 400 });
      }
      data.level_card_overlay_opacity = Math.round(value);
    }
    if ('level_card_avatar_ring' in data && typeof data.level_card_avatar_ring !== 'boolean') {
      return json({ error: 'invalid_boolean', field: 'level_card_avatar_ring' }, { status: 400 });
    }
    if ('level_card_background_url' in data) {
      try { data.level_card_background_url = sanitizeImageUrl(data.level_card_background_url); }
      catch { return json({ error: 'invalid_image_url', field: 'level_card_background_url' }, { status: 400 }); }
    }
    if ('level_image_mode' in data) {
      data.level_image_mode = ['server_avatar', 'member_avatar', 'custom', 'none'].includes(data.level_image_mode) ? data.level_image_mode : 'none';
    }
    if ('level_image_url' in data) {
      try { data.level_image_url = sanitizeImageUrl(data.level_image_url); }
      catch { return json({ error: 'invalid_image_url', field: 'level_image_url' }, { status: 400 }); }
    }
    if ('mod_log_enabled' in data && typeof data.mod_log_enabled !== 'boolean') {
      return json({ error: 'invalid_boolean', field: 'mod_log_enabled' }, { status: 400 });
    }
    if ('level_ignored_channel_ids' in data) {
      if (!Array.isArray(data.level_ignored_channel_ids)) {
        return json({ error: 'invalid_channel_list', field: 'level_ignored_channel_ids' }, { status: 400 });
      }
      data.level_ignored_channel_ids = [...new Set(data.level_ignored_channel_ids.map(String).filter(Boolean))].slice(0, 200);
      if (!(await assertChannelsInGuild(guildId, data.level_ignored_channel_ids))) {
        return json({ error: 'invalid_channel', field: 'level_ignored_channel_ids' }, { status: 400 });
      }
    }
    if ('level_rewards' in data) {
      const r = parseLevelRewards(data.level_rewards);
      if (r.error) return json({ error: r.error, field: r.field, limit: r.limit }, { status: 400 });
      if (!(await assertRolesInGuild(guildId, r.value.map((x) => x.role_id).filter(Boolean)))) {
        return json({ error: 'invalid_role', field: 'level_rewards' }, { status: 400 });
      }
      data.level_rewards = r.value;
    }
    if ('level_role_bonuses' in data) {
      const r = parseLevelRoleBonuses(data.level_role_bonuses);
      if (r.error) return json({ error: r.error, field: r.field, limit: r.limit }, { status: 400 });
      if (!(await assertRolesInGuild(guildId, r.value.map((x) => x.role_id)))) {
        return json({ error: 'invalid_role', field: 'level_role_bonuses' }, { status: 400 });
      }
      data.level_role_bonuses = r.value;
    }
    if ('level_enabled' in data) data['module_states.levels'] = Boolean(data.level_enabled);
    return json(await upsertOne('guild_settings', guildId, data, { userId: session?.user?.id }));
  }

  if (sub === 'tickets/panels' && method === 'POST') {
    const session = await getSession();
    const title = String(body.title || 'Tickets').trim().slice(0, 256);
    const description = String(body.description || '').slice(0, 4096);
    const channelId = body.channel_id ? String(body.channel_id) : null;
    const categoryId = body.category_id ? String(body.category_id) : null;
    const supportRoleId = body.support_role_id ? String(body.support_role_id) : null;
    const transcriptDefaultRaw = 'transcript_default_channel_id' in body ? body.transcript_default_channel_id : body.transcript_channel_id;
    const transcriptId = transcriptDefaultRaw ? String(transcriptDefaultRaw) : null;
    let panelImageUrl;
    try { panelImageUrl = sanitizeImageUrl(body.panel_image_url); }
    catch { return json({ error: 'invalid_image_url', field: 'panel_image_url' }, { status: 400 }); }
    const version = 2;
    if (!title || !channelId) return json({ error: 'missing_required' }, { status: 400 });
    const premiumForLimit = await isGuildPremium(db, gidLong);
    const maxPanelsForLimit = premiumForLimit ? PREMIUM_UNLIMITED : FREE_TICKET_PANEL_LIMIT;
    const currentPanelCount = await db.collection('ticket_panels').countDocuments({ guild_id: gidLong });
    if (currentPanelCount >= maxPanelsForLimit) {
      return json({
        error: 'ticket_panel_limit',
        limit: maxPanelsForLimit,
        is_premium: premiumForLimit,
        detail: premiumForLimit
          ? `This server can have at most ${maxPanelsForLimit} ticket panels.`
          : `This server can have at most ${maxPanelsForLimit} ticket panels. Premium servers have no limit.`,
      }, { status: 429 });
    }
    if (!(await assertChannelInGuild(guildId, channelId))) return json({ error: 'invalid_channel' }, { status: 400 });
    if (transcriptId && !(await assertChannelInGuild(guildId, transcriptId))) return json({ error: 'invalid_transcript_channel' }, { status: 400 });
    if (!Array.isArray(body.control_staff_role_ids || []) || !(await assertRolesInGuild(guildId, body.control_staff_role_ids || []))) return json({ error: 'invalid_role' }, { status: 400 });

    const rawOptions = Array.isArray(body.options) && body.options.length ? body.options : [{
      label: body.option_label, emoji: body.option_emoji,
      category_id: categoryId, support_role_id: supportRoleId, transcript_channel_id: transcriptId,
      welcome_title: body.welcome_title, welcome_message: body.welcome_message,
    }];
    if (rawOptions.length < 1 || rawOptions.length > MAX_TICKET_TYPES) return json({ error: 'invalid_options_count', max: MAX_TICKET_TYPES }, { status: 400 });

    const options = [];
    for (const o of rawOptions) {
      const optCategoryId = o.category_id ? String(o.category_id) : null;
      const optSupportRoleId = o.support_role_id ? String(o.support_role_id) : null;
      const optTranscriptId = o.transcript_channel_id ? String(o.transcript_channel_id) : null;
      if (optCategoryId && !(await assertCategoryInGuild(guildId, optCategoryId))) return json({ error: 'invalid_category' }, { status: 400 });
      if (optSupportRoleId && !(await assertRoleInGuild(guildId, optSupportRoleId))) return json({ error: 'invalid_role' }, { status: 400 });
      if (optTranscriptId && !(await assertChannelInGuild(guildId, optTranscriptId))) return json({ error: 'invalid_transcript_channel' }, { status: 400 });
      let optImageUrl;
      try { optImageUrl = sanitizeImageUrl(o.welcome_image_url); }
      catch { return json({ error: 'invalid_image_url', field: 'welcome_image_url' }, { status: 400 }); }
      options.push({
        id: String(o.id || crypto.randomUUID().replaceAll('-', '').slice(0, 8)),
        label: String(o.label || title).slice(0, 80),
        emoji: o.emoji ? String(o.emoji).slice(0, 64) : '{wy:ticket}',
        category_id: optCategoryId ? toLong(optCategoryId) : null,
        support_role_id: optSupportRoleId ? toLong(optSupportRoleId) : null,
        transcript_channel_id: optTranscriptId ? toLong(optTranscriptId) : null,
        welcome_title: String(o.welcome_title || title).slice(0, 256),
        welcome_message: String(o.welcome_message || 'Your response has been submitted successfully. Please wait to be contacted by the team handling your request.').slice(0, 4000),
        welcome_image_mode: TICKET_IMAGE_MODES.includes(o.welcome_image_mode) ? o.welcome_image_mode : 'none',
        welcome_image_url: optImageUrl,
        welcome_image_position: o.welcome_image_position === 'thumbnail' ? 'thumbnail' : 'image',
      });
    }

    const rawCustomFields = Array.isArray(body.form?.custom_fields) ? body.form.custom_fields.slice(0, 2) : [];
    const customFields = rawCustomFields.map((f) => ({
      label: String(f?.label || 'Additional information').slice(0, 45),
      placeholder: String(f?.placeholder || '').slice(0, 100),
      required: Boolean(f?.required),
      style: f?.style === 'paragraph' ? 'paragraph' : 'short',
      max_length: Math.max(1, Math.min(Number(f?.max_length) || 500, 1000)),
    }));
    const rawOverrides = body.message_overrides && typeof body.message_overrides === 'object' ? body.message_overrides : {};
    const messageOverrides = {};
    for (const k of ['welcome_title','welcome_message','close_title','close_message','reopen_message','delete_warning','transcript_message']) {
      if (k in rawOverrides) messageOverrides[k] = String(rawOverrides[k] || '').slice(0, 4000);
    }
    const panel = {
      guild_id: gidLong, channel_id: toLong(channelId), title, description, version,
      panel_color: Number(body.panel_color) || 0xe08a4e,
      color: Number(body.panel_color) || Number(body.color) || 0xe08a4e,
      panel_image_url: panelImageUrl,
      panel_image_position: body.panel_image_position === 'thumbnail' ? 'thumbnail' : 'image',
      control_staff_role_ids: Array.isArray(body.control_staff_role_ids) ? body.control_staff_role_ids.map((x) => toLong(String(x))).filter(Boolean) : [],
      category_id: options[0].category_id, support_role_id: options[0].support_role_id,
      transcript_default_channel_id: transcriptId ? toLong(transcriptId) : null,
      transcript_channel_id: transcriptId ? toLong(transcriptId) : null,
      options, button_label: String(body.button_label || 'Open ticket').slice(0, 80),
      button_style: [1,2,3,4].includes(Number(body.button_style)) ? Number(body.button_style) : 1,
      button_emoji: String(body.button_emoji || '{wy:ticket}').slice(0, 64), select_placeholder: String(body.select_placeholder || 'Choose a ticket type…').slice(0, 150),
      footer_text: String(body.footer_text || 'Click the button below to open a ticket.').slice(0, 2048),
      welcome_title: options[0].welcome_title, welcome_message: options[0].welcome_message, welcome_footer: String(body.welcome_footer || 'Use the buttons below to manage this ticket.').slice(0, 2048),
      form: {
        title: String(body.form?.title || body.form_title || 'Open a ticket').slice(0, 45),
        description_label: String(body.form?.description_label || body.form_description_label || 'Describe your problem').slice(0, 45),
        description_placeholder: String(body.form?.description_placeholder || body.form_description_placeholder || 'Please describe your issue in as much detail as possible…').slice(0, 100),
        links_label: String(body.form?.links_label || body.form_links_label || 'Links / screenshots (optional)').slice(0, 45),
        links_placeholder: String(body.form?.links_placeholder || body.form_links_placeholder || 'Paste any relevant links or image URLs here').slice(0, 100),
        extra_label: String(body.form?.extra_label || body.form_extra_label || 'Other useful info (optional)').slice(0, 45),
        extra_placeholder: String(body.form?.extra_placeholder || body.form_extra_placeholder || 'Add anything else the support team should know').slice(0, 100),
        details_title: String(body.form?.details_title || body.form_details_title || '{wy:edit} Ticket details').slice(0, 256),
        custom_fields: customFields,
      },
      message_overrides: messageOverrides,
      created_at: new Date(), created_by: toLong(session?.user?.id) || Long.ZERO,
    };
    let msg;
    try { msg = await sendGuildMessage(channelId, embedToV2Payload(ticketPanelEmbed(panel), ticketPanelComponents(panel))); }
    catch (e) { return json({ error: 'discord_send_failed', detail: String(e.message || e) }, { status: 502 }); }
    panel.message_id = toLong(msg.id);
    const r = await db.collection('ticket_panels').insertOne(panel);
    return json(serializeDoc({ ...panel, _id: r.insertedId }));
  }

  const panelMatch = sub.match(/^tickets\/panels\/([\w-]+)$/);
  if (panelMatch && (method === 'PATCH' || method === 'PUT')) {
    const { ObjectId } = await import('mongodb');
    const rawPanelId = String(panelMatch[1]);
    let panelKey;
    if (ObjectId.isValid(rawPanelId)) panelKey = new ObjectId(rawPanelId);
    else panelKey = rawPanelId;

    const existing = await db.collection('ticket_panels').findOne({ _id: panelKey });
    if (!existing || String(existing.guild_id) !== String(gidLong)) {
      return json({
        error: 'ticket_panel_not_found',
        detail: 'This ticket panel no longer exists in this server. Refresh the Tickets page and try again.',
        panel_id: rawPanelId,
      }, { status: 404 });
    }
    const allowed = ['title','description','channel_id','category_id','support_role_id','transcript_channel_id','button_label','button_emoji','select_placeholder','footer_text','welcome_title','version','panel_color','color','panel_image_url','panel_image_position','control_staff_role_ids','button_style','welcome_message','welcome_footer','form','message_overrides'];
    const data = {}; for (const k of allowed) if (k in body) data[k] = body[k];
    if (Number(existing.version || 1) < 2) delete data.version;
    if (Number(existing.version || 1) >= 2 && 'version' in body) data.version = 2;
    const isV2Panel = Number(existing.version || 1) >= 2;
    if (isV2Panel) delete data.transcript_channel_id;
    if ('panel_image_url' in data) { try { data.panel_image_url = sanitizeImageUrl(data.panel_image_url); } catch { return json({ error: 'invalid_image_url', field: 'panel_image_url' }, { status: 400 }); } }
    if ('panel_image_position' in data) data.panel_image_position = data.panel_image_position === 'thumbnail' ? 'thumbnail' : 'image';
    if ('button_style' in data) data.button_style = [1,2,3,4].includes(Number(data.button_style)) ? Number(data.button_style) : 1;
    if ('panel_color' in data) { data.panel_color = Number(data.panel_color) || existing.panel_color || 0xe08a4e; data.color = data.panel_color; } else if ('color' in data) { data.color = Number(data.color) || existing.color || 0xe08a4e; data.panel_color = data.color; }
    if ('control_staff_role_ids' in data) {
      if (!Array.isArray(data.control_staff_role_ids) || !(await assertRolesInGuild(guildId, data.control_staff_role_ids))) return json({ error: 'invalid_role' }, { status: 400 });
      data.control_staff_role_ids = data.control_staff_role_ids.map((x) => toLong(String(x))).filter(Boolean);
    }
    for (const k of ['channel_id','category_id','transcript_channel_id']) if (data[k] && !(await assertChannelInGuild(guildId, data[k]))) return json({ error: 'invalid_channel', field: k }, { status: 400 });
    if (data.support_role_id && !(await assertRoleInGuild(guildId, data.support_role_id))) return json({ error: 'invalid_role', field: 'support_role_id' }, { status: 400 });
    if (data.form) {
      const old = existing.form || {};
      data.form = { ...old, ...data.form };
      if (Array.isArray(data.form.custom_fields)) data.form.custom_fields = data.form.custom_fields.slice(0, 2).map((f) => ({ label: String(f?.label || 'Additional information').slice(0,45), placeholder: String(f?.placeholder || '').slice(0,100), required: Boolean(f?.required), style: f?.style === 'paragraph' ? 'paragraph' : 'short', max_length: Math.max(1, Math.min(Number(f?.max_length) || 500, 1000)) }));
    }
    if (data.message_overrides && typeof data.message_overrides === 'object') {
      const clean = {};
      for (const k of ['welcome_title','welcome_message','close_title','close_message','reopen_message','delete_warning','transcript_message']) if (k in data.message_overrides) clean[k] = String(data.message_overrides[k] || '').slice(0, 4000);
      data.message_overrides = { ...(existing.message_overrides || {}), ...clean };
    }
    if (Array.isArray(body.options)) {
      if (body.options.length < 1 || body.options.length > MAX_TICKET_TYPES) return json({ error: 'invalid_options_count', max: MAX_TICKET_TYPES }, { status: 400 });
      let optionImageError = null;
      const options = body.options.map((o) => {
        let welcomeImageUrl = null;
        try { welcomeImageUrl = sanitizeImageUrl(o.welcome_image_url); }
        catch { optionImageError = true; }
        return {
          id: String(o.id || crypto.randomUUID().replaceAll('-', '').slice(0, 8)), label: String(o.label || 'Ticket').slice(0, 80), emoji: o.emoji ? String(o.emoji).slice(0, 64) : null,
          category_id: o.category_id ? toLong(o.category_id) : null, support_role_id: o.support_role_id ? toLong(o.support_role_id) : null, transcript_channel_id: o.transcript_channel_id ? toLong(o.transcript_channel_id) : null,
          welcome_title: String(o.welcome_title || data.welcome_title || existing.welcome_title || o.label || 'Ticket').slice(0, 256),
          welcome_message: String(o.welcome_message || data.welcome_message || existing.welcome_message || 'Your response has been submitted successfully. Please wait to be contacted by the team handling your request.').slice(0, 4000),
          welcome_image_mode: TICKET_IMAGE_MODES.includes(o.welcome_image_mode) ? o.welcome_image_mode : 'none',
          welcome_image_url: welcomeImageUrl,
          welcome_image_position: o.welcome_image_position === 'thumbnail' ? 'thumbnail' : 'image',
        };
      });
      if (optionImageError) return json({ error: 'invalid_image_url', field: 'welcome_image_url' }, { status: 400 });
      for (const o of options) {
        for (const k of ['category_id','transcript_channel_id']) if (o[k] && !(await assertChannelInGuild(guildId, String(o[k])))) return json({ error: 'invalid_channel', field: k }, { status: 400 });
        if (o.support_role_id && !(await assertRoleInGuild(guildId, String(o.support_role_id)))) return json({ error: 'invalid_role', field: 'support_role_id' }, { status: 400 });
      }
      data.options = options;
      if (!('category_id' in data)) data.category_id = options[0].category_id;
      if (!('support_role_id' in data)) data.support_role_id = options[0].support_role_id;
      if (!isV2Panel && !('transcript_channel_id' in data)) data.transcript_channel_id = options[0].transcript_channel_id;
    }
    if (isV2Panel && ('transcript_default_channel_id' in body || 'transcript_channel_id' in body || Array.isArray(body.options))) {
      let defaultTranscript;
      if ('transcript_default_channel_id' in body || 'transcript_channel_id' in body) {
        const rawDefault = 'transcript_default_channel_id' in body ? body.transcript_default_channel_id : body.transcript_channel_id;
        if (rawDefault && !(await assertChannelInGuild(guildId, String(rawDefault)))) return json({ error: 'invalid_transcript_channel' }, { status: 400 });
        defaultTranscript = rawDefault ? toLong(String(rawDefault)) : null;
      } else if (existing.transcript_default_channel_id !== undefined) {
        defaultTranscript = existing.transcript_default_channel_id || null;
      } else {
        const prevFirst = existing.options?.[0]?.transcript_channel_id;
        defaultTranscript = existing.transcript_channel_id && String(existing.transcript_channel_id) !== String(prevFirst ?? '') ? existing.transcript_channel_id : null;
      }
      data.transcript_default_channel_id = defaultTranscript;
      data.transcript_channel_id = defaultTranscript;
    }
    if (data.channel_id && String(data.channel_id) !== String(existing.channel_id)) return json({ error: 'channel_move_not_supported' }, { status: 400 });
    await db.collection('ticket_panels').updateOne({ _id: panelKey, guild_id: existing.guild_id }, { $set: data });
    const updated = await db.collection('ticket_panels').findOne({ _id: panelKey, guild_id: existing.guild_id });
    if (updated?.channel_id && updated?.message_id) {
      try { await editGuildMessage(String(updated.channel_id), String(updated.message_id), embedToV2Payload(ticketPanelEmbed(updated), ticketPanelComponents(updated))); }
      catch (e) { return json({ error: 'discord_edit_failed', detail: String(e.message || e), panel: serializeDoc(updated) }, { status: 502 }); }
    }
    return json(serializeDoc(updated));
  }

  if (panelMatch && method === 'DELETE') {
    const { ObjectId } = await import('mongodb');
    const rawPanelId = String(panelMatch[1]);
    const panelKey = ObjectId.isValid(rawPanelId) ? new ObjectId(rawPanelId) : rawPanelId;
    const doc = await db.collection('ticket_panels').findOne({ _id: panelKey });
    if (!doc || String(doc.guild_id) !== String(gidLong)) {
      return json({
        error: 'ticket_panel_not_found',
        detail: 'This ticket panel no longer exists in this server. Refresh the Tickets page and try again.',
        panel_id: rawPanelId,
      }, { status: 404 });
    }
    await db.collection('ticket_panels').deleteOne({ _id: panelKey, guild_id: doc.guild_id });
    if (doc.channel_id && doc.message_id) {
      await deleteGuildMessage(String(doc.channel_id), String(doc.message_id)).catch(() => {});
    }
    return json({ ok: true });
  }

  if (sub === 'welcome' && (method === 'PUT' || method === 'PATCH')) {
    const session = await getSession();
    const allowed = ['enabled', 'channel_id', 'message', 'title', 'footer', 'embed', 'color', 'image_mode', 'image_url', 'timestamp', 'dm_message', 'auto_role_id', 'dm_image_mode', 'dm_image_url', 'message_format', 'card_enabled', 'card_background_url', 'card_overlay_color', 'card_overlay_opacity', 'card_text_color', 'card_avatar_mode', 'card_avatar_ring', 'card_size', 'card_gradient', 'card_font'];
    const data = {};
    for (const k of allowed) if (k in body) data[k] = body[k];
    if (hasUserImage(data, new URL(process.env.NEXT_PUBLIC_BASE_URL || 'https://wody.online').host) && body.rights_confirmed !== true) return json({ error: 'rights_confirmation_required' }, { status: 400 });
    if ('title' in data) data.title = String(data.title ?? '').slice(0, 256);
    if ('message' in data) data.message = String(data.message ?? '').slice(0, 4096);
    if ('footer' in data) data.footer = String(data.footer ?? '').slice(0, 2048);
    if ('image_mode' in data) {
      data.image_mode = ['server_avatar', 'member_avatar', 'custom', 'none'].includes(data.image_mode) ? data.image_mode : 'member_avatar';
    }
    if ('message_format' in data) {
      if (!['plain', 'avatar', 'card'].includes(data.message_format)) {
        return json({ error: 'invalid_message_format', field: 'message_format' }, { status: 400 });
      }
      data.embed = data.message_format !== 'plain';
      data.card_enabled = data.message_format === 'card';
    } else if ('card_enabled' in data || 'embed' in data) {
      const inferredFormat = data.card_enabled ? 'card' : (data.embed === false ? 'plain' : 'avatar');
      data.message_format = inferredFormat;
      data.embed = inferredFormat !== 'plain';
      data.card_enabled = inferredFormat === 'card';
    }
    if ('image_url' in data) {
      try { data.image_url = sanitizeImageUrl(data.image_url); }
      catch { return json({ error: 'invalid_image_url', field: 'image_url' }, { status: 400 }); }
    }
    if ('dm_image_mode' in data) {
      data.dm_image_mode = ['server_avatar', 'member_avatar', 'custom', 'none'].includes(data.dm_image_mode) ? data.dm_image_mode : 'none';
    }
    if ('dm_image_url' in data) {
      try {
        data.dm_image_url = sanitizeImageUrl(data.dm_image_url);
      } catch {
        return json({ error: 'invalid_image_url', field: 'dm_image_url' }, { status: 400 });
      }
    }
    if (data.color != null) {
      const color = String(data.color).trim();
      if (!/^#[0-9a-fA-F]{6}$/.test(color)) return json({ error: 'invalid_color' }, { status: 400 });
      data.color = color;
    }
    if ('timestamp' in data) data.timestamp = Boolean(data.timestamp);
    if ('card_enabled' in data) data.card_enabled = Boolean(data.card_enabled);
    if ('card_avatar_ring' in data) data.card_avatar_ring = Boolean(data.card_avatar_ring);
    if ('card_avatar_mode' in data) data.card_avatar_mode = ['member', 'server', 'none'].includes(data.card_avatar_mode) ? data.card_avatar_mode : 'member';
    if ('card_size' in data) data.card_size = ['narrow', 'medium', 'large', 'aurora'].includes(data.card_size) ? data.card_size : 'medium';
    if ('card_gradient' in data) data.card_gradient = ['ember', 'aurora', 'sunset', 'ocean', 'neon', 'royal', 'forest', 'midnight', 'coast', 'dusk', 'skyline', 'miami'].includes(data.card_gradient) ? data.card_gradient : 'ember';
    if ('card_background_url' in data) {
      try { data.card_background_url = sanitizeImageUrl(data.card_background_url); }
      catch { return json({ error: 'invalid_image_url', field: 'card_background_url' }, { status: 400 }); }
    }
    if ('card_font' in data && !CARD_FONT_IDS.includes(data.card_font)) {
      return json({ error: 'invalid_card_font', field: 'card_font' }, { status: 400 });
    }
    for (const field of ['card_overlay_color', 'card_text_color']) {
      if (field in data) {
        const value = String(data[field] ?? '').trim();
        if (!/^#[0-9a-fA-F]{6}$/.test(value)) return json({ error: 'invalid_color', field }, { status: 400 });
        data[field] = value;
      }
    }
    if ('card_overlay_opacity' in data) {
      const value = Number(data.card_overlay_opacity);
      if (!Number.isFinite(value)) return json({ error: 'invalid_opacity', field: 'card_overlay_opacity' }, { status: 400 });
      data.card_overlay_opacity = Math.round(Math.min(100, Math.max(0, value)));
    }
    const badField = await assertChannelFieldsInGuild(guildId, data, ['channel_id']);
    if (badField) return json({ error: 'invalid_channel', field: badField }, { status: 400 });
    if (data.auto_role_id && !(await assertRoleInGuild(guildId, data.auto_role_id))) {
      return json({ error: 'invalid_role', field: 'auto_role_id' }, { status: 400 });
    }
    const savedWelcome = await upsertOne('welcome_settings', guildId, data, { userId: session?.user?.id });
    if ('enabled' in data) await mirrorModuleState(guildId, 'welcome', data.enabled);
    if (body.activate_autorole === true && data.auto_role_id) await mirrorModuleState(guildId, 'autorole', true);
    return json(savedWelcome);
  }

  if (sub === 'goodbye' && (method === 'PUT' || method === 'PATCH')) {
    const session = await getSession();
    const allowed = ['enabled', 'channel_id', 'message', 'title', 'footer', 'embed', 'color', 'image_mode', 'image_url', 'timestamp', 'message_format', 'card_enabled', 'card_background_url', 'card_overlay_color', 'card_overlay_opacity', 'card_text_color', 'card_avatar_mode', 'card_avatar_ring', 'card_size', 'card_gradient', 'card_font'];
    const data = {};
    for (const k of allowed) if (k in body) data[k] = body[k];
    if (hasUserImage(data, new URL(process.env.NEXT_PUBLIC_BASE_URL || 'https://wody.online').host) && body.rights_confirmed !== true) return json({ error: 'rights_confirmation_required' }, { status: 400 });
    if ('title' in data) data.title = String(data.title ?? '').slice(0, 256);
    if ('message' in data) data.message = String(data.message ?? '').slice(0, 4096);
    if ('footer' in data) data.footer = String(data.footer ?? '').slice(0, 2048);
    if ('image_mode' in data) {
      data.image_mode = ['server_avatar', 'member_avatar', 'custom', 'none'].includes(data.image_mode) ? data.image_mode : 'member_avatar';
    }
    if ('message_format' in data) {
      if (!['plain', 'avatar', 'card'].includes(data.message_format)) {
        return json({ error: 'invalid_message_format', field: 'message_format' }, { status: 400 });
      }
      data.embed = data.message_format !== 'plain';
      data.card_enabled = data.message_format === 'card';
    } else if ('card_enabled' in data || 'embed' in data) {
      const inferredFormat = data.card_enabled ? 'card' : (data.embed === false ? 'plain' : 'avatar');
      data.message_format = inferredFormat;
      data.embed = inferredFormat !== 'plain';
      data.card_enabled = inferredFormat === 'card';
    }
    if ('image_url' in data) {
      try { data.image_url = sanitizeImageUrl(data.image_url); }
      catch { return json({ error: 'invalid_image_url', field: 'image_url' }, { status: 400 }); }
    }
    if (data.color != null) {
      const color = String(data.color).trim();
      if (!/^#[0-9a-fA-F]{6}$/.test(color)) return json({ error: 'invalid_color' }, { status: 400 });
      data.color = color;
    }
    if ('timestamp' in data) data.timestamp = Boolean(data.timestamp);
    if ('card_enabled' in data) data.card_enabled = Boolean(data.card_enabled);
    if ('card_avatar_ring' in data) data.card_avatar_ring = Boolean(data.card_avatar_ring);
    if ('card_avatar_mode' in data) data.card_avatar_mode = ['member', 'server', 'none'].includes(data.card_avatar_mode) ? data.card_avatar_mode : 'member';
    if ('card_size' in data) data.card_size = ['narrow', 'medium', 'large', 'aurora'].includes(data.card_size) ? data.card_size : 'medium';
    if ('card_gradient' in data) data.card_gradient = ['ember', 'aurora', 'sunset', 'ocean', 'neon', 'royal', 'forest', 'midnight', 'coast', 'dusk', 'skyline', 'miami'].includes(data.card_gradient) ? data.card_gradient : 'ember';
    if ('card_background_url' in data) {
      try { data.card_background_url = sanitizeImageUrl(data.card_background_url); }
      catch { return json({ error: 'invalid_image_url', field: 'card_background_url' }, { status: 400 }); }
    }
    if ('card_font' in data && !CARD_FONT_IDS.includes(data.card_font)) {
      return json({ error: 'invalid_card_font', field: 'card_font' }, { status: 400 });
    }
    for (const field of ['card_overlay_color', 'card_text_color']) {
      if (field in data) {
        const value = String(data[field] ?? '').trim();
        if (!/^#[0-9a-fA-F]{6}$/.test(value)) return json({ error: 'invalid_color', field }, { status: 400 });
        data[field] = value;
      }
    }
    if ('card_overlay_opacity' in data) {
      const value = Number(data.card_overlay_opacity);
      if (!Number.isFinite(value)) return json({ error: 'invalid_opacity', field: 'card_overlay_opacity' }, { status: 400 });
      data.card_overlay_opacity = Math.round(Math.min(100, Math.max(0, value)));
    }
    const badField = await assertChannelFieldsInGuild(guildId, data, ['channel_id']);
    if (badField) return json({ error: 'invalid_channel', field: badField }, { status: 400 });
    const savedGoodbye = await upsertOne('goodbye_settings', guildId, data, { userId: session?.user?.id });
    if ('enabled' in data) await mirrorModuleState(guildId, 'goodbye', data.enabled);
    return json(savedGoodbye);
  }

  if (sub === 'captcha' && (method === 'PUT' || method === 'PATCH')) {
    const session = await getSession();
    const allowed = [
      'enabled', 'channel_id', 'role_id',
      'embed_title', 'embed_description', 'embed_color', 'embed_image_url', 'embed_footer',
      'button_label', 'button_emoji',
      'page_heading', 'page_description', 'page_button_label',
      'page_success_heading', 'page_success_message',
      'page_already_verified_message', 'page_not_member_message',
      'min_account_age_days',
    ];
    const data = {};
    for (const k of allowed) if (k in body) data[k] = body[k];
    if ('embed_title' in data) data.embed_title = String(data.embed_title || '').slice(0, 256);
    if ('embed_description' in data) data.embed_description = String(data.embed_description || '').slice(0, 4096);
    if ('embed_footer' in data) data.embed_footer = String(data.embed_footer || '').slice(0, 2048);
    if ('button_label' in data) data.button_label = String(data.button_label || 'Verifica te').slice(0, 80);
    if ('button_emoji' in data) data.button_emoji = String(data.button_emoji || '{wy:success}').slice(0, 64);
    if ('page_heading' in data) data.page_heading = String(data.page_heading || '').slice(0, 256);
    if ('page_description' in data) data.page_description = String(data.page_description || '').slice(0, 1024);
    if ('page_button_label' in data) data.page_button_label = String(data.page_button_label || 'Verifica').slice(0, 80);
    if ('page_success_heading' in data) data.page_success_heading = String(data.page_success_heading || '').slice(0, 256);
    if ('page_success_message' in data) data.page_success_message = String(data.page_success_message || '').slice(0, 1024);
    if ('page_already_verified_message' in data) data.page_already_verified_message = String(data.page_already_verified_message || '').slice(0, 1024);
    if ('page_not_member_message' in data) data.page_not_member_message = String(data.page_not_member_message || '').slice(0, 1024);
    if ('embed_image_url' in data) {
      try { data.embed_image_url = sanitizeImageUrl(data.embed_image_url); }
      catch { return json({ error: 'invalid_image_url', field: 'embed_image_url' }, { status: 400 }); }
    }
    if (data.embed_color != null) {
      const color = String(data.embed_color).trim();
      if (!/^#[0-9a-fA-F]{6}$/.test(color)) return json({ error: 'invalid_color' }, { status: 400 });
      data.embed_color = color;
    }
    if ('enabled' in data) data.enabled = Boolean(data.enabled);
    if ('min_account_age_days' in data) {
      const days = Number(data.min_account_age_days);
      if (!Number.isFinite(days) || days < 0 || days > 365) {
        return json({ error: 'invalid_min_account_age', field: 'min_account_age_days' }, { status: 400 });
      }
      data.min_account_age_days = Math.round(days);
    }
    const badField = await assertChannelFieldsInGuild(guildId, data, ['channel_id']);
    if (badField) return json({ error: 'invalid_channel', field: badField }, { status: 400 });
    if (data.role_id && !(await assertRoleInGuild(guildId, data.role_id))) {
      return json({ error: 'invalid_role', field: 'role_id' }, { status: 400 });
    }
    const savedCaptcha = await upsertOne('captcha_settings', guildId, data, { userId: session?.user?.id });
    if ('enabled' in data) await mirrorModuleState(guildId, 'captcha', data.enabled);
    return json(savedCaptcha);
  }

  if (sub === 'captcha/panel' && method === 'POST') {
    const settings = await findOrDefault('captcha_settings', guildId, { channel_id: null, role_id: null });
    const channelId = settings.channel_id ? String(settings.channel_id) : null;
    if (!channelId) return json({ error: 'missing_channel' }, { status: 400 });
    if (!settings.role_id) return json({ error: 'missing_role' }, { status: 400 });
    if (!(await assertChannelInGuild(guildId, channelId))) return json({ error: 'invalid_channel' }, { status: 400 });
    if (!(await assertRoleInGuild(guildId, settings.role_id))) return json({ error: 'invalid_role' }, { status: 400 });
    const embed = captchaPanelEmbed(settings);
    const components = captchaPanelComponents(settings, guildId);

    const existingMessageId = settings.message_id ? String(settings.message_id) : null;
    let msg = null;
    if (existingMessageId && String(settings.channel_id) === channelId) {
      try {
        msg = await editGuildMessage(channelId, existingMessageId, embedToV2Payload(embed, components));
      } catch {
        msg = null;
      }
    }
    if (!msg) {
      try { msg = await sendGuildMessage(channelId, embedToV2Payload(embed, components)); }
      catch (e) { return json({ error: 'discord_send_failed', detail: String(e.message || e) }, { status: 502 }); }
    }

    const updated = await upsertOne('captcha_settings', guildId, {
      message_id: String(msg.id),
      channel_id: channelId,
      enabled: true,
    });
    await mirrorModuleState(guildId, 'captcha', true);
    return json(updated);
  }

  if (sub === 'automod' && (method === 'PUT' || method === 'PATCH')) {
    const session = await getSession();
    const allowed = ['anti_spam','anti_mention_spam','anti_invite','anti_link','anti_raid','image_scam','image_scam_action',
      'anti_scam_links','bad_words_filter','caps_filter','duplicate_filter','repeated_chars_filter',
      'anti_phishing','message_length_filter','bad_words','spam_threshold','spam_interval',
      'mention_threshold','caps_threshold','duplicate_window','repeated_chars_threshold','max_message_length',
      'raid_join_threshold','raid_window_seconds','raid_new_account_days','strike_enabled','strike_threshold',
      'raid_action','raid_lockdown_minutes','raid_raise_verification','raid_alert_staff','raid_no_avatar',
      'min_account_age_days','new_member_link_minutes','anti_mass_spam','anti_mass_spam_action','new_member_links_action',
      'strike_decay_seconds','default_action','escalation_action','timeout_seconds',
      'bad_words_action','anti_spam_action','anti_link_action','anti_invite_action','anti_mention_spam_action',
      'anti_scam_links_action','caps_filter_action','duplicate_filter_action','repeated_chars_filter_action',
      'anti_phishing_action','message_length_filter_action','allowed_domains','log_channel_id','whitelist_role_ids',
      'warn_message','timeout_message','unmute_message','kick_message','ban_message'];
    const data = {};
    for (const k of allowed) if (k in body) data[k] = body[k];
    const badField = await assertChannelFieldsInGuild(guildId, data, ['log_channel_id']);
    if (badField) return json({ error: 'invalid_channel', field: badField }, { status: 400 });
    if (Array.isArray(data.whitelist_role_ids) && !(await assertRolesInGuild(guildId, data.whitelist_role_ids))) {
      return json({ error: 'invalid_role', field: 'whitelist_role_ids' }, { status: 400 });
    }
    if ('spam_threshold' in data) data.spam_threshold = Math.max(1, Math.min(50, Number(data.spam_threshold) || 5));
    if ('spam_interval' in data) data.spam_interval = Math.max(1, Math.min(60, Number(data.spam_interval) || 5));
    if ('mention_threshold' in data) data.mention_threshold = Math.max(1, Math.min(50, Number(data.mention_threshold) || 5));
    if ('caps_threshold' in data) data.caps_threshold = Math.max(1, Math.min(100, Number(data.caps_threshold) || 70));
    if ('duplicate_window' in data) data.duplicate_window = Math.max(1, Math.min(120, Number(data.duplicate_window) || 10));
    for (const k of ['anti_spam','anti_mention_spam','anti_invite','anti_link','anti_raid','anti_scam_links','bad_words_filter','caps_filter','duplicate_filter','repeated_chars_filter','anti_phishing','message_length_filter','strike_enabled','raid_raise_verification','raid_alert_staff','raid_no_avatar','anti_mass_spam','image_scam']) {
      if (k in data && typeof data[k] !== 'boolean') return json({ error: 'invalid_boolean', field: k }, { status: 400 });
    }
    if ('bad_words' in data) {
      if (!Array.isArray(data.bad_words)) return json({ error: 'invalid_bad_words' }, { status: 400 });
      data.bad_words = [...new Set(data.bad_words.map((x) => String(x).trim()).filter(Boolean))].slice(0, 500).map((x) => x.slice(0, 100));
    }
    if ('allowed_domains' in data) {
      if (!Array.isArray(data.allowed_domains)) return json({ error: 'invalid_domains' }, { status: 400 });
      data.allowed_domains = [...new Set(data.allowed_domains.map((x) => String(x).trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '')).filter(Boolean))].slice(0, 100).map((x) => x.slice(0, 255));
    }
    const actionFields = ['default_action','escalation_action','bad_words_action','anti_spam_action','anti_link_action','anti_invite_action','anti_mention_spam_action','anti_scam_links_action','caps_filter_action','duplicate_filter_action','repeated_chars_filter_action','anti_phishing_action','message_length_filter_action','anti_mass_spam_action','new_member_links_action','image_scam_action'];
    if ('raid_action' in data && !['kick','ban','timeout'].includes(String(data.raid_action))) return json({ error: 'invalid_action', field: 'raid_action' }, { status: 400 });
    for (const k of actionFields) if (k in data && !['delete','warn','timeout','kick','ban'].includes(String(data[k]))) return json({ error: 'invalid_action', field: k }, { status: 400 });
    for (const [k, min, max, fallback] of [['repeated_chars_threshold',3,30,8],['max_message_length',100,4000,2000],['raid_join_threshold',3,100,10],['raid_window_seconds',10,300,60],['raid_new_account_days',1,365,7],['raid_lockdown_minutes',1,120,10],['strike_threshold',1,20,3],['strike_decay_seconds',60,86400,3600],['timeout_seconds',10,2419200,60]]) {
      if (k in data) data[k] = Math.max(min, Math.min(max, Number(data[k]) || fallback));
    }
    for (const [k, max] of [['min_account_age_days', 365], ['new_member_link_minutes', 1440]]) {
      if (k in data) { const n = Number(data[k]); data[k] = Number.isFinite(n) ? Math.max(0, Math.min(max, Math.round(n))) : 0; }
    }
    for (const k of ['warn_message', 'timeout_message', 'unmute_message', 'kick_message', 'ban_message']) {
      if (k in data) data[k] = String(data[k] || '').slice(0, 1000);
    }
    return json(await upsertOne('automod_settings', guildId, data, { userId: session?.user?.id }));
  }

  if (sub === 'reaction_roles' && method === 'POST') {
    const title = String(body.title || '').slice(0, 256);
    const description = String(body.description || '').slice(0, 2000);
    const mode = ['normal', 'toggle', 'unique', 'verify'].includes(body.mode) ? body.mode : 'toggle';
    const type = body.type === 'button' ? 'button' : 'emoji';
    const channelId = body.channel_id ? String(body.channel_id) : null;

    let entries = Array.isArray(body.entries)
      ? body.entries.map((e) => ({
          emoji: String(e.emoji || '').trim(),
          role_id: e.role_id ? String(e.role_id).trim() : null,
          label: String(e.label || '').trim().slice(0, 80),
        }))
      : [];

    if (type === 'emoji') {
      entries = entries
        .filter((e) => e.emoji && e.role_id)
        .map((e) => ({ emoji: e.emoji, role_id: e.role_id }));
    } else {
      entries = entries.filter((e) => e.emoji || e.label);
      if (entries.length > 10) {
        return json({ error: 'too_many_buttons', detail: 'A button panel can contain at most 10 buttons.' }, { status: 400 });
      }
      entries = entries.map((e) => ({
        emoji: e.emoji || null,
        label: e.label || null,
        role_id: e.role_id || null,
      }));
    }

    if (!channelId) return json({ error: 'missing_channel' }, { status: 400 });
    if (!title) return json({ error: 'missing_title' }, { status: 400 });
    if (entries.length === 0) return json({ error: 'missing_entries' }, { status: 400 });
    if (!(await assertChannelInGuild(guildId, channelId))) {
      return json({ error: 'invalid_channel' }, { status: 400 });
    }

    const roleIds = entries.map((e) => e.role_id).filter(Boolean);
    if (!(await assertRolesInGuild(guildId, roleIds))) {
      return json({ error: 'invalid_role' }, { status: 400 });
    }

    const premiumForRRLimit = await isGuildPremium(db, gidLong);
    const reactionPanelLimit = premiumForRRLimit ? PREMIUM_UNLIMITED : FREE_REACTION_PANEL_LIMIT;
    const activeReactionPanels = await db.collection('reaction_roles').countDocuments({ guild_id: gidLong });
    if (activeReactionPanels >= reactionPanelLimit) {
      return json({
        error: 'reaction_limit',
        limit: reactionPanelLimit,
        is_premium: premiumForRRLimit,
        detail: premiumForRRLimit
          ? `This server can have at most ${reactionPanelLimit} reaction role panels.`
          : `This server can have at most ${reactionPanelLimit} reaction role panels. Premium servers have no limit.`,
      }, { status: 429 });
    }
    const latestReactionPanel = await db.collection('reaction_roles')
      .find({ guild_id: gidLong })
      .sort({ created_at: -1 })
      .limit(1)
      .next();
    if (latestReactionPanel?.created_at) {
      const remainingMs = 10 * 60 * 1000 - (Date.now() - new Date(latestReactionPanel.created_at).getTime());
      if (remainingMs > 0) {
        return json({
          error: 'reaction_cooldown',
          retry_after: Math.ceil(remainingMs / 1000),
          detail: `Please wait ${Math.ceil(remainingMs / 60000)} minute(s) before creating another reaction role panel.`,
        }, { status: 429 });
      }
    }

    let payload;
    if (type === 'emoji') {
      const fullDescription = [
        description,
        entries.map((e) => `${e.emoji} → <@&${e.role_id}>`).join('\n'),
      ].filter(Boolean).join('\n\n');

      payload = embedToV2Payload({ title, description: fullDescription, color: 0xe08a4e });
    } else {
      const buttons = entries.map((e, index) => ({
        type: 2,
        style: 1,
        custom_id: `wody_rr:button:${index}`,
        ...(e.label ? { label: e.label } : {}),
        ...(e.emoji ? { emoji: buttonEmojiPayload(e.emoji) } : {}),
      }));

      const rows = [];
      for (let i = 0; i < buttons.length; i += 5) {
        rows.push({ type: 1, components: buttons.slice(i, i + 5) });
      }

      payload = embedToV2Payload({ title, description, color: 0xe08a4e }, rows);
    }

    let msg;
    try {
      msg = await sendGuildMessage(channelId, payload);
    } catch (e) {
      return json({ error: 'discord_send_failed', detail: String(e.message || e) }, { status: 502 });
    }

    if (type === 'emoji') {
      for (const e of entries) {
        await addMessageReaction(channelId, msg.id, e.emoji).catch(() => {});
      }
    }

    const doc = {
      guild_id: gidLong,
      channel_id: toLong(channelId),
      message_id: toLong(msg.id),
      type,
      mode,
      entries: type === 'button'
        ? entries.map((e) => ({
            emoji: e.emoji,
            label: e.label,
            role_id: e.role_id ? toLong(e.role_id) : null,
          }))
        : entries.map((e) => ({ emoji: e.emoji, role_id: toLong(e.role_id) })),
      created_at: new Date(),
    };

    const r = await db.collection('reaction_roles').insertOne(doc);
    return json(serializeDoc({ ...doc, _id: r.insertedId }));
  }

  const rrDel = sub.match(/^reaction_roles\/([\w-]+)$/);
  if (rrDel && method === 'DELETE') {
    const { ObjectId } = await import('mongodb');
    let objId;
    try { objId = new ObjectId(rrDel[1]); } catch { return json({ error: 'invalid_id' }, { status: 400 }); }
    const doc = await db.collection('reaction_roles').findOne({ _id: objId, guild_id: gidLong });
    await db.collection('reaction_roles').deleteOne({ _id: objId, guild_id: gidLong });
    if (doc) {
      await deleteGuildMessage(String(doc.channel_id), String(doc.message_id)).catch(() => {});
    }
    return json({ ok: true });
  }

  if (sub === 'giveaways' && method === 'POST') {
    const session = await getSession();
    const prize = String(body.prize || '').slice(0, 200);
    const channelId = body.channel_id ? String(body.channel_id) : null;
    const winnersCount = Math.max(1, Math.min(20, Number(body.winners_count) || 1));
    const minutes = Math.max(1, Math.min(60 * 24 * 30, Number(body.duration_minutes) || 0));
    const mentionRoleIds = Array.isArray(body.mention_role_ids)
      ? Array.from(new Set(body.mention_role_ids.map((r) => String(r || '').trim()).filter(Boolean)))
      : [];
    const blockedRoleIds = Array.isArray(body.blocked_role_ids)
      ? Array.from(new Set(body.blocked_role_ids.map((r) => String(r || '').trim()).filter(Boolean)))
      : [];
    const allowedRoleIds = Array.isArray(body.allowed_role_ids)
      ? Array.from(new Set(body.allowed_role_ids.map((r) => String(r || '').trim()).filter(Boolean)))
      : [];
    const roleWeights = {};
    if (body.role_weights && typeof body.role_weights === 'object' && !Array.isArray(body.role_weights)) {
      for (const [roleId, w] of Object.entries(body.role_weights)) {
        const id = String(roleId || '').trim();
        const weight = Number(w);
        if (!id || !Number.isFinite(weight)) continue;
        roleWeights[id] = Math.max(1, Math.min(10, Math.round(weight)));
      }
    }
    const roleWeightIds = Object.keys(roleWeights);

    if (!channelId) return json({ error: 'missing_channel' }, { status: 400 });
    if (!prize) return json({ error: 'missing_prize' }, { status: 400 });
    if (!body.duration_minutes) return json({ error: 'missing_duration' }, { status: 400 });

    const premiumForGiveawayLimit = await isGuildPremium(db, gidLong);
    const giveawayLimit = premiumForGiveawayLimit
      ? PREMIUM_UNLIMITED
      : FREE_GIVEAWAY_LIMIT;
    const activeGiveawayCount = await db.collection('giveaways').countDocuments({
      guild_id: gidLong,
      ended: { $ne: true },
    });
    if (activeGiveawayCount >= giveawayLimit) {
      return json({
        error: 'giveaway_limit',
        limit: giveawayLimit,
        is_premium: premiumForGiveawayLimit,
        detail: premiumForGiveawayLimit
          ? `This server can have at most ${giveawayLimit} active giveaways.`
          : `This server can have at most ${giveawayLimit} active giveaways. Premium servers have no limit.`,
      }, { status: 429 });
    }
    if (blockedRoleIds.length > 0 && allowedRoleIds.length > 0) {
      return json({ error: 'blocked_and_allowed_roles_conflict', detail: 'You cannot use blocked roles and allowed roles on the same giveaway.' }, { status: 400 });
    }
    if (!(await assertChannelInGuild(guildId, channelId))) {
      return json({ error: 'invalid_channel' }, { status: 400 });
    }
    for (const [field, ids] of [
      ['mention_role_ids', mentionRoleIds],
      ['blocked_role_ids', blockedRoleIds],
      ['allowed_role_ids', allowedRoleIds],
      ['role_weights', roleWeightIds],
    ]) {
      if (ids.length && !(await assertRolesInGuild(guildId, ids))) {
        return json({ error: 'invalid_role', field }, { status: 400 });
      }
    }

    const endTime = new Date(Date.now() + minutes * 60 * 1000);
    const endTs = Math.floor(endTime.getTime() / 1000);

    const mentionContent = mentionRoleIds.map((id) => `<@&${id}>`).join(' ');
    const blockedNote = blockedRoleIds.length
      ? `\n\n{wy:ban} Not open to: ${blockedRoleIds.map((id) => `<@&${id}>`).join(', ')}`
      : '';
    const allowedNote = allowedRoleIds.length
      ? `\n\n{wy:lock} Only members with: ${allowedRoleIds.map((id) => `<@&${id}>`).join(', ')} can enter.`
      : '';

    let msg;
    try {
      const enterRow = [{
        type: 1,
        components: [{ type: 2, style: 1, custom_id: 'wody:giveaway:enter', label: 'Enter', emoji: { name: '{wy:giveaway}' } }],
      }];
      const giveawayEmbed = {
        title: '{wy:giveaway} Giveaway!',
        description: `Prize: **${prize}**\nWinners: **${winnersCount}**\nEnds: <t:${endTs}:R>\n\nClick **Enter** to participate.${blockedNote}${allowedNote}`,
        color: 0xe08a4e,
      };
      msg = await sendGuildMessage(channelId, {
        ...embedToV2Payload(giveawayEmbed, enterRow, mentionContent || null),
        allowed_mentions: { roles: mentionRoleIds },
      });
    } catch (e) {
      return json({ error: 'discord_send_failed', detail: String(e.message || e) }, { status: 502 });
    }

    const doc = {
      guild_id: gidLong,
      channel_id: toLong(channelId),
      message_id: toLong(msg.id),
      prize,
      winners_count: winnersCount,
      end_time: endTime,
      host_id: toLong(session?.user?.id) || Long.ZERO,
      mention_role_ids: mentionRoleIds.map((id) => toLong(id)),
      blocked_role_ids: blockedRoleIds.map((id) => toLong(id)),
      allowed_role_ids: allowedRoleIds.map((id) => toLong(id)),
      role_weights: roleWeights,
      participants: [],
      ended: false,
      created_at: new Date(),
    };
    const r = await db.collection('giveaways').insertOne(doc);
    return json(serializeDoc({ ...doc, _id: r.insertedId }));
  }

  const gwEnd = sub.match(/^giveaways\/([\w-]+)\/end$/);
  if (gwEnd && method === 'POST') {
    const { ObjectId } = await import('mongodb');
    let objId;
    try { objId = new ObjectId(gwEnd[1]); } catch { return json({ error: 'invalid_id' }, { status: 400 }); }
    const doc = await db.collection('giveaways').findOne({ _id: objId, guild_id: gidLong });
    if (!doc) return json({ error: 'not_found' }, { status: 404 });
    if (doc.ended) return json({ error: 'already_ended' }, { status: 400 });
    await db.collection('giveaways').updateOne({ _id: objId, guild_id: gidLong }, { $set: { end_time: new Date(Date.now() - 1000) } });
    return json({ ok: true, note: 'Will be ended by the bot within ~15 seconds.' });
  }

  const gwReroll = sub.match(/^giveaways\/([\w-]+)\/reroll$/);
  if (gwReroll && method === 'POST') {
    const { ObjectId } = await import('mongodb');
    let objId;
    try { objId = new ObjectId(gwReroll[1]); } catch { return json({ error: 'invalid_id' }, { status: 400 }); }
    const doc = await db.collection('giveaways').findOne({ _id: objId, guild_id: gidLong });
    if (!doc) return json({ error: 'not_found' }, { status: 404 });
    if (!doc.ended) return json({ error: 'not_ended' }, { status: 400 });
    const participants = (doc.participants || []).map(String);
    if (participants.length === 0) return json({ error: 'no_participants' }, { status: 400 });
    const winner = await weightedPick(guildId, participants, doc.role_weights);
    try {
      const viewRows = doc.message_id
        ? [{ type: 1, components: [{ type: 2, style: 5, label: 'View giveaway', url: `https://discord.com/channels/${guildId}/${String(doc.channel_id)}/${String(doc.message_id)}` }] }]
        : [];
      await sendGuildMessage(String(doc.channel_id), embedToV2Payload({ title: '{wy:giveaway} Reroll winner', description: `Congrats <@${winner}>!`, color: 0xe08a4e }, viewRows));
    } catch (e) {
      return json({ error: 'discord_send_failed', detail: String(e.message || e) }, { status: 502 });
    }
    return json({ ok: true, winner });
  }

  const gwDel = sub.match(/^giveaways\/([\w-]+)$/);
  if (gwDel && method === 'DELETE') {
    const { ObjectId } = await import('mongodb');
    let objId;
    try { objId = new ObjectId(gwDel[1]); } catch { return json({ error: 'invalid_id' }, { status: 400 }); }
    const doc = await db.collection('giveaways').findOne({ _id: objId, guild_id: gidLong });
    if (doc && !doc.ended) {
      await editGuildMessage(String(doc.channel_id), String(doc.message_id),
        embedToV2Payload({ title: '{wy:giveaway} Giveaway cancelled', description: `~~Prize: ${doc.prize}~~`, color: 0x808080 })
      ).catch(() => {});
    }
    await db.collection('giveaways').deleteOne({ _id: objId, guild_id: gidLong });
    return json({ ok: true });
  }

  if (sub === 'auto_responses' && method === 'POST') {
    const session = await getSession();
    const SNOWFLAKE_RE = /^\d{15,25}$/;
    const sanitizeIds = (v) => (Array.isArray(v) ? v.map(String).filter((s) => SNOWFLAKE_RE.test(s)).slice(0, 25) : []);
    const item = {
      guild_id: gidLong,
      trigger: String(body.trigger || '').slice(0, 200),
      response: String(body.response || '').slice(0, 2000),
      exact_match: !!body.exact_match,
      wildcard: !!body.wildcard,
      allowed_channel_ids: sanitizeIds(body.allowed_channel_ids),
      ignored_channel_ids: sanitizeIds(body.ignored_channel_ids),
      allowed_role_ids: sanitizeIds(body.allowed_role_ids),
      ignored_role_ids: sanitizeIds(body.ignored_role_ids),
      created_by: toLong(session?.user?.id) || Long.ZERO,
      created_at: new Date(),
    };
    if (!item.trigger || !item.response) return json({ error: 'invalid' }, { status: 400 });
    const premiumForARLimit = await isGuildPremium(db, gidLong);
    const arLimit = premiumForARLimit ? PREMIUM_UNLIMITED : FREE_AUTO_RESPONSE_LIMIT;
    const currentARCount = await db.collection('auto_responses').countDocuments({ guild_id: gidLong });
    if (currentARCount >= arLimit) {
      return json({
        error: 'auto_response_limit',
        limit: arLimit,
        is_premium: premiumForARLimit,
        detail: premiumForARLimit
          ? `This server can have at most ${arLimit} auto responses.`
          : `This server can have at most ${arLimit} auto responses. Premium servers have no limit.`,
      }, { status: 429 });
    }
    const r = await db.collection('auto_responses').insertOne(item);
    return json(serializeDoc({ ...item, _id: r.insertedId }));
  }
  const arDel = sub.match(/^auto_responses\/([\w-]+)$/);
  if (arDel && method === 'DELETE') {
    const { ObjectId } = await import('mongodb');
    let objId;
    try { objId = new ObjectId(arDel[1]); } catch { return json({ error: 'invalid_id' }, { status: 400 }); }
    const result = await db.collection('auto_responses').deleteOne({ _id: objId, guild_id: gidLong });
    if (result.deletedCount === 0) return json({ error: 'not_found' }, { status: 404 });
    return json({ ok: true });
  }

function parseCustomCommandRestrictions(raw) {
  if (raw == null) return {};
  if (typeof raw !== 'object' || Array.isArray(raw)) return null;
  const out = {};
  for (const key of ['allowed_channel_ids', 'blocked_channel_ids']) {
    if (Array.isArray(raw[key])) out[key] = raw[key].map(String).filter(Boolean).slice(0, 50);
  }
  for (const key of ['required_role_ids', 'blocked_role_ids']) {
    if (Array.isArray(raw[key])) out[key] = raw[key].map(String).filter(Boolean).slice(0, 25);
  }
  if (raw.cooldown_seconds !== undefined) {
    const n = Number(raw.cooldown_seconds);
    out.cooldown_seconds = Number.isFinite(n) ? Math.max(0, Math.min(86400, Math.trunc(n))) : 0;
  }
  for (const key of ['channel_message', 'permission_message', 'cooldown_message']) {
    if (raw[key] !== undefined) out[key] = String(raw[key] || '').slice(0, 300);
  }
  return out;
}

async function assertCustomCommandRestrictionsValid(guildId, restrictions) {
  if (!restrictions) return null;
  const channelIds = [...(restrictions.allowed_channel_ids || []), ...(restrictions.blocked_channel_ids || [])];
  if (channelIds.length && !(await assertChannelsInGuild(guildId, channelIds))) return 'restrictions.channel_ids';
  const roleIds = [...(restrictions.required_role_ids || []), ...(restrictions.blocked_role_ids || [])];
  if (roleIds.length && !(await assertRolesInGuild(guildId, roleIds))) return 'restrictions.role_ids';
  return null;
}

const LEVEL_REWARDS_MAX = 50;
const LEVEL_ROLE_BONUSES_MAX = 25;
const LEVEL_ID_RE = /^[A-Za-z0-9_-]{1,40}$/;

function strictInt(v) {
  if (typeof v === 'number') return Number.isInteger(v) ? v : null;
  if (typeof v === 'string' && /^-?\d{1,9}$/.test(v.trim())) return Number(v.trim());
  return null;
}

function parseLevelRewards(raw) {
  if (!Array.isArray(raw)) return { error: 'invalid_level_rewards' };
  if (raw.length > LEVEL_REWARDS_MAX) return { error: 'too_many_level_rewards', limit: LEVEL_REWARDS_MAX };
  const out = [];
  const ids = new Set();
  for (const item of raw) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return { error: 'invalid_level_rewards' };
    const id = String(item.id ?? '');
    const level = strictInt(item.level);
    const bonus = item.bonus_xp === undefined || item.bonus_xp === null || item.bonus_xp === '' ? 0 : strictInt(item.bonus_xp);
    const roleId = item.role_id ? String(item.role_id) : null;
    if (!LEVEL_ID_RE.test(id) || ids.has(id)) return { error: 'invalid_level_rewards' };
    if (level === null || level < 1 || level > 1000) return { error: 'invalid_level', field: 'level' };
    if (bonus === null || bonus < 0 || bonus > 1000000) return { error: 'invalid_bonus_xp', field: 'bonus_xp' };
    if (roleId && !/^\d{5,25}$/.test(roleId)) return { error: 'invalid_role', field: 'role_id' };
    if (!roleId && bonus === 0) return { error: 'reward_empty', field: 'role_id' };
    ids.add(id);
    out.push({
      id, level, role_id: roleId, bonus_xp: bonus,
      name: String(item.name ?? '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 60) || `Level ${level}`,
      description: String(item.description ?? '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 200),
      enabled: item.enabled !== false,
    });
  }
  out.sort((a, b) => a.level - b.level || a.id.localeCompare(b.id));
  return { value: out };
}

function parseLevelRoleBonuses(raw) {
  if (!Array.isArray(raw)) return { error: 'invalid_level_role_bonuses' };
  if (raw.length > LEVEL_ROLE_BONUSES_MAX) return { error: 'too_many_level_role_bonuses', limit: LEVEL_ROLE_BONUSES_MAX };
  const out = [];
  const ids = new Set();
  const roles = new Set();
  for (const item of raw) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return { error: 'invalid_level_role_bonuses' };
    const id = String(item.id ?? '');
    const roleId = String(item.role_id ?? '');
    const mult = item.multiplier === undefined || item.multiplier === null || item.multiplier === '' ? 1 : Number(item.multiplier);
    const flat = item.flat_xp === undefined || item.flat_xp === null || item.flat_xp === '' ? 0 : strictInt(item.flat_xp);
    const priority = item.priority === undefined || item.priority === null || item.priority === '' ? 0 : strictInt(item.priority);
    if (!LEVEL_ID_RE.test(id) || ids.has(id)) return { error: 'invalid_level_role_bonuses' };
    if (!/^\d{5,25}$/.test(roleId)) return { error: 'invalid_role', field: 'role_id' };
    if (roles.has(roleId)) return { error: 'duplicate_bonus_role', field: 'role_id' };
    if (!Number.isFinite(mult) || mult < 1 || mult > 10) return { error: 'invalid_multiplier', field: 'multiplier' };
    if (flat === null || flat < 0 || flat > 1000) return { error: 'invalid_flat_xp', field: 'flat_xp' };
    if (priority === null || priority < 0 || priority > 1000) return { error: 'invalid_priority', field: 'priority' };
    const multiplier = Math.round(mult * 100) / 100;
    if (multiplier === 1 && flat === 0) return { error: 'bonus_empty', field: 'multiplier' };
    ids.add(id);
    roles.add(roleId);
    out.push({ id, role_id: roleId, multiplier, flat_xp: flat, priority, enabled: item.enabled !== false });
  }
  out.sort((a, b) => b.priority - a.priority || b.multiplier - a.multiplier);
  return { value: out };
}

const CC_NICK_EMOJI_RE = /^(?:\p{Regional_Indicator}{2}|[0-9#*]\uFE0F?\u20E3|\p{Extended_Pictographic}(?:\uFE0F|\p{Emoji_Modifier})?[\u{E0020}-\u{E007F}]*(?:\u200D\p{Extended_Pictographic}(?:\uFE0F|\p{Emoji_Modifier})?)*\uFE0F?)$/u;
const CC_MAX_REWARD_ROLES = 5;
const CC_MAX_NICK_EMOJIS = 6;
const CC_NICK_POSITIONS = ['before', 'after', 'random'];
function parseCustomCommandRewards(raw) {
  if (raw == null) return { role_enabled: false, role_ids: [], emoji_enabled: false, nickname_emojis: [], nickname_position: 'before' };
  if (typeof raw !== 'object' || Array.isArray(raw)) return null;
  const roleIds = [];
  if (raw.role_ids !== undefined) {
    if (!Array.isArray(raw.role_ids)) return null;
    for (const id of raw.role_ids) {
      const v = String(id || '').trim();
      if (v && !roleIds.includes(v)) roleIds.push(v);
    }
    if (roleIds.length > CC_MAX_REWARD_ROLES) return null;
  }
  const emojis = [];
  if (raw.nickname_emojis !== undefined) {
    if (!Array.isArray(raw.nickname_emojis)) return null;
    for (const e of raw.nickname_emojis) {
      const v = String(e || '').trim();
      if (!v) continue;
      if (!CC_NICK_EMOJI_RE.test(v)) return null;
      if (!emojis.includes(v)) emojis.push(v);
    }
    if (emojis.length > CC_MAX_NICK_EMOJIS) return null;
  }
  const position = raw.nickname_position === undefined ? 'before' : String(raw.nickname_position);
  if (!CC_NICK_POSITIONS.includes(position)) return null;
  const roleEnabled = raw.role_enabled === undefined ? roleIds.length > 0 : !!raw.role_enabled;
  const emojiEnabled = raw.emoji_enabled === undefined ? emojis.length > 0 : !!raw.emoji_enabled;
  return { role_enabled: roleEnabled && roleIds.length > 0, role_ids: roleIds, emoji_enabled: emojiEnabled && emojis.length > 0, nickname_emojis: emojis, nickname_position: position };
}

async function assertCustomCommandRewardRolesValid(guildId, rewards) {
  if (!rewards || !rewards.role_ids.length) return null;
  try {
    const roles = await getGuildRoles(guildId);
    const byId = new Map((roles || []).map((r) => [String(r.id), r]));
    for (const id of rewards.role_ids) {
      const r = byId.get(String(id));
      if (!r || String(id) === String(guildId) || r.managed) return 'rewards.role_ids';
    }
  } catch {
    return 'rewards.role_ids';
  }
  return null;
}

  if (sub === 'custom_commands' && method === 'POST') {
    const session = await getSession();
    const rewards = parseCustomCommandRewards(body.rewards);
    if (rewards === null) return json({ error: 'invalid_rewards' }, { status: 400 });
    const badReward = await assertCustomCommandRewardRolesValid(guildId, rewards);
    if (badReward) return json({ error: 'invalid_role_or_channel', field: badReward }, { status: 400 });
    const restrictions = parseCustomCommandRestrictions(body.restrictions);
    if (restrictions === null) return json({ error: 'invalid_restrictions' }, { status: 400 });
    const badRestriction = await assertCustomCommandRestrictionsValid(guildId, restrictions);
    if (badRestriction) return json({ error: 'invalid_role_or_channel', field: badRestriction }, { status: 400 });
    const item = {
      guild_id: gidLong,
      name: String(body.name || '').toLowerCase().slice(0, 32),
      response: String(body.response || '').slice(0, 2000),
      restrictions,
      rewards,
      delete_trigger: !!body.delete_trigger,
      enabled: true,
      created_by: toLong(session?.user?.id) || Long.ZERO,
      created_at: new Date(),
    };
    if (!item.name || !item.response) return json({ error: 'invalid' }, { status: 400 });
    const premiumForCCLimit = await isGuildPremium(db, gidLong);
    const ccLimit = premiumForCCLimit ? PREMIUM_UNLIMITED : FREE_CUSTOM_COMMAND_LIMIT;
    const currentCCCount = await db.collection('custom_commands').countDocuments({ guild_id: gidLong });
    if (currentCCCount >= ccLimit) {
      return json({
        error: 'custom_command_limit',
        limit: ccLimit,
        is_premium: premiumForCCLimit,
        detail: premiumForCCLimit
          ? `This server can have at most ${ccLimit} custom commands.`
          : `This server can have at most ${ccLimit} custom commands. Premium servers have no limit.`,
      }, { status: 429 });
    }
    const r = await db.collection('custom_commands').insertOne(item);
    return json(serializeDoc({ ...item, _id: r.insertedId }));
  }
  const ccEdit = sub.match(/^custom_commands\/([\w-]+)$/);
  if (ccEdit && (method === 'PUT' || method === 'PATCH')) {
    const { ObjectId } = await import('mongodb');
    let objId;
    try { objId = new ObjectId(ccEdit[1]); } catch { return json({ error: 'invalid_id' }, { status: 400 }); }
    const existing = await db.collection('custom_commands').findOne({ _id: objId, guild_id: gidLong });
    if (!existing) return json({ error: 'not_found' }, { status: 404 });
    const patch = {};
    if ('response' in body) {
      patch.response = String(body.response || '').slice(0, 2000);
      if (!patch.response) return json({ error: 'invalid' }, { status: 400 });
    }
    if ('enabled' in body) patch.enabled = !!body.enabled;
    if ('delete_trigger' in body) patch.delete_trigger = !!body.delete_trigger;
    if ('restrictions' in body) {
      const restrictions = parseCustomCommandRestrictions(body.restrictions);
      if (restrictions === null) return json({ error: 'invalid_restrictions' }, { status: 400 });
      const badRestriction = await assertCustomCommandRestrictionsValid(guildId, restrictions);
      if (badRestriction) return json({ error: 'invalid_role_or_channel', field: badRestriction }, { status: 400 });
      patch.restrictions = restrictions;
    }
    if ('rewards' in body) {
      const rewards = parseCustomCommandRewards(body.rewards);
      if (rewards === null) return json({ error: 'invalid_rewards' }, { status: 400 });
      const badReward = await assertCustomCommandRewardRolesValid(guildId, rewards);
      if (badReward) return json({ error: 'invalid_role_or_channel', field: badReward }, { status: 400 });
      patch.rewards = rewards;
    }
    if (Object.keys(patch).length === 0) return json(serializeDoc(existing));
    await db.collection('custom_commands').updateOne({ _id: objId }, { $set: patch });
    return json(serializeDoc({ ...existing, ...patch }));
  }
  const ccDel = sub.match(/^custom_commands\/([\w-]+)$/);
  if (ccDel && method === 'DELETE') {
    const { ObjectId } = await import('mongodb');
    let objId;
    try { objId = new ObjectId(ccDel[1]); } catch { return json({ error: 'invalid_id' }, { status: 400 }); }
    const result = await db.collection('custom_commands').deleteOne({ _id: objId, guild_id: gidLong });
    if (result.deletedCount === 0) return json({ error: 'not_found' }, { status: 404 });
    return json({ ok: true });
  }

  if (sub === 'forums' && method === 'POST') {
    const session = await getSession();
    if (!session?.user) return json({ error: 'unauthenticated' }, { status: 401 });

    const channelId = body.channel_id ? String(body.channel_id) : null;
    if (!channelId) return json({ error: 'missing_channel' }, { status: 400 });

    const channels = await getGuildChannels(guildId);
    const forum = (channels || []).find((channel) =>
      String(channel.id) === channelId && Number(channel.type) === 15
    );
    if (!forum) return json({ error: 'invalid_forum_channel' }, { status: 400 });

    const premium = await isGuildPremium(db, gidLong);
    const limit = premium ? PREMIUM_UNLIMITED : FREE_FORUM_LIMIT;
    const existing = await db.collection('forums').findOne({
      guild_id: gidLong,
      channel_id: toLong(channelId),
    });
    if (!existing) {
      const configuredCount = await db.collection('forums').countDocuments({ guild_id: gidLong });
      if (configuredCount >= limit) {
        return json({
          error: 'forum_limit',
          limit,
          is_premium: premium,
          detail: premium
            ? `This server can configure up to ${limit} forum channels.`
            : `This server can configure up to ${limit} forum channel. Premium removes this limit.`,
        }, { status: 429 });
      }
    }

    const validTagIds = new Set((forum.available_tags || []).map((tag) => String(tag.id)));
    const defaultTagIds = Array.isArray(body.default_tag_ids)
      ? [...new Set(body.default_tag_ids.map(String).filter((id) => validTagIds.has(id)))].slice(0, 5)
      : [];

    const autoArchiveMinutes = [60, 1440, 4320, 10080].includes(Number(body.auto_archive_minutes))
      ? Number(body.auto_archive_minutes)
      : 1440;
    const requestedCooldown = Number(body.cooldown_seconds) || (premium ? 30 : 60);
    const minCooldown = premium ? 15 : 30;
    const cooldownSeconds = Math.max(minCooldown, Math.min(3600, requestedCooldown));

    const logChannelId = body.log_channel_id ? String(body.log_channel_id) : null;
    if (logChannelId && !(await assertChannelInGuild(guildId, logChannelId))) {
      return json({ error: 'invalid_channel', field: 'log_channel_id' }, { status: 400 });
    }

    const item = {
      guild_id: gidLong,
      channel_id: toLong(channelId),
      enabled: body.enabled !== false,
      log_channel_id: logChannelId ? toLong(logChannelId) : null,
      cooldown_seconds: cooldownSeconds,
      auto_archive_minutes: autoArchiveMinutes,
      default_tag_ids: defaultTagIds.map(toLong),
      updated_by: toLong(session.user.id) || Long.ZERO,
      updated_at: new Date(),
    };

    if (existing) {
      await db.collection('forums').updateOne(
        { _id: existing._id, guild_id: gidLong },
        { $set: item },
      );
      return json(serializeDoc(await db.collection('forums').findOne({ _id: existing._id, guild_id: gidLong })));
    }

    item.created_at = new Date();
    const created = await db.collection('forums').insertOne(item);
    return json(serializeDoc({ ...item, _id: created.insertedId }));
  }

  const forumDelete = sub.match(/^forums\/([\w-]+)$/);
  if (forumDelete && method === 'DELETE') {
    const { ObjectId } = await import('mongodb');
    let objId;
    try { objId = new ObjectId(forumDelete[1]); } catch { return json({ error: 'invalid_id' }, { status: 400 }); }
    const result = await db.collection('forums').deleteOne({ _id: objId, guild_id: gidLong });
    if (result.deletedCount === 0) return json({ error: 'not_found' }, { status: 404 });
    return json({ ok: true });
  }

  if (sub === 'scheduled_messages' && method === 'POST') {
    const session = await getSession();
    const channelId = body.channel_id ? String(body.channel_id) : null;
    const content = String(body.content || '').slice(0, 2000);
    const embed = (body.embed && typeof body.embed === 'object' && Object.keys(body.embed).length) ? body.embed : null;
    const repeat = ['once', 'daily', 'weekly', 'interval'].includes(body.repeat) ? body.repeat : 'once';
    const intervalMinutes = repeat === 'interval' ? Math.max(1, Number(body.interval_minutes) || 60) : null;
    const sendAt = body.send_at ? new Date(body.send_at) : null;
    const mentionRoleIds = Array.isArray(body.mention_role_ids) ? body.mention_role_ids.map(String).slice(0, 25) : [];

    if (!channelId) return json({ error: 'missing_channel' }, { status: 400 });

    const premiumForScheduledLimit = await isGuildPremium(db, gidLong);
    const scheduledLimit = premiumForScheduledLimit
      ? PREMIUM_UNLIMITED
      : FREE_SCHEDULED_MESSAGE_LIMIT;
    const activeScheduledCount = await db.collection('scheduled_messages').countDocuments({
      guild_id: gidLong,
      active: true,
    });
    if (activeScheduledCount >= scheduledLimit) {
      return json({
        error: 'scheduled_message_limit',
        limit: scheduledLimit,
        is_premium: premiumForScheduledLimit,
        detail: premiumForScheduledLimit
          ? `This server can have at most ${scheduledLimit} active scheduled messages.`
          : `This server can have at most ${scheduledLimit} active scheduled messages. Premium servers have no limit.`,
      }, { status: 429 });
    }
    if (!content && !embed) return json({ error: 'missing_content' }, { status: 400 });
    if (embed && !embed.title && !embed.description && !embed.image && !embed.thumbnail) {
      return json({ error: 'invalid_embed' }, { status: 400 });
    }
    if (embed && embed.image && embed.image.url) {
      try { embed.image.url = sanitizeImageUrl(embed.image.url); }
      catch { return json({ error: 'invalid_image_url' }, { status: 400 }); }
    }
    if (embed && embed.thumbnail && embed.thumbnail.url) {
      try { embed.thumbnail.url = sanitizeImageUrl(embed.thumbnail.url); }
      catch { return json({ error: 'invalid_image_url', field: 'thumbnail' }, { status: 400 }); }
    }
    if (!sendAt || isNaN(sendAt.getTime())) return json({ error: 'missing_send_at' }, { status: 400 });
    let scheduledButtons = [];
    if (body.advanced && typeof body.advanced === 'object') {
      const adv = parseAdvancedEmbed(body.advanced, { content, embed });
      if (adv.error) return json({ error: adv.error }, { status: 400 });
      if (embed) {
        if (adv.author) embed.author = { name: adv.author };
        if (adv.fields.length) embed.fields = adv.fields;
      }
      scheduledButtons = adv.buttons;
    }
    if (!(await assertChannelInGuild(guildId, channelId))) {
      return json({ error: 'invalid_channel' }, { status: 400 });
    }
    if (mentionRoleIds.length && !(await assertRolesInGuild(guildId, mentionRoleIds))) {
      return json({ error: 'invalid_role', field: 'mention_role_ids' }, { status: 400 });
    }

    const doc = {
      guild_id: gidLong,
      channel_id: toLong(channelId),
      content: content || null,
      embed,
      buttons: scheduledButtons,
      repeat,
      interval_minutes: intervalMinutes,
      mention_role_ids: mentionRoleIds.map(toLong),
      next_run: sendAt,
      active: true,
      created_by: toLong(session?.user?.id) || Long.ZERO,
      created_at: new Date(),
    };
    const r = await db.collection('scheduled_messages').insertOne(doc);
    return json(serializeDoc({ ...doc, _id: r.insertedId }));
  }

  if (/^scheduled_messages\/[\w-]+$/.test(sub) && (method === 'PUT' || method === 'PATCH')) {
    return json({ error: 'locked_after_send', detail: 'Scheduled messages cannot be edited. Cancel it and create a new one.' }, { status: 405 });
  }

  const smDel = sub.match(/^scheduled_messages\/([\w-]+)$/);
  if (smDel && method === 'DELETE') {
    const { ObjectId } = await import('mongodb');
    let objId;
    try { objId = new ObjectId(smDel[1]); } catch { return json({ error: 'invalid_id' }, { status: 400 }); }
    const result = await db.collection('scheduled_messages').deleteOne({ _id: objId, guild_id: gidLong });
    if (result.deletedCount === 0) return json({ error: 'not_found' }, { status: 404 });
    return json({ ok: true });
  }

  if (sub === 'embeds/send' && method === 'POST') {
    const session = await getSession();
    if (!session?.user) return json({ error: 'unauthenticated' }, { status: 401 });

    const embedRateUserId = toLong(session.user.id) || Long.ZERO;
    const lastEmbedSend = await db.collection('embed_builder_rate_limits').findOne({
      guild_id: gidLong,
      user_id: embedRateUserId,
    });
    const lastEmbedAt = lastEmbedSend?.last_sent_at ? new Date(lastEmbedSend.last_sent_at).getTime() : 0;
    const embedRemaining = Math.ceil((30_000 - (Date.now() - lastEmbedAt)) / 1000);
    if (embedRemaining > 0) {
      return json({
        error: 'embed_cooldown',
        retry_after: embedRemaining,
        detail: `Please wait ${embedRemaining} second(s) before sending another embed.`,
      }, { status: 429 });
    }

    const channelId = body.channel_id ? String(body.channel_id) : null;
    const embed = body.embed && typeof body.embed === 'object' ? body.embed : null;
    const content = String(body.content || '').slice(0, 2000);
    const mentionRoleIds = Array.isArray(body.mention_role_ids) ? body.mention_role_ids.map(String).slice(0, 25) : [];
    if (!channelId) return json({ error: 'missing_channel' }, { status: 400 });
    if (!embed || (!embed.title && !embed.description && !embed.image && !embed.thumbnail)) {
      return json({ error: 'missing_embed' }, { status: 400 });
    }
    if (!(await assertChannelInGuild(guildId, channelId))) {
      return json({ error: 'invalid_channel' }, { status: 400 });
    }
    if (embed.image && embed.image.url) {
      try { embed.image.url = sanitizeImageUrl(embed.image.url); }
      catch { return json({ error: 'invalid_image_url', field: 'image' }, { status: 400 }); }
    }
    if (embed.thumbnail && embed.thumbnail.url) {
      try { embed.thumbnail.url = sanitizeImageUrl(embed.thumbnail.url); }
      catch { return json({ error: 'invalid_image_url', field: 'thumbnail' }, { status: 400 }); }
    }
    if (mentionRoleIds.length && !(await assertRolesInGuild(guildId, mentionRoleIds))) {
      return json({ error: 'invalid_role', field: 'mention_role_ids' }, { status: 400 });
    }
    let buttonRows = [];
    if (body.advanced && typeof body.advanced === 'object') {
      const adv = parseAdvancedEmbed(body.advanced, { content, embed });
      if (adv.error) return json({ error: adv.error }, { status: 400 });
      if (adv.author) embed.author = { name: adv.author };
      if (adv.fields.length) embed.fields = adv.fields;
      buttonRows = linkButtonRows(adv.buttons);
    }
    try {
      const payload = embedToV2Payload(embed, buttonRows, content || null);
      payload.allowed_mentions = mentionRoleIds.length
        ? { parse: [], roles: mentionRoleIds }
        : { parse: [] };
      const msg = await sendGuildMessage(channelId, payload);
      await db.collection('embed_builder_rate_limits').updateOne(
        { guild_id: gidLong, user_id: embedRateUserId },
        { $set: { guild_id: gidLong, user_id: embedRateUserId, last_sent_at: new Date() } },
        { upsert: true },
      );
      return json({ ok: true, message_id: msg.id });
    } catch (e) {
      return json({ error: 'discord_send_failed', detail: String(e.message || e) }, { status: 502 });
    }
  }

  return json({ error: 'not_found', path, method }, { status: 404 });
}

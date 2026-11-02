// FILE: route.js
// PUNE ÎN: app/api/[[...path]]/route.js
// (înlocuiește fișierul existent din proiectul wody-dashboard-main la această cale)

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
import { getCareersRolesConfig, parseCareersRolesPatch, saveCareersRolesPatch } from '@/lib/careers-roles';
import { slugify, parseBlogPostInput, ensureUniqueSlug, BLOG_COLLECTION, readWithRetry } from '@/lib/blog';
import { UNLIMITED_LIMIT } from '@/lib/limits';
import { PARTNERS_COLLECTION, parsePartnerInput, serializePartner, getPublicPartners, getAllPartners } from '@/lib/partners';
import { parseStaffInput, STAFF_COLLECTION } from '@/lib/staff';
import { getDelegate, listAccess, mutateAccess } from '@/lib/owner-access';
import { audit } from '@/lib/owner-audit';
import { parseAdvancedEmbed, linkButtonRows } from '@/lib/advanced-embed';

// Premium-only limit for the YouTube notifications feature: max watched
// channels per guild (the "1 Discord channel" cap is structural, one
// youtube_notify_settings document per guild). Kept in one place so the
// GET/POST/DELETE handlers below always agree.
const YOUTUBE_NOTIFY_MAX_CHANNELS = Number(process.env.YOUTUBE_NOTIFY_MAX_CHANNELS || 3);

// This route serves per-user, session-specific data (guild lists, settings).
// Force fully dynamic rendering so Next.js/Vercel never cache or share a
// response across different users.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Single source of truth for the owner-only endpoints below (premium key
// generation/revocation/listing). Previously this literal was duplicated in
// 4 separate places, set DISCORD_OWNER_ID in the environment to change it;
// falls back to the existing value so nothing changes if it's unset.
const OWNER_ID = process.env.DISCORD_OWNER_ID || '932582842351898644';

// Every module key the dashboard sidebar can toggle on/off, kept in sync
// by hand with MODULES in app/[locale]/dashboard/[guildId]/page.js and with
// the bot's own db.py (NON_TOGGLEABLE_MODULES / is_module_enabled).
//
// Two MODULES keys are deliberately left out because there is nothing
// running in the background for the bot to switch off:
// - "general" / "premium": config/status pages, not features.
// - "embeds": a one-shot "compose and send now" tool, nothing persists.
//
// There used to be a third ("verification"), a read-only sidebar tab that
// just re-listed reaction_roles entries in "verify" mode with no delete
// button of its own. Removed: Reaction Roles already lists (and can
// delete) those same panels, and Captcha is now the module for
// website-based member verification, so there is no separate module here
// to toggle.
const MODULE_TOGGLE_KEYS = [
  'welcome', 'goodbye', 'autorole',
  'moderation', 'automod', 'logging',
  'tickets', 'reaction_roles', 'auto_responses',
  'custom_commands', 'giveaways', 'scheduled_messages', 'forums',
  'levels', 'suggestions', 'captcha',
  'backups', 'temporary_voice', 'youtube_notify',
  'economy', 'blackjack', 'stream_notifications', 'birthdays', 'invite_tracking',
  'lookups', 'feeds',
];

// Of the keys above, these three only ever run while the guild has an
// active Premium subscription (backups.py/_premium_gate, temporary_voice.py
// and youtube_notify.py all call is_premium() before doing anything). The
// dashboard's toggle switch used to let a non-premium server flip these on
// anyway, meaningless client-side state, since the bot would never
// actually act on it, so enabling one of these now requires an active
// premium doc, checked the same way every other premium-gated endpoint in
// this file already does via isGuildPremium(). Kept in sync by hand with
// PREMIUM_ONLY_KEYS in the dashboard page (MODULES entries with premium: true).
const PREMIUM_ONLY_TOGGLE_KEYS = new Set(['backups', 'temporary_voice', 'youtube_notify', 'economy', 'blackjack', 'stream_notifications']);

// Fixed destination for the "post this update to Discord" mirror below,
// the #updates channel on the Wody community server. This is intentionally
// a single hardcoded channel, never something read from the request body
// or looked up per-guild: the update-posting branch is already gated to
// OWNER_ID only (see the 'updates' POST handler), and this constant is the
// only channel it will ever post to, on purpose, so there is no way for a
// request, forged or otherwise, to redirect the announcement elsewhere.
const UPDATES_ANNOUNCE_CHANNEL_ID = process.env.UPDATES_ANNOUNCE_CHANNEL_ID || '1529784783847166032';

const SITE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://wody.online';

// Fixed thumbnail shown on every update embed mirrored to Discord (top-right
// small image, matching the branded "W" logo shown next to update posts).
// Intentionally a single hardcoded, permanent URL, not something read from
// the request body, so every update posted always carries the same logo,
// the same way UPDATES_ANNOUNCE_CHANNEL_ID is a fixed destination above.
// Was 'https://i.imgur.com/tU2LR1p.png'. Now points at our own
// status/bot-avatar proxy (see that handler below, and WODY_LOGO_URL in
// components/module-preview-content.jsx which uses the same endpoint),
// Discord fetches this server-to-server when rendering the embed, gets
// whatever avatar is actually set in the Developer Portal, and there's no
// local logo file to keep in sync or accidentally leave stale.
const UPDATE_THUMBNAIL_URL = `${SITE_URL}/api/status/bot-avatar`;

// Strips emoji and other pictographic symbols from owner-authored update
// text before it's saved/posted. Update posts are meant to read like a
// plain, professional changelog, not emoji-decorated text. This only
// removes emoji code points; normal punctuation and accented letters are
// untouched.
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

// Builds the embed mirrored to Discord for a saved update entry. Title and
// body come straight from what the owner typed in the dashboard, nothing
// generated or reworded is added on top, only a plain link back to the
// update on the website.
function updateEmbed(item) {
  const link = `[View this update on the website](${SITE_URL}/updates)`;
  const bodyRoom = 4096 - link.length - 4; // leave room for the "\n\n" separator
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

// ---------------------------------------------------------------------------
// Minimal in-memory rate limiter for mutating requests (POST/PUT/PATCH/DELETE).
// Best-effort only: on serverless platforms each instance has its own memory,
// so this doesn't guarantee a hard global cap, but it stops a single runaway
// client/tab from hammering the API (e.g. spamming giveaway/message creation)
// within one instance's lifetime. Keyed by session id when available, else IP.
//
// Backed by MongoDB (rate_limit_buckets, see lib/mongo.js for its TTL
// index) instead of an in-memory Map: on serverless, each Vercel instance
// used to keep its own independent counter, so a client hitting several
// instances in parallel could exceed the intended 20/10s far more than
// 20 times in aggregate. Bucketing by a fixed window boundary and doing
// the increment as a single atomic findOneAndUpdate means every instance
// shares the same counter for the same key+window, and concurrent
// requests can never under-count each other the way two separate
// read-then-write steps could.
// ---------------------------------------------------------------------------
const RATE_LIMIT_WINDOW_MS = 10_000;
const RATE_LIMIT_MAX = 20; // 20 mutations / 10s per key

async function rateLimited(db, key) {
  const now = Date.now();
  const windowStart = now - (now % RATE_LIMIT_WINDOW_MS);
  const bucketId = `${key}:${windowStart}`;
  try {
    const result = await db.collection('rate_limit_buckets').findOneAndUpdate(
      { _id: bucketId },
      {
        $inc: { count: 1 },
        // TTL cleanup only needs to happen eventually, keep the bucket
        // around a bit past its own window so there's no race between the
        // TTL sweep and a request still landing right at the boundary.
        $setOnInsert: { expires_at: new Date(windowStart + RATE_LIMIT_WINDOW_MS * 2) },
      },
      { upsert: true, returnDocument: 'after' },
    );
    return (result?.count || 0) > RATE_LIMIT_MAX;
  } catch (e) {
    // Best-effort: if the rate limiter itself is unavailable (Mongo hiccup),
    // fail open rather than blocking every mutation in the app.
    console.error('rate limiter unavailable', e);
    return false;
  }
}

// Caps how long any single Discord lookup fired inside a Promise.all
// (staff list resolution below) is allowed to hold up the whole request.
// getDiscordUserById() (lib/discord.js) can legitimately take up to ~30s
// in the worst case when Discord is rate-limiting (its own internal retry
// + backoff), fine for one isolated call, but not when N of them run in
// parallel and the response waits on the slowest one: a single stuck
// lookup used to be able to stall this route long enough to trip the
// platform's own request timeout. Racing each lookup against this timeout
// means a stuck entry is skipped this time (same as a genuinely-deleted
// account) instead of blocking every other entry.
const DISCORD_LOOKUP_TIMEOUT_MS = 5000;
function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}

// Same reasoning as the bot's cogs/giveaways.py _weighted_pool()/
// _weighted_sample(): a participant's draw weight is the HIGHEST weight
// among any role_weights entry they currently hold (never summed, so
// stacking several boosted roles can't dominate the draw far beyond what
// "this role has better odds" is meant to promise), or 1 if they hold
// none of the configured roles. Used only by the dashboard's own Reroll
// button (app/api/.../giveaways/:id/reroll); the bot's /giveaway-reroll
// and its own scheduled _end() do the equivalent in Python, kept in sync
// by hand since the two run in different languages.
//
// Each member lookup is raced against DISCORD_LOOKUP_TIMEOUT_MS (see
// above): resolving roles for every participant one Discord API call at
// a time is the exact "one slow lookup blocks everyone" shape that was a
// real bug on the staff list page, an unresolved member here just falls
// back to weight 1 rather than risking the same thing.
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
  const db = await getDb();
  const blocked = await db.collection('guild_bans').findOne({ guild_id: String(guildId), active: true });
  if (blocked) {
    return { error: json({ error: 'guild_banned', message: 'This server is blocked from using Wody.' }, { status: 403 }) };
  }
  const session = await getSession();
  if (!session?.accessToken) return { error: json({ error: 'unauthenticated' }, { status: 401 }) };
  let guilds;
  try {
    guilds = await getUserGuilds(session.accessToken);
  } catch {
    // Couldn't verify access right now (e.g. Discord rate limit / hiccup).
    // This is NOT the same as "you don't have access", surface it as a
    // transient error so the client can retry instead of treating it as
    // a permanent 403.
    return { error: json({ error: 'temporarily_unavailable' }, { status: 503 }) };
  }
  const g = guilds.find((x) => x.id === guildId);
  if (!g || !canManage(g.permissions, g.owner)) {
    return { error: json({ error: 'forbidden' }, { status: 403 }) };
  }
  return { session, guild: g };
}

// Cross-tenant guard: guardGuildAccess() only proves the caller manages
// `guildId`. It does NOT prove that a channel_id supplied in the request
// body actually belongs to that guild. Without this check, anyone who
// manages ANY guild the bot is in could send a channel_id from a totally
// different guild and have the bot (which has its own token and is present
// in many servers) post a giveaway/reaction-role panel/embed/scheduled
// message there, with no permissions on the target server at all.
// Every handler that accepts a channel_id from the client and then calls
// sendGuildMessage/addMessageReaction with it MUST call this first.
// A channel Wody can post a message in: text (0) or announcement (5), inside this server.
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

// A ticket "category" must be an actual Discord category channel (type 4,
// the folder channels live under), not a regular text/announcement channel.
// The dashboard's ticket-type editor used to reuse the generic ChannelSelect
// (text channels only in its dropdown, but nothing stopped a stale/imported
// panel or a direct API call from saving a text channel id here), and the
// bot would then try to create ticket channels with that text channel as
// their `parent_id`, Discord silently rejects/mis-places that, which is
// why tickets opened in the wrong place. Every category_id must now pass
// this check, in addition to assertChannelInGuild's guild-ownership check.
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
  const emoji = String(panel.button_emoji || '🎫');
  const custom = emoji.match(/^<a?:([^:]+):(\d+)>$/);
  return [{ type: 1, components: [{
    type: 2, style: Number.isInteger(panel.button_style) && [1,2,3,4].includes(panel.button_style) ? panel.button_style : 1, custom_id: 'wody:ticket:open',
    label: String(panel.button_label || 'Open ticket').slice(0, 80),
    ...(custom ? { emoji: { name: custom[1], id: custom[2], animated: emoji.startsWith('<a:') } } : { emoji: { name: emoji } }),
  }] }];
}

// Captcha verification panel: a single Link-style button (style 5) that
// opens the public /verify/[guildId] page. Deliberately NOT a custom_id
// button, a Link button is handled entirely by Discord client-side, so the
// bot never receives an interaction for it and needs no interaction
// handler/View for this feature. All the actual work (confirming the click
// happened, checking membership, granting the role) happens on the website,
// authenticated by the visitor's own Discord login, see
// app/api/verify/[guildId]/route.js.
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
  const emoji = String(settings.button_emoji || '✅');
  const custom = emoji.match(/^<a?:([^:]+):(\d+)>$/);
  return [{ type: 1, components: [{
    type: 2, style: 5, // Link
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

// Same "Image" concept as the welcome/goodbye embeds, but for a ticket
// type's welcome embed: the opener's avatar or the server icon render as a
// small top-right thumbnail (like the reference ticket bot screenshot),
// 'custom' is a full-size image/GIF, 'none' shows nothing.
const TICKET_IMAGE_MODES = ['opener_avatar', 'server_avatar', 'custom', 'none'];

// Validates a dashboard-supplied http(s) image/GIF URL, length-capping it.
// Returns null for an empty value; throws for anything present but invalid
// so callers can turn that into a 400 response.
//
// Returns u.href (the WHATWG-normalized URL), NOT the original raw string.
// `new URL()` happily *parses* a raw space/parenthesis/non-ASCII character
// (common with a pasted link, or a preset filename like "Wody (1).webp"),
// but silently percent-encodes them in `.href`, the original, unescaped
// string is only fine for an <img> tag in a browser. Handing that raw
// string to Discord's embed API instead gets the ENTIRE welcome/goodbye/
// ticket/level-up message rejected (HTTP 400) over the image field alone,
// which is the "I set a picture, and now nothing sends at all" bug this
// closes off at the source, the bot's own sanitize_embed_image_url() /
// send_resilient() are a second, independent safety net for the same
// problem, not a substitute for fixing it here too.
function sanitizeImageUrl(value) {
  if (!value) return null;
  const u = new URL(String(value));
  if (!['http:', 'https:'].includes(u.protocol)) throw new Error('bad_protocol');
  assertRoutableImageHost(u);
  return u.href.slice(0, 2048);
}

// A single-label host ("s", "localhost", "imgur") is syntactically valid as
// far as `new URL()` is concerned, so a mistyped link sailed through every
// check here and every check in the bot.
//
// This is not hypothetical: a "https://s//i.imgur.com/....gif" saved as a
// welcome card background parses cleanly (host "s", path
// "//i.imgur.com/....gif"), the bot then tries to resolve the host "s",
// DNS says "Name or service not known", the card fails to render and the
// member gets the fallback avatar embed instead of the card that was
// configured. Rejecting it at save time turns a silent, permanent breakage
// into an immediate, fixable error message on the field itself.
//
// Public hostnames always contain a dot. Raw IP literals are refused too:
// they are never a legitimate CDN link here and they are the shape an SSRF
// attempt takes.
function assertRoutableImageHost(u) {
  const host = String(u.hostname || '').toLowerCase().replace(/\.$/, '');
  if (!host) throw new Error('bad_host');
  if (host.startsWith('[')) throw new Error('bad_host');            // IPv6 literal
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) throw new Error('bad_host'); // IPv4 literal
  if (!host.includes('.')) throw new Error('bad_host');             // "s", "localhost", ...
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

// Same idea as assertRolesInGuild, but for a list of channel ids (e.g. the
// per-guild list of channels where XP gain is blocked). Empty/absent list
// is always valid, that's "no channel blocked".
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

// Same guard as assertChannelInGuild, but for settings payloads that can
// carry several channel_id-shaped fields at once (guild_settings, welcome,
// goodbye, automod, ticket panels, ...). Fetches the guild's channel list
// once and checks every present field against it. Returns the name of the
// first offending field, or null if everything checks out (fields that are
// absent/empty in `data` are skipped, this only validates values the
// caller is actually trying to save).
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

// ---------------------------------------------------------------------------
// Premium key <-> premium server consistency helpers.
//
// Before this, revoking a key only flipped `revoked` on the key document,
// the server it had activated stayed in `premium_servers` with active:true
// forever, so it kept showing up in the owner's "active premium servers"
// list even though its key was dead. Expiry had the same gap: a server's
// premium only actually got cleared out the next time something happened
// to call is_premium() for that guild (e.g. a command run on the bot side);
// the owner-facing dashboard lists never re-checked expiry at all.
//
// The functions below make both directions of that link explicit and keep
// it enforced at every read/write path in this file instead of relying on
// a background job:
//   - revoking a key deactivates every server still active under it
//   - removing a server's premium revokes that key IF no other active
//     server still depends on it (keeps multi-use keys intact otherwise)
//   - any premium listing sweeps expired servers first, deactivating them
//     and revoking their backing key so the two lists can never disagree
// ---------------------------------------------------------------------------

// Free-tier creation limits and their premium multiplier. Centralized here
// so the ticket-panel and reaction-role-panel limits (and any future ones)
// all scale the same way instead of each having its own hardcoded "x3".
const FREE_TICKET_PANEL_LIMIT = 1;

// Max number of ticket types (dropdown options) a single panel can have.
// Discord's own StringSelect component technically allows up to 25 options,
// but a panel with that many types is unusable in practice, so the product
// limit is intentionally lower than the Discord-imposed ceiling. Enforced
// here (not just in the dashboard's "Add type" button) so it can't be
// bypassed by calling this endpoint directly, and the bot side should treat
// this same constant as the source of truth when validating panels it reads.
const MAX_TICKET_TYPES = 10;
const FREE_REACTION_PANEL_LIMIT = 1;
const FREE_AUTO_RESPONSE_LIMIT = 5;
const FREE_CUSTOM_COMMAND_LIMIT = 5;
const FREE_SCHEDULED_MESSAGE_LIMIT = 1;
const FREE_GIVEAWAY_LIMIT = 1;
const FREE_FORUM_LIMIT = 1;
// Premium servers have no creation limit at all (lib/limits.js).
const PREMIUM_UNLIMITED = UNLIMITED_LIMIT;

function keyStatus(doc) {
  if (!doc) return 'unknown';
  if (doc.revoked) return doc.revoked_reason === 'expired' ? 'expired' : 'revoked';
  if (doc.expires_at && new Date(doc.expires_at) < new Date()) return 'expired';
  if ((doc.activations_used || 0) >= (doc.activations_limit || 1)) return 'exhausted';
  return 'active';
}

// Deactivates every currently-active premium_servers doc tied to a given
// key value. Returns how many were touched, for logging/toasts.
async function deactivateServersForKey(db, keyValue, reason) {
  if (!keyValue) return 0;
  const result = await db.collection('premium_servers').updateMany(
    { key_value: keyValue, active: true },
    { $set: { active: false, suspended: true, suspended_reason: reason, revoked_at: new Date() } }
  );
  return result.modifiedCount || 0;
}

// Finds premium_servers docs that are still marked active but whose expiry
// has already passed, deactivates them, and revokes the key(s) that backed
// them (marked with revoked_reason: 'expired' so the UI can still tell an
// expiry apart from a manual revoke). Cheap best-effort pass, safe to call
// on every premium read.
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

// Single source of truth for "is this guild premium right now", used by
// every creation-limit check below (ticket panels, reaction role panels,
// forums, scheduled messages, giveaways, …), which, since those checks were
// added, can mean this runs many times in a single request.
//
// It used to call sweepExpiredPremium(db) first, which does a collection-wide
// scan for *every* guild's expired premium on *every* call, a real
// bottleneck now that more modules check premium. Instead we look up only
// this guild's doc (indexed on guild_id) and, if it turns out to be expired,
// lazily expire just that one doc/key inline. Any premium doc left dangling
// past its expiry by some other path still gets cleaned up by the periodic
// sweepExpiredPremium() calls elsewhere (e.g. the premium admin views), so
// nothing here regresses correctness, it just stops doing global work to
// answer a single-guild question.
async function isGuildPremium(db, gidLong) {
  const doc = await db.collection('premium_servers').findOne({ guild_id: gidLong, active: true });
  if (!doc) return false;
  if (doc.suspended) return false;
  if (doc.expires_at && new Date(doc.expires_at) < new Date()) {
    // Expire just this guild's doc/key instead of scanning the whole collection.
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

// -------- YouTube video notifications: shared helpers --------

// Unsubscribes from YouTube's WebSub hub for one channel iff no guild is
// watching it anymore (subscriptions are shared across guilds, never one
// per guild), then removes the local subscription record. Safe to call
// even if the subscription never verified yet.
async function unsubscribeIfOrphaned(db, youtubeChannelId) {
  const stillWatched = await db.collection('youtube_notify_channels').countDocuments(
    { youtube_channel_id: youtubeChannelId },
    { limit: 1 }
  );
  if (stillWatched) return;
  const sub = await db.collection('youtube_websub_subscriptions').findOne({ youtube_channel_id: youtubeChannelId });
  if (!sub) return;
  // callback_token may still be missing on a subscription created before
  // this fix shipped, in the narrow window before the bot's periodic
  // sweep (cogs/youtube_notify.py -> _sweep_renewals) backfills one and
  // force-renews it. Such a subscription was registered at the hub under
  // the OLD (no-token) callback URL, so we can't build a matching
  // unsubscribe request for it here, just drop our local record; the
  // hub-side subscription lapses on its own once its lease expires
  // (harmless: our old callback route no longer exists, so any late
  // delivery attempt just gets a 404).
  if (sub.callback_token) {
    await unsubscribeFromHub(youtubeChannelId, sub.callback_secret, sub.callback_token).catch(() => {});
  }
  await db.collection('youtube_websub_subscriptions').deleteOne({ _id: sub._id });
}

// Removes every YouTube channel a guild watches (e.g. when its target
// Discord channel is deleted, or its Premium lapses), unsubscribing any
// now-orphaned WebSub subscription along the way.
async function unwatchAllYoutubeChannels(db, gidLong) {
  const docs = await db.collection('youtube_notify_channels').find({ guild_id: gidLong }).toArray();
  await db.collection('youtube_notify_channels').deleteMany({ guild_id: gidLong });
  for (const doc of docs) {
    await unsubscribeIfOrphaned(db, doc.youtube_channel_id);
  }
}

// Lightweight in-memory rate limit for the YouTube-notify write endpoints
// (per guild, per Node process, resets on redeploy/restart, which is
// fine: its job is only to blunt accidental rapid-fire clicking/scripted
// abuse of the "add channel" form, not to be a durable global limiter).
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

// Best-effort audit trail for owner-only premium mutations. Never throws,
// mirrors the settings_audit pattern already used by upsertOne below.
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

// Reverse direction of the mirroring done in modules/toggle: some modules
// have their own local on/off switch (welcome_settings.enabled,
// goodbye_settings.enabled, guild_settings.level_enabled) living right on
// their own settings page. When that local switch changes we mirror it into
// guild_settings.module_states so the sidebar master switch always agrees
// with it too, regardless of which one the user touched.
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

  // Single interception point for every settings PUT/PATCH, new settings
  // sections get audit coverage for free as long as they save through
  // upsertOne, instead of needing a separate audit call per handler.
  // Audit logging is best-effort: a failure here must never fail the
  // actual settings save.
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
  // Merge saved doc over the defaults (rather than returning the raw doc) so
  // that fields added to `defaults` after a guild's document was first
  // created (e.g. new automod options) still come back populated instead of
  // undefined, which previously showed as blank/zeroed inputs in the UI for
  // any server that had already saved settings before the new fields existed.
  if (doc) return { guild_id: String(guildId), ...defaults, ...serializeDoc(doc) };
  return { guild_id: String(guildId), ...defaults };
}


// Shared helpers handed to the newer module handlers (lib/modules/*), which
// live outside this file so it does not grow further. Built per call because
// the functions below are declared in this file.
function moduleHelpers() {
  return {
    serializeDoc, deserializeInput, toLong, isGuildPremium, assertChannelInGuild, assertTextChannelInGuild, assertRoleInGuild,
    getGuildMembersProfileMap, searchGuildMembers,
  };
}

// Small in-memory cache for the /api/discord-cdn proxy below (guild icons,
// avatars). A warm instance answers repeat requests (the homepage showcase,
// /team, leaderboards) without going back to Discord for every picture.
// Hash-addressed, so an entry can never be stale; bounded by count and size.
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

// Real logic lives in handleGet(); GET below is a thin wrapper that adds a
// global safety net (see comment above handleGet's export for why).
async function handleGet(request, context) {
  const params = await context.params;
  const path = (params?.path || []).join('/');
  const url = new URL(request.url);

  // Public, unauthenticated: generic proxy for the Discord CDN paths this
  // dashboard renders directly in the browser, guild icons, member/user
  // avatars, and the numbered default-avatar images. Same rationale as
  // status/bot-avatar above: cdn.discordapp.com sits behind Cloudflare Bot
  // Management, which sets its own cookies (__cf_bm, __dcfduid, __sdcfduid)
  // on ANY direct request to it, before any cookie choice. Fetching
  // server-side keeps all three off the visitor's browser entirely.
  // `path` is strictly whitelisted to the three known Discord CDN avatar/
  // icon shapes (snowflake ID + hash, or a numbered default avatar) so this
  // can never be turned into an open proxy for arbitrary URLs. See
  // lib/utils.js's discordCdnUrl() for the client-side half of this: it
  // rewrites a raw cdn.discordapp.com URL into a call to this endpoint.
  if (path === 'discord-cdn') {
    const cdnPath = url.searchParams.get('path') || '';
    const DISCORD_CDN_PATH_RE = /^(?:icons\/\d{15,25}\/[a-zA-Z0-9_]+\.(?:png|jpe?g|webp|gif)|avatars\/\d{15,25}\/[a-zA-Z0-9_]+\.(?:png|jpe?g|webp|gif)|embed\/avatars\/[0-9]\.png)$/;
    if (!DISCORD_CDN_PATH_RE.test(cdnPath)) return new NextResponse(null, { status: 400 });
    const sizeParam = url.searchParams.get('size');
    const size = ['16', '32', '64', '128', '256', '512', '1024'].includes(sizeParam) ? sizeParam : null;
    const target = `https://cdn.discordapp.com/${cdnPath}${size ? `?size=${size}` : ''}`;
    // Every one of these paths contains the image hash (or is one of the
    // fixed default avatars), so the bytes behind a given URL never change:
    // a new icon/avatar always gets a new hash and therefore a new URL. That
    // makes long caching safe, in memory on this instance and on the CDN.
    const cdnHeaders = (type) => ({
      'Content-Type': type,
      // Cacheable on our own origin: this response carries no
      // per-visitor data and sets no cookie of its own.
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

  // Public, unauthenticated: proxies the bot's Discord avatar through our
  // own origin so the visitor's browser never talks to cdn.discordapp.com
  // directly. That CDN sits behind Cloudflare Bot Management, which drops
  // its own `__cf_bm` cookie on ANY request to it, including a bare
  // <img src="https://cdn.discordapp.com/...">-, before the visitor has
  // made any cookie choice, and regardless of what they choose. Fetching
  // the image server-side (this request never touches the visitor's
  // browser) keeps that third-party request, and its cookie, off the
  // visitor entirely. On any failure we return 404 rather than falling
  // back to a redirect to Discord, a redirect would just recreate the
  // exact leak this exists to close. bot-status.jsx already falls back to
  // a plain "W" avatar when this 404s (see its onError handler).
  if (path === 'status/bot-avatar') {
    // Every preview on the site shows this avatar, so a warm instance keeps it
    // in memory for ten minutes instead of asking Discord for it each time.
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
          // Cacheable on our own origin: this response carries no
          // per-visitor data and sets no cookie of its own, so caching it
          // is safe and keeps repeat page loads from re-fetching Discord.
          'Cache-Control': 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400',
        },
      });
    } catch (e) {
      console.error('bot avatar proxy failed', e);
      return new NextResponse(null, { status: 404 });
    }
  }

  // Public, unauthenticated: powers the little "Wody is online" indicator on
  // the landing page. The bot writes a heartbeat timestamp to MongoDB every
  // ~20s (see cogs/status.py), if it's recent, the bot process is alive.
  // A stale/missing heartbeat means the bot is offline or hasn't reported yet.
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
      // Same-origin proxy path, NOT the raw cdn.discordapp.com URL, see
      // the status/bot-avatar handler above for why. avatarUrl(botUser)
      // is still used server-side (inside that handler) to know what to
      // fetch; the browser only ever sees our own domain.
      bot: botUser ? { username: botUser.username, avatar_url: '/api/status/bot-avatar' } : null,
    });
  }

  // Public, unauthenticated: powers the "running in communities of every
  // size" showcase strip on the landing page. Reuses the same bot-token
  // guild list the owner-only panels already fetch (getBotGuilds), just
  // with_counts=true for approximate_member_count, filtered down to real
  // communities (more than the configured minMembers, see
  // lib/community-showcase.js, default 5) so empty test/personal servers
  // never show up. A server is picked up here automatically the moment
  // the bot joins it and it crosses that bar, there's no separate list
  // to add it to, this always reflects the bot's live guild list.
  //
  // Icons are returned as raw cdn.discordapp.com URLs, same as every other
  // guild icon in this app (dashboard/page.js, premium/page.js, ...), the
  // client rewrites them through discordCdnUrl()/the discord-cdn proxy
  // above before rendering, so the visitor's browser never talks to
  // Discord's CDN directly and no third-party cookie is ever set.
  //
  // When more servers qualify than the configured maxDisplay (default 28,
  // i.e. the requested "25-30"), a random subset of that size is shown
  // instead of always the same biggest servers, seededShuffle() with a
  // seed derived from the current SHOWCASE_ROTATE_MS time bucket, so the
  // set is stable for everyone during that window and then rotates to a
  // different random subset on its own, no cron job needed.
  if (path === 'status/showcase') {
    const servers = await getShowcaseServers();
    return json({ servers });
  }

  // Public, unauthenticated, read-only: the community showcase's current
  // minMembers/maxDisplay, only so the owner panel can preload the form.
  // Actual reads for the public showcase happen server-side inside
  // 'status/showcase' above, not by the browser calling this separately.
  if (path === 'site/community-showcase') {
    try {
      const config = await getShowcaseConfig();
      return json(config);
    } catch {
      // Not defaults: the owner panel must not show an empty "excluded" list that a save would write over the real one.
      return json({ error: 'unavailable' }, { status: 503 });
    }
  }

  // Public, unauthenticated, read-only. Two different callers use this
  // same raw config: the owner panel preloads its edit form with it
  // (including when enabled is false, so the toggle shows correctly),
  // and DashboardPromoBanner (app/[locale]/dashboard/[guildId]/page.js)
  // fetches it client-side and does its own "is this actually ready to
  // show" check (enabled + has an image + has a button link) before
  // rendering anything.
  if (path === 'site/promo-banner') {
    const config = await getPromoBannerConfig();
    return json(config);
  }

  // Public, read-only: the social buttons of the site footer (owner panel > Appearance > Footer Social Links).
  if (path === 'site/footer-socials') {
    const config = await getFooterSocials();
    return json(config, { headers: { 'Cache-Control': 'public, max-age=60, s-maxage=60, stale-while-revalidate=300' } });
  }

  // Public, unauthenticated, read-only: same two-callers pattern as
  // site/promo-banner above. The owner panel preloads its editor with the
  // raw config (including when enabled is false), and the site-wide top
  // bar (components/countdown-banner.jsx, mounted once in
  // app/[locale]/layout.js) fetches this directly and decides for itself
  // whether there's anything to show right now (enabled + text + target,
  // and either the target hasn't passed yet or there's an ended_text to
  // fall back to).
  if (path === 'site/countdown-banner') {
    // A failed read must not look like "the bar is switched off": answer 503 so the open page keeps what it shows.
    let config;
    try { config = withBackgroundSrc(await getCountdownBannerConfig()); } catch { return json({ error: 'unavailable' }, { status: 503 }); }
    return json({ ...config, server_time: Date.now() });
  }

  // Public, unauthenticated, read-only: only the owner panel's edit form
  // actually calls this over HTTP. The image itself
  // (app/opengraph-image.js) reads the same config directly via
  // getOgEmbedConfig(), server-side, no round-trip through this route.
  if (path === 'site/og-embed') {
    const config = await getOgEmbedConfig();
    return json(config);
  }

  // Public, unauthenticated, read-only: powers /careers (rolurile căutate)
  // și preîncarcă editorul din owner panel. isCustom spune panel-ului dacă
  // afișează lista salvată în DB sau, cât timp owner-ul nu a salvat încă
  // nimic, lista implicită tradusă din messages/<locale>.json.
  if (path === 'site/careers-roles') {
    const config = await getCareersRolesConfig();
    return json(config);
  }

  // Public, unauthenticated: powers the /updates page (changelog /
  // announcements). Read-only here, creating or deleting an update is
  // owner-only and lives in the mutation handler below (POST/DELETE
  // 'updates'), same split as every other public read / owner-only write
  // pair in this file (e.g. status/bot vs premium/generate).
  if (path === 'updates') {
    const db = await getDb();
    const items = await db.collection('updates').find({}).sort({ created_at: -1 }).limit(100).toArray();
    return json({ items: items.map(serializeDoc) });
  }

  // Public, unauthenticated: powers the /blog list page. Published posts
  // only, newest first. Content is the raw SimpleMarkdown text, rendered
  // through components/simple-markdown.jsx wherever it's shown, never as
  // raw HTML (see lib/blog.js's own comment).
  // Public, unauthenticated: the newest published posts, only the fields a
  // card needs (no content), for the "Spotlight" in the site's Resources menu.
  // Must stay above the blog/<slug> route, 'latest' would otherwise be read as a slug.
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
      // 503 (not a cached empty list): the menu asks again the next time it is opened.
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

  // Public, unauthenticated: a single published post by slug, powers
  // /blog/[slug]. Deliberately does NOT let an unpublished draft be read
  // this way even by guessing its slug, matches the list above only ever
  // showing published posts, "published" is the one thing that actually
  // gates visibility here, not just being left out of the list.
  const blogSlugMatch = path.match(/^blog\/([a-z0-9-]+)$/);
  if (blogSlugMatch) {
    const db = await getDb();
    const post = await db.collection(BLOG_COLLECTION).findOne({ slug: blogSlugMatch[1], published: true });
    if (!post) return json({ error: 'not_found' }, { status: 404 });
    return json(serializeDoc(post));
  }

  // Public: partner bots for the /partners page (enabled only).
  if (path === 'partners') {
    return json({ items: await getPublicPartners() }, { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } });
  }

  // Owner-only: every partner, hidden ones included, for Owner Panel -> Partners.
  if (path === 'owner/partners') {
    const session = await getSession();
    if (!session?.user || session.user.id !== OWNER_ID) return json({ error: 'forbidden' }, { status: 403 });
    const db = await getDb();
    return json({ items: await getAllPartners(db) });
  }

  // Owner-only: every post regardless of published state, for the owner
  // panel's management list (drafts need to be visible there to be
  // editable/publishable, unlike the two public routes above).
  if (path === 'owner/blog') {
    const session = await getSession();
    if (!session?.user || session.user.id !== OWNER_ID) return json({ error: 'forbidden' }, { status: 403 });
    const db = await getDb();
    const items = await db.collection(BLOG_COLLECTION).find({}).sort({ created_at: -1 }).limit(500).toArray();
    return json({ items: items.map(serializeDoc) });
  }

  // Public, unauthenticated: powers the /team page. Each entry only
  // stores a Discord user id + this site's own fields (see lib/staff.js);
  // username/avatar are resolved live from Discord here, every request,
  // via the same 5-minute in-memory cache getDiscordUserById already has
  // (lib/discord.js), so this stays fast without ever storing a second,
  // potentially stale copy of someone's name or picture. icon_url below
  // is the same raw cdn.discordapp.com shape guildIconUrl/avatarUrl
  // return everywhere else in this file, the client rewrites it through
  // discordCdnUrl()/the discord-cdn proxy before rendering, so the
  // visitor's browser never talks to Discord directly and no cookie from
  // Discord is ever set, same as every other avatar on this site.
  // Entries whose Discord id no longer resolves (account deleted, bad id)
  // are silently skipped rather than shown broken.
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

  // Owner-only: resolves a Discord user id to their current
  // username/avatar without saving anything, so the owner panel's "Add
  // staff member" form can show who a pasted id actually belongs to
  // before it gets added, instead of finding out only after saving.
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
    // Optional "Join our Discord" checkbox on the login menu (?join=1): asks
    // Discord for the extra guilds.join scope so the callback can add the
    // member to the community server directly, no invite to accept.
    const wantsJoin = url.searchParams.get('join') === '1';
    const scope = encodeURIComponent(wantsJoin ? 'identify guilds guilds.join' : 'identify guilds');
    const clientId = process.env.DISCORD_CLIENT_ID;
    const state = await issueOAuthState();
    // Optional return-to path (e.g. /verify/123456789) so a member coming
    // from the Captcha panel lands back on the verify page instead of
    // /dashboard after logging in. Only ever a same-site relative path,
    // never follow an absolute/external "next" value, or this becomes an
    // open redirect.
    const nextParam = url.searchParams.get('next');
    const safeNext = nextParam && nextParam.startsWith('/') && !nextParam.startsWith('//') && !nextParam.includes('://')
      ? nextParam
      : null;
    // state|<encoded next>|<j when joining>, the pieces never contain a raw "|".
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
      // Security audit: every sign in of the owner or of a delegate is
      // reported to the private audit channel. Never blocks the login.
      try {
        const adb = await getDb();
        const role = String(user.id) === OWNER_ID ? 'owner' : ((await getDelegate(adb, user.id)) ? 'delegate' : null);
        if (role) {
          await audit(adb, { actor: { id: user.id, name: user.global_name || user.username }, role, action: 'login', outcome: 'ok', detail: 'signed in with Discord', request });
        }
      } catch (e) { console.error('login audit failed', e?.message || e); }
      // Best effort and never blocks the login: if the bot can't add them
      // (not in the community server, missing permission, already a member)
      // they are still logged in normally.
      if (joinFlag === 'j') {
        await joinCommunityGuild(user.id, tok.access_token).catch((e) => console.error('community join failed', e));
      }
      return NextResponse.redirect(`${SITE_URL}${safeNext || '/dashboard'}`);
    } catch (e) {
      return NextResponse.redirect(`${SITE_URL}/?error=auth`);
    }
  }

  if (path === 'auth/logout') {
    // Signing out is a GET address, so it must only act on a real click of the
    // person themselves. A browser that fetches links in advance (prefetch,
    // prerender), or another website that embeds this address, must never end
    // someone's session; those requests are sent home with the session intact.
    const hd = request.headers;
    const purpose = `${hd.get('sec-purpose') || ''} ${hd.get('purpose') || ''} ${hd.get('x-moz') || ''}`.toLowerCase();
    const fetchSite = hd.get('sec-fetch-site');
    const fetchMode = hd.get('sec-fetch-mode');
    // Sec-Fetch-User is only sent when a person really activated the link (a tap or a click), never for
    // prefetch, prerender, link previews or background loads. The sign out button itself uses POST (below);
    // this GET address stays only for old pages, and now requires that proof of a real tap.
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
    // getUserGuilds (Discord, on behalf of the visitor) and getBotGuilds
    // (Discord, on the bot's own token) are independent calls, running
    // them together instead of one after the other saves a full extra
    // round trip to Discord's API on every dashboard load.
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

  // --------- Premium keys (owner only) ---------
  if (path === 'premium/keys') {
    const session = await getSession();
    if (!session?.user) return json({ error: 'unauthenticated' }, { status: 401 });
    if (session.user.id !== OWNER_ID) return json({ error: 'forbidden' }, { status: 403 });
    const db = await getDb();
    // Catch up any key whose backing server(s) expired since the last read,
    // so a key's status here always matches the servers list below.
    await sweepExpiredPremium(db);
    const keys = await db.collection('premium_keys').find({}).sort({ _id: -1 }).limit(100).toArray();
    return json({
      keys: keys.map((k) => ({ ...serializeDoc(k), status: keyStatus(k) })),
      is_owner: true,
    });
  }

  // --------- Premium: active servers (owner only), moved here from the
  // Discord "/removepremium" command, gated the exact same way as
  // premium/generate below (OWNER_ID only). ---------
  if (path === 'premium/servers') {
    const session = await getSession();
    if (!session?.user) return json({ error: 'unauthenticated' }, { status: 401 });
    if (session.user.id !== OWNER_ID) return json({ error: 'forbidden' }, { status: 403 });
    const db = await getDb();
    // Drop anything that expired since the last time this was read, instead
    // of showing a server as "active premium" until someone happens to
    // trigger a check on the bot side.
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

  // --------- Premium: ALL servers Wody is in, not just premium ones
  // (owner only). A separate, more detailed view from premium/servers
  // above, this is for "where is my bot even installed", including free
  // servers, so it deliberately does NOT filter by premium status. ---------
  // --------- Owner: Invite Tracking health (owner only) ---------
  // Real numbers only: servers with the module switched on, joins recorded, the latest
  // module_errors written by the bot for this module, and servers that are switched on but
  // have not got a usable baseline yet (a sync problem).
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

  // --------- Owner: servers the bot joined in the last 7 days (own list) ---------
  // Recorded by the bot itself on_guild_join (bot.py), $set not
  // $setOnInsert there so a kick-then-reinvite counts as a fresh join.
  // Nothing on the dashboard side can reconstruct this after the fact:
  // Discord's own bot-guild-list endpoint (used by premium/all-servers
  // above) has no join-timestamp field at all.
  // Owner-only: which server-side settings are configured on this
  // deployment. Only yes/no is returned, never a value, so the panel can
  // answer "is SESSION_SECRET set?" without exposing any secret.
  if (path === 'owner/config-status') {
    const session = await getSession();
    if (!session?.user) return json({ error: 'unauthenticated' }, { status: 401 });
    if (session.user.id !== OWNER_ID) return json({ error: 'forbidden' }, { status: 403 });
    const has = (k) => Boolean(String(process.env[k] || '').trim());
    const keys = [
      ['SESSION_SECRET', true], ['BOT_MONGO_URL', true], ['DISCORD_BOT_TOKEN', true], ['DISCORD_CLIENT_ID', true],
      ['DISCORD_CLIENT_SECRET', true], ['DISCORD_REDIRECT_URI', true], ['NEXT_PUBLIC_BASE_URL', true],
      ['CRON_SECRET', false], ['YOUTUBE_API_KEY', false], ['WEBSUB_CALLBACK_BASE_URL', false],
      ['TWITCH_CLIENT_ID', false], ['TWITCH_CLIENT_SECRET', false], ['TIKTOK_CLIENT_KEY', false],
      ['TIKTOK_CLIENT_SECRET', false], ['STREAMS_TOKEN_KEY', false],
    ];
    return json({ items: keys.map(([name, required]) => ({ name, required, set: has(name) })) });
  }

  // Owner-only: the switch for the message Wody posts when it is added to a server.
  if (path === 'owner/bot-welcome') {
    const session = await getSession();
    if (!session?.user) return json({ error: 'unauthenticated' }, { status: 401 });
    if (session.user.id !== OWNER_ID) return json({ error: 'forbidden' }, { status: 403 });
    return json({ ...(await getBotWelcomeConfig()), is_owner: true }, { headers: { 'Cache-Control': 'no-store' } });
  }

  // Joined / left lists. Both are built from what the bot recorded
  // (bot_guild_joins / bot_guild_leaves) and then reconciled with the other
  // collection and with Discord's live list, so a server that was added and
  // later removed does not stay in "joined", and a server that left and came
  // back does not stay in "left". Names come from the live list when it is
  // available (a rename after joining used to keep showing the old name).
  if (path === 'owner/guilds/joined-7d' || path === 'owner/guilds/left-7d') {
    const session = await getSession();
    if (!session?.user) return json({ error: 'unauthenticated' }, { status: 401 });
    if (session.user.id !== OWNER_ID) return json({ error: 'forbidden' }, { status: 403 });
    const db = await getDb();
    // Fixed UTC cutoff, 7 full days back, same window for every viewer.
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
        // Removed after it joined -> not a current new server.
        if (other && other > at) continue;
        if (liveById && !liveById.has(id)) continue;
      } else {
        // Added again after it left -> it is back, not "left".
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

  // --------- Owner: server enforcement / guild bans ---------
  if (path === 'owner/guild-bans') {
    const session = await getSession();
    if (!session?.user) return json({ error: 'unauthenticated' }, { status: 401 });
    if (session.user.id !== OWNER_ID) return json({ error: 'forbidden' }, { status: 403 });
    const db = await getDb();
    const bans = await db.collection('guild_bans').find({}).sort({ updated_at: -1 }).toArray();
    return json({ bans: bans.map(serializeDoc), is_owner: true });
  }

  // --------- Owner: direct-message a single server's owner ---------
  // Read side: resolves who the DM would actually go to before the owner
  // hits send, and surfaces the last time this server was messaged (if
  // ever) so a repeat message is a deliberate choice, not an accident.
  // owner_id here always comes fresh from Discord (getBotGuild), never
  // from anything client-supplied or cached from a previous guild's
  // response, so this can never be tricked into messaging the wrong
  // person by a stale or mismatched guildId.
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
      // getGuildMember() resolves and returns a display name string (nick,
      // then global_name, then username), not a member/user object, it
      // was written for name-only display elsewhere (tickets, leaderboard)
      // and there is no avatar hash to read off it. No avatar is fetched
      // here at all, by design: username + ID is enough to confirm who a
      // DM would go to, and it means no extra Discord request/cache entry
      // just to render a picture.
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

  // --------- Owner panel delegated access (owner only) ---------
  if (path === 'owner/access') {
    const session = await getSession();
    if (!session?.user) return json({ error: 'unauthenticated' }, { status: 401 });
    if (session.user.id !== OWNER_ID) return json({ error: 'forbidden' }, { status: 403 });
    const r = await listAccess(await getDb(), session, request);
    return json(r.body, { status: r.status });
  }

  // --------- User's premium status (self) ---------
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

    // Economy, Blackjack, Birthdays, Stream Notifications (lib/modules).
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
        // true when Discord could not be reached for the lists: the client retries
        // instead of showing "no channels" for a server that has them.
        incomplete: !channelsResult.ok || !rolesResult.ok,
        // 0 = text, 5 = announcement, 2 = voice, 4 = category
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
      // The three lookups here don't depend on each other, so they all start
      // now and are awaited together below (this used to be three round trips
      // one after the other: Mongo, then Discord, then Mongo again).
      const growthReq = db.collection('guild_growth_daily').findOne({ guild_id: gidLong, date: today });
      // Member count: cached briefly per server, see getBotGuildCounts in lib/discord.js.
      const freshGuildReq = getBotGuildCounts(guildId).catch(() => null);

      // Member growth history for the sidebar chart. Range is selectable
      // from the dashboard (7/14/30/60/90 days via ?days=), defaulting to
      // 14 to match the chart's previous fixed behavior. Restricted to a
      // fixed allow-list rather than trusting an arbitrary ?days= value,
      // guild_growth_daily has no TTL (see db.py, "kept here indefinitely"),
      // so nothing structurally caps a huge requested range, but there's
      // also no reason for the dashboard to ever need more than 90 days of
      // daily buckets. Zero-filled for any day with no guild_growth_daily
      // doc so the client never has to guess about gaps.
      // One $in query instead of one lookup per day.
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

    // Premium extras of the "Server information" card on the General tab (see
    // ServerGlanceCard in the dashboard). Everything it needs in one
    // call, computed from data that already exists elsewhere in this file
    // (open tickets, recent errors) plus a moderation count read from the
    // bot's own mod_logs collection (cogs/moderation.py's log_action(),
    // written on every /ban, /kick, /timeout and /warn, already
    // populated today, nothing on the bot side needed to change for this).
    // Note this only sees moderator-issued slash commands: automod's own
    // automatic punishments (cogs/automod.py) don't call log_action and
    // so aren't counted here yet.
    // Free servers get a minimal { premium: false } so this can also
    // drive the "give me premium" card without ever computing or
    // exposing the real numbers to a server that hasn't paid for them.
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
      // mod_logs.action is a human-readable string set by log_action() in
      // cogs/moderation.py ("Ban", "Kick", "Timeout", "Warn", plus several
      // others this card doesn't surface: Unban, Untimeout, ClearWarns,
      // Purge, Delete, Slowmode, Lock, Unlock). "Timeout" is Discord's own
      // name for what the card labels "Mutes", matching the /timeout
      // command elsewhere on the dashboard and in Discord's own UI.
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
        level_message: '🎉 {user.mention} reached **level {level}**!', level_up_embed: true,
        level_enabled: true, level_ignored_channel_ids: [],
        // No format on existing docs is treated by the bot as legacy. These
        // defaults only make a newly-created dashboard view predictable.
        level_message_format: 'legacy', level_card_background_url: null,
        level_card_overlay_color: '#111827', level_card_overlay_opacity: 55,
        level_card_text_color: '#ffffff', level_card_color: '#57F287',
        level_card_avatar_ring: true, level_card_font: 'default',
        level_image_mode: 'none', level_image_url: null,
        ticket_transcript_channel_id: null,
        temp_voice_hub_channel_id: null, temp_voice_category_id: null,
        temp_voice_name_template: null, temp_voice_default_user_limit: null,
        // Per-module master on/off switches (sidebar toggles). This default
        // only fires when there is truly no guild_settings doc yet (a
        // brand-new guild the bot hasn't finished syncing), matches
        // db.py's get_settings(), which seeds every module key to False on
        // creation, so a new server starts fully opted-out.
        // IMPORTANT: this is NOT the "missing key" fallback used elsewhere.
        // Once a guild_settings doc exists (the normal case, the bot's
        // on_guild_join calls get_settings() immediately), a key that's
        // absent from its module_states is treated as ENABLED, both by the
        // bot (db.py is_module_enabled(), default True) and by the
        // frontend (isModuleOn() in page.js, `moduleStates[key] !== false`).
        // Never flip that other default back to False, it would silently
        // disable every module on every pre-existing server.
        // Lookups is on from the start (it only answers when a member asks); every other module starts off. Mirrors DEFAULT_ON_MODULES in the bot's db.py.
        module_states: Object.fromEntries(MODULE_TOGGLE_KEYS.map((key) => [key, key === 'lookups'])),
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
        button_emoji: '✅',
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
        // Empty = bot uses its own built-in default text (see
        // cogs/automod.py's _punish/_log). Configurable from the
        // dashboard's Logging panel, stored here since automod.py already
        // has this exact document loaded as `cfg` at punishment time, no
        // extra DB round-trip needed to read them.
        warn_message: '', timeout_message: '', unmute_message: '', kick_message: '', ban_message: '',
      }));
    }

    if (sub === 'auto_responses') {
      const list = await db.collection('auto_responses').find({ guild_id: gidLong }).toArray();
      // Premium servers are unlimited (PREMIUM_UNLIMITED), free servers keep the free auto-response
      // allowance (1 -> 3), same multiplier used for the other creation limits.
      const premium = await isGuildPremium(db, gidLong);
      const limit = premium ? PREMIUM_UNLIMITED : FREE_AUTO_RESPONSE_LIMIT;
      return json({ items: list.map(serializeDoc), limit, is_premium: premium });
    }

    if (sub === 'custom_commands') {
      const list = await db.collection('custom_commands').find({ guild_id: gidLong }).toArray();
      // Premium servers are unlimited (PREMIUM_UNLIMITED), free servers keep the free custom-command
      // allowance (1 -> 3), same multiplier used for the other creation limits.
      const premium = await isGuildPremium(db, gidLong);
      const limit = premium ? PREMIUM_UNLIMITED : FREE_CUSTOM_COMMAND_LIMIT;
      return json({ items: list.map(serializeDoc), limit, is_premium: premium });
    }

    if (sub === 'reaction_roles') {
      const list = await db.collection('reaction_roles').find({ guild_id: gidLong }).sort({ created_at: -1 }).toArray();
      const latest = list[0]?.created_at ? new Date(list[0].created_at).getTime() : 0;
      const cooldownRemaining = latest ? Math.max(0, 10 * 60 - Math.floor((Date.now() - latest) / 1000)) : 0;
      // Premium servers are unlimited (PREMIUM_UNLIMITED), free servers keep the free reaction-role
      // panel allowance (1 -> 3), same multiplier as ticket panels above.
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
          // Only the count is meant to reach the website, never the actual
          // participant list (that stays server-side / bot-side only).
          // `participants` has always defaulted to [] on creation, so this
          // works the same for giveaways made before this field existed.
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
      // General Error Log: the 15 most recent module_errors for THIS guild
      // only (see helpers.record_module_error in the bot), strictly scoped
      // by gidLong exactly like every other guild-scoped query in this file,
      // one server can never see another server's errors.
      const errors = await db.collection('module_errors').find({ guild_id: gidLong }).sort({ created_at: -1 }).limit(15).toArray();
      return json({ errors: errors.map(serializeDoc) });
    }

    if (sub === 'tickets') {
      const panels = await db.collection('ticket_panels').find({ guild_id: gidLong }).toArray();
      const tickets = await db.collection('tickets').find({ guild_id: gidLong, closed: { $ne: true } }).limit(50).toArray();
      const nameMap = await getGuildMembersMap(guildId, tickets.map((t) => t.user_id));

      // Ticket reviews (star rating + optional comment). A review DM is sent
      // to the ticket OPENER whenever their ticket is closed or deleted,
      // regardless of who closes/deletes it (opener, ticket manager role, or
      // any moderator), see _maybe_request_review in cogs/tickets.py, wired
      // into both the legacy V1 Close button and every V2 Close/Delete path.
      // This collection was never queried here before, so it only ever
      // showed up via the Discord /ticket-reviews command, admins checking
      // the website saw nothing for any server.
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

      // Premium servers are unlimited (PREMIUM_UNLIMITED), free servers keep the free ticket-panel
      // allowance (1 -> 3). max_panels/is_premium come from the backend so
      // the UI's "X / max" display and the limit actually enforced on
      // POST /tickets/panels below can never drift apart.
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
      // `xp` is only the XP remaining *within the current level* (it resets
      // close to 0 on every level-up, see the bot's cogs/levels.py
      // on_message), not a lifetime total. Sorting by "xp" alone can rank a
      // level-0 member with a lot of un-leveled xp above a level-4 member
      // who just leveled up and has near-zero xp. Sort by (level, xp) so
      // rank matches actual progression, mirrors the bot's own
      // /leaderboard command.
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
      // Sorted by _id (insertion order) descending: a guild that has
      // activated premium more than once (a previous key that expired or
      // was replaced) has several documents here, only the newest is the
      // one that matters. Without this sort, findOne() has no guarantee of
      // returning the newest one, Mongo's natural document order is not
      // insertion order, especially once a document has been updated in
      // place (which every activation does to every OLDER doc, flipping
      // its `active` field to false). A guild could activate a brand new
      // key, get the bot's own success message, and still see "no
      // premium" here if an old document happened to come back instead.
      const doc = await db.collection('premium_servers').findOne({ guild_id: gidLong }, { sort: { _id: -1 } });
      if (!doc) return json({ premium: null });
      // The name is a nice-to-have: a slow or rate-limited Discord call must never turn a
      // premium server into "no premium" on the dashboard.
      const activatedByName = await getGuildMember(guildId, String(doc.activated_by)).catch(() => null);
      return json({ premium: { ...serializeDoc(doc), activated_by_name: activatedByName } });
    }

    // --------- Backups: list + cooldown status, THIS guild only ---------
    if (sub === 'backups') {
      const backups = await db.collection('backups')
        .find({ guild_id: gidLong })
        .project({ 'data': 0 }) // never ship the raw snapshot payload to the browser
        .sort({ created_at: -1 })
        .limit(5)
        .toArray();
      // Newer backups already carry created_by_name (set by the bot at
      // creation time). Older backups predate that field, so resolve it
      // here for any that are missing it, same live-lookup pattern used
      // for tickets/levels/premium above, instead of showing the raw id.
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

    // --------- YouTube video notifications: settings + watched channels,
    // THIS guild only. Premium-only feature (see docs/YOUTUBE_NOTIFY.md):
    // 1 target Discord channel, up to YOUTUBE_NOTIFY_MAX_CHANNELS YouTube
    // channels feeding it. Uses YouTube's own documented WebSub (push)
    // mechanism only, no scraping, no polling of youtube.com. ---------
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

    // --------- Settings audit trail, THIS guild only ---------
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

    // --------- Scheduled Messages: list, THIS guild only ---------
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

  // Public, unauthenticated, read-only: every visitor's browser needs this
  // to know whether to render the decorative Autumn layer at all. Cached
  // server-side (see lib/autumn.js) so this never becomes a per-request
  // Mongo hit, same public/owner-only split as status/bot and updates
  // above.
  if (path === 'site/autumn') {
    const config = await getAutumnConfig();
    // Deliberately no-store: the owner toggling this in the panel needs
    // it to take effect (and take OFF-effect) immediately for every
    // visitor, including on an instant refresh. A browser-level
    // Cache-Control here previously let a stale response win for up to
    // 30-150s after a save. That's safe to do because the actual
    // expensive part (Mongo) is already cached server-side in
    // getAutumnConfig() via unstable_cache + revalidateTag(AUTUMN_CACHE_TAG)
    // on save, this route still never hits the DB on a normal request,
    // it just stops the browser from also caching on top of that.
    return json(config, { headers: { 'Cache-Control': 'no-store' } });
  }

  // Public, unauthenticated, read-only: every visitor's browser needs this
  // to know whether to render a decorative seasonal layer at all, and
  // which one (Autumn/Winter/Halloween). Cached server-side (see
  // lib/season-effects.js) so this never becomes a per-request Mongo hit.
  // This is the successor to 'site/autumn' just above, which is left in
  // place (unused by the frontend now, but harmless) rather than removed,
  // see lib/season-effects.js's own comment for why.
  if (path === 'site/season-effects') {
    const config = await getSeasonConfig();
    // Deliberately no-store, same reasoning as 'site/autumn' above: the
    // owner toggling this in the panel needs it to take effect (and
    // take OFF-effect) immediately for every visitor, including on an
    // instant refresh. Safe to do because the expensive part (Mongo) is
    // already cached server-side via unstable_cache + revalidateTag.
    return json(config, { headers: { 'Cache-Control': 'no-store' } });
  }

  return json({ error: 'not_found', path }, { status: 404 });
}

// Global safety net: without this, any unexpected exception anywhere inside
// handleGet's ~400 lines (a bad DB query, a null deref on a Discord API
// response, etc.) escapes as an unhandled rejection and Next.js turns it
// into an opaque 500 HTML error page instead of the JSON error shape every
// client-side caller expects. This does NOT change any authorization or
// per-guild logic inside handleGet, it only catches what would otherwise
// crash uncaught.
export async function GET(request, context) {
  try {
    return await handleGet(request, context);
  } catch (e) {
    console.error('Unhandled error in GET', e);
    return json({ error: 'internal_error' }, { status: 500 });
  }
}

// Same safety net for POST/PUT/PATCH/DELETE, all of which funnel through
// handleMutation (~800 lines covering 50+ routes). One unhandled exception
// anywhere in there previously meant an unhandled promise rejection instead
// of a clean JSON error, this wrapper is the only change; handleMutation's
// internal logic (guild/channel/role ownership checks, per-guild scoping,
// owner-only gates, etc.) is untouched.
async function safeHandleMutation(request, context) {
  // A copy of the request is kept so the audit entry below can describe what
  // was sent (for example the text of a message) after the handler has read it.
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

// Owner-level routes whose every change goes to the private audit channel
// (who, what, result). Delegated community access has its own audit in
// lib/community/api-admin.js and lib/owner-access.js, login is audited at sign in.
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
  // Every mutation in this app is issued by the dashboard's own browser
  // fetch() calls, which always send an Origin header for same-origin
  // POST/PUT/PATCH/DELETE requests in every modern browser, there is no
  // legitimate <form>, curl, or server-to-server caller of these routes.
  // A missing Origin header on a mutation is therefore itself suspicious
  // (e.g. some non-browser HTTP client replaying a stolen/forged request)
  // and is rejected outright, rather than passed through. SameSite=Lax on
  // the session cookie remains a second, independent line of defense.
  if (!origin) return false;
  const base = process.env.NEXT_PUBLIC_BASE_URL;
  if (!base) return true;
  try {
    // Normalize away a leading "www." on either side. NEXT_PUBLIC_BASE_URL
    // is a single value (e.g. "https://wody.online"), but the site may
    // actually be reached at "https://www.wody.online" (or vice versa)
    // depending on DNS/redirect setup, without this, every mutating
    // request (PUT/PATCH/POST/DELETE) gets rejected as forbidden_origin
    // even though it's a perfectly legitimate same-site request.
    const normalize = (h) => h.replace(/^www\./, '');
    return normalize(new URL(origin).host) === normalize(new URL(base).host);
  } catch {
    return false;
  }
}

async function handleMutation(request, context) {
  if (!isTrustedOrigin(request)) {
    return json({ error: 'forbidden_origin' }, { status: 403 });
  }

  const params = await context.params;
  const path = (params?.path || []).join('/');
  const method = request.method;

  // Sign out: a POST from this site's own page (trusted origin checked above). Nothing else ends a session.
  if (path === 'auth/logout' && method === 'POST') {
    await clearSession();
    return json({ ok: true });
  }

  // Keyed by the session only. A network address is never used, so people behind a VPN or a shared network are not mixed together.
  const rateKey = request.cookies?.get?.('wody_session')?.value || 'anon';

  // request.json() resolves fine for literal JSON `null`/numbers/arrays too
  // (not just malformed JSON, which .catch already handles), without this
  // guard, body.anything below would throw on a body of literal `null`.
  const rawBody = await request.json().catch(() => ({}));
  const body = (rawBody && typeof rawBody === 'object' && !Array.isArray(rawBody)) ? rawBody : {};
  const db = await getDb();

  if (await rateLimited(db, rateKey)) {
    return json({ error: 'rate_limited' }, { status: 429 });
  }

  // -------- Owner: delegated panel access (verify, grant, revoke) --------
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

  // -------- Owner: server enforcement mutations --------
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

    // Persist FIRST. If Discord is temporarily unavailable, the ban remains
    // authoritative and can be retried safely by banning again.
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

    // Persisted alongside the ban itself, not just used for the DM/leave
    // call below, specifically so the owner-only dashboard can keep
    // showing this server's name and icon in the banned-servers list AFTER
    // Wody leaves it. Without this, a banned server would vanish from
    // /api/premium/all-servers the moment the bot left, and the ban would
    // become invisible in the UI even though it's still fully enforced
    // server-side (see cogs/guild_enforcement.py), the owner would have no
    // way to find it again in order to unban it later.
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

  // -------- Owner: direct-message a single server's owner (write side) --------
  // Deliberately NOT under the guildMatch/guardGuildAccess block above:
  // that guard checks whether the SESSION's user can manage the guild,
  // which is irrelevant here, the owner-panel operator can message the
  // owner of any server the bot is in, not just servers they personally
  // manage. Same owner_id === OWNER_ID check as every other owner-only
  // route in this file, checked again here even though the UI that calls
  // this is already hidden from non-owners, exactly like guild-bans above.
  const messageOwnerMatch = path.match(/^owner\/guilds\/(\d+)\/message-owner$/);
  if (messageOwnerMatch && method === 'POST') {
    const session = await getSession();
    if (!session?.user) return json({ error: 'unauthenticated' }, { status: 401 });
    if (session.user.id !== OWNER_ID) return json({ error: 'forbidden' }, { status: 403 });
    const [, guildId] = messageOwnerMatch;

    const message = typeof body.message === 'string' ? body.message.trim() : '';
    if (!message) return json({ error: 'empty_message' }, { status: 400 });
    // Discord's own hard cap on a single message's content.
    if (message.length > 2000) return json({ error: 'message_too_long' }, { status: 400 });

    // Resolved fresh from Discord every time, right before sending, never
    // trust an owner_id the client might pass, and never reuse one from an
    // earlier lookup. A server can change hands; this way the DM always
    // goes to whoever actually owns it at the moment Send is pressed.
    const guild = await getBotGuild(guildId).catch(() => null);
    if (!guild?.owner_id) return json({ error: 'owner_not_found' }, { status: 404 });

    try {
      await sendDirectMessage(guild.owner_id, { content: message });
    } catch (e) {
      // Most common cause: the owner has server/DM privacy settings that
      // block messages from this bot, or shares no server with it apart
      // from the one being messaged about and has DMs closed entirely.
      // Nothing is logged below in this case, so the composer can be
      // retried without it looking like a duplicate send.
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

  // -------- Premium: generate key (owner-only) --------
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

  // -------- Premium: revoke key (owner-only) --------
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
    // Revoking a key must not leave a server sitting in the "active
    // premium" list backed by a now-dead key, pull it out immediately
    // instead of waiting for the next expiry check to notice.
    const serversRemoved = await deactivateServersForKey(db, keyValue, 'key_revoked');
    await logPremiumAudit(db, 'revoke_key', session.user.id, { key: keyValue, servers_removed: serversRemoved });
    return json({ ok: true, servers_removed: serversRemoved });
  }

  // -------- Premium: remove premium from a server (owner-only) --------
  // Moved from the Discord "/removepremium" command, same effect: marks
  // every active premium_servers doc for that guild as inactive/suspended.
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
    // Vice-versa of the revoke case above: if the key(s) that were backing
    // this server no longer back ANY other active server, treat the key as
    // spent and revoke it too, otherwise it would silently still work if
    // pasted into another server later. Keys that still back other active
    // servers (activations_limit > 1, used on multiple guilds) are left
    // untouched, since removing one server shouldn't kill the others.
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

  // -------- Updates: post a changelog / announcement entry (owner-only) --------
  if (path === 'updates' && method === 'POST') {
    const session = await getSession();
    if (!session?.user || session.user.id !== OWNER_ID)
      return json({ error: 'forbidden' }, { status: 403 });
    const title = stripEmoji(body.title).slice(0, 150);
    const content = stripEmoji(body.body).slice(0, 5000);
    const tag = String(body.tag || 'Update').trim().slice(0, 40) || 'Update';
    if (!title || !content) return json({ error: 'invalid' }, { status: 400 });
    const item = {
      title,
      body: content,
      tag,
      created_by: toLong(session.user.id) || Long.ZERO,
      created_at: new Date(),
    };
    const r = await db.collection('updates').insertOne(item);
    const saved = { ...item, _id: r.insertedId };

    // Mirror the update as an embed in the fixed Wody updates channel
    // (UPDATES_ANNOUNCE_CHANNEL_ID, defined above). Best-effort: if the
    // bot can't post there right now (missing permission, transient
    // Discord issue), the update itself is still saved and already live
    // on the website, a failed Discord mirror should never undo that or
    // fail this request.
    let discordPosted = false;
    try {
      await sendGuildMessage(UPDATES_ANNOUNCE_CHANNEL_ID, embedToV2Payload(updateEmbed(saved)));
      discordPosted = true;
    } catch (e) {
      console.error('updates: failed to post Discord announcement', e);
    }

    return json({ ...serializeDoc(saved), discord_posted: discordPosted });
  }

  // -------- Updates: delete a changelog / announcement entry (owner-only) --------
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

  // -------- Blog: create a post (owner-only) --------
  if (path === 'blog' && method === 'POST') {
    const session = await getSession();
    if (!session?.user || session.user.id !== OWNER_ID) return json({ error: 'forbidden' }, { status: 403 });
    const parsed = parseBlogPostInput(body, { partial: false });
    if (!parsed.ok) return json({ error: parsed.error }, { status: 400 });
    const baseSlug = parsed.patch.slug || slugify(parsed.patch.title) || 'post';
    const slug = await ensureUniqueSlug(db, baseSlug);
    const published = parsed.patch.published !== false; // defaults to published
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

  // -------- Blog: update a post (owner-only) --------
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
    // Going from unpublished to published for the first time stamps
    // published_at now, re-publishing an already-published post (or just
    // editing other fields) leaves its original publish date alone, so
    // the post doesn't jump to the top of the newest-first list just
    // because it was tweaked.
    if (patch.published === true && !existing.published_at) {
      patch.published_at = new Date();
    }

    await db.collection(BLOG_COLLECTION).updateOne({ _id: objId }, { $set: patch });
    const updated = await db.collection(BLOG_COLLECTION).findOne({ _id: objId });
    return json(serializeDoc(updated));
  }

  // -------- Partners: create / update / delete (owner-only) --------
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

  // -------- Blog: delete a post (owner-only) --------
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

  // -------- Staff: add a team member (owner-only) --------
  if (path === 'staff' && method === 'POST') {
    const session = await getSession();
    if (!session?.user || session.user.id !== OWNER_ID) return json({ error: 'forbidden' }, { status: 403 });
    const parsed = parseStaffInput(body, { partial: false });
    if (!parsed.ok) return json({ error: parsed.error }, { status: 400 });
    // Cheap safety net beyond the owner panel's own "look up before
    // adding" step (GET staff/lookup/:id): refuses to save an id that
    // doesn't actually resolve to a real Discord account at all, rather
    // than silently adding a team member who can never show up on the
    // public page (getDiscordUserById returning null there just skips
    // them, no error, which would otherwise look like this endpoint
    // silently did nothing).
    const user = await getDiscordUserById(parsed.patch.discord_user_id).catch(() => null);
    if (!user) return json({ error: 'discord_user_not_found' }, { status: 400 });
    const item = { ...parsed.patch, position: parsed.patch.position ?? 0, hierarchy_position: parsed.patch.hierarchy_position ?? 0, created_at: new Date() };
    const r = await db.collection(STAFF_COLLECTION).insertOne(item);
    return json(serializeDoc({ ...item, _id: r.insertedId }));
  }

  // -------- Staff: update a team member (owner-only) --------
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

  // -------- Staff: remove a team member (owner-only) --------
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

  // -------- Appearance: Autumn seasonal effects config (owner-only write;
  // the read side of this is public, see 'site/autumn' in handleGet). A
  // single global document, not per-guild, so it's handled here alongside
  // the other global owner routes (premium/generate, updates, guild-bans)
  // rather than inside the guilds/:id block below. --------
  if (path === 'site/autumn' && (method === 'PUT' || method === 'PATCH')) {
    const session = await getSession();
    if (!session?.user) return json({ error: 'unauthenticated' }, { status: 401 });
    if (session.user.id !== OWNER_ID) return json({ error: 'forbidden' }, { status: 403 });
    const parsed = parseAutumnPatch(body);
    if (!parsed.ok) return json({ error: parsed.error }, { status: 400 });
    const config = await saveAutumnPatch(parsed.patch, session.user.id);
    return json(config);
  }

  // -------- Appearance: Seasonal effects config (Autumn/Winter/Halloween),
  // owner-only write; the read side is public, see 'site/season-effects'
  // in handleGet. Successor to 'site/autumn' just above (left in place,
  // unused by the panel now, see lib/season-effects.js for why). --------
  if (path === 'site/season-effects' && (method === 'PUT' || method === 'PATCH')) {
    const session = await getSession();
    if (!session?.user) return json({ error: 'unauthenticated' }, { status: 401 });
    if (session.user.id !== OWNER_ID) return json({ error: 'forbidden' }, { status: 403 });
    const parsed = parseSeasonPatch(body);
    if (!parsed.ok) return json({ error: parsed.error }, { status: 400 });
    const config = await saveSeasonPatch(parsed.patch, session.user.id);
    return json(config);
  }

  // -------- Community showcase settings (owner-only write; public read is
  // baked into 'status/showcase' in handleGet, this route only exists so
  // the owner panel can change minMembers/maxDisplay without a redeploy).
  // Same global-document pattern as site/autumn above. --------
  if (path === 'site/community-showcase' && (method === 'PUT' || method === 'PATCH')) {
    const session = await getSession();
    if (!session?.user) return json({ error: 'unauthenticated' }, { status: 401 });
    if (session.user.id !== OWNER_ID) return json({ error: 'forbidden' }, { status: 403 });
    const parsed = parseShowcasePatch(body);
    if (!parsed.ok) return json({ error: parsed.error }, { status: 400 });
    const config = await saveShowcasePatch(parsed.patch, session.user.id);
    return json(config);
  }

  // -------- Wody's welcome message when it is added to a server (owner-only write) --------
  if (path === 'owner/bot-welcome' && (method === 'PUT' || method === 'PATCH')) {
    const session = await getSession();
    if (!session?.user) return json({ error: 'unauthenticated' }, { status: 401 });
    if (session.user.id !== OWNER_ID) return json({ error: 'forbidden' }, { status: 403 });
    if (!body || typeof body.guild_join_welcome !== 'boolean') return json({ error: 'invalid_body' }, { status: 400 });
    const config = await saveBotWelcomeConfig(body.guild_join_welcome, session.user.id);
    return json({ ...config, is_owner: true });
  }

  // -------- Promo banner settings (owner-only write) --------
  // Everything about the banner (whether it's on, its image, its
  // button's text and destination) is owner-controlled from here. Public
  // read is the GET 'site/promo-banner' above, fetched client-side by
  // DashboardPromoBanner on every server's dashboard Overview tab.
  if (path === 'site/promo-banner' && (method === 'PUT' || method === 'PATCH')) {
    const session = await getSession();
    if (!session?.user) return json({ error: 'unauthenticated' }, { status: 401 });
    if (session.user.id !== OWNER_ID) return json({ error: 'forbidden' }, { status: 403 });
    const parsed = parsePromoBannerPatch(body);
    if (!parsed.ok) return json({ error: parsed.error }, { status: 400 });
    const config = await savePromoBannerPatch(parsed.patch, session.user.id);
    return json(config);
  }

  // -------- Footer social links (owner-only write) --------
  if (path === 'site/footer-socials' && (method === 'PUT' || method === 'PATCH')) {
    const session = await getSession();
    if (!session?.user) return json({ error: 'unauthenticated' }, { status: 401 });
    if (session.user.id !== OWNER_ID) return json({ error: 'forbidden' }, { status: 403 });
    const parsed = parseFooterSocials(body);
    if (!parsed.ok) return json({ error: parsed.error, errors: parsed.errors || [] }, { status: 400 });
    const config = await saveFooterSocials(parsed.links, session.user.id);
    return json(config);
  }

  // -------- Countdown banner settings (owner-only write) --------
  // The site-wide top bar (see components/countdown-banner.jsx). Public
  // read is the GET 'site/countdown-banner' above.
  if (path === 'site/countdown-banner' && (method === 'PUT' || method === 'PATCH')) {
    const session = await getSession();
    if (!session?.user) return json({ error: 'unauthenticated' }, { status: 401 });
    if (session.user.id !== OWNER_ID) return json({ error: 'forbidden' }, { status: 403 });
    const parsed = parseCountdownBannerPatch(body);
    if (!parsed.ok) return json({ error: parsed.error }, { status: 400 });
    const config = await saveCountdownBannerPatch(parsed.patch, session.user.id);
    return json(config);
  }

  // -------- Discord/social link-preview embed content (owner-only
  // write). Public read is the GET 'site/og-embed' above (owner panel's
  // edit form); app/opengraph-image.js reads the config directly. --------
  if (path === 'site/og-embed' && (method === 'PUT' || method === 'PATCH')) {
    const session = await getSession();
    if (!session?.user) return json({ error: 'unauthenticated' }, { status: 401 });
    if (session.user.id !== OWNER_ID) return json({ error: 'forbidden' }, { status: 403 });
    const parsed = parseOgEmbedPatch(body);
    if (!parsed.ok) return json({ error: parsed.error }, { status: 400 });
    const config = await saveOgEmbedPatch(parsed.patch, session.user.id);
    return json(config);
  }

  // -------- Careers page roles (owner-only write). Public read is the
  // GET 'site/careers-roles' above. --------
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

  // Economy, Blackjack, Birthdays, Stream Notifications (lib/modules).
  if (isModuleRoute(sub)) {
    const handled = await handleModuleMutation({
      sub, method, body, db, gidLong, guildId, session: guard.session, guild: guard.guild, h: moduleHelpers(),
    });
    if (handled) return handled;
  }

  // -------- Premium: activate a key on this guild --------
  if (sub === 'premium/activate' && method === 'POST') {
    const session = await getSession();
    const rawKey = String(body.key || '').trim().toUpperCase();
    if (!rawKey) return json({ error: 'missing_key' }, { status: 400 });

    // Check-and-consume a single activation slot atomically. Doing this as
    // one findOneAndUpdate (instead of a separate findOne check followed by
    // a later $inc) closes a race where two activations of the same
    // near-exhausted key, submitted at nearly the same time, could both
    // pass the "still has slots" check before either write landed, letting
    // a key get used on more guilds than its activations_limit allows. The
    // $expr re-checks activations_used < activations_limit at the exact
    // moment of the write, so if a concurrent request already consumed the
    // last slot, this one simply matches no document instead of double-
    // spending it.
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
      // The atomic step above is the source of truth for authorization,
      // this second read is only to tell the caller *why* it failed, not
      // to re-decide anything, so a benign race here (key state changing
      // between the two reads) can only affect the error message, never
      // whether an activation is granted.
      const doc = await db.collection('premium_keys').findOne({ key: rawKey });
      if (!doc) return json({ error: 'invalid_key' }, { status: 404 });
      if (doc.revoked) return json({ error: 'revoked' }, { status: 400 });
      if (doc.expires_at && new Date(doc.expires_at) < now) return json({ error: 'expired' }, { status: 400 });
      return json({ error: 'exhausted' }, { status: 400 });
    }

    // Deactivate any prior premium on this guild (single-active model)
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

  // -------- Module master on/off switch (dashboard sidebar toggle) --------
  // Deliberately its own tiny endpoint rather than folded into the generic
  // `settings` PATCH: a single-key $set via dot notation makes this an
  // atomic, race-free flip regardless of what else is mid-save on the
  // settings doc, and the client never has to fetch-merge-resend the whole
  // module_states object just to flip one switch.
  if (sub === 'modules/toggle' && method === 'POST') {
    const session = await getSession();
    const key = String(body.key || '').trim();
    const enabled = !!body.enabled;

    if (!MODULE_TOGGLE_KEYS.includes(key)) {
      return json({ error: 'invalid_module', field: 'key' }, { status: 400 });
    }

    // Server-side mirror of the same check the dashboard UI already does
    // before calling this endpoint, enforced here too because a client-side
    // check alone can be bypassed by calling this route directly. Only
    // blocks turning a premium-only module ON; disabling one is always fine.
    if (enabled && PREMIUM_ONLY_TOGGLE_KEYS.has(key)) {
      const premium = await isGuildPremium(db, gidLong);
      if (!premium) {
        return json({ error: 'premium_required', field: 'key' }, { status: 403 });
      }
    }

    const filter = { guild_id: gidLong };
    // One atomic step returns the state from BEFORE this write. A separate read followed by a
    // write let two quick switches (on, off) both read the same old state, so the second one
    // never saw a change and skipped the baseline reset below.
    const existing = await db.collection('guild_settings').findOneAndUpdate(
      filter,
      { $set: { [`module_states.${key}`]: enabled, updated_at: new Date() } },
      { upsert: true, returnDocument: 'before' },
    );
    // Invite Tracking is opt-in: a server that never switched it on counts as off.
    const before = key === 'invite_tracking' ? existing?.module_states?.[key] === true : existing?.module_states?.[key] !== false;
    // Invite counters are only comparable while tracking runs without a gap. Switching the module
    // on or off drops the stored baseline, so the bot takes a fresh one instead of comparing a
    // join with counters from before the switch.
    if (key === 'invite_tracking' && before !== enabled) {
      await db.collection('invite_settings').updateOne(filter, { $unset: { baseline_at: '' } }).catch(() => {});
    }

    // Some modules keep their own "enabled" flag inside their own settings
    // document (welcome_settings.enabled, goodbye_settings.enabled,
    // captcha_settings.enabled, guild_settings.level_enabled), separate
    // from module_states above. That
    // used to mean flipping the sidebar switch ON did nothing on its own,
    // the module still looked "off" until someone opened its page and
    // flipped a second, module-local switch by hand. The sidebar switch is
    // the one true "is this module on" control, so every time it changes we
    // also mirror it into the module's own flag here, server-side, so both
    // switches can never disagree regardless of which UI changed them.
    if (key === 'welcome') {
      await db.collection('welcome_settings').updateOne(filter, { $set: { enabled, updated_at: new Date() } }, { upsert: true });
    } else if (key === 'goodbye') {
      await db.collection('goodbye_settings').updateOne(filter, { $set: { enabled, updated_at: new Date() } }, { upsert: true });
    } else if (key === 'captcha') {
      await db.collection('captcha_settings').updateOne(filter, { $set: { enabled, updated_at: new Date() } }, { upsert: true });
    } else if (key === 'levels') {
      await db.collection('guild_settings').updateOne(filter, { $set: { level_enabled: enabled, updated_at: new Date() } }, { upsert: true });
    } else if (key === 'autorole') {
      // Auto Role has no explicit enabled flag of its own, it is "on"
      // whenever an auto_role_id is set. Nothing to mirror here; the
      // sidebar switch alone (gating the on_member_join handler) is correct.
    }

    // Same audit trail every other settings change gets, so toggling a
    // module off/on shows up in the dashboard's Audit Log module like any
    // other change, not a silent, untracked switch.
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

  // ==================================================================
  // YouTube video notifications, official WebSub push only (no
  // scraping, no browser automation, no simulated YouTube actions).
  // Premium-only. Configuration lives ONLY here (the dashboard), the
  // bot exposes no Discord command to set any of this up.
  // Limits: 1 target Discord channel per guild (structural, one
  // youtube_notify_settings doc per guild), up to
  // YOUTUBE_NOTIFY_MAX_CHANNELS watched YouTube channels feeding it.
  // ==================================================================

  // -------- Set/replace the target Discord channel, and (optionally) the
  // role to ping + a custom message shown above the video embed. mention_role_id
  // and message are both optional, either or both can be left empty, in which
  // case the notification posts exactly as before (embed only, no content line). --------
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
    // Live streams have their own role/message/format (live_* fields); the
    // bot falls back to the video values for any live_* field never saved.
    const liveRoleId = body.live_mention_role_id ? String(body.live_mention_role_id).trim() : null;
    if (liveRoleId && !(await assertRoleInGuild(guildId, liveRoleId))) {
      return json({ error: 'invalid_role' }, { status: 400 });
    }

    // Discord message content cap is 2000 chars; leave headroom for the
    // role mention line the bot prepends on top of this.
    const message = body.message != null ? String(body.message).slice(0, 1800) : '';
    const liveMessage = body.live_message != null ? String(body.live_message).slice(0, 1800) : '';
    // "embed" = the YouTube card (Components v2), "plain" = a simple text
    // message with the video link, which Discord turns into its own player.
    const fmt = (v) => (v === 'plain' ? 'plain' : 'embed');

    // What to notify about, chosen separately: regular uploads (videos and
    // Shorts) and live streams. Both default to on, so a client that does
    // not send these fields keeps the previous behaviour (everything).
    // The bot reads them in cogs/youtube_notify.py (_notify_guilds).
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

  // -------- Remove the target Discord channel: cascades to unsubscribing
  // every watched YouTube channel for this guild (a guild can't keep
  // watching channels with nowhere left to post) --------
  if (sub === 'youtube-notify/discord-channel' && method === 'DELETE') {
    if (!(await youtubeNotifyRateLimit(guildId))) return json({ error: 'rate_limited' }, { status: 429 });
    await unwatchAllYoutubeChannels(db, gidLong);
    await db.collection('youtube_notify_settings').deleteOne({ guild_id: gidLong });
    return json({ ok: true });
  }

  // -------- Add or repair a watched YouTube channel / WebSub subscription --------
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

    // Check for an existing watched channel BEFORE enforcing the limit. A user
    // may submit the same channel again to repair a broken/stale WebSub
    // subscription without creating a duplicate or consuming another slot.
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

    // One shared WebSub subscription per YouTube channel. Reuse a healthy
    // verified subscription, but repair anything stale, incomplete, pending,
    // failed or never actually subscribed.
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

  // -------- Remove a watched YouTube channel: unsubscribes from the hub
  // if no other guild is watching it anymore --------
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
    // guardGuildAccess above only proves "can manage this guild" (Manage
    // Guild or Administrator permission), it does NOT prove this caller is
    // the actual Discord server owner. This route's comment always said
    // "owner of guild only, or global owner" but never actually enforced
    // it, which meant any manager/admin of the guild (not just its owner)
    // could deactivate that server's premium. Enforcing it now: only the
    // guild's real owner (guard.guild.owner, from Discord's own guild list)
    // or the global bot owner (OWNER_ID) may deactivate.
    if (!guard.guild.owner && session?.user?.id !== OWNER_ID) {
      return json({ error: 'forbidden' }, { status: 403 });
    }
    const result = await db.collection('premium_servers').updateMany({ guild_id: gidLong, active: true }, { $set: { active: false } });
    if (result.modifiedCount > 0) {
      // Best-effort, same pattern as upsertOne's audit logging, never fail
      // the actual deactivation if this insert has a problem.
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
      'level_card_avatar_ring', 'level_card_font', 'level_card_size', 'level_card_gradient', 'level_image_mode', 'level_image_url',
      'ticket_transcript_channel_id', 'temp_voice_hub_channel_id', 'temp_voice_category_id',
      'temp_voice_name_template', 'temp_voice_default_user_limit', 'bot_nickname'];
    const data = {};
    for (const k of allowed) if (k in body) data[k] = body[k];
    // The bot's nickname in this server. Applied on Discord right away (the
    // nickname itself lives on Discord); the saved copy only fills the
    // dashboard field. Empty means "use the normal name".
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
    // The server language is one of the supported dashboard languages. Saving
    // it marks it as an explicit choice, so the bot only uses it for messages
    // once an admin actually picked one (older servers carry a legacy default
    // that was never chosen by anyone).
    if (data.level_card_size != null && !['compact', 'balanced', 'banner', 'aurora'].includes(data.level_card_size)) {
      return json({ error: 'invalid_value', field: 'level_card_size' }, { status: 400 });
    }
    if (data.level_card_gradient != null && !['ember', 'aurora', 'sunset', 'ocean', 'neon', 'royal', 'forest', 'midnight'].includes(data.level_card_gradient)) {
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
    // temp_voice_category_id must be an actual category channel (type 4),
    // the same reasoning as assertCategoryInGuild's own comment for
    // tickets: assertChannelFieldsInGuild above only checks the id belongs
    // to this guild, not that it's a category. A text channel id saved
    // here would silently become the `parent_id` the bot tries to create
    // temp voice channels under, which Discord rejects, so every temp
    // channel would end up outside any category with nothing telling the
    // admin why.
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

    // These three are role ids, not channel ids, assertChannelFieldsInGuild
    // above never covered them, so a role from another guild (or garbage
    // input) could be saved silently and later crash toLong()/Long.fromString
    // deep inside upsertOne. Validate each one the same way ticket panels do.
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
    if ('level_card_font' in data && !['default', 'bold'].includes(data.level_card_font)) {
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
    // Same "Image" concept as the welcome/goodbye embeds (see image_mode
    // below): only meaningful for level_message_format === 'embed', but
    // validated unconditionally like every other field here so a stale
    // value from an older format choice never has to be re-validated later.
    if ('level_image_mode' in data) {
      data.level_image_mode = ['server_avatar', 'member_avatar', 'custom', 'none'].includes(data.level_image_mode) ? data.level_image_mode : 'none';
    }
    if ('level_image_url' in data) {
      try { data.level_image_url = sanitizeImageUrl(data.level_image_url); }
      catch { return json({ error: 'invalid_image_url', field: 'level_image_url' }, { status: 400 }); }
    }
    // Master switch for mod-log logging (message edits/deletes, nickname changes, joins/leaves).
    // Kept separate from mod_log_channel_id so the bot can skip all of that
    // work with a single cheap check instead of doing it and discarding the
    // result whenever a channel happens to be set but logging is unwanted.
    if ('mod_log_enabled' in data && typeof data.mod_log_enabled !== 'boolean') {
      return json({ error: 'invalid_boolean', field: 'mod_log_enabled' }, { status: 400 });
    }
    // Per-guild list of channels where XP is blocked. Same validation shape
    // as whitelist_role_ids above: must be an array, deduped, capped, and
    // every id must actually belong to this guild, otherwise a channel id
    // from another guild (or garbage input) could be saved silently and
    // later crash toLong()/Long.fromString deep inside upsertOne.
    if ('level_ignored_channel_ids' in data) {
      if (!Array.isArray(data.level_ignored_channel_ids)) {
        return json({ error: 'invalid_channel_list', field: 'level_ignored_channel_ids' }, { status: 400 });
      }
      data.level_ignored_channel_ids = [...new Set(data.level_ignored_channel_ids.map(String).filter(Boolean))].slice(0, 200);
      if (!(await assertChannelsInGuild(guildId, data.level_ignored_channel_ids))) {
        return json({ error: 'invalid_channel', field: 'level_ignored_channel_ids' }, { status: 400 });
      }
    }
    // Level rewards and role XP bonuses: strict validation, then every role
    // must really belong to THIS guild (same check as the other role lists).
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
    // level_enabled is the Levels module's own local switch, living on the
    // same guild_settings document as module_states, mirror it into
    // module_states.levels in the same $set so the sidebar master switch and
    // this local switch can never disagree, regardless of which one changed.
    if ('level_enabled' in data) data['module_states.levels'] = Boolean(data.level_enabled);
    return json(await upsertOne('guild_settings', guildId, data, { userId: session?.user?.id }));
  }

  // -------- Ticket panels: create from the dashboard --------
  if (sub === 'tickets/panels' && method === 'POST') {
    const session = await getSession();
    const title = String(body.title || 'Tickets').trim().slice(0, 256);
    const description = String(body.description || '').slice(0, 4096);
    const channelId = body.channel_id ? String(body.channel_id) : null;
    const categoryId = body.category_id ? String(body.category_id) : null;
    const supportRoleId = body.support_role_id ? String(body.support_role_id) : null;
    // Panel-wide DEFAULT transcript channel (used by every ticket type that has
    // no channel of its own). The dashboard sends it as
    // transcript_default_channel_id; older API callers only know
    // transcript_channel_id, which is read the same way.
    const transcriptDefaultRaw = 'transcript_default_channel_id' in body ? body.transcript_default_channel_id : body.transcript_channel_id;
    const transcriptId = transcriptDefaultRaw ? String(transcriptDefaultRaw) : null;
    let panelImageUrl;
    try { panelImageUrl = sanitizeImageUrl(body.panel_image_url); }
    catch { return json({ error: 'invalid_image_url', field: 'panel_image_url' }, { status: 400 }); }
    const version = 2;
    if (!title || !channelId) return json({ error: 'missing_required' }, { status: 400 });
    // Free servers: 3 panels max. Premium servers: 3x that (9). Checked here
    // (not just displayed in the UI) so the limit can't be bypassed by
    // calling this endpoint directly.
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

    // The dashboard's create form lets the user configure multiple ticket
    // types (each with its own category/support role/transcript
    // channel/welcome text) before the first save, the same way the Edit
    // form does. This used to be discarded: only body.option_label /
    // body.option_emoji / body.welcome_title / body.welcome_message (fields
    // the create UI never actually sets) were read, so every panel was
    // created with a single generic type and the user's real configuration
    // silently disappeared until they reopened Edit and saved again. Now
    // POST reads body.options the same way PATCH already does below.
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
        emoji: o.emoji ? String(o.emoji).slice(0, 64) : '🎫',
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
      // The bot resolves a transcript destination as: ticket type's own channel,
      // then this panel-level channel, then the server default, then the
      // mod-log. So the panel-level field must hold ONLY the real default.
      // It used to be filled with type 1's channel, which sent every other
      // type without a channel of its own to type 1's channel.
      // transcript_default_channel_id is the same value under an explicit name
      // (it lets the dashboard tell a real default from an old copy).
      transcript_default_channel_id: transcriptId ? toLong(transcriptId) : null,
      transcript_channel_id: transcriptId ? toLong(transcriptId) : null,
      options, button_label: String(body.button_label || 'Open ticket').slice(0, 80),
      button_style: [1,2,3,4].includes(Number(body.button_style)) ? Number(body.button_style) : 1,
      button_emoji: String(body.button_emoji || '🎫').slice(0, 64), select_placeholder: String(body.select_placeholder || 'Choose a ticket type…').slice(0, 150),
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
        details_title: String(body.form?.details_title || body.form_details_title || '📝 Ticket details').slice(0, 256),
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

  // -------- Ticket panels: edit the complete panel from the dashboard --------
  const panelMatch = sub.match(/^tickets\/panels\/([\w-]+)$/);
  if (panelMatch && (method === 'PATCH' || method === 'PUT')) {
    const { ObjectId } = await import('mongodb');
    const rawPanelId = String(panelMatch[1]);
    let panelKey;
    if (ObjectId.isValid(rawPanelId)) panelKey = new ObjectId(rawPanelId);
    else panelKey = rawPanelId;

    // Panels created by the dashboard normally use MongoDB ObjectIds, but
    // older/imported panels may have a string _id. Resolve both formats,
    // then enforce the guild boundary separately so an id can never be used
    // to edit a panel belonging to another server.
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
    // Existing version-1 panels are deliberately kept on their legacy renderer.
    if (Number(existing.version || 1) < 2) delete data.version;
    if (Number(existing.version || 1) >= 2 && 'version' in body) data.version = 2;
    // For v2 panels the panel-level transcript channel is resolved in one place
    // below (the default only), so a stale transcript_channel_id sent back by an
    // older client is not trusted here.
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
        // Panel saved before the default had its own field: its panel-level value
        // only counts as a real default if it differs from type 1's own channel.
        const prevFirst = existing.options?.[0]?.transcript_channel_id;
        defaultTranscript = existing.transcript_channel_id && String(existing.transcript_channel_id) !== String(prevFirst ?? '') ? existing.transcript_channel_id : null;
      }
      // Same rule as on create: the panel-level field holds only the real default.
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
    const allowed = ['enabled', 'channel_id', 'message', 'title', 'footer', 'embed', 'color', 'image_mode', 'image_url', 'timestamp', 'dm_message', 'auto_role_id', 'dm_image_mode', 'dm_image_url', 'message_format', 'card_enabled', 'card_background_url', 'card_overlay_color', 'card_overlay_opacity', 'card_text_color', 'card_avatar_mode', 'card_avatar_ring', 'card_size', 'card_gradient'];
    const data = {};
    for (const k of allowed) if (k in body) data[k] = body[k];
    // Every coercion below is guarded by `in data`. Without the guard, a
    // request that did not carry a field still wrote a value for it: an
    // absent `title` was written back as the empty string (wiping the
    // configured title) and an absent `image_mode` was written back as
    // 'member_avatar', silently resetting a server's custom image to the
    // member's avatar. That is the "I picked a custom image and something
    // else gets posted" report: nothing was wrong at send time, the setting
    // had already been overwritten at save time.
    if ('title' in data) data.title = String(data.title ?? '').slice(0, 256);
    if ('message' in data) data.message = String(data.message ?? '').slice(0, 4096);
    if ('footer' in data) data.footer = String(data.footer ?? '').slice(0, 2048);
    if ('image_mode' in data) {
      data.image_mode = ['server_avatar', 'member_avatar', 'custom', 'none'].includes(data.image_mode) ? data.image_mode : 'member_avatar';
    }
    // The dashboard presents exactly one mutually-exclusive message format.
    // Store a canonical format and mirror it to the legacy booleans so older
    // bot builds/configs remain compatible without allowing impossible states.
    if ('message_format' in data) {
      if (!['plain', 'avatar', 'card'].includes(data.message_format)) {
        return json({ error: 'invalid_message_format', field: 'message_format' }, { status: 400 });
      }
      data.embed = data.message_format !== 'plain';
      data.card_enabled = data.message_format === 'card';
    } else if ('card_enabled' in data || 'embed' in data) {
      // Only infer when the request actually said something about the
      // format. A partial save that mentioned neither used to be treated as
      // "card off, embed on" and quietly demoted a card-format server back
      // to the plain avatar embed.
      const inferredFormat = data.card_enabled ? 'card' : (data.embed === false ? 'plain' : 'avatar');
      data.message_format = inferredFormat;
      data.embed = inferredFormat !== 'plain';
      data.card_enabled = inferredFormat === 'card';
    }
    if ('image_url' in data) {
      // Was the only image field still validated by a hand-rolled `new URL()`
      // instead of sanitizeImageUrl(), so it was also the only one that
      // accepted an unroutable host such as "https://s//i.imgur.com/x.gif".
      try { data.image_url = sanitizeImageUrl(data.image_url); }
      catch { return json({ error: 'invalid_image_url', field: 'image_url' }, { status: 400 }); }
    }
    // DM image is configured separately from the channel image above, the
    // DM message can use a different image/GIF (or none) than the public
    // welcome message.
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
    if ('card_gradient' in data) data.card_gradient = ['ember', 'aurora', 'sunset', 'ocean', 'neon', 'royal', 'forest', 'midnight'].includes(data.card_gradient) ? data.card_gradient : 'ember';
    if ('card_background_url' in data) {
      try { data.card_background_url = sanitizeImageUrl(data.card_background_url); }
      catch { return json({ error: 'invalid_image_url', field: 'card_background_url' }, { status: 400 }); }
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
    // auto_role_id was never checked against this guild's roles, the bot
    // would silently fail to assign it to new members if it belonged to a
    // different guild (or wasn't a real role at all).
    if (data.auto_role_id && !(await assertRoleInGuild(guildId, data.auto_role_id))) {
      return json({ error: 'invalid_role', field: 'auto_role_id' }, { status: 400 });
    }
    const savedWelcome = await upsertOne('welcome_settings', guildId, data, { userId: session?.user?.id });
    if ('enabled' in data) await mirrorModuleState(guildId, 'welcome', data.enabled);
    // New servers start with every module switched off. Picking a role in the Auto Role panel and
    // saving is an explicit "I want this", so the module is switched on with it. Without this the
    // role was saved but the bot skipped it (module off), which looked like "auto role does not work".
    if (body.activate_autorole === true && data.auto_role_id) await mirrorModuleState(guildId, 'autorole', true);
    return json(savedWelcome);
  }

  if (sub === 'goodbye' && (method === 'PUT' || method === 'PATCH')) {
    const session = await getSession();
    const allowed = ['enabled', 'channel_id', 'message', 'title', 'footer', 'embed', 'color', 'image_mode', 'image_url', 'timestamp', 'message_format', 'card_enabled', 'card_background_url', 'card_overlay_color', 'card_overlay_opacity', 'card_text_color', 'card_avatar_mode', 'card_avatar_ring', 'card_size', 'card_gradient'];
    const data = {};
    for (const k of allowed) if (k in body) data[k] = body[k];
    // Guarded for the same reason as Welcome above: an unguarded coercion
    // rewrote fields the request never mentioned.
    if ('title' in data) data.title = String(data.title ?? '').slice(0, 256);
    if ('message' in data) data.message = String(data.message ?? '').slice(0, 4096);
    if ('footer' in data) data.footer = String(data.footer ?? '').slice(0, 2048);
    if ('image_mode' in data) {
      data.image_mode = ['server_avatar', 'member_avatar', 'custom', 'none'].includes(data.image_mode) ? data.image_mode : 'member_avatar';
    }
    // The dashboard presents exactly one mutually-exclusive message format,
    // same as Welcome. Store a canonical format and mirror it to the legacy
    // booleans so older bot builds/configs remain compatible without
    // allowing impossible states (e.g. card_enabled with embed off).
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
    if ('card_gradient' in data) data.card_gradient = ['ember', 'aurora', 'sunset', 'ocean', 'neon', 'royal', 'forest', 'midnight'].includes(data.card_gradient) ? data.card_gradient : 'ember';
    if ('card_background_url' in data) {
      try { data.card_background_url = sanitizeImageUrl(data.card_background_url); }
      catch { return json({ error: 'invalid_image_url', field: 'card_background_url' }, { status: 400 }); }
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
    if ('button_emoji' in data) data.button_emoji = String(data.button_emoji || '✅').slice(0, 64);
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
    // Optional minimum Discord account age, in days, enforced by the public
    // verify route. 0 disables the check, which is the default so that
    // turning the module on never silently blocks legitimate new Discord
    // users. Capped at a year: anything beyond that is a mistake rather
    // than a policy, and would lock out most prospective members.
    if ('min_account_age_days' in data) {
      const days = Number(data.min_account_age_days);
      if (!Number.isFinite(days) || days < 0 || days > 365) {
        return json({ error: 'invalid_min_account_age', field: 'min_account_age_days' }, { status: 400 });
      }
      data.min_account_age_days = Math.round(days);
    }
    const badField = await assertChannelFieldsInGuild(guildId, data, ['channel_id']);
    if (badField) return json({ error: 'invalid_channel', field: badField }, { status: 400 });
    // The role granted on verification must be a real, non-managed role in
    // THIS guild, same cross-tenant protection used for auto_role_id on
    // welcome. Enabling captcha with no role configured yet is allowed (the
    // panel just can't be posted until a role is picked, enforced below).
    if (data.role_id && !(await assertRoleInGuild(guildId, data.role_id))) {
      return json({ error: 'invalid_role', field: 'role_id' }, { status: 400 });
    }
    const savedCaptcha = await upsertOne('captcha_settings', guildId, data, { userId: session?.user?.id });
    if ('enabled' in data) await mirrorModuleState(guildId, 'captcha', data.enabled);
    return json(savedCaptcha);
  }

  // Publishes (or re-publishes) the Captcha verification message in the
  // configured channel. Kept as its own action (mirrors tickets/panels and
  // reaction_roles) instead of happening automatically on every settings
  // save, so editing text doesn't spam the channel with a new message each
  // time, the admin explicitly asks for a (re)post.
  if (sub === 'captcha/panel' && method === 'POST') {
    const settings = await findOrDefault('captcha_settings', guildId, { channel_id: null, role_id: null });
    const channelId = settings.channel_id ? String(settings.channel_id) : null;
    if (!channelId) return json({ error: 'missing_channel' }, { status: 400 });
    if (!settings.role_id) return json({ error: 'missing_role' }, { status: 400 });
    if (!(await assertChannelInGuild(guildId, channelId))) return json({ error: 'invalid_channel' }, { status: 400 });
    if (!(await assertRoleInGuild(guildId, settings.role_id))) return json({ error: 'invalid_role' }, { status: 400 });
    const embed = captchaPanelEmbed(settings);
    const components = captchaPanelComponents(settings, guildId);

    // Re-publishing edits the panel that is already in the channel instead of
    // posting a second identical one. Publishing twice (or saving, tweaking a
    // label and publishing again) used to leave a stack of duplicate
    // "Member Verification" cards, each with its own live Verify button.
    // A message that was deleted by hand falls through to a fresh post.
    const existingMessageId = settings.message_id ? String(settings.message_id) : null;
    let msg = null;
    if (existingMessageId && String(settings.channel_id) === channelId) {
      try {
        msg = await editGuildMessage(channelId, existingMessageId, embedToV2Payload(embed, components));
      } catch {
        msg = null; // gone or not editable, post a new one below
      }
    }
    if (!msg) {
      try { msg = await sendGuildMessage(channelId, embedToV2Payload(embed, components)); }
      catch (e) { return json({ error: 'discord_send_failed', detail: String(e.message || e) }, { status: 502 }); }
    }

    // Publishing the panel IS the act of turning verification on. Without
    // this, a guild whose captcha_settings.enabled was still false got a
    // panel whose Verify button led straight to "Verification unavailable",
    // because /api/verify/[guildId] refuses to serve a disabled module. The
    // publish button reported success, the panel looked perfect, and the
    // link was dead. Nobody publishes a verification panel they do not want
    // to work, so enable it here and mirror it into module_states so the
    // sidebar switch agrees.
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
    // whitelist_role_ids was never checked against this guild's roles, a
    // role id from another guild (or a non-numeric value) could be saved
    // and later crash toLong()/Long.fromString deep inside upsertOne.
    if (Array.isArray(data.whitelist_role_ids) && !(await assertRolesInGuild(guildId, data.whitelist_role_ids))) {
      return json({ error: 'invalid_role', field: 'whitelist_role_ids' }, { status: 400 });
    }
    // Numeric thresholds previously accepted anything (strings, negative
    // numbers, absurdly large values) since deserializeInput only special-
    // cases id fields. Clamp them the same way giveaways/scheduled_messages
    // already clamp their own numeric inputs, bounds match the defaults
    // used by findOrDefault('automod_settings', ...) above.
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
    // 0 means off for these two, so 0 must survive the clamp (|| fallback would turn it into the default).
    for (const [k, max] of [['min_account_age_days', 365], ['new_member_link_minutes', 1440]]) {
      if (k in data) { const n = Number(data[k]); data[k] = Number.isFinite(n) ? Math.max(0, Math.min(max, Math.round(n))) : 0; }
    }
    // Custom automod messages (dashboard: Logging panel). Empty string
    // means "use the bot's own built-in default text", same convention
    // every other optional free-text override in this app already uses,
    // so an empty save is a valid, meaningful "reset to default" rather
    // than being rejected as invalid input.
    for (const k of ['warn_message', 'timeout_message', 'unmute_message', 'kick_message', 'ban_message']) {
      if (k in data) data[k] = String(data[k] || '').slice(0, 1000);
    }
    return json(await upsertOne('automod_settings', guildId, data, { userId: session?.user?.id }));
  }

  // -------- Reaction roles/buttons: create a panel from the dashboard --------
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
      // Discord supports multiple action rows, but Wody intentionally caps
      // dashboard-created role buttons at 10 per message.
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

    // Keep reaction-role creation intentionally lightweight: at most 3 live
    // panels per server on the free plan (unlimited with Premium, same as
    // ticket panels), with a 10-minute creation cooldown. This is scoped by
    // guild_id so one server can never consume another server's allowance.
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
      // Five buttons fit in one Discord action row; ten buttons therefore
      // become exactly two rows. No reaction objects/counting are involved.
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
        // Best-effort: one invalid/forbidden emoji must not prevent the rest
        // of the panel from being stored and working.
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

  // -------- Reaction roles/buttons: delete a panel and its Discord message --------
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

  // -------- Giveaways: create a real giveaway message in the guild --------
  if (sub === 'giveaways' && method === 'POST') {
    const session = await getSession();
    const prize = String(body.prize || '').slice(0, 200);
    const channelId = body.channel_id ? String(body.channel_id) : null;
    const winnersCount = Math.max(1, Math.min(20, Number(body.winners_count) || 1));
    const minutes = Math.max(1, Math.min(60 * 24 * 30, Number(body.duration_minutes) || 0)); // cap at 30 days
    // Role pings are optional. When roles are selected they are still
    // validated against this guild before Discord receives the request.
    const mentionRoleIds = Array.isArray(body.mention_role_ids)
      ? Array.from(new Set(body.mention_role_ids.map((r) => String(r || '').trim()).filter(Boolean)))
      : [];
    // Roles that are NOT allowed to enter this giveaway (optional, any number).
    const blockedRoleIds = Array.isArray(body.blocked_role_ids)
      ? Array.from(new Set(body.blocked_role_ids.map((r) => String(r || '').trim()).filter(Boolean)))
      : [];
    // Optional allow-list: when set, a member must have at least one of these roles to enter.
    const allowedRoleIds = Array.isArray(body.allowed_role_ids)
      ? Array.from(new Set(body.allowed_role_ids.map((r) => String(r || '').trim()).filter(Boolean)))
      : [];
    // Optional per-role odds boost: { role_id: weight (1-10) }. A participant's
    // draw weight is the HIGHEST weight among any of these roles they hold at
    // draw time (not stored per-entry, computed fresh so it reflects their
    // CURRENT roles), or the normal weight of 1 if they hold none of them.
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
    // None of the three role-id lists were checked against this guild's
    // roles before, a role id from another guild (or a non-numeric value)
    // would silently fail to ping/resolve on Discord's side, or crash
    // toLong()/Long.fromString when the giveaway doc is saved below.
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
      ? `\n\n🚫 Not open to: ${blockedRoleIds.map((id) => `<@&${id}>`).join(', ')}`
      : '';
    const allowedNote = allowedRoleIds.length
      ? `\n\n🔒 Only members with: ${allowedRoleIds.map((id) => `<@&${id}>`).join(', ')} can enter.`
      : '';

    let msg;
    try {
      // Same custom_id as the bot's persistent GiveawayView, the running
      // bot process already listens for "wody:giveaway:enter" regardless
      // of whether the message was created via a slash command or, like
      // here, directly through the REST API, so the Enter button works
      // immediately without any bot restart.
      const enterRow = [{
        type: 1,
        components: [{ type: 2, style: 1, custom_id: 'wody:giveaway:enter', label: 'Enter', emoji: { name: '🎉' } }],
      }];
      const giveawayEmbed = {
        title: '🎉 Giveaway!',
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

  // -------- Giveaways: end now --------
  // We don't duplicate the winner-picking logic here, we just move end_time
  // into the past. The bot's background loop (runs every 15s) picks this up
  // and ends it exactly the same way /giveaway-end does, so behavior always
  // matches the Discord command.
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

  // -------- Giveaways: reroll a winner from a finished giveaway --------
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
      // Same link button the bot adds to its own reroll message, so the
      // dashboard reroll also lets people jump back to the giveaway itself.
      // embedToV2Payload takes a LIST of button rows (empty list = no buttons).
      const viewRows = doc.message_id
        ? [{ type: 1, components: [{ type: 2, style: 5, label: 'View giveaway', url: `https://discord.com/channels/${guildId}/${String(doc.channel_id)}/${String(doc.message_id)}` }] }]
        : [];
      await sendGuildMessage(String(doc.channel_id), embedToV2Payload({ title: '🎉 Reroll winner', description: `Congrats <@${winner}>!`, color: 0xe08a4e }, viewRows));
    } catch (e) {
      return json({ error: 'discord_send_failed', detail: String(e.message || e) }, { status: 502 });
    }
    return json({ ok: true, winner });
  }

  // -------- Giveaways: cancel (only before it has ended) --------
  const gwDel = sub.match(/^giveaways\/([\w-]+)$/);
  if (gwDel && method === 'DELETE') {
    const { ObjectId } = await import('mongodb');
    let objId;
    try { objId = new ObjectId(gwDel[1]); } catch { return json({ error: 'invalid_id' }, { status: 400 }); }
    const doc = await db.collection('giveaways').findOne({ _id: objId, guild_id: gidLong });
    if (doc && !doc.ended) {
      await editGuildMessage(String(doc.channel_id), String(doc.message_id),
        embedToV2Payload({ title: '🎉 Giveaway cancelled', description: `~~Prize: ${doc.prize}~~`, color: 0x808080 })
      ).catch(() => {});
    }
    await db.collection('giveaways').deleteOne({ _id: objId, guild_id: gidLong });
    return json({ ok: true });
  }

  if (sub === 'auto_responses' && method === 'POST') {
    const session = await getSession();
    // Free-text array fields (channel/role ids) sanitized to arrays of
    // snowflake strings, capped at 25 like Discord's own multi-select UI
    // caps a single select menu, plenty for "allowed" or "ignored", and
    // keeps a malformed/huge body from writing an unbounded array.
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
    // Free servers: 5 auto-responses max. Premium servers: 3x that (15).
    // Checked here (not just displayed in the UI) so the limit can't be
    // bypassed by calling this endpoint directly.
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

// Custom command restrictions (allowed/blocked channels & roles, cooldown,
// the three override messages), shared shape between create and edit,
// matching exactly what cogs/custom_commands.py's _allowed() reads under
// doc.restrictions. Every field is optional; an absent/empty one just
// means "no restriction of that kind", same as the bot's own fallbacks.
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

// ---- Level rewards + role XP bonuses (Levels page) --------------------------
// Stored on guild_settings (level_rewards / level_role_bonuses) and enforced by
// the bot (level_rewards.py keeps the same limits). The write goes through the
// existing settings route, so it sits behind the same Manage Server check as
// every other Levels setting. Strict on purpose: a bad value is rejected with a
// clear error instead of being silently changed.
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

// Rewards of a custom command: roles given to whoever uses it, and general (Unicode) emoji added to that
// member's nickname, before, after or on a random side. Same shape cogs/custom_commands.py reads under
// doc.rewards. Server emoji (<:name:id>) cannot be used in a nickname, so only standard emoji are accepted.
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
  // Two separate automations, each with its own switch: a role for the member, and emoji in the nickname.
  // (Older saved commands have no switch: it counts as on when something is chosen.)
  const roleEnabled = raw.role_enabled === undefined ? roleIds.length > 0 : !!raw.role_enabled;
  const emojiEnabled = raw.emoji_enabled === undefined ? emojis.length > 0 : !!raw.emoji_enabled;
  return { role_enabled: roleEnabled && roleIds.length > 0, role_ids: roleIds, emoji_enabled: emojiEnabled && emojis.length > 0, nickname_emojis: emojis, nickname_position: position };
}

// The roles a command gives must exist in this server, must not be @everyone, and must not be managed
// (bot / integration roles cannot be handed out).
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
    // Free servers: 5 custom commands max. Premium servers: 3x that (15).
    // Checked here (not just displayed in the UI) so the limit can't be
    // bypassed by calling this endpoint directly.
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
  // Editing an existing command's response/restrictions/delete_trigger/
  // enabled state. Previously the only way to change any of this was
  // delete-and-recreate (which also meant restrictions could never be
  // added or changed at all, since the create form never asked for them).
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

  // -------- Forum automation: create/update a forum-channel policy --------
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

  // -------- Scheduled Messages: create --------
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
    // Advanced mode (optional): author line and fields need an embed, link buttons work with or without one.
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
    // mention_role_ids was never checked against this guild's roles.
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

  // -------- Scheduled Messages: no editing, ever --------
  // A scheduled message is created once and can only be cancelled (deleted). Nothing
  // changes it afterwards, so a message that was already sent can never be altered.
  if (/^scheduled_messages\/[\w-]+$/.test(sub) && (method === 'PUT' || method === 'PATCH')) {
    return json({ error: 'locked_after_send', detail: 'Scheduled messages cannot be edited. Cancel it and create a new one.' }, { status: 405 });
  }

  // -------- Scheduled Messages: cancel --------
  const smDel = sub.match(/^scheduled_messages\/([\w-]+)$/);
  if (smDel && method === 'DELETE') {
    const { ObjectId } = await import('mongodb');
    let objId;
    try { objId = new ObjectId(smDel[1]); } catch { return json({ error: 'invalid_id' }, { status: 400 }); }
    const result = await db.collection('scheduled_messages').deleteOne({ _id: objId, guild_id: gidLong });
    if (result.deletedCount === 0) return json({ error: 'not_found' }, { status: 404 });
    return json({ ok: true });
  }

  // -------- Embed Builder: send an embed to a channel right now (no scheduling) --------
  if (sub === 'embeds/send' && method === 'POST') {
    const session = await getSession();
    if (!session?.user) return json({ error: 'unauthenticated' }, { status: 401 });

    // Embed Builder is free, but sending is limited to one embed every
    // 30 seconds per user and server to prevent message spam.
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
    // image/thumbnail were never validated here at all, not even for a
    // well-formed http(s) URL, unlike every other embed-sending path in
    // this file (welcome, goodbye, scheduled_messages, ticket panels).
    // Whatever was typed went straight to Discord's API as-is.
    if (embed.image && embed.image.url) {
      try { embed.image.url = sanitizeImageUrl(embed.image.url); }
      catch { return json({ error: 'invalid_image_url', field: 'image' }, { status: 400 }); }
    }
    if (embed.thumbnail && embed.thumbnail.url) {
      try { embed.thumbnail.url = sanitizeImageUrl(embed.thumbnail.url); }
      catch { return json({ error: 'invalid_image_url', field: 'thumbnail' }, { status: 400 }); }
    }
    // mention_role_ids was never checked against this guild's roles.
    if (mentionRoleIds.length && !(await assertRolesInGuild(guildId, mentionRoleIds))) {
      return json({ error: 'invalid_role', field: 'mention_role_ids' }, { status: 400 });
    }
    // Advanced mode (optional): author line, up to 10 fields, up to 5 link buttons.
    // Validated again here; the browser checks are only a convenience.
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
      // Always set allowed_mentions explicitly, never leave it unset.
      // Discord's default (unset) behavior parses ANY @everyone/@here/@role/
      // @user mention literally typed in `content`, gated only by the BOT's
      // own permissions in that channel, not by the permissions of the
      // dashboard user making this request. guardGuildAccess only requires
      // Manage Guild (not Administrator, not the separate "Mention
      // Everyone" Discord permission), so without this, any guild manager
      // could type "@everyone" here and have the bot actually ping the
      // whole server if the bot itself has that permission in the channel,
      // a privilege bypass. Restricting to exactly the roles the admin
      // picked (or nothing at all) closes that off while keeping intended
      // role pings working.
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

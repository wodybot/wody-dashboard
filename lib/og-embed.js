// FILE: og-embed.js
// PUNE ÎN: lib/og-embed.js
// (fișier nou în proiectul wody-dashboard-main la această cale)

// Server-only config for the site's Discord/social link-preview card (the
// image Discord shows when someone pastes wody.online in chat, same
// mechanism third-party bot sites like the Aegis one use, generated via
// app/opengraph-image.js). Same site_config collection, same
// cached-read / tag-revalidate-on-save pattern as lib/promo-banner.js and
// lib/community-showcase.js: a single global document, editable from the
// owner panel with no redeploy, live immediately after saving (the very
// next time Discord/anything else fetches /opengraph-image).
//
// Unlike the promo banner, there's no "off" state here: a Discord embed
// with no image at all reads far worse than a plain default one, so this
// always renders something, enabled isn't even a field. What's
// customizable is just the text and the list of modules shown, in case
// the module lineup changes or the owner wants different wording without
// needing a code change.

import { getDb } from '@/lib/mongo';
import { unstable_cache, revalidateTag } from 'next/cache';
import { INVITE_URL, COMMUNITY_INVITE } from '@/lib/content';

export const OG_EMBED_COLLECTION = 'site_config';
export const OG_EMBED_ID = 'og_embed';
export const OG_EMBED_CACHE_TAG = 'og-embed-config';

const SITE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://wody.online';

// The 4 link buttons shown under the card by discord-component-embed.js
// (the Components V2 payload Discord actually renders for wody.online,
// see app/discord-embed.json/route.js). These used to be a hardcoded
// BUTTONS constant over there; now they're just the fallback used until
// the owner panel saves a custom `buttons` list, so nothing changes for
// anyone who's never touched the new editor.
export const OG_EMBED_DEFAULT_BUTTONS = Object.freeze([
  Object.freeze({ label: 'Add to Server', url: INVITE_URL }),
  Object.freeze({ label: 'Dashboard', url: `${SITE_URL}/dashboard` }),
  Object.freeze({ label: 'Support', url: COMMUNITY_INVITE }),
  Object.freeze({ label: 'Vote', url: 'https://top.gg/bot/1514491897647861773' }),
]);
// Discord hard-caps a single action row (component type 1) at 5 child
// buttons; the container in discord-component-embed.js has exactly one
// action row for these, so 5 is a real ceiling, not a made-up one.
const MAX_BUTTONS = 5;

// Matches the real module list in the dashboard (see MODULES in
// app/[locale]/dashboard/[guildId]/page.js), minus "General" and
// "Premium" themselves, those are settings/status, not a feature to
// advertise. Kept as the fallback here, not a live import from that
// file, so a dashboard-side module rename doesn't reformat someone's
// already-customized embed out from under them.
export const OG_EMBED_DEFAULT_MODULES = Object.freeze([
  'Welcome & Auto Role',
  'Goodbye',
  'Moderation',
  'AutoMod',
  'Full Logging',
  'Tickets',
  'Reaction Roles',
  'Captcha',
  'Giveaways',
  'Polls',
  'Levels & XP',
  'Suggestions',
  'Auto Responses',
  'Custom Commands',
  'Embed Builder',
  'Scheduled Messages',
  'Forums',
  'Backups',
  'Temporary Voice',
  'YouTube Notifications',
  'Stream Notifications',
  'Birthdays',
  'Invite Tracking',
  'Community Discovery',
  'Economy',
  'Games',
  'Blackjack',
  'WODY Passport',
  'Global Leaderboard',
]);

// The module list shipped before the Passport existed. A saved list that is
// exactly this one was never customised, so it is upgraded to the full list.
const OG_PREVIOUS_DEFAULT_MODULES = [
  'Welcome & Auto Role', 'Goodbye', 'Moderation', 'AutoMod', 'Tickets', 'Reaction Roles', 'Captcha', 'Giveaways', 'Pools',
  'Levels & XP', 'Suggestions', 'Auto Responses', 'Custom Commands', 'Embed Builder', 'Scheduled Messages', 'Forums',
  'Full Logging', 'Backups', 'Temporary Voice', 'YouTube Notifications', 'Birthdays', 'Invite Tracking',
  'Community Discovery', 'Economy', 'Games', 'Stream Notifications',
];
const sameList = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);

// The look of the card. See lib/og-render.jsx for what each one draws.
export const OG_VARIANT_IDS = ['passport', 'showcase', 'minimal', 'classic'];
const DEFAULT_VARIANT = 'passport';

export const OG_EMBED_DEFAULTS = Object.freeze({
  title: 'Wody',
  subtitle: 'THE ALL-IN-ONE DISCORD BOT',
  tagline: 'Everything you need to manage your Discord community.',
  modules: OG_EMBED_DEFAULT_MODULES,
  media_url: '',
  variant: DEFAULT_VARIANT,
  // Optional block of text shown above the button row in the actual
  // Discord embed (a type-10 text component). Multi-line, same Markdown
  // Discord renders everywhere else: **bold**, *italic*, `code`, - bullet
  // lists, > quotes, # headings. Empty means "don't render that block at
  // all", not an empty text component.
  buttons_heading: '',
  buttons: OG_EMBED_DEFAULT_BUTTONS.map((b) => ({ ...b })),
});

const MAX_LEN = {
  title: 40, subtitle: 80, tagline: 120, moduleItem: 30, mediaUrl: 500,
  buttonsHeading: 600,
  // Discord truncates/rejects a button label over 80 characters.
  buttonLabel: 80,
  buttonUrl: 512,
};
const MAX_MODULES = 40;

function isHttpUrlStrict(value) {
  // Unlike isHttpUrl below (used for the optional media_url, where empty
  // is valid), a button's url is required once the button exists at
  // all: Discord rejects a link-style button (style 5) with no url, and
  // a button that silently goes nowhere is worse than not shipping this
  // feature. Also restricted to https only, same as discord-embed.json
  // already required of the hardcoded buttons before (see httpsUrl in
  // lib/discord-component-embed.js), Discord's own client refuses a
  // link-button url that isn't https.
  if (!value) return false;
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

// Shared by sanitize() (reads from Mongo, must never throw / must
// always return something renderable) and parseOgEmbedPatch() (a save
// from the owner panel, allowed to reject the whole request instead).
// `strict` picks which of those two behaviors this call needs.
function normalizeButtons(raw, { strict } = { strict: false }) {
  if (!Array.isArray(raw)) return strict ? null : OG_EMBED_DEFAULT_BUTTONS.map((b) => ({ ...b }));
  const out = [];
  for (const entry of raw) {
    const label = String(entry?.label || '').trim().slice(0, MAX_LEN.buttonLabel);
    const url = String(entry?.url || '').trim().slice(0, MAX_LEN.buttonUrl);
    if (!label || !isHttpUrlStrict(url)) {
      if (strict) return null; // reject the whole save, don't silently drop a button the owner just typed
      continue; // stored data got corrupted somehow; skip rather than crash the card
    }
    out.push({ label, url });
  }
  if (out.length === 0) return strict ? null : OG_EMBED_DEFAULT_BUTTONS.map((b) => ({ ...b }));
  return out.slice(0, MAX_BUTTONS);
}

function isHttpUrl(value) {
  if (!value) return true; // empty is valid (means "not set")
  try {
    const u = new URL(value);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}

function isLegacyOgConfig(doc) {
  if (!doc || typeof doc !== 'object') return false;
  const title = String(doc.title || '').trim();
  const subtitle = String(doc.subtitle || '').trim();
  const tagline = String(doc.tagline || '').trim();
  const modules = Array.isArray(doc.modules) ? doc.modules.map((m) => String(m || '').trim()) : [];
  // Older versions of the link-preview editor stored the old card copy and
  // old module names. Replace only that known legacy shape; user-created
  // custom configurations remain untouched.
  return title === 'Wody' && (
    subtitle === 'The complete Discord bot platform' ||
    tagline === 'Keep your server safe and fun, all configured on the web in a few clicks.' ||
    modules.includes('Auto Replies')
  );
}

function sanitize(doc) {
  if (!doc || typeof doc !== 'object') return { ...OG_EMBED_DEFAULTS, modules: [...OG_EMBED_DEFAULTS.modules], updated_at: 0 };
  let modules = Array.isArray(doc.modules)
    ? doc.modules.map((m) => String(m || '').trim().slice(0, MAX_LEN.moduleItem)).filter(Boolean).slice(0, MAX_MODULES)
    : [...OG_EMBED_DEFAULTS.modules];
  if (sameList(modules, OG_PREVIOUS_DEFAULT_MODULES)) modules = [...OG_EMBED_DEFAULTS.modules];
  const mediaUrl = String(doc.media_url || '').trim().slice(0, MAX_LEN.mediaUrl);
  const updatedAt = doc.updated_at ? new Date(doc.updated_at).getTime() : 0;
  return {
    title: String(doc.title || '').trim().slice(0, MAX_LEN.title) || OG_EMBED_DEFAULTS.title,
    subtitle: String(doc.subtitle || '').trim().slice(0, MAX_LEN.subtitle) || OG_EMBED_DEFAULTS.subtitle,
    tagline: String(doc.tagline || '').trim().slice(0, MAX_LEN.tagline) || OG_EMBED_DEFAULTS.tagline,
    modules: modules.length ? modules : [...OG_EMBED_DEFAULTS.modules],
    // A direct image/GIF URL (Wody's mascot, a banner, anything), shown as
    // a picture inside the card next to the logo/title. Kept optional and
    // separate from title/subtitle/tagline (those never fail validation on
    // their own), so a bad media URL never breaks the whole card, see
    // app/opengraph-image.js, it just falls back to not showing a picture.
    media_url: isHttpUrl(mediaUrl) ? mediaUrl : '',
    variant: OG_VARIANT_IDS.includes(doc.variant) ? doc.variant : DEFAULT_VARIANT,
    buttons_heading: String(doc.buttons_heading || '').trim().slice(0, MAX_LEN.buttonsHeading),
    buttons: normalizeButtons(doc.buttons, { strict: false }),
    // Not part of the editable schema, never read back from a PUT/PATCH
    // body (parseOgEmbedPatch never sets it), purely a server-derived
    // "when was this last saved" marker in milliseconds. Its only
    // consumer is lib/discord-component-embed.js, which appends it as a
    // ?v= query parameter to the generated card image's URL: Discord (and
    // any CDN in front of this site) caches image BYTES by exact URL,
    // separately from how often it re-fetches discord-embed.json's text,
    // so without a value here that changes on every save, a title/tagline
    // edit can show up in Discord's embed text while the picture right
    // next to it keeps showing whatever was cached under the old, static
    // /opengraph-image URL.
    updated_at: Number.isFinite(updatedAt) ? updatedAt : 0,
  };
}

// Validates a partial update body from the owner panel. Returns
// { ok: true, patch } or { ok: false, error }.
export function parseOgEmbedPatch(body) {
  if (!body || typeof body !== 'object') return { ok: false, error: 'invalid_body' };
  const patch = {};
  if ('title' in body) {
    const v = String(body.title || '').trim();
    if (!v) return { ok: false, error: 'invalid_title' };
    patch.title = v.slice(0, MAX_LEN.title);
  }
  if ('subtitle' in body) {
    const v = String(body.subtitle || '').trim();
    if (!v) return { ok: false, error: 'invalid_subtitle' };
    patch.subtitle = v.slice(0, MAX_LEN.subtitle);
  }
  if ('tagline' in body) {
    const v = String(body.tagline || '').trim();
    if (!v) return { ok: false, error: 'invalid_tagline' };
    patch.tagline = v.slice(0, MAX_LEN.tagline);
  }
  if ('modules' in body) {
    if (!Array.isArray(body.modules)) return { ok: false, error: 'invalid_modules' };
    const modules = body.modules.map((m) => String(m || '').trim().slice(0, MAX_LEN.moduleItem)).filter(Boolean).slice(0, MAX_MODULES);
    if (!modules.length) return { ok: false, error: 'invalid_modules' };
    patch.modules = modules;
  }
  if ('variant' in body) {
    if (!OG_VARIANT_IDS.includes(body.variant)) return { ok: false, error: 'invalid_variant' };
    patch.variant = body.variant;
  }
  if ('media_url' in body) {
    const v = String(body.media_url || '').trim();
    if (v && !isHttpUrl(v)) return { ok: false, error: 'invalid_media_url' };
    patch.media_url = v.slice(0, MAX_LEN.mediaUrl);
  }
  // Empty string is valid on purpose: it's how the owner panel clears the
  // line back to "don't show a heading above the buttons".
  if ('buttons_heading' in body) {
    patch.buttons_heading = String(body.buttons_heading || '').trim().slice(0, MAX_LEN.buttonsHeading);
  }
  if ('buttons' in body) {
    if (!Array.isArray(body.buttons) || body.buttons.length === 0) return { ok: false, error: 'invalid_buttons' };
    if (body.buttons.length > MAX_BUTTONS) return { ok: false, error: 'too_many_buttons' };
    const buttons = normalizeButtons(body.buttons, { strict: true });
    if (!buttons) return { ok: false, error: 'invalid_buttons' };
    patch.buttons = buttons;
  }
  if (Object.keys(patch).length === 0) return { ok: false, error: 'empty_patch' };
  return { ok: true, patch };
}

async function readOgEmbedFromDb() {
  try {
    const db = await getDb();
    const doc = await db.collection(OG_EMBED_COLLECTION).findOne({ _id: OG_EMBED_ID });
    if (isLegacyOgConfig(doc)) {
      // Clones modules AND buttons, not just modules: OG_EMBED_DEFAULTS.buttons
      // is one shared array reused by every fallback path in this file, so
      // handing it out directly (instead of a copy) would let a mutation
      // anywhere downstream leak into every other request that hits this
      // same fallback.
      const migrated = {
        ...OG_EMBED_DEFAULTS,
        modules: [...OG_EMBED_DEFAULTS.modules],
        buttons: OG_EMBED_DEFAULTS.buttons.map((b) => ({ ...b })),
        media_url: '',
        updated_at: Date.now(),
      };
      await db.collection(OG_EMBED_COLLECTION).updateOne(
        { _id: OG_EMBED_ID },
        { $set: { ...migrated, migrated_at: new Date() } },
        { upsert: true },
      );
      return migrated;
    }
    return sanitize(doc);
  } catch (e) {
    console.error('readOgEmbedFromDb failed, defaulting', e);
    return {
      ...OG_EMBED_DEFAULTS,
      modules: [...OG_EMBED_DEFAULTS.modules],
      buttons: OG_EMBED_DEFAULTS.buttons.map((b) => ({ ...b })),
      updated_at: 0,
    };
  }
}

// Cached read, used both by the owner panel's edit form and by
// app/opengraph-image.js itself (so the actual Discord-facing image
// stays in sync with whatever was last saved, without a redeploy).
// Revalidated on a 60s timer AND instantly on save via the cache tag.
const getCachedOgEmbed = unstable_cache(
  readOgEmbedFromDb,
  ['og-embed-config-v1'],
  { revalidate: 60, tags: [OG_EMBED_CACHE_TAG] },
);

export async function getOgEmbedConfig() {
  return getCachedOgEmbed();
}

export async function saveOgEmbedPatch(patch, ownerId) {
  const db = await getDb();
  await db.collection(OG_EMBED_COLLECTION).updateOne(
    { _id: OG_EMBED_ID },
    {
      $set: { ...patch, updated_at: new Date(), updated_by: ownerId || null },
      $setOnInsert: { created_at: new Date() },
    },
    { upsert: true },
  );
  revalidateTag(OG_EMBED_CACHE_TAG);
  return readOgEmbedFromDb();
}

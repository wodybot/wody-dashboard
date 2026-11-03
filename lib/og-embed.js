

import { getDb } from '@/lib/mongo';
import { unstable_cache, revalidateTag } from 'next/cache';
import { INVITE_URL, COMMUNITY_INVITE } from '@/lib/content';

export const OG_EMBED_COLLECTION = 'site_config';
export const OG_EMBED_ID = 'og_embed';
export const OG_EMBED_CACHE_TAG = 'og-embed-config';

const SITE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://wody.online';

export const OG_EMBED_DEFAULT_BUTTONS = Object.freeze([
  Object.freeze({ label: 'Add to Server', url: INVITE_URL }),
  Object.freeze({ label: 'Dashboard', url: `${SITE_URL}/dashboard` }),
  Object.freeze({ label: 'Support', url: COMMUNITY_INVITE }),
  Object.freeze({ label: 'Vote', url: 'https://top.gg/bot/1514491897647861773' }),
]);
const MAX_BUTTONS = 5;

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

const OG_PREVIOUS_DEFAULT_MODULES = [
  'Welcome & Auto Role', 'Goodbye', 'Moderation', 'AutoMod', 'Tickets', 'Reaction Roles', 'Captcha', 'Giveaways', 'Pools',
  'Levels & XP', 'Suggestions', 'Auto Responses', 'Custom Commands', 'Embed Builder', 'Scheduled Messages', 'Forums',
  'Full Logging', 'Backups', 'Temporary Voice', 'YouTube Notifications', 'Birthdays', 'Invite Tracking',
  'Community Discovery', 'Economy', 'Games', 'Stream Notifications',
];
const sameList = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);

export const OG_VARIANT_IDS = ['passport', 'showcase', 'minimal', 'classic'];
const DEFAULT_VARIANT = 'passport';

export const OG_EMBED_DEFAULTS = Object.freeze({
  title: 'Wody',
  subtitle: 'THE ALL-IN-ONE DISCORD BOT',
  tagline: 'Everything you need to manage your Discord community.',
  modules: OG_EMBED_DEFAULT_MODULES,
  media_url: '',
  variant: DEFAULT_VARIANT,
  buttons_heading: '',
  buttons: OG_EMBED_DEFAULT_BUTTONS.map((b) => ({ ...b })),
});

const MAX_LEN = {
  title: 40, subtitle: 80, tagline: 120, moduleItem: 30, mediaUrl: 500,
  buttonsHeading: 600,
  buttonLabel: 80,
  buttonUrl: 512,
};
const MAX_MODULES = 40;

function isHttpUrlStrict(value) {
  if (!value) return false;
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

function normalizeButtons(raw, { strict } = { strict: false }) {
  if (!Array.isArray(raw)) return strict ? null : OG_EMBED_DEFAULT_BUTTONS.map((b) => ({ ...b }));
  const out = [];
  for (const entry of raw) {
    const label = String(entry?.label || '').trim().slice(0, MAX_LEN.buttonLabel);
    const url = String(entry?.url || '').trim().slice(0, MAX_LEN.buttonUrl);
    if (!label || !isHttpUrlStrict(url)) {
      if (strict) return null;
      continue;
    }
    out.push({ label, url });
  }
  if (out.length === 0) return strict ? null : OG_EMBED_DEFAULT_BUTTONS.map((b) => ({ ...b }));
  return out.slice(0, MAX_BUTTONS);
}

function isHttpUrl(value) {
  if (!value) return true;
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
    media_url: isHttpUrl(mediaUrl) ? mediaUrl : '',
    variant: OG_VARIANT_IDS.includes(doc.variant) ? doc.variant : DEFAULT_VARIANT,
    buttons_heading: String(doc.buttons_heading || '').trim().slice(0, MAX_LEN.buttonsHeading),
    buttons: normalizeButtons(doc.buttons, { strict: false }),
    updated_at: Number.isFinite(updatedAt) ? updatedAt : 0,
  };
}

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

// Global profile card: the same rules as the bot (profile_card/config.py). The schema file is exported from the bot,
// and scripts/profile-card-parity.mjs proves that this validation gives the same answers on shared cases.
import schema from './profile-card-schema.json' with { type: 'json' };

export const PROFILE_CARD = schema;
export const PROFILE_CARD_DEFAULT = schema.default;

const COLOR = /^#[0-9a-fA-F]{6}$/;
const URL_BAD = /[\s\x00-\x1f\x7f<>"'\\`]/;
const IMAGE_ID = new RegExp(schema.imageId);
const URL_OK = /^https:\/\/[A-Za-z0-9.-]+(:\d{2,5})?(\/[^\s]*)?$/;

export function cleanUrl(value) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  if (!text) return null;
  if (text.length > schema.urlMax || URL_BAD.test(text) || !URL_OK.test(text)) throw new Error('bg_url');
  const host = text.match(/^https:\/\/([^/:]+)/)[1].toLowerCase();
  if (host === 'localhost' || /\.(local|internal|localhost)$/.test(host) || /^[\d.]+$/.test(host) || !host.includes('.')) throw new Error('bg_url');
  return text;
}

// Only known keys, only valid values. Throws Error(<key>) for the first invalid one.
export function validatePatch(patch) {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) throw new Error('body');
  const out = {};
  for (const [key, value] of Object.entries(patch)) {
    if (Object.prototype.hasOwnProperty.call(schema.choices, key)) {
      if (!schema.choices[key].includes(value)) throw new Error(key);
      out[key] = value;
    } else if (schema.colorKeys.includes(key)) {
      if (typeof value !== 'string' || !COLOR.test(value)) throw new Error(key);
      out[key] = value.toLowerCase();
    } else if (Object.prototype.hasOwnProperty.call(schema.intRanges, key)) {
      const [lo, hi] = schema.intRanges[key];
      if (typeof value !== 'number' || !Number.isInteger(value) || value < lo || value > hi) throw new Error(key);
      out[key] = value;
    } else if (key === 'bg_url') {
      out[key] = cleanUrl(value);
    } else if (key === 'bg_image') {
      if (value !== null && !(typeof value === 'string' && IMAGE_ID.test(value))) throw new Error(key);
      out[key] = value;
    } else {
      throw new Error(key);
    }
  }
  return out;
}

export function normalizeConfig(stored) {
  const cfg = { ...schema.default };
  if (stored && typeof stored === 'object') {
    for (const [key, value] of Object.entries(stored)) {
      try { Object.assign(cfg, validatePatch({ [key]: value })); } catch { /* ignore a bad stored value */ }
    }
  }
  return cfg;
}

// -> { config, keys }: keys is exactly what gets stored. Editing anything but the theme marks it custom.
export function applyPatch(current, patch) {
  const clean = validatePatch(patch);
  let keys;
  if (clean.theme && schema.themes[clean.theme]) {
    const { theme, ...rest } = clean;
    keys = { ...schema.themes[theme], theme, ...rest };
  } else {
    keys = { ...clean };
    if (Object.keys(keys).length && !('theme' in keys)) keys.theme = 'custom';
  }
  // One background source at a time: choosing a link drops the uploaded picture and the other way round.
  if (keys.bg_url && !('bg_image' in keys)) keys.bg_image = null;
  if (keys.bg_image && !('bg_url' in keys)) keys.bg_url = null;
  return { config: { ...current, ...keys }, keys };
}

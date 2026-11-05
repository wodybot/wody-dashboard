// Validation of what the dashboard accepts for a bridge. Strict on purpose: out-of-range values are rejected with a
// field-level code (the UI shows a localized message); the bot clamps again when it loads a bridge.
import { fail, pickBool, pickInt, pickText } from '@/lib/modules/validate';
import {
  NAME_MAX, TRANSLATION_LANGUAGES, DEFAULT_TRANSLATION, DEFAULT_ANTISPAM, ANTISPAM_BOUNDS,
} from './constants';

export const SNOWFLAKE = /^\d{15,25}$/;

export function snow(v) {
  const s = String(v ?? '').trim();
  return SNOWFLAKE.test(s) ? s : null;
}

export function cleanName(errors, value, fallback) {
  const raw = typeof value === 'string' ? value : value == null ? fallback : '';
  const s = String(raw).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!s) { fail(errors, 'name', 'required'); return fallback; }
  if (s.length > NAME_MAX) { fail(errors, 'name', 'too_long', { max: NAME_MAX }); return s.slice(0, NAME_MAX); }
  return s;
}

export function cleanTranslation(errors, input, existing = DEFAULT_TRANSLATION) {
  const base = { ...DEFAULT_TRANSLATION, ...(existing || {}) };
  if (input === undefined) return base;
  if (!input || typeof input !== 'object' || Array.isArray(input)) { fail(errors, 'translation', 'invalid'); return base; }
  const out = { ...base };
  out.enabled = pickBool(input.enabled, base.enabled);
  out.detect_source = pickBool(input.detect_source, base.detect_source);
  for (const k of ['a_lang', 'b_lang']) {
    if (input[k] === undefined) continue;
    if (!TRANSLATION_LANGUAGES.includes(input[k])) fail(errors, `translation.${k}`, 'invalid_choice');
    else out[k] = input[k];
  }
  if (out.enabled && out.a_lang === out.b_lang) fail(errors, 'translation.b_lang', 'same_language');
  return out;
}

export function cleanAntispam(errors, input, existing = DEFAULT_ANTISPAM) {
  const base = { ...DEFAULT_ANTISPAM, ...(existing || {}) };
  if (input === undefined) return base;
  if (!input || typeof input !== 'object' || Array.isArray(input)) { fail(errors, 'antispam', 'invalid'); return base; }
  const out = { ...base, enabled: pickBool(input.enabled, base.enabled) };
  for (const [k, [lo, hi]] of Object.entries(ANTISPAM_BOUNDS)) {
    out[k] = pickInt(errors, `antispam.${k}`, input[k], lo, hi, base[k]);
  }
  return out;
}

export function parseSide(errors, field, side) {
  const guild = snow(side?.guild_id);
  const channel = snow(side?.channel_id);
  if (!guild) fail(errors, `${field}.guild_id`, 'invalid_id');
  if (!channel) fail(errors, `${field}.channel_id`, 'invalid_id');
  return { guild_id: guild, channel_id: channel };
}

export function pairKey(channelA, channelB) {
  const [x, y] = BigInt(channelA) < BigInt(channelB) ? [channelA, channelB] : [channelB, channelA];
  return `${x}:${y}`;
}

export { pickText };

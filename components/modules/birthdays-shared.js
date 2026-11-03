import BOT from '@/lib/bot-locales.json';

export const LANGS = ['en', 'ro', 'fr', 'it', 'de', 'es', 'pt', 'nl', 'tr'];
export const LANG_NAMES = { en: 'English', ro: 'Română', fr: 'Français', it: 'Italiano', de: 'Deutsch', es: 'Español', pt: 'Português', nl: 'Nederlands', tr: 'Türkçe' };
export const PRIVACY = ['public', 'community', 'private'];
export const DURATIONS = ['day', '24', '48', 'custom'];
export const MENTIONS = ['member', 'role', 'none'];
export const REMINDER_DAYS = [1, 2, 3, 7];
export const BIRTHDAY_VARIABLES = ['user', 'username', 'displayname', 'server', 'birthday', 'day', 'month', 'age'];
export const REMINDER_VARIABLES = [...BIRTHDAY_VARIABLES.filter((v) => v !== 'age'), 'days', 'when'];

export const CARD_TEMPLATES = {
  classic: { card_overlay_color: '#0f172a', card_color: '#e08a4e', card_text_color: '#ffffff', card_overlay_opacity: 58 },
  party: { card_overlay_color: '#3b0764', card_color: '#f472b6', card_text_color: '#ffffff', card_overlay_opacity: 62 },
  gold: { card_overlay_color: '#1c1917', card_color: '#facc15', card_text_color: '#fef9c3', card_overlay_opacity: 66 },
  ocean: { card_overlay_color: '#082f49', card_color: '#38bdf8', card_text_color: '#f0f9ff', card_overlay_opacity: 60 },
};

export function botText(lang, key, vars) {
  const raw = BOT[lang]?.[key] ?? BOT.en?.[key] ?? '';
  let out = raw;
  for (const [k, v] of Object.entries(vars || {})) out = out.split(`{${k}}`).join(String(v));
  return out;
}

export function monthName(lang, month) { return botText(lang, `birthday.month_${month}`); }
export function dateLabel(lang, month, day) { return botText(lang, 'birthday.date_format', { day, month: monthName(lang, month) }); }

export function sampleContext({ lang, serverName, showAge }) {
  const now = new Date();
  const month = now.getMonth() + 1;
  const day = now.getDate();
  return {
    user: '@Alex', username: 'alex', displayname: 'Alex', server: serverName || 'Your Server',
    birthday: dateLabel(lang, month, day), day: String(day), month: monthName(lang, month), age: showAge ? '25' : '',
    days: '1', when: botText(lang, 'birthday.tomorrow').toLowerCase(),
  };
}

export function fillTemplate(text, ctx) {
  let out = String(text || '');
  for (const [k, v] of Object.entries(ctx)) out = out.split(`{${k}}`).join(v);
  return out.replace(/[ \t]{2,}/g, ' ').trim();
}

export function recommendedSettings(current, channels) {
  const guess = (channels || []).find((c) => [0, 5].includes(c.type) && /birthday|aniversar|geburtstag|cumple|anniv|compleann|verjaardag|doğum/i.test(c.name));
  return {
    announce_enabled: true,
    channel_id: current.channel_id || guess?.id || null,
    card_enabled: true,
    reminder_enabled: false,
    show_age: false,
    privacy_default: 'community',
    role_duration: '24',
    timezone: current.timezone || 'Europe/Bucharest',
    leap_policy: 'feb28',
    mention_mode: 'member',
    board_enabled: false,
    dm_private: false,
  };
}

export function timezoneList() {
  try { return Intl.supportedValuesOf('timeZone'); } catch { return ['UTC', 'Europe/Bucharest', 'Europe/London']; }
}

export function insertAtCursor(el, token, current, apply) {
  if (!el || typeof el.selectionStart !== 'number') { apply(`${current || ''}${token}`); return; }
  const start = el.selectionStart;
  const end = el.selectionEnd;
  const next = `${current.slice(0, start)}${token}${current.slice(end)}`;
  apply(next);
  requestAnimationFrame(() => { el.focus(); const pos = start + token.length; el.setSelectionRange(pos, pos); });
}

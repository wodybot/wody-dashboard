import { M } from './db.js';
import { SOCIALS, SOCIAL_IDS, NOTIF_DEFAULTS, BLOCKED_HOSTS } from './constants.js';

const MAX_LINK = 200;
const HANDLE_RE = /^@?([A-Za-z0-9._-]{2,40})$/;

const hostOk = (host, allowed) => allowed.some((h) => host === h || host.endsWith(`.${h}`));
const isIp = (host) => /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(':') || host.startsWith('[');

export function normalizeSocial(id, raw) {
  const def = SOCIALS.find((s) => s.id === id);
  if (!def) return { code: 'unknown_platform' };
  let text = String(raw ?? '').normalize('NFKC').replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu, '').trim();
  if (!text) return { empty: true };
  if (text.length > MAX_LINK) return { code: 'too_long' };
  const hm = def.handle && !/[./:]/.test(text) ? HANDLE_RE.exec(text) : null;
  if (hm) return { url: def.handle(hm[1]) };
  if (def.handle && !/[/:]/.test(text) && HANDLE_RE.test(text) && !def.hosts.some((h) => text.toLowerCase().endsWith(h))) return { url: def.handle(HANDLE_RE.exec(text)[1]) };
  if (!/^[a-z][a-z0-9+.-]*:/i.test(text)) text = `https://${text}`;
  let u;
  try { u = new URL(text); } catch { return { code: 'invalid_link' }; }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return { code: 'invalid_link' };
  if (u.username || u.password || (u.port && u.port !== '443' && u.port !== '80')) return { code: 'invalid_link' };
  const host = u.hostname.toLowerCase().replace(/\.$/, '');
  if (!host.includes('.') || isIp(host) || host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) return { code: 'invalid_link' };
  if (BLOCKED_HOSTS.some((b) => host === b || host.endsWith(`.${b}`))) return { code: 'blocked_link' };
  if (def.hosts) {
    if (!hostOk(host, def.hosts)) return { code: 'wrong_platform' };
    if (u.pathname.replace(/\/+$/, '').length < 2) return { code: 'invalid_link' };
  }
  const path = u.pathname.replace(/\/+$/, '') || '';
  const out = `https://${host}${path}`;
  if (out.length > MAX_LINK) return { code: 'too_long' };
  return { url: out };
}

export function normalizeSocials(input) {
  const socials = {}; const errors = [];
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { socials, errors: [{ field: 'socials', code: 'invalid' }] };
  for (const id of SOCIAL_IDS) {
    if (!(id in input)) continue;
    const r = normalizeSocial(id, input[id]);
    if (r.empty) continue;
    if (r.url) socials[id] = r.url; else errors.push({ field: id, code: r.code });
  }
  return { socials, errors };
}

export function cleanNotif(input, current = NOTIF_DEFAULTS) {
  const out = { ...NOTIF_DEFAULTS, ...(current || {}) };
  if (input && typeof input === 'object') for (const k of Object.keys(NOTIF_DEFAULTS)) if (typeof input[k] === 'boolean') out[k] = input[k];
  return out;
}

export async function getNotifPrefs(db, userId) {
  try {
    const p = await db.collection(M.profiles).findOne({ user_id: String(userId) }, { projection: { notif: 1, locale: 1 } });
    return { prefs: cleanNotif(null, p?.notif), locale: p?.locale || null };
  } catch { return { prefs: { ...NOTIF_DEFAULTS }, locale: null }; }
}

export const AWAY_NOTE_MAX = 120;
const DAY_RX = /^\d{4}-\d{2}-\d{2}$/;
export function cleanAway(input, current = null) {
  const base = { on: false, note: '', until: null, ...(current || {}) };
  if (!input || typeof input !== 'object') return { out: base, error: null };
  const out = { ...base };
  if (typeof input.on === 'boolean') out.on = input.on;
  if ('note' in input) {
    const note = String(input.note ?? '').replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}<>]/gu, ' ').replace(/\s+/g, ' ').trim();
    if (note.length > AWAY_NOTE_MAX) return { out, error: 'too_long' };
    out.note = note;
  }
  if ('until' in input) {
    const u = String(input.until ?? '').trim();
    if (!u) out.until = null;
    else {
      const d = DAY_RX.test(u) ? new Date(`${u}T00:00:00Z`) : null;
      if (!d || Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== u) return { out, error: 'invalid_date' };
      const today = new Date(); today.setUTCHours(0, 0, 0, 0);
      if (d < today) return { out, error: 'past_date' };
      if (d - today > 366 * 86400000) return { out, error: 'too_far' };
      out.until = u;
    }
  }
  return { out, error: null };
}
export function awayActive(a, now = new Date()) {
  if (!a || a.on !== true) return false;
  if (!a.until) return true;
  return a.until >= now.toISOString().slice(0, 10);
}
export function publicAway(a, now = new Date()) {
  return awayActive(a, now) ? { note: a.note || '', until: a.until || null } : null;
}

const TT_RE = /^[A-Za-z0-9._]{1,40}$/;
export function tiktokUrl(link) {
  const u = String(link?.username || '').replace(/^@/, '');
  return TT_RE.test(u) ? `https://www.tiktok.com/@${u}` : null;
}
export function publicSocials(profile, link) {
  const rest = { ...(profile?.socials || {}) };
  delete rest.tiktok;
  const url = profile?.tiktok_hidden === true ? null : tiktokUrl(link);
  return url ? { tiktok: url, ...rest } : rest;
}
export function tiktokState(profile, link, available) {
  const url = tiktokUrl(link);
  return { connected: Boolean(url), username: url ? String(link.username).replace(/^@/, '') : '', name: url ? String(link.display_name || '').slice(0, 60) : '', hidden: profile?.tiktok_hidden === true, available: Boolean(available) };
}

export const USERNAME_RE = /^[a-z0-9._]{2,32}$/;
export const cleanUsername = (v) => { const s = String(v ?? '').normalize('NFKC').trim().replace(/^@/, '').toLowerCase(); return USERNAME_RE.test(s) ? s : null; };
export function identityFields(user) {
  const username_lc = cleanUsername(user?.username);
  if (!username_lc) return {};
  return { username_lc, display_name: String(user.global_name || user.username || '').replace(/[\p{Cc}\p{Cf}<>]/gu, '').slice(0, 60), avatar_hash: /^[a-z0-9_]{1,64}$/i.test(String(user.avatar || '')) ? String(user.avatar) : null };
}

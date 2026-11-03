
const HEX = /^#?[0-9a-fA-F]{6}$/;
const HTTPS = /^https:\/\/[^\s]{3,500}$/;

export function fail(errors, field, code, params) {
  errors.push({ field, code, ...(params ? { params } : {}) });
}

export function isHex(v) { return typeof v === 'string' && HEX.test(v.trim()); }
export function normHex(v) { return `#${String(v).trim().replace(/^#/, '').toLowerCase()}`; }
export function isHttps(v) { return typeof v === 'string' && HTTPS.test(v.trim()); }

export function cleanText(v, max) {
  return String(v ?? '').replace(/\r\n/g, '\n').slice(0, max).trim();
}

export function pickEnum(errors, field, v, allowed, fallback) {
  if (v === undefined || v === null || v === '') return fallback;
  if (!allowed.includes(v)) { fail(errors, field, 'invalid_choice'); return fallback; }
  return v;
}

export function pickBool(v, fallback) {
  return v === undefined || v === null ? fallback : Boolean(v);
}

export function pickInt(errors, field, v, min, max, fallback) {
  if (v === undefined || v === null || v === '') return fallback;
  const n = Number(v);
  if (!Number.isFinite(n) || !Number.isInteger(n)) { fail(errors, field, 'not_integer'); return fallback; }
  if (n < min || n > max) { fail(errors, field, 'out_of_range', { min, max }); return fallback; }
  return n;
}

export function pickNumber(errors, field, v, min, max, fallback) {
  if (v === undefined || v === null || v === '') return fallback;
  const n = Number(v);
  if (!Number.isFinite(n)) { fail(errors, field, 'not_number'); return fallback; }
  if (n < min || n > max) { fail(errors, field, 'out_of_range', { min, max }); return fallback; }
  return n;
}

export function pickColor(errors, field, v, fallback) {
  if (v === undefined || v === null || v === '') return fallback;
  if (!isHex(v)) { fail(errors, field, 'invalid_color'); return fallback; }
  return normHex(v);
}

export function pickUrl(errors, field, v, fallback = '') {
  if (v === undefined || v === null || v === '') return fallback;
  if (!isHttps(v)) { fail(errors, field, 'invalid_url'); return fallback; }
  return String(v).trim();
}

export function pickText(errors, field, v, max, fallback = '') {
  if (v === undefined || v === null) return fallback;
  const s = cleanText(v, max + 1);
  if (s.length > max) { fail(errors, field, 'too_long', { max }); return s.slice(0, max); }
  return s;
}

export function checkVariables(errors, field, text, allowed) {
  if (!text) return;
  const unknown = new Set();
  for (const m of String(text).matchAll(/\{([^{}\s]*)\}/g)) {
    if (!allowed.includes(m[1])) unknown.add(`{${m[1]}}`);
  }
  if (unknown.size) fail(errors, field, 'unknown_variables', { variables: [...unknown].join(', ') });
}

let _zones = null;
export function validTimezone(name) {
  if (!name || typeof name !== 'string') return false;
  if (!_zones) {
    try { _zones = new Set([...Intl.supportedValuesOf('timeZone'), 'UTC']); } catch { _zones = new Set(['UTC']); }
  }
  if (_zones.has(name)) return true;
  try { new Intl.DateTimeFormat('en', { timeZone: name }); return true; } catch { return false; }
}

export function pickButtons(errors, field, v, max = 2) {
  if (v === undefined || v === null) return [];
  if (!Array.isArray(v)) { fail(errors, field, 'invalid_choice'); return []; }
  const out = [];
  for (const [i, b] of v.slice(0, max).entries()) {
    const label = cleanText(b?.label, 80);
    const url = String(b?.url || '').trim();
    if (!label && !url) continue;
    if (!label) { fail(errors, `${field}.${i}.label`, 'required'); continue; }
    if (!isHttps(url)) { fail(errors, `${field}.${i}.url`, 'invalid_url'); continue; }
    out.push({ label, url });
  }
  if (v.length > max) fail(errors, field, 'too_many', { max });
  return out;
}

export function sameId(a, b) { return String(a) === String(b); }

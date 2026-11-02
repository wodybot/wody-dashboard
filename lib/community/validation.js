// Pure validation for listing content. Used by the API (authoritative) and by the
// owner panel (live progress). No imports from server only modules.
import {
  LIMITS, SECTION_KEYS, LOCKED_SECTIONS, SERVER_TYPES, LANGUAGES, SOCIAL_PLATFORMS, THEME_KEYS, THEME_PRESETS, CARD_STYLES,
  BUTTON_STYLES, RESERVED_SLUGS,
} from './constants.js';

const HEX = /^#[0-9a-fA-F]{6}$/;
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const INVITE_RE = /^[A-Za-z0-9-]{2,32}$/;

export function fail(errors, field, code, params) { errors.push({ field, code, ...(params ? { params } : {}) }); }

export function cleanLine(v, max) {
  // single line text: strip control characters and collapse whitespace
  return String(v ?? '').replace(/[\u0000-\u001f\u007f​-‏‪-‮⁦-⁩]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}
export function cleanBlock(v, max) {
  return String(v ?? '').replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f​-‏‪-‮⁦-⁩]/g, '').slice(0, max).trim();
}

export function slugify(name) {
  const base = String(name || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, LIMITS.slug[1]).replace(/-+$/g, '');
  return base || 'community';
}
export function validSlug(slug) {
  return typeof slug === 'string' && slug.length >= LIMITS.slug[0] && slug.length <= LIMITS.slug[1] && SLUG_RE.test(slug) && !RESERVED_SLUGS.includes(slug);
}

// A public https URL only: no credentials, no IP literals, no local names, no odd ports.
export function safeUrl(raw, { hosts = null } = {}) {
  let u;
  try { u = new URL(String(raw || '').trim()); } catch { return null; }
  if (u.protocol !== 'https:') return null;
  if (u.username || u.password) return null;
  if (u.port && u.port !== '443') return null;
  const host = u.hostname.toLowerCase();
  if (!host.includes('.') || host.endsWith('.local') || host.endsWith('.internal') || host.endsWith('.localhost')) return null;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(':') || host.startsWith('[')) return null;
  if (!/^[a-z0-9.-]+$/.test(host) && !host.startsWith('xn--') && !/^[\p{L}\p{N}.-]+$/u.test(host)) return null;
  if (hosts && !hosts.some((h) => host === h || host.endsWith(`.${h}`))) return null;
  if (u.href.length > 300) return null;
  return u.href;
}

// Markdown-lite: **bold**, *italic*, # headings, - lists, [text](https://...). No HTML, no images.
export function checkMarkdown(errors, field, text) {
  for (const m of text.matchAll(/!\[[^\]]*\]\(/g)) { fail(errors, field, 'markdown_images'); break; }
  for (const m of text.matchAll(/\[[^\]]*\]\(([^)\s]*)[^)]*\)/g)) {
    if (!safeUrl(m[1])) { fail(errors, field, 'invalid_url'); break; }
  }
  if (/<\s*\/?\s*[a-zA-Z!]/.test(text)) fail(errors, field, 'html_not_allowed');
}

export function normalizeInvite(raw) {
  const s = String(raw || '').trim();
  if (!s) return '';
  const m = s.match(/^(?:https:\/\/)?(?:www\.)?(?:discord\.gg|discord(?:app)?\.com\/invite)\/([A-Za-z0-9-]{2,32})\/?$/i);
  const code = m ? m[1] : s;
  return INVITE_RE.test(code) ? code : null;
}

export function defaultSections() {
  return SECTION_KEYS.map((key) => ({ key, enabled: key !== 'events' && key !== 'achievements' }));
}

export function emptyContent(name = '') {
  return {
    name, short_description: '', description: '', category: '', subcategory: '', tags: [], languages: [], server_type: 'community',
    features: [], invite_code: '', banner_id: null, background_id: null,
    theme: { preset: 'dark', ...THEME_PRESETS.dark },
    socials: {}, sections: defaultSections(), staff_role_ids: [], slug: '',
  };
}

// catalog: { categories: Set<slug>, subcategories: Map<slug, Set>, tags: Set, features: Set }
export function sanitizeContent(input, existing, catalog) {
  const errors = [];
  const out = {};
  const has = (k) => input[k] !== undefined;
  const base = { ...emptyContent(), ...(existing || {}) };

  if (has('name')) {
    out.name = cleanLine(input.name, LIMITS.name[1] + 1);
    if (out.name.length < LIMITS.name[0]) fail(errors, 'name', 'required');
    else if (out.name.length > LIMITS.name[1]) { fail(errors, 'name', 'too_long', { max: LIMITS.name[1] }); out.name = out.name.slice(0, LIMITS.name[1]); }
  }
  if (has('short_description')) {
    out.short_description = cleanLine(input.short_description, LIMITS.short[1] + 1);
    if (out.short_description.length > LIMITS.short[1]) { fail(errors, 'short_description', 'too_long', { max: LIMITS.short[1] }); out.short_description = out.short_description.slice(0, LIMITS.short[1]); }
  }
  if (has('description')) {
    out.description = cleanBlock(input.description, LIMITS.description[1] + 1);
    if (out.description.length > LIMITS.description[1]) { fail(errors, 'description', 'too_long', { max: LIMITS.description[1] }); out.description = out.description.slice(0, LIMITS.description[1]); }
    checkMarkdown(errors, 'description', out.description);
  }
  if (has('category')) {
    const c = String(input.category || '');
    if (c && !catalog.categories.has(c)) fail(errors, 'category', 'invalid_choice'); else out.category = c;
  }
  if (has('subcategory') || (has('category') && out.category !== base.category)) {
    const cat = out.category ?? base.category;
    const sub = has('subcategory') ? String(input.subcategory || '') : '';
    if (sub && !(catalog.subcategories.get(cat)?.has(sub))) fail(errors, 'subcategory', 'invalid_choice'); else out.subcategory = sub;
  }
  if (has('tags')) {
    const list = Array.isArray(input.tags) ? [...new Set(input.tags.map(String))] : null;
    if (!list) fail(errors, 'tags', 'invalid_choice');
    else if (list.length > LIMITS.tags) fail(errors, 'tags', 'too_many', { max: LIMITS.tags });
    else if (list.some((t) => !catalog.tags.has(t))) fail(errors, 'tags', 'invalid_choice');
    else out.tags = list;
  }
  if (has('languages')) {
    const list = Array.isArray(input.languages) ? [...new Set(input.languages.map(String))] : null;
    if (!list) fail(errors, 'languages', 'invalid_choice');
    else if (list.length > LIMITS.languages) fail(errors, 'languages', 'too_many', { max: LIMITS.languages });
    else if (list.some((l) => !LANGUAGES.includes(l))) fail(errors, 'languages', 'invalid_choice');
    else out.languages = list;
  }
  if (has('server_type')) {
    if (!SERVER_TYPES.includes(input.server_type)) fail(errors, 'server_type', 'invalid_choice'); else out.server_type = input.server_type;
  }
  if (has('features')) {
    const list = Array.isArray(input.features) ? [...new Set(input.features.map(String))] : null;
    if (!list) fail(errors, 'features', 'invalid_choice');
    else if (list.length > LIMITS.features) fail(errors, 'features', 'too_many', { max: LIMITS.features });
    else if (list.some((f) => !catalog.features.has(f))) fail(errors, 'features', 'invalid_choice');
    else out.features = list;
  }
  if (has('invite_code')) {
    const code = normalizeInvite(input.invite_code);
    if (code === null) fail(errors, 'invite_code', 'invalid_invite'); else out.invite_code = code;
  }
  if (has('slug')) {
    const s = String(input.slug || '').trim().toLowerCase();
    if (!validSlug(s)) fail(errors, 'slug', RESERVED_SLUGS.includes(s) ? 'slug_reserved' : 'invalid_slug'); else out.slug = s;
  }
  if (has('theme')) {
    const t = input.theme && typeof input.theme === 'object' ? input.theme : null;
    if (!t) fail(errors, 'theme', 'invalid_choice');
    else {
      const preset = THEME_KEYS.includes(t.preset) ? t.preset : null;
      if (!preset) fail(errors, 'theme.preset', 'invalid_choice');
      else {
        const seed = preset === 'custom' ? { ...THEME_PRESETS.dark, ...(base.theme || {}) } : THEME_PRESETS[preset];
        const theme = { preset, ...seed };
        if (preset === 'custom') {
          for (const k of ['primary', 'accent', 'secondary', 'background']) {
            if (t[k] !== undefined) { if (!HEX.test(String(t[k]))) fail(errors, `theme.${k}`, 'invalid_color'); else theme[k] = String(t[k]).toLowerCase(); }
          }
          if (t.card_style !== undefined) { if (!CARD_STYLES.includes(t.card_style)) fail(errors, 'theme.card_style', 'invalid_choice'); else theme.card_style = t.card_style; }
          if (t.button_style !== undefined) { if (!BUTTON_STYLES.includes(t.button_style)) fail(errors, 'theme.button_style', 'invalid_choice'); else theme.button_style = t.button_style; }
        }
        out.theme = theme;
      }
    }
  }
  if (has('socials')) {
    const s = input.socials && typeof input.socials === 'object' && !Array.isArray(input.socials) ? input.socials : null;
    if (!s) fail(errors, 'socials', 'invalid_choice');
    else {
      const socials = {};
      for (const [k, v] of Object.entries(s)) {
        if (!SOCIAL_PLATFORMS[k]) { fail(errors, `socials.${k}`, 'invalid_choice'); continue; }
        if (v === '' || v == null) continue;
        const url = safeUrl(v, { hosts: SOCIAL_PLATFORMS[k].hosts });
        if (!url) fail(errors, `socials.${k}`, 'invalid_url'); else socials[k] = url;
      }
      out.socials = socials;
    }
  }
  if (has('sections')) {
    const list = Array.isArray(input.sections) ? input.sections : null;
    if (!list) fail(errors, 'sections', 'invalid_choice');
    else {
      const seen = new Set(); const sections = [];
      for (const item of list) {
        const key = item?.key;
        if (!SECTION_KEYS.includes(key) || seen.has(key)) { fail(errors, 'sections', 'invalid_choice'); break; }
        seen.add(key);
        sections.push({ key, enabled: LOCKED_SECTIONS.includes(key) ? true : Boolean(item.enabled) });
      }
      for (const key of SECTION_KEYS) if (!seen.has(key)) sections.push({ key, enabled: false });
      if (sections[0]?.key !== 'hero') {
        const i = sections.findIndex((s) => s.key === 'hero'); const [hero] = sections.splice(i, 1); sections.unshift(hero);
      }
      out.sections = sections;
    }
  }
  if (has('staff_role_ids')) {
    const list = Array.isArray(input.staff_role_ids) ? [...new Set(input.staff_role_ids.map(String))] : null;
    if (!list || list.some((id) => !/^\d{15,25}$/.test(id))) fail(errors, 'staff_role_ids', 'invalid_choice');
    else if (list.length > LIMITS.staff_roles) fail(errors, 'staff_role_ids', 'too_many', { max: LIMITS.staff_roles });
    else out.staff_role_ids = list;
  }
  return { patch: out, errors };
}

// What a listing needs before it can be submitted. Returns { percent, missing, ok }.
export function completion(content, settings = {}, imageIds = {}) {
  const c = content || {};
  const checks = [
    ['name', Boolean(c.name && c.name.length >= LIMITS.name[0]), true],
    ['short_description', Boolean(c.short_description && c.short_description.length >= LIMITS.short[0]), true],
    ['description', Boolean(c.description && c.description.length >= LIMITS.description[0]), true],
    ['category', Boolean(c.category), true],
    ['languages', Boolean(c.languages?.length), true],
    ['tags', Boolean(c.tags?.length), true],
    ['invite', Boolean(c.invite_code), settings.require_invite !== false],
    ['banner', Boolean(c.banner_id), settings.require_banner !== false],
    ['features', Boolean(c.features?.length), false],
    ['social', Boolean(c.socials && Object.keys(c.socials).length), false],
    ['slug', validSlug(c.slug), true],
  ];
  const considered = checks.filter(([, , required]) => required !== false || true);
  const done = considered.filter(([, ok]) => ok).length;
  const missing = checks.filter(([, ok]) => !ok).map(([key, , required]) => ({ key, required }));
  const ok = !missing.some((m) => m.required);
  return { percent: Math.round((done / considered.length) * 100), missing, ok };
}

// Human readable difference between two content snapshots: { added, changed, removed }.
export function diffContent(a = {}, b = {}) {
  const out = [];
  const flat = (o) => {
    const r = {};
    for (const [k, v] of Object.entries(o || {})) {
      if (k === 'socials') for (const [s, u] of Object.entries(v || {})) r[`socials.${s}`] = u;
      else if (k === 'sections') r.sections = (v || []).map((s) => `${s.key}:${s.enabled ? 1 : 0}`).join(',');
      else if (k === 'theme') r.theme = JSON.stringify(v);
      else r[k] = Array.isArray(v) ? v.join(',') : v;
    }
    return r;
  };
  const fa = flat(a); const fb = flat(b);
  for (const k of new Set([...Object.keys(fa), ...Object.keys(fb)])) {
    const x = fa[k] ?? ''; const y = fb[k] ?? '';
    if (x === y) continue;
    if (!x && y) out.push({ op: '+', field: k });
    else if (x && !y) out.push({ op: '-', field: k });
    else out.push({ op: '~', field: k });
  }
  return out;
}

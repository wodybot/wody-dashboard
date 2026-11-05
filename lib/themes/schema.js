// Validation of theme configurations. Data only: fixed lists, bounded numbers, #rrggbb colors, plain text and https links.
// Nothing here can carry HTML, CSS or script, so a theme can restyle and animate the site but never run code.
import { hasPictograph } from '@/lib/no-emoji';
import {
  LOCALES, CATEGORIES, SCENES, EFFECTS, SIGNATURES, CHAR_POSITIONS, CHAR_LAYERS, CHAR_IDLE, INTRO_STEPS, INTRO_MOBILE, TRANSITIONS, CARD_STYLES,
  BUTTON_STYLES, HEADER_STYLES, NAV_STYLES, BORDER_STYLES, SHADOW_STYLES, HEADING_FONTS, BODY_FONTS, LIMITS, ID_RE, HEX_RE, BG_MOVEMENT, BLOCK_TYPES,
} from './constants.js';

const fail = (error, field) => ({ ok: false, error, field });
const clone = (v) => JSON.parse(JSON.stringify(v));
const num = (v, min, max, field) => { const n = Number(v); return Number.isFinite(n) && n >= min && n <= max ? Math.round(n * 100) / 100 : { bad: field }; };
const isBad = (x) => x && typeof x === 'object' && 'bad' in x;
const oneOf = (v, list) => (list.includes(v) ? v : null);

export function text(v, max, field) {
  const raw = String(v ?? '');
  if (hasPictograph(raw)) return { err: fail('emoji_not_allowed', field) };
  const t = raw.replace(/[\p{Cc}\p{Cf}<>]/gu, ' ').replace(/\s+/g, ' ').trim();
  if ([...t].length > max) return { err: fail('too_long', field) };
  return { v: t };
}
export function https(v) {
  const s = String(v ?? '').trim();
  if (!s) return '';
  try { const u = new URL(s); return u.protocol === 'https:' && !u.username && !u.password && s.length <= 500 ? u.toString() : null; } catch { return null; }
}

// ---------------------------------------------------------------------------------------------- colors and contrast
const rgb = (hex) => { const n = parseInt(String(hex).slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const lum = (hex) => { const c = rgb(hex).map((v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
export const contrast = (a, b) => { const x = lum(a); const y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
export const readableOn = (hex) => (lum(hex) > 0.4 ? '#0b0b0f' : '#ffffff');

/** Returns the first accessibility problem of a palette, or null. Text must stay readable on every surface it can land on. */
export function paletteIssue(p) {
  const pairs = [['text', 'bg', 4.5], ['text', 'surface', 4.5], ['text', 'card', 4.5], ['muted', 'bg', 3.2], ['muted', 'card', 3.2], ['accent', 'bg', 3], ['primary', 'bg', 2.2]];
  for (const [a, b, min] of pairs) if (contrast(p[a], p[b]) < min) return { field: a, against: b, min };
  return null;
}

const COLOR_KEYS = ['primary', 'secondary', 'accent', 'bg', 'surface', 'card', 'border', 'text', 'muted', 'button', 'hover', 'active', 'glow'];
function palette(src, prev, field = 'palette') {
  const out = clone(prev);
  for (const k of COLOR_KEYS) if (k in src) { if (!HEX_RE.test(String(src[k]))) return { err: fail('invalid_color', `${field}.${k}`) }; out[k] = String(src[k]).toLowerCase(); }
  if ('gradient' in src) {
    const g = src.gradient || {};
    const from = String(g.from ?? out.gradient.from); const to = String(g.to ?? out.gradient.to);
    if (!HEX_RE.test(from) || !HEX_RE.test(to)) return { err: fail('invalid_color', `${field}.gradient`) };
    const angle = num(g.angle ?? out.gradient.angle, 0, 360, `${field}.gradient`); if (isBad(angle)) return { err: fail('invalid_number', `${field}.gradient`) };
    out.gradient = { from: from.toLowerCase(), to: to.toLowerCase(), angle };
  }
  const issue = paletteIssue(out);
  if (issue) return { err: { ...fail('low_contrast', `${field}.${issue.field}`), against: issue.against } };
  return { v: out };
}

// ---------------------------------------------------------------------------------------------- global theme
export function normalizeThemeConfig(raw, base) {
  const src = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const out = clone(base);

  if ('meta' in src) {
    const m = src.meta || {};
    const name = text(m.name, LIMITS.name, 'meta.name'); if (name.err) return name.err; if (!name.v) return fail('name_required', 'meta.name');
    const desc = text(m.description, LIMITS.description, 'meta.description'); if (desc.err) return desc.err;
    const cat = oneOf(m.category ?? out.meta.category, CATEGORIES); if (!cat) return fail('invalid_choice', 'meta.category');
    const cover = m.cover ? String(m.cover) : null; if (cover && !/^[a-f0-9]{24}$/.test(cover)) return fail('invalid_asset', 'meta.cover');
    out.meta = { ...out.meta, name: name.v, description: desc.v, category: cat, cover };
  }
  if ('i18n' in src) {
    const i = src.i18n && typeof src.i18n === 'object' ? src.i18n : {};
    const res = {};
    for (const [loc, v] of Object.entries(i)) {
      if (!LOCALES.includes(loc)) return fail('invalid_locale', 'i18n');
      const n = text(v?.name, LIMITS.name, `i18n.${loc}`); if (n.err) return n.err;
      const d = text(v?.description, LIMITS.description, `i18n.${loc}`); if (d.err) return d.err;
      if (n.v || d.v) res[loc] = { name: n.v, description: d.v };
    }
    out.i18n = res;
  }
  if ('palette' in src) { const p = palette(src.palette || {}, out.palette); if (p.err) return p.err; out.palette = p.v; }
  if ('presets' in src) {
    if (!Array.isArray(src.presets) || src.presets.length > LIMITS.presets) return fail('too_many', 'presets');
    const list = []; const seen = new Set();
    for (const p of src.presets) {
      const id = String(p?.id || ''); if (!ID_RE.test(id) || seen.has(id)) return fail('invalid_id', 'presets'); seen.add(id);
      const { id: _x, ...rest } = p; const merged = palette(rest, out.palette, `presets.${id}`); if (merged.err) return merged.err;
      const diff = {}; for (const k of [...COLOR_KEYS]) if (merged.v[k] !== out.palette[k]) diff[k] = merged.v[k];
      list.push({ id, ...diff });
    }
    out.presets = list;
  }
  if ('typography' in src) {
    const t = src.typography || {};
    const h = oneOf(t.heading, HEADING_FONTS); const b = oneOf(t.body, BODY_FONTS);
    if (!h || !b) return fail('invalid_choice', 'typography');
    out.typography = { heading: h, body: b };
  }
  if ('environment' in src) {
    const e = src.environment || {};
    const scene = oneOf(e.scene, SCENES); if (!scene) return fail('invalid_choice', 'environment.scene');
    const fog = num(e.fog, 0, 100, 'environment.fog'); if (isBad(fog)) return fail('invalid_number', 'environment.fog');
    const li = e.lighting || {};
    const lc = String(li.color || ''); if (!HEX_RE.test(lc)) return fail('invalid_color', 'environment.lighting');
    const lint = num(li.intensity, 0, 100, 'environment.lighting'); if (isBad(lint)) return fail('invalid_number', 'environment.lighting');
    const bg = e.background_asset ? String(e.background_asset) : null; if (bg && !/^[a-f0-9]{24}$/.test(bg)) return fail('invalid_asset', 'environment.background_asset');
    out.environment = { scene, fog, lighting: { color: lc.toLowerCase(), intensity: lint }, parallax: e.parallax === true, background_asset: bg };
  }
  if ('effects' in src) {
    if (!Array.isArray(src.effects) || src.effects.length > LIMITS.effects) return fail('too_many', 'effects');
    const seen = new Set(); const list = [];
    for (const f of src.effects) {
      const id = oneOf(f?.id, EFFECTS); if (!id || seen.has(id)) return fail('invalid_choice', 'effects'); seen.add(id);
      const it = num(f.intensity, 0, 100, 'effects'); if (isBad(it)) return fail('invalid_number', 'effects');
      list.push({ id, intensity: it });
    }
    out.effects = list;
  }
  if ('character' in src) {
    const c = src.character || {}; const pv = out.character;
    const id = String(c.id ?? pv.id); if (!/^[a-z][a-z0-9_]{1,39}$/.test(id)) return fail('invalid_id', 'character.id');
    const name = text(c.name ?? pv.name, LIMITS.name, 'character.name'); if (name.err) return name.err;
    const asset = c.asset ? String(c.asset) : null; const mobile = c.mobile_asset ? String(c.mobile_asset) : null;
    for (const a of [asset, mobile]) if (a && !/^[a-f0-9]{24}$/.test(a)) return fail('invalid_asset', 'character.asset');
    const position = oneOf(c.position ?? pv.position, CHAR_POSITIONS); const layer = oneOf(c.layer ?? pv.layer, CHAR_LAYERS); const idle = oneOf(c.idle ?? pv.idle, CHAR_IDLE);
    if (!position || !layer || !idle) return fail('invalid_choice', 'character');
    const ox = num(c.offset_x ?? pv.offset_x, -40, 40, 'character.offset_x'); const oy = num(c.offset_y ?? pv.offset_y, -40, 40, 'character.offset_y');
    const sc = num(c.scale ?? pv.scale, 50, 160, 'character.scale'); const rot = num(c.rotation ?? pv.rotation, -20, 20, 'character.rotation');
    const ii = num(c.idle_intensity ?? pv.idle_intensity, 0, 100, 'character.idle_intensity'); const idur = num(c.idle_duration_ms ?? pv.idle_duration_ms, 2000, 20000, 'character.idle_duration_ms');
    for (const n of [ox, oy, sc, rot, ii, idur]) if (isBad(n)) return fail('invalid_number', `character.${n.bad.split('.')[1] || 'scale'}`);
    const bo = c.breath_origin || pv.breath_origin;
    const bx = num(bo.x, 0, 100, 'character.breath_origin'); const by = num(bo.y, 0, 100, 'character.breath_origin'); const ba = num(bo.angle, -360, 360, 'character.breath_origin');
    if (isBad(bx) || isBad(by) || isBad(ba)) return fail('invalid_number', 'character.breath_origin');
    const it = c.interaction || pv.interaction;
    out.character = {
      id, name: name.v, asset, mobile_asset: mobile, requires_character: (c.requires_character ?? pv.requires_character) === true, position, layer, offset_x: ox, offset_y: oy,
      scale: sc, rotation: rot, idle, idle_intensity: ii, idle_duration_ms: idur, breath_origin: { x: bx, y: by, angle: ba },
      interaction: { on_open: it.on_open === true, on_hover: it.on_hover === true, on_achievement: it.on_achievement === true },
    };
  }
  if ('intro' in src) {
    const i = src.intro || {}; const pv = out.intro;
    const sig = oneOf(i.signature ?? pv.signature, SIGNATURES); const mob = oneOf(i.mobile ?? pv.mobile, INTRO_MOBILE); const tr = oneOf(i.transition ?? pv.transition, TRANSITIONS);
    if (!sig || !mob || !tr) return fail('invalid_choice', 'intro');
    const dur = num(i.duration_ms ?? pv.duration_ms, 1500, LIMITS.introMs, 'intro.duration_ms'); if (isBad(dur)) return fail('invalid_number', 'intro.duration_ms');
    const steps = Array.isArray(i.steps) ? i.steps : pv.steps;
    if (steps.length !== INTRO_STEPS.length) return fail('invalid_steps', 'intro.steps');
    const list = [];
    for (let k = 0; k < steps.length; k += 1) {
      if (steps[k]?.id !== INTRO_STEPS[k]) return fail('invalid_steps', 'intro.steps');
      const ms = num(steps[k].ms, LIMITS.stepMs[0], LIMITS.stepMs[1], 'intro.steps'); if (isBad(ms)) return fail('invalid_number', 'intro.steps');
      list.push({ id: INTRO_STEPS[k], on: steps[k].on !== false, ms });
    }
    // The intro must never become a long wait: the enabled steps are scaled to the configured duration at render time, but the sum is capped here.
    if (list.filter((s) => s.on).reduce((n, s) => n + s.ms, 0) > LIMITS.introMs + 4000) return fail('intro_too_long', 'intro.steps');
    out.intro = { enabled: i.enabled === true, duration_ms: dur, signature: sig, mobile: mob, transition: tr, steps: list, audio: { enabled: (i.audio ? i.audio.enabled : pv.audio?.enabled) === true } }; // a theme may carry a short sound cue; a visitor still has to switch sound on
  }
  if ('components' in src) {
    const c = src.components || {}; const pv = out.components;
    const card = oneOf(c.card_style ?? pv.card_style, CARD_STYLES); const btn = oneOf(c.button_style ?? pv.button_style, BUTTON_STYLES); const head = oneOf(c.header_style ?? pv.header_style, HEADER_STYLES);
    const nav = oneOf(c.nav_style ?? pv.nav_style, NAV_STYLES); const bor = oneOf(c.border_style ?? pv.border_style, BORDER_STYLES); const sha = oneOf(c.shadow_style ?? pv.shadow_style, SHADOW_STYLES);
    if (!card || !btn || !head || !nav || !bor || !sha) return fail('invalid_choice', 'components');
    const glass = num(c.glass ?? pv.glass, 0, 100, 'components.glass'); const blur = num(c.blur ?? pv.blur, 0, 24, 'components.blur'); const radius = num(c.radius ?? pv.radius, 0, 32, 'components.radius');
    if (isBad(glass) || isBad(blur) || isBad(radius)) return fail('invalid_number', 'components');
    out.components = { card_style: card, button_style: btn, header_style: head, nav_style: nav, border_style: bor, shadow_style: sha, glass, blur, radius };
  }
  if ('transitions' in src) {
    const t = src.transitions || {}; const type = oneOf(t.type, TRANSITIONS); const ms = num(t.duration_ms, 150, 1500, 'transitions');
    if (!type) return fail('invalid_choice', 'transitions'); if (isBad(ms)) return fail('invalid_number', 'transitions');
    out.transitions = { type, duration_ms: ms };
  }
  return { ok: true, config: out };
}

// ---------------------------------------------------------------------------------------------- server theme
export const SERVER_DEFAULT = Object.freeze({
  theme_id: null, preset: '', palette: {}, surface_opacity: 100, components: {}, effects: { enabled: true, intensity: 100, items: {} }, intro: { enabled: true }, dashboard: false,
  premium: { animation: 100, movement: 'normal', particle_density: 100, lighting: null, scene: '', character: { enabled: true, position: '', scale: 100 }, banner: '', logo: '', blocks: [], density: 'cozy', surface: {}, gradient: null, glass: null, blur: null, border_style: '', shadow_style: '', nav_style: '' },
});
export const BASIC_COLORS = ['primary', 'secondary', 'accent'];
export const PREMIUM_COLORS = ['bg', 'surface', 'card', 'text', 'muted'];

/** True when the configuration uses a setting that only Premium servers have. */
export function usesPremium(cfg) {
  const p = cfg.premium || {};
  const d = SERVER_DEFAULT.premium;
  return Object.keys(cfg.palette || {}).some((k) => PREMIUM_COLORS.includes(k))
    || p.animation !== d.animation || p.movement !== d.movement || p.particle_density !== d.particle_density || p.lighting || p.scene
    || (p.character && (p.character.enabled === false || p.character.position || p.character.scale !== 100)) || p.banner || p.logo || (p.blocks || []).length
    || p.density !== d.density || p.gradient || p.glass !== null || p.blur !== null || p.border_style || p.shadow_style || p.nav_style;
}

/** `theme` is the published global theme config the server chose; limits come from it (allowed effects, presets, scenes). */
export function normalizeServerConfig(raw, base, { theme } = {}) {
  const src = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const out = clone(base || SERVER_DEFAULT);
  if ('theme_id' in src) {
    if (src.theme_id !== null && !ID_RE.test(String(src.theme_id))) return fail('invalid_theme', 'theme_id');
    out.theme_id = src.theme_id === null ? null : String(src.theme_id);
    if (out.theme_id !== base?.theme_id) { out.preset = ''; out.palette = {}; out.effects = { enabled: true, intensity: 100, items: {} }; out.premium = { ...clone(SERVER_DEFAULT.premium), logo: base?.premium?.logo || '' }; out.components = {}; }
  }
  if ('preset' in src) {
    const id = String(src.preset || '');
    if (id && !(theme?.presets || []).some((p) => p.id === id)) return fail('invalid_choice', 'preset');
    out.preset = id;
  }
  if ('palette' in src) {
    const p = src.palette && typeof src.palette === 'object' ? src.palette : {};
    const res = {};
    for (const [k, v] of Object.entries(p)) {
      if (!BASIC_COLORS.includes(k) && !PREMIUM_COLORS.includes(k)) return fail('invalid_choice', `palette.${k}`);
      if (v === '' || v === null) continue;
      if (!HEX_RE.test(String(v))) return fail('invalid_color', `palette.${k}`);
      res[k] = String(v).toLowerCase();
    }
    out.palette = res;
  }
  if ('surface_opacity' in src) { const n = num(src.surface_opacity, 60, 100, 'surface_opacity'); if (isBad(n)) return fail('invalid_number', 'surface_opacity'); out.surface_opacity = n; }
  if ('components' in src) {
    const c = src.components || {}; const res = {};
    const pick = (k, list) => { if (c[k] === undefined || c[k] === '') return true; const v = oneOf(c[k], list); if (!v) return false; res[k] = v; return true; };
    if (!pick('card_style', CARD_STYLES) || !pick('header_style', HEADER_STYLES) || !pick('button_style', BUTTON_STYLES)) return fail('invalid_choice', 'components');
    out.components = res;
  }
  if ('effects' in src) {
    const e = src.effects || {}; const items = {};
    const allowed = new Set((theme?.effects || []).map((x) => x.id));
    for (const [id, v] of Object.entries(e.items || {})) {
      if (!allowed.has(id)) return fail('invalid_choice', 'effects');
      const n = num(v, 0, 100, 'effects'); if (isBad(n)) return fail('invalid_number', 'effects'); items[id] = n;
    }
    const inten = num(e.intensity ?? 100, 0, 100, 'effects'); if (isBad(inten)) return fail('invalid_number', 'effects');
    out.effects = { enabled: e.enabled !== false, intensity: inten, items };
  }
  if ('intro' in src) out.intro = { enabled: src.intro?.enabled !== false };
  if ('dashboard' in src) out.dashboard = src.dashboard === true;
  if ('premium' in src) {
    const p = src.premium || {}; const pv = out.premium; const r = clone(pv);
    if ('animation' in p) { const n = num(p.animation, 0, 100, 'premium.animation'); if (isBad(n)) return fail('invalid_number', 'premium.animation'); r.animation = n; }
    if ('particle_density' in p) { const n = num(p.particle_density, 0, 100, 'premium.particle_density'); if (isBad(n)) return fail('invalid_number', 'premium.particle_density'); r.particle_density = n; }
    if ('movement' in p) { const v = oneOf(p.movement, BG_MOVEMENT); if (!v) return fail('invalid_choice', 'premium.movement'); r.movement = v; }
    if ('density' in p) { const v = oneOf(p.density, ['compact', 'cozy', 'spacious']); if (!v) return fail('invalid_choice', 'premium.density'); r.density = v; }
    if ('lighting' in p) {
      if (p.lighting === null) r.lighting = null;
      else { const c = String(p.lighting?.color || ''); const n = num(p.lighting?.intensity, 0, 100, 'premium.lighting'); if (!HEX_RE.test(c) || isBad(n)) return fail('invalid_number', 'premium.lighting'); r.lighting = { color: c.toLowerCase(), intensity: n }; }
    }
    if ('scene' in p) { const v = p.scene === '' ? '' : oneOf(p.scene, SCENES); if (v === null) return fail('invalid_choice', 'premium.scene'); r.scene = v; }
    if ('character' in p) {
      const c = p.character || {}; const pos = c.position === '' || c.position === undefined ? '' : oneOf(c.position, CHAR_POSITIONS.filter((x) => x !== 'custom'));
      const sc = num(c.scale ?? 100, 80, 120, 'premium.character'); if (pos === null || isBad(sc)) return fail('invalid_choice', 'premium.character');
      r.character = { enabled: c.enabled !== false, position: pos, scale: sc };
    }
    if ('logo' in p) { const v = String(p.logo || ''); if (v && !/^\/api\/site-image\/[a-f0-9]{24}$/.test(v)) return fail('invalid_url', 'premium.logo'); r.logo = v; }
    if ('banner' in p) { const u = https(p.banner); if (u === null) return fail('invalid_url', 'premium.banner'); r.banner = u; }
    if ('gradient' in p) {
      if (p.gradient === null) r.gradient = null;
      else { const f = String(p.gradient?.from || ''); const t = String(p.gradient?.to || ''); const a = num(p.gradient?.angle ?? 165, 0, 360, 'premium.gradient'); if (!HEX_RE.test(f) || !HEX_RE.test(t) || isBad(a)) return fail('invalid_color', 'premium.gradient'); r.gradient = { from: f.toLowerCase(), to: t.toLowerCase(), angle: a }; }
    }
    if ('glass' in p) { if (p.glass === null) r.glass = null; else { const n = num(p.glass, 0, 100, 'premium.glass'); if (isBad(n)) return fail('invalid_number', 'premium.glass'); r.glass = n; } }
    if ('blur' in p) { if (p.blur === null) r.blur = null; else { const n = num(p.blur, 0, 24, 'premium.blur'); if (isBad(n)) return fail('invalid_number', 'premium.blur'); r.blur = n; } }
    for (const [k, list] of [['border_style', BORDER_STYLES], ['shadow_style', SHADOW_STYLES], ['nav_style', NAV_STYLES]]) {
      if (k in p) { const v = p[k] === '' ? '' : oneOf(p[k], list); if (v === null) return fail('invalid_choice', `premium.${k}`); r[k] = v; }
    }
    if ('blocks' in p) {
      if (!Array.isArray(p.blocks) || p.blocks.length > LIMITS.blocks) return fail('too_many', 'premium.blocks');
      const blocks = [];
      for (const b of p.blocks) {
        const type = oneOf(b?.type, BLOCK_TYPES); if (!type) return fail('invalid_choice', 'premium.blocks');
        const title = text(b.title, 60, 'premium.blocks'); if (title.err) return title.err;
        const entry = { type, title: title.v };
        if (type === 'text') { const t = text(b.text, LIMITS.blockText, 'premium.blocks'); if (t.err) return t.err; if (!t.v) return fail('invalid_choice', 'premium.blocks'); entry.text = t.v; }
        else { const l = text(b.label, 40, 'premium.blocks'); if (l.err) return l.err; const u = https(b.url); if (!l.v || !u) return fail('invalid_url', 'premium.blocks'); entry.label = l.v; entry.url = u; }
        blocks.push(entry);
      }
      r.blocks = blocks;
    }
    out.premium = r;
  }
  // The effective palette must stay readable: the check runs on the merged result, so a server can never make text unreadable.
  if (theme) {
    const merged = mergePalette(theme, out);
    const issue = paletteIssue(merged);
    if (issue) return { ...fail('low_contrast', `palette.${issue.field}`), against: issue.against };
  }
  return { ok: true, config: out };
}

/** The palette a visitor sees: theme palette, the chosen preset, then the server's own colors, then the gradient. */
export function mergePalette(theme, server, premium = true) {
  const preset = (theme.presets || []).find((p) => p.id === server.preset) || {};
  const { id: _id, ...pre } = preset;
  const own = {};
  for (const [k, v] of Object.entries(server.palette || {})) if (BASIC_COLORS.includes(k) || premium) own[k] = v;
  const p = { ...theme.palette, ...pre, ...own };
  if (own.primary && !server.palette?.button) { p.button = own.primary; p.glow = own.primary; p.border = own.primary; }
  if (premium && server.premium?.gradient) p.gradient = server.premium.gradient;
  return p;
}

// ---------------------------------------------------------------------------------------------- publishing checks
/** What a theme still lacks before it can reach servers. Returns a list of codes, empty when it is ready. */
export function publishIssues(cfg, assets = {}) {
  const issues = [];
  const refs = [cfg.meta.cover, cfg.environment.background_asset, cfg.character.asset, cfg.character.mobile_asset].filter(Boolean);
  for (const id of refs) if (!assets[id] || assets[id].status !== 'valid') issues.push(`asset_missing:${id}`);
  if (cfg.character.requires_character && !cfg.character.asset) issues.push('character_missing');
  if (paletteIssue(cfg.palette)) issues.push('low_contrast');
  for (const p of cfg.presets || []) { if (paletteIssue({ ...cfg.palette, ...p })) issues.push(`low_contrast:${p.id}`); }
  if (cfg.intro.enabled && !cfg.intro.steps.some((s) => s.on)) issues.push('intro_empty');
  return issues;
}

import crypto from 'crypto';
import { readFileSync } from 'fs';
import path from 'path';
import { WODY_ICON_FILES } from '@/lib/wody-icons';
import {
  GIF_KINDS, GIF_MODULES, TIMELINE_PHASES, PALETTES, PRESETS, LIMITS, RENDERER_VERSION,
} from './constants';

export const LOCALES = Object.freeze(['en', 'ro', 'fr', 'it', 'de', 'es', 'nl', 'pt', 'tr']);
import { stripPictographs, hasPictograph } from '@/lib/no-emoji';
export { stripPictographs, hasPictograph };

const HEX = /^#[0-9a-f]{6}$/i;
const clamp = (v, [lo, hi], d) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; };

export const DEFAULT_TIMELINE = Object.freeze({
  intro: { on: true, ms: 1400 }, reveal: { on: true, ms: 1800 }, features: { on: true, ms: 3600 },
  latest: { on: false, ms: 3600 }, final: { on: true, ms: 2000 },
});
export const DEFAULT_LATEST_TIMELINE = Object.freeze({
  intro: { on: true, ms: 1400 }, reveal: { on: false, ms: 1800 }, features: { on: false, ms: 3600 },
  latest: { on: true, ms: 5200 }, final: { on: true, ms: 2000 },
});

export function defaultConfig(kind = 'module', module = 'trio') {
  return {
    kind, module: kind === 'module' ? module : null, locale: 'en', preset: 'discord', palette: 'wody',
    colors: { ...PALETTES.wody }, custom: { width: 600, height: 315, fps: 10, colors: 128, maxMb: 5 },
    timeline: JSON.parse(JSON.stringify(kind === 'latest' ? DEFAULT_LATEST_TIMELINE : DEFAULT_TIMELINE)),
    texts: { title: '', subtitle: '', cta: '', features: [] },
  };
}

// Validates and normalizes a config. Returns { ok, config } or { ok:false, error, field }.
export function normalizeConfig(raw, base = null) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const prev = base || defaultConfig('module', 'trio');
  const kind = GIF_KINDS.includes(src.kind) ? src.kind : prev.kind;
  let module = kind === 'module' ? (GIF_MODULES.includes(src.module) ? src.module : prev.module) : null;
  if (kind === 'module' && !GIF_MODULES.includes(module)) return { ok: false, error: 'invalid_module', field: 'module' };
  const locale = LOCALES.includes(src.locale) ? src.locale : prev.locale;
  const preset = Object.hasOwn(PRESETS, src.preset) ? src.preset : prev.preset;
  const palette = Object.hasOwn(PALETTES, src.palette) || src.palette === 'custom' ? src.palette : prev.palette;
  let colors = { ...(PALETTES[palette] || PALETTES.wody) };
  if (palette === 'custom') {
    const c = { ...prev.colors, ...(src.colors || {}) };
    for (const k of ['bg1', 'bg2', 'accent']) {
      if (!HEX.test(String(c[k] || ''))) return { ok: false, error: 'invalid_color', field: k };
      colors[k] = String(c[k]).toLowerCase();
    }
    colors.text = '#ffffff'; colors.soft = '#f1e7db';
    if (contrast(colors.accent, colors.bg1) < 3) return { ok: false, error: 'low_contrast', field: 'accent' };
  }
  const cu = { ...prev.custom, ...(src.custom || {}) };
  const custom = {
    width: clamp(cu.width, LIMITS.width, 600), height: clamp(cu.height, LIMITS.height, 315), fps: clamp(cu.fps, LIMITS.fps, 10),
    colors: clamp(cu.colors, LIMITS.colors, 128), maxMb: clamp(cu.maxMb, LIMITS.maxMb, 5),
  };
  const tl = {};
  const baseTl = kind === (prev.kind) ? prev.timeline : (kind === 'latest' ? DEFAULT_LATEST_TIMELINE : DEFAULT_TIMELINE);
  for (const ph of TIMELINE_PHASES) {
    const s = (src.timeline && src.timeline[ph]) || {};
    const b = baseTl[ph] || DEFAULT_TIMELINE[ph];
    tl[ph] = { on: typeof s.on === 'boolean' ? s.on : b.on, ms: clamp(s.ms ?? b.ms, LIMITS.phaseMs, b.ms) };
  }
  // The phase that belongs to the kind: module GIFs use features, the latest GIF uses latest.
  if (kind === 'latest') { tl.features.on = false; tl.reveal.on = false; } else { tl.latest.on = false; }
  const total = TIMELINE_PHASES.reduce((a, ph) => a + (tl[ph].on ? tl[ph].ms : 0), 0);
  if (total < LIMITS.totalMs[0]) return { ok: false, error: 'timeline_too_short', field: 'timeline' };
  if (total > LIMITS.totalMs[1]) return { ok: false, error: 'timeline_too_long', field: 'timeline' };
  const t = src.texts && typeof src.texts === 'object' ? src.texts : {};
  const pt = prev.texts || {};
  const text = (k, max) => {
    const v = k in t ? t[k] : pt[k];
    const s = String(v ?? '');
    if (hasPictograph(s)) return { err: true };
    return { v: stripPictographs(s).slice(0, max) };
  };
  const texts = { title: '', subtitle: '', cta: '', features: [] };
  for (const [k, max] of [['title', LIMITS.title], ['subtitle', LIMITS.subtitle], ['cta', LIMITS.cta]]) {
    const r = text(k, max); if (r.err) return { ok: false, error: 'emoji_not_allowed', field: k };
    texts[k] = r.v;
  }
  const feats = Array.isArray(t.features) ? t.features : (pt.features || []);
  for (const f of feats.slice(0, LIMITS.features)) {
    const s = String(f?.text ?? '');
    if (hasPictograph(s)) return { ok: false, error: 'emoji_not_allowed', field: 'features' };
    const icon = Object.hasOwn(WODY_ICON_FILES, f?.icon) ? f.icon : '';
    const tx = stripPictographs(s).slice(0, LIMITS.feature);
    if (tx) texts.features.push({ icon, text: tx });
  }
  return { ok: true, config: { kind, module, locale, preset, palette, colors, custom, timeline: tl, texts } };
}

export function resolvedPreset(cfg) {
  if (cfg.preset === 'custom') {
    const c = cfg.custom;
    return { width: c.width - (c.width % 2), height: c.height - (c.height % 2), fps: c.fps, colors: c.colors, maxBytes: c.maxMb * 1024 * 1024 };
  }
  return { ...PRESETS[cfg.preset] };
}

export const totalMs = (cfg) => TIMELINE_PHASES.reduce((a, ph) => a + (cfg.timeline[ph].on ? cfg.timeline[ph].ms : 0), 0);

// Same config + same renderer version always gives the same GIF, so the hash is the cache key.
export function configHash(cfg) {
  return crypto.createHash('sha256').update(`${RENDERER_VERSION}:${JSON.stringify(sortKeys({ cfg, show: resolveShow(cfg) }))}`).digest('hex').slice(0, 32);
}
function sortKeys(v) {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === 'object') return Object.fromEntries(Object.keys(v).sort().map((k) => [k, sortKeys(v[k])]));
  return v;
}

function lum(hex) {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}
export function contrast(a, b) { const x = lum(a); const y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }

// Real copy for the GIFs comes from the site messages so the GIF is localized like the rest of the site.
const contentCache = new Map();
export function loadMessages(locale) {
  const l = LOCALES.includes(locale) ? locale : 'en';
  if (messageCache.has(l)) return messageCache.get(l);
  let m = {};
  try { m = JSON.parse(readFileSync(path.join(process.cwd(), 'messages', `${l}.json`), 'utf8')); } catch { m = {}; }
  messageCache.set(l, m);
  return m;
}
const messageCache = new Map();
export function loadContent(locale) {
  const l = LOCALES.includes(locale) ? locale : 'en';
  if (contentCache.has(l)) return contentCache.get(l);
  let content = null;
  try {
    content = JSON.parse(readFileSync(path.join(process.cwd(), 'messages', `${l}.json`), 'utf8'))?.gifStudio?.content || null;
  } catch { content = null; }
  if (!content && l !== 'en') return loadContent('en');
  contentCache.set(l, content || {});
  return content || {};
}

// What a frame shows: owner overrides win over the localized defaults.
export function resolveShow(cfg) {
  const c = loadContent(cfg.locale);
  const key = cfg.kind === 'module' ? cfg.module : 'latest';
  const d = c[key] || {};
  const feats = cfg.texts.features.length ? cfg.texts.features : (d.features || []);
  return {
    title: cfg.texts.title || d.title || 'Wody',
    subtitle: cfg.texts.subtitle || d.subtitle || '',
    cta: cfg.texts.cta || d.cta || 'wody.online',
    icon: d.icon || 'wody',
    features: feats.filter((f) => f && f.text).slice(0, LIMITS.features).map((f) => ({ icon: Object.hasOwn(WODY_ICON_FILES, f.icon) ? f.icon : 'sparkles', text: f.text })),
    items: (d.items || []).slice(0, 4),
    newLabel: c.newLabel || 'NEW',
  };
}

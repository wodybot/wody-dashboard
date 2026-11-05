// Pure functions that turn a published theme plus a server's choices into the one object the browser engine draws. No database here,
// so the same code runs on the server (page render), in the Owner preview and in the server Theme Studio preview.
import { mergePalette, readableOn, usesPremium, SERVER_DEFAULT, text } from './schema.js';
import { OFFICIAL } from './official.js';

const FONT = {
  heading: { system: 'ui-sans-serif, system-ui, "Segoe UI", Roboto, sans-serif', serif: 'ui-serif, Georgia, "Times New Roman", serif', rounded: 'ui-rounded, "SF Pro Rounded", "Nunito", system-ui, sans-serif', condensed: '"Arial Narrow", "Roboto Condensed", system-ui, sans-serif', wide: '"Segoe UI", "Trebuchet MS", system-ui, sans-serif' },
  body: { system: 'ui-sans-serif, system-ui, "Segoe UI", Roboto, sans-serif', serif: 'ui-serif, Georgia, serif', rounded: 'ui-rounded, "SF Pro Rounded", system-ui, sans-serif' },
};

const hsl = (hex) => {
  const n = parseInt(hex.slice(1), 16); const r = ((n >> 16) & 255) / 255; const g = ((n >> 8) & 255) / 255; const b = (n & 255) / 255;
  const mx = Math.max(r, g, b); const mn = Math.min(r, g, b); const l = (mx + mn) / 2; const d = mx - mn;
  let h = 0; let s = 0;
  if (d) { s = d / (1 - Math.abs(2 * l - 1)); h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h = (h * 60 + 360) % 360; }
  return `${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
};
const hexA = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgb(${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255} / ${a})`; };

/** Localized name and description of a theme. Official themes use the message files (the caller passes `official`), custom ones their own i18n map. */
export function themeLabel(config, id, locale, official) {
  if (official && official[id]) return official[id];
  const l = config.i18n?.[locale] || config.i18n?.en || null;
  return { name: l?.name || config.meta.name, description: l?.description || config.meta.description };
}

export function buildRenderTheme(snapshot, server = null, { premium = false, locale = 'en', label = null } = {}) {
  if (!snapshot?.config) return null;
  const cfg = snapshot.config; const assets = snapshot.assets || {};
  const sv = server ? { ...SERVER_DEFAULT, ...server, premium: { ...SERVER_DEFAULT.premium, ...(server.premium || {}), character: { ...SERVER_DEFAULT.premium.character, ...(server.premium?.character || {}) } } } : SERVER_DEFAULT;
  const prem = premium && usesPremium(sv) ? sv.premium : SERVER_DEFAULT.premium;
  const pal = mergePalette(cfg, sv, premium);
  const comp = { ...cfg.components, ...sv.components };
  if (premium) {
    if (prem.glass !== null) comp.glass = prem.glass;
    if (prem.blur !== null) comp.blur = prem.blur;
    if (prem.border_style) comp.border_style = prem.border_style;
    if (prem.shadow_style) comp.shadow_style = prem.shadow_style;
    if (prem.nav_style) comp.nav_style = prem.nav_style;
  }
  const anim = premium ? prem.animation / 100 : 1;
  const density = premium ? prem.particle_density / 100 : 1;
  const globalFx = sv.effects.enabled === false ? 0 : sv.effects.intensity / 100;
  const effects = cfg.effects.map((e) => ({ id: e.id, intensity: Math.round(e.intensity * ((sv.effects.items?.[e.id] ?? 100) / 100) * globalFx * density) })).filter((e) => e.intensity > 0);
  const lighting = premium && prem.lighting ? prem.lighting : cfg.environment.lighting;
  const scene = premium && prem.scene ? prem.scene : cfg.environment.scene;
  const bg = cfg.environment.background_asset ? assets[cfg.environment.background_asset] : null;
  const cover = cfg.meta.cover ? assets[cfg.meta.cover] : null;
  return {
    id: snapshot.id, version: snapshot.version || 0, name: label?.name || cfg.meta.name, description: label?.description || cfg.meta.description, category: cfg.meta.category,
    cover: cover ? cover.url : null,
    palette: { ...pal, onButton: readableOn(pal.button), onPrimary: readableOn(pal.primary) },
    fonts: { heading: FONT.heading[cfg.typography.heading] || FONT.heading.system, body: FONT.body[cfg.typography.body] || FONT.body.system },
    environment: { scene, fog: cfg.environment.fog, lighting, parallax: cfg.environment.parallax && (!premium || prem.movement !== 'none'), movement: premium ? prem.movement : 'normal', backgroundUrl: bg ? bg.url : null },
    effects,
    character: null, intro: null, // themes are made of light and atmosphere only: no character and no intro
    components: comp, transitions: cfg.transitions, animation: anim,
    surfaceOpacity: sv.surface_opacity / 100,
    banner: premium ? prem.banner || null : null, logo: premium ? prem.logo || null : null, blocks: premium ? prem.blocks : [],
    density: premium ? prem.density : 'cozy',
    dashboard: sv.dashboard === true,
  };
}

/** CSS custom properties for a render theme. Every value was validated as #rrggbb or a bounded number, so nothing here can inject CSS. */
export function themeCssVars(t) {
  const p = t.palette; const c = t.components;
  const glassA = (c.glass / 100) * 0.5 + 0.04;
  const shadow = { none: 'none', soft: '0 8px 24px -12px rgb(0 0 0 / .6)', deep: '0 18px 48px -16px rgb(0 0 0 / .85)', glow: `0 0 32px -6px ${hexA(p.glow, 0.55)}` }[c.shadow_style];
  const border = { none: 'transparent', thin: hexA(p.border, 0.28), glow: hexA(p.border, 0.5), double: hexA(p.border, 0.6) }[c.border_style];
  return {
    '--wt-primary': p.primary, '--wt-secondary': p.secondary, '--wt-accent': p.accent, '--wt-bg': p.bg, '--wt-surface': p.surface, '--wt-card': p.card,
    '--wt-border': border, '--wt-text': p.text, '--wt-muted': p.muted, '--wt-button': p.button, '--wt-hover': p.hover, '--wt-active': p.active, '--wt-glow': p.glow,
    '--wt-on-button': p.onButton, '--wt-gradient': `linear-gradient(${p.gradient.angle}deg, ${p.gradient.from}, ${p.gradient.to})`,
    '--wt-card-bg': c.card_style === 'solid' ? hexA(p.card, t.surfaceOpacity) : c.card_style === 'outline' ? 'transparent' : c.card_style === 'flat' ? hexA(p.surface, t.surfaceOpacity) : hexA(p.card, Math.min(1, glassA + 0.3) * t.surfaceOpacity),
    '--wt-card-border': c.card_style === 'flat' ? 'transparent' : border === 'transparent' ? hexA(p.border, 0.18) : border,
    '--wt-card-shadow': c.card_style === 'glow' ? `0 0 30px -8px ${hexA(p.glow, 0.5)}` : shadow,
    '--wt-blur': `${c.card_style === 'glass' || c.card_style === 'glow' ? c.blur : 0}px`, '--wt-radius': `${c.radius}px`,
    '--wt-btn-radius': c.button_style === 'pill' ? '9999px' : c.button_style === 'square' ? '4px' : '12px',
    '--wt-btn-shadow': c.button_style === 'glow' ? `0 0 22px -4px ${hexA(p.glow, 0.7)}` : 'none',
    '--wt-h-bg': hsl(p.bg), '--wt-h-text': hsl(p.text), '--wt-h-card': hsl(p.card), '--wt-h-surface': hsl(p.surface), '--wt-h-primary': hsl(p.primary),
    '--wt-h-on-primary': hsl(p.onPrimary), '--wt-h-muted': hsl(p.muted), '--wt-h-border': hsl(p.border), '--wt-h-accent': hsl(p.secondary),
    '--wt-font-heading': t.fonts.heading, '--wt-font-body': t.fonts.body, '--wt-transition': `${t.transitions.duration_ms}ms`,
  };
}

export const officialNameKey = (id) => (OFFICIAL[id] ? `themes.official.${id}` : null);
export { text as _text };

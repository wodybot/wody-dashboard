// Turns a validated page theme into CSS custom properties and class names. Only values that passed normalizeTheme() reach
// this file (hex colors, bounded integers, enum names), so nothing here can inject markup or CSS.
import { proxiedImageUrl } from '@/lib/utils';
import { normalizeTheme, themeColors } from './page-theme.js';

/** A picture link that is safe inside CSS url("...") and always same-origin (external pictures go through the image proxy). */
const cssImage = (raw) => {
  const u = proxiedImageUrl(raw);
  return typeof u === 'string' && u ? u.replace(/["')\\\s]/g, (c) => encodeURIComponent(c)) : null;
};

const FONT = {
  system: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  serif: 'ui-serif, Georgia, Cambria, "Times New Roman", serif',
  mono: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  rounded: 'ui-rounded, "SF Pro Rounded", "Hiragino Maru Gothic ProN", Quicksand, Nunito, system-ui, sans-serif',
  condensed: '"Arial Narrow", "Roboto Condensed", "Helvetica Neue", Arial, sans-serif',
  wide: '"Arial", "Helvetica Neue", system-ui, sans-serif',
};
const GAP = { compact: 10, cozy: 16, spacious: 26 };
const PATTERNS = {
  dots: { image: 'radial-gradient(rgba(255,255,255,0.16) 1px, transparent 1.4px)', size: '22px 22px' },
  grid: { image: 'linear-gradient(rgba(255,255,255,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.07) 1px, transparent 1px)', size: '34px 34px' },
  stars: { image: 'radial-gradient(1.6px 1.6px at 20px 30px, rgba(255,255,255,0.9), transparent), radial-gradient(1.2px 1.2px at 90px 70px, rgba(255,255,255,0.7), transparent), radial-gradient(1px 1px at 150px 20px, rgba(255,255,255,0.6), transparent), radial-gradient(1.4px 1.4px at 60px 130px, rgba(255,255,255,0.8), transparent)', size: '180px 160px' },
  diagonal: { image: 'repeating-linear-gradient(45deg, rgba(255,255,255,0.05) 0 2px, transparent 2px 14px)', size: 'auto' },
  hex: { image: 'radial-gradient(circle at 50% 0%, rgba(255,255,255,0.08) 0 2px, transparent 3px), radial-gradient(circle at 0% 50%, rgba(255,255,255,0.08) 0 2px, transparent 3px)', size: '40px 46px' },
};

export function themeModel(stored) {
  const th = normalizeTheme(stored);
  const c = themeColors(th);
  const border = th.border;
  const vars = {
    '--bp-from': c.from, '--bp-to': c.to, '--bp-accent': c.accent, '--bp-accent2': c.accent2,
    '--bp-text': th.text, '--bp-muted': th.muted, '--bp-surface': th.surface, '--bp-border': border, '--bp-good': th.good,
    '--bp-radius': `${th.radius}px`, '--bp-gap': `${GAP[th.density]}px`, '--bp-scale': String(th.scale / 100),
    '--bp-weight': String(th.weight), '--bp-letter': `${th.letter / 10}px`, '--bp-max': `${th.max_width}px`,
    '--bp-heading': FONT[th.heading_font], '--bp-body': FONT[th.body_font],
    '--bp-glow': String(th.glow / 100), '--bp-motion': String(100 / th.motion),
    '--bp-dim': String(th.dim / 100), '--bp-blur': `${th.blur}px`, '--bp-grain': String(th.grain / 100),
    '--bp-vignette': String(th.vignette / 100), '--bp-scan': String(th.scanlines / 100),
  };
  const image = th.mode === 'image' && th.image ? cssImage(th.image) : null;
  const background = image
    ? `center / cover no-repeat url("${image}")`
    : th.mode === 'solid' ? c.from : `linear-gradient(${th.mode === 'preset' ? 160 : th.angle}deg, ${c.from}, ${c.to})`;
  return { theme: th, colors: c, vars, background, pattern: PATTERNS[th.pattern] || null };
}

/** Class names that switch the CSS variants (card style, hover, entrance, title effect). */
export function themeClasses(th) {
  return [
    `bp-card-${th.card_style}`, `bp-hover-${th.hover}`, `bp-enter-${th.entrance}`, `bp-title-${th.title_fx}`,
    `bp-rarity-${th.rarity_glow}`, th.heading_font === 'wide' ? 'bp-wide' : '', th.heading_font === 'condensed' ? 'bp-condensed' : '',
  ].filter(Boolean).join(' ');
}

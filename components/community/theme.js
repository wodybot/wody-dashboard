// Listing theme -> CSS custom properties. Only validated colours and fixed keywords ever
// reach a style attribute; owners cannot inject CSS or JavaScript.
import { THEME_PRESETS } from '@/lib/community/constants';

const HEX = /^#[0-9a-fA-F]{6}$/;
const pick = (v, fallback) => (HEX.test(v || '') ? v : fallback);

export function resolveTheme(theme) {
  const preset = THEME_PRESETS[theme?.preset] || null;
  const base = preset || THEME_PRESETS.dark;
  const src = theme?.preset === 'custom' ? { ...THEME_PRESETS.dark, ...theme } : { ...base, ...(preset ? {} : theme) };
  return {
    primary: pick(src.primary, base.primary), accent: pick(src.accent, base.accent), secondary: pick(src.secondary, base.secondary),
    background: pick(src.background, base.background),
    card_style: ['solid', 'outline', 'glass', 'glow'].includes(src.card_style) ? src.card_style : base.card_style,
    button_style: ['rounded', 'pill', 'square'].includes(src.button_style) ? src.button_style : base.button_style,
  };
}

function rgb(hex) { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
export function readableOn(hex) {
  const [r, g, b] = rgb(hex).map((v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.45 ? '#0b0b0f' : '#ffffff';
}

export function themeVars(theme) {
  const t = resolveTheme(theme);
  const [pr, pg, pb] = rgb(t.primary);
  return {
    '--cm-primary': t.primary, '--cm-accent': t.accent, '--cm-secondary': t.secondary, '--cm-bg': t.background,
    '--cm-on-primary': readableOn(t.primary), '--cm-primary-rgb': `${pr} ${pg} ${pb}`,
    '--cm-radius-btn': t.button_style === 'pill' ? '9999px' : t.button_style === 'square' ? '4px' : '12px',
  };
}

export const cardClass = (style) => ({
  solid: 'bg-[color:var(--cm-secondary)] border border-white/10',
  outline: 'bg-transparent border border-[color:var(--cm-primary)]/40',
  glass: 'bg-white/[0.06] backdrop-blur-md border border-white/15',
  glow: 'bg-[color:var(--cm-secondary)] border border-[color:var(--cm-primary)]/50 shadow-[0_0_28px_-6px_rgb(var(--cm-primary-rgb)/0.55)]',
}[style] || 'bg-[color:var(--cm-secondary)] border border-white/10');

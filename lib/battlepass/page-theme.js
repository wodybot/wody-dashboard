// Appearance of a Battle Pass page (/battlepass and /servers/{server}/battlepass).
//
// The page is built like a member profile page, without the site header and footer, and every visible part can be set:
// background, colors, type, shape, hero, particles and effects, animations, sounds and the order of the sections.
// Everything is data (enums, numbers, colors, https links). There is no custom CSS or script field: a theme can restyle the
// page completely but it cannot run code or load anything except a picture, a video poster or an audio file over https.
import { cleanMusicUrl, cleanPageImage } from '@/lib/profile-page';

export const THEME_PRESETS = {
  ember: { from: '#6b2f12', to: '#120b08', accent: '#e6cd8c', accent2: '#ff8a4c' },
  midnight: { from: '#2a1b5e', to: '#07060f', accent: '#b9a4ff', accent2: '#6d5cff' },
  forest: { from: '#14532d', to: '#06110a', accent: '#86efac', accent2: '#34d399' },
  ocean: { from: '#0c4a6e', to: '#040d14', accent: '#7dd3fc', accent2: '#38bdf8' },
  rose: { from: '#831843', to: '#12060c', accent: '#f9a8d4', accent2: '#fb7185' },
  sunset: { from: '#9a3412', to: '#2e0a2c', accent: '#fdba74', accent2: '#f472b6' },
  aurora: { from: '#0f766e', to: '#1e1145', accent: '#5eead4', accent2: '#a78bfa' },
  mono: { from: '#3f3f46', to: '#09090b', accent: '#e4e4e7', accent2: '#a1a1aa' },
  gold: { from: '#4a3508', to: '#0d0a02', accent: '#facc15', accent2: '#f59e0b' },
  crimson: { from: '#7f1d1d', to: '#0c0404', accent: '#fca5a5', accent2: '#ef4444' },
};

export const THEME_CHOICES = {
  background: { mode: ['preset', 'gradient', 'image', 'solid'], pattern: ['none', 'dots', 'grid', 'stars', 'diagonal', 'hex'], preset: Object.keys(THEME_PRESETS) },
  layout: ['track', 'grid', 'timeline', 'cards'],
  card_style: ['glass', 'solid', 'outline', 'neon', 'flat'],
  density: ['compact', 'cozy', 'spacious'],
  heading_font: ['system', 'serif', 'mono', 'rounded', 'condensed', 'wide'],
  body_font: ['system', 'serif', 'mono', 'rounded'],
  title_fx: ['none', 'typewriter', 'glow', 'gradient', 'neon', 'shimmer'],
  progress_style: ['bar', 'ring', 'segments', 'orb'],
  particles: ['none', 'snow', 'embers', 'stars', 'confetti', 'bubbles', 'sparks', 'petals', 'rain'],
  entrance: ['none', 'fade', 'slide', 'zoom', 'stagger'],
  hover: ['none', 'lift', 'glow', 'tilt', 'shine'],
  level_up_fx: ['none', 'pulse', 'burst', 'fireworks', 'shockwave'],
  claim_fx: ['none', 'pulse', 'burst', 'confetti', 'flash'],
  sound_pack: ['none', 'soft', 'arcade', 'crystal', 'orchestral', 'minimal'],
  rarity_glow: ['off', 'subtle', 'strong'],
};

export const THEME_SECTIONS = ['hero', 'progress', 'track', 'quests', 'achievements', 'collections', 'showcase', 'leaderboard', 'rules'];
export const THEME_RANGES = {
  radius: [0, 36], scale: [85, 125], weight: [400, 800], letter: [-2, 8], dim: [0, 90], blur: [0, 24], angle: [0, 360],
  particle_intensity: [0, 100], particle_speed: [10, 300], glow: [0, 100], grain: [0, 60], vignette: [0, 80], scanlines: [0, 40],
  motion: [50, 200], volume: [0, 100], ambient_volume: [0, 60], max_width: [880, 1760],
};
const COLOR_KEYS = ['from', 'to', 'accent', 'accent2', 'text', 'muted', 'surface', 'border', 'good', 'particle_color'];
const BOOLEANS = ['parallax', 'show_timer', 'show_rank', 'show_percent', 'show_next', 'sticky_progress', 'sound_enabled', 'aurora', 'hide_locked_names', 'confetti_on_open'];
const TEXTS = { subtitle: 140, hero_cta: 40, rules_note: 400 };
const STRING_ENUMS = {
  mode: THEME_CHOICES.background.mode, pattern: THEME_CHOICES.background.pattern, preset: THEME_CHOICES.background.preset,
  layout: THEME_CHOICES.layout, card_style: THEME_CHOICES.card_style, density: THEME_CHOICES.density,
  heading_font: THEME_CHOICES.heading_font, body_font: THEME_CHOICES.body_font, title_fx: THEME_CHOICES.title_fx,
  progress_style: THEME_CHOICES.progress_style, particles: THEME_CHOICES.particles, entrance: THEME_CHOICES.entrance,
  hover: THEME_CHOICES.hover, level_up_fx: THEME_CHOICES.level_up_fx, claim_fx: THEME_CHOICES.claim_fx,
  sound_pack: THEME_CHOICES.sound_pack, rarity_glow: THEME_CHOICES.rarity_glow,
};
const IMAGES = ['image', 'banner', 'logo'];
const AUDIO = ['ambient'];

export const THEME_DEFAULT = {
  mode: 'preset', preset: 'midnight', from: '#2a1b5e', to: '#07060f', angle: 160, image: null, dim: 55, blur: 0, pattern: 'stars',
  accent: '#b9a4ff', accent2: '#6d5cff', text: '#f4f2ff', muted: '#a8a3c2', surface: '#14112a', border: '#ffffff', good: '#4ade80',
  layout: 'track', card_style: 'glass', density: 'cozy', radius: 18, heading_font: 'system', body_font: 'system', scale: 100, weight: 700, letter: 0,
  max_width: 1280, title_fx: 'gradient', progress_style: 'bar', banner: null, logo: null, subtitle: '', hero_cta: '', rules_note: '',
  parallax: true, show_timer: true, show_rank: true, show_percent: true, show_next: true, sticky_progress: true, aurora: false,
  hide_locked_names: false, confetti_on_open: false,
  particles: 'stars', particle_intensity: 35, particle_speed: 60, particle_color: '#ffffff', glow: 30, grain: 0, vignette: 20, scanlines: 0,
  entrance: 'stagger', hover: 'lift', level_up_fx: 'burst', claim_fx: 'confetti', motion: 100, rarity_glow: 'subtle',
  sound_enabled: false, sound_pack: 'soft', volume: 40, ambient: null, ambient_volume: 20,
  order: [...THEME_SECTIONS], hide: [],
};

const COLOR = /^#[0-9a-fA-F]{6}$/;
const bad = (key) => { throw new Error(key); };

function cleanText(v, max, key) {
  if (typeof v !== 'string') bad(key);
  const t = v.replace(/[\p{Cc}\p{Cf}<>]/gu, '').trim();
  if ([...t].length > max) bad(key);
  return t;
}

/** Validates a partial change. Throws Error(field) for the first problem; used by the API and by normalizeTheme. */
export function validateThemePatch(patch) {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) bad('body');
  const out = {};
  for (const [key, value] of Object.entries(patch)) {
    if (Object.prototype.hasOwnProperty.call(STRING_ENUMS, key)) {
      if (!STRING_ENUMS[key].includes(value)) bad(key);
      out[key] = value;
    } else if (COLOR_KEYS.includes(key)) {
      if (typeof value !== 'string' || !COLOR.test(value)) bad(key);
      out[key] = value.toLowerCase();
    } else if (Object.prototype.hasOwnProperty.call(THEME_RANGES, key)) {
      const [lo, hi] = THEME_RANGES[key];
      if (typeof value !== 'number' || !Number.isInteger(value) || value < lo || value > hi) bad(key);
      out[key] = value;
    } else if (BOOLEANS.includes(key)) {
      if (typeof value !== 'boolean') bad(key);
      out[key] = value;
    } else if (IMAGES.includes(key)) {
      try { out[key] = cleanPageImage(value); } catch { bad(key); }
    } else if (AUDIO.includes(key)) {
      try { out[key] = cleanMusicUrl(value); } catch { bad(key); }
    } else if (Object.prototype.hasOwnProperty.call(TEXTS, key)) {
      out[key] = cleanText(value, TEXTS[key], key);
    } else if (key === 'order' || key === 'hide') {
      if (!Array.isArray(value) || value.some((v) => !THEME_SECTIONS.includes(v)) || new Set(value).size !== value.length) bad(key);
      out[key] = key === 'order' ? [...value, ...THEME_SECTIONS.filter((s) => !value.includes(s))] : value;
    } else {
      bad(key);
    }
  }
  return out;
}

export function normalizeTheme(stored) {
  const cfg = { ...THEME_DEFAULT, order: [...THEME_SECTIONS], hide: [] };
  if (stored && typeof stored === 'object') {
    for (const [key, value] of Object.entries(stored)) {
      try { Object.assign(cfg, validateThemePatch({ [key]: value })); } catch { /* an invalid stored value falls back to the default */ }
    }
  }
  return cfg;
}

/** Colors the page actually uses: a preset brings its own four colors, any other mode uses the colors the owner picked. */
export function themeColors(cfg) {
  if (cfg.mode === 'preset') return THEME_PRESETS[cfg.preset] || THEME_PRESETS.midnight;
  return { from: cfg.from, to: cfg.mode === 'solid' ? cfg.from : cfg.to, accent: cfg.accent, accent2: cfg.accent2 };
}

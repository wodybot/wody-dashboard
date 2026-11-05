// Battle Pass Page Studio: a dedicated public page for a published season. The page only arranges data the season really has
// (levels, rewards, quests, achievements, collections, rules, progress); it never invents rewards, tiers or numbers.
export const PAGE_COLL = 'bp_pages';
export const PAGE_STATUSES = Object.freeze(['draft', 'generating', 'ready', 'published', 'scheduled', 'archived', 'disabled', 'failed']);
// Built-in sections, in their default order. Each one needs real data to show anything and is hidden when it has none.
export const SECTION_TYPES = Object.freeze([
  'hero', 'overview', 'countdown', 'progress', 'track', 'featured', 'quests_daily', 'quests_weekly', 'challenges',
  'collections', 'leaderboard', 'player', 'statistics', 'rules', 'faq', 'footer',
]);
// Predefined custom components. They carry validated data only: no HTML, no script, no style attribute.
export const BLOCK_TYPES = Object.freeze(['text', 'image', 'button', 'divider']);
export const LAYOUT_WIDTH = Object.freeze({ narrow: 960, normal: 1280, wide: 1560 });
export const SPACING = Object.freeze(['compact', 'cozy', 'spacious']);
export const PRESET_THEMES = Object.freeze({
  dark_fantasy: { mode: 'gradient', from: '#1a0f24', to: '#050309', angle: 165, pattern: 'stars', accent: '#c9a24b', accent2: '#7a3fb0', text: '#f3ecdc', muted: '#b3a78f', surface: '#140d1c', card_style: 'glass', heading_font: 'serif', title_fx: 'shimmer', particles: 'embers', vignette: 45, glow: 40 },
  dragon_season: { mode: 'gradient', from: '#3a0d05', to: '#0a0302', angle: 160, pattern: 'diagonal', accent: '#ff8a3c', accent2: '#d6361f', text: '#fff1e6', muted: '#d1a58c', surface: '#1c0a06', card_style: 'neon', heading_font: 'condensed', title_fx: 'glow', particles: 'sparks', vignette: 50, glow: 55 },
  ice_realm: { mode: 'gradient', from: '#0b2742', to: '#030a14', angle: 170, pattern: 'dots', accent: '#8fd8ff', accent2: '#4f8cff', text: '#eaf6ff', muted: '#9bb6cc', surface: '#0a1a2c', card_style: 'glass', heading_font: 'system', title_fx: 'gradient', particles: 'snow', vignette: 30, glow: 35 },
  clean_light: { mode: 'solid', from: '#f6f4ef', accent: '#8a4b14', accent2: '#c9803a', text: '#1d1a16', muted: '#5f574c', surface: '#ffffff', border: '#000000', card_style: 'outline', heading_font: 'system', title_fx: 'none', particles: 'none', vignette: 0, glow: 0, dim: 0 },
});
export const LIMITS = Object.freeze({
  sections: 40, blocks: 12, faq: 12, links: 6, highlights: 4, versions: 30, history: 100,
  title: 70, description: 200, text: 1000, label: 40, alt: 120, q: 120, a: 500, slug: 60,
});
export const RESERVED_SLUGS = Object.freeze(['help', 's', 'api', 'new', 'admin', 'owner', 'preview']);
export const SLUG_RE = /^[a-z0-9][a-z0-9-]{2,59}$/;
export const DEFAULT_SECTION_TITLES = Object.freeze({});

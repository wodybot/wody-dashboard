// The five official themes. They describe environment, effects, palette and cinematic intro; the character is WODY, the Wody dragon.
// WODY is a separate optimized image (public/themes, drawn by scripts/art/wody-dragon-rig.mjs and owned by Wody), attached to each theme
// when the themes are first created. The engine only handles effects and interface, it never draws the dragon.
export const OFFICIAL_ELEMENT = { wody_fire_dragon: 'fire', wody_ice_dragon: 'ice', wody_storm_dragon: 'storm', wody_shadow_dragon: 'shadow', wody_nature_dragon: 'nature' };
import { CATEGORIES } from './constants.js';

const steps = (...pairs) => pairs.map(([id, on, ms]) => ({ id, on, ms }));
const BASE_STEPS = (sig, ms = 900) => steps(['dark', true, 700], ['light', true, 700], ['environment', true, 900], ['character', true, 1100], ['eyes', true, 500], ['breath', true, 700], ['signature', sig !== 'none', ms], ['reveal', true, 900]);
const intro = (signature) => ({ enabled: true, duration_ms: 6500, signature, mobile: 'short', transition: 'cinematic', steps: BASE_STEPS(signature), audio: { enabled: true } });
const character = (id, name, pos, breath) => ({
  id, name, asset: null, mobile_asset: null, requires_character: true, position: pos, layer: 'background', offset_x: 0, offset_y: 0, scale: 100, rotation: 0,
  idle: 'breathe', idle_intensity: 40, idle_duration_ms: 7000, breath_origin: breath, interaction: { on_open: true, on_hover: false, on_achievement: false },
});
const preset = (id, p) => ({ id, ...p });

export const OFFICIAL = {
  wody_fire_dragon: {
    meta: { category: 'fire', name: 'Fire Dragon', description: 'Volcanic dark fantasy: an ancient fire dragon above a molten landscape.', cover: null, official: true },
    palette: { primary: '#ff6a1f', secondary: '#b3120f', accent: '#ffc247', bg: '#0b0605', surface: '#160b08', card: '#1d0e0a', border: '#ff6a1f', text: '#fff3e8', muted: '#d1b09c', button: '#ff6a1f', hover: '#ff8a3c', active: '#d94f0a', glow: '#ff5a1a', gradient: { from: '#2a0d06', to: '#080303', angle: 170 } },
    presets: [preset('ember', {}), preset('crimson', { primary: '#e02a2a', button: '#e02a2a', hover: '#f04a4a', active: '#b01c1c', glow: '#e02a2a', border: '#e02a2a' }), preset('molten_gold', { primary: '#ffb02e', button: '#ffb02e', hover: '#ffc55c', active: '#d18a10', glow: '#ffb02e', border: '#ffb02e' })],
    typography: { heading: 'serif', body: 'system' },
    environment: { scene: 'volcano', fog: 35, lighting: { color: '#ff7a2a', intensity: 55 }, parallax: true, background_asset: null },
    effects: [{ id: 'embers', intensity: 70 }, { id: 'heat', intensity: 40 }, { id: 'smoke', intensity: 35 }, { id: 'rays', intensity: 30 }],
    character: character('wody', 'WODY', 'right', { x: 68, y: 28, angle: 168 }),
    intro: intro('fire_breath'),
    components: { card_style: 'glow', button_style: 'rounded', header_style: 'glass', nav_style: 'underline', border_style: 'glow', shadow_style: 'deep', glass: 40, blur: 10, radius: 14 },
    transitions: { type: 'cinematic', duration_ms: 700 },
  },
  wody_ice_dragon: {
    meta: { category: 'ice', name: 'Ice Dragon', description: 'A frozen kingdom: an ancient ice dragon, crystal light and a slow snowfall.', cover: null, official: true },
    palette: { primary: '#5fd4ff', secondary: '#16385f', accent: '#e8f6ff', bg: '#050b16', surface: '#0a1626', card: '#0d1d33', border: '#5fd4ff', text: '#eef8ff', muted: '#a3bccf', button: '#5fd4ff', hover: '#8ae1ff', active: '#33b4e6', glow: '#5fd4ff', gradient: { from: '#0b2742', to: '#030812', angle: 175 } },
    presets: [preset('glacier', {}), preset('cyan', { primary: '#22e0e0', button: '#22e0e0', hover: '#58eaea', active: '#12b4b4', glow: '#22e0e0', border: '#22e0e0' }), preset('silver', { primary: '#c3cfdc', button: '#c3cfdc', hover: '#dce4ec', active: '#9aa9b9', glow: '#c3cfdc', border: '#c3cfdc' })],
    typography: { heading: 'wide', body: 'system' },
    environment: { scene: 'glacier', fog: 45, lighting: { color: '#9fe3ff', intensity: 50 }, parallax: true, background_asset: null },
    effects: [{ id: 'snow', intensity: 70 }, { id: 'frost', intensity: 40 }, { id: 'mist', intensity: 40 }, { id: 'shards', intensity: 30 }, { id: 'wind', intensity: 30 }],
    character: character('wody', 'WODY', 'left', { x: 31, y: 28, angle: 12 }),
    intro: intro('frost_breath'),
    components: { card_style: 'glass', button_style: 'pill', header_style: 'glass', nav_style: 'pills', border_style: 'thin', shadow_style: 'soft', glass: 55, blur: 14, radius: 18 },
    transitions: { type: 'light', duration_ms: 700 },
  },
  wody_storm_dragon: {
    meta: { category: 'storm', name: 'Storm Dragon', description: 'A thunderstorm over dark mountains with a storm dragon and controlled lightning.', cover: null, official: true },
    palette: { primary: '#4d7cff', secondary: '#7a3fd0', accent: '#c9d4e6', bg: '#05060f', surface: '#0b0d1c', card: '#10132a', border: '#4d7cff', text: '#f0f3ff', muted: '#a6adc9', button: '#4d7cff', hover: '#7195ff', active: '#2f5ee0', glow: '#4d7cff', gradient: { from: '#10163a', to: '#04050c', angle: 165 } },
    presets: [preset('electric_blue', {}), preset('violet', { primary: '#9a5cff', button: '#9a5cff', hover: '#b185ff', active: '#7a3fd0', glow: '#9a5cff', border: '#9a5cff' }), preset('midnight', { primary: '#6b86c9', button: '#6b86c9', hover: '#8ba2da', active: '#4d66a8', glow: '#6b86c9', border: '#6b86c9' })],
    typography: { heading: 'condensed', body: 'system' },
    environment: { scene: 'storm', fog: 40, lighting: { color: '#7fa0ff', intensity: 45 }, parallax: true, background_asset: null },
    effects: [{ id: 'rain', intensity: 60 }, { id: 'lightning', intensity: 40 }, { id: 'wind', intensity: 40 }, { id: 'mist', intensity: 30 }],
    character: character('wody', 'WODY', 'center', { x: 36, y: 28, angle: 168 }),
    intro: intro('lightning_strike'),
    components: { card_style: 'glass', button_style: 'rounded', header_style: 'solid', nav_style: 'underline', border_style: 'glow', shadow_style: 'deep', glass: 35, blur: 10, radius: 12 },
    transitions: { type: 'scene', duration_ms: 650 },
  },
  wody_shadow_dragon: {
    meta: { category: 'shadow', name: 'Shadow Dragon', description: 'Dark fantasy in a ruined kingdom: a shadow dragon, deep fog and controlled glow.', cover: null, official: true },
    palette: { primary: '#8b3fd9', secondary: '#a3122a', accent: '#c7c9d1', bg: '#040306', surface: '#0c0912', card: '#120d1c', border: '#8b3fd9', text: '#f3eefa', muted: '#b0a6c0', button: '#8b3fd9', hover: '#a463ee', active: '#6d27b8', glow: '#8b3fd9', gradient: { from: '#1a0f2a', to: '#030205', angle: 170 } },
    presets: [preset('void', {}), preset('crimson', { primary: '#d4203f', button: '#d4203f', hover: '#e5476a', active: '#a3122a', glow: '#d4203f', border: '#d4203f' }), preset('dark_violet', { primary: '#6d4bd1', button: '#6d4bd1', hover: '#8c6ee6', active: '#5236ad', glow: '#6d4bd1', border: '#6d4bd1' })],
    typography: { heading: 'serif', body: 'system' },
    environment: { scene: 'void', fog: 55, lighting: { color: '#9a5cff', intensity: 40 }, parallax: true, background_asset: null },
    effects: [{ id: 'motes', intensity: 55 }, { id: 'mist', intensity: 45 }, { id: 'rays', intensity: 35 }],
    character: character('wody', 'WODY', 'center', { x: 36, y: 28, angle: 168 }),
    intro: intro('shadow_pulse'),
    components: { card_style: 'solid', button_style: 'square', header_style: 'transparent', nav_style: 'minimal', border_style: 'thin', shadow_style: 'deep', glass: 20, blur: 8, radius: 8 },
    transitions: { type: 'environment', duration_ms: 700 },
  },
  wody_nature_dragon: {
    meta: { category: 'nature', name: 'Nature Dragon', description: 'An ancient fantasy forest: a nature dragon, green and golden light and a natural breeze.', cover: null, official: true },
    palette: { primary: '#2fbf71', secondary: '#0f2e1c', accent: '#e6c35a', bg: '#040a06', surface: '#0a1710', card: '#0e2016', border: '#2fbf71', text: '#f0faf3', muted: '#a5bfae', button: '#2fbf71', hover: '#55d68f', active: '#1f9455', glow: '#2fbf71', gradient: { from: '#0d2a18', to: '#030804', angle: 165 } },
    presets: [preset('emerald', {}), preset('forest', { primary: '#4f9b5c', button: '#4f9b5c', hover: '#6fb67b', active: '#3a7a45', glow: '#4f9b5c', border: '#4f9b5c' }), preset('gold', { primary: '#e6c35a', button: '#e6c35a', hover: '#f0d57d', active: '#bf9c35', glow: '#e6c35a', border: '#e6c35a' })],
    typography: { heading: 'rounded', body: 'rounded' },
    environment: { scene: 'forest', fog: 40, lighting: { color: '#9fe6a8', intensity: 55 }, parallax: true, background_asset: null },
    effects: [{ id: 'pollen', intensity: 50 }, { id: 'leaves', intensity: 35 }, { id: 'rays', intensity: 45 }, { id: 'mist', intensity: 30 }],
    character: character('wody', 'WODY', 'left', { x: 31, y: 28, angle: 12 }),
    intro: intro('nature_bloom'),
    components: { card_style: 'glass', button_style: 'rounded', header_style: 'gradient', nav_style: 'pills', border_style: 'thin', shadow_style: 'soft', glass: 45, blur: 12, radius: 16 },
    transitions: { type: 'background', duration_ms: 700 },
  },
};

export const officialConfig = (id) => (OFFICIAL[id] ? JSON.parse(JSON.stringify(OFFICIAL[id])) : null);
export const CATEGORY_SET = new Set(CATEGORIES);

/** A blank custom theme: neutral palette, no character, no intro. */
export function blankConfig() {
  return {
    meta: { category: 'custom', name: 'New theme', description: '', cover: null, official: false },
    palette: { primary: '#6d5cff', secondary: '#1b1740', accent: '#e6cd8c', bg: '#07060f', surface: '#0f0d22', card: '#14112a', border: '#6d5cff', text: '#f4f2ff', muted: '#aaa6c4', button: '#6d5cff', hover: '#8a7cff', active: '#5444d6', glow: '#6d5cff', gradient: { from: '#1b1740', to: '#05040c', angle: 165 } },
    presets: [],
    typography: { heading: 'system', body: 'system' },
    environment: { scene: 'plain', fog: 20, lighting: { color: '#8a7cff', intensity: 35 }, parallax: false, background_asset: null },
    effects: [],
    character: { id: 'none', name: '', asset: null, mobile_asset: null, requires_character: false, position: 'right', layer: 'background', offset_x: 0, offset_y: 0, scale: 100, rotation: 0, idle: 'none', idle_intensity: 30, idle_duration_ms: 7000, breath_origin: { x: 50, y: 40, angle: 0 }, interaction: { on_open: false, on_hover: false, on_achievement: false } },
    intro: { enabled: false, duration_ms: 5000, signature: 'none', mobile: 'short', transition: 'fade', steps: BASE_STEPS('none'), audio: { enabled: false } },
    components: { card_style: 'glass', button_style: 'rounded', header_style: 'glass', nav_style: 'underline', border_style: 'thin', shadow_style: 'soft', glass: 40, blur: 10, radius: 14 },
    transitions: { type: 'fade', duration_ms: 500 },
    i18n: {},
  };
}

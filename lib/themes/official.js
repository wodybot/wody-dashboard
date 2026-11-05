// The official themes. Each one is an atmosphere made only of light, sky, sea, city, plants and drifting particles: no characters and no
// animals. Colours, effects and the scene can all be changed by a server with Premium (see Theme Studio).
import { CATEGORIES } from './constants.js';

const NO_INTRO = { enabled: false, duration_ms: 5000, signature: 'none', mobile: 'off', transition: 'fade', steps: ['dark', 'light', 'environment', 'character', 'eyes', 'breath', 'signature', 'reveal'].map((id) => ({ id, on: id === 'dark' || id === 'reveal', ms: 700 })), audio: { enabled: false } };
const NO_CHARACTER = { id: 'none', name: '', asset: null, mobile_asset: null, requires_character: false, position: 'right', layer: 'background', offset_x: 0, offset_y: 0, scale: 100, rotation: 0, idle: 'none', idle_intensity: 30, idle_duration_ms: 7000, breath_origin: { x: 50, y: 30, angle: 0 }, interaction: { on_open: false, on_hover: false, on_achievement: false } };
const preset = (id, p) => ({ id, ...p });
const accent = (hex, hover, active) => ({ primary: hex, button: hex, hover, active, glow: hex, border: hex });

function theme({ category, name, description, palette, presets, heading = 'system', scene, fog, lighting, effects, components, transition }) {
  return {
    meta: { category, name, description, cover: null, official: true },
    palette, presets, typography: { heading, body: 'system' },
    environment: { scene, fog, lighting, parallax: true, background_asset: null },
    effects, character: { ...NO_CHARACTER }, intro: JSON.parse(JSON.stringify(NO_INTRO)), components, transitions: transition,
  };
}
const GRAD = (from, to, angle = 160) => ({ from, to, angle });

export const OFFICIAL = {
  wody_miami_neon: theme({
    category: 'neon', name: 'Miami Neon', description: 'A neon sunset over palms and a glowing skyline, with light streaks and warm sparks.',
    palette: { primary: '#ff4f9a', secondary: '#4a0f6b', accent: '#ffc65a', bg: '#0a0414', surface: '#14081f', card: '#1a0a28', border: '#ff4f9a', text: '#fff1f8', muted: '#d6b2c8', button: '#ff4f9a', hover: '#ff74b0', active: '#d9327c', glow: '#ff4f9a', gradient: GRAD('#4a0f6b', '#ff4f9a') },
    presets: [preset('sunset', {}), preset('teal_wave', { ...accent('#18d9c8', '#4de8da', '#0fa89b'), secondary: '#0b3a5a', accent: '#ffe08a' }), preset('electric', { ...accent('#7a5cff', '#9a82ff', '#5a3fdd'), secondary: '#1a0f6b', accent: '#ff6ad5' })],
    heading: 'wide', scene: 'miami', fog: 25, lighting: { color: '#ff7ac0', intensity: 55 },
    effects: [{ id: 'neon', intensity: 60 }, { id: 'sparks', intensity: 45 }, { id: 'stars', intensity: 35 }, { id: 'rays', intensity: 25 }],
    components: { card_style: 'glow', button_style: 'pill', header_style: 'glass', nav_style: 'pills', border_style: 'glow', shadow_style: 'glow', glass: 45, blur: 12, radius: 18 },
    transition: { type: 'light', duration_ms: 600 },
  }),
  wody_synthwave: theme({
    category: 'neon', name: 'Synthwave', description: 'A retro grid horizon, a striped sun and neon mountains under a sky of stars.',
    palette: { primary: '#b44dff', secondary: '#2a0b5e', accent: '#35e6ff', bg: '#06020f', surface: '#0d0620', card: '#120829', border: '#b44dff', text: '#f6f0ff', muted: '#b9a8d8', button: '#b44dff', hover: '#c777ff', active: '#8c2fd6', glow: '#b44dff', gradient: GRAD('#2a0b5e', '#b44dff') },
    presets: [preset('violet', {}), preset('cyan', { ...accent('#35e6ff', '#68ecff', '#14b8d8'), secondary: '#0a2a5e', accent: '#ff5ad8' }), preset('red_line', { ...accent('#ff3d6e', '#ff6b91', '#d41f4d'), secondary: '#3b0a2e', accent: '#ffd35a' })],
    heading: 'wide', scene: 'synthwave', fog: 15, lighting: { color: '#35e6ff', intensity: 50 },
    effects: [{ id: 'neon', intensity: 70 }, { id: 'stars', intensity: 45 }, { id: 'motes', intensity: 20 }],
    components: { card_style: 'glass', button_style: 'square', header_style: 'glass', nav_style: 'underline', border_style: 'glow', shadow_style: 'glow', glass: 40, blur: 10, radius: 8 },
    transition: { type: 'scene', duration_ms: 600 },
  }),
  wody_aurora: theme({
    category: 'sky', name: 'Aurora', description: 'Slow green and violet ribbons of light over a snowy ridge, with falling snow.',
    palette: { primary: '#3de3a8', secondary: '#12355e', accent: '#a78bff', bg: '#030912', surface: '#08141f', card: '#0b1b2a', border: '#3de3a8', text: '#effcf7', muted: '#a5c4bb', button: '#3de3a8', hover: '#68ecc0', active: '#22b884', glow: '#3de3a8', gradient: GRAD('#12355e', '#3de3a8') },
    presets: [preset('green', {}), preset('violet', { ...accent('#a78bff', '#bfa9ff', '#7f5de6'), secondary: '#25175e', accent: '#58e8d0' }), preset('ice', { ...accent('#6fd3ff', '#97e0ff', '#3fb2e6'), secondary: '#0e2a52', accent: '#c9f2ff' })],
    heading: 'rounded', scene: 'aurora', fog: 30, lighting: { color: '#7dffd0', intensity: 50 },
    effects: [{ id: 'stars', intensity: 55 }, { id: 'snow', intensity: 40 }, { id: 'mist', intensity: 30 }],
    components: { card_style: 'glass', button_style: 'rounded', header_style: 'glass', nav_style: 'pills', border_style: 'thin', shadow_style: 'soft', glass: 55, blur: 14, radius: 16 },
    transition: { type: 'fade', duration_ms: 700 },
  }),
  wody_cosmos: theme({
    category: 'space', name: 'Cosmos', description: 'Nebula clouds, a ringed planet and a slow drift of stars, with the odd shooting star.',
    palette: { primary: '#7b8cff', secondary: '#1b1466', accent: '#ffd36b', bg: '#04030d', surface: '#0b0a1f', card: '#100e2b', border: '#7b8cff', text: '#f1f2ff', muted: '#aeb1d6', button: '#7b8cff', hover: '#9eaaff', active: '#5566e0', glow: '#7b8cff', gradient: GRAD('#1b1466', '#7b8cff') },
    presets: [preset('indigo', {}), preset('magenta', { ...accent('#ff6ad5', '#ff8fe0', '#d63fb0'), secondary: '#4a0f5e', accent: '#7be8ff' }), preset('gold', { ...accent('#ffc247', '#ffd36b', '#d99a1a'), secondary: '#3a1e0a', accent: '#fff0b8' })],
    heading: 'condensed', scene: 'cosmos', fog: 10, lighting: { color: '#9eaaff', intensity: 45 },
    effects: [{ id: 'stars', intensity: 70 }, { id: 'motes', intensity: 30 }, { id: 'rays', intensity: 20 }],
    components: { card_style: 'glass', button_style: 'rounded', header_style: 'transparent', nav_style: 'minimal', border_style: 'thin', shadow_style: 'deep', glass: 35, blur: 10, radius: 12 },
    transition: { type: 'environment', duration_ms: 700 },
  }),
  wody_sakura: theme({
    category: 'nature', name: 'Sakura', description: 'A pale moon behind cherry blossom branches and a gentle fall of petals at dusk.',
    palette: { primary: '#ff8fc0', secondary: '#4a1a4f', accent: '#ffe3ee', bg: '#0d0510', surface: '#170a1c', card: '#1d0c24', border: '#ff8fc0', text: '#fff3f8', muted: '#d3b4c4', button: '#ff8fc0', hover: '#ffa9d0', active: '#e0669f', glow: '#ff8fc0', gradient: GRAD('#4a1a4f', '#ff8fc0') },
    presets: [preset('blossom', {}), preset('lilac', { ...accent('#c79bff', '#d6b6ff', '#a273e6'), secondary: '#2a1a5e', accent: '#f1e3ff' }), preset('peach', { ...accent('#ffb089', '#ffc4a6', '#e68a5e'), secondary: '#4a1f1a', accent: '#fff0e3' })],
    heading: 'serif', scene: 'sakura', fog: 25, lighting: { color: '#ffb6d6', intensity: 45 },
    effects: [{ id: 'petals', intensity: 65 }, { id: 'fireflies', intensity: 30 }, { id: 'mist', intensity: 25 }],
    components: { card_style: 'glass', button_style: 'pill', header_style: 'gradient', nav_style: 'pills', border_style: 'thin', shadow_style: 'soft', glass: 45, blur: 12, radius: 20 },
    transition: { type: 'background', duration_ms: 700 },
  }),
  wody_ocean: theme({
    category: 'sky', name: 'Midnight Ocean', description: 'A bright moon over slow waves, silver light on the water and rising bubbles.',
    palette: { primary: '#35c2ff', secondary: '#0a3050', accent: '#cfeeff', bg: '#020812', surface: '#071524', card: '#0a1c30', border: '#35c2ff', text: '#eef8ff', muted: '#a3bccf', button: '#35c2ff', hover: '#69d2ff', active: '#1696d1', glow: '#35c2ff', gradient: GRAD('#0a3050', '#35c2ff') },
    presets: [preset('deep_blue', {}), preset('teal', { ...accent('#1fe0c0', '#58ead3', '#12b09a'), secondary: '#0a3a3f', accent: '#d2fff4' }), preset('coral', { ...accent('#ff7a7a', '#ff9a9a', '#e05555'), secondary: '#3a1020', accent: '#ffe3d6' })],
    heading: 'rounded', scene: 'ocean', fog: 30, lighting: { color: '#9fdcff', intensity: 50 },
    effects: [{ id: 'bubbles', intensity: 55 }, { id: 'rays', intensity: 35 }, { id: 'mist', intensity: 30 }, { id: 'stars', intensity: 30 }],
    components: { card_style: 'glass', button_style: 'rounded', header_style: 'glass', nav_style: 'underline', border_style: 'thin', shadow_style: 'soft', glass: 50, blur: 14, radius: 14 },
    transition: { type: 'fade', duration_ms: 700 },
  }),
  wody_stadium: theme({
    category: 'sport', name: 'Match Night', description: 'Floodlights over a striped pitch, a ball on the centre spot and confetti in the air.',
    palette: { primary: '#2fd36b', secondary: '#06301a', accent: '#ffe27a', bg: '#03100a', surface: '#07200f', card: '#0a2a15', border: '#2fd36b', text: '#effff4', muted: '#a9c9b4', button: '#2fd36b', hover: '#5ae28d', active: '#1ea850', glow: '#2fd36b', gradient: GRAD('#06301a', '#2fd36b') },
    presets: [preset('pitch', {}), preset('derby', { ...accent('#ff4a4a', '#ff7a7a', '#cc2a2a'), secondary: '#3a0a10', accent: '#ffe27a' }), preset('night_blue', { ...accent('#3fa7ff', '#73c1ff', '#2b7fcc'), secondary: '#0a2040', accent: '#dff1ff' })],
    heading: 'wide', scene: 'stadium', fog: 22, lighting: { color: '#fff3b0', intensity: 50 },
    effects: [{ id: 'confetti', intensity: 40 }, { id: 'flashes', intensity: 45 }, { id: 'rays', intensity: 35 }, { id: 'stars', intensity: 30 }],
    components: { card_style: 'glow', button_style: 'pill', header_style: 'glass', nav_style: 'pills', border_style: 'glow', shadow_style: 'glow', glass: 40, blur: 12, radius: 16 },
    transition: { type: 'light', duration_ms: 600 },
  }),
  wody_taxi: theme({
    category: 'city', name: 'Night Taxi', description: 'A yellow cab under glowing streetlights on a wet city road, with rain and neon streaks.',
    palette: { primary: '#ffc61a', secondary: '#1a1405', accent: '#fff1a8', bg: '#06060c', surface: '#0e0e18', card: '#14141f', border: '#ffc61a', text: '#fffbe8', muted: '#bdb79a', button: '#ffc61a', hover: '#ffd84d', active: '#d9a400', glow: '#ffc61a', gradient: GRAD('#1a1405', '#ffc61a') },
    presets: [preset('yellow_cab', {}), preset('green_cab', { ...accent('#31e0a0', '#66ead0', '#1ab27f'), secondary: '#052a1f', accent: '#d9fff0' }), preset('red_cab', { ...accent('#ff5a5a', '#ff8484', '#d63a3a'), secondary: '#2a0a0a', accent: '#ffe0d6' })],
    heading: 'wide', scene: 'taxi', fog: 30, lighting: { color: '#ffd84d', intensity: 50 },
    effects: [{ id: 'rain', intensity: 45 }, { id: 'neon', intensity: 35 }, { id: 'mist', intensity: 30 }, { id: 'motes', intensity: 20 }],
    components: { card_style: 'glass', button_style: 'pill', header_style: 'glass', nav_style: 'pills', border_style: 'thin', shadow_style: 'soft', glass: 45, blur: 12, radius: 18 },
    transition: { type: 'background', duration_ms: 700 },
  }),
  wody_ring: theme({
    category: 'sport', name: 'Fight Night', description: 'Spotlights on a boxing ring with three ropes, corner pads and flashing cameras.',
    palette: { primary: '#ff3b3b', secondary: '#2a0a0a', accent: '#ffd24a', bg: '#08040a', surface: '#14080f', card: '#1c0b14', border: '#ff3b3b', text: '#fff3ee', muted: '#c9a9a9', button: '#ff3b3b', hover: '#ff6464', active: '#d12525', glow: '#ff3b3b', gradient: GRAD('#2a0a0a', '#ff3b3b') },
    presets: [preset('red_corner', {}), preset('blue_corner', { ...accent('#3b82ff', '#70a3ff', '#2a60cc'), secondary: '#0a1230', accent: '#e1ecff' }), preset('gold', { ...accent('#ffc233', '#ffd466', '#d19a14'), secondary: '#2a1c05', accent: '#fff2c4' })],
    heading: 'wide', scene: 'ring', fog: 28, lighting: { color: '#ffe9b0', intensity: 50 },
    effects: [{ id: 'flashes', intensity: 55 }, { id: 'rays', intensity: 40 }, { id: 'smoke', intensity: 25 }, { id: 'sparks', intensity: 30 }],
    components: { card_style: 'glow', button_style: 'pill', header_style: 'glass', nav_style: 'pills', border_style: 'glow', shadow_style: 'glow', glass: 40, blur: 12, radius: 16 },
    transition: { type: 'light', duration_ms: 600 },
  }),
  wody_racing: theme({
    category: 'sport', name: 'Race Circuit', description: 'A night circuit with red and white kerbs, five start lights and streaks of speed.',
    palette: { primary: '#ff2d3d', secondary: '#1a0a10', accent: '#ffe14a', bg: '#05060c', surface: '#0e1018', card: '#141722', border: '#ff2d3d', text: '#fff2f2', muted: '#b9bccb', button: '#ff2d3d', hover: '#ff5966', active: '#d11a2a', glow: '#ff2d3d', gradient: GRAD('#1a0a10', '#ff2d3d') },
    presets: [preset('red_flag', {}), preset('cyan_lap', { ...accent('#22d7ff', '#63e5ff', '#12a6cc'), secondary: '#08283a', accent: '#e0fbff' }), preset('lime_lap', { ...accent('#8cff3a', '#aeff6e', '#66cc1e'), secondary: '#122a08', accent: '#f1ffd9' })],
    heading: 'wide', scene: 'racing', fog: 20, lighting: { color: '#ff7a86', intensity: 50 },
    effects: [{ id: 'speedlines', intensity: 55 }, { id: 'sparks', intensity: 35 }, { id: 'stars', intensity: 30 }],
    components: { card_style: 'glow', button_style: 'pill', header_style: 'glass', nav_style: 'pills', border_style: 'glow', shadow_style: 'glow', glass: 40, blur: 12, radius: 16 },
    transition: { type: 'light', duration_ms: 500 },
  }),
  wody_arcade: theme({
    category: 'event', name: 'Retro Arcade', description: 'Drifting pixel blocks on a glowing grid with scanlines, like a screen from the old days.',
    palette: { primary: '#7a5cff', secondary: '#12083a', accent: '#46f0ff', bg: '#05030f', surface: '#0d0a22', card: '#140f30', border: '#7a5cff', text: '#f4f1ff', muted: '#b0a9d4', button: '#7a5cff', hover: '#9a82ff', active: '#5a3ed6', glow: '#7a5cff', gradient: GRAD('#12083a', '#7a5cff') },
    presets: [preset('purple_screen', {}), preset('green_screen', { ...accent('#3dff8a', '#74ffad', '#22cc66'), secondary: '#06260f', accent: '#d9ffe8' }), preset('amber_screen', { ...accent('#ffb020', '#ffc85a', '#d18a08'), secondary: '#2a1a05', accent: '#fff0c8' })],
    heading: 'wide', scene: 'arcade', fog: 10, lighting: { color: '#46f0ff', intensity: 50 },
    effects: [{ id: 'stars', intensity: 40 }, { id: 'neon', intensity: 40 }, { id: 'sparks', intensity: 30 }],
    components: { card_style: 'glow', button_style: 'pill', header_style: 'glass', nav_style: 'pills', border_style: 'glow', shadow_style: 'glow', glass: 40, blur: 12, radius: 16 },
    transition: { type: 'light', duration_ms: 500 },
  }),
  wody_court: theme({
    category: 'sport', name: 'Hoops Night', description: 'A polished court under spotlights, with a hoop, a backboard and a ball waiting at the line.',
    palette: { primary: '#ff8a2a', secondary: '#1a1020', accent: '#ffd9a0', bg: '#07060c', surface: '#120e18', card: '#1a1422', border: '#ff8a2a', text: '#fff4ea', muted: '#c5b1a2', button: '#ff8a2a', hover: '#ffa254', active: '#d46a10', glow: '#ff8a2a', gradient: GRAD('#1a1020', '#ff8a2a') },
    presets: [preset('classic', {}), preset('royal', { ...accent('#4d7bff', '#7f9fff', '#3358cc'), secondary: '#0a1230', accent: '#e1e9ff' }), preset('mint', { ...accent('#2ee6a8', '#62efc2', '#1ab380'), secondary: '#06261f', accent: '#d9fff3' })],
    heading: 'wide', scene: 'court', fog: 22, lighting: { color: '#ffd9a0', intensity: 50 },
    effects: [{ id: 'rays', intensity: 40 }, { id: 'flashes', intensity: 40 }, { id: 'motes', intensity: 25 }, { id: 'confetti', intensity: 25 }],
    components: { card_style: 'glass', button_style: 'pill', header_style: 'glass', nav_style: 'pills', border_style: 'thin', shadow_style: 'soft', glass: 45, blur: 12, radius: 18 },
    transition: { type: 'light', duration_ms: 600 },
  }),
  wody_lofi: theme({
    category: 'nature', name: 'Lofi Rain', description: 'A rainy window with blurry city lights, a warm desk lamp and a cup of tea.',
    palette: { primary: '#ffa85c', secondary: '#1a1030', accent: '#ffd9a8', bg: '#07060e', surface: '#120e1c', card: '#1a1528', border: '#ffa85c', text: '#fff3e6', muted: '#bfb3c9', button: '#ffa85c', hover: '#ffc08a', active: '#d9823a', glow: '#ffa85c', gradient: GRAD('#1a1030', '#ffa85c') },
    presets: [preset('warm_lamp', {}), preset('cool_blue', { ...accent('#6fb4ff', '#9ccdff', '#4a90d9'), secondary: '#0a1a30', accent: '#e0efff' }), preset('rose', { ...accent('#ff7ab0', '#ff9cc6', '#d9568a'), secondary: '#2a0f20', accent: '#ffe0ee' })],
    heading: 'rounded', scene: 'lofi', fog: 30, lighting: { color: '#ffc08a', intensity: 50 },
    effects: [{ id: 'rain', intensity: 55 }, { id: 'motes', intensity: 30 }, { id: 'mist', intensity: 25 }, { id: 'fireflies', intensity: 20 }],
    components: { card_style: 'glass', button_style: 'pill', header_style: 'glass', nav_style: 'pills', border_style: 'thin', shadow_style: 'soft', glass: 45, blur: 12, radius: 18 },
    transition: { type: 'fade', duration_ms: 800 },
  }),
  wody_festival: theme({
    category: 'event', name: 'Festival Lights', description: 'A main stage with light beams, a glowing LED wall and confetti over the crowd area.',
    palette: { primary: '#ff4fd8', secondary: '#16083a', accent: '#5ce1ff', bg: '#05030e', surface: '#0e0820', card: '#150b2c', border: '#ff4fd8', text: '#fff0fd', muted: '#c4a9cf', button: '#ff4fd8', hover: '#ff7de3', active: '#d12eb0', glow: '#ff4fd8', gradient: GRAD('#16083a', '#ff4fd8') },
    presets: [preset('pink_stage', {}), preset('electric_blue', { ...accent('#3b6bff', '#6e91ff', '#2a4ecc'), secondary: '#0a1238', accent: '#e0e9ff' }), preset('sunrise', { ...accent('#ff8a3b', '#ffa96e', '#d96a1c'), secondary: '#2a1205', accent: '#fff0d9' })],
    heading: 'wide', scene: 'festival', fog: 26, lighting: { color: '#ff9cef', intensity: 50 },
    effects: [{ id: 'confetti', intensity: 55 }, { id: 'flashes', intensity: 45 }, { id: 'rays', intensity: 45 }, { id: 'sparks', intensity: 35 }],
    components: { card_style: 'glow', button_style: 'pill', header_style: 'glass', nav_style: 'pills', border_style: 'glow', shadow_style: 'glow', glass: 40, blur: 12, radius: 16 },
    transition: { type: 'light', duration_ms: 600 },
  }),
  wody_cyberpunk: theme({
    category: 'neon', name: 'Cyber City', description: 'A rainy neon city of glowing signs, layered towers and wires across the sky.',
    palette: { primary: '#00e5ff', secondary: '#120a3a', accent: '#ff3df0', bg: '#04030d', surface: '#0b0920', card: '#120e2c', border: '#00e5ff', text: '#effcff', muted: '#a9bdd4', button: '#00e5ff', hover: '#4df0ff', active: '#00b3cc', glow: '#00e5ff', gradient: GRAD('#120a3a', '#00e5ff') },
    presets: [preset('cyan_pink', {}), preset('toxic', { ...accent('#8aff1a', '#aeff58', '#66cc08'), secondary: '#102a05', accent: '#e8ffc4' }), preset('magenta', { ...accent('#ff3df0', '#ff72f5', '#cc20bf'), secondary: '#2a0a30', accent: '#ffe0fb' })],
    heading: 'wide', scene: 'cyberpunk', fog: 28, lighting: { color: '#ff7af5', intensity: 50 },
    effects: [{ id: 'rain', intensity: 50 }, { id: 'neon', intensity: 55 }, { id: 'mist', intensity: 30 }, { id: 'sparks', intensity: 25 }],
    components: { card_style: 'glow', button_style: 'pill', header_style: 'glass', nav_style: 'pills', border_style: 'glow', shadow_style: 'glow', glass: 40, blur: 12, radius: 16 },
    transition: { type: 'light', duration_ms: 600 },
  }),
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
    character: { ...NO_CHARACTER },
    intro: JSON.parse(JSON.stringify(NO_INTRO)),
    components: { card_style: 'glass', button_style: 'rounded', header_style: 'glass', nav_style: 'underline', border_style: 'thin', shadow_style: 'soft', glass: 40, blur: 10, radius: 14 },
    transitions: { type: 'fade', duration_ms: 500 },
    i18n: {},
  };
}

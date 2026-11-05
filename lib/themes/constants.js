// Wody Dynamic Themes: shared constants. Everything a theme can contain is picked from the fixed lists below, so a theme can
// restyle the website but never carry HTML, CSS or script.
export const THEME_COLL = 'site_themes';          // global themes (official and custom), draft and published copies, versions
export const ASSET_COLL = 'theme_assets';         // asset metadata. The image bytes stay in site_images, a theme only keeps the reference
export const GUILD_COLL = 'guild_themes';         // one document per server: the chosen theme and its limited overrides
export const AUDIT_COLL = 'theme_audit';          // who did what, shown in the Owner Panel

export const LOCALES = Object.freeze(['en', 'ro', 'fr', 'it', 'de', 'es', 'nl', 'pt', 'tr']);
export const STATUSES = Object.freeze(['draft', 'preview', 'published', 'scheduled', 'disabled', 'archived']);
export const CATEGORIES = Object.freeze(['neon', 'sky', 'space', 'nature', 'seasonal', 'event', 'sport', 'city', 'custom']);
export const SCENES = Object.freeze(['miami', 'synthwave', 'aurora', 'cosmos', 'sakura', 'ocean', 'stadium', 'taxi', 'ring', 'racing', 'arcade', 'court', 'lofi', 'festival', 'cyberpunk', 'plain']);
export const EFFECTS = Object.freeze(['embers', 'heat', 'smoke', 'snow', 'frost', 'mist', 'shards', 'rain', 'lightning', 'wind', 'motes', 'rays', 'leaves', 'pollen', 'stars', 'petals', 'bubbles', 'fireflies', 'neon', 'sparks', 'confetti', 'speedlines', 'flashes']);
export const SIGNATURES = Object.freeze(['none']);
export const CHAR_POSITIONS = Object.freeze(['left', 'center', 'right', 'hero', 'custom']);
export const CHAR_LAYERS = Object.freeze(['background', 'foreground']);
export const CHAR_IDLE = Object.freeze(['none', 'breathe', 'float', 'sway']);
export const INTRO_STEPS = Object.freeze(['dark', 'light', 'environment', 'character', 'eyes', 'breath', 'signature', 'reveal']);
export const INTRO_MOBILE = Object.freeze(['full', 'short', 'off']);
export const TRANSITIONS = Object.freeze(['fade', 'cinematic', 'scene', 'light', 'environment', 'character', 'background']);
export const CARD_STYLES = Object.freeze(['glass', 'solid', 'outline', 'glow', 'flat']);
export const BUTTON_STYLES = Object.freeze(['rounded', 'pill', 'square', 'glow']);
export const HEADER_STYLES = Object.freeze(['transparent', 'glass', 'solid', 'gradient']);
export const NAV_STYLES = Object.freeze(['pills', 'underline', 'minimal']);
export const BORDER_STYLES = Object.freeze(['none', 'thin', 'glow', 'double']);
export const SHADOW_STYLES = Object.freeze(['none', 'soft', 'deep', 'glow']);
export const HEADING_FONTS = Object.freeze(['system', 'serif', 'rounded', 'condensed', 'wide']);
export const BODY_FONTS = Object.freeze(['system', 'serif', 'rounded']);
export const PERF_PROFILES = Object.freeze(['low', 'medium', 'high', 'ultra']);
export const ASSET_KINDS = Object.freeze(['character', 'background', 'environment', 'cover', 'effect', 'icon']);
export const BG_MOVEMENT = Object.freeze(['none', 'slow', 'normal']);
export const BLOCK_TYPES = Object.freeze(['text', 'button']);
export const LICENSE_TYPES = Object.freeze(['owned', 'commissioned', 'cc0', 'cc_by', 'commercial', 'generated']);

// Particle budget and frame rate per performance profile. The engine multiplies every effect by these numbers.
export const PERF = Object.freeze({
  low: { particles: 0.15, fps: 24, lightning: false, intro: 'off', dpr: 1 },
  medium: { particles: 0.45, fps: 30, lightning: true, intro: 'short', dpr: 1 },
  high: { particles: 0.6, fps: 40, lightning: true, intro: 'full', dpr: 1 },
  ultra: { particles: 0.75, fps: 48, lightning: true, intro: 'full', dpr: 1.5 },
});

export const LIMITS = Object.freeze({
  name: 60, description: 240, effects: 8, presets: 6, steps: 8, introMs: 8000, stepMs: [150, 2500], blocks: 3, blockText: 240,
  versions: 20, history: 100, slug: 40, license: 200, assetBytes: 4 * 1024 * 1024, logoBytes: 1024 * 1024, effectCapBasic: 60, maxHistory: 50,
});
export const ID_RE = /^[a-z][a-z0-9_]{2,39}$/;
export const HEX_RE = /^#[0-9a-fA-F]{6}$/;
// Minimum pixel sizes by asset kind: a smaller file would be stretched and look pixelated.
export const ASSET_MIN = Object.freeze({
  character: { w: 600, h: 800, alpha: true }, background: { w: 1600, h: 900, alpha: false }, environment: { w: 1600, h: 900, alpha: false },
  cover: { w: 600, h: 315, alpha: false }, effect: { w: 128, h: 128, alpha: true }, icon: { w: 64, h: 64, alpha: true },
});
export const OFFICIAL_IDS = Object.freeze(['wody_miami_neon', 'wody_synthwave', 'wody_aurora', 'wody_cosmos', 'wody_sakura', 'wody_ocean', 'wody_stadium', 'wody_taxi', 'wody_ring', 'wody_racing', 'wody_arcade', 'wody_court', 'wody_lofi', 'wody_festival', 'wody_cyberpunk']);
// Earlier official themes: they are retired on the next start and their servers move to the closest new theme.
export const LEGACY_THEMES = Object.freeze({ wody_fire_dragon: 'wody_miami_neon', wody_storm_dragon: 'wody_synthwave', wody_ice_dragon: 'wody_aurora', wody_shadow_dragon: 'wody_cosmos', wody_nature_dragon: 'wody_sakura' });
export const DEFAULT_THEME_ID = null; // null means the standard Wody look: it is the fallback and is never stored

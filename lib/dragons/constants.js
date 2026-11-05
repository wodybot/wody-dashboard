// Vocabularies of the Dragons module. They match cogs/dragons.py in the bot.
export const COLLECTION = 'dragon_configs';
export const TYPES = ['fire', 'ice', 'storm', 'shadow', 'nature'];
export const SIZES = ['small', 'medium', 'large', 'huge'];
export const PERSONALITIES = ['aggressive', 'calm', 'protective', 'playful', 'wise'];
export const RARITIES = ['common', 'rare', 'epic', 'legendary', 'mythic'];
export const ANIMATIONS = ['appear', 'fly', 'fire_attack', 'roar', 'land', 'rest'];
export const EFFECTS = ['fire', 'smoke', 'sparks', 'dust', 'light'];
export const SOUNDS = ['roar', 'wings', 'breath'];
export const BEHAVIORS = ['follow_cursor', 'look_around', 'react_to_clicks', 'auto_breath'];
export const MAX_DRAGONS = 5;
export const NAME_MAX = 32;
export const LEVEL_MAX = 100;
export const BREATH_SECONDS = [5, 60];
// Default scale and fire colors of each type (also the colors the artwork is drawn in).
export const TYPE_COLORS = {
  fire: { scale: '#8b1e1e', fire: '#ff6a00' },
  ice: { scale: '#3b7fb8', fire: '#8fe3ff' },
  storm: { scale: '#3a4fc0', fire: '#b9c8ff' },
  shadow: { scale: '#4d2a86', fire: '#b06cff' },
  nature: { scale: '#2a9a55', fire: '#c8f07a' },
};

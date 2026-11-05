// Validation and derived numbers of a dragon. Pure functions: the same code runs in the API (to accept or refuse a save) and in the
// browser (to show the numbers while editing). Only fixed choices, short plain names and bounded numbers are accepted.
import { TYPES, SIZES, PERSONALITIES, RARITIES, ANIMATIONS, EFFECTS, SOUNDS, BEHAVIORS, MAX_DRAGONS, NAME_MAX, LEVEL_MAX, BREATH_SECONDS, TYPE_COLORS } from './constants.js';

const HEX = /^#[0-9a-fA-F]{6}$/;
const ID = /^[a-z][a-z0-9_]{0,23}$/;
const RARITY_MULT = { common: 1, rare: 1.25, epic: 1.55, legendary: 2, mythic: 2.6 };
const SIZE_MULT = { small: 0.8, medium: 1, large: 1.2, huge: 1.45 };

/** Attack, defense and life follow from level, rarity, size and personality. The bot uses the same formula. */
export function dragonStats({ level, rarity, size, personality }) {
  const m = (RARITY_MULT[rarity] || 1) * (SIZE_MULT[size] || 1);
  return {
    attack: Math.round(1000 * (1 + level * 0.09) * m * (personality === 'aggressive' ? 1.15 : personality === 'playful' ? 0.9 : 1)),
    defense: Math.round(900 * (1 + level * 0.085) * m * (personality === 'protective' ? 1.15 : 1)),
    life: Math.round(3000 * (1 + level * 0.11) * m * (personality === 'wise' || personality === 'calm' ? 1.1 : 1)),
  };
}

const flags = (keys, on = true) => Object.fromEntries(keys.map((k) => [k, on]));

export function defaultDragon(type = 'fire', id = 'dragon') {
  const c = TYPE_COLORS[type] || TYPE_COLORS.fire;
  return {
    id, name: '', type, scale_color: c.scale, fire_color: c.fire, size: 'large', personality: 'protective', rarity: 'rare', level: 1, enabled: true,
    animations: flags(ANIMATIONS), effects: flags(EFFECTS), sounds: { enabled: false, volume: 60, ...flags(SOUNDS) },
    behavior: { ...flags(BEHAVIORS), breath_seconds: 12 },
  };
}

const oneOf = (v, list) => (list.includes(v) ? v : null);
const bool = (v, d) => (typeof v === 'boolean' ? v : d);
const int = (v, lo, hi) => { const n = Number(v); return Number.isFinite(n) && n >= lo && n <= hi ? Math.round(n) : null; };
const group = (src, keys, base) => Object.fromEntries(keys.map((k) => [k, bool(src?.[k], base[k])]));
// Names are plain text: no markup, no control characters, no link-like text.
const cleanName = (s) => String(s ?? '').normalize('NFC').replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim();

export function normalizeDragon(input, base) {
  const d = input && typeof input === 'object' ? input : {};
  const prev = base || defaultDragon();
  const fail = (error, field) => ({ ok: false, error, field });
  const id = d.id ?? prev.id; if (!ID.test(String(id))) return fail('invalid_id', 'id');
  const name = cleanName(d.name ?? prev.name); if (name.length > NAME_MAX) return fail('name_too_long', 'name');
  if (/https?:|www\.|discord\.gg/i.test(name)) return fail('name_invalid', 'name');
  const type = oneOf(d.type ?? prev.type, TYPES); if (!type) return fail('invalid_choice', 'type');
  const size = oneOf(d.size ?? prev.size, SIZES); if (!size) return fail('invalid_choice', 'size');
  const personality = oneOf(d.personality ?? prev.personality, PERSONALITIES); if (!personality) return fail('invalid_choice', 'personality');
  const rarity = oneOf(d.rarity ?? prev.rarity, RARITIES); if (!rarity) return fail('invalid_choice', 'rarity');
  const scale = d.scale_color ?? prev.scale_color; if (!HEX.test(scale)) return fail('invalid_color', 'scale_color');
  const fire = d.fire_color ?? prev.fire_color; if (!HEX.test(fire)) return fail('invalid_color', 'fire_color');
  const level = int(d.level ?? prev.level, 1, LEVEL_MAX); if (level === null) return fail('invalid_number', 'level');
  const vol = int(d.sounds?.volume ?? prev.sounds.volume, 0, 100); if (vol === null) return fail('invalid_number', 'sounds.volume');
  const breath = int(d.behavior?.breath_seconds ?? prev.behavior.breath_seconds, BREATH_SECONDS[0], BREATH_SECONDS[1]); if (breath === null) return fail('invalid_number', 'behavior.breath_seconds');
  return {
    ok: true,
    dragon: {
      id: String(id), name, type, scale_color: scale.toLowerCase(), fire_color: fire.toLowerCase(), size, personality, rarity, level, enabled: bool(d.enabled, prev.enabled),
      animations: group(d.animations, ANIMATIONS, prev.animations), effects: group(d.effects, EFFECTS, prev.effects),
      sounds: { enabled: bool(d.sounds?.enabled, prev.sounds.enabled), volume: vol, ...group(d.sounds, SOUNDS, prev.sounds) },
      behavior: { ...group(d.behavior, BEHAVIORS, prev.behavior), breath_seconds: breath },
    },
  };
}

export function normalizeDragons(list, current = []) {
  if (!Array.isArray(list)) return { ok: false, error: 'invalid_body', field: 'dragons' };
  if (list.length > MAX_DRAGONS) return { ok: false, error: 'too_many', field: 'dragons' };
  const seen = new Set(); const out = [];
  for (const item of list) {
    const base = current.find((c) => c.id === item?.id);
    const n = normalizeDragon(item, base || defaultDragon(item?.type && TYPES.includes(item.type) ? item.type : 'fire', item?.id));
    if (!n.ok) return n;
    if (seen.has(n.dragon.id)) return { ok: false, error: 'duplicate_id', field: 'id' };
    seen.add(n.dragon.id); out.push(n.dragon);
  }
  return { ok: true, dragons: out };
}

import { EMOJI_GROUPS } from '@/lib/emoji-data';

export const NICK_EMOJI_MAX = 6;
export const NICK_ROLE_MAX = 5;
export const NICK_POSITIONS = ['before', 'after', 'random'];
export { EMOJI_GROUPS };

export const SKIN_TONES = ['', '\u{1F3FB}', '\u{1F3FC}', '\u{1F3FD}', '\u{1F3FE}', '\u{1F3FF}'];
const TONE_SWATCH = ['\u{1F44B}', '\u{1F44B}\u{1F3FB}', '\u{1F44B}\u{1F3FC}', '\u{1F44B}\u{1F3FD}', '\u{1F44B}\u{1F3FE}', '\u{1F44B}\u{1F3FF}'];
export const toneSwatch = (i) => TONE_SWATCH[i] || TONE_SWATCH[0];

export function withTone(emoji, tone) {
  if (!tone) return emoji;
  const chars = Array.from(emoji);
  const bases = chars.filter((c) => /\p{Emoji_Modifier_Base}/u.test(c)).length;
  if (bases !== 1) return emoji;
  const i = chars.findIndex((c) => /\p{Emoji_Modifier_Base}/u.test(c));
  const drop = chars[i + 1] === '\uFE0F' ? 1 : 0;
  chars.splice(i + 1, drop, tone);
  return chars.join('');
}

export function searchEmojis(query, limit = 240) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return [];
  const out = [];
  for (const g of EMOJI_GROUPS) {
    for (const item of g.emojis) {
      if (item[1].includes(q)) { out.push(item); if (out.length >= limit) return out; }
    }
  }
  return out;
}

export const EMOJI_RE = /^(?:\p{Regional_Indicator}{2}|[0-9#*]\uFE0F?\u20E3|\p{Extended_Pictographic}(?:\uFE0F|\p{Emoji_Modifier})?[\u{E0020}-\u{E007F}]*(?:\u200D\p{Extended_Pictographic}(?:\uFE0F|\p{Emoji_Modifier})?)*\uFE0F?)$/u;
export function extractEmojis(text) {
  const out = [];
  const seg = typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null;
  const parts = seg ? Array.from(seg.segment(String(text || '')), (s) => s.segment) : Array.from(String(text || ''));
  for (const p of parts) if (EMOJI_RE.test(p) && !out.includes(p)) out.push(p);
  return out;
}

export function previewNickname(base, emojis, position) {
  const list = (emojis || []).filter(Boolean);
  if (!list.length) return base;
  const block = list.join('');
  return position === 'after' ? `${base} ${block}` : `${block} ${base}`;
}

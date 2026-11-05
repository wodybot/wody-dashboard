// Maps a render theme (lib/themes/render.js) onto the community listing theme (components/community/theme.js)
// so that every existing profile section follows the server theme without being rewritten.
const CARD = { solid: 'solid', outline: 'outline', glass: 'glass', glow: 'glow', flat: 'solid' };
const BTN = { pill: 'pill', square: 'square' };

export function listingThemeFrom(t) {
  if (!t) return null;
  return {
    preset: 'custom', primary: t.palette.primary, accent: t.palette.accent, secondary: t.palette.card, background: t.palette.bg,
    card_style: CARD[t.components.card_style] || 'solid', button_style: BTN[t.components.button_style] || 'rounded',
  };
}

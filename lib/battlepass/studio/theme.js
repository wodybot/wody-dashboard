import { LAYOUT_WIDTH } from './constants.js';

/** The theme a studio page uses: the season's own page theme, then the studio theme, then the layout choices (width, spacing). */
export function studioTheme(seasonPage, config) {
  const t = { ...(seasonPage && typeof seasonPage === 'object' ? seasonPage : {}), ...(config?.theme || {}) };
  t.max_width = LAYOUT_WIDTH[config?.layout?.width] || LAYOUT_WIDTH.normal;
  t.density = config?.layout?.spacing || 'cozy';
  return t;
}

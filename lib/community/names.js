// Display names for catalog rows (categories, tags, features, badges, subcategories).
// Admin supplied translations win; seeded rows fall back to messages/<locale>.json.
export function catalogName(t, kind, row, locale) {
  if (!row) return '';
  const slug = typeof row === 'string' ? row : row.slug || row.key;
  const names = typeof row === 'string' ? null : row.names;
  if (names?.[locale]) return names[locale];
  const key = `catalog.${kind}.${String(slug).replace(/\./g, '_')}`;
  try { if (t.has(key)) return t(key); } catch { /* fall through */ }
  return names?.en || String(slug).split('.').pop().replace(/_/g, ' ');
}

export function formatCount(n, locale) {
  if (n == null) return null;
  try { return new Intl.NumberFormat(locale, { notation: n >= 10000 ? 'compact' : 'standard', maximumFractionDigits: 1 }).format(n); } catch { return String(n); }
}

export const CARD_FONTS = [
  { id: 'bebas', label: 'Bebas Neue', family: "'WodyCard Bebas Neue'", bold: false },
  { id: 'pacifico', label: 'Pacifico', family: "'WodyCard Pacifico'", bold: false },
  { id: 'lobster', label: 'Lobster', family: "'WodyCard Lobster'", bold: false },
  { id: 'bangers', label: 'Bangers', family: "'WodyCard Bangers'", bold: false },
  { id: 'abril', label: 'Abril Fatface', family: "'WodyCard Abril Fatface'", bold: false },
  { id: 'cinzel', label: 'Cinzel', family: "'WodyCard Cinzel'", bold: true },
  { id: 'exo2', label: 'Exo 2', family: "'WodyCard Exo 2'", bold: true },
  { id: 'oswald', label: 'Oswald', family: "'WodyCard Oswald'", bold: true },
  { id: 'playfair', label: 'Playfair Display', family: "'WodyCard Playfair Display'", bold: true },
  { id: 'caveat', label: 'Caveat', family: "'WodyCard Caveat'", bold: true },
  { id: 'anton', label: 'Anton', family: "'WodyCard Anton'", bold: false },
  { id: 'archivo', label: 'Archivo Black', family: "'WodyCard Archivo Black'", bold: false },
  { id: 'blackops', label: 'Black Ops One', family: "'WodyCard Black Ops One'", bold: false },
  { id: 'bungee', label: 'Bungee', family: "'WodyCard Bungee'", bold: false },
  { id: 'chakra', label: 'Chakra Petch', family: "'WodyCard Chakra Petch'", bold: true },
  { id: 'dancing', label: 'Dancing Script', family: "'WodyCard Dancing Script'", bold: true },
  { id: 'greatvibes', label: 'Great Vibes', family: "'WodyCard Great Vibes'", bold: false },
  { id: 'kaushan', label: 'Kaushan Script', family: "'WodyCard Kaushan Script'", bold: false },
  { id: 'monoton', label: 'Monoton', family: "'WodyCard Monoton'", bold: false },
  { id: 'staatliches', label: 'Staatliches', family: "'WodyCard Staatliches'", bold: false },
];
export const CARD_FONT_IDS = ['default', ...CARD_FONTS.map((f) => f.id)];

export function cardFontFamily(id) {
  const f = CARD_FONTS.find((x) => x.id === id);
  return f ? `${f.family}, sans-serif` : undefined;
}

export function cardFontStyle(id) {
  const family = cardFontFamily(id);
  return family ? { fontFamily: family } : undefined;
}

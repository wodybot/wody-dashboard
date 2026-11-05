// Extra Wody icons (128x128, same flat gradient style as the rest of the set): suits, sun, smile, numbers, reply arrow.
// Run: node scripts/art/wody-icons-extra.mjs <output dir> [more output dirs]
import sharp from 'sharp';
import { mkdirSync, writeFileSync } from 'fs';

const grad = (id, a, b) => `<linearGradient id="${id}" x1="0.2" y1="0" x2="0.8" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`;
const shine = '<ellipse cx="50" cy="40" rx="30" ry="14" fill="#fff" opacity="0.18" transform="rotate(-24 50 40)"/>';
const ICONS = {
  suit_hearts: `<defs>${grad('g', '#ff7d92', '#e0364f')}</defs><path d="M64 112 C20 80 8 56 8 40 C8 22 22 12 38 12 C50 12 59 19 64 28 C69 19 78 12 90 12 C106 12 120 22 120 40 C120 56 108 80 64 112 Z" fill="url(#g)"/>${shine}`,
  suit_diamonds: `<defs>${grad('g', '#ffa766', '#e8562a')}</defs><path d="M64 8 C70 26 96 52 116 64 C96 76 70 102 64 120 C58 102 32 76 12 64 C32 52 58 26 64 8 Z" fill="url(#g)"/>${shine}`,
  suit_clubs: `<defs>${grad('g', '#86adff', '#3b6fe0')}</defs><circle cx="64" cy="36" r="26" fill="url(#g)"/><circle cx="36" cy="72" r="26" fill="url(#g)"/><circle cx="92" cy="72" r="26" fill="url(#g)"/><path d="M58 70 L70 70 L78 118 L50 118 Z" fill="url(#g)"/>${shine}`,
  sun: `<defs>${grad('g', '#ffe27a', '#ff9d2e')}</defs><g stroke="#ffb53d" stroke-width="9" stroke-linecap="round">${Array.from({ length: 8 }, (_, i) => { const a = (i * Math.PI) / 4; return `<line x1="${64 + Math.cos(a) * 44}" y1="${64 + Math.sin(a) * 44}" x2="${64 + Math.cos(a) * 58}" y2="${64 + Math.sin(a) * 58}"/>`; }).join('')}</g><circle cx="64" cy="64" r="32" fill="url(#g)"/><ellipse cx="54" cy="52" rx="14" ry="8" fill="#fff" opacity="0.3" transform="rotate(-30 54 52)"/>`,
  smile: `<defs>${grad('g', '#ffe27a', '#ffa62b')}</defs><circle cx="64" cy="64" r="54" fill="url(#g)"/><ellipse cx="44" cy="54" rx="7" ry="10" fill="#6b3a12"/><ellipse cx="84" cy="54" rx="7" ry="10" fill="#6b3a12"/><path d="M36 76 C44 98 84 98 92 76 C80 82 48 82 36 76 Z" fill="#6b3a12"/><ellipse cx="46" cy="30" rx="26" ry="10" fill="#fff" opacity="0.22" transform="rotate(-24 46 30)"/>`,
  numbers: `<defs>${grad('g', '#7fb2ff', '#3a6fe8')}</defs><rect x="10" y="22" width="108" height="84" rx="22" fill="url(#g)"/><text x="64" y="84" text-anchor="middle" font-family="DejaVu Sans, Arial, sans-serif" font-weight="700" font-size="48" fill="#fff">123</text>`,
  reply_arrow: `<defs>${grad('g', '#9ad0ff', '#3b82f0')}</defs><path d="M24 96 L24 56 C24 40 36 30 52 30 L84 30 L84 12 L120 44 L84 76 L84 58 L56 58 C50 58 48 60 48 66 L48 96 Z" fill="url(#g)" stroke="url(#g)" stroke-width="6" stroke-linejoin="round"/>`,
};
const dirs = process.argv.slice(2);
if (!dirs.length) { console.error('usage: node scripts/art/wody-icons-extra.mjs <output dir>...'); process.exit(1); }
for (const d of dirs) mkdirSync(d, { recursive: true });
for (const [name, body] of Object.entries(ICONS)) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">${body}</svg>`;
  const png = await sharp(Buffer.from(svg)).resize(128, 128).png({ compressionLevel: 9 }).toBuffer();
  for (const d of dirs) writeFileSync(`${d}/${name}.png`, png);
}
console.log('icons', Object.keys(ICONS).join(','));

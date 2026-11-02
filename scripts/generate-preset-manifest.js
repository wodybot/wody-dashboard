// FILE: generate-preset-manifest.js
// PUNE ÎN: scripts/generate-preset-manifest.js  (fișier nou)
//
// Scanează folderele de imagini presetate din public/presets/* și scrie
// public/presets/manifest.json, un fișier mic, citit de dashboard doar
// atunci când utilizatorul deschide galeria de alegere a imaginii (nu la
// încărcarea paginii), ca să nu incarce nimic in plus la intrarea in modul.
//
// Numele fisierelor NU conteaza si NU trebuie sa fie numerotate, pui orice
// fisier .webp/.png/.jpg/.jpeg/.gif in folderul potrivit si urmatoarea
// rulare a acestui script il gaseste automat:
//   public/presets/welcome/              -> imaginea din mesajul de welcome
//   public/presets/goodbye/              -> imaginea din mesajul de goodbye
//   public/presets/welcome-background/   -> fundalul cardului de welcome
//   public/presets/level-card-background/-> fundalul cardului de level up
//
// Ruleaza automat inaintea lui `npm run dev` si `npm run build` (vezi
// package.json: "predev" / "prebuild"). Poate fi rulat si manual:
//   node scripts/generate-preset-manifest.js
//
// Marime recomandata pentru imagini: 1200x630 px (raport ~1.9:1, acelasi
// raport folosit deja de cardul de welcome din dashboard), format WebP,
// sub ~300 KB fiecare, ca sa se incarce rapid si pe mobil.

const fs = require('fs');
const path = require('path');

const PRESETS_ROOT = path.join(__dirname, '..', 'public', 'presets');
const CATEGORIES = ['welcome', 'goodbye', 'welcome-background', 'level-card-background'];
const ALLOWED_EXT = new Set(['.webp', '.png', '.jpg', '.jpeg', '.gif']);
// Categories that keep a WebP (browser-optimized) + JPEG (bot decode-safe)
// pair per image, see the comment in build() below.
const DUAL_FORMAT_CATEGORIES = new Set(['welcome-background', 'level-card-background']);

function listImages(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((name) => ALLOWED_EXT.has(path.extname(name).toLowerCase()))
    .filter((name) => !name.startsWith('.'))
    .sort((a, b) => a.localeCompare(b, 'ro'));
}

// A short, stable id derived from the filename (not its position in the
// list), so re-ordering or adding/removing files never shifts ids that a
// server might have already saved. Purely cosmetic here (the dashboard
// stores the full resolved URL, not the id) but keeps things predictable if
// the manifest is ever consumed elsewhere.
function slugify(filename) {
  return path.basename(filename, path.extname(filename))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'preset';
}

function build() {
  const manifest = {};
  for (const category of CATEGORIES) {
    const dir = path.join(PRESETS_ROOT, category);
    const files = listImages(dir);
    // Prefer one gallery entry per image stem. For card backgrounds we keep
    // WebP as the browser-optimized URL, but optionally expose a JPEG sibling
    // as bot_url. The bot can use that decoder-safe copy when Pillow/libwebp
    // rejects a production WebP response, while the dashboard still previews
    // the original WebP.
    const dualFormat = DUAL_FORMAT_CATEGORIES.has(category);
    const visibleFiles = files.filter((file) => {
      const ext = path.extname(file).toLowerCase();
      if (!dualFormat || !['.jpg', '.jpeg'].includes(ext)) return true;
      const stem = path.basename(file, ext);
      return !files.some((other) => path.basename(other, path.extname(other)) === stem && path.extname(other).toLowerCase() === '.webp');
    });
    manifest[category] = visibleFiles.map((file) => {
      const encoded = encodeURIComponent(file);
      const item = {
        id: slugify(file),
        file,
        url: `/presets/${category}/${encoded}`,
      };
      if (dualFormat && path.extname(file).toLowerCase() === '.webp') {
        const jpg = `${path.basename(file, path.extname(file))}.jpg`;
        if (files.includes(jpg)) item.bot_url = `/presets/${category}/${encodeURIComponent(jpg)}`;
      }
      return item;
    });
  }
  const outPath = path.join(PRESETS_ROOT, 'manifest.json');
  fs.mkdirSync(PRESETS_ROOT, { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(manifest, null, 2));
  const counts = CATEGORIES.map((c) => `${c}: ${manifest[c].length}`).join(', ');
  console.log(`[presets] manifest.json actualizat (${counts})`);
}

build();

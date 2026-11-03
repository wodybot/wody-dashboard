
const fs = require('fs');
const path = require('path');

const PRESETS_ROOT = path.join(__dirname, '..', 'public', 'presets');
const CATEGORIES = ['welcome', 'goodbye', 'welcome-background', 'level-card-background'];
const ALLOWED_EXT = new Set(['.webp', '.png', '.jpg', '.jpeg', '.gif']);
const DUAL_FORMAT_CATEGORIES = new Set(['welcome-background', 'level-card-background']);

function listImages(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((name) => ALLOWED_EXT.has(path.extname(name).toLowerCase()))
    .filter((name) => !name.startsWith('.'))
    .sort((a, b) => a.localeCompare(b, 'ro'));
}

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

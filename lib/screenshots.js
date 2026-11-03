import fs from 'fs';
import path from 'path';

const SCREENSHOTS_DIR = path.join(process.cwd(), 'public', 'screenshots');
const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.avif', '.svg'];
const SLOT_COUNT = 4;

export function getScreenshotImages() {
  let files = [];
  try {
    files = fs.readdirSync(SCREENSHOTS_DIR);
  } catch {
    return [];
  }

  const bySlot = new Map();
  for (const file of files) {
    const ext = path.extname(file).toLowerCase();
    if (!IMAGE_EXTENSIONS.includes(ext)) continue;
    const base = path.basename(file, ext);
    const match = base.match(/^shot-(\d+)/i);
    if (!match) continue;
    const slot = Number(match[1]);
    const existing = bySlot.get(slot);
    if (!existing || (existing.endsWith('.svg') && ext !== '.svg')) {
      bySlot.set(slot, `/screenshots/${file}`);
    }
  }

  return Array.from({ length: SLOT_COUNT }, (_, i) => bySlot.get(i + 1))
    .filter(Boolean);
}

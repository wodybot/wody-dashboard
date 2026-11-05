// Nothing on the site or in what it sends is a standard emoji: every icon is a Wody custom icon.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const E = await import('../../lib/emoji-icons.js');

// Files that must keep real Unicode emoji: the mapping itself, the nickname picker (Discord nicknames only accept Unicode),
// and tests that check emoji are refused.
const ALLOWED = new Set(['lib/emoji-icons.js', 'lib/emoji-data.js', 'lib/nick-emojis.js', 'tests/emoji/emoji.test.mjs']);
const PLAIN_SYMBOLS = new Set(['\u00a9', '\u00ae', '\u2122', '\u25cf', '\u25b2', '\u25bc']); // text symbols without an icon
const SKIP = new Set(['node_modules', '.next', '.git', 'public', 'tests']);

function* files(dir) {
  for (const n of readdirSync(dir)) {
    if (SKIP.has(n)) continue;
    const p = join(dir, n);
    if (statSync(p).isDirectory()) yield* files(p);
    else if (/\.(js|jsx|mjs|json|css)$/.test(n) && n !== 'package-lock.json') yield p;
  }
}

test('no standard emoji is written anywhere in the dashboard sources or messages', () => {
  const re = new RegExp(E.EMOJI_SRC, 'gu');
  const bad = [];
  for (const p of files(root)) {
    const rel = relative(root, p).split('\\').join('/');
    if (ALLOWED.has(rel)) continue;
    const s = readFileSync(p, 'utf8');
    for (const m of s.matchAll(re)) if (!PLAIN_SYMBOLS.has(m[0])) bad.push(`${rel}: ${m[0]}`);
  }
  assert.deepEqual(bad.slice(0, 10), []);
});

test('no standard emoji is written as an escape sequence either', () => {
  const esc = /\\u\{1F[0-9A-Fa-f]{3}\}|\\u(?:2705|274[cC]|26[0-9a-fA-F]{2}|2B50|2139)/;
  const bad = [];
  for (const p of files(root)) {
    const rel = relative(root, p).split('\\').join('/');
    if (ALLOWED.has(rel) || rel === 'app/api/[[...path]]/route.js') continue; // route.js only holds the character ranges of its filters
    if (esc.test(readFileSync(p, 'utf8'))) bad.push(rel);
  }
  assert.deepEqual(bad, []);
});

test('splitIcons and toTokens turn emoji and tokens into Wody icons only', () => {
  const parts = E.splitIcons('A \u2705 B {wy:star} C [wy:ban]');
  assert.deepEqual(parts.map((p) => p.icon ?? p.text), ['A ', 'success', ' B ', 'star', ' C ', 'ban']);
  assert.equal(E.toTokens('Hi \u2705'), 'Hi {wy:success}');
  assert.equal(E.toTokens('\u00a9 2026'), '\u00a9 2026');
  assert.equal(E.splitIcons('plain').length, 1);
});

test('every icon the mapping points to exists as a file', () => {
  const missing = new Set(Object.values(E.ICON_OF).filter((f) => !existsSync(join(root, 'public/emojis/wody', `${f}.png`))));
  assert.deepEqual([...missing], []);
});

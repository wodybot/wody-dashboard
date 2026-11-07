import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { SERVER_ONLY_NAMESPACES, clientMessages } from '../../lib/i18n-server-only.js';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');

function sourceFiles(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) sourceFiles(p, out);
    else if (/\.(js|jsx|mjs)$/.test(entry.name)) out.push(p);
  }
  return out;
}

test('no client hook reads a namespace that the dashboard keeps on the server', () => {
  const used = new Set();
  for (const dir of ['app', 'components', 'lib']) {
    for (const file of sourceFiles(path.join(ROOT, dir))) {
      const src = fs.readFileSync(file, 'utf8');
      for (const m of src.matchAll(/useTranslations\(\s*['"]([A-Za-z0-9_]+)/g)) used.add(m[1]);
      for (const m of src.matchAll(/\bns="([A-Za-z0-9_]+)/g)) used.add(m[1]);
    }
  }
  const clash = SERVER_ONLY_NAMESPACES.filter((ns) => used.has(ns));
  assert.deepEqual(clash, []);
});

test('every server only namespace exists and is removed from the client messages', () => {
  const en = JSON.parse(fs.readFileSync(path.join(ROOT, 'messages/en.json'), 'utf8'));
  for (const ns of SERVER_ONLY_NAMESPACES) assert.ok(ns in en, ns);
  const client = clientMessages(en);
  for (const ns of SERVER_ONLY_NAMESPACES) assert.equal(client[ns], undefined);
  assert.ok(client.guildSettings && client.modules && client.nav);
  assert.ok(JSON.stringify(client).length < JSON.stringify(en).length * 0.8);
});

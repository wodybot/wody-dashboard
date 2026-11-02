// Checks lib/feeds-core.js against the cases the bot's Python code produced (scripts/export_feed_sources.py).
// Run:  node scripts/feeds-parity.mjs
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = resolve(new URL('..', import.meta.url).pathname);
const dir = mkdtempSync(join(tmpdir(), 'feeds-parity-'));
const registry = readFileSync(join(root, 'lib/feeds-sources.json'), 'utf8');
writeFileSync(join(dir, 'feeds-sources.json'), registry);
let code = readFileSync(join(root, 'lib/feeds-core.js'), 'utf8').replace("import registry from '@/lib/feeds-sources.json';", "import { readFileSync } from 'node:fs';\nconst registry = JSON.parse(readFileSync(new URL('./feeds-sources.json', import.meta.url), 'utf8'));");
writeFileSync(join(dir, 'feeds-core.mjs'), code);
const { cleanTarget, FeedInputError } = await import(pathToFileURL(join(dir, 'feeds-core.mjs')).href);
const cases = JSON.parse(readFileSync(join(root, 'scripts/feeds-parity-cases.json'), 'utf8'));
let bad = 0;
for (const c of cases) {
  let got;
  try { const [target, options] = cleanTarget(c.source, c.target, c.options); got = { ok: true, target, options }; } catch (e) {
    if (!(e instanceof FeedInputError)) throw e;
    got = { ok: false, code: e.code };
  }
  if (JSON.stringify(got) !== JSON.stringify(c.expect)) { bad += 1; console.log('MISMATCH', c.source, JSON.stringify(c.target), JSON.stringify(c.options), '\n  python', JSON.stringify(c.expect), '\n  js    ', JSON.stringify(got)); }
}
console.log(`${cases.length - bad}/${cases.length} cases agree`);
process.exit(bad ? 1 : 0);

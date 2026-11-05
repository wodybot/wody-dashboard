// Node resolve hook: maps the "@/" alias used by the dashboard and stubs modules that need a live Discord / Mongo.
import { pathToFileURL, fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const STUBS = { '@/lib/discord': join(root, 'tests/link/stubs/discord.js'), '@/lib/mongo': join(root, 'tests/link/stubs/mongo.js') };

export async function resolve(specifier, context, next) {
  if (specifier.startsWith('@/')) {
    if (STUBS[specifier]) return { url: pathToFileURL(STUBS[specifier]).href, shortCircuit: true };
    const base = join(root, specifier.slice(2));
    for (const cand of [base, `${base}.js`, `${base}.mjs`, join(base, 'index.js')]) {
      if (existsSync(cand) && !cand.endsWith('/')) {
        try { if (!(await import('node:fs')).statSync(cand).isDirectory()) return { url: pathToFileURL(cand).href, shortCircuit: true }; } catch { /* next */ }
      }
    }
  }
  if ((specifier.startsWith('./') || specifier.startsWith('../')) && !/\.[a-z]+$/.test(specifier) && context.parentURL) {
    const cand = join(dirname(fileURLToPath(context.parentURL)), `${specifier}.js`);
    if (existsSync(cand)) return { url: pathToFileURL(cand).href, shortCircuit: true };
  }
  return next(specifier, context);
}

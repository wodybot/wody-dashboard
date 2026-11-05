// Resolve hook for the Battle Pass API tests: the "@/" alias, plus stand-ins for everything that needs a browser session,
// Discord or a database server. The real lib/battlepass code runs unchanged on top of them.
import { pathToFileURL, fileURLToPath } from 'node:url';
import { existsSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const STUBS = Object.fromEntries(['discord', 'mongo', 'session', 'owner-access', 'account-moderation'].map((n) => [`@/lib/${n}`, join(root, 'tests', 'battlepass', 'stubs', `${n}.mjs`)]));

export async function resolve(specifier, context, next) {
  if (specifier === 'next/server') return { url: pathToFileURL(join(root, 'node_modules', 'next', 'server.js')).href, shortCircuit: true };
  if (specifier.startsWith('@/')) {
    if (STUBS[specifier]) return { url: pathToFileURL(STUBS[specifier]).href, shortCircuit: true };
    const base = join(root, specifier.slice(2));
    for (const cand of [base, `${base}.js`, `${base}.mjs`, join(base, 'index.js')]) {
      if (existsSync(cand) && !statSync(cand).isDirectory()) return { url: pathToFileURL(cand).href, shortCircuit: true };
    }
  }
  if ((specifier.startsWith('./') || specifier.startsWith('../')) && !/\.[a-z]+$/.test(specifier) && context.parentURL) {
    const cand = join(dirname(fileURLToPath(context.parentURL)), `${specifier}.js`);
    if (existsSync(cand)) return { url: pathToFileURL(cand).href, shortCircuit: true };
  }
  return next(specifier, context);
}

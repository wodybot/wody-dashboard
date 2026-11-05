// Same stand-ins as the Battle Pass tests, plus a loader for .jsx files (the frame renderer is JSX) and the "next/og" entry.
import { pathToFileURL, fileURLToPath } from 'node:url';
import { existsSync, statSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { createRequire } from 'node:module';
import * as bp from '../battlepass/hooks.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const require = createRequire(import.meta.url);
const { transform } = require('sucrase');

export async function resolve(specifier, context, next) {
  if (specifier === 'next/og') return { url: pathToFileURL(join(root, 'node_modules/next/dist/compiled/@vercel/og/index.node.js')).href, shortCircuit: true };
  if (specifier.startsWith('@/')) {
    const base = join(root, specifier.slice(2));
    if (existsSync(`${base}.jsx`)) return { url: pathToFileURL(`${base}.jsx`).href, shortCircuit: true };
  }
  if ((specifier.startsWith('./') || specifier.startsWith('../')) && !/\.[a-z]+$/.test(specifier) && context.parentURL) {
    const cand = join(dirname(fileURLToPath(context.parentURL)), `${specifier}.jsx`);
    if (existsSync(cand)) return { url: pathToFileURL(cand).href, shortCircuit: true };
  }
  return bp.resolve(specifier, context, next);
}

export async function load(url, context, next) {
  if (url.endsWith('.jsx')) {
    const src = readFileSync(fileURLToPath(url), 'utf8');
    const out = transform(src, { transforms: ['jsx'], jsxRuntime: 'automatic', production: true }).code;
    return { format: 'module', source: out, shortCircuit: true };
  }
  return next(url, context);
}

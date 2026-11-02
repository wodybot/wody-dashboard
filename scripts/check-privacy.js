#!/usr/bin/env node
// Build-time privacy guard. Run automatically before `next build`
// (see "prebuild" in package.json) and manually with `npm run check:privacy`.
//
// Cookie Policy guarantee: the visitor's browser must only ever talk to
// wody.online. Third-party hosts (imgur, Google, Cloudflare/Discord CDN, ...)
// set their own cookies on ANY direct request, so no page may make one.
// next.config.js enforces this at runtime with a Content-Security-Policy; this
// script catches mistakes earlier, in the source, and FAILS THE BUILD when:
//   1. a tag that loads a resource (img, script, link, iframe, video, audio,
//      source, embed, object) has a literal http(s):// URL;
//   2. an <img src={...}> uses an expression that is not one of the approved
//      same-origin helpers (proxiedImageUrl, avatarSrc, discordCdnUrl,
//      publicImageUrl, *_src fields, /api/... paths, ...);
//   3. next/script / <Script> is used, or a CSS url()/@import points at http(s);
//   4. client code calls fetch()/XMLHttpRequest/sendBeacon/WebSocket/EventSource
//      with a literal http(s):// URL.
// If an <img> is legitimately safe but not recognised, add its expression to
// APPROVED_IMG_EXPRESSIONS below after reviewing it.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SCAN_DIRS = ['app', 'components', 'lib'];
const EXTS = new Set(['.js', '.jsx', '.ts', '.tsx', '.css']);
// Server-only renderers: they run on our server, the visitor's browser never
// requests these URLs.
const SERVER_ONLY_FILES = new Set(['app/opengraph-image.js', 'app/icon.js']);

const APPROVED_IMG_EXPRESSIONS = [
  /proxiedImageUrl\(/, /avatarSrc\(/, /discordCdnUrl\(/, /publicImageUrl\(/,
  /_src\b/, /^\{`\/api\//, /^"\/(?!\/)/, /^\{["']\/(?!\/)/,
  // Identifiers reviewed one by one; each is built from the helpers above
  // (image.src: partnerImage() in components/partners/PartnerCard.jsx):
  /^\{(icon|src|previewSrc|localUrl|gicon|avatar|avatarUrl|avatarSrc|candidates\[index\]|guildIcon\(\w+\)|savedPath\(item\)|WODY_LOGO_URL|image\.src)\}$/,
];

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (EXTS.has(path.extname(e.name))) out.push(p);
  }
  return out;
}

// Removes comments (keeps line count) so comments mentioning <img> or URLs do not trigger rules.
function stripComments(src) {
  const blank = (m) => m.replace(/[^\n]/g, ' ');
  return src.replace(/\/\*[\s\S]*?\*\//g, blank).replace(/(^|[^:\w"'`\\])\/\/[^\n]*/g, (m, a) => a + ' '.repeat(m.length - a.length));
}

const lineOf = (text, idx) => text.slice(0, idx).split('\n').length;
const problems = [];
const add = (file, line, msg) => problems.push(`${file}:${line}  ${msg}`);

const RESOURCE_TAGS = 'img|script|iframe|video|audio|source|embed|object|track|input';
const EXTERNAL_ATTR = new RegExp(`<(${RESOURCE_TAGS})\\b[^>]*?\\b(src|srcSet|data|poster)\\s*=\\s*(?:"|\\{\\s*["'\`])https?:`, 'g');
const EXTERNAL_LINK = /<link\b[^>]*?\bhref\s*=\s*(?:"|\{\s*["'`])https?:/g;

for (const dir of SCAN_DIRS) {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) continue;
  for (const file of walk(abs)) {
    const rel = path.relative(ROOT, file).split(path.sep).join('/');
    if (rel.includes('/ui/') && !rel.endsWith('.css')) { /* shadcn primitives: still scanned for rules 1,3 */ }
    const raw = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
    const text = stripComments(raw);
    const isCss = file.endsWith('.css');
    const serverOnly = SERVER_ONLY_FILES.has(rel);

    if (isCss) {
      for (const m of text.matchAll(/(?:url\(\s*["']?|@import\s+(?:url\(\s*)?["'])(https?:)?\/\/[^)"'\s]+/g)) add(rel, lineOf(text, m.index), `CSS loads a third-party resource: ${m[0].trim()}`);
      continue;
    }
    if (serverOnly) continue;

    for (const m of text.matchAll(EXTERNAL_ATTR)) add(rel, lineOf(text, m.index), `<${m[1]}> with a literal external URL (${m[2]}). Use a same-origin path or a proxy helper.`);
    for (const m of text.matchAll(EXTERNAL_LINK)) add(rel, lineOf(text, m.index), '<link> to an external URL (stylesheet/preconnect/preload/icon).');
    if (/from\s+['"]next\/script['"]|<Script\b/.test(text)) add(rel, 1, 'next/script is not allowed: third-party scripts set third-party cookies.');
    if (/fonts\.(googleapis|gstatic)\.com|googletagmanager|google-analytics|doubleclick|adsbygoogle|cdn\.jsdelivr|unpkg\.com|cdnjs\.cloudflare/.test(text)) add(rel, 1, 'reference to a third-party asset/analytics host.');
    for (const m of text.matchAll(/(?:\bfetch\(|new\s+XMLHttpRequest|sendBeacon\(|new\s+WebSocket\(|new\s+EventSource\()\s*(?:["'`])https?:/g)) {
      if (/^\s*['"]use client['"]/.test(raw) || rel.startsWith('components/')) add(rel, lineOf(text, m.index), 'browser request to an external URL.');
    }

    for (const m of text.matchAll(/<img\b/g)) {
      const block = text.slice(m.index, m.index + 900);
      const sm = block.match(/\bsrc=(\{(?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*\}|"[^"]*")/);
      const line = lineOf(text, m.index);
      if (!sm) { add(rel, line, '<img> without a recognisable src (spread props?). Use <img src={...}> with an approved helper.'); continue; }
      const expr = sm[1].replace(/\s+/g, ' ');
      if (!APPROVED_IMG_EXPRESSIONS.some((re) => re.test(expr))) add(rel, line, `<img src=${expr.slice(0, 80)}> is not an approved same-origin source. Wrap it in proxiedImageUrl()/avatarSrc()/publicImageUrl().`);
    }
  }
}

if (problems.length) {
  console.error('\n\u274c Privacy check failed: third-party requests could reach visitors\' browsers.\n');
  for (const p of problems) console.error('  - ' + p);
  console.error('\nFix the lines above (see scripts/check-privacy.js for the rules).\n');
  process.exit(1);
}
console.log('\u2714 Privacy check passed: no third-party resource loading found.');

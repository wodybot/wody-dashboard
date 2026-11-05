
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SCAN_DIRS = ['app', 'components', 'lib'];
const EXTS = new Set(['.js', '.jsx', '.ts', '.tsx', '.css']);
const SERVER_ONLY_FILES = new Set(['app/opengraph-image.js', 'app/icon.js']);

const APPROVED_IMG_EXPRESSIONS = [
  /proxiedImageUrl\(/, /avatarSrc\(/, /discordCdnUrl\(/, /publicImageUrl\(/,
  /_src\b/, /^\{`\/api\//, /^"\/(?!\/)/, /^\{["']\/(?!\/)/,
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
    if (rel.includes('/ui/') && !rel.endsWith('.css')) { }
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
  console.error('\nPrivacy check failed: third-party requests could reach visitors\' browsers.\n');
  for (const p of problems) console.error('  - ' + p);
  console.error('\nFix the lines above (see scripts/check-privacy.js for the rules).\n');
  process.exit(1);
}
console.log('\u2714 Privacy check passed: no third-party resource loading found.');

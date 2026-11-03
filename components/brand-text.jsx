const GOLD = 'font-semibold text-[#e6cd8c]';
const WORD = '(?<![\\p{L}\\p{N}])';
const WORD_END = '(?![\\p{L}\\p{N}])';
const UNLIMITED = '(?:unlimited|nelimitat\\p{L}*|illimit\\p{L}*|unbegrenzt\\p{L}*|ilimitad\\p{L}*|onbeperkt\\p{L}*|sınırsız\\p{L}*)';
const isPremium = (s) => /premium/i.test(s);
const cache = new Map();

function matcher(premium) {
  let rx = cache.get(premium);
  if (!rx) {
    const parts = [`${WORD}Wody${WORD_END}`];
    if (premium) parts.push(`${WORD}Premium${WORD_END}`, `${WORD}${UNLIMITED}`, `${WORD}\\d+(?:[.,]\\d+)?${WORD_END}`);
    rx = new RegExp(parts.join('|'), 'giu');
    cache.set(premium, rx);
  }
  rx.lastIndex = 0;
  return rx;
}

function segments(text, premium) {
  const out = [];
  let last = 0;
  for (const m of text.matchAll(matcher(premium))) {
    if (m.index > last) out.push({ text: text.slice(last, m.index), gold: false });
    out.push({ text: m[0], gold: true });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last), gold: false });
  return out;
}

export function BrandText({ children }) {
  if (typeof children !== 'string') return children ?? null;
  return segments(children, isPremium(children)).map((s, i) => (s.gold ? <span key={i} className={GOLD}>{s.text}</span> : s.text));
}

const escHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const unHtml = (s) => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');

export function highlightBrandHtml(html) {
  if (typeof html !== 'string') return html;
  const premium = isPremium(html);
  return html.split(/(<[^>]*>)/g).map((chunk) => {
    if (chunk.startsWith('<') || !chunk) return chunk;
    return segments(unHtml(chunk), premium).map((s) => (s.gold ? `<span class="${GOLD}">${escHtml(s.text)}</span>` : escHtml(s.text))).join('');
  }).join('');
}

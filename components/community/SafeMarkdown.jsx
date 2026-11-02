// Renders owner written text without ever producing HTML: **bold**, *italic*, # headings,
// "- " lists, [text](https://...) links and plain emoji. Everything else is plain text.
import { Fragment } from 'react';
import { safeUrl } from '@/lib/community/validation';

function inline(text, key) {
  const out = [];
  const re = /\[([^\]]{1,120})\]\(([^)\s]{1,300})\)|\*\*(.+?)\*\*|\*(.+?)\*/g;
  let last = 0; let m; let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1] !== undefined) {
      const href = safeUrl(m[2]);
      out.push(href
        ? <a key={`${key}-${i++}`} href={href} target="_blank" rel="nofollow ugc noopener noreferrer" className="underline decoration-[color:var(--cm-accent)] underline-offset-2 hover:opacity-80">{m[1]}</a>
        : m[0]);
    } else if (m[3] !== undefined) out.push(<strong key={`${key}-${i++}`}>{m[3]}</strong>);
    else out.push(<em key={`${key}-${i++}`}>{m[4]}</em>);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function SafeMarkdown({ text, className = '' }) {
  const blocks = String(text || '').split(/\n{2,}/);
  return (
    <div className={`space-y-3 leading-relaxed ${className}`}>
      {blocks.map((block, bi) => {
        const lines = block.split('\n');
        if (lines.every((l) => /^\s*[-*]\s+/.test(l))) {
          return <ul key={bi} className="list-disc space-y-1 pl-5">{lines.map((l, li) => <li key={li}>{inline(l.replace(/^\s*[-*]\s+/, ''), `${bi}-${li}`)}</li>)}</ul>;
        }
        const h = block.match(/^(#{1,3})\s+(.+)$/);
        if (h && lines.length === 1) {
          const Tag = h[1].length === 1 ? 'h3' : 'h4';
          return <Tag key={bi} className="text-lg font-semibold">{inline(h[2], `${bi}`)}</Tag>;
        }
        return <p key={bi}>{lines.map((l, li) => <Fragment key={li}>{li ? <br /> : null}{inline(l, `${bi}-${li}`)}</Fragment>)}</p>;
      })}
    </div>
  );
}

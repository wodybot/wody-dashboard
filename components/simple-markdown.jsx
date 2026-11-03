
import { Fragment } from 'react';


function renderInline(text, keyPrefix) {
  const nodes = [];
  const re = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|`([^`]+)`|\*\*(.+?)\*\*|~~(.+?)~~|\*(.+?)\*/g;
  let last = 0;
  let match;
  let i = 0;
  while ((match = re.exec(text))) {
    if (match.index > last) nodes.push(text.slice(last, match.index));
    if (match[1] !== undefined) {
      nodes.push(
        <a
          key={`${keyPrefix}-${i++}`}
          href={match[2]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#e08a4e] underline underline-offset-2 hover:text-[#f2c091]"
        >
          {match[1]}
        </a>
      );
    } else if (match[3] !== undefined) {
      nodes.push(
        <code key={`${keyPrefix}-${i++}`} className="rounded bg-black/30 border border-border/50 px-1.5 py-0.5 text-[0.9em] font-mono">
          {match[3]}
        </code>
      );
    } else if (match[4] !== undefined) {
      nodes.push(<strong key={`${keyPrefix}-${i++}`} className="font-semibold text-foreground">{match[4]}</strong>);
    } else if (match[5] !== undefined) {
      nodes.push(<s key={`${keyPrefix}-${i++}`} className="opacity-70">{match[5]}</s>);
    } else if (match[6] !== undefined) {
      nodes.push(<em key={`${keyPrefix}-${i++}`}>{match[6]}</em>);
    }
    last = re.lastIndex;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes.length ? nodes : [text];
}

function renderParagraphLines(lines, keyPrefix) {
  return (
    <p className="leading-7 my-3 first:mt-0 last:mb-0">
      {lines.map((l, li) => (
        <span key={li}>
          {renderInline(l, `${keyPrefix}-${li}`)}
          {li < lines.length - 1 && <br />}
        </span>
      ))}
    </p>
  );
}

export function SimpleMarkdown({ text, className = '' }) {
  const blocks = String(text || '').replace(/\r\n/g, '\n').split(/\n{2,}/);
  return (
    <div className={className}>
      {blocks.map((block, bi) => {
        const lines = block.split('\n').filter((l) => l.trim() !== '');
        if (lines.length === 0) return null;

        const rest = lines.slice(1);

        if (lines[0].startsWith('### ')) {
          return (
            <Fragment key={bi}>
              <h4 className="text-base sm:text-lg font-bold text-foreground mt-5 mb-2 first:mt-0">
                {renderInline(lines[0].slice(4), `h${bi}`)}
              </h4>
              {rest.length > 0 && renderParagraphLines(rest, `hr${bi}`)}
            </Fragment>
          );
        }
        if (lines[0].startsWith('## ')) {
          return (
            <Fragment key={bi}>
              <h3 className="text-lg sm:text-xl font-bold text-foreground mt-6 mb-2 first:mt-0">
                {renderInline(lines[0].slice(3), `h${bi}`)}
              </h3>
              {rest.length > 0 && renderParagraphLines(rest, `hr${bi}`)}
            </Fragment>
          );
        }
        if (lines[0].startsWith('# ')) {
          return (
            <Fragment key={bi}>
              <h2 className="text-xl sm:text-2xl font-bold text-foreground mt-7 mb-3 first:mt-0">
                {renderInline(lines[0].slice(2), `h${bi}`)}
              </h2>
              {rest.length > 0 && renderParagraphLines(rest, `hr${bi}`)}
            </Fragment>
          );
        }

        if (lines.every((l) => l.trim().startsWith('- '))) {
          return (
            <ul key={bi} className="list-disc list-inside space-y-1 my-3">
              {lines.map((l, li) => (
                <li key={li}>{renderInline(l.trim().slice(2), `l${bi}-${li}`)}</li>
              ))}
            </ul>
          );
        }

        if (lines.every((l) => /^\d+\.\s/.test(l.trim()))) {
          return (
            <ol key={bi} className="list-decimal list-inside space-y-1 my-3">
              {lines.map((l, li) => (
                <li key={li}>{renderInline(l.trim().replace(/^\d+\.\s/, ''), `o${bi}-${li}`)}</li>
              ))}
            </ol>
          );
        }

        if (lines.every((l) => l.trim().startsWith('> '))) {
          return (
            <blockquote key={bi} className="border-l-2 border-[#c46a2d]/60 pl-4 my-3 italic text-muted-foreground">
              {lines.map((l, li) => (
                <span key={li}>
                  {renderInline(l.trim().slice(2), `q${bi}-${li}`)}
                  {li < lines.length - 1 && <br />}
                </span>
              ))}
            </blockquote>
          );
        }

        return <Fragment key={bi}>{renderParagraphLines(lines, `p${bi}`)}</Fragment>;
      })}
    </div>
  );
}

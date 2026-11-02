// FILE: simple-markdown.jsx
// PUNE ÎN: components/simple-markdown.jsx
// (fișier nou în proiectul wody-dashboard-main la această cale)

import { Fragment } from 'react';

// A small, deliberately limited markdown-style renderer for owner-written
// content (Updates/changelog entries, Blog posts): **bold**, *italic*,
// ~~strikethrough~~, `code`, [link text](https://...), "- " bullet lists,
// "1. " numbered lists, "> " quotes, and "# " / "## " / "### " headings,
// plus blank-line-separated paragraphs. Builds real React elements from the
// text, this NEVER uses dangerouslySetInnerHTML, so there is no HTML/XSS
// injection surface here even though the content is admin-only, not from
// arbitrary visitors, the site's existing philosophy elsewhere (see
// CRITICAL_COPYRIGHT_COMPLIANCE-adjacent safe-rendering choices like
// GeneralErrorLog) already avoids raw HTML injection wherever content
// isn't hardcoded site copy, this keeps that consistent.
//
// Links only ever render with rel="noopener noreferrer" and, since the
// href always comes from the owner's own textarea, target="_blank" is
// safe here the same way it is anywhere else on this site that links out.

// Inline-level: bold, italic, strikethrough, inline code, links, applied
// within one line/paragraph of text. Order matters: links are extracted
// first so an italic/bold marker inside a URL (rare, but "_" and "*" are
// valid in query strings) never gets misparsed as formatting, and code
// spans are matched before bold/italic so something like `**not bold**`
// inside backticks is shown literally instead of being formatted.
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

// A run of non-blank lines rendered as one paragraph, line breaks kept
// as <br /> instead of collapsed. Shared by the default paragraph case
// below and by the heading case, since a heading is only ever the FIRST
// line of a block, if there are more lines after it (the owner pressed
// Enter and kept typing right under the heading with no blank line in
// between), they still need to render as body text instead of vanishing.
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

// Block-level: splits on blank lines into paragraphs. Within each block,
// recognizes a leading "# "/"## "/"### " as a heading, a run of "- "
// lines as one bullet list, a run of "1. " (any leading digits) lines as
// one numbered list, and a run of "> " lines as one quote block.
// Otherwise treats consecutive non-blank lines as one paragraph with line
// breaks preserved (<br />) rather than collapsed, since owners write
// these expecting the line breaks they typed to show up, the same
// behavior the previous plain-text + whitespace-pre-wrap rendering had.
export function SimpleMarkdown({ text, className = '' }) {
  const blocks = String(text || '').replace(/\r\n/g, '\n').split(/\n{2,}/);
  return (
    <div className={className}>
      {blocks.map((block, bi) => {
        const lines = block.split('\n').filter((l) => l.trim() !== '');
        if (lines.length === 0) return null;

        // A heading is only ever its own first line. Anything typed
        // right under it with no blank line gap (rest) used to be
        // silently dropped, it now renders as a normal paragraph right
        // below the heading instead of disappearing.
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

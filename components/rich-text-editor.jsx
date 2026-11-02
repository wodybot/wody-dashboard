'use client';
import { useRef, useState } from 'react';
import { Bold, Italic, Strikethrough, Heading1, Heading2, Heading3, List, ListOrdered, Quote, Code, Link2, Eye, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { SimpleMarkdown } from '@/components/simple-markdown';

// A toolbar-driven editor for any text field that's rendered with
// SimpleMarkdown (Blog posts, Updates/changelog entries, and anywhere
// else on the site that shows owner-written long text). It edits the
// SAME plain markdown-lite string the field already stores, just with
// buttons that insert the marks instead of the owner having to type
// **bold**/## heading by hand, plus a Preview tab that renders through
// the real SimpleMarkdown component, so what's shown here is exactly
// what visitors will see, not a separate approximation. Deliberately
// NOT a full WYSIWYG/contentEditable editor: everything downstream
// (the blog page, the updates page, the PATCH validators in lib/blog.js
// etc.) already expects and stores this exact plain-text format, and a
// true rich-text editor would need a whole new storage format plus a
// migration for existing posts, not something to introduce as a side
// effect of adding formatting buttons.
export function RichTextEditor({ value, onChange, placeholder, maxLength, rows = 10, hint = true }) {
  const textareaRef = useRef(null);
  const [tab, setTab] = useState('write');

  function applyToSelection(before, after = before, placeholderText = '') {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const current = value || '';
    const selected = current.slice(start, end) || placeholderText;
    const next = current.slice(0, start) + before + selected + after + current.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      const cursorStart = start + before.length;
      el.setSelectionRange(cursorStart, cursorStart + selected.length);
    });
  }

  // For line-level marks (headings, quote, bullets, numbers): applies the
  // prefix to every line touched by the current selection, or just the
  // line the cursor sits on if nothing is selected. `numbered` makes the
  // prefix count up (1. 2. 3. ...) instead of repeating literally.
  function applyToLines(prefix, { numbered = false, toggle = true } = {}) {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const current = value || '';
    let lineStart = current.lastIndexOf('\n', start - 1) + 1;
    let lineEnd = current.indexOf('\n', end);
    if (lineEnd === -1) lineEnd = current.length;
    const block = current.slice(lineStart, lineEnd);
    const lines = block.split('\n');
    const alreadyApplied = toggle && lines.every((l) => l.startsWith(prefix) || l.trim() === '');
    const nextLines = lines.map((l, i) => {
      if (l.trim() === '') return l;
      if (alreadyApplied) return l.slice(prefix.length);
      return `${numbered ? `${i + 1}. ` : prefix}${l}`;
    });
    const nextBlock = nextLines.join('\n');
    const next = current.slice(0, lineStart) + nextBlock + current.slice(lineEnd);
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(lineStart, lineStart + nextBlock.length);
    });
  }

  function insertLink() {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const current = value || '';
    const selected = current.slice(start, end);
    const url = window.prompt('Link URL (https://...)', 'https://');
    if (!url || !url.trim()) return;
    const text = selected || 'link text';
    const markup = `[${text}](${url.trim()})`;
    const next = current.slice(0, start) + markup + current.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      const cursorPos = start + markup.length;
      el.setSelectionRange(cursorPos, cursorPos);
    });
  }

  const tools = [
    { icon: Bold, label: 'Bold', onClick: () => applyToSelection('**', '**', 'bold text') },
    { icon: Italic, label: 'Italic', onClick: () => applyToSelection('*', '*', 'italic text') },
    { icon: Strikethrough, label: 'Strikethrough', onClick: () => applyToSelection('~~', '~~', 'struck text') },
    { icon: Code, label: 'Inline code', onClick: () => applyToSelection('`', '`', 'code') },
    { divider: true },
    { icon: Heading1, label: 'Heading 1', onClick: () => applyToLines('# ') },
    { icon: Heading2, label: 'Heading 2', onClick: () => applyToLines('## ') },
    { icon: Heading3, label: 'Heading 3', onClick: () => applyToLines('### ') },
    { divider: true },
    { icon: List, label: 'Bullet list', onClick: () => applyToLines('- ') },
    { icon: ListOrdered, label: 'Numbered list', onClick: () => applyToLines('', { numbered: true, toggle: false }) },
    { icon: Quote, label: 'Quote', onClick: () => applyToLines('> ') },
    { divider: true },
    { icon: Link2, label: 'Link', onClick: insertLink },
  ];

  return (
    <div className="rounded-lg border border-input overflow-hidden">
      <div className="flex items-center justify-between gap-2 border-b border-input bg-background/40 px-2 py-1.5">
        <div className="flex items-center gap-0.5 flex-wrap">
          {tools.map((t, i) => (
            t.divider ? (
              <div key={i} className="w-px h-5 bg-border mx-1" />
            ) : (
              <Button
                key={t.label}
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                title={t.label}
                onMouseDown={(e) => e.preventDefault()}
                onClick={t.onClick}
                disabled={tab === 'preview'}
              >
                <t.icon className="w-3.5 h-3.5" />
              </Button>
            )
          ))}
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          <Button
            type="button"
            variant={tab === 'write' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-7 px-2 text-xs gap-1"
            onClick={() => setTab('write')}
          >
            <Pencil className="w-3 h-3" /> Write
          </Button>
          <Button
            type="button"
            variant={tab === 'preview' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-7 px-2 text-xs gap-1"
            onClick={() => setTab('preview')}
          >
            <Eye className="w-3 h-3" /> Preview
          </Button>
        </div>
      </div>

      {tab === 'write' ? (
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          maxLength={maxLength}
          rows={rows}
          className="border-0 rounded-none focus-visible:ring-0"
        />
      ) : (
        <div className="p-4 min-h-[120px] max-h-96 overflow-y-auto bg-background/20">
          {value?.trim() ? (
            <SimpleMarkdown text={value} className="text-sm text-muted-foreground" />
          ) : (
            <p className="text-xs text-muted-foreground/60 italic">Nothing to preview yet.</p>
          )}
        </div>
      )}

      {hint && (
        <div className="px-3 py-1.5 border-t border-input bg-background/20 text-[11px] text-muted-foreground">
          Select text and click a button, or type markdown directly: <code className="text-foreground/70">**bold**</code>, <code className="text-foreground/70">*italic*</code>, <code className="text-foreground/70">[link](https://...)</code>.
        </div>
      )}
    </div>
  );
}

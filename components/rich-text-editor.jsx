'use client';
import { useRef, useState } from 'react';
import { Bold, Italic, Strikethrough, Heading1, Heading2, Heading3, List, ListOrdered, Quote, Code, Link2, Eye, Pencil, ImagePlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { SimpleMarkdown } from '@/components/simple-markdown';
import { uploadSiteImageFile, IMAGE_ACCEPT } from '@/components/owner-image-field';

export function RichTextEditor({ value, onChange, placeholder, maxLength, rows = 10, hint = true, images = false }) {
  const textareaRef = useRef(null);
  const fileRef = useRef(null);
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

  async function insertImage(file) {
    const url = await uploadSiteImageFile(file);
    if (!url) return;
    const el = textareaRef.current;
    const current = value || '';
    const at = el ? el.selectionStart : current.length;
    const markup = `\n\n![image](${url})\n\n`;
    onChange(current.slice(0, at) + markup + current.slice(at));
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
    ...(images ? [{ icon: ImagePlus, label: 'Insert image from computer', onClick: () => fileRef.current?.click() }] : []),
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
        {images ? <input ref={fileRef} type="file" accept={IMAGE_ACCEPT} className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) insertImage(f); }} /> : null}
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

'use client';
import FloatingBar from '@/components/floating-bar';
import PreviewZoom from '@/components/preview-zoom';
import DiscordAppTag from '@/components/discord-app-tag';
import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2, Save, Info, Archive, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip as UiTooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';
import { proxiedImageUrl } from '@/lib/utils';
import { MultiPicker, SearchableSelect, channelOptions, roleOptions } from '@/components/entity-picker';
import { CARD_FONTS, cardFontStyle } from '@/lib/card-fonts';
import IconText from '@/components/icon-text';

export function InfoHint({ children }) {
  const [open, setOpen] = useState(false);
  const t = useTranslations('guildSettings.common');
  if (!children) return null;
  return (
    <TooltipProvider delayDuration={150}>
    <UiTooltip delayDuration={150} open={open} onOpenChange={setOpen}>
      <TooltipTrigger asChild>
        <button
          type="button"
          tabIndex={0}
          aria-label={t('moreInfo')}
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen((v) => !v); }}
          className="inline-flex shrink-0 items-center justify-center w-6 h-6 -m-1 touch-manipulation rounded-full text-muted-foreground/55 hover:text-foreground hover:bg-white/10 transition-colors"
        >
          <Info className="w-3.5 h-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        collisionPadding={12}
        className="max-w-[min(280px,calc(100vw-2rem))] bg-popover text-popover-foreground border border-border/70 shadow-xl text-[12px] leading-relaxed font-normal"
      >
        {children}
      </TooltipContent>
    </UiTooltip>
    </TooltipProvider>
  );
}

export async function safeJson(url, fallback = null, options) {
  try {
    const res = await fetch(url, options);
    if (!res.ok) return fallback;
    return await res.json();
  } catch {
    return fallback;
  }
}

export function ChannelSelect({ value, onChange, channels, placeholder, includeNone = true, noneLabel, types = [0, 5], disabled = false }) {
  const t = useTranslations('guildSettings.common');
  const options = useMemo(() => channelOptions(channels, types), [channels, types]);
  return <SearchableSelect value={value} onChange={onChange} options={options} placeholder={placeholder || t('selectAChannel')} includeNone={includeNone} noneLabel={noneLabel} disabled={disabled} empty={t('noChannelsAvailable')} />;
}

export function RoleSelect({ value, onChange, roles, placeholder, includeNone = true, disabled = false }) {
  const t = useTranslations('guildSettings.common');
  const options = useMemo(() => roleOptions(roles), [roles]);
  return <SearchableSelect value={value} onChange={onChange} options={options} placeholder={placeholder || t('selectARole')} includeNone={includeNone} disabled={disabled} empty={t('noRolesAvailable')} />;
}

export function RoleMultiSelect({ value, onChange, roles, placeholder, disabled = false, max }) {
  const t = useTranslations('guildSettings.common');
  const options = useMemo(() => roleOptions(roles), [roles]);
  return <MultiPicker value={value} onChange={onChange} options={options} placeholder={placeholder || t('selectRoles')} disabled={disabled} max={max} empty={t('noRolesAvailable')} />;
}

export function ChannelMultiSelect({ value, onChange, channels, types = [0, 5], placeholder, disabled = false, max }) {
  const t = useTranslations('guildSettings.common');
  const options = useMemo(() => channelOptions(channels, types), [channels, types]);
  return <MultiPicker value={value} onChange={onChange} options={options} placeholder={placeholder || t('noChannelsSelected')} disabled={disabled} max={max} empty={t('noChannelsAvailable')} />;
}

export function SectionHeader({ title, description, action }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between mb-6 gap-3 sm:gap-4">
      <div>
        <h2 className="text-2xl font-bold">{title}</h2>
        {description && <p className="text-[15px] text-muted-foreground mt-1.5 leading-relaxed">{description}</p>}
      </div>
      {action}
    </div>
  );
}

const MENTION_CLASS = 'rounded-[3px] bg-[#5865f2]/30 px-0.5 font-medium text-[#c9cdfb]';
const LINK_CLASS = 'text-[#00a8fc] hover:underline break-all';

function formatDiscordTimestamp(unix, style) {
  const date = new Date(Number(unix) * 1000);
  if (Number.isNaN(date.getTime())) return null;
  if (style === 'R') {
    const diff = Math.round((date.getTime() - Date.now()) / 1000);
    const abs = Math.abs(diff);
    const units = [['year', 31536000], ['month', 2592000], ['day', 86400], ['hour', 3600], ['minute', 60], ['second', 1]];
    const [unit, size] = units.find(([, s]) => abs >= s) || ['second', 1];
    try { return new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(Math.round(diff / size), unit); } catch { return date.toLocaleString(); }
  }
  const opts = {
    t: { hour: 'numeric', minute: '2-digit' },
    T: { hour: 'numeric', minute: '2-digit', second: '2-digit' },
    d: { day: '2-digit', month: '2-digit', year: 'numeric' },
    D: { day: 'numeric', month: 'long', year: 'numeric' },
    f: { day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit' },
    F: { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit' },
  }[style || 'f'] || { day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit' };
  try { return new Intl.DateTimeFormat('en-US', opts).format(date); } catch { return date.toLocaleString(); }
}

export function discordFullDate(date = new Date()) {
  return formatDiscordTimestamp(Math.floor(date.getTime() / 1000), 'f');
}

const INLINE_RE = /(`[^`\n]+`)|(\|\|[^|]+\|\|)|(\*\*\*[^*]+\*\*\*)|(\*\*[^*]+\*\*)|(__[^_]+__)|(~~[^~]+~~)|(\*[^*\s][^*]*\*)|((?<![\w])_[^_\s][^_]*_(?![\w]))|(\[[^\]\n]+\]\(<?https?:\/\/[^)\s>]+>?\))|(<a?:[\w~]{2,32}:\d{5,25}>)|(<t:-?\d{1,13}(?::[tTdDfFR])?>)|(<@!?\d{5,25}>)|(<@&\d{5,25}>)|(<#\d{5,25}>)|(@(?:everyone|here)\b)|((?<![\w/])@[A-Za-z][\w.]*(?:\s(?=[A-Z])[A-Za-z][\w.]*)?)|((?<![\w&/])#[a-z][\w-]*)|(<?https?:\/\/[^\s<>]+>?)/g;

function renderInline(line, keyPrefix) {
  const out = [];
  let last = 0;
  let m;
  let n = 0;
  const re = new RegExp(INLINE_RE.source, 'g');
  while ((m = re.exec(line)) !== null) {
    if (m.index > last) out.push(<span key={`${keyPrefix}-t${n++}`}><IconText text={line.slice(last, m.index)} /></span>);
    const raw = m[0];
    const key = `${keyPrefix}-m${n++}`;
    if (m[1]) out.push(<code key={key} className="rounded-[4px] bg-[#1e1f22] px-1 py-0.5 font-mono text-[0.85em] text-[#dbdee1]">{raw.slice(1, -1)}</code>);
    else if (m[2]) out.push(<span key={key} className="rounded-[3px] bg-[#1e1f22] px-0.5 text-[#1e1f22] transition-colors hover:text-[#dbdee1]">{raw.slice(2, -2)}</span>);
    else if (m[3]) out.push(<strong key={key} className="font-bold italic">{renderInline(raw.slice(3, -3), key)}</strong>);
    else if (m[4]) out.push(<strong key={key} className="font-bold">{renderInline(raw.slice(2, -2), key)}</strong>);
    else if (m[5]) out.push(<span key={key} className="underline">{renderInline(raw.slice(2, -2), key)}</span>);
    else if (m[6]) out.push(<span key={key} className="line-through">{renderInline(raw.slice(2, -2), key)}</span>);
    else if (m[7] || m[8]) out.push(<em key={key} className="italic">{renderInline(raw.slice(1, -1), key)}</em>);
    else if (m[9]) {
      const label = raw.slice(1, raw.indexOf(']('));
      out.push(<span key={key} className={LINK_CLASS}>{renderInline(label, key)}</span>);
    } else if (m[10]) out.push(<span key={key} className="text-[#dbdee1]">:{raw.split(':')[1]}:</span>);
    else if (m[11]) {
      const [, unix, style] = /^<t:(-?\d+)(?::([tTdDfFR]))?>$/.exec(raw) || [];
      out.push(<span key={key} className="rounded-[3px] bg-white/[0.06] px-0.5">{formatDiscordTimestamp(unix, style) || raw}</span>);
    } else if (m[12]) out.push(<span key={key} className={MENTION_CLASS}>@Member</span>);
    else if (m[13]) out.push(<span key={key} className={MENTION_CLASS}>@Role</span>);
    else if (m[14]) out.push(<span key={key} className={MENTION_CLASS}>#channel</span>);
    else if (m[15] || m[16] || m[17]) out.push(<span key={key} className={MENTION_CLASS}>{raw}</span>);
    else if (m[18]) {
      const url = raw.replace(/^<|>$/g, '');
      out.push(<span key={key} className={LINK_CLASS}>{url}</span>);
    }
    last = re.lastIndex;
  }
  if (last < line.length) out.push(<span key={`${keyPrefix}-t${n++}`}><IconText text={line.slice(last)} /></span>);
  return out;
}

export function renderDiscordMarkdown(text) {
  const src = String(text ?? '');
  if (!src) return null;
  const lines = src.split('\n');
  const blocks = [];
  for (let li = 0; li < lines.length; li++) {
    const line = lines[li];
    if (/^```/.test(line)) {
      const body = [];
      let j = li + 1;
      const first = line.slice(3);
      if (first.endsWith('```') && first.length > 3) { blocks.push(<pre key={li} className="my-1 whitespace-pre-wrap rounded-[4px] border border-[#1e1f22] bg-[#2b2d31] p-2 font-mono text-[0.85em]">{first.slice(0, -3)}</pre>); continue; }
      while (j < lines.length && !/```\s*$/.test(lines[j])) { body.push(lines[j]); j++; }
      if (j < lines.length) {
        const tail = lines[j].replace(/```\s*$/, '');
        if (tail) body.push(tail);
        blocks.push(<pre key={li} className="my-1 whitespace-pre-wrap rounded-[4px] border border-[#1e1f22] bg-[#2b2d31] p-2 font-mono text-[0.85em] text-[#dbdee1]">{body.join('\n')}</pre>);
        li = j;
        continue;
      }
    }
    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    if (heading) {
      const level = heading[1].length;
      const cls = level === 1 ? 'text-[1.5em] font-bold leading-[1.375] mt-2 first:mt-0' : level === 2 ? 'text-[1.25em] font-bold leading-[1.375] mt-2 first:mt-0' : 'text-[1em] font-bold leading-[1.375] mt-1.5 first:mt-0';
      blocks.push(<div key={li} className={`${cls} text-[#f2f3f5] break-words`}>{renderInline(heading[2], `l${li}`)}</div>);
      continue;
    }
    const sub = /^-#\s+(.*)$/.exec(line);
    if (sub) { blocks.push(<div key={li} className="text-[0.8125em] leading-[1.3] text-[#949ba4] break-words">{renderInline(sub[1], `l${li}`)}</div>); continue; }
    const quote = /^>>?>?\s?(.*)$/.exec(line);
    if (quote && line.startsWith('>')) { blocks.push(<div key={li} className="border-l-4 border-[#4e5058] pl-3 break-words">{quote[1] ? renderInline(quote[1], `l${li}`) : ' '}</div>); continue; }
    const list = /^(\s*)([-*]|\d+\.)\s+(.*)$/.exec(line);
    if (list) {
      const ordered = /\d/.test(list[2]);
      blocks.push(<div key={li} className="flex gap-2 break-words" style={{ paddingLeft: `${Math.min(3, Math.floor(list[1].length / 2)) * 1.25 + 0.25}em` }}><span className="shrink-0 text-[#b5bac1]">{ordered ? list[2] : '•'}</span><span className="min-w-0">{renderInline(list[3], `l${li}`)}</span></div>);
      continue;
    }
    if (line === '') { blocks.push(<div key={li}>{' '}</div>); continue; }
    blocks.push(<div key={li} className="break-words">{renderInline(line, `l${li}`)}</div>);
  }
  return blocks;
}

export const GIPHY_PAGE_RE = /^https?:\/\/(?:www\.)?giphy\.com\/(?:gifs|clips)\/(?:[^/]+\/)?([a-zA-Z0-9]+)\/?(?:\?.*)?$/i;

export const TENOR_PAGE_RE = /^https?:\/\/(?:www\.)?tenor\.com\/view\//i;

export const GIPHY_ANY_PAGE_RE = /^https?:\/\/(?:www\.)?giphy\.com\/(?:gifs|clips)\//i;

export function isUsableImageUrl(value) {
  if (!value) return true;
  try {
    const u = new URL(String(value));
    if (!['http:', 'https:'].includes(u.protocol)) return false;
    const host = u.hostname.toLowerCase().replace(/\.$/, '');
    if (!host.includes('.')) return false;
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return false;
    if (host.endsWith('.local') || host.endsWith('.internal')) return false;
    return true;
  } catch { return false; }
}

export function resolvePreviewUrl(url) {
  if (!url) return '';
  const raw = String(url).trim();
  const m = raw.match(GIPHY_PAGE_RE);
  if (m) return `https://media.giphy.com/media/${m[1]}/giphy.gif`;
  return raw;
}

export function getPreviewCandidates(url) {
  if (!url) return [];
  const raw = String(url).trim();
  const candidates = [];
  const add = (value) => {
    if (value && !candidates.includes(value)) candidates.push(value);
  };
  add(resolvePreviewUrl(raw));
  add(raw);

  try {
    const u = new URL(raw);
    if (/\.webp(?:$|[?#])/i.test(u.pathname)) {
      u.pathname = u.pathname.replace(/\.webp$/i, '.gif');
      add(u.toString());
      if (/^wody\.online$/i.test(u.hostname) && /\/presets\//i.test(u.pathname)) {
        u.pathname = u.pathname.replace(/\.gif$/i, '.jpg');
        add(u.toString());
      }
    }
    if (/^cdn\.discordapp\.com$/i.test(u.hostname) && /(?:^|&)size=1024(?:&|$)/.test(u.search.slice(1))) {
      u.search = u.search.replace(/([?&])size=1024(&|$)/, '$1size=256$2');
      add(u.toString());
    }
  } catch {}
  return candidates;
}

export function stripCardMarkdown(text) {
  return String(text || '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/^\s{0,3}#{1,3}\s+/gm, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/(\*\*\*|\*\*|__|~~|`|\*|_)/g, '')
    .replace(/[ \t]*\n[ \t]*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function CardFontPicker({ value, onChange, allowBold = false }) {
  const t = useTranslations('cardFonts');
  const current = value || 'default';
  return (
    <div>
      <Label>{t('label')}</Label>
      <Select value={current} onValueChange={onChange}>
        <SelectTrigger style={cardFontStyle(current)}><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="default">{t('classic')}</SelectItem>
          {allowBold && <SelectItem value="bold">{t('classicBold')}</SelectItem>}
          {CARD_FONTS.map((f) => <SelectItem key={f.id} value={f.id}><span style={cardFontStyle(f.id)} className="text-base">{f.label}</span></SelectItem>)}
        </SelectContent>
      </Select>
      <p className="mt-1 text-xs text-muted-foreground">{t('hint')}</p>
    </div>
  );
}

export function CardPreview({ backgroundUrl, overlayColor, overlayOpacity, textColor, ringColor, avatarUrl, avatarRing, title, message, footer, fontId }) {
  return (
    <div
      className="relative w-full overflow-hidden bg-slate-950"
      style={{ aspectRatio: '1200 / 630', containerType: 'inline-size', ...cardFontStyle(fontId) }}
    >
      {backgroundUrl && <PreviewImage url={backgroundUrl} alt="" className="absolute inset-0 w-full h-full object-cover" draggable="false" />}
      <div className="absolute inset-0" style={{ backgroundColor: overlayColor, opacity: overlayOpacity / 100 }} />
      <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0) 35%, rgba(0,0,0,0.59) 100%)' }} />
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center" style={{ padding: '5cqw 6cqw 8cqw' }}>
        {avatarUrl && (
          <PreviewImage
            url={avatarUrl}
            alt=""
            className="rounded-full object-cover shrink-0"
            style={{
              width: '14.6cqw',
              height: '14.6cqw',
              marginBottom: '3.4cqw',
              ...(avatarRing ? { boxShadow: `0 0 0 0.85cqw ${ringColor || textColor}, 0 0 0 2.2cqw rgba(255,255,255,.16)` } : null),
            }}
          />
        )}
        <div
          className="font-bold break-words w-full"
          style={{ color: textColor, fontSize: '4.7cqw', lineHeight: 1.18, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
        >
          {stripCardMarkdown(title)}
        </div>
        {stripCardMarkdown(message) && (
          <div
            className="break-words w-full"
            style={{ color: textColor, opacity: 0.88, fontSize: '2.35cqw', lineHeight: 1.45, marginTop: '1.5cqw', display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
          >
            {stripCardMarkdown(message)}
          </div>
        )}
      </div>
      {stripCardMarkdown(footer) && (
        <div
          className="absolute inset-x-0 text-center truncate"
          style={{ color: textColor, opacity: 0.7, bottom: '3.4cqw', fontSize: '1.7cqw', paddingLeft: '4cqw', paddingRight: '4cqw' }}
        >
          {stripCardMarkdown(footer)}
        </div>
      )}
    </div>
  );
}

export const DISCORD_BUTTON_STYLES = {
  primary: 'bg-[#5865f2] hover:bg-[#4752c4] text-white',
  secondary: 'bg-[#4e5058] hover:bg-[#6d6f78] text-white',
  success: 'bg-[#248046] hover:bg-[#1a6334] text-white',
  danger: 'bg-[#da373c] hover:bg-[#a12828] text-white',
  link: 'bg-[#4e5058] hover:bg-[#6d6f78] text-white',
};

function previewClock() {
  try { return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(new Date()); } catch { return '12:00 PM'; }
}

export function DiscordMessage({ children, time, className = '', compact = false }) {
  const [clock, setClock] = useState(time || null);
  useEffect(() => { if (!time) setClock(previewClock()); }, [time]);
  return (
    <PreviewZoom>
    <div data-keep-color className={`rounded-xl border border-[#1e1f22] bg-[#313338] p-3 sm:p-4 text-[#dbdee1] shadow-lg min-w-0 ${compact ? 'text-[13px]' : 'text-[14px]'} leading-[1.375] ${className}`}>
      <div className="flex gap-3 min-w-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/api/status/bot-avatar" alt="" decoding="async" className="mt-0.5 h-10 w-10 shrink-0 rounded-full bg-[#1e1f22] object-cover" />
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 leading-tight">
            <span className="font-semibold text-[#f2f3f5]">Wody</span>
            <DiscordAppTag />
            <span className="text-[12px] text-[#949ba4]">Today at {clock || '12:00 PM'}</span>
          </div>
          <div className="min-w-0 space-y-1">{children}</div>
        </div>
      </div>
    </div>
    </PreviewZoom>
  );
}

export function DiscordText({ children, className = '' }) {
  if (children == null || children === '') return null;
  return <div className={`min-w-0 whitespace-pre-wrap break-words text-[#dbdee1] ${className}`}>{typeof children === 'string' ? renderDiscordMarkdown(children) : children}</div>;
}

export function DiscordButtons({ buttons }) {
  if (!buttons || !buttons.length) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {buttons.map((b, i) => (
        <span
          key={`${b.label || ''}-${i}`}
          className={`inline-flex h-8 min-w-[60px] items-center justify-center gap-1.5 rounded-[8px] px-4 text-[14px] font-medium leading-none transition-colors ${DISCORD_BUTTON_STYLES[b.style || 'secondary'] || DISCORD_BUTTON_STYLES.secondary} ${b.disabled ? 'opacity-50' : ''}`}
        >
          {b.emoji ? <span className="text-[1.1em] leading-none"><IconText text={b.emoji} /></span> : null}
          {b.label ? <span className="truncate max-w-[14rem]">{b.label}</span> : null}
          {b.style === 'link' ? (
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 opacity-90" aria-hidden="true"><path fill="currentColor" d="M15 3h6v6h-2V6.41l-8.29 8.3-1.42-1.42L17.59 5H15V3ZM5 5h6v2H7v10h10v-4h2v6H5V5Z" /></svg>
          ) : null}
        </span>
      ))}
    </div>
  );
}

export function DiscordSelect({ placeholder }) {
  if (!placeholder) return null;
  return (
    <div className="flex h-10 w-full max-w-[400px] items-center justify-between rounded-[8px] border border-[#1e1f22] bg-[#1e1f22]/60 px-3 text-[14px] text-[#949ba4]">
      <span className="truncate">{placeholder}</span>
      <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true"><path fill="currentColor" d="M12 15.5 6.5 10l1.4-1.4 4.1 4.1 4.1-4.1 1.4 1.4z" /></svg>
    </div>
  );
}

export function V2Separator() {
  return <div className="my-1 h-px w-full bg-[#4e5058]/50" />;
}

export function V2Container({ accentColor, children }) {
  return (
    <div className="relative max-w-[min(100%,600px)] min-w-0 overflow-hidden rounded-[8px] border border-[#1e1f22]/80 bg-[#2b2d31]">
      {accentColor ? <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1" style={{ backgroundColor: accentColor }} /> : null}
      <div className={`flex min-w-0 flex-col gap-2 p-4 ${accentColor ? 'pl-5' : ''}`}>{children}</div>
    </div>
  );
}

export function EmbedPreview({
  accentColor, authorName, authorIcon: _authorIcon, title, description, footer, timestamp, imageUrl, imageAsThumbnail, thumbnailUrl,
  fields = [], buttons = [], select, sourceHeader, children, attachment,
}) {
  const thumb = imageAsThumbnail ? imageUrl : thumbnailUrl;
  const fullImage = imageAsThumbnail ? null : imageUrl;
  const headerLines = [];
  if (authorName) headerLines.push(`-# ${authorName}`);
  if (title) headerLines.push(`## ${title}`);
  const textBlock = [headerLines.join('\n'), description || ''].filter(Boolean).join('\n\n');
  const [stamp, setStamp] = useState('');
  useEffect(() => { if (timestamp) setStamp(discordFullDate()); }, [timestamp]);
  const subtext = [footer || '', timestamp ? stamp : ''].filter(Boolean).join(' ').trim();
  return (
    <V2Container accentColor={accentColor}>
      {sourceHeader ? <DiscordText>{`# ${sourceHeader}`}</DiscordText> : null}
      {textBlock && thumb ? (
        <div className="flex min-w-0 items-start gap-4">
          <DiscordText className="flex-1">{textBlock}</DiscordText>
          <PreviewImage url={thumb} alt="" className="h-[85px] w-[85px] shrink-0 rounded-[8px] object-cover" />
        </div>
      ) : textBlock ? (
        <DiscordText>{textBlock}</DiscordText>
      ) : thumb ? (
        <PreviewImage url={thumb} alt="" className="max-h-80 w-full rounded-[8px] object-cover" />
      ) : null}
      {fields.map((f, i) => <DiscordText key={`f${i}`}>{`**${f.name || f.label || ''}**\n${f.value || ''}`}</DiscordText>)}
      {fullImage ? <PreviewImage url={fullImage} alt="" className="max-h-[350px] w-full rounded-[8px] object-cover" /> : null}
      {children}
      {subtext ? (<><V2Separator /><DiscordText>{`-# ${subtext}`}</DiscordText></>) : null}
      {attachment || null}
      {select ? <DiscordSelect placeholder={select} /> : null}
      <DiscordButtons buttons={buttons} />
    </V2Container>
  );
}

export function YoutubeLinkUnfurl({ channelTitle, videoTitle, thumbnailUrl }) {
  return (
    <div className="max-w-[432px] min-w-0 overflow-hidden rounded-[4px] border-l-4 border-[#ff0000] bg-[#2b2d31] p-3 pr-4">
      <div className="text-[12px] text-[#dbdee1]">YouTube</div>
      {channelTitle ? <div className="mt-1 text-[14px] font-semibold text-[#f2f3f5] break-words">{channelTitle}</div> : null}
      <div className="mt-1 text-[16px] font-semibold leading-snug text-[#00a8fc] break-words">{videoTitle}</div>
      <div className="relative mt-3 aspect-video w-full overflow-hidden rounded-[4px] bg-black">
        {thumbnailUrl ? <PreviewImage url={thumbnailUrl} alt="" className="h-full w-full object-cover" /> : <div className="h-full w-full bg-gradient-to-br from-[#3a1010] via-[#1f1f1f] to-[#101010]" />}
        <span className="absolute left-1/2 top-1/2 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/70">
          <svg viewBox="0 0 24 24" className="ml-0.5 h-6 w-6 text-white" aria-hidden="true"><path fill="currentColor" d="M8 5v14l11-7z" /></svg>
        </span>
      </div>
    </div>
  );
}

export function UnresolvedLinkNote({ url }) {
  const tc = useTranslations('guildSettings.common');
  if (!isLikelyUnresolvedPageLink(url)) return null;
  return (
    <div className="mt-3 rounded-lg border border-dashed border-border/70 bg-secondary/20 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
      {tc('pageLinkPreviewNote')}
    </div>
  );
}

export function PreviewImage({ url, alt = '', className = '', ...props }) {
  const candidates = useMemo(() => [...new Set(getPreviewCandidates(url).map(proxiedImageUrl).filter(Boolean))], [url]);
  const [index, setIndex] = useState(0);
  useEffect(() => { setIndex(0); }, [url]);
  if (!candidates.length || index >= candidates.length) return null;
  return (
    <img
      key={candidates[index]}
      src={candidates[index]}
      alt={alt}
      className={className}
      {...props}
      onError={() => setIndex((i) => i + 1)}
    />
  );
}

export function isLikelyUnresolvedPageLink(url) {
  if (!url) return false;
  const raw = String(url).trim();
  return TENOR_PAGE_RE.test(raw) || (GIPHY_ANY_PAGE_RE.test(raw) && !GIPHY_PAGE_RE.test(raw));
}

export function InfoTip({ text }) {
  return <span title={text} className="inline-flex items-center justify-center w-4 h-4 rounded-full text-muted-foreground hover:text-foreground cursor-help"><Info className="w-3.5 h-3.5" /></span>;
}

export function ProgressBar({ value, max, label, note }) {
  if (Number(max) >= 1000000) {
    const used = Math.max(0, Number(value) || 0);
    return <div className="space-y-2"><div className="flex items-center justify-between text-xs"><span className="text-muted-foreground">{label}</span><span className="font-medium">{used} / ∞</span></div><div className="h-2 rounded-full bg-secondary overflow-hidden"><div className="h-full w-full rounded-full bg-gradient-to-r from-[#c46a2d]/60 via-[#f2c091]/50 to-[#c46a2d]/60" /></div>{note && <p className="text-[11px] text-muted-foreground">{note}</p>}</div>;
  }
  const safeMax = Math.max(1, Number(max) || 1);
  const current = Math.min(safeMax, Math.max(0, Number(value) || 0));
  const percent = Math.round((current / safeMax) * 100);
  return <div className="space-y-2"><div className="flex items-center justify-between text-xs"><span className="text-muted-foreground">{label}</span><span className="font-medium">{current} / {safeMax}</span></div><div className="h-2 rounded-full bg-secondary overflow-hidden"><div className="h-full rounded-full bg-primary transition-all duration-300" style={{ width: `${percent}%` }} /></div>{note && <p className="text-[11px] text-muted-foreground">{note}</p>}</div>;
}

export function FieldRow({ label, hint, children }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 sm:justify-between max-w-2xl">
      <div className="min-w-0 flex items-start sm:items-center gap-1.5">
        <Label className="mb-0 min-w-0">{label}</Label>
        <InfoHint>{hint}</InfoHint>
      </div>
      <div className="w-full sm:w-64 sm:shrink-0 min-w-0">{children}</div>
    </div>
  );
}

export function NumField({ label, hint, value, onChange, disabled }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1"><Label className="mb-0">{label}</Label><InfoHint>{hint}</InfoHint></div>
      <Input type="number" value={value ?? 0} onChange={(e) => onChange(Number(e.target.value))} disabled={disabled} />
    </div>
  );
}

export function SaveBar({ saving, onSave, dirty, onDiscard, disabled = false }) {
  const t = useTranslations('guildSettings.common');
  const tk = useTranslations('guildSettings.kit');
  const tracked = typeof dirty === 'boolean';
  useEffect(() => {
    if (!tracked || !dirty) return undefined;
    const warn = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [tracked, dirty]);
  if (!tracked) {
    return (
      <div className="flex justify-end pt-2">
        <Button onClick={onSave} disabled={saving || disabled} className="gradient-primary">
          {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          {t('saveChanges')}
        </Button>
      </div>
    );
  }
  if (!dirty) return null;
  return (
    <FloatingBar>
      <div role="status" aria-live="polite" className="flex w-full max-w-3xl flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#e6cd8c]/40 bg-background/95 px-4 py-2.5 shadow-[0_12px_40px_-8px_rgba(0,0,0,0.85)] backdrop-blur-md">
        <span className="inline-flex min-w-0 items-center gap-2 text-sm font-medium text-[#e6cd8c]"><span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-[#e08a4e]" />{tk('unsaved')}</span>
        <div className="ml-auto flex shrink-0 gap-2">
          {onDiscard ? <Button variant="outline" onClick={onDiscard} disabled={saving} className="rounded-full">{tk('discard')}</Button> : null}
          <Button onClick={onSave} disabled={saving || disabled} className="gradient-primary rounded-full px-5">
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            {t('saveChanges')}
          </Button>
        </div>
      </div>
    </FloatingBar>
  );
}

export function Skeleton() {
  return (
    <div className="space-y-4">
      <div className="h-8 w-48 rounded bg-secondary animate-pulse" />
      <div className="h-64 rounded-2xl bg-card/40 animate-pulse" />
    </div>
  );
}

export function Empty({ text, title, action }) {
  const t = useTranslations('guildSettings.common');
  return <div className="rounded-2xl border border-dashed border-border/70 bg-secondary/10 px-6 py-10 text-center"><div className="mx-auto mb-4 w-10 h-10 rounded-xl bg-secondary/70 flex items-center justify-center"><Archive className="w-4 h-4 text-muted-foreground" /></div><div className="font-medium">{title || t('nothingHereYet')}</div><p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">{text}</p>{action && <div className="mt-4">{action}</div>}</div>;
}

'use client';
// Draws a text with every emoji or {wy:name} token as a Wody custom icon. Nothing is ever drawn as a standard emoji.
import { Fragment, memo } from 'react';
import { splitIcons, iconUrl } from '@/lib/emoji-icons';
import { proxiedImageUrl } from '@/lib/utils';

export function Icon({ file, size = 18, className = '', title }) {
  const url = iconUrl(file);
  const box = { width: size, height: size, flex: '0 0 auto', verticalAlign: '-0.2em' };
  if (!url) return <span aria-hidden="true" className={`inline-block rounded-[28%] bg-white/15 ${className}`} style={box} />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={proxiedImageUrl(url)} alt={title || ''} aria-hidden={title ? undefined : 'true'} title={title} width={size} height={size} draggable={false} loading="lazy" decoding="async" className={`inline-block object-contain select-none ${className}`} style={box} />;
}

function IconTextBase({ text, size = 18, className = '' }) {
  return <>{splitIcons(text).map((p, i) => (p.icon !== undefined ? <Icon key={i} file={p.icon} size={size} className={className} /> : <Fragment key={i}>{p.text}</Fragment>))}</>;
}

export default memo(IconTextBase);

'use client';
import { useState } from 'react';
import { wodyIconUrl } from '@/lib/wody-icons';
import { proxiedImageUrl } from '@/lib/utils';

// One renderer for every Wody custom emoji on the site. It keeps the artwork's proportions (square, object-contain), sits on the
// text baseline, and when the key or the file is unknown it draws a neutral rounded shape instead of a Unicode emoji or an id.
export default function WodyIcon({ name, size = 20, className = '', title, inline = true, style }) {
  const url = wodyIconUrl(name);
  const [broken, setBroken] = useState(false);
  const box = { width: size, height: size, flex: '0 0 auto', ...(inline ? { verticalAlign: '-0.2em' } : null), ...style };
  if (!url || broken) {
    return <span aria-hidden="true" className={`inline-block rounded-[28%] bg-white/15 ${className}`} style={box} />;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={proxiedImageUrl(url)} alt={title || ''} aria-hidden={title ? undefined : 'true'} title={title} width={size} height={size} draggable={false}
      loading="lazy" decoding="async" onError={() => setBroken(true)}
      className={`inline-block object-contain select-none ${className}`} style={box} />
  );
}

'use client';

import { useRef, useState } from 'react';
import { Music2, Pause, Play } from 'lucide-react';

export default function MusicButton({ src, title, labels }) {
  const ref = useRef(null);
  const [on, setOn] = useState(false);
  const toggle = () => {
    if (!ref.current) {
      const a = new Audio(src);
      a.loop = true;
      a.volume = 0.5;
      a.addEventListener('pause', () => setOn(false));
      a.addEventListener('play', () => setOn(true));
      a.addEventListener('error', () => setOn(false));
      ref.current = a;
    }
    if (ref.current.paused) ref.current.play().catch(() => setOn(false));
    else ref.current.pause();
  };
  return (
    <div className="inline-flex max-w-full flex-col items-center gap-1 sm:items-start">
      <button type="button" onClick={toggle} aria-pressed={on} className="inline-flex max-w-full items-center gap-2 rounded-full border border-[#e6cd8c]/50 bg-[#e6cd8c]/10 px-3.5 py-1.5 text-sm font-semibold text-[#f3e1b0] transition hover:bg-[#e6cd8c]/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#e6cd8c]">
        {on ? <Pause className="h-4 w-4 shrink-0" aria-hidden="true" /> : <Play className="h-4 w-4 shrink-0" aria-hidden="true" />}
        <Music2 className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="truncate">{title || (on ? labels.pause : labels.play)}</span>
      </button>
      <span className="text-[11px] text-muted-foreground">{labels.note}</span>
    </div>
  );
}

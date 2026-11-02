'use client';
// Horizontal band used by every Marketplace section and by the homepage.
// Native scrolling (mouse, touch, trackpad, keyboard), snap points, two buttons that
// disable at the ends, a progress indicator, reduced motion respected. Vertical wheel
// and swipe always pass through to the page, so the band never traps the scroll.
import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';

export default function Scroller({ label, prevLabel, nextLabel, refreshLabel, onRefresh, refreshing = false, children, className = '', onNearEnd }) {
  const ref = useRef(null);
  const [edge, setEdge] = useState({ start: true, end: false, ratio: 0, overflow: false });
  const update = useCallback(() => {
    const el = ref.current; if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setEdge({ start: el.scrollLeft <= 2, end: el.scrollLeft >= max - 2, ratio: max > 0 ? el.scrollLeft / max : 0, overflow: max > 4 });
    if (onNearEnd && max > 0 && el.scrollLeft >= max - el.clientWidth * 0.6) onNearEnd();
  }, [onNearEnd]);
  useEffect(() => {
    const el = ref.current; if (!el) return undefined;
    update();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;
    ro?.observe(el);
    el.addEventListener('scroll', update, { passive: true });
    return () => { ro?.disconnect(); el.removeEventListener('scroll', update); };
  }, [update, children]);
  const go = (dir) => {
    const el = ref.current; if (!el) return;
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    el.scrollBy({ left: dir * Math.max(240, el.clientWidth * 0.85), behavior: reduce ? 'auto' : 'smooth' });
  };
  const btn = 'inline-flex h-9 w-9 items-center justify-center rounded-full border border-border/70 bg-card/70 text-foreground transition hover:bg-card focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e6cd8c] disabled:opacity-35 disabled:pointer-events-none';
  return (
    <div className={className}>
      <div className="mb-3 flex items-center justify-end gap-2">
        {onRefresh && (
          <button type="button" className={btn} onClick={onRefresh} aria-label={refreshLabel} title={refreshLabel} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} aria-hidden="true" />
          </button>
        )}
        <button type="button" className={btn} onClick={() => go(-1)} disabled={edge.start} aria-label={prevLabel} title={prevLabel}><ChevronLeft className="h-4 w-4" aria-hidden="true" /></button>
        <button type="button" className={btn} onClick={() => go(1)} disabled={edge.end} aria-label={nextLabel} title={nextLabel}><ChevronRight className="h-4 w-4" aria-hidden="true" /></button>
      </div>
      <div
        ref={ref}
        role="region"
        aria-label={label}
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'ArrowRight') { e.preventDefault(); go(1); } else if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); } }}
        className="mk-scroll flex gap-4 overflow-x-auto overflow-y-hidden pb-3 snap-x snap-proximity focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e6cd8c] rounded-xl"
        style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}
      >
        {children}
      </div>
      {edge.overflow && (
        <div className="mt-1 h-1 w-full max-w-[160px] overflow-hidden rounded-full bg-border/50" aria-hidden="true">
          <div className="h-full rounded-full bg-[#e6cd8c]/80" style={{ width: '30%', marginLeft: `${edge.ratio * 70}%` }} />
        </div>
      )}
    </div>
  );
}

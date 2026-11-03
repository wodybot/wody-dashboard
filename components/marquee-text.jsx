'use client';

import { useEffect, useRef, useState } from 'react';

export default function MarqueeText({ children, className = '', as: Tag = 'span' }) {
  const viewportRef = useRef(null);
  const trackRef = useRef(null);
  const [vars, setVars] = useState(null);

  useEffect(() => {
    const viewport = viewportRef.current;
    const track = trackRef.current;
    if (!viewport || !track) return;

    const mq = window.matchMedia('(max-width: 1023px)');

    function measure() {
      if (!mq.matches) { setVars((v) => (v === null ? v : null)); return; }
      const overflow = track.scrollWidth - viewport.clientWidth;
      setVars((prev) => {
        if (overflow > 4) {
          const distance = Math.ceil((overflow + 12) / 8) * 8;
          const next = { '--marquee-shift': `-${distance}px`, '--marquee-duration': `${Math.min(14, Math.max(4, Math.round(distance / 35)))}s` };
          return prev && prev['--marquee-shift'] === next['--marquee-shift'] ? prev : next;
        }
        return overflow < -16 ? null : prev;
      });
    }

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(viewport);
    ro.observe(track);
    mq.addEventListener('change', measure);
    return () => {
      ro.disconnect();
      mq.removeEventListener('change', measure);
    };
  }, []);

  return (
    <Tag ref={viewportRef} className={`marquee-viewport ${className}`}>
      <span
        ref={trackRef}
        className={`marquee-track ${vars ? 'is-animating' : ''}`}
        style={vars || undefined}
      >
        {children}
      </span>
    </Tag>
  );
}

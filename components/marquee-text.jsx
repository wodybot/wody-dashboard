'use client';

import { useEffect, useRef, useState } from 'react';

// Phone-only "radio ticker" for a title that's too long for its box: the
// text slides left just far enough to reveal the cut-off end, pauses, then
// slides back, so nothing is permanently hidden behind an ellipsis. On
// desktop/tablet (and whenever the text already fits) it renders as plain
// static text, matching the rest of the dashboard's lg breakpoint for
// "mobile" behavior.
export default function MarqueeText({ children, className = '', as: Tag = 'span' }) {
  const viewportRef = useRef(null);
  const trackRef = useRef(null);
  const [vars, setVars] = useState(null); // null = static (fits, or not on a phone)

  useEffect(() => {
    const viewport = viewportRef.current;
    const track = trackRef.current;
    if (!viewport || !track) return;

    const mq = window.matchMedia('(max-width: 1023px)');

    // The text can change width every second (a countdown). Without care the slide would restart or jump each time:
    // the distance is rounded to 8 px steps, an animation that is running only stops once the text clearly fits,
    // and the state is only touched when something really changed.
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

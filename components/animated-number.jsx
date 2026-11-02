// FILE: animated-number.jsx
// PUNE ÎN: components/animated-number.jsx
// (fișier nou în proiectul wody-dashboard-main la această cale)

'use client';
import { useEffect, useRef, useState } from 'react';

// Counts up from 0 (or from the previous value, on updates) to `value`
// over `duration` ms, using requestAnimationFrame with an ease-out curve
// so it starts fast and settles gently rather than a flat linear tick.
// Pure CSS/number tween, no dependency, this is a stat display, not
// something that needs a physics-accurate odometer roll.
//
// Only starts once the number is actually on screen (IntersectionObserver),
// so a counter further down the page doesn't burn its animation before the
// visitor ever scrolls to it. Respects prefers-reduced-motion, jumping
// straight to the final value for anyone who's asked for less motion.
//
// format: optional formatter for the animated integer, defaults to
// toLocaleString() (thousands separators). Pass a function to prefix/
// suffix it (e.g. v => `+${v}`), the component only ever animates the
// bare number, formatting is applied to the in-progress value on every
// frame so a "+" prefix or similar stays attached throughout the count.
export default function AnimatedNumber({ value, duration = 1800, format, className = '' }) {
  const [display, setDisplay] = useState(0);
  const ref = useRef(null);
  const startedRef = useRef(false);
  const fromRef = useRef(0);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const prefersReduced = typeof window !== 'undefined'
      && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    const run = () => {
      const target = Number(value) || 0;
      if (prefersReduced) {
        setDisplay(target);
        fromRef.current = target;
        return;
      }
      const from = fromRef.current;
      const start = performance.now();
      const tick = (now) => {
        const t = Math.min(1, (now - start) / duration);
        // easeOutQuad: gentler than the previous cubic curve (which spent
        // most of the animation racing through the count and only slowed
        // down right at the very end, reading as abrupt even at a longer
        // duration), still decelerates into the final number rather than
        // stopping on a dime.
        const eased = 1 - (1 - t) * (1 - t);
        const current = Math.round(from + (target - from) * eased);
        setDisplay(current);
        if (t < 1) requestAnimationFrame(tick);
        else fromRef.current = target;
      };
      requestAnimationFrame(tick);
    };

    if (startedRef.current) {
      // Already visible once before: value updates (e.g. a live-refreshed
      // stat) animate immediately, no need to wait on the observer again.
      run();
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) {
        startedRef.current = true;
        run();
        observer.disconnect();
      }
    }, { threshold: 0.4 });
    observer.observe(node);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const shown = format ? format(display) : display.toLocaleString();
  return <span ref={ref} className={className}>{shown}</span>;
}

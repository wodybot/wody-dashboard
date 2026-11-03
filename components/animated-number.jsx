
'use client';
import { useEffect, useRef, useState } from 'react';

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
        const eased = 1 - (1 - t) * (1 - t);
        const current = Math.round(from + (target - from) * eased);
        setDisplay(current);
        if (t < 1) requestAnimationFrame(tick);
        else fromRef.current = target;
      };
      requestAnimationFrame(tick);
    };

    if (startedRef.current) {
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

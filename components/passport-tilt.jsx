'use client';
import { useRef } from 'react';

export function PassportTilt({ children }) {
  const ref = useRef(null);
  function move(e) {
    const el = ref.current;
    if (!el || e.pointerType === 'touch') return;
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `perspective(900px) rotateY(${(x * 8).toFixed(2)}deg) rotateX(${(-y * 8).toFixed(2)}deg) scale(1.01)`;
  }
  function leave() {
    if (ref.current) ref.current.style.transform = '';
  }
  return (
    <div ref={ref} onPointerMove={move} onPointerLeave={leave} className="relative transition-transform duration-200 ease-out will-change-transform">
      {children}
    </div>
  );
}

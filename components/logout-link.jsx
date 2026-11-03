'use client';

import { useEffect, useRef, useState } from 'react';
import { Tip } from '@/components/tip';

export function LogoutLink({ href = '/api/auth/logout', label, confirmLabel, className = '', inline = false, children }) {
  const [armed, setArmed] = useState(false);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  const armedAt = useRef(0);
  const onClick = async (event) => {
    event.preventDefault();
    let touch = true;
    try { touch = !window.matchMedia('(hover: hover) and (pointer: fine)').matches; } catch { }
    if (touch && !armed) {
      setArmed(true);
      armedAt.current = Date.now();
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setArmed(false), 3500);
      return;
    }
    if (touch && Date.now() - armedAt.current < 700) return;
    try {
      const res = await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      if (res.ok) { window.location.assign('/'); return; }
    } catch { }
    window.location.assign(href);
  };
  const link = (
    <a
      href={href}
      onClick={onClick}
      aria-label={armed ? confirmLabel : label}
      className={`${className} relative ${armed ? '!border-red-500/70 !bg-red-500/20 text-red-200' : ''}`}
    >
      {typeof children === 'function' ? children({ armed }) : children}
      {!inline && armed && (
        <span role="status" className="pointer-events-none absolute right-0 top-full z-50 mt-2 whitespace-nowrap rounded-md border border-red-500/50 bg-red-950/95 px-2.5 py-1 text-xs font-medium text-red-100 shadow-lg">{confirmLabel}</span>
      )}
    </a>
  );
  return inline ? link : <Tip label={armed ? confirmLabel : label}>{link}</Tip>;
}

'use client';

import { useEffect, useRef, useState } from 'react';
import { Tip } from '@/components/tip';

// On a touch screen, sign out needs a second, deliberate tap. The sign out button
// sits right next to Home and Refresh on small screens, and one stray tap used to
// end the session. The first tap only arms the button (it turns red and says
// "click again"), the second tap within a few seconds signs out. With a mouse
// (a computer) one click signs out at once. Nothing about the session or its
// cookie is touched here.
export function LogoutLink({ href = '/api/auth/logout', label, confirmLabel, className = '', inline = false, children }) {
  const [armed, setArmed] = useState(false);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  const armedAt = useRef(0);
  const onClick = async (event) => {
    event.preventDefault();
    // A mouse and a hover-capable pointer means a computer: no second click needed.
    let touch = true;
    try { touch = !window.matchMedia('(hover: hover) and (pointer: fine)').matches; } catch { /* keep the safe default */ }
    if (touch && !armed) {
      setArmed(true);
      armedAt.current = Date.now();
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setArmed(false), 3500);
      return;
    }
    // A quick double tap is one clumsy tap, not a decision: the second tap must come a moment later.
    if (touch && Date.now() - armedAt.current < 700) return;
    // Signing out is a POST, so nothing that only loads a page (prefetch, preview) can ever end a session.
    try {
      const res = await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      if (res.ok) { window.location.assign('/'); return; }
    } catch { /* fall through to the normal link */ }
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
  // A computer shows the hover bubble; the in-menu row (inline) already shows its own text.
  return inline ? link : <Tip label={armed ? confirmLabel : label}>{link}</Tip>;
}

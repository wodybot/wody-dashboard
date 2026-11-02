'use client';
import { useEffect, useState } from 'react';

// The user as the server saw them, double checked once in the browser when the server said "signed out".
// A cached page or a short server hiccup can then never leave a signed in person looking at login buttons.
// Every component on the page shares ONE request (many module cards use this hook at the same time).
let inflight = null;
let lastAt = 0;
function checkOnce(force) {
  if (!force && inflight && Date.now() - lastAt < 4000) return inflight;
  lastAt = Date.now();
  inflight = fetch('/api/auth/me', { cache: 'no-store' })
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => d?.user || null)
    .catch(() => null);
  return inflight;
}

export function useSessionUser(serverUser) {
  const [fetched, setFetched] = useState(null);
  const needsCheck = !serverUser;
  useEffect(() => {
    if (!needsCheck) return undefined;
    let cancelled = false;
    const run = (force) => checkOnce(force).then((u) => { if (!cancelled) setFetched(u); });
    run(false);
    // Coming back to a page kept by the browser (back button, app switcher): ask again.
    const onShow = (e) => { if (e.persisted) run(true); };
    window.addEventListener('pageshow', onShow);
    return () => { cancelled = true; window.removeEventListener('pageshow', onShow); };
  }, [needsCheck]);
  return serverUser || fetched;
}

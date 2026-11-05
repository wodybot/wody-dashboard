'use client';
import { useEffect, useState } from 'react';

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
    const onShow = (e) => { if (e.persisted) run(true); };
    window.addEventListener('pageshow', onShow);
    return () => { cancelled = true; window.removeEventListener('pageshow', onShow); };
  }, [needsCheck]);
  return serverUser || fetched;
}

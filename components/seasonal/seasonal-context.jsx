// FILE: seasonal-context.jsx
// PUNE ÎN: components/seasonal/seasonal-context.jsx
// (fișier nou în proiectul wody-dashboard-main la această cale)

'use client';
import { createContext, useContext, useEffect, useState } from 'react';

// Same pattern as components/autumn/autumn-context.jsx (see that file's
// own comment for the full "why" on the dynamic import() approach): this
// is the ONLY thing statically imported into the root layout, it's tiny
// (a context, a fetch, an effect, no SVGs, no animation CSS), and it
// performs the one real runtime-conditional load, only dynamically
// importing the actual decorative layer once the config says enabled:
// true. That keeps the heavier chunk (SVG assets + animation CSS module)
// out of every page load when the feature is off, since a server-side
// "if" alone doesn't stop Next.js from still shipping a statically
// imported client chunk.
const SeasonConfigContext = createContext(null);

let inFlight = null;
async function fetchSeasonConfig() {
  if (inFlight) return inFlight;
  // no-store: the server route already sends Cache-Control: no-store
  // (see app/api/[[...path]]/route.js), pinned here too so this call
  // never starts reusing a stale browser-cached response if that header
  // ever changes. The real caching (so this doesn't hit Mongo on every
  // request) already happens server-side.
  inFlight = fetch('/api/site/season-effects', { cache: 'no-store' })
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null)
    .finally(() => { inFlight = null; });
  return inFlight;
}

export function SeasonConfigProvider({ children }) {
  // null = "not resolved yet" / "disabled", every consumer treats both
  // identically (render nothing), so there's no OFF-vs-loading flash of
  // decorative content either way.
  const [config, setConfig] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetchSeasonConfig().then((cfg) => {
      if (!cancelled && cfg?.enabled) setConfig(cfg);
    });
    return () => { cancelled = true; };
  }, []);

  return (
    <SeasonConfigContext.Provider value={config}>
      {children}
    </SeasonConfigContext.Provider>
  );
}

// Returns the sanitized config object ({ enabled, season, effects,
// density, intensity }) once resolved and enabled, or null before that /
// when off.
export function useSeasonConfig() {
  return useContext(SeasonConfigContext);
}

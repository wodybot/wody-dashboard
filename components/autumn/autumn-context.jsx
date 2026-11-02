'use client';
import { createContext, useContext, useEffect, useState } from 'react';

// Config now lives ENTIRELY on the client side of this provider, the
// server root layout no longer imports/renders anything Autumn-specific
// at all, which was the actual mistake in the first pass: a server
// component conditionally not rendering a client component does NOT stop
// Next.js from registering that client component's chunk against the
// route (webpack's client-reference-manifest is built from the static
// module graph, not from which runtime branch executes), so the chunk's
// <script> tag still shipped on every single page load, Autumn on or off.
//
// This component is the ONLY thing statically imported into the root
// layout. It is tiny (a context, a fetch, an effect, no SVGs, no
// animation CSS) and it performs the one real runtime-conditional load:
// it fetches the tiny public config JSON, and only when that response
// says enabled: true does it dynamically import() the actual decorative
// layer. That import() call is executed conditionally in the browser at
// runtime, which is what actually prevents the network request for the
// heavier chunk when the feature is off, unlike a server-side "if".
const AutumnConfigContext = createContext(null);

let inFlight = null;
async function fetchAutumnConfig() {
  if (inFlight) return inFlight;
  // no-store: the server route already sends Cache-Control: no-store (see
  // app/api/[[...path]]/route.js), but pin it here too so this call never
  // silently starts reusing a stale browser-cached response again if that
  // header ever changes. The real caching (so this doesn't hit Mongo on
  // every request) already happens server-side.
  inFlight = fetch('/api/site/autumn', { cache: 'no-store' })
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null)
    .finally(() => { inFlight = null; });
  return inFlight;
}

export function AutumnConfigProvider({ children }) {
  // null = "not resolved yet" / "disabled", every consumer treats both
  // identically (render nothing), so there is no OFF-vs-loading flash of
  // decorative content either way.
  const [config, setConfig] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetchAutumnConfig().then((cfg) => {
      if (!cancelled && cfg?.enabled) setConfig(cfg);
    });
    return () => { cancelled = true; };
  }, []);

  return (
    <AutumnConfigContext.Provider value={config}>
      {children}
    </AutumnConfigContext.Provider>
  );
}

// Returns the sanitized config object ({ enabled, effects, density,
// intensity }) once resolved and enabled, or null before that / when off.
export function useAutumnConfig() {
  return useContext(AutumnConfigContext);
}

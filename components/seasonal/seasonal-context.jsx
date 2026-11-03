
'use client';
import { createContext, useContext, useEffect, useState } from 'react';

const SeasonConfigContext = createContext(null);

let inFlight = null;
async function fetchSeasonConfig() {
  if (inFlight) return inFlight;
  inFlight = fetch('/api/site/season-effects', { cache: 'no-store' })
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null)
    .finally(() => { inFlight = null; });
  return inFlight;
}

export function SeasonConfigProvider({ children }) {
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

export function useSeasonConfig() {
  return useContext(SeasonConfigContext);
}

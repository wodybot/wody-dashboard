'use client';
import { createContext, useContext, useEffect, useState } from 'react';

const AutumnConfigContext = createContext(null);

let inFlight = null;
async function fetchAutumnConfig() {
  if (inFlight) return inFlight;
  inFlight = fetch('/api/site/autumn', { cache: 'no-store' })
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null)
    .finally(() => { inFlight = null; });
  return inFlight;
}

export function AutumnConfigProvider({ children }) {
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

export function useAutumnConfig() {
  return useContext(AutumnConfigContext);
}

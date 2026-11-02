'use client';
// Browser helpers for the Collab API.
import { useCallback, useEffect, useRef, useState } from 'react';

export async function mfetch(path, { method = 'GET', body, form } = {}) {
  try {
    const res = await fetch(`/api/collab/${path}`, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: form || (body ? JSON.stringify(body) : undefined),
      cache: 'no-store',
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  } catch {
    return { ok: false, status: 0, data: { error: 'unreachable' } };
  }
}

export function useMApi(path, { enabled = true } = {}) {
  const [state, setState] = useState({ data: null, loading: enabled, error: null, status: 0 });
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const load = useCallback(async () => {
    if (!path) return null;
    setState((s) => ({ ...s, loading: true, error: null }));
    const r = await mfetch(path);
    if (!alive.current) return null;
    setState((s) => ({ data: r.ok ? r.data : s.data, loading: false, error: r.ok ? null : (r.data?.error || 'generic'), status: r.status }));
    return r.ok ? r.data : null;
  }, [path]);
  useEffect(() => { if (enabled) load(); }, [load, enabled]);
  return { ...state, reload: load };
}

export function catName(cat, locale) {
  if (!cat) return '';
  return cat.names?.[locale] || cat.names?.en || cat.slug;
}
export function fmtDate(iso, locale) {
  try { return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso)); } catch { return ''; }
}

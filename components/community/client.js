'use client';
import { useCallback, useEffect, useRef, useState } from 'react';

export const COMMUNITY_CHANGED = 'wody:community-changed';

export async function cfetch(path, { method = 'GET', body, form } = {}) {
  try {
    const res = await fetch(`/api/community/${path}`, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: form || (body ? JSON.stringify(body) : undefined),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && method !== 'GET' && !/notifications/.test(path) && typeof window !== 'undefined') {
      window.dispatchEvent(new Event(COMMUNITY_CHANGED));
    }
    return { ok: res.ok, status: res.status, data };
  } catch {
    return { ok: false, status: 0, data: { error: 'unreachable' } };
  }
}

export function useCApi(path, { enabled = true } = {}) {
  const [state, setState] = useState({ data: null, loading: enabled, error: null, status: 0 });
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const load = useCallback(async () => {
    if (!path) return null;
    setState((s) => ({ ...s, loading: true, error: null }));
    const r = await cfetch(path);
    if (!alive.current) return null;
    setState((s) => ({ data: r.ok ? r.data : s.data, loading: false, error: r.ok ? null : (r.data?.error || 'generic'), status: r.status }));
    return r.ok ? r.data : null;
  }, [path]);
  useEffect(() => { if (enabled) load(); }, [load, enabled]);
  const setData = useCallback((updater) => setState((s) => ({ ...s, data: typeof updater === 'function' ? updater(s.data) : updater })), []);
  return { ...state, reload: load, setData };
}

export const colorOf = (v, fallback = '#c46a2d') => (/^#[0-9a-fA-F]{6}$/.test(v || '') ? v : fallback);

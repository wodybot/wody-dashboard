// Browser helper for /api/themes. Errors come back as { error: code, field? } and are shown with the translated `themes.errors.<code>`.
export async function themeApi(path, { method = 'GET', body, form } = {}) {
  try {
    const res = await fetch(`/api/themes/${path}`, {
      method, credentials: 'same-origin',
      ...(form ? { body: form } : body !== undefined ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, status: res.status, error: data.error || 'generic', field: data.field || null, issues: data.issues || null, data };
    return { ok: true, data };
  } catch {
    return { ok: false, status: 0, error: 'network', field: null };
  }
}

export function errorText(t, r) {
  const key = `errors.${r.error}`;
  const base = t.has(key) ? t(key) : t('errors.generic');
  return r.field ? `${base} (${r.field})` : base;
}

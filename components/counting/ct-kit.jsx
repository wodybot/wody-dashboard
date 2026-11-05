'use client';
// Building blocks shared by every Counting screen. Text comes from the "counting" message namespace.
import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { XCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Field, NativeSelect, SwitchRow } from '@/components/module-kit';
import { get, set, parseInts, parseIds } from '@/lib/counting/schema';

/** Calls /api/counting/<path>. Never throws: { ok, status, data }. */
export async function ct(path, { method = 'GET', body } = {}) {
  try {
    const res = await fetch(`/api/counting/${path}`, {
      method, headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  } catch {
    return { ok: false, status: 0, data: { error: 'unreachable' } };
  }
}

/** Loads a path once and again on demand. */
export function useCt(path, deps = []) {
  const [state, setState] = useState({ loading: true, data: null, error: null });
  const load = useCallback(async () => {
    if (!path) return;
    setState((s) => ({ ...s, loading: true }));
    const r = await ct(path);
    setState({ loading: false, data: r.ok ? r.data : null, error: r.ok ? null : (r.data?.error || 'generic') });
  }, [path]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load, ...deps]); // eslint-disable-line react-hooks/exhaustive-deps
  return { ...state, reload: load };
}

/** Text for a field problem ({ code, params }) or an API error code. */
export function useCtText() {
  const t = useTranslations('counting');
  const field = useCallback((e) => {
    if (!e) return '';
    return t.has(`errors.${e.code}`) ? t(`errors.${e.code}`, e.params || {}) : t('errors.invalid');
  }, [t]);
  const api = useCallback((code) => (t.has(`apiErrors.${code}`) ? t(`apiErrors.${code}`) : t('apiErrors.generic')), [t]);
  return { field, api };
}

export const pathErrors = (errors, path) => (errors || []).filter((e) => e.field === path || e.field.startsWith(`${path}.`));

export function Problems({ errors, path }) {
  const { field } = useCtText();
  const list = pathErrors(errors, path);
  if (!list.length) return null;
  return (
    <div role="alert" className="mt-1.5 space-y-0.5">
      {list.map((e, i) => <p key={i} className="flex items-start gap-1.5 text-xs text-red-400"><XCircle className="mt-px h-3.5 w-3.5 shrink-0" />{field(e)}</p>)}
    </div>
  );
}

export function F({ errors, path, children, ...rest }) {
  return <Field {...rest}>{children}{path ? <Problems errors={errors} path={path} /> : null}</Field>;
}

export function NumberInput({ label, hint, value, onChange, min, max, errors, path, allowEmpty = false, decimal = false }) {
  return (
    <F label={label} hint={hint} errors={errors} path={path}>
      <Input
        type="number" inputMode={decimal ? 'decimal' : 'numeric'} value={value ?? ''} min={min} max={max} step={decimal ? 'any' : 1}
        onChange={(e) => { const v = e.target.value; onChange(v === '' ? (allowEmpty ? null : '') : Number(v)); }}
        aria-invalid={pathErrors(errors, path).length > 0}
      />
    </F>
  );
}

export function TextInput({ label, hint, value, onChange, max, errors, path, placeholder, multiline = false, rows = 3, mono = false }) {
  return (
    <F label={label} hint={hint} errors={errors} path={path}>
      {multiline ? (
        <textarea
          value={value ?? ''} maxLength={max} rows={rows} placeholder={placeholder} onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      ) : (
        <Input value={value ?? ''} maxLength={max} placeholder={placeholder} className={mono ? 'font-mono' : ''} onChange={(e) => onChange(e.target.value)} aria-invalid={pathErrors(errors, path).length > 0} />
      )}
    </F>
  );
}

export function SelectInput({ label, hint, value, onChange, options, errors, path }) {
  return (
    <F label={label} hint={hint} errors={errors} path={path}>
      <NativeSelect value={value ?? ''} onChange={onChange} options={options} label={label} />
    </F>
  );
}

export function DateInput({ label, value, onChange, errors, path }) {
  const local = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
  };
  return (
    <F label={label} errors={errors} path={path}>
      <Input type="datetime-local" value={local(value)} onChange={(e) => onChange(e.target.value ? new Date(e.target.value).toISOString() : null)} />
    </F>
  );
}

/**
 * One field of the settings form, drawn from the schema. `cfg` is the whole settings object, `section` the section id.
 * Empty ids and empty numbers are sent as null so the bot applies its own default.
 */
export function ConfigField({ section, spec, cfg, onChange, errors }) {
  const t = useTranslations('counting.cfg');
  const opt = useTranslations('counting.cfgOptions');
  const path = `${section}.${spec.key}`;
  const label = t(path);
  const hint = t.has(`${path}_hint`) ? t(`${path}_hint`) : undefined;
  const value = get(cfg, path);
  const put = (v) => onChange(set(cfg, path, v));
  const bad = pathErrors(errors, path);
  if (spec.kind === 'bool') {
    return <div><SwitchRow label={label} hint={hint} checked={value === true} onChange={put} /><Problems errors={errors} path={path} /></div>;
  }
  if (spec.kind === 'int') return <NumberInput label={label} hint={hint} value={value} min={spec.min} max={spec.max} onChange={put} errors={errors} path={path} />;
  if (spec.kind === 'number') return <NumberInput label={label} hint={hint} value={value} onChange={put} errors={errors} path={path} allowEmpty decimal />;
  if (spec.kind === 'choice') {
    const options = spec.options.map((o) => ({ value: o, label: opt.has(`${path}.${o || 'none'}`) ? opt(`${path}.${o || 'none'}`) : (opt.has(`value.${o || 'none'}`) ? opt(`value.${o || 'none'}`) : o) }));
    return <SelectInput label={label} hint={hint} value={value ?? ''} options={options} onChange={put} errors={errors} path={path} />;
  }
  if (spec.kind === 'ints') {
    return <TextInput label={label} hint={hint ?? t('listHint')} value={(value || []).join(', ')} onChange={(v) => put(parseInts(v))} errors={errors} path={path} mono />;
  }
  if (spec.kind === 'ids') {
    return <TextInput label={label} hint={hint ?? t('idsHint')} value={(value || []).join(', ')} onChange={(v) => put(parseIds(v))} errors={errors} path={path} mono />;
  }
  if (spec.kind === 'id') {
    return <TextInput label={label} hint={hint ?? t('idHint')} value={value ?? ''} onChange={(v) => put(v.replace(/\D/g, '').slice(0, 21) || null)} errors={errors} path={path} mono />;
  }
  return <TextInput label={label} hint={hint} value={value ?? ''} max={spec.max} onChange={put} errors={errors} path={path} aria-invalid={bad.length > 0} />;
}

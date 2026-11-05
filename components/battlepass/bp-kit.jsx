'use client';
// Small building blocks shared by every Battle Pass editor tab. Text comes from the "battlepass" message namespace.
import { useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { XCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Field, NativeSelect } from '@/components/module-kit';

/** Calls /api/battlepass/<path>. Never throws: { ok, status, data }. */
export async function bp(path, { method = 'GET', body } = {}) {
  const once = async () => {
    try {
      const res = await fetch(`/api/battlepass/${path}`, {
        method, headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json().catch(() => ({}));
      return { ok: res.ok, status: res.status, data };
    } catch {
      return { ok: false, status: 0, data: { error: 'unreachable' } };
    }
  };
  const first = await once();
  // Discord or the database can be busy for a moment: reads are tried once more before an error is shown
  if (method === 'GET' && (first.status === 503 || first.status === 500 || first.status === 0)) {
    await new Promise((r) => setTimeout(r, 1200));
    return once();
  }
  return first;
}

/** Text for an API error code or a field error ({ code, params }). Unknown codes fall back to a generic sentence. */
export function useBpText() {
  const t = useTranslations('battlepass');
  const kit = useTranslations('guildSettings.kit');
  const field = useCallback((e) => {
    if (!e) return '';
    if (t.has(`errors.${e.code}`)) return t(`errors.${e.code}`, e.params || {});
    if (kit.has(`errors.${e.code}`)) return kit(`errors.${e.code}`, e.params || {});
    return t('errors.invalid');
  }, [t, kit]);
  const api = useCallback((code, reason) => {
    if (code === 'activation_refused' && reason && t.has(`reasons.${reason}`)) return t(`reasons.${reason}`);
    return t.has(`apiErrors.${code}`) ? t(`apiErrors.${code}`) : t('apiErrors.generic');
  }, [t]);
  return { field, api };
}

export const pathErrors = (errors, path) => (errors || []).filter((e) => e.field === path || e.field.startsWith(`${path}.`));

export function Problems({ errors, path }) {
  const { field } = useBpText();
  const list = pathErrors(errors, path);
  if (!list.length) return null;
  return (
    <div role="alert" className="mt-1.5 space-y-0.5">
      {list.map((e, i) => <p key={i} className="flex items-start gap-1.5 text-xs text-red-400"><XCircle className="mt-px h-3.5 w-3.5 shrink-0" />{field(e)}</p>)}
    </div>
  );
}

export function NumberField({ label, hint, value, onChange, min, max, step = 1, errors, path, suffix, recommended }) {
  return (
    <Field label={label} hint={hint} errors={errors} field={path} recommended={recommended}>
      <div className="flex items-center gap-2">
        <Input
          type="number" inputMode="decimal" value={value ?? ''} min={min} max={max} step={step}
          onChange={(e) => { const v = e.target.value; onChange(v === '' ? '' : Number(v)); }}
          aria-invalid={pathErrors(errors, path).length > 0}
        />
        {suffix ? <span className="shrink-0 text-xs text-muted-foreground">{suffix}</span> : null}
      </div>
    </Field>
  );
}

export function TextField({ label, hint, value, onChange, max, errors, path, placeholder, multiline = false, rows = 3 }) {
  return (
    <Field label={label} hint={hint} errors={errors} field={path}>
      {multiline ? (
        <textarea
          value={value ?? ''} maxLength={max} rows={rows} placeholder={placeholder} onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      ) : (
        <Input value={value ?? ''} maxLength={max} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} aria-invalid={pathErrors(errors, path).length > 0} />
      )}
    </Field>
  );
}

export function SelectField({ label, hint, value, onChange, options, errors, path, translate }) {
  const items = options.map((o) => (typeof o === 'string' ? { value: o, label: translate ? translate(o) : o } : o));
  return (
    <Field label={label} hint={hint} errors={errors} field={path}>
      <NativeSelect value={value} onChange={onChange} options={items} label={label} />
    </Field>
  );
}

/** ISO string <-> the value of a datetime-local input (shown in the browser's own time zone). */
const toLocal = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};
export function DateField({ label, hint, value, onChange, errors, path }) {
  return (
    <Field label={label} hint={hint} errors={errors} field={path}>
      <Input type="datetime-local" value={toLocal(value)} onChange={(e) => onChange(e.target.value ? new Date(e.target.value).toISOString() : null)} />
    </Field>
  );
}

export function ColorInput({ label, value, onChange, errors, path }) {
  return (
    <Field label={label} errors={errors} field={path}>
      <div className="flex items-center gap-2">
        <input type="color" value={/^#[0-9a-f]{6}$/i.test(value || '') ? value : '#000000'} onChange={(e) => onChange(e.target.value)} aria-label={label} className="h-10 w-12 cursor-pointer rounded-md border border-input bg-background p-1" />
        <Input value={value ?? ''} onChange={(e) => onChange(e.target.value)} maxLength={7} className="font-mono" />
      </div>
    </Field>
  );
}

export const RARITY_TONE = {
  common: 'border-zinc-400/40 text-zinc-300', uncommon: 'border-emerald-400/50 text-emerald-300', rare: 'border-sky-400/50 text-sky-300',
  epic: 'border-violet-400/50 text-violet-300', legendary: 'border-amber-400/60 text-amber-300', mythic: 'border-rose-400/60 text-rose-300',
  limited: 'border-fuchsia-400/60 text-fuchsia-300',
};
export function RarityBadge({ rarity }) {
  const t = useTranslations('battlepass');
  return <span className={`inline-flex items-center rounded-full border px-2 py-px text-[10px] font-semibold uppercase tracking-wide ${RARITY_TONE[rarity] || RARITY_TONE.common}`}>{t(`rarity.${rarity}`)}</span>;
}

/** Immutable update at a dotted path: set(obj, 'xp.message.xp', 12). */
export function setPath(obj, path, value) {
  const keys = path.split('.');
  const next = Array.isArray(obj) ? [...obj] : { ...obj };
  let cur = next;
  keys.forEach((k, i) => {
    if (i === keys.length - 1) { cur[k] = value; return; }
    const child = cur[k];
    cur[k] = Array.isArray(child) ? [...child] : { ...(child || {}) };
    cur = cur[k];
  });
  return next;
}
export const getPath = (obj, path) => path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);

export function RangeField({ label, hint, value, onChange, min, max, step = 1, suffix = '' }) {
  return (
    <Field label={label} hint={hint}>
      <div className="flex items-center gap-3">
        <input type="range" min={min} max={max} step={step} value={value ?? min} onChange={(e) => onChange(Number(e.target.value))} aria-label={label} className="h-2 w-full cursor-pointer accent-[#e6cd8c]" />
        <span className="w-16 shrink-0 text-right text-xs tabular-nums text-muted-foreground">{value ?? min}{suffix}</span>
      </div>
    </Field>
  );
}

'use client';
// Small form controls shared by the server and Owner theme panels. Only fixed choices and bounded numbers; no free-form code fields.
export const clone = (v) => JSON.parse(JSON.stringify(v));
export const HEX = /^#[0-9a-fA-F]{6}$/;

export function Card({ title, hint, children }) {
  return (
    <section className="rounded-2xl border border-border bg-card/60 p-4">
      <h3 className="text-base font-semibold">{title}</h3>
      {hint ? <p className="mt-1 text-sm text-muted-foreground">{hint}</p> : null}
      <div className="mt-3 grid gap-3">{children}</div>
    </section>
  );
}
export function Row({ label, children, id }) {
  return <div className="flex flex-wrap items-center justify-between gap-2"><label htmlFor={id} className="text-sm">{label}</label><div className="flex items-center gap-2">{children}</div></div>;
}
export function Color({ id, label, value, fallback, onChange, onClear, t }) {
  const shown = HEX.test(value || '') ? value : fallback;
  return (
    <Row label={label} id={id}>
      <input id={id} type="color" value={HEX.test(shown || '') ? shown : '#000000'} onChange={(e) => onChange(e.target.value)} className="h-9 w-12 cursor-pointer rounded border border-border bg-transparent" />
      <code className="w-20 text-xs">{shown}</code>
      {value ? <button type="button" onClick={onClear} className="min-h-9 rounded-lg border border-border px-2 text-xs">{t('common.useDefault')}</button> : null}
    </Row>
  );
}
export function Range({ id, label, value, min, max, onChange, suffix = '%' }) {
  return <Row label={label} id={id}><input id={id} type="range" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-40 accent-[var(--wt-primary,currentColor)]" /><span className="w-12 text-right text-sm tabular-nums">{value}{suffix}</span></Row>;
}
export function Select({ id, label, value, options, onChange, t, group }) {
  return <Row label={label} id={id}><select id={id} value={value} onChange={(e) => onChange(e.target.value)} className="min-h-9 rounded-lg border border-border bg-background px-2 text-sm">{options.map((o) => <option key={o} value={o}>{o === '' ? t('common.themeDefault') : t(`${group}.${o}`)}</option>)}</select></Row>;
}
export function Toggle({ id, label, value, onChange }) {
  return <Row label={label} id={id}><input id={id} type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} className="h-5 w-5" /></Row>;
}


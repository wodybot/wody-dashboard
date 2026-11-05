'use client';
// Dashboard > Premium > Battle Pass > Delivery form. The owner defines the fields members fill in (for example an in-game
// nickname) and works through the entries: delivers the benefit by hand, then marks the entry as delivered.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ArrowDown, ArrowUp, Check, Plus, RotateCcw, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ConfirmDialog, Field, NativeSelect, SwitchRow, SaveFooter, formatDate } from '@/components/module-kit';
import { bp, useBpText, pathErrors, Problems } from './bp-kit';

// Field with this feature's own error texts (battlepass.errors) instead of the generic kit texts.
function F({ errors, field, children, ...rest }) {
  return <Field {...rest}>{children}{field ? <Problems errors={errors} path={field} /> : null}</Field>;
}

const TYPES = ['text', 'textarea', 'number', 'select', 'checkbox'];
const MAX_FIELDS = 10;

const newField = (n) => ({ id: `field_${n}`, label: '', type: 'text', required: false, placeholder: '', max: 0, options: [] });

function FieldEditor({ f, index, last, errors, onChange, onMove, onRemove }) {
  const t = useTranslations('battlepass.forms.builder');
  const types = useTranslations('battlepass.forms.type');
  const act = useTranslations('battlepass.actions');
  const at = `fields.${index + 1}`;
  const set = (patch) => onChange({ ...f, ...patch });
  return (
    <Card className="space-y-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold">#{index + 1}</span>
        <div className="flex gap-1">
          <Button type="button" variant="ghost" size="icon" disabled={index === 0} onClick={() => onMove(-1)} aria-label={act('moveUp')}><ArrowUp className="h-4 w-4" /></Button>
          <Button type="button" variant="ghost" size="icon" disabled={last} onClick={() => onMove(1)} aria-label={act('moveDown')}><ArrowDown className="h-4 w-4" /></Button>
          <Button type="button" variant="ghost" size="icon" onClick={onRemove} aria-label={act('remove')}><Trash2 className="h-4 w-4" /></Button>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <F label={t('fieldLabel')} errors={errors} field={`${at}.label`}>
          <Input value={f.label} maxLength={60} onChange={(e) => set({ label: e.target.value })} aria-invalid={pathErrors(errors, `${at}.label`).length > 0} />
        </F>
        <F label={t('type')} errors={errors} field={`${at}.type`}>
          <NativeSelect value={f.type} label={t('type')} onChange={(v) => set({ type: v })} options={TYPES.map((x) => ({ value: x, label: types(x) }))} />
        </F>
        <F label={t('fieldId')} hint={t('fieldIdHint')} errors={errors} field={`${at}.id`}>
          <Input value={f.id} maxLength={24} className="font-mono" onChange={(e) => set({ id: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })} aria-invalid={pathErrors(errors, `${at}.id`).length > 0} />
        </F>
        {f.type === 'text' || f.type === 'textarea' || f.type === 'select' || f.type === 'number' ? (
          <F label={t('placeholder')} errors={errors} field={`${at}.placeholder`}>
            <Input value={f.placeholder} maxLength={80} onChange={(e) => set({ placeholder: e.target.value })} />
          </F>
        ) : null}
        {f.type === 'text' || f.type === 'textarea' ? (
          <F label={t('max')} errors={errors} field={`${at}.max`}>
            <Input type="number" min={1} max={f.type === 'text' ? 120 : 800} value={f.max || ''} onChange={(e) => set({ max: e.target.value === '' ? 0 : Number(e.target.value) })} />
          </F>
        ) : null}
      </div>
      {f.type === 'select' ? (
        <F label={t('options')} hint={t('optionsHint')} errors={errors} field={`${at}.options`}>
          <textarea
            rows={4} value={(f.options || []).join('\n')}
            onChange={(e) => set({ options: e.target.value.split('\n').slice(0, 20) })}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </F>
      ) : null}
      <SwitchRow label={t('required')} checked={f.required} onChange={(v) => set({ required: v })} />
    </Card>
  );
}

function Builder({ guildId, premium }) {
  const t = useTranslations('battlepass.forms');
  const text = useBpText();
  const [form, setForm] = useState(null);
  const [saved, setSaved] = useState(null);
  const [errors, setErrors] = useState([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    const r = await bp(`guilds/${guildId}/form`);
    if (r.ok) { setForm(r.data.form); setSaved(JSON.stringify(r.data.form)); }
  }, [guildId]);
  useEffect(() => { load(); }, [load]);

  const dirty = form && JSON.stringify(form) !== saved;
  if (!form) return null;
  const patch = (p) => { setForm({ ...form, ...p }); setMessage(''); };
  const setField = (i, f) => patch({ fields: form.fields.map((x, k) => (k === i ? f : x)) });
  const move = (i, d) => { const a = [...form.fields]; [a[i], a[i + d]] = [a[i + d], a[i]]; patch({ fields: a }); };

  const save = async () => {
    setBusy(true); setErrors([]); setMessage('');
    const r = await bp(`guilds/${guildId}/form`, { method: 'PUT', body: form });
    setBusy(false);
    if (r.ok) { setForm(r.data.form); setSaved(JSON.stringify(r.data.form)); setMessage(t('builder.saved')); return; }
    if (r.data?.errors) setErrors(r.data.errors);
    setMessage(text.api(r.data?.error));
  };

  return (
    <Card className="space-y-4 p-5">
      <div>
        <h3 className="text-base font-semibold">{t('title')}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{t('intro')}</p>
      </div>
      {!premium ? <p role="status" className="rounded-md border border-amber-400/40 bg-amber-500/10 p-3 text-sm">{t('premiumOnly')}</p> : null}
      <SwitchRow label={t('builder.enabled')} hint={t('builder.enabledHint')} checked={form.enabled} onChange={(v) => patch({ enabled: v })} />
      <div className="grid gap-3 sm:grid-cols-2">
        <F label={t('builder.formTitle')} errors={errors} field="title"><Input value={form.title} maxLength={80} onChange={(e) => patch({ title: e.target.value })} /></F>
        <F label={t('builder.successText')} errors={errors} field="success_text"><Input value={form.success_text} maxLength={200} onChange={(e) => patch({ success_text: e.target.value })} /></F>
      </div>
      <F label={t('builder.formIntro')} errors={errors} field="intro">
        <textarea rows={3} maxLength={400} value={form.intro} onChange={(e) => patch({ intro: e.target.value })}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
      </F>
      <div className="space-y-3">
        <h4 className="text-sm font-semibold">{t('builder.fields')} ({form.fields.length}/{MAX_FIELDS})</h4>
        <Problems errors={errors} path="fields" />
        {form.fields.map((f, i) => (
          <FieldEditor key={i} f={f} index={i} last={i === form.fields.length - 1} errors={errors}
            onChange={(nf) => setField(i, nf)} onMove={(d) => move(i, d)} onRemove={() => patch({ fields: form.fields.filter((_, k) => k !== i) })} />
        ))}
        <Button type="button" variant="outline" disabled={form.fields.length >= MAX_FIELDS} onClick={() => patch({ fields: [...form.fields, newField(form.fields.length + 1)] })}>
          <Plus className="mr-1.5 h-4 w-4" />{t('builder.add')}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">{t('builder.privacy')}</p>
      <span role="status" aria-live="polite" className="text-sm text-muted-foreground">{message}</span>
      <SaveFooter dirty={Boolean(dirty)} saving={busy} disabled={!premium} onSave={save} onDiscard={() => { setForm(JSON.parse(saved)); setErrors([]); setMessage(''); }} />
    </Card>
  );
}

function Answers({ form, answers }) {
  const t = useTranslations('battlepass.forms.queue');
  return (
    <dl className="space-y-1 text-sm">
      {(form?.fields || []).map((f) => {
        const v = answers?.[f.id];
        const shown = f.type === 'checkbox' ? (v ? t('yes') : t('no')) : (v === null || v === undefined || v === '' ? '-' : String(v));
        return <div key={f.id}><dt className="text-xs text-muted-foreground">{f.label}</dt><dd className="whitespace-pre-wrap break-words">{shown}</dd></div>;
      })}
    </dl>
  );
}

function Queue({ guildId, premium }) {
  const t = useTranslations('battlepass.forms');
  const locale = useLocale();
  const text = useBpText();
  const [status, setStatus] = useState('new');
  const [form, setForm] = useState(null);
  const [rows, setRows] = useState([]);
  const [counts, setCounts] = useState({});
  const [next, setNext] = useState(null);
  const [notes, setNotes] = useState({});
  const [toRemove, setToRemove] = useState(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState('');

  const load = useCallback(async (more = null) => {
    const q = new URLSearchParams({ status });
    if (more) q.set('before', more);
    const r = await bp(`guilds/${guildId}/submissions?${q}`);
    if (!r.ok) { setMessage(text.api(r.data?.error)); return; }
    setRows((old) => (more ? [...old, ...r.data.entries] : r.data.entries));
    setCounts(r.data.counts || {}); setNext(r.data.next);
  }, [guildId, status, text]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { bp(`guilds/${guildId}/form`).then((r) => { if (r.ok) setForm(r.data.form); }); }, [guildId]);

  const handle = async (row, to) => {
    setBusy(row.id); setMessage('');
    const r = await bp(`guilds/${guildId}/submissions/${row.id}`, { method: 'PATCH', body: { status: to, note: notes[row.id] ?? row.note ?? '' } });
    setBusy('');
    if (r.ok) { setMessage(t('queue.updated')); load(); } else setMessage(text.api(r.data?.error));
  };
  const remove = async () => {
    const row = toRemove; setToRemove(null);
    const r = await bp(`guilds/${guildId}/submissions/${row.id}`, { method: 'DELETE' });
    if (r.ok) { setMessage(t('queue.removed')); load(); } else setMessage(text.api(r.data?.error));
  };

  const tabs = ['new', 'delivered', 'rejected', 'all'];
  return (
    <Card className="space-y-4 p-5">
      <h3 className="text-base font-semibold">{t('queue.title')}</h3>
      <div role="tablist" className="flex flex-wrap gap-2">
        {tabs.map((s) => (
          <Button key={s} type="button" role="tab" aria-selected={status === s} size="sm" variant={status === s ? 'default' : 'outline'} onClick={() => setStatus(s)}>
            {s === 'all' ? t('queue.all') : t(`status.${s}`)}{s !== 'all' && counts[s] != null ? ` (${counts[s]})` : ''}
          </Button>
        ))}
      </div>
      <p role="status" aria-live="polite" className="min-h-5 text-sm text-muted-foreground">{message}</p>
      {rows.length === 0 ? <p className="text-sm text-muted-foreground">{t('queue.empty')}</p> : (
        <ul className="space-y-3">
          {rows.map((row) => (
            <li key={row.id}>
              <Card className="space-y-3 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span><b>{row.user_name || row.user_id}</b> <span className="text-muted-foreground">({row.user_id})</span></span>
                  <span className="text-xs text-muted-foreground">{t(`status.${row.status}`)} · {formatDate(row.created_at, locale)}</span>
                </div>
                <p className="text-xs text-muted-foreground">{t('queue.reward')}: {row.reward_name || t('queue.general')}</p>
                <Answers form={form} answers={row.answers} />
                <F label={t('queue.note')}>
                  <Input value={notes[row.id] ?? row.note ?? ''} maxLength={300} placeholder={t('queue.notePlaceholder')} onChange={(e) => setNotes({ ...notes, [row.id]: e.target.value })} />
                </F>
                <div className="flex flex-wrap gap-2">
                  {row.status !== 'delivered' ? <Button type="button" size="sm" disabled={busy === row.id || !premium} onClick={() => handle(row, 'delivered')}><Check className="mr-1.5 h-4 w-4" />{t('queue.deliver')}</Button> : null}
                  {row.status !== 'rejected' ? <Button type="button" size="sm" variant="outline" disabled={busy === row.id} onClick={() => handle(row, 'rejected')}><X className="mr-1.5 h-4 w-4" />{t('queue.reject')}</Button> : null}
                  {row.status !== 'new' ? <Button type="button" size="sm" variant="outline" disabled={busy === row.id} onClick={() => handle(row, 'new')}><RotateCcw className="mr-1.5 h-4 w-4" />{t('queue.reopen')}</Button> : null}
                  <Button type="button" size="sm" variant="ghost" onClick={() => setToRemove(row)}><Trash2 className="mr-1.5 h-4 w-4" />{t('queue.remove')}</Button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
      {next ? <Button type="button" variant="outline" onClick={() => load(next)}>{t('queue.loadMore')}</Button> : null}
      <ConfirmDialog open={Boolean(toRemove)} onOpenChange={(o) => { if (!o) setToRemove(null); }} title={t('queue.removeTitle')} description={t('queue.removeText')} confirmLabel={t('queue.remove')} onConfirm={remove} />
    </Card>
  );
}

export default function DeliveryFormPanel({ guildId, premium }) {
  return (
    <div className="space-y-5">
      <Builder guildId={guildId} premium={premium} />
      <Queue guildId={guildId} premium={premium} />
    </div>
  );
}

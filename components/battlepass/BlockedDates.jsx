'use client';
// Owner Panel > Battle Pass > Calendar: dates when no server can run its own Battle Pass. Server owners see them as "busy" on their
// calendar. Wody's own seasons are shown there too, because they block the same way.
import { useCallback, useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { CalendarX2, Loader2, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Section, LoadingOrError } from '@/components/module-kit';
import { bp, useBpText, DateField } from './bp-kit';
import BusyCalendar from './BusyCalendar';
import { busyRanges } from '@/lib/battlepass/schedule.js';

export default function BlockedDates({ readOnly = false }) {
  const t = useTranslations('battlepass');
  const text = useBpText();
  const locale = useLocale();
  const [s, setS] = useState({ loading: true, error: null, blocked: [], seasons: [], max: 60 });
  const [form, setForm] = useState({ starts_at: null, ends_at: null, reason: '' });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [b, g] = await Promise.all([bp('owner/blocked'), bp('owner/seasons')]);
    if (!b.ok) { setS((x) => ({ ...x, loading: false, error: text.api(b.data?.error) })); return; }
    setS({ loading: false, error: null, blocked: b.data.blocked, seasons: g.ok ? g.data.seasons : [], max: b.data.max });
  }, [text]);
  useEffect(() => { load(); }, [load]);

  const add = async () => {
    setBusy(true);
    const r = await bp('owner/blocked', { method: 'POST', body: form });
    setBusy(false);
    if (r.ok) { toast.success(t('calendar.added')); setForm({ starts_at: null, ends_at: null, reason: '' }); setS((x) => ({ ...x, blocked: r.data.blocked })); } else toast.error(text.api(r.data?.error));
  };
  const remove = async (id) => {
    const r = await bp(`owner/blocked/${id}`, { method: 'DELETE' });
    if (r.ok) { toast.success(t('calendar.removed')); setS((x) => ({ ...x, blocked: r.data.blocked })); } else toast.error(text.api(r.data?.error));
  };

  const fmt = (iso) => new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
  const all = busyRanges(s.seasons.map((x) => ({ ...x, id: x.id })), s.blocked, new Date());
  return (
    <LoadingOrError loading={s.loading} error={s.error} onRetry={load} data={!s.loading}>
      <div className="space-y-6">
        <Section title={t('calendar.ownerTitle')} description={t('calendar.ownerIntro')} icon={CalendarX2}>
          <BusyCalendar busy={all} start={form.starts_at} end={form.ends_at} onPick={readOnly ? undefined : ({ starts_at, ends_at }) => setForm((f) => ({ ...f, starts_at, ends_at }))} />
          {readOnly ? null : (
            <div className="space-y-3 rounded-xl border border-border/60 bg-background/30 p-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <DateField label={t('calendar.from')} value={form.starts_at} onChange={(v) => setForm((f) => ({ ...f, starts_at: v }))} />
                <DateField label={t('calendar.to')} value={form.ends_at} onChange={(v) => setForm((f) => ({ ...f, ends_at: v }))} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium" htmlFor="bp-block-reason">{t('calendar.reason')}</label>
                <Input id="bp-block-reason" value={form.reason} maxLength={80} placeholder={t('calendar.reasonPlaceholder')} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} />
                <p className="mt-1 text-xs text-muted-foreground">{t('calendar.reasonHint')}</p>
              </div>
              <Button type="button" disabled={busy || !form.starts_at || !form.ends_at || s.blocked.length >= s.max} onClick={add}>
                {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Plus className="mr-1.5 h-4 w-4" />}{t('calendar.add')}
              </Button>
            </div>
          )}
        </Section>
        <Section title={t('calendar.listTitle')} description={t('calendar.listIntro', { count: s.blocked.length, max: s.max })}>
          {s.blocked.length === 0 ? <p className="text-sm text-muted-foreground">{t('calendar.empty')}</p> : (
            <ul className="divide-y divide-border/30">
              {s.blocked.map((b) => (
                <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                  <span className="min-w-0"><span className="font-medium">{b.reason || t('calendar.kind.blocked')}</span><span className="block text-xs text-muted-foreground">{fmt(b.starts_at)} - {fmt(b.ends_at)}</span></span>
                  {readOnly ? null : <Button type="button" variant="ghost" size="icon" aria-label={t('actions.remove')} onClick={() => remove(b.id)}><Trash2 className="h-4 w-4" /></Button>}
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </LoadingOrError>
  );
}

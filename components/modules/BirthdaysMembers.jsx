'use client';
// Members, calendar and history tabs of the Birthdays panel.
// Private birthdays never appear on the calendar, not even for admins.
import { useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { CalendarDays, List, Loader2, Pencil, Search, Trash2, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Empty } from '@/components/dashboard-kit';
import {
  ConfirmDialog, Field, FieldError, LoadingOrError, NativeSelect, Pager, SendTestButton, SwitchRow, avatarSrc, callApi, formatDate, useApi, useErrorText,
} from '@/components/module-kit';
import { PRIVACY, monthName, timezoneList } from '@/components/modules/birthdays-shared';

const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function Avatar({ url, name }) {
  const src = avatarSrc(url);
  return src ? <img src={src} alt="" className="h-9 w-9 rounded-full object-cover" /> : <div className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-sm">{(name || '?').slice(0, 1).toUpperCase()}</div>;
}

export function MembersTab({ guildId, settings, serverLanguage, onChanged }) {
  const t = useTranslations('guildSettings.birthdays');
  const tk = useTranslations('guildSettings.kit');
  const [view, setView] = useState('list');
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState(null);
  const [removing, setRemoving] = useState(null);
  const [busy, setBusy] = useState(false);
  const path = `birthdays/members?q=${encodeURIComponent(query)}&page=${page}`;
  const api = useApi(guildId, path);

  useEffect(() => {
    const id = setTimeout(() => { setPage(0); setQuery(q.trim()); }, 350);
    return () => clearTimeout(id);
  }, [q]);

  const remove = async () => {
    setBusy(true);
    const r = await callApi(guildId, `birthdays/members/${removing.user_id}`, { method: 'DELETE' });
    setBusy(false);
    if (r.ok) { toast.success(t('members.removed')); setRemoving(null); api.reload(); onChanged?.(); } else toast.error(tk(`apiErrors.${r.data?.error || 'generic'}`));
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg border border-border/60 p-0.5" role="tablist" aria-label={t('members.view')}>
          <Button size="sm" variant={view === 'list' ? 'secondary' : 'ghost'} onClick={() => setView('list')} className="gap-1.5" role="tab" aria-selected={view === 'list'}><List className="h-4 w-4" />{t('members.list')}</Button>
          <Button size="sm" variant={view === 'calendar' ? 'secondary' : 'ghost'} onClick={() => setView('calendar')} className="gap-1.5" role="tab" aria-selected={view === 'calendar'}><CalendarDays className="h-4 w-4" />{t('members.calendar')}</Button>
        </div>
        <div className="flex-1" />
        <Button size="sm" onClick={() => setEditing({ user_id: '', day: 1, month: 1, year: null, privacy: settings.privacy_default || 'community', timezone: null, enabled: true, isNew: true })} className="gap-1.5"><UserPlus className="h-4 w-4" />{t('members.add')}</Button>
      </div>

      {view === 'calendar' ? <CalendarView guildId={guildId} /> : (
        <>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('members.search')} aria-label={t('members.search')} className="pl-9" maxLength={64} />
          </div>
          <LoadingOrError loading={api.loading} error={api.error} data={api.data} onRetry={api.reload}>
            {api.data && api.data.members.length === 0 ? (
              <Empty title={query ? t('members.noResults') : t('members.emptyTitle')} text={query ? t('members.noResultsText') : t('members.emptyText')} />
            ) : null}
            {api.data && api.data.members.length > 0 ? (
              <>
                <ul className="divide-y divide-border/50 rounded-2xl border border-border/60">
                  {api.data.members.map((m) => (
                    <li key={m.user_id} className="flex flex-wrap items-center gap-3 p-3">
                      <Avatar url={m.avatar_url} name={m.name} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="truncate text-sm font-medium">{m.name || m.user_id}</span>
                          {m.left ? <Badge variant="outline" className="text-[10px]">{t('members.left')}</Badge> : null}
                          {!m.enabled ? <Badge variant="outline" className="text-[10px]">{t('members.disabled')}</Badge> : null}
                          <Badge variant="secondary" className="text-[10px]">{t(`privacy.${m.privacy}`)}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {m.day} {monthName(serverLanguage, m.month)}{m.year ? ` ${m.year}` : ''}{m.timezone ? ` · ${m.timezone}` : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button size="icon" variant="ghost" onClick={() => setEditing({ ...m })} aria-label={t('members.edit')}><Pencil className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => setRemoving(m)} aria-label={t('members.remove')}><Trash2 className="h-4 w-4 text-red-400" /></Button>
                      </div>
                    </li>
                  ))}
                </ul>
                <Pager page={page} total={api.data.total} perPage={15} onChange={setPage} />
              </>
            ) : null}
          </LoadingOrError>
        </>
      )}

      {editing ? (
        <EditDialog guildId={guildId} member={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); api.reload(); onChanged?.(); }} />
      ) : null}
      <ConfirmDialog
        open={Boolean(removing)} onOpenChange={(o) => { if (!o) setRemoving(null); }}
        title={t('members.removeTitle')} description={t('members.removeText', { name: removing?.name || removing?.user_id || '' })}
        confirmLabel={t('members.remove')} onConfirm={remove} busy={busy}
      />
    </div>
  );
}

function EditDialog({ guildId, member, onClose, onSaved }) {
  const t = useTranslations('guildSettings.birthdays');
  const tk = useTranslations('guildSettings.kit');
  const { apiErrorText } = useErrorText();
  const [m, setM] = useState(member);
  const [errors, setErrors] = useState([]);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [found, setFound] = useState([]);
  const [picked, setPicked] = useState(null);
  const tz = useRef(timezoneList());

  useEffect(() => {
    if (!member.isNew || search.trim().length < 2) { setFound([]); return undefined; }
    let alive = true;
    const id = setTimeout(async () => {
      const r = await callApi(guildId, `birthdays/search?q=${encodeURIComponent(search.trim())}`);
      if (alive && r.ok) setFound(r.data.members || []);
    }, 300);
    return () => { alive = false; clearTimeout(id); };
  }, [search, member.isNew, guildId]);

  const set = (patch) => setM((x) => ({ ...x, ...patch }));
  const maxDay = DAYS_IN_MONTH[(Number(m.month) || 1) - 1];

  const submit = async () => {
    const uid = member.isNew ? picked?.id : m.user_id;
    if (!uid) { setErrors([{ field: 'user_id', code: 'required' }]); return; }
    setSaving(true); setErrors([]);
    const body = {
      day: Number(m.day), month: Number(m.month), year: m.year ? Number(m.year) : null,
      privacy: m.privacy, timezone: m.timezone || null, enabled: m.enabled !== false,
    };
    const r = await callApi(guildId, `birthdays/members/${uid}`, { method: 'PUT', body });
    setSaving(false);
    if (r.ok) { toast.success(t('members.saved')); onSaved(); return; }
    if (r.data?.errors) setErrors(r.data.errors); else toast.error(apiErrorText(r.data?.error || 'generic'));
  };

  const dateFieldError = errors.filter((e) => ['day', 'month', 'year', 'date'].includes(e.field));

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{member.isNew ? t('members.add') : t('members.editTitle', { name: member.name || member.user_id })}</DialogTitle>
          <DialogDescription>{t('members.editText')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {member.isNew ? (
            <Field label={t('members.member')} hint={t('members.memberHint')} level="required" errors={errors} field="user_id">
              {picked ? (
                <div className="flex items-center gap-2 rounded-md border border-border/60 p-2">
                  <Avatar url={picked.avatar_url} name={picked.name} /><span className="flex-1 text-sm">{picked.name}</span>
                  <Button size="sm" variant="ghost" onClick={() => { setPicked(null); setSearch(''); }}>{t('members.change')}</Button>
                </div>
              ) : (
                <>
                  <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('members.search')} maxLength={64} />
                  {found.length ? (
                    <ul className="mt-1 max-h-48 overflow-y-auto rounded-md border border-border/60">
                      {found.map((f) => (
                        <li key={f.id}>
                          <button type="button" onClick={() => setPicked(f)} className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm hover:bg-secondary/60">
                            <Avatar url={f.avatar_url} name={f.name} />{f.name}
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </>
              )}
            </Field>
          ) : null}

          <div className="grid grid-cols-3 gap-3">
            <Field label={t('members.day')} level="required">
              <Input type="number" min={1} max={maxDay} value={m.day} onChange={(e) => set({ day: e.target.value })} />
            </Field>
            <Field label={t('members.month')} level="required">
              <NativeSelect value={m.month} onChange={(v) => set({ month: Number(v) })} label={t('members.month')}
                options={Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: monthName('en', i + 1) }))} />
            </Field>
            <Field label={t('members.year')} level="optional">
              <Input type="number" min={1900} value={m.year ?? ''} onChange={(e) => set({ year: e.target.value })} placeholder="-" />
            </Field>
          </div>
          {dateFieldError.length ? <FieldError errors={dateFieldError} field={dateFieldError[0].field} /> : null}

          <Field label={t('members.privacy')} hint={t('members.privacyHint')} level="recommended">
            <NativeSelect value={m.privacy} onChange={(v) => set({ privacy: v })} label={t('members.privacy')}
              options={PRIVACY.map((p) => ({ value: p, label: t(`privacy.${p}`) }))} />
          </Field>
          <Field label={t('members.timezone')} hint={t('members.timezoneHint')} level="optional">
            <NativeSelect value={m.timezone || ''} onChange={(v) => set({ timezone: v || null })} label={t('members.timezone')}
              options={[{ value: '', label: t('members.serverTimezone') }, ...tz.current.map((z) => ({ value: z, label: z }))]} />
          </Field>
          <SwitchRow label={t('members.enabled')} hint={t('members.enabledHint')} checked={m.enabled !== false} onChange={(v) => set({ enabled: v })} />
          {!member.isNew ? (
            <SendTestButton label={t('members.sendTest')} onSend={() => callApi(guildId, 'birthdays/test', { method: 'POST', body: { what: 'announcement', member_id: member.user_id } })} />
          ) : null}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>{tk('cancel')}</Button>
          <Button onClick={submit} disabled={saving} className="gap-2">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}{tk('save')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CalendarView({ guildId }) {
  const t = useTranslations('guildSettings.birthdays');
  const locale = useLocale();
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const api = useApi(guildId, `birthdays/calendar?month=${month}`);
  const first = new Date(2024, month - 1, 1).getDay();
  const offset = (first + 6) % 7;
  const total = DAYS_IN_MONTH[month - 1];
  const weekdays = Array.from({ length: 7 }, (_, i) => new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(new Date(2024, 0, 1 + i)));
  const cells = [...Array(offset).fill(null), ...Array.from({ length: total }, (_, i) => i + 1)];

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center gap-2">
        <NativeSelect value={month} onChange={(v) => setMonth(Number(v))} label={t('members.month')}
          options={Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: new Intl.DateTimeFormat(locale, { month: 'long' }).format(new Date(2024, i, 1)) }))} className="max-w-[200px]" />
        <p className="text-xs text-muted-foreground">{t('members.calendarNote')}</p>
      </div>
      <LoadingOrError loading={api.loading} error={api.error} data={api.data} onRetry={api.reload}>
        <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-muted-foreground">{weekdays.map((w) => <div key={w}>{w}</div>)}</div>
        <div className="mt-1 grid grid-cols-7 gap-1">
          {cells.map((d, i) => {
            const list = d ? api.data?.days?.[d] || [] : [];
            return (
              <div key={i} className={`min-h-[3.5rem] rounded-md border p-1 text-left text-[11px] ${d ? 'border-border/50' : 'border-transparent'} ${list.length ? 'bg-primary/10' : ''}`}>
                {d ? <div className="text-muted-foreground">{d}</div> : null}
                {list.slice(0, 2).map((p) => <div key={p.user_id} className="truncate text-foreground">{p.name || p.user_id}</div>)}
                {list.length > 2 ? <div className="text-muted-foreground">+{list.length - 2}</div> : null}
              </div>
            );
          })}
        </div>
      </LoadingOrError>
    </Card>
  );
}

export function HistoryTab({ guildId }) {
  const t = useTranslations('guildSettings.birthdays');
  const locale = useLocale();
  const [page, setPage] = useState(0);
  const api = useApi(guildId, `birthdays/history?page=${page}`);
  return (
    <LoadingOrError loading={api.loading} error={api.error} data={api.data} onRetry={api.reload}>
      {api.data && api.data.rows.length === 0 ? <Empty title={t('history.emptyTitle')} text={t('history.emptyText')} /> : null}
      {api.data && api.data.rows.length > 0 ? (
        <>
          <ul className="divide-y divide-border/50 rounded-2xl border border-border/60">
            {api.data.rows.map((r) => (
              <li key={`${r.user_id}-${r.year}`} className="flex flex-wrap items-center gap-3 p-3 text-sm">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{r.name || r.user_id}</div>
                  <div className="text-xs text-muted-foreground">{r.date || r.year} · {formatDate(r.created_at, locale)}</div>
                </div>
                <Badge variant={r.announced_at ? 'secondary' : 'outline'} className="text-[10px]">{r.announced_at ? t('history.announced') : t('history.notAnnounced')}</Badge>
                <Badge variant={r.role_added_at ? 'secondary' : 'outline'} className="text-[10px]">{r.role_removed_at ? t('history.roleRemoved') : r.role_added_at ? t('history.roleAdded') : t('history.noRole')}</Badge>
                {r.error ? <Badge variant="destructive" className="max-w-[16rem] truncate text-[10px]" title={r.error}>{t('history.error')}</Badge> : null}
              </li>
            ))}
          </ul>
          <Pager page={page} total={api.data.total} perPage={20} onChange={setPage} />
        </>
      ) : null}
    </LoadingOrError>
  );
}

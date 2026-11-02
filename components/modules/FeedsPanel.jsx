'use client';
// Wody Feeds (free). New videos, streams, songs, posts, releases from other services, posted to a channel on a
// schedule (every 5 minutes up to once a day). The list shows what each feed did last (read from the bot's own records),
// and every action goes through the same code the bot uses: saving is validated by a port of the bot's checker, "Post a test"
// and "Check source" are run by the bot itself. Nothing here is sample data and the module never asks for Premium.
import { useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { CheckCircle2, Loader2, Pause, Pencil, Play, Plus, RefreshCw, Send, Trash2, TriangleAlert, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ChannelSelect, RoleSelect, SectionHeader, Empty } from '@/components/dashboard-kit';
import { ConfirmDialog, Field, LoadingOrError, NativeSelect, StatusDot, callApi, formatDate, useApi, useErrorText } from '@/components/module-kit';
import { EXAMPLE, GROUPS, HINT_KIND, INTERVALS, SOURCES, DEFAULT_INTERVAL } from '@/lib/feeds-core';

const GROUP_ORDER = GROUPS;
const EMPTY = { source: 'github', target: '', options: {}, channel_id: null, role_id: null, interval: DEFAULT_INTERVAL };

export default function FeedsPanel({ guildId, meta }) {
  const api = useApi(guildId, 'feeds');
  return (
    <LoadingOrError loading={api.loading} error={api.error} data={api.data} onRetry={api.reload}>
      {api.data ? <Editor guildId={guildId} meta={meta} data={api.data} reload={api.reload} /> : null}
    </LoadingOrError>
  );
}

function statusOf(f) {
  if (!f.enabled) return 'paused';
  return f.last_status || 'new';
}

function Editor({ guildId, meta, data, reload }) {
  const t = useTranslations('guildSettings.feeds');
  const locale = useLocale();
  const { apiErrorText } = useErrorText();
  const [dialog, setDialog] = useState(null);       // null | { feed? }
  const [removing, setRemoving] = useState(null);
  const [busy, setBusy] = useState(null);
  const channels = meta?.channels || [];
  const channelName = (id) => channels.find((c) => String(c.id) === String(id))?.name;
  const feeds = data.feeds || [];

  const act = async (feed, action, ok) => {
    setBusy(`${feed.id}:${action}`);
    const r = await callApi(guildId, `feeds/${feed.id}/${action}`, { method: 'POST', body: {} });
    setBusy(null);
    if (r.ok) { toast.success(ok(r.data)); reload(); } else toast.error(r.data?.message || apiErrorText(r.data?.error));
  };
  const remove = async () => {
    setBusy('delete');
    const r = await callApi(guildId, `feeds/${removing.id}`, { method: 'DELETE' });
    setBusy(null);
    if (r.ok) { toast.success(t('removed')); setRemoving(null); reload(); } else toast.error(apiErrorText(r.data?.error));
  };

  return (
    <div className="space-y-5">
      <SectionHeader
        title={t('title')} description={t('description')}
        action={<Button onClick={() => setDialog({})} disabled={feeds.length >= data.max}><Plus className="mr-2 h-4 w-4" />{t('add')}</Button>}
      />
      <Card className="flex flex-wrap items-center gap-x-4 gap-y-1 border-border/50 bg-secondary/10 p-3.5 text-sm text-muted-foreground">
        <span className="font-medium text-foreground">{t('freeTitle')}</span>
        <span>{t('freeText', { max: data.max })}</span>
        <span className="ml-auto text-xs">{t('counter', { n: feeds.length, max: data.max })}</span>
      </Card>

      {feeds.length === 0 ? (
        <Empty title={t('emptyTitle')} text={t('emptyText')} action={<Button onClick={() => setDialog({})}><Plus className="mr-2 h-4 w-4" />{t('add')}</Button>} />
      ) : (
        <div className="grid gap-3">
          {feeds.map((f) => {
            const st = statusOf(f);
            const src = SOURCES[f.source];
            const tone = st === 'error' ? 'bad' : st === 'paused' ? 'muted' : st === 'new' ? 'warn' : 'ok';
            return (
              <Card key={f.id} className="p-4 bg-card/60">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{src?.label || f.source}</span>
                      {f.target ? <code className="max-w-[18rem] truncate rounded bg-secondary/60 px-1.5 py-0.5 text-xs">{f.target}</code> : null}
                      <Badge variant="outline" className="gap-1.5 text-[11px]"><StatusDot tone={tone} />{t(`status.${st}`)}</Badge>
                    </div>
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      #{channelName(f.channel_id) || t('channelMissing')} · {t(`intervals.${f.interval}`)} · {t('posts', { n: f.posts })}
                      {f.last_run ? ` · ${t('lastRun', { when: formatDate(f.last_run, locale) })}` : ''}
                    </p>
                    {f.last_status === 'error' ? (
                      <p className="mt-1.5 flex items-start gap-1.5 text-xs text-amber-300"><TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />{t(`reasons.${f.last_error || 'unavailable'}`)}</p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" disabled={Boolean(busy)} onClick={() => act(f, 'test', (d) => t('testOk', { channel: d.result?.channel || channelName(f.channel_id) || '' }))}>
                      {busy === `${f.id}:test` ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Send className="mr-1.5 h-3.5 w-3.5" />}{t('postLatest')}
                    </Button>
                    <Button size="sm" variant="outline" disabled={Boolean(busy)} onClick={() => act(f, 'run', () => t('runQueued'))}>
                      <RefreshCw className="mr-1.5 h-3.5 w-3.5" />{t('checkNow')}
                    </Button>
                    <Button size="sm" variant="outline" disabled={Boolean(busy)} onClick={() => act(f, 'toggle', (d) => t(d.enabled ? 'resumed' : 'paused'))}>
                      {f.enabled ? <Pause className="mr-1.5 h-3.5 w-3.5" /> : <Play className="mr-1.5 h-3.5 w-3.5" />}{t(f.enabled ? 'pause' : 'resume')}
                    </Button>
                    {src ? <Button size="sm" variant="outline" onClick={() => setDialog({ feed: f })} aria-label={t('edit')}><Pencil className="h-3.5 w-3.5" /></Button> : null}
                    <Button size="sm" variant="outline" className="text-red-400" onClick={() => setRemoving(f)} aria-label={t('delete')}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {dialog ? <FeedDialog guildId={guildId} meta={meta} feed={dialog.feed} onClose={() => setDialog(null)} onSaved={() => { setDialog(null); reload(); }} /> : null}
      <ConfirmDialog
        open={Boolean(removing)} onOpenChange={(o) => !o && setRemoving(null)} title={t('deleteTitle')}
        description={t('deleteText', { feed: removing ? `${SOURCES[removing.source]?.label || removing.source} ${removing.target}`.trim() : '' })}
        confirmLabel={t('delete')} onConfirm={remove} busy={busy === 'delete'}
      />
    </div>
  );
}

function FeedDialog({ guildId, meta, feed, onClose, onSaved }) {
  const t = useTranslations('guildSettings.feeds');
  const tk = useTranslations('guildSettings.kit');
  const { errorText, apiErrorText } = useErrorText();
  const [f, setF] = useState(feed ? { source: feed.source, target: feed.target, options: feed.options || {}, channel_id: feed.channel_id, role_id: feed.role_id, interval: feed.interval } : EMPTY);
  const [errors, setErrors] = useState([]);
  const [busy, setBusy] = useState(null);
  const [checked, setChecked] = useState(null);
  const src = SOURCES[f.source];
  const optionNames = Object.keys(src?.options || {});
  const hintKind = HINT_KIND[f.source];
  const set = (patch) => { setF((s) => ({ ...s, ...patch })); setChecked(null); };
  const pickSource = (key) => set({ source: key, target: '', options: Object.fromEntries(Object.entries(SOURCES[key].options).map(([k, v]) => [k, v[0]])) });
  const bySource = useMemo(() => GROUP_ORDER.map((g) => ({ group: g, items: Object.values(SOURCES).filter((s) => s.group === g) })), []);
  const body = () => ({ source: f.source, target: f.target, options: f.options, channel_id: f.channel_id, role_id: f.role_id, interval: f.interval });
  const fieldError = (field) => errors.filter((e) => e.field === field);

  const run = async (kind, path, init, onOk) => {
    setBusy(kind); setErrors([]);
    const r = await callApi(guildId, path, init);
    setBusy(null);
    if (r.ok) return onOk(r.data);
    if (r.data?.error === 'validation_failed') setErrors(r.data.errors || []);
    else toast.error(r.data?.message || apiErrorText(r.data?.error));
    return null;
  };
  const check = () => run('check', 'feeds/check', { method: 'POST', body: body() }, (d) => setChecked({ ...d.result, ok: true }));
  const test = () => run('test', 'feeds/test', { method: 'POST', body: body() }, (d) => toast.success(t('testOk', { channel: d.result?.channel || '' })));
  const save = () => run('save', feed ? `feeds/${feed.id}` : 'feeds', { method: feed ? 'PUT' : 'POST', body: body() }, () => { toast.success(t(feed ? 'updated' : 'added')); onSaved(); });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t(feed ? 'edit' : 'add')}</DialogTitle>
          <DialogDescription>{t('dialogText')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('source')}</p>
            <div className="space-y-3">
              {bySource.map(({ group, items }) => (
                <div key={group}>
                  <p className="mb-1.5 text-xs text-muted-foreground">{t(`groups.${group}`)}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {items.map((s) => (
                      <button
                        key={s.key} type="button" onClick={() => pickSource(s.key)} aria-pressed={f.source === s.key}
                        className={`rounded-full border px-3 py-1 text-xs transition-colors ${f.source === s.key ? 'border-[#e6cd8c] bg-[#e6cd8c]/15 text-foreground' : 'border-border/60 bg-secondary/20 text-muted-foreground hover:text-foreground'}`}
                      >{s.label}</button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {src?.needs ? <p className="rounded-lg border border-amber-400/30 bg-amber-400/5 p-3 text-xs text-amber-200">{t('needsKey')}</p> : null}

          <Field label={t('target')} hint={t(`hints.${hintKind}`)} errors={errors} field="target">
            <Input
              value={f.target} onChange={(e) => set({ target: e.target.value })} maxLength={300}
              placeholder={EXAMPLE[f.source] || t(`hints.${hintKind}`)} autoComplete="off" spellCheck={false}
            />
            <p className="mt-1 text-[11px] text-muted-foreground">{t(`hints.${hintKind}`)}{src?.targetOptional ? ` ${t('optional')}` : ''}</p>
          </Field>
          {fieldError('target').map((e, i) => <p key={i} className="-mt-3 text-xs text-red-400">{errorText(e)}</p>)}

          {optionNames.map((name) => (
            <Field key={name} label={t(`options.${name}.label`)}>
              <NativeSelect value={f.options?.[name] || src.options[name][0]} onChange={(v) => set({ options: { ...f.options, [name]: v } })}
                options={src.options[name].map((v) => ({ value: v, label: t(`options.${name}.${v}`) }))} />
            </Field>
          ))}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('channel')} errors={errors} field="channel_id">
              <ChannelSelect value={f.channel_id} onChange={(v) => set({ channel_id: v })} channels={meta?.channels || []} includeNone={false} placeholder={t('channelPlaceholder')} />
            </Field>
            <Field label={t('interval')} hint={t('intervalHint')} errors={errors} field="interval">
              <NativeSelect value={String(f.interval)} onChange={(v) => set({ interval: Number(v) })} options={INTERVALS.map((m) => ({ value: String(m), label: t(`intervals.${m}`) }))} />
            </Field>
          </div>
          <Field label={t('role')} hint={t('roleHint')} errors={errors} field="role_id">
            <RoleSelect value={f.role_id} onChange={(v) => set({ role_id: v })} roles={meta?.roles || []} placeholder={t('rolePlaceholder')} />
          </Field>

          {checked ? (
            <p className="flex items-start gap-2 rounded-lg border border-emerald-400/30 bg-emerald-400/5 p-3 text-sm text-emerald-200">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              {checked.title ? t('checkFound', { title: checked.title }) : t('checkEmpty')}
            </p>
          ) : null}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={check} disabled={Boolean(busy)}>{busy === 'check' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}{t('checkSource')}</Button>
          <Button variant="outline" onClick={test} disabled={Boolean(busy) || !f.channel_id}>{busy === 'test' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}{t('postTest')}</Button>
          <Button onClick={save} disabled={Boolean(busy) || !f.channel_id}>{busy === 'save' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}{tk('save')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

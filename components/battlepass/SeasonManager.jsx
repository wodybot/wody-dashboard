'use client';
import { useCallback, useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Plus, Loader2, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Empty } from '@/components/dashboard-kit';
import { LoadingOrError, formatDate } from '@/components/module-kit';
import { bp, useBpText } from './bp-kit';
import SeasonEditor, { StatusBadge } from './SeasonEditor';

/** The list of seasons of one scope (Global for the Owner Panel, one server for Premium) and the editor behind it. */
export default function SeasonManager({ scope, guildId = null, canCreate = true }) {
  const t = useTranslations('battlepass');
  const locale = useLocale();
  const text = useBpText();
  const base = scope === 'global' ? 'owner/seasons' : `guilds/${guildId}/seasons`;
  const [state, setState] = useState({ loading: true, error: null, seasons: [] });
  const [openId, setOpenId] = useState(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const r = await bp(base);
    setState({ loading: false, error: r.ok ? null : text.api(r.data?.error), seasons: r.ok ? r.data.seasons : [] });
  }, [base, text]);
  useEffect(() => { load(); }, [load]);

  const create = async () => {
    if (!name.trim()) return;
    setBusy(true);
    const r = await bp(base, { method: 'POST', body: { name: name.trim(), level_count: 30, curve: { type: 'fixed', base: 100 } } });
    setBusy(false);
    if (r.ok) { setCreating(false); setName(''); await load(); setOpenId(r.data.season.id); toast.success(t('manager.created')); } else toast.error(r.data?.error === 'validation_failed' ? t('editor.fixErrors') : text.api(r.data?.error));
  };

  if (openId) {
    return <SeasonEditor base={base} scope={scope} seasonId={openId} onClose={(next) => { setOpenId(next || null); load(); }} onChanged={load} />;
  }
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{scope === 'global' ? t('manager.introGlobal') : t('manager.introGuild')}</p>
        {canCreate ? <Button onClick={() => setCreating(true)}><Plus className="mr-1.5 h-4 w-4" />{t('manager.new')}</Button> : null}
      </div>
      <LoadingOrError loading={state.loading} error={state.error} onRetry={load} data={state.seasons}>
        {state.seasons.length === 0 ? <Empty icon={Layers} title={t('manager.emptyTitle')} description={t('manager.emptyText')} /> : (
          <div className="grid gap-3">
            {state.seasons.map((s) => (
              <Card key={s.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <button type="button" onClick={() => setOpenId(s.id)} className="min-w-0 flex-1 text-left">
                  <div className="flex flex-wrap items-center gap-2"><span className="truncate font-semibold">{s.name}</span><StatusBadge status={s.effective_status || s.status} /></div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t('manager.summary', { levels: s.level_count, rewards: s.rewards_count })}
                    {s.starts_at ? ` · ${t('manager.from', { date: formatDate(s.starts_at, locale) })}` : ''}{s.ends_at ? ` · ${t('manager.until', { date: formatDate(s.ends_at, locale) })}` : ''}
                  </p>
                </button>
                <Button variant="outline" size="sm" onClick={() => setOpenId(s.id)}>{t('manager.open')}</Button>
              </Card>
            ))}
          </div>
        )}
      </LoadingOrError>

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t('manager.newTitle')}</DialogTitle><DialogDescription>{t('manager.newText')}</DialogDescription></DialogHeader>
          <Input value={name} maxLength={60} autoFocus placeholder={t('manager.namePlaceholder')} aria-label={t('fields.name')} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') create(); }} />
          <DialogFooter><Button variant="outline" onClick={() => setCreating(false)}>{t('actions.cancel')}</Button><Button disabled={busy || !name.trim()} onClick={create}>{busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}{t('manager.create')}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

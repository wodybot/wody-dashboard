'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Settings2, Bell, ShieldCheck, Megaphone, Loader2 } from 'lucide-react';
import { Section, SwitchRow } from '@/components/module-kit';
import { TextField, DateField, getPath, bp, useBpText } from '../bp-kit';
import { Field } from '@/components/module-kit';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

/** Posts the season message in the saved channel again. Only for a published server season whose settings are saved. */
function AnnounceNow({ base, seasonId, status, dirty, channel }) {
  const t = useTranslations('battlepass');
  const text = useBpText();
  const [busy, setBusy] = useState(false);
  const live = ['active', 'scheduled', 'paused'].includes(status);
  const send = async () => {
    setBusy(true);
    const r = await bp(`${base}/${seasonId}/announce`, { method: 'POST', body: {} });
    setBusy(false);
    if (r.ok) toast.success(t('general.announceDone')); else toast.error(text.api(r.data?.error));
  };
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/50 bg-secondary/10 p-3.5">
      <div className="min-w-0">
        <p className="text-sm font-medium">{t('general.announceNow')}</p>
        <p className="text-xs text-muted-foreground">{!live ? t('general.announceStatus') : dirty ? t('general.announceSave') : t('general.announceHint')}</p>
      </div>
      <Button size="sm" variant="outline" disabled={busy || !live || dirty || !channel} onClick={send}>
        {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Megaphone className="mr-1.5 h-4 w-4" />}{t('general.announceNow')}
      </Button>
    </div>
  );
}

export default function GeneralTab({ draft, set, errors, scope, base, seasonId, status, dirty }) {
  const t = useTranslations('battlepass');
  const sw = (path, label, hint) => <SwitchRow label={label} hint={hint} checked={Boolean(getPath(draft, path))} onChange={(v) => set(path, v)} />;
  return (
    <div className="space-y-6">
      <Section title={t('general.title')} description={t('general.intro')} icon={Settings2}>
        <TextField label={t('fields.name')} value={draft.name} onChange={(v) => set('name', v)} max={60} errors={errors} path="name" />
        <TextField label={t('fields.description')} hint={t('fields.descriptionHint')} value={draft.description} onChange={(v) => set('description', v)} max={400} errors={errors} path="description" multiline />
        <div className="grid gap-4 sm:grid-cols-2">
          <DateField label={t('fields.startsAt')} hint={t('fields.startsAtHint')} value={draft.starts_at} onChange={(v) => set('starts_at', v)} errors={errors} path="starts_at" />
          <DateField label={t('fields.endsAt')} hint={t('fields.endsAtHint')} value={draft.ends_at} onChange={(v) => set('ends_at', v)} errors={errors} path="ends_at" />
        </div>
        <p className="text-xs text-muted-foreground">{t('general.datesNote')}</p>
      </Section>

      <Section title={t('general.claims')} description={t('general.claimsIntro')} icon={ShieldCheck}>
        {sw('protection.claim_after_end', t('fields.claimAfterEnd'), t('fields.claimAfterEndHint'))}
        {sw('protection.claim_while_paused', t('fields.claimWhilePaused'), t('fields.claimWhilePausedHint'))}
        {sw('protection.audit_refusals', t('fields.auditRefusals'), t('fields.auditRefusalsHint'))}
      </Section>

      <Section title={t('general.notifications')} description={t('general.notificationsIntro')} icon={Bell}>
        {sw('notifications.level_up', t('fields.notifyLevelUp'))}
        {sw('notifications.reward_unlocked', t('fields.notifyReward'))}
        {sw('notifications.season_start', t('fields.notifyStart'))}
        {sw('notifications.season_end', t('fields.notifyEnd'))}
        {scope === 'guild' ? sw('notifications.season_created', t('fields.notifyCreated'), t('fields.notifyCreatedHint')) : null}
        {sw('notifications.dm', t('fields.notifyDm'), t('fields.notifyDmHint'))}
        {scope === 'guild' ? (
          <Field label={t('fields.notifyChannel')} hint={t('fields.notifyChannelHint')} errors={errors} field="notifications.channel_id">
            <Input value={draft.notifications?.channel_id || ''} onChange={(e) => set('notifications.channel_id', e.target.value.trim() || null)} inputMode="numeric" placeholder="123456789012345678" />
          </Field>
        ) : null}
        {scope === 'guild' ? (
          <>
            <Field label={t('fields.notifyRole')} hint={t('fields.notifyRoleHint')} errors={errors} field="notifications.mention_role_id">
              <Input value={draft.notifications?.mention_role_id || ''} disabled={Boolean(draft.notifications?.mention_everyone)} onChange={(e) => set('notifications.mention_role_id', e.target.value.trim() || null)} inputMode="numeric" placeholder="123456789012345678" />
            </Field>
            {sw('notifications.mention_everyone', t('fields.notifyEveryone'), t('fields.notifyEveryoneHint'))}
            {base && seasonId ? <AnnounceNow base={base} seasonId={seasonId} status={status} dirty={dirty} channel={draft.notifications?.channel_id} /> : null}
          </>
        ) : null}
      </Section>
    </div>
  );
}

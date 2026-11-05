'use client';
import { useTranslations } from 'next-intl';
import { Settings2, Bell, ShieldCheck } from 'lucide-react';
import { Section, SwitchRow } from '@/components/module-kit';
import { TextField, DateField, getPath } from '../bp-kit';
import { Field } from '@/components/module-kit';
import { Input } from '@/components/ui/input';

export default function GeneralTab({ draft, set, errors, scope }) {
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
        {sw('notifications.dm', t('fields.notifyDm'), t('fields.notifyDmHint'))}
        {scope === 'guild' ? (
          <Field label={t('fields.notifyChannel')} hint={t('fields.notifyChannelHint')} errors={errors} field="notifications.channel_id">
            <Input value={draft.notifications?.channel_id || ''} onChange={(e) => set('notifications.channel_id', e.target.value.trim() || null)} inputMode="numeric" placeholder="123456789012345678" />
          </Field>
        ) : null}
      </Section>
    </div>
  );
}

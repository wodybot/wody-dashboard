'use client';
import { useTranslations } from 'next-intl';
import { MessageSquare, Mic, Gauge } from 'lucide-react';
import { Section, SwitchRow, Field } from '@/components/module-kit';
import { Input } from '@/components/ui/input';
import { NumberField, getPath } from '../bp-kit';

const ids = (v) => (Array.isArray(v) ? v.join(', ') : '');
const parseIds = (s) => s.split(/[\s,;]+/).map((x) => x.trim()).filter(Boolean);

function IdList({ label, hint, value, onChange, errors, path }) {
  return (
    <Field label={label} hint={hint} errors={errors} field={path}>
      <Input value={ids(value)} onChange={(e) => onChange(parseIds(e.target.value))} inputMode="numeric" placeholder="123456789012345678, 234567890123456789" className="font-mono text-xs" />
    </Field>
  );
}

export default function XpTab({ draft, set, errors, scope, limits }) {
  const t = useTranslations('battlepass');
  const guild = scope === 'guild';
  const L = limits || {};
  const num = (path, label, hint, extra = {}) => (
    <NumberField label={label} hint={hint} value={getPath(draft, path)} onChange={(v) => set(path, v)} errors={errors} path={path} {...extra} />
  );
  const sw = (path, label, hint, disabled) => <SwitchRow label={label} hint={hint} disabled={disabled} checked={Boolean(getPath(draft, path))} onChange={(v) => set(path, v)} />;
  const maxMult = guild ? Math.min(2, L.max_multiplier ?? 2) : 5;
  return (
    <div className="space-y-6">
      <Section title={t('xp.title')} description={guild ? t('xp.introGuild') : t('xp.introGlobal')} icon={Gauge}>
        {num('xp.multiplier', t('fields.multiplier'), t('fields.multiplierHint'), { min: 0, max: maxMult, step: 0.1, suffix: `0 - ${maxMult}` })}
        {guild ? <p className="text-xs text-muted-foreground">{t('xp.limitsNote')}</p> : null}
      </Section>

      <Section title={t('xp.message')} description={t('xp.messageIntro')} icon={MessageSquare}>
        {sw('xp.message.enabled', t('fields.enabled'))}
        <div className="grid gap-4 sm:grid-cols-3">
          {num('xp.message.xp', t('fields.xpPerMessage'), t('fields.xpPerMessageHint'), { min: 0, max: guild ? Math.min(100, L.max_message_xp ?? 50) : 100, suffix: 'XP' })}
          {num('xp.message.cooldown_seconds', t('fields.cooldown'), t('fields.cooldownHint'), { min: guild ? Math.max(10, L.min_message_cooldown ?? 30) : 10, max: 3600, suffix: t('units.seconds') })}
          {num('xp.message.min_length', t('fields.minLength'), t('fields.minLengthHint'), { min: 0, max: 2000, suffix: t('units.characters') })}
        </div>
        <div className="grid gap-4 sm:grid-cols-4">
          {num('xp.message.max_per_hour', t('fields.perHour'), t('fields.capHint'), { min: 1, suffix: 'XP' })}
          {num('xp.message.max_per_day', t('fields.perDay'), t('fields.capHint'), { min: 1, suffix: 'XP' })}
          {num('xp.message.max_per_week', t('fields.perWeek'), t('fields.capHint'), { min: 1, suffix: 'XP' })}
          {num('xp.message.max_per_season', t('fields.perSeason'), t('fields.capHint'), { min: 1, suffix: 'XP' })}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {num('xp.message.min_account_age_days', t('fields.minAccountAge'), t('fields.minAccountAgeHint'), { min: 0, max: 3650, suffix: t('units.days') })}
          {num('xp.message.min_member_days', t('fields.minMemberDays'), t('fields.minMemberDaysHint'), { min: 0, max: 3650, suffix: t('units.days') })}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {num('xp.message.burst_messages', t('fields.burstMessages'), t('fields.burstHint'), { min: 2, max: 30 })}
          {num('xp.message.burst_seconds', t('fields.burstSeconds'), t('fields.burstHint'), { min: 2, max: 120, suffix: t('units.seconds') })}
        </div>
        <IdList label={t('fields.includeChannels')} hint={t('fields.idsHint')} value={draft.xp?.message?.include_channels} onChange={(v) => set('xp.message.include_channels', v)} errors={errors} path="xp.message.include_channels" />
        <IdList label={t('fields.excludeChannels')} hint={t('fields.idsHint')} value={draft.xp?.message?.exclude_channels} onChange={(v) => set('xp.message.exclude_channels', v)} errors={errors} path="xp.message.exclude_channels" />
        <IdList label={t('fields.includeRoles')} hint={t('fields.idsHint')} value={draft.xp?.message?.include_roles} onChange={(v) => set('xp.message.include_roles', v)} errors={errors} path="xp.message.include_roles" />
        <IdList label={t('fields.excludeRoles')} hint={t('fields.idsHint')} value={draft.xp?.message?.exclude_roles} onChange={(v) => set('xp.message.exclude_roles', v)} errors={errors} path="xp.message.exclude_roles" />
        {sw('xp.message.duplicate_protection', t('fields.duplicateProtection'), t('fields.duplicateProtectionHint'), guild)}
        {sw('xp.message.spam_protection', t('fields.spamProtection'), t('fields.spamProtectionHint'), guild)}
      </Section>

      <Section title={t('xp.voice')} description={t('xp.voiceIntro')} icon={Mic}>
        {sw('xp.voice.enabled', t('fields.enabled'))}
        <div className="grid gap-4 sm:grid-cols-3">
          {num('xp.voice.xp_per_interval', t('fields.xpPerInterval'), t('fields.xpPerIntervalHint'), { min: 0, max: guild ? Math.min(100, L.max_voice_xp ?? 50) : 100, suffix: 'XP' })}
          {num('xp.voice.interval_seconds', t('fields.interval'), t('fields.intervalHint'), { min: guild ? Math.max(60, L.min_voice_interval ?? 120) : 60, max: 3600, suffix: t('units.seconds') })}
          {num('xp.voice.min_session_seconds', t('fields.minSession'), t('fields.minSessionHint'), { min: 0, max: 7200, suffix: t('units.seconds') })}
        </div>
        <div className="grid gap-4 sm:grid-cols-4">
          {num('xp.voice.max_per_session', t('fields.perSession'), t('fields.capHint'), { min: 1, max: 10000, suffix: 'XP' })}
          {num('xp.voice.max_per_day', t('fields.perDay'), t('fields.capHint'), { min: 1, suffix: 'XP' })}
          {num('xp.voice.max_per_week', t('fields.perWeek'), t('fields.capHint'), { min: 1, suffix: 'XP' })}
          {num('xp.voice.max_per_season', t('fields.perSeason'), t('fields.capHint'), { min: 1, suffix: 'XP' })}
        </div>
        {num('xp.voice.min_active_participants', t('fields.minParticipants'), t('fields.minParticipantsHint'), { min: 1, max: 25 })}
        {sw('xp.voice.exclude_afk', t('fields.excludeAfk'), t('fields.excludeAfkHint'), guild)}
        {sw('xp.voice.allow_alone', t('fields.allowAlone'), t('fields.allowAloneHint'), guild)}
        {sw('xp.voice.allow_self_muted', t('fields.allowSelfMuted'))}
        {sw('xp.voice.allow_self_deafened', t('fields.allowSelfDeafened'))}
        {sw('xp.voice.allow_server_muted', t('fields.allowServerMuted'))}
        {sw('xp.voice.allow_server_deafened', t('fields.allowServerDeafened'))}
        <IdList label={t('fields.includeChannels')} hint={t('fields.idsHint')} value={draft.xp?.voice?.include_channels} onChange={(v) => set('xp.voice.include_channels', v)} errors={errors} path="xp.voice.include_channels" />
        <IdList label={t('fields.excludeChannels')} hint={t('fields.idsHint')} value={draft.xp?.voice?.exclude_channels} onChange={(v) => set('xp.voice.exclude_channels', v)} errors={errors} path="xp.voice.exclude_channels" />
        <IdList label={t('fields.includeRoles')} hint={t('fields.idsHint')} value={draft.xp?.voice?.include_roles} onChange={(v) => set('xp.voice.include_roles', v)} errors={errors} path="xp.voice.include_roles" />
        <IdList label={t('fields.excludeRoles')} hint={t('fields.idsHint')} value={draft.xp?.voice?.exclude_roles} onChange={(v) => set('xp.voice.exclude_roles', v)} errors={errors} path="xp.voice.exclude_roles" />
        <p className="text-xs text-muted-foreground">{t('xp.voiceNote')}</p>
      </Section>
    </div>
  );
}

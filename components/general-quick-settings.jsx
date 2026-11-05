'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Lock, RefreshCw } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChannelSelect, RoleSelect, InfoHint } from '@/components/dashboard-kit';
import { useBotStatus } from '@/components/bot-offline';
import { LOCALE_LABELS } from '@/i18n/routing';

const GROUPS = [
  { id: 'language', rows: [
    { id: 'language', doc: 'settings', field: 'language', kind: 'language', label: 'botLanguage', hint: 'botLanguageHint' },
    { id: 'bot_nickname', doc: 'settings', field: 'bot_nickname', kind: 'nickname', label: 'botNickname', hint: 'botNicknameHint' },
  ] },
  { id: 'permissions', rows: [
    { id: 'admin_role', doc: 'settings', field: 'admin_role_id', kind: 'role', label: 'adminRole', hint: 'adminRoleHint' },
    { id: 'moderator_role', doc: 'settings', field: 'moderator_role_id', kind: 'role', label: 'moderatorRole', hint: 'moderatorRoleHint' },
    { id: 'ticket_role', doc: 'settings', field: 'ticket_role_id', kind: 'role', module: 'tickets', label: 'ticketRole', hint: 'ticketRoleHint' },
  ] },
  { id: 'members', rows: [
    { id: 'welcome_channel', doc: 'welcome', field: 'channel_id', kind: 'channel', module: 'welcome', label: 'quickWelcomeChannel', hint: 'quickWelcomeChannelHint' },
    { id: 'goodbye_channel', doc: 'goodbye', field: 'channel_id', kind: 'channel', module: 'goodbye', label: 'quickGoodbyeChannel', hint: 'quickGoodbyeChannelHint' },
    { id: 'auto_role', doc: 'welcome', field: 'auto_role_id', kind: 'role', module: 'autorole', label: 'quickAutoRole', hint: 'quickAutoRoleHint' },
    { id: 'verification_role', doc: 'captcha', field: 'role_id', kind: 'role', module: 'captcha', label: 'quickVerificationRole', hint: 'quickVerificationRoleHint' },
  ] },
  { id: 'channels', rows: [
    { id: 'automod_log', doc: 'settings', field: 'mod_log_channel_id', kind: 'channel', module: 'automod', label: 'quickAutomodLog', hint: 'quickAutomodLogHint' },
    { id: 'ticket_transcript', doc: 'settings', field: 'ticket_transcript_channel_id', kind: 'channel', module: 'tickets', label: 'ticketTranscriptChannel', hint: 'ticketTranscriptChannelHint' },
    { id: 'suggestion_channel', doc: 'settings', field: 'suggestion_channel_id', kind: 'channel', module: 'suggestions', label: 'suggestionChannel', hint: 'suggestionChannelHint' },
    { id: 'level_channel', doc: 'settings', field: 'level_channel_id', kind: 'channel', module: 'levels', label: 'levelUpChannel', hint: 'levelUpChannelHint' },
  ] },
  { id: 'voice', premium: true, rows: [
    { id: 'voice_hub', doc: 'settings', field: 'temp_voice_hub_channel_id', kind: 'channel', types: [2], module: 'temporary_voice', label: 'quickVoiceHub', hint: 'quickVoiceHubHint' },
    { id: 'voice_category', doc: 'settings', field: 'temp_voice_category_id', kind: 'channel', types: [4], module: 'temporary_voice', label: 'quickVoiceCategory', hint: 'quickVoiceCategoryHint' },
  ] },
];
const DOCS = ['welcome', 'goodbye', 'captcha', 'settings'];

const effectiveLanguage = (doc) => (doc?.language_explicit === true && LOCALE_LABELS[doc.language] ? doc.language : 'en');

export default function GeneralQuickSettings({ guildId, meta, premiumActive, moduleSwitch }) {
  const t = useTranslations('guildSettings.general');
  const tc = useTranslations('guildSettings.common');
  const tm = useTranslations('modules');
  const siteLocale = useLocale();
  const bot = useBotStatus();
  const [docs, setDocs] = useState({});
  const [failed, setFailed] = useState({});
  const [busy, setBusy] = useState({});
  const alive = useRef(true);
  const seq = useRef({});
  const botOffline = useRef(false);
  botOffline.current = bot.offline;

  const loadDoc = useCallback(async (doc) => {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      try {
        const r = await fetch(`/api/guilds/${guildId}/${doc}`);
        if (!r.ok) throw new Error(String(r.status));
        const d = await r.json();
        if (!alive.current) return;
        setDocs((s) => ({ ...s, [doc]: d }));
        setFailed((s) => ({ ...s, [doc]: false }));
        return;
      } catch {
        if (!alive.current) return;
        await new Promise((resolve) => setTimeout(resolve, 700 * (attempt + 1)));
      }
    }
    if (alive.current) setFailed((s) => ({ ...s, [doc]: true }));
  }, [guildId]);

  const loadAll = useCallback(() => {
    setFailed({});
    DOCS.forEach((doc) => { loadDoc(doc); });
  }, [loadDoc]);

  useEffect(() => {
    alive.current = true;
    loadAll();
    return () => { alive.current = false; };
  }, [loadAll]);

  const statesReady = moduleSwitch ? moduleSwitch.ready !== false : true;
  const on = (key) => (!key || !moduleSwitch ? true : moduleSwitch.isOn(key));

  async function change(row, value) {
    if (row.module && (!statesReady || !on(row.module))) return;
    const current = docs[row.doc];
    if (!current) return;
    const isLanguage = row.kind === 'language';
    const prevValue = isLanguage ? effectiveLanguage(current) : (current[row.field] ?? null);
    if ((prevValue || null) === (value || null) && (!isLanguage || current.language_explicit === true)) return;
    const next = isLanguage ? { language: value, language_explicit: true } : { [row.field]: value };
    const before = Object.fromEntries(Object.keys(next).map((k) => [k, current[k] ?? null]));
    const mine = (seq.current[row.id] = (seq.current[row.id] || 0) + 1);
    setDocs((s) => ({ ...s, [row.doc]: { ...(s[row.doc] || {}), ...next } }));
    setBusy((s) => ({ ...s, [row.id]: true }));
    try {
      const r = await fetch(`/api/guilds/${guildId}/${row.doc}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ [row.field]: value }),
      });
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        if (e?.error && t.has(`nicknameErrors.${e.error}`)) throw new Error(t(`nicknameErrors.${e.error}`));
        throw new Error(e?.error ? `${e.error} (${r.status})` : `save failed (${r.status})`);
      }
      const saved = await r.json().catch(() => ({}));
      if (alive.current && mine === seq.current[row.id] && saved) {
        const own = Object.fromEntries(Object.keys(next).filter((k) => k in saved).map((k) => [k, saved[k]]));
        if (Object.keys(own).length) setDocs((s) => ({ ...s, [row.doc]: { ...(s[row.doc] || {}), ...own } }));
      }
      toast.success(tc('saved'), { description: botOffline.current ? tc('botOfflineSavedDesc') : tc('savedDesc') });
    } catch (e) {
      if (alive.current && mine === seq.current[row.id]) setDocs((s) => ({ ...s, [row.doc]: { ...(s[row.doc] || {}), ...before } }));
      toast.error(tc('saveFailed'), { description: e.message });
    } finally {
      if (alive.current) setBusy((s) => ({ ...s, [row.id]: false }));
    }
  }

  const tx = (key, fallback, values) => (t.has(key) ? t(key, values) : fallback);
  const anyFailed = Object.values(failed).some(Boolean);
  const switching = Boolean(moduleSwitch?.toggling);
  const channelsOk = Array.isArray(meta?.channels) && meta.channels.length > 0;
  const rolesOk = Array.isArray(meta?.roles) && meta.roles.length > 0;

  function renderControl(row, { value, disabled }) {
    if (row.kind === 'language') {
      const current = effectiveLanguage(docs[row.doc]);
      return (
        <div className="space-y-2" data-testid="bot-language">
          <Select value={current} onValueChange={(v) => change(row, v)} disabled={disabled}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(LOCALE_LABELS).map(([code, label]) => <SelectItem key={code} value={code}>{label}</SelectItem>)}
            </SelectContent>
          </Select>
          {siteLocale !== current && LOCALE_LABELS[siteLocale] ? (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
              <span>{t('botLanguageDetected', { language: LOCALE_LABELS[siteLocale] })}</span>
              <Button type="button" size="sm" variant="outline" disabled={disabled} onClick={() => change(row, siteLocale)}>
                {t('botLanguageUse', { language: LOCALE_LABELS[siteLocale] })}
              </Button>
            </div>
          ) : null}
        </div>
      );
    }
    if (row.kind === 'nickname') {
      return <NicknameField saved={docs[row.doc]?.bot_nickname || ''} disabled={disabled} onSave={(v) => change(row, v || null)} t={t} />;
    }
    if (row.kind === 'role') return <RoleSelect value={value} onChange={(v) => change(row, v)} roles={meta?.roles} disabled={disabled} />;
    return <ChannelSelect value={value} onChange={(v) => change(row, v)} channels={meta?.channels} types={row.types || [0, 5]} disabled={disabled} />;
  }

  return (
    <Card className="min-w-0 p-4 sm:p-8 space-y-8 bg-card/60" data-testid="quick-settings">
      <div>
        <h3 className="text-lg font-semibold">{t('quickTitle')}</h3>
        <p className="text-sm text-muted-foreground mt-1 leading-relaxed max-w-2xl">{t('quickIntro')}</p>
      </div>
      {anyFailed ? (
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3">
          <p className="text-sm flex-1">{tx('quickLoadFailed', 'Some settings could not be loaded right now. Nothing was changed.')}</p>
          <Button size="sm" variant="outline" onClick={loadAll}><RefreshCw className="w-4 h-4 mr-2" />{tx('channelsRetry', 'Retry')}</Button>
        </div>
      ) : null}
      {GROUPS.filter((g) => !g.premium || premiumActive).map((g) => (
        <section key={g.id} className="space-y-4" data-testid={`quick-group-${g.id}`}>
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t(`quickGroup_${g.id}`)}</div>
          <div className="grid grid-cols-1 gap-4 lg:gap-5 md:grid-cols-2">
            {g.rows.map((row) => {
              const value = docs[row.doc]?.[row.field] ?? null;
              const loaded = Boolean(docs[row.doc]);
              const hasModule = Boolean(row.module);
              const moduleName = hasModule ? tm(`${row.module}.title`) : null;
              const isOn = on(row.module);
              const checking = hasModule && !statesReady;
              const off = hasModule && statesReady && !isOn;
              const locked = checking || off;
              const listMissing = (row.kind === 'channel' && !channelsOk) || (row.kind === 'role' && !rolesOk);
              const disabled = !loaded || locked || listMissing || Boolean(busy[row.id]);
              const statusText = checking ? tx('quickStatusChecking', 'Checking…') : isOn ? tx('quickStatusOn', 'Active') : tx('quickStatusOff', 'Off');
              return (
                <div
                  key={row.id}
                  data-testid={`quick-${row.id}`}
                  data-module-state={!hasModule ? 'none' : checking ? 'checking' : isOn ? 'on' : 'off'}
                  className={`flex h-full min-w-0 flex-col justify-center gap-4 rounded-xl border p-4 sm:p-5 transition-colors ${off ? 'border-border/40 bg-background/20' : 'border-border/60 bg-background/40'}`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
                    <div className="min-w-0 max-w-full">
                      <div className="flex items-center gap-1.5">
                        <Label className="mb-0 min-w-0 truncate">{t(row.label)}</Label>
                        <InfoHint>{t(row.hint, { module: moduleName || '' })}</InfoHint>
                      </div>
                      {hasModule ? <div className="mt-1 truncate text-xs text-muted-foreground">{moduleName}</div> : null}
                    </div>
                    {hasModule && moduleSwitch ? (
                      <div
                        className={`flex max-w-full shrink-0 items-center gap-2.5 rounded-full border py-1.5 pl-3 pr-2 text-xs font-medium transition-colors ${checking ? 'border-border/50 bg-secondary/20 text-muted-foreground' : isOn ? 'border-[#e6cd8c]/40 bg-[#e6cd8c]/10 text-[#e6cd8c]' : 'border-border/60 bg-secondary/30 text-muted-foreground'}`}
                      >
                        <span className="inline-flex items-center gap-1.5">
                          <span className={`inline-block h-1.5 w-1.5 rounded-full ${checking ? 'animate-pulse bg-muted-foreground/60' : isOn ? 'bg-emerald-400' : 'bg-muted-foreground/60'}`} />
                          {statusText}
                        </span>
                        <Switch
                          checked={!checking && isOn}
                          disabled={checking || switching}
                          onCheckedChange={(v) => moduleSwitch.toggle(row.module, v)}
                          aria-label={isOn ? tc('disableModule', { module: moduleName }) : tc('enableModule', { module: moduleName })}
                        />
                      </div>
                    ) : null}
                  </div>
                  <div className={`min-w-0 transition-opacity ${locked || listMissing ? 'opacity-50' : ''}`} aria-disabled={disabled || undefined}>
                    {renderControl(row, { value, disabled })}
                  </div>
                  {off ? (
                    <p className="flex items-center gap-1.5 text-xs text-amber-500">
                      <Lock className="h-3.5 w-3.5 shrink-0" />{tx('quickModuleOffLocked', 'The module is off. Switch it on to change this setting.')}
                    </p>
                  ) : null}
                  {listMissing && !off ? (
                    <p className="text-xs text-amber-500">{tx('channelsNotLoaded', 'The channel list could not be loaded from Discord right now. Your saved channels are safe. It is retried automatically, or you can retry now.')}</p>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </Card>
  );
}

function NicknameField({ saved, disabled, onSave, t }) {
  const [value, setValue] = useState(saved);
  useEffect(() => { setValue(saved); }, [saved]);
  const dirty = value.trim() !== (saved || '');
  const submit = () => { if (dirty && !disabled) onSave(value.trim()); };
  return (
    <div className="space-y-2" data-testid="bot-nickname">
      <div className="flex gap-2">
        <Input
          value={value}
          maxLength={32}
          placeholder={t('botNicknamePlaceholder')}
          disabled={disabled}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } }}
          aria-label={t('botNickname')}
        />
        <Button type="button" onClick={submit} disabled={disabled || !dirty} className="shrink-0">{t('botNicknameSave')}</Button>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>{dirty ? <span className="text-[#e6cd8c]">{t('botNicknameUnsaved')}</span> : `${value.length}/32`}</span>
        {saved ? <Button type="button" size="sm" variant="outline" disabled={disabled} onClick={() => onSave('')}>{t('botNicknameReset')}</Button> : null}
      </div>
    </div>
  );
}

'use client';
import { useMemo, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Bell, CalendarDays, Cake, Palette, Settings2, SlidersHorizontal, Users, ScrollText, Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ChannelSelect, RoleSelect, SectionHeader } from '@/components/dashboard-kit';
import {
  ButtonsEditor, ColorField, DiscordMessagePreview, Field, IssueBanner, LoadingOrError, ModuleTabs, NativeSelect, QuickSetup, RecommendedBar,
  Section, SaveFooter, SendTestButton, SetupDone, SwitchRow, VariableChips, callApi, useApi, useDiagnose, useDraft, useSave, FieldErrorList,
} from '@/components/module-kit';
import {
  BIRTHDAY_VARIABLES, CARD_TEMPLATES, DURATIONS, LANGS, LANG_NAMES, MENTIONS, PRIVACY, REMINDER_DAYS, REMINDER_VARIABLES,
  botText, fillTemplate, insertAtCursor, recommendedSettings, sampleContext, timezoneList,
} from '@/components/modules/birthdays-shared';
import { MembersTab, HistoryTab } from '@/components/modules/BirthdaysMembers';

export default function BirthdaysPanel({ guildId, meta }) {
  const api = useApi(guildId, 'birthdays');
  return (
    <LoadingOrError loading={api.loading} error={api.error} data={api.data} onRetry={api.reload}>
      {api.data ? <Editor guildId={guildId} meta={meta} data={api.data} reload={api.reload} /> : null}
    </LoadingOrError>
  );
}

function Editor({ guildId, meta, data, reload }) {
  const t = useTranslations('guildSettings.birthdays');
  const tk = useTranslations('guildSettings.kit');
  const tc = useTranslations('guildSettings.common');
  const form = useDraft(data.settings);
  const diagnose = useDiagnose(guildId, 'modules/diagnose?module=birthdays');
  const [tab, setTab] = useState('general');
  const [wizard, setWizard] = useState(!data.settings.setup_completed);
  const [justFinished, setJustFinished] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [wizardErrors, setWizardErrors] = useState([]);
  const { save, saving, errors } = useSave(guildId, 'birthdays', {
    onSaved: () => { diagnose.run(); },
    testAction: () => setTab('appearance'),
  });
  const s = form.draft;
  const serverName = meta?.guild?.name;
  const lang = 'en';
  const channels = meta?.channels || [];
  const roles = meta?.roles || [];

  const doSave = async () => {
    if (await save(form.patch)) form.reset({ ...form.draft });
  };

  const finishWizard = async () => {
    setFinishing(true);
    setWizardErrors([]);
    const r = await callApi(guildId, 'birthdays', { method: 'PUT', body: { ...form.draft, setup_completed: true } });
    setFinishing(false);
    if (r.ok) {
      form.reset({ ...form.draft, setup_completed: true });
      setWizard(false);
      setJustFinished(true);
      diagnose.run();
      toast.success(tk('saved'));
    } else if (r.data?.error === 'validation_failed') setWizardErrors(r.data.errors || []);
    else toast.error(tk('apiErrors.generic'));
  };

  const recommended = recommendedSettings(s, channels);
  const recommendedRows = [
    { label: t('fields.channel'), value: recommended.channel_id ? `#${channels.find((c) => c.id === recommended.channel_id)?.name || '…'}` : t('values.keepCurrent') },
    { label: t('fields.announce'), value: tk('on') },
    { label: t('fields.card'), value: tk('on') },
    { label: t('fields.reminders'), value: tk('off') },
    { label: t('fields.showAge'), value: tk('off') },
    { label: t('fields.privacyDefault'), value: t(`privacy.${recommended.privacy_default}`) },
    { label: t('fields.roleDuration'), value: t('durations.24') },
    { label: t('fields.timezone'), value: recommended.timezone },
  ];

  const issueCount = diagnose.issues.filter((i) => i.severity === 'error').length;

  if (wizard) {
    const steps = [
      {
        key: 'channel', title: t('wizard.channelTitle'), description: t('wizard.channelText'),
        valid: () => Boolean(s.channel_id),
        render: () => (
          <Field label={t('fields.channel')} hint={t('hints.channel')} level="required" recommended="#birthdays">
            <ChannelSelect value={s.channel_id} onChange={(v) => form.set({ channel_id: v })} channels={channels} includeNone={false} />
          </Field>
        ),
      },
      {
        key: 'role', title: t('wizard.roleTitle'), description: t('wizard.roleText'),
        render: () => (
          <>
            <Field label={t('fields.role')} hint={t('hints.role')} level="optional">
              <RoleSelect value={s.role_id} onChange={(v) => form.set({ role_id: v })} roles={roles} />
            </Field>
            {s.role_id ? <DurationFields s={s} set={form.set} t={t} errors={wizardErrors} /> : null}
          </>
        ),
      },
      {
        key: 'message', title: t('wizard.messageTitle'), description: t('wizard.messageText'),
        render: () => (
          <div className="grid gap-5 lg:grid-cols-2">
            <div className="space-y-4">
              <Field label={t('fields.title')} hint={t('hints.title')}>
                <Input value={s.msg_title} onChange={(e) => form.set({ msg_title: e.target.value })} maxLength={256} placeholder={botText(lang, 'birthday.default_title')} />
              </Field>
              <Field label={t('fields.description')} hint={t('hints.description')}>
                <Textarea rows={5} value={s.msg_description} onChange={(e) => form.set({ msg_description: e.target.value })} maxLength={1800} placeholder={botText(lang, 'birthday.default_description', { user: '{user}', server: '{server}' })} />
              </Field>
            </div>
            <MessagePreview s={s} lang={lang} serverName={serverName} guildIcon={meta?.guild} />
          </div>
        ),
      },
      {
        key: 'privacy', title: t('wizard.privacyTitle'), description: t('wizard.privacyText'),
        render: () => <PrivacyFields s={s} set={form.set} t={t} errors={wizardErrors} />,
      },
      {
        key: 'preview', title: t('wizard.previewTitle'), description: t('wizard.previewText'),
        render: () => <MessagePreview s={s} lang={lang} serverName={serverName} guildIcon={meta?.guild} />,
      },
      {
        key: 'enable', title: t('wizard.enableTitle'), description: t('wizard.enableText'),
        render: () => (
          <div className="space-y-2 rounded-xl border border-border/50 bg-secondary/10 p-4 text-sm">
            {[[t('fields.channel'), s.channel_id ? `#${channels.find((c) => c.id === s.channel_id)?.name || ''}` : '-'],
              [t('fields.role'), s.role_id ? `@${roles.find((r) => r.id === s.role_id)?.name || ''}` : tk('none')],
              [t('fields.card'), s.card_enabled ? tk('on') : tk('off')],
              [t('fields.privacyDefault'), t(`privacy.${s.privacy_default}`)],
              [t('fields.showAge'), s.show_age ? tk('on') : tk('off')],
              [t('fields.timezone'), s.timezone]].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3"><span className="text-muted-foreground">{k}</span><span className="font-medium">{v}</span></div>
            ))}
          </div>
        ),
      },
    ];
    return (
      <div className="space-y-6">
        <SectionHeader title={t('title')} description={t('description')} />
        <QuickSetup
          title={t('wizard.title')} intro={t('wizard.intro')} steps={steps} finishing={finishing} errors={wizardErrors}
          finishLabel={t('wizard.finish')} onFinish={finishWizard} onSkip={() => setWizard(false)}
        />
      </div>
    );
  }

  const tabs = [
    { key: 'general', label: t('tabs.general'), icon: Settings2 },
    { key: 'notifications', label: t('tabs.notifications'), icon: Bell },
    { key: 'appearance', label: t('tabs.appearance'), icon: Palette },
    { key: 'members', label: t('tabs.members'), icon: Users },
    { key: 'advanced', label: t('tabs.advanced'), icon: SlidersHorizontal },
    { key: 'history', label: t('tabs.history'), icon: ScrollText },
  ];

  return (
    <div className="space-y-2">
      <SectionHeader title={t('title')} description={t('description')} />
      {justFinished ? <SetupDone onOpenAdvanced={() => { setJustFinished(false); setTab('advanced'); }} /> : null}
      <ModuleTabs tabs={tabs} active={tab} onChange={setTab} badges={{ general: issueCount || null }} />
      {tab === 'general' ? (
        <div className="space-y-5">
          <IssueBanner issues={diagnose.issues} loading={diagnose.loading} onRefresh={diagnose.run} />
          {diagnose.unreachable ? <p className="text-xs text-amber-300">{tk('issues.bot_unreachable')}</p> : null}
          <RecommendedBar items={recommendedRows} onApply={() => form.set(recommended)} />
          <Section title={t('sections.role')} description={t('sections.roleText')} icon={Cake}>
            <Field label={t('fields.role')} hint={t('hints.role')} level="optional" errors={errors} field="role_id">
              <RoleSelect value={s.role_id} onChange={(v) => form.set({ role_id: v })} roles={roles} />
            </Field>
            {s.role_id ? <DurationFields s={s} set={form.set} t={t} errors={errors} /> : null}
          </Section>
          <Section title={t('sections.privacy')} description={t('sections.privacyText')} icon={Sparkles}>
            <PrivacyFields s={s} set={form.set} t={t} errors={errors} />
          </Section>
        </div>
      ) : null}
      {tab === 'notifications' ? <NotificationsTab guildId={guildId} s={s} set={form.set} channels={channels} roles={roles} errors={errors} t={t} dirty={form.dirty} lang={lang} /> : null}
      {tab === 'appearance' ? (
        <AppearanceTab guildId={guildId} s={s} set={form.set} errors={errors} t={t} dirty={form.dirty} lang={lang} serverName={serverName} meta={meta} />
      ) : null}
      {tab === 'members' ? <MembersTab guildId={guildId} settings={s} serverLanguage={lang} onChanged={reload} /> : null}
      {tab === 'advanced' ? <AdvancedTab s={s} set={form.set} errors={errors} t={t} serverLanguage={data.server_language} /> : null}
      {tab === 'history' ? <HistoryTab guildId={guildId} /> : null}
      {['general', 'notifications', 'appearance', 'advanced'].includes(tab) ? (
        <SaveFooter dirty={form.dirty} saving={saving} errors={errors} onSave={doSave} onDiscard={() => form.setDraft(form.saved)} />
      ) : null}
      <span className="hidden">{tc('saved')}</span>
    </div>
  );
}


function DurationFields({ s, set, t, errors }) {
  return (
    <>
      <Field label={t('fields.roleDuration')} hint={t('hints.roleDuration')} level="recommended" recommended={t('durations.24')} errors={errors} field="role_duration">
        <NativeSelect label={t('fields.roleDuration')} value={s.role_duration} onChange={(v) => set({ role_duration: v })}
          options={DURATIONS.map((d) => ({ value: d, label: t(`durations.${d}`) }))} />
      </Field>
      {s.role_duration === 'custom' ? (
        <Field label={t('fields.roleHours')} hint={t('hints.roleHours')} level="optional" errors={errors} field="role_hours">
          <Input type="number" min={1} max={168} value={s.role_hours} onChange={(e) => set({ role_hours: Number(e.target.value) })} />
        </Field>
      ) : null}
    </>
  );
}

function PrivacyFields({ s, set, t, errors }) {
  const zones = useMemo(() => timezoneList(), []);
  return (
    <>
      <Field label={t('fields.privacyDefault')} hint={t('hints.privacyDefault')} level="recommended" recommended={t('privacy.community')} errors={errors} field="privacy_default">
        <NativeSelect label={t('fields.privacyDefault')} value={s.privacy_default} onChange={(v) => set({ privacy_default: v })}
          options={PRIVACY.map((p) => ({ value: p, label: `${t(`privacy.${p}`)} - ${t(`privacyHelp.${p}`)}` }))} />
      </Field>
      <Field label={t('fields.timezone')} hint={t('hints.timezone')} level="recommended" errors={errors} field="timezone">
        <Input list="wody-timezones" value={s.timezone} onChange={(e) => set({ timezone: e.target.value })} placeholder="Europe/Bucharest" />
        <datalist id="wody-timezones">{zones.map((z) => <option key={z} value={z} />)}</datalist>
      </Field>
      <Field label={t('fields.leapPolicy')} hint={t('hints.leapPolicy')} level="optional" errors={errors} field="leap_policy">
        <NativeSelect label={t('fields.leapPolicy')} value={s.leap_policy} onChange={(v) => set({ leap_policy: v })}
          options={[{ value: 'feb28', label: t('leap.feb28') }, { value: 'mar1', label: t('leap.mar1') }]} />
      </Field>
      <SwitchRow label={t('fields.showAge')} hint={t('hints.showAge')} level="advanced" checked={s.show_age} onChange={(v) => set({ show_age: v })} />
    </>
  );
}

function MessagePreview({ s, lang, serverName, guildIcon }) {
  const tk = useTranslations('guildSettings.kit');
  const ctx = sampleContext({ lang, serverName, showAge: s.show_age });
  const embed = {
    color: s.msg_color,
    title: fillTemplate(s.msg_title || botText(lang, 'birthday.default_title'), { ...ctx, user: ctx.user }),
    description: fillTemplate(s.msg_description || botText(lang, 'birthday.default_description'), ctx),
    footer: fillTemplate(s.msg_footer, ctx),
    timestamp: s.msg_timestamp,
  };
  const card = s.card_enabled ? {
    backgroundUrl: s.card_background_url || null, overlayColor: s.card_overlay_color, overlayOpacity: s.card_overlay_opacity, textColor: s.card_text_color,
    ringColor: s.card_color, avatarUrl: s.card_avatar_mode === 'none' ? null : (s.card_avatar_mode === 'server' && guildIcon?.icon ? `https://cdn.discordapp.com/icons/${guildIcon.id}/${guildIcon.icon}.png?size=256` : 'https://cdn.discordapp.com/embed/avatars/0.png'),
    avatarRing: s.card_avatar_ring,
    title: fillTemplate(s.card_title || botText(lang, 'birthday.card_title'), ctx),
    message: fillTemplate(s.card_message || botText(lang, 'birthday.card_message'), ctx),
    footer: fillTemplate(s.card_footer, ctx),
  } : null;
  const thumbnailUrl = s.msg_thumbnail === 'avatar' ? 'https://cdn.discordapp.com/embed/avatars/0.png' : (s.msg_thumbnail === 'server' && guildIcon?.icon ? `https://cdn.discordapp.com/icons/${guildIcon.id}/${guildIcon.icon}.png?size=128` : null);
  const mention = s.mention_mode === 'member' ? '@Alex' : s.mention_mode === 'role' ? '@Birthday' : null;
  return (
    <DiscordMessagePreview
      mention={mention} embed={embed} card={card} useEmbed={s.use_embed} thumbnailUrl={thumbnailUrl} imageUrl={s.msg_image_url || null}
      buttons={(s.msg_buttons || []).filter((b) => b.label)} label={tk('preview.title')}
    />
  );
}

function NotificationsTab({ guildId, s, set, channels, roles, errors, t, dirty, lang }) {
  const tk = useTranslations('guildSettings.kit');
  const [board, setBoard] = useState({ busy: false });
  const refreshBoard = async () => {
    setBoard({ busy: true });
    const r = await callApi(guildId, 'birthdays/board', { method: 'POST' });
    setBoard({ busy: false });
    if (r.ok) toast.success(t('board.posted')); else toast.error(r.data?.message || tk('apiErrors.generic'));
  };
  const toggleDay = (d) => set({ reminder_days: s.reminder_days.includes(d) ? s.reminder_days.filter((x) => x !== d) : [...s.reminder_days, d].sort((a, b) => a - b) });
  return (
    <div className="space-y-5">
      <Section title={t('sections.announcement')} description={t('sections.announcementText')} icon={Bell}>
        <SwitchRow label={t('fields.announce')} hint={t('hints.announce')} level="recommended" checked={s.announce_enabled} onChange={(v) => set({ announce_enabled: v })} />
        {s.announce_enabled ? (
          <>
            <Field label={t('fields.channel')} hint={t('hints.channel')} level="required" recommended="#birthdays" errors={errors} field="channel_id">
              <ChannelSelect value={s.channel_id} onChange={(v) => set({ channel_id: v })} channels={channels} />
            </Field>
            <Field label={t('fields.mention')} hint={t('hints.mention')} level="optional" errors={errors} field="mention_mode">
              <NativeSelect label={t('fields.mention')} value={s.mention_mode} onChange={(v) => set({ mention_mode: v })}
                options={MENTIONS.map((m) => ({ value: m, label: t(`mentions.${m}`) }))} />
            </Field>
            {s.mention_mode === 'role' ? (
              <Field label={t('fields.mentionRole')} hint={t('hints.mentionRole')} level="optional" errors={errors} field="mention_role_id">
                <RoleSelect value={s.mention_role_id} onChange={(v) => set({ mention_role_id: v })} roles={roles} />
              </Field>
            ) : null}
            <SendTestButton
              label={t('test.announcement')} disabled={dirty} disabledReason={dirty ? tk('test.saveFirst') : undefined}
              onSend={() => callApi(guildId, 'birthdays/test', { method: 'POST', body: { what: 'announcement' } })}
            />
          </>
        ) : null}
      </Section>
      <Section title={t('sections.reminders')} description={t('sections.remindersText')} icon={CalendarDays}>
        <SwitchRow label={t('fields.reminders')} hint={t('hints.reminders')} level="optional" checked={s.reminder_enabled} onChange={(v) => set({ reminder_enabled: v })} />
        {s.reminder_enabled ? (
          <>
            <Field label={t('fields.reminderDays')} hint={t('hints.reminderDays')} level="required" errors={errors} field="reminder_days">
              <div className="flex flex-wrap gap-2">
                {REMINDER_DAYS.map((d) => (
                  <Button key={d} type="button" size="sm" variant={s.reminder_days.includes(d) ? 'default' : 'outline'} aria-pressed={s.reminder_days.includes(d)} onClick={() => toggleDay(d)}
                    className={s.reminder_days.includes(d) ? 'bg-[#e6cd8c] text-[#1a1208] hover:bg-[#f3e1b0]' : ''}>{t('reminderDay', { days: d })}</Button>
                ))}
              </div>
            </Field>
            <Field label={t('fields.reminderChannel')} hint={t('hints.reminderChannel')} level="required" errors={errors} field="reminder_channel_id">
              <ChannelSelect value={s.reminder_channel_id} onChange={(v) => set({ reminder_channel_id: v })} channels={channels} />
            </Field>
            <Field label={t('fields.reminderRole')} hint={t('hints.reminderRole')} level="optional" errors={errors} field="reminder_role_id">
              <RoleSelect value={s.reminder_role_id} onChange={(v) => set({ reminder_role_id: v })} roles={roles} />
            </Field>
            <Field label={t('fields.reminderMessage')} hint={t('hints.reminderMessage')} level="optional" errors={errors} field="reminder_message">
              <Textarea rows={2} value={s.reminder_message} onChange={(e) => set({ reminder_message: e.target.value })} maxLength={400} placeholder={botText(lang, 'birthday.reminder_default', { user: '{user}', when: '{when}' })} />
            </Field>
            <VariableChips variables={REMINDER_VARIABLES} describe={(v) => t(`vars.${v}`)} onInsert={(tok) => set({ reminder_message: `${s.reminder_message}${tok}` })} />
            <SendTestButton
              label={t('test.reminder')} disabled={dirty} disabledReason={dirty ? tk('test.saveFirst') : undefined}
              onSend={() => callApi(guildId, 'birthdays/test', { method: 'POST', body: { what: 'reminder' } })}
            />
          </>
        ) : null}
      </Section>
      <Section title={t('sections.board')} description={t('sections.boardText')} icon={Cake}>
        <SwitchRow label={t('fields.board')} hint={t('hints.board')} level="optional" checked={s.board_enabled} onChange={(v) => set({ board_enabled: v })} />
        {s.board_enabled ? (
          <>
            <Field label={t('fields.boardChannel')} hint={t('hints.boardChannel')} level="required" errors={errors} field="board_channel_id">
              <ChannelSelect value={s.board_channel_id} onChange={(v) => set({ board_channel_id: v })} channels={channels} />
            </Field>
            <Field label={t('fields.boardUpcoming')} hint={t('hints.boardUpcoming')} level="optional" errors={errors} field="board_upcoming">
              <Input type="number" min={1} max={10} value={s.board_upcoming} onChange={(e) => set({ board_upcoming: Number(e.target.value) })} />
            </Field>
            <Button variant="outline" onClick={refreshBoard} disabled={dirty || board.busy} className="gap-2">
              {board.busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Cake className="h-4 w-4" />}{t('board.post')}
            </Button>
            {dirty ? <p className="text-xs text-muted-foreground">{tk('test.saveFirst')}</p> : <p className="text-xs text-muted-foreground">{t('board.note')}</p>}
          </>
        ) : null}
      </Section>
    </div>
  );
}

function AppearanceTab({ guildId, s, set, errors, t, dirty, lang, serverName, meta }) {
  const tk = useTranslations('guildSettings.kit');
  const refs = { title: useRef(null), description: useRef(null), footer: useRef(null) };
  const [focused, setFocused] = useState('description');
  const insert = (token) => {
    const map = { title: ['msg_title', refs.title], description: ['msg_description', refs.description], footer: ['msg_footer', refs.footer] };
    const [key, ref] = map[focused];
    insertAtCursor(ref.current, token, s[key] || '', (value) => set({ [key]: value }));
  };
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
      <div className="space-y-5">
        <Section title={t('sections.message')} description={t('sections.messageText')} icon={Palette}>
          <SwitchRow label={t('fields.useEmbed')} hint={t('hints.useEmbed')} level="optional" checked={s.use_embed} onChange={(v) => set({ use_embed: v })} />
          <Field label={t('fields.title')} hint={t('hints.title')} errors={errors} field="msg_title">
            <Input ref={refs.title} value={s.msg_title} onFocus={() => setFocused('title')} onChange={(e) => set({ msg_title: e.target.value })} maxLength={256} placeholder={botText(lang, 'birthday.default_title')} />
          </Field>
          <Field label={t('fields.description')} hint={t('hints.description')} errors={errors} field="msg_description">
            <Textarea ref={refs.description} rows={5} value={s.msg_description} onFocus={() => setFocused('description')} onChange={(e) => set({ msg_description: e.target.value })} maxLength={1800}
              placeholder={botText(lang, 'birthday.default_description', { user: '{user}', server: '{server}' })} />
          </Field>
          <VariableChips variables={BIRTHDAY_VARIABLES} describe={(v) => t(`vars.${v}`)} onInsert={insert} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('fields.color')} hint={t('hints.color')} errors={errors} field="msg_color"><ColorField label={t('fields.color')} value={s.msg_color} onChange={(v) => set({ msg_color: v })} /></Field>
            <Field label={t('fields.thumbnail')} hint={t('hints.thumbnail')}>
              <NativeSelect label={t('fields.thumbnail')} value={s.msg_thumbnail} onChange={(v) => set({ msg_thumbnail: v })}
                options={['avatar', 'server', 'none'].map((m) => ({ value: m, label: t(`thumbs.${m}`) }))} />
            </Field>
          </div>
          <Field label={t('fields.image')} hint={t('hints.image')} level="optional" errors={errors} field="msg_image_url">
            <Input value={s.msg_image_url} onChange={(e) => set({ msg_image_url: e.target.value })} placeholder="https://" disabled={s.card_enabled} />
            {s.card_enabled ? <p className="mt-1 text-[11px] text-muted-foreground">{t('hints.imageCard')}</p> : null}
          </Field>
          <Field label={t('fields.footer')} hint={t('hints.footer')} errors={errors} field="msg_footer">
            <Input ref={refs.footer} value={s.msg_footer} onFocus={() => setFocused('footer')} onChange={(e) => set({ msg_footer: e.target.value })} maxLength={200} />
          </Field>
          <SwitchRow label={t('fields.timestamp')} hint={t('hints.timestamp')} level="optional" checked={s.msg_timestamp} onChange={(v) => set({ msg_timestamp: v })} />
          <Field label={t('fields.buttons')} hint={t('hints.buttons')} level="optional">
            <ButtonsEditor value={s.msg_buttons} onChange={(v) => set({ msg_buttons: v })} max={2} errors={errors} field="msg_buttons" />
          </Field>
        </Section>
        <Section title={t('sections.card')} description={t('sections.cardText')} icon={Cake}>
          <SwitchRow label={t('fields.card')} hint={t('hints.card')} level="recommended" checked={s.card_enabled} onChange={(v) => set({ card_enabled: v })} />
          {s.card_enabled ? (
            <>
              <Field label={t('fields.template')} hint={t('hints.template')} level="optional">
                <div className="flex flex-wrap gap-2">
                  {Object.entries(CARD_TEMPLATES).map(([name, preset]) => (
                    <Button key={name} type="button" size="sm" variant={s.card_template === name ? 'default' : 'outline'} aria-pressed={s.card_template === name}
                      onClick={() => set({ ...preset, card_template: name })} className={`gap-2 ${s.card_template === name ? 'bg-[#e6cd8c] text-[#1a1208] hover:bg-[#f3e1b0]' : ''}`}>
                      <span className="h-3 w-3 rounded-full border border-white/30" style={{ background: preset.card_color }} />{t(`templates.${name}`)}
                    </Button>
                  ))}
                </div>
              </Field>
              <Field label={t('fields.cardBackground')} hint={t('hints.cardBackground')} level="optional" errors={errors} field="card_background_url">
                <Input value={s.card_background_url} onChange={(e) => set({ card_background_url: e.target.value })} placeholder="https://" />
              </Field>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label={t('fields.cardOverlay')} hint={t('hints.cardOverlay')} errors={errors} field="card_overlay_color"><ColorField label={t('fields.cardOverlay')} value={s.card_overlay_color} onChange={(v) => set({ card_overlay_color: v })} /></Field>
                <Field label={t('fields.cardText')} hint={t('hints.cardText')} errors={errors} field="card_text_color"><ColorField label={t('fields.cardText')} value={s.card_text_color} onChange={(v) => set({ card_text_color: v })} /></Field>
                <Field label={t('fields.cardAccent')} hint={t('hints.cardAccent')} errors={errors} field="card_color"><ColorField label={t('fields.cardAccent')} value={s.card_color} onChange={(v) => set({ card_color: v })} /></Field>
              </div>
              <Field label={t('fields.cardOpacity', { value: s.card_overlay_opacity })} hint={t('hints.cardOpacity')} errors={errors} field="card_overlay_opacity">
                <input type="range" min={0} max={100} value={s.card_overlay_opacity} onChange={(e) => set({ card_overlay_opacity: Number(e.target.value) })} className="w-full accent-[#e6cd8c]" aria-label={t('fields.cardOpacity', { value: s.card_overlay_opacity })} />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t('fields.cardAvatar')} hint={t('hints.cardAvatar')}>
                  <NativeSelect label={t('fields.cardAvatar')} value={s.card_avatar_mode} onChange={(v) => set({ card_avatar_mode: v })}
                    options={['member', 'server', 'none'].map((m) => ({ value: m, label: t(`avatars.${m}`) }))} />
                </Field>
                <Field label={t('fields.cardSize')} hint={t('hints.cardSize')}>
                  <NativeSelect label={t('fields.cardSize')} value={s.card_size} onChange={(v) => set({ card_size: v })}
                    options={['narrow', 'medium', 'large'].map((m) => ({ value: m, label: t(`sizes.${m}`) }))} />
                </Field>
              </div>
              <SwitchRow label={t('fields.cardRing')} hint={t('hints.cardRing')} level="optional" checked={s.card_avatar_ring} onChange={(v) => set({ card_avatar_ring: v })} />
              <Field label={t('fields.cardTitle')} hint={t('hints.cardTitle')} errors={errors} field="card_title">
                <Input value={s.card_title} onChange={(e) => set({ card_title: e.target.value })} maxLength={120} placeholder={botText(lang, 'birthday.card_title')} />
              </Field>
              <Field label={t('fields.cardMessage')} hint={t('hints.cardMessage')} errors={errors} field="card_message">
                <Input value={s.card_message} onChange={(e) => set({ card_message: e.target.value })} maxLength={240} placeholder={botText(lang, 'birthday.card_message')} />
              </Field>
              <Field label={t('fields.cardFooter')} hint={t('hints.cardFooter')} errors={errors} field="card_footer">
                <Input value={s.card_footer} onChange={(e) => set({ card_footer: e.target.value })} maxLength={140} />
              </Field>
            </>
          ) : null}
        </Section>
      </div>
      <div className="space-y-4 xl:sticky xl:top-24 xl:self-start">
        <MessagePreview s={s} lang={lang} serverName={serverName} guildIcon={meta?.guild} />
        <SendTestButton
          label={t('test.announcement')} disabled={dirty || !s.channel_id}
          disabledReason={dirty ? tk('test.saveFirst') : (!s.channel_id ? t('test.needChannel') : undefined)}
          onSend={() => callApi(guildId, 'birthdays/test', { method: 'POST', body: { what: 'announcement' } })}
        />
      </div>
    </div>
  );
}

function AdvancedTab({ s, set, errors, t, serverLanguage }) {
  const locale = useLocale();
  return (
    <div className="space-y-5">
      <Section title={t('sections.privacyAdvanced')} description={t('sections.privacyAdvancedText')} icon={SlidersHorizontal}>
        <SwitchRow label={t('fields.showAge')} hint={t('hints.showAge')} level="advanced" checked={s.show_age} onChange={(v) => set({ show_age: v })} />
        <SwitchRow label={t('fields.dmPrivate')} hint={t('hints.dmPrivate')} level="advanced" checked={s.dm_private} onChange={(v) => set({ dm_private: v })} />
      </Section>
      {errors.length ? <FieldErrorList errors={errors} /> : null}
    </div>
  );
}

'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Link } from '@/i18n/navigation';
import { AlertTriangle, CheckCircle2, Loader2, Plug, Plus, RefreshCw, Search, Settings2, Trash2, Unplug } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ChannelSelect, RoleSelect, SectionHeader, Empty } from '@/components/dashboard-kit';
import {
  ButtonsEditor, ColorField, ConfirmDialog, DiscordMessagePreview, Field, IssueBanner, LoadingOrError, ModuleTabs, NativeSelect, PremiumLock, Section,
  SaveFooter, SendTestButton, StatusDot, SwitchRow, VariableChips, callApi, formatDate, renderTemplate, useApi, useDraft, useErrorText, avatarSrc,
} from '@/components/module-kit';
import { LANGS, LANG_NAMES, botText, insertAtCursor } from '@/components/modules/birthdays-shared';

const VARIABLES = ['streamer', 'streamer_name', 'title', 'game', 'viewers', 'url', 'started_at'];
const PLATFORM_COLOR = { twitch: '#9146ff', kick: '#53fc18', tiktok: '#fe2c55' };

export default function StreamsPanel({ guildId, meta, onGetPremium }) {
  const t = useTranslations('guildSettings.streams');
  const api = useApi(guildId, 'streams');
  const premium = api.data ? api.data.premium !== false : null;
  return (
    <LoadingOrError loading={api.loading} error={api.error} data={api.data} onRetry={api.reload}>
      {api.data && !premium ? <PremiumLock title={t('lock.title')} text={t('lock.text')} onGetPremium={onGetPremium} /> : null}
      {api.data && premium ? <Editor guildId={guildId} meta={meta} data={api.data} reload={api.reload} /> : null}
    </LoadingOrError>
  );
}

function Editor({ guildId, meta, data, reload }) {
  const t = useTranslations('guildSettings.streams');
  const tk = useTranslations('guildSettings.kit');
  const [platform, setPlatform] = useState('twitch');
  const [adding, setAdding] = useState(false);
  const [openId, setOpenId] = useState(null);
  const [removing, setRemoving] = useState(null);
  const [busy, setBusy] = useState(false);
  const diag = useApi(guildId, 'streams/diagnose');
  const issuesById = diag.data?.result?.issues || {};
  const notifications = data.notifications.filter((n) => n.platform === platform);
  const provider = data.providers?.[platform] || { available: false, reason: 'not_configured' };

  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      const result = url.searchParams.get('tiktok');
      if (!result) return;
      setPlatform('tiktok');
      if (result === 'connected') toast.success(t('tiktok.result.connected')); else toast.error(t(`tiktok.result.${['denied', 'expired', 'failed', 'invalid', 'unavailable'].includes(result) ? result : 'failed'}`));
      url.searchParams.delete('tiktok');
      window.history.replaceState({}, '', url.toString());
    } catch { }
  }, [t]);

  const remove = async () => {
    setBusy(true);
    const r = await callApi(guildId, `streams/${removing.id || removing._id}`, { method: 'DELETE' });
    setBusy(false);
    if (r.ok) { toast.success(t('removed')); setRemoving(null); setOpenId(null); reload(); } else toast.error(tk('apiErrors.generic'));
  };

  return (
    <div>
      <SectionHeader title={t('title')} description={t('description')} />
      <ModuleTabs
        active={platform} onChange={(p) => { setPlatform(p); setOpenId(null); }}
        tabs={[{ key: 'twitch', label: 'Twitch' }, { key: 'kick', label: 'Kick' }, { key: 'tiktok', label: 'TikTok' }]}
        badges={{}}
      />

      <ProviderBanner platform={platform} provider={provider} />

      {platform === 'tiktok' ? <TikTokConnections guildId={guildId} data={data} provider={provider} reload={reload} onUsed={async () => { await reload(); setAdding(true); }} /> : null}

      <div className="mb-3 mt-6 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{t('list.title', { count: notifications.length, max: data.max })}</h3>
        <Button size="sm" className="gap-1.5" onClick={() => setAdding(true)} disabled={!provider.available || data.notifications.length >= data.max}>
          <Plus className="h-4 w-4" />{t('add.button')}
        </Button>
      </div>

      {notifications.length === 0 ? (
        <Empty title={t('list.emptyTitle')} text={provider.available ? t(`list.emptyText.${platform}`) : t('list.emptyUnavailable')} />
      ) : (
        <div className="space-y-3">
          {notifications.map((n) => (
            <NotificationCard
              key={n._id} n={n} issues={issuesById[n._id]} onRecheck={diag.reload} rechecking={diag.loading} guildId={guildId} meta={meta} variables={data.variables || VARIABLES} open={openId === n._id}
              onToggle={() => setOpenId(openId === n._id ? null : n._id)} onChanged={reload} onRemove={() => setRemoving(n)}
            />
          ))}
        </div>
      )}

      {adding ? <AddDialog guildId={guildId} meta={meta} platform={platform} connections={data.connections} onClose={() => setAdding(false)} onAdded={(id) => { setAdding(false); reload().then(() => setOpenId(id)); }} /> : null}
      <ConfirmDialog
        open={Boolean(removing)} onOpenChange={(o) => { if (!o) setRemoving(null); }}
        title={t('remove.title')} description={t('remove.text')} confirmLabel={t('remove.confirm')} onConfirm={remove} busy={busy}
      />
    </div>
  );
}

function ProviderBanner({ platform, provider }) {
  const t = useTranslations('guildSettings.streams');
  if (provider.available) {
    return (
      <Card className="flex items-start gap-3 border-emerald-400/25 bg-emerald-500/[0.04] p-4 text-sm">
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
        <span>{t(`provider.${platform}.ok`)}</span>
      </Card>
    );
  }
  return (
    <Card className="border-amber-400/30 bg-amber-400/[0.05] p-4 text-sm" role="status">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
        <div>
          <div className="font-semibold text-amber-300">{t('provider.unavailable')}</div>
          <p className="mt-1 text-muted-foreground">{t(`provider.reason.${provider.reason || 'not_configured'}`)}</p>
        </div>
      </div>
    </Card>
  );
}

function StatusBadge({ n }) {
  const t = useTranslations('guildSettings.streams');
  const map = { enabled: 'ok', pending: 'warn', failed: 'bad', revoked: 'bad', disconnected: 'bad' };
  const status = n.enabled === false ? 'paused' : (n.sub_status || 'pending');
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <StatusDot tone={status === 'paused' ? 'muted' : map[status] || 'warn'} />{t(`status.${status}`)}
    </span>
  );
}

function NotificationCard({ n, issues, onRecheck, rechecking, guildId, meta, variables, open, onToggle, onChanged, onRemove }) {
  const t = useTranslations('guildSettings.streams');
  const name = n.platform === 'twitch' ? (n.twitch_display_name || n.twitch_login) : n.platform === 'kick' ? (n.kick_display_name || n.kick_slug) : (n.tiktok_display_name || n.tiktok_username);
  const avatar = n.platform === 'twitch' ? n.twitch_avatar : n.platform === 'kick' ? n.kick_avatar : n.tiktok_avatar;
  const channel = (meta?.channels || []).find((c) => String(c.id) === String(n.channel_id));
  const [reconnecting, setReconnecting] = useState(false);
  const needsFix = ['failed', 'revoked'].includes(n.sub_status);

  const reconnect = async () => {
    setReconnecting(true);
    const r = await callApi(guildId, `streams/${n._id}/reconnect`, { method: 'POST' });
    setReconnecting(false);
    if (r.ok) { toast.success(t('reconnected')); onChanged(); } else toast.error(t('reconnectFailed'));
  };

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 p-4">
        {avatar ? <img src={avatarSrc(avatar)} alt="" className="h-10 w-10 rounded-full object-cover" referrerPolicy="no-referrer" /> : <div className="h-10 w-10 rounded-full" style={{ background: PLATFORM_COLOR[n.platform] }} />}
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium">{name}</div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <StatusBadge n={n} />
            <span className="text-xs text-muted-foreground">#{channel?.name || n.channel_id}</span>
          </div>
        </div>
        {needsFix && n.platform === 'twitch' ? (
          <Button size="sm" variant="outline" onClick={reconnect} disabled={reconnecting} className="gap-1.5">{reconnecting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}{t('reconnect')}</Button>
        ) : null}
        <Button size="sm" variant={open ? 'secondary' : 'outline'} onClick={onToggle} aria-expanded={open} className="gap-1.5"><Settings2 className="h-4 w-4" />{t('configure')}</Button>
        <Button size="icon" variant="ghost" onClick={onRemove} aria-label={t('remove.confirm')}><Trash2 className="h-4 w-4 text-red-400" /></Button>
      </div>
      {issues && issues.length ? <div className="px-4 pb-4"><IssueBanner issues={issues} onRefresh={onRecheck} loading={rechecking} /></div> : null}
      {open ? <div className="border-t border-border/50 p-4"><NotificationEditor n={n} guildId={guildId} meta={meta} variables={variables} onSaved={onChanged} /></div> : null}
    </Card>
  );
}

function NotificationEditor({ n, guildId, meta, variables, onSaved }) {
  const t = useTranslations('guildSettings.streams');
  const tk = useTranslations('guildSettings.kit');
  const { apiErrorText } = useErrorText();
  const initial = useMemo(() => ({
    channel_id: n.channel_id || '', role_id: n.role_id || '', enabled: n.enabled !== false, notify_online: n.notify_online !== false,
    notify_offline: Boolean(n.notify_offline), cooldown_minutes: n.cooldown_minutes ?? 5, message: n.message,
  }), [n]);
  const form = useDraft(initial);
  const [tab, setTab] = useState('general');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState([]);
  const area = useRef(null);
  const [field, setField] = useState('description');
  const s = form.draft;
  const m = s.message;
  const setMsg = (patch) => form.set({ message: { ...m, ...patch } });
  const lang = 'en';
  const isTikTok = n.platform === 'tiktok';

  const save = async () => {
    setSaving(true); setErrors([]);
    const r = await callApi(guildId, `streams/${n._id}`, { method: 'PUT', body: form.patch });
    setSaving(false);
    if (r.ok) { toast.success(tk('saved')); form.reset({ ...form.draft }); onSaved(); return; }
    if (r.data?.error === 'validation_failed') setErrors(r.data.errors || []); else toast.error(apiErrorText(r.data?.error || 'generic'));
  };

  const isKick = n.platform === 'kick';
  const name = isTikTok ? (n.tiktok_display_name || n.tiktok_username) : isKick ? (n.kick_display_name || n.kick_slug) : (n.twitch_display_name || n.twitch_login);
  const sample = {
    streamer: name, streamer_name: name, title: t('sample.title'), game: t('sample.game'), viewers: '128',
    url: isTikTok ? `https://www.tiktok.com/@${n.tiktok_username || 'creator'}` : isKick ? `https://kick.com/${n.kick_slug || 'streamer'}` : `https://twitch.tv/${n.twitch_login || 'streamer'}`,
    started_at: new Date().toLocaleTimeString(),
  };
  const defaultTitle = botText(lang, isTikTok ? 'stream.tt_title' : 'stream.live_title');
  const defaultDesc = botText(lang, isTikTok ? 'stream.tt_description' : 'stream.live_description');
  const fill = (v) => renderTemplate(v, sample);
  const roleName = (meta?.roles || []).find((r) => String(r.id) === String(s.role_id))?.name;
  const label = isTikTok ? botText(lang, 'stream.btn_tiktok') : botText(lang, 'stream.btn_twitch');
  const buttons = [{ label: m.button_label || label, url: sample.url }, ...(m.buttons || [])].filter((b) => b.label);

  const insert = (token) => insertAtCursor(field === 'description' ? area.current : null, token, m[field], (v) => setMsg({ [field]: v }));

  const tabs = [{ key: 'general', label: tk('tabs.general') }, { key: 'appearance', label: tk('tabs.appearance') }, { key: 'advanced', label: tk('tabs.advanced') }];

  return (
    <div>
      <ModuleTabs tabs={tabs} active={tab} onChange={setTab} />

      {tab === 'general' ? (
        <div className="grid gap-5 md:grid-cols-2">
          <Field label={t('fields.channel')} hint={t('fields.channelHint')} level="required" errors={errors} field="channel_id">
            <ChannelSelect value={s.channel_id} onChange={(v) => form.set({ channel_id: v })} channels={meta?.channels || []} includeNone={false} placeholder={t('fields.channelPlaceholder')} />
          </Field>
          <Field label={t('fields.role')} hint={t('fields.roleHint')} level="optional" errors={errors} field="role_id">
            <RoleSelect value={s.role_id} onChange={(v) => form.set({ role_id: v })} roles={meta?.roles || []} placeholder={t('fields.rolePlaceholder')} />
          </Field>
          <SwitchRow label={t('fields.enabled')} hint={t('fields.enabledHint')} checked={s.enabled} onChange={(v) => form.set({ enabled: v })} />
          {!isTikTok ? <SwitchRow label={t('fields.notifyOnline')} hint={t('fields.notifyOnlineHint')} checked={s.notify_online} onChange={(v) => form.set({ notify_online: v })} /> : null}
          {!isTikTok ? <SwitchRow label={t('fields.notifyOffline')} hint={t('fields.notifyOfflineHint')} checked={s.notify_offline} onChange={(v) => form.set({ notify_offline: v })} /> : null}
        </div>
      ) : null}

      {tab === 'appearance' ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-4">
            <SwitchRow label={t('fields.useEmbed')} hint={t('fields.useEmbedHint')} checked={m.use_embed} onChange={(v) => setMsg({ use_embed: v })} />
            <Field label={t('fields.msgTitle')} hint={t('fields.msgTitleHint')} level="optional" errors={errors} field="message.title">
              <Input value={m.title} maxLength={256} placeholder={defaultTitle} onFocus={() => setField('title')} onChange={(e) => setMsg({ title: e.target.value })} />
            </Field>
            <Field label={t('fields.msgDescription')} hint={t('fields.msgDescriptionHint')} level="optional" errors={errors} field="message.description">
              <Textarea ref={area} rows={5} value={m.description} maxLength={1800} placeholder={defaultDesc} onFocus={() => setField('description')} onChange={(e) => setMsg({ description: e.target.value })} />
            </Field>
            <VariableChips variables={variables} onInsert={insert} describe={(v) => t(`variables.${v}`)} />
            <Field label={t('fields.color')} hint={t('fields.colorHint')} level="optional" errors={errors} field="message.color">
              <ColorField value={m.color} onChange={(v) => setMsg({ color: v })} label={t('fields.color')} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t('fields.thumbnail')} hint={t('fields.thumbnailHint')} level="optional">
                <NativeSelect value={m.thumbnail} onChange={(v) => setMsg({ thumbnail: v })} label={t('fields.thumbnail')} options={['streamer', 'game', 'none'].map((v) => ({ value: v, label: t(`thumbnail.${v}`) }))} />
              </Field>
              <Field label={t('fields.image')} hint={t('fields.imageHint')} level="optional">
                <NativeSelect value={m.image} onChange={(v) => setMsg({ image: v })} label={t('fields.image')} options={['media', 'custom', 'none'].map((v) => ({ value: v, label: t(`image.${v}`) }))} />
              </Field>
            </div>
            {m.image === 'custom' ? (
              <Field label={t('fields.imageUrl')} hint={t('fields.imageUrlHint')} level="required" errors={errors} field="message.image_url">
                <Input value={m.image_url} maxLength={500} placeholder="https://" onChange={(e) => setMsg({ image_url: e.target.value })} />
              </Field>
            ) : null}
            <Field label={t('fields.footer')} hint={t('fields.footerHint')} level="optional" errors={errors} field="message.footer">
              <Input value={m.footer} maxLength={200} onChange={(e) => setMsg({ footer: e.target.value })} />
            </Field>
            <SwitchRow label={t('fields.timestamp')} hint={t('fields.timestampHint')} checked={m.timestamp} onChange={(v) => setMsg({ timestamp: v })} />
            <Field label={t('fields.buttonLabel')} hint={t('fields.buttonLabelHint')} level="optional" errors={errors} field="message.button_label">
              <Input value={m.button_label} maxLength={80} placeholder={label} onChange={(e) => setMsg({ button_label: e.target.value })} />
            </Field>
            <Field label={t('fields.buttons')} hint={t('fields.buttonsHint')} level="optional">
              <ButtonsEditor value={m.buttons} onChange={(v) => setMsg({ buttons: v })} max={2} errors={errors} field="message.buttons" />
            </Field>
            {!isTikTok ? (
              <Section title={t('offline.title')} description={t('offline.text')}>
                <div className="space-y-4">
                  <Field label={t('fields.offlineTitle')} hint={t('fields.offlineTitleHint')} level="optional" errors={errors} field="message.offline_title">
                    <Input value={m.offline_title} maxLength={256} placeholder={botText(lang, 'stream.offline_title')} onChange={(e) => setMsg({ offline_title: e.target.value })} />
                  </Field>
                  <Field label={t('fields.offlineDescription')} hint={t('fields.offlineDescriptionHint')} level="optional" errors={errors} field="message.offline_description">
                    <Textarea rows={3} value={m.offline_description} maxLength={1000} placeholder={botText(lang, 'stream.offline_description')} onChange={(e) => setMsg({ offline_description: e.target.value })} />
                  </Field>
                  <Field label={t('fields.offlineColor')} hint={t('fields.colorHint')} level="optional" errors={errors} field="message.offline_color">
                    <ColorField value={m.offline_color} onChange={(v) => setMsg({ offline_color: v })} label={t('fields.offlineColor')} />
                  </Field>
                </div>
              </Section>
            ) : null}
          </div>
          <div className="space-y-4 lg:sticky lg:top-4 lg:self-start">
            <DiscordMessagePreview
              mention={roleName ? `@${roleName}` : null}
              useEmbed={m.use_embed}
              embed={{ color: m.color, title: fill(m.title || defaultTitle), description: fill(m.description || defaultDesc), footer: fill(m.footer), timestamp: m.timestamp }}
              thumbnailUrl={m.thumbnail !== 'none' ? (n.twitch_avatar || n.kick_avatar || n.tiktok_avatar || null) : null}
              imageUrl={m.image === 'custom' ? m.image_url : null}
              imagePlaceholder={(m.image || 'media') === 'media' ? (n.platform === 'tiktok' ? 'TikTok LIVE' : n.platform === 'kick' ? 'Kick stream preview' : 'Twitch stream preview') : null}
              buttons={buttons.map((b) => ({ ...b, label: fill(b.label) }))}
            />
            <div className="flex flex-wrap gap-3">
              <SendTestButton
                label={t('test.online')} disabled={form.dirty} disabledReason={form.dirty ? t('test.saveFirst') : undefined}
                onSend={() => callApi(guildId, `streams/${n._id}/test`, { method: 'POST', body: { kind: 'online' } })}
              />
              {!isTikTok ? (
                <SendTestButton
                  label={t('test.offline')} disabled={form.dirty}
                  onSend={() => callApi(guildId, `streams/${n._id}/test`, { method: 'POST', body: { kind: 'offline' } })}
                />
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {tab === 'advanced' ? (
        <div className="grid gap-5 md:grid-cols-2">
          <Field label={t('fields.cooldown')} hint={t('fields.cooldownHint')} level="advanced" errors={errors} field="cooldown_minutes">
            <Input type="number" min={0} max={1440} value={s.cooldown_minutes} onChange={(e) => form.set({ cooldown_minutes: e.target.value === '' ? '' : Number(e.target.value) })} />
          </Field>
          <div className="md:col-span-2 text-xs text-muted-foreground">
            {t(`advanced.${n.platform}Note`)}
          </div>
        </div>
      ) : null}

      <SaveFooter dirty={form.dirty} saving={saving} onSave={save} onDiscard={() => form.reset(initial)} errors={errors} />
    </div>
  );
}

function AddDialog({ guildId, meta, platform, connections, onClose, onAdded }) {
  const t = useTranslations('guildSettings.streams');
  const tk = useTranslations('guildSettings.kit');
  const { apiErrorText } = useErrorText();
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [searchError, setSearchError] = useState(null);
  const [pick, setPick] = useState(null);
  const [login, setLogin] = useState('');
  const [channelId, setChannelId] = useState('');
  const [roleId, setRoleId] = useState('');
  const [connectionId, setConnectionId] = useState(() => (connections || []).find((c) => c.status === 'connected')?.id || '');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState([]);

  useEffect(() => {
    if (platform !== 'twitch' || q.trim().length < 2) { setResults([]); return undefined; }
    let alive = true;
    const id = setTimeout(async () => {
      const r = await callApi(guildId, `streams/search?q=${encodeURIComponent(q.trim())}`);
      if (!alive) return;
      if (r.ok) { setResults(r.data.results || []); setSearchError(null); } else setSearchError(r.data?.error || 'generic');
    }, 350);
    return () => { alive = false; clearTimeout(id); };
  }, [q, platform, guildId]);

  const submit = async () => {
    setSaving(true); setErrors([]);
    const body = platform === 'twitch'
      ? { platform, twitch_login: pick?.login || login, channel_id: channelId, role_id: roleId || null }
      : platform === 'kick'
      ? { platform, kick_slug: login, channel_id: channelId, role_id: roleId || null }
      : { platform, connection_id: connectionId, channel_id: channelId, role_id: roleId || null };
    const r = await callApi(guildId, 'streams', { method: 'POST', body });
    setSaving(false);
    if (r.ok) { toast.success(t('add.created')); onAdded(r.data.id); return; }
    if (r.data?.error === 'validation_failed') setErrors(r.data.errors || []);
    else toast.error(r.data?.error === 'limit_reached' ? t('add.limit') : apiErrorText(r.data?.error || 'generic'));
  };

  const connected = (connections || []).filter((c) => c.status === 'connected');

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t(`add.title.${platform}`)}</DialogTitle>
          <DialogDescription>{t(`add.text.${platform}`)}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {platform === 'kick' ? (
            <Field label={t('add.streamer')} hint={t('add.kickHint')} level="required" errors={errors} field="kick_slug">
              <Input value={login} onChange={(e) => setLogin(e.target.value)} placeholder={t('add.kickPlaceholder')} maxLength={80} />
            </Field>
          ) : platform === 'twitch' ? (
            <Field label={t('add.streamer')} hint={t('add.streamerHint')} level="required" errors={errors} field="twitch_login">
              {pick ? (
                <div className="flex items-center gap-2 rounded-md border border-border/60 p-2">
                  <img src={avatarSrc(pick.avatar)} alt="" className="h-8 w-8 rounded-full" referrerPolicy="no-referrer" />
                  <span className="flex-1 text-sm">{pick.name}</span>
                  <Button size="sm" variant="ghost" onClick={() => { setPick(null); setQ(''); }}>{t('add.change')}</Button>
                </div>
              ) : (
                <>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input className="pl-9" value={q} onChange={(e) => { setQ(e.target.value); setLogin(e.target.value); }} placeholder={t('add.searchPlaceholder')} maxLength={80} />
                  </div>
                  {searchError ? <p className="mt-1 text-xs text-muted-foreground">{t('add.searchFailed')}</p> : null}
                  {results.length ? (
                    <ul className="mt-1 max-h-52 overflow-y-auto rounded-md border border-border/60">
                      {results.map((r) => (
                        <li key={r.id}>
                          <button type="button" onClick={() => setPick(r)} className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm hover:bg-secondary/60">
                            <img src={avatarSrc(r.avatar)} alt="" className="h-7 w-7 rounded-full" referrerPolicy="no-referrer" />
                            <span className="flex-1 truncate">{r.name}</span>
                            {r.live ? <Badge className="bg-red-500/80 text-[10px]">LIVE</Badge> : null}
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  <p className="mt-1 text-[11px] text-muted-foreground">{t('add.pasteHint')}</p>
                </>
              )}
            </Field>
          ) : (
            <Field label={t('add.account')} hint={t('add.accountHint')} level="required" errors={errors} field="connection_id">
              {connected.length ? (
                connected.length === 1 ? (
                  <div className="flex items-center gap-2 rounded-md border border-border/60 p-2">
                    {connected[0].avatar_url ? <img src={avatarSrc(connected[0].avatar_url)} alt="" className="h-8 w-8 rounded-full" referrerPolicy="no-referrer"  onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }} /> : <div className="h-8 w-8 rounded-full bg-secondary" />}
                    <span className="flex-1 truncate text-sm">{connected[0].display_name || connected[0].username} (@{connected[0].username})</span>
                  </div>
                ) : (
                  <NativeSelect value={connectionId} onChange={setConnectionId} label={t('add.account')}
                    options={connected.map((c) => ({ value: c.id, label: `${c.display_name || c.username} (@${c.username})` }))} />
                )
              ) : <p className="rounded-md border border-dashed border-border/60 p-3 text-sm text-muted-foreground">{t('add.noAccount')}</p>}
            </Field>
          )}
          <Field label={t('fields.channel')} hint={t('fields.channelHint')} level="required" errors={errors} field="channel_id">
            <ChannelSelect value={channelId} onChange={setChannelId} channels={meta?.channels || []} includeNone={false} placeholder={t('fields.channelPlaceholder')} />
          </Field>
          <Field label={t('fields.role')} hint={t('fields.roleHint')} level="optional" errors={errors} field="role_id">
            <RoleSelect value={roleId} onChange={setRoleId} roles={meta?.roles || []} placeholder={t('fields.rolePlaceholder')} />
          </Field>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>{tk('cancel')}</Button>
          <Button onClick={submit} disabled={saving || !channelId || (platform === 'twitch' ? !(pick || login.trim()) : platform === 'kick' ? !login.trim() : !connectionId)} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}{t('add.create')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TikTokConnections({ guildId, data, provider, reload, onUsed }) {
  const t = useTranslations('guildSettings.streams');
  const locale = useLocale();
  const [busy, setBusy] = useState(null);
  const [removing, setRemoving] = useState(null);

  const connect = async () => {
    setBusy('connect');
    const r = await callApi(guildId, 'streams/tiktok/connect', { method: 'POST' });
    setBusy(null);
    if (r.ok && r.data?.url) window.location.assign(r.data.url); else toast.error(t('tiktok.connectFailed'));
  };
  const refresh = async (c) => {
    setBusy(c.id);
    const r = await callApi(guildId, `streams/tiktok/connections/${c.id}/refresh`, { method: 'POST' });
    setBusy(null);
    if (r.ok) { toast.success(t('tiktok.refreshed')); reload(); } else { toast.error(t('tiktok.refreshFailed')); reload(); }
  };
  const useMine = async () => {
    setBusy('mine');
    const r = await callApi(guildId, 'streams/tiktok/use-mine', { method: 'POST' });
    setBusy(null);
    if (r.ok) { toast.success(t('tiktok.useDone')); onUsed(); } else toast.error(t('tiktok.useFailed'));
  };
  const disconnect = async () => {
    setBusy(removing.id);
    const r = await callApi(guildId, `streams/tiktok/connections/${removing.id}`, { method: 'DELETE' });
    setBusy(null);
    if (r.ok) { toast.success(t('tiktok.disconnected')); setRemoving(null); reload(); } else toast.error(t('tiktok.disconnectFailed'));
  };

  return (
    <div className="mt-6">
      <Card className="mb-3 border-border/60 bg-secondary/10 p-4 text-sm">
        <div className="font-semibold">{t('tiktok.limitTitle')}</div>
        <p className="mt-1 text-muted-foreground">{t('tiktok.limitText')}</p>
      </Card>
      {data.my_tiktok ? (
        <Card data-my-tiktok className="mb-3 flex flex-wrap items-center gap-3 border-[#fe2c55]/30 bg-[#fe2c55]/[0.04] p-4">
          {data.my_tiktok.avatar_url ? <img src={avatarSrc(data.my_tiktok.avatar_url)} alt="" className="h-10 w-10 rounded-full" referrerPolicy="no-referrer"  onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }} /> : <div className="h-10 w-10 rounded-full bg-secondary" />}
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold">{t('tiktok.useTitle')}</div>
            <p className="truncate text-xs text-muted-foreground">{data.my_tiktok.display_name || data.my_tiktok.username}{data.my_tiktok.username ? ` (@${data.my_tiktok.username})` : ''}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{data.my_tiktok.already ? t('tiktok.usedAlready') : t('tiktok.useText')}</p>
          </div>
          <Button size="sm" className="gap-1.5" onClick={useMine} disabled={!provider.available || data.my_tiktok.already || busy === 'mine'}>
            {busy === 'mine' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plug className="h-4 w-4" />}{data.my_tiktok.already ? t('tiktok.usedShort') : t('tiktok.useButton')}
          </Button>
        </Card>
      ) : (
        <Card className="mb-3 flex flex-wrap items-center gap-3 border-border/60 bg-secondary/10 p-4">
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold">{t('tiktok.linkTitle')}</div>
            <p className="mt-0.5 text-xs text-muted-foreground">{t('tiktok.linkHint')}</p>
          </div>
          <Button asChild size="sm" variant="outline" className="gap-1.5"><Link href="/tiktok"><Plug className="h-4 w-4" />{t('tiktok.linkCta')}</Link></Button>
        </Card>
      )}
      {data.connections.length > 0 ? <h3 className="mb-3 text-sm font-semibold">{t('tiktok.accounts')}</h3> : null}
      {data.connections.length === 0 ? null : (
        <ul className="divide-y divide-border/50 rounded-2xl border border-border/60">
          {data.connections.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-3 p-3">
              {c.avatar_url ? <img src={avatarSrc(c.avatar_url)} alt="" className="h-9 w-9 rounded-full" referrerPolicy="no-referrer"  onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }} /> : <div className="h-9 w-9 rounded-full bg-secondary" />}
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{c.display_name || c.username}</div>
                <div className="flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5"><StatusDot tone={c.status === 'connected' ? 'ok' : 'bad'} />{t(`tiktok.status.${c.status}`)}</span>
                  {c.last_poll_at ? <span>{t('tiktok.lastCheck', { date: formatDate(c.last_poll_at, locale) })}</span> : null}
                </div>
              </div>
              <Button size="sm" variant="outline" disabled={busy === c.id} onClick={() => (c.status === 'connected' ? refresh(c) : connect())} className="gap-1.5">
                <RefreshCw className="h-3.5 w-3.5" />{c.status === 'connected' ? t('tiktok.refresh') : t('tiktok.reconnect')}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setRemoving(c)} className="gap-1.5 text-red-400"><Unplug className="h-3.5 w-3.5" />{t('tiktok.disconnect')}</Button>
            </li>
          ))}
        </ul>
      )}
      <ConfirmDialog
        open={Boolean(removing)} onOpenChange={(o) => { if (!o) setRemoving(null); }}
        title={t('tiktok.disconnectTitle')} description={t('tiktok.disconnectText')} confirmLabel={t('tiktok.disconnect')} onConfirm={disconnect} busy={Boolean(busy)}
      />
    </div>
  );
}

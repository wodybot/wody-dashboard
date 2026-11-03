'use client';
import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import {
  BarChart3, Bell, CheckCircle2, Database, Info, Link2, Loader2, RefreshCw, Settings2, Trophy, UserPlus, Users, Sparkles, ScrollText,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ChannelSelect, SectionHeader } from '@/components/dashboard-kit';
import InviteStats from '@/components/modules/InviteStats';
import {
  ConfirmDialog, Field, IssueBanner, LoadingOrError, ModuleTabs, NativeSelect, Pager, Section, SaveFooter, SwitchRow, VariableChips,
  avatarSrc, callApi, formatDate, useApi, useDiagnose, useDraft, useErrorText, useSave,
} from '@/components/module-kit';

const NOTIFY_VARS = ['user.mention', 'user.name', 'user.id', 'guild.name', 'member_count', 'inviter', 'inviter.mention', 'inviter.name', 'inviter.id', 'inviter.invites', 'invite.code'];
const WELCOME_VARS = ['inviter', 'inviter.mention', 'inviter.name', 'inviter.id', 'inviter.invites', 'invite.code'];
const REASONS = ['no_permission', 'fetch_failed', 'ambiguous', 'invite_removed', 'no_match', 'tracking_started'];
const varKey = (v) => v.replace('.', '_');

export default function InvitesPanel({ guildId, meta, onOpenModule }) {
  const api = useApi(guildId, 'invites');
  return (
    <LoadingOrError loading={api.loading} error={api.error} data={api.data} onRetry={api.reload}>
      {api.data ? <Editor guildId={guildId} meta={meta} data={api.data} reload={api.reload} onOpenModule={onOpenModule} /> : null}
    </LoadingOrError>
  );
}

function Editor({ guildId, meta, data, reload, onOpenModule }) {
  const t = useTranslations('guildSettings.invites');
  const form = useDraft(data.settings);
  const diagnose = useDiagnose(guildId, 'modules/diagnose?module=invite_tracking');
  const [tab, setTab] = useState('overview');
  const { save, saving, errors } = useSave(guildId, 'invites', { onSaved: () => { diagnose.run(); } });
  const s = form.draft;
  const channels = meta?.channels || [];
  const issueCount = diagnose.issues.filter((i) => i.severity === 'error').length;

  const doSave = async () => {
    const sent = form.patch;
    if (await save(sent)) form.commit(sent);
  };

  const tabs = [
    { key: 'overview', label: t('tabs.overview'), icon: BarChart3 },
    { key: 'statistics', label: t('tabs.statistics'), icon: BarChart3 },
    { key: 'leaderboard', label: t('tabs.leaderboard'), icon: Trophy },
    { key: 'recent', label: t('tabs.recent'), icon: ScrollText },
    { key: 'settings', label: t('tabs.settings'), icon: Settings2 },
    { key: 'welcome', label: t('tabs.welcome'), icon: Sparkles },
    { key: 'data', label: t('tabs.data'), icon: Database },
  ];

  return (
    <div className="space-y-2">
      <SectionHeader title={t('title')} description={t('description')} />
      <ModuleTabs tabs={tabs} active={tab} onChange={setTab} badges={{ overview: issueCount || null }} />
      {tab === 'overview' ? <OverviewTab guildId={guildId} data={data} diagnose={diagnose} reload={reload} t={t} /> : null}
      {tab === 'statistics' ? <InviteStats guildId={guildId} /> : null}
      {tab === 'leaderboard' ? <LeaderboardTab guildId={guildId} t={t} /> : null}
      {tab === 'recent' ? <RecentTab guildId={guildId} t={t} /> : null}
      {tab === 'settings' ? <SettingsTab s={s} set={form.set} channels={channels} errors={errors} t={t} /> : null}
      {tab === 'welcome' ? <WelcomeTab t={t} onOpenModule={onOpenModule} /> : null}
      {tab === 'data' ? <DataTab guildId={guildId} t={t} onChanged={reload} /> : null}
      {tab === 'settings' ? (
        <SaveFooter dirty={form.dirty} saving={saving} errors={errors} onSave={doSave} onDiscard={() => form.setDraft(form.saved)} />
      ) : null}
    </div>
  );
}


function Stat({ label, value, hint, text }) {
  return (
    <Card className="bg-card/60 p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{text ?? Number(value || 0).toLocaleString()}</div>
      {hint ? <div className="mt-1 text-[11px] leading-snug text-muted-foreground">{hint}</div> : null}
    </Card>
  );
}

function OverviewTab({ guildId, data, diagnose, reload, t }) {
  const tk = useTranslations('guildSettings.kit');
  const [busy, setBusy] = useState(false);
  const codes = useApi(guildId, 'invites/codes');
  const { apiErrorText } = useErrorText();
  const tot = data.totals || {};

  const resync = async () => {
    setBusy(true);
    const r = await callApi(guildId, 'invites/resync', { method: 'POST', body: {} });
    setBusy(false);
    if (r.ok) { toast.success(t('overview.resyncDone')); diagnose.run(); reload(); codes.reload(); }
    else toast.error(r.data?.error === 'bot_unreachable' ? tk('issues.bot_unreachable') : apiErrorText(r.data?.error || 'generic'));
  };

  const reasonRows = REASONS.filter((k) => (data.unknown_reasons || {})[k]);
  return (
    <div className="space-y-5">
      <IssueBanner issues={diagnose.issues} loading={diagnose.loading} onRefresh={diagnose.run} />
      {diagnose.unreachable ? <p className="text-xs text-amber-300">{tk('issues.bot_unreachable')}</p> : null}
      <Card className="flex flex-col gap-3 border-border/50 bg-secondary/10 p-3 sm:flex-row sm:items-center sm:justify-end">
        <Button variant="outline" size="sm" onClick={resync} disabled={busy} className="gap-1.5 self-start sm:self-auto">
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}{t('overview.resync')}
        </Button>
      </Card>

      <Card className="flex items-start gap-3 border-sky-400/25 bg-sky-500/[0.04] p-4 text-sm">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-sky-400" />
        <div>
          <div className="font-semibold">{t('overview.historyTitle')}</div>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{t('overview.historyText')}</p>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={t('stats.discordUses')} value={tot.discord_uses} hint={t('stats.discordUsesHint')} />
        <Stat label={t('stats.before')} value={tot.before_tracking} hint={t('stats.beforeHint')} />
        <Stat label={t('stats.joins')} value={tot.joins} />
        <Stat label={t('stats.attributed')} value={tot.attributed} hint={t('stats.attributedHint')} />
        <Stat label={t('stats.unknown')} value={tot.unknown} hint={t('stats.unknownHint')} />
        <Stat label={t('stats.vanity')} value={tot.vanity} hint={t('stats.vanityHint')} />
        <Stat label={t('stats.left')} value={tot.left} />
        <Stat label={t('stats.joins30')} value={tot.joins_30d} />
        <Stat label={t('stats.codes')} value={tot.codes} />
        <Stat label={t('stats.baseline')} text={data.baseline ? '✓' : '✗'} hint={data.baseline ? t('stats.baselineYes') : t('stats.baselineNo')} />
      </div>

      {reasonRows.length ? (
        <Section title={t('overview.reasonsTitle')} description={t('overview.reasonsText')} icon={Users}>
          <ul className="space-y-2 text-sm">
            {reasonRows.map((k) => (
              <li key={k} className="flex items-start justify-between gap-4 rounded-lg border border-border/50 bg-secondary/10 px-3 py-2">
                <div className="min-w-0">
                  <div className="font-medium">{t(`reasons.${k}`)}</div>
                  <div className="text-xs text-muted-foreground">{t(`reasons.${k}Hint`)}</div>
                </div>
                <span className="font-semibold tabular-nums">{Number(data.unknown_reasons[k]).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      <Section title={t('overview.codesTitle')} description={t('overview.codesText')} icon={Link2}>
        {codes.loading && !codes.data ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
        {codes.data && !codes.data.rows.length ? <p className="text-sm text-muted-foreground">{t('overview.codesEmpty')}</p> : null}
        {codes.data?.rows?.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr><th className="py-1.5 pr-3 font-medium">{t('codes.code')}</th><th className="py-1.5 pr-3 font-medium">{t('codes.by')}</th><th className="py-1.5 pr-3 text-right font-medium">{t('codes.uses')}</th><th className="py-1.5 pr-3 text-right font-medium">{t('codes.tracked')}</th><th className="py-1.5 text-right font-medium">{t('codes.before')}</th></tr>
              </thead>
              <tbody>
                {codes.data.rows.map((c) => (
                  <tr key={c.code} className="border-t border-border/40">
                    <td className="py-1.5 pr-3 font-mono text-xs">{c.code}</td>
                    <td className="py-1.5 pr-3">{c.inviter_name || (c.inviter_id ? c.inviter_id : t('codes.unknownCreator'))}</td>
                    <td className="py-1.5 pr-3 text-right tabular-nums">{c.uses}{c.max_uses ? ` / ${c.max_uses}` : ''}</td>
                    <td className="py-1.5 pr-3 text-right tabular-nums">{c.tracked}</td>
                    <td className="py-1.5 text-right tabular-nums">{c.before}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </Section>

      <Section title={t('overview.defsTitle')} description={t('overview.defsText')} icon={Info}>
        <dl className="grid gap-3 sm:grid-cols-2">
          {['total', 'valid', 'left', 'fake', 'retained', 'rank'].map((k) => (
            <div key={k} className="rounded-lg border border-border/50 bg-secondary/10 p-3">
              <dt className="text-sm font-semibold">{t(`defs.${k}`)}</dt>
              <dd className="mt-1 text-xs leading-relaxed text-muted-foreground">{t(`defs.${k}Text`)}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section title={t('overview.howTitle')} description={t('overview.howText')} icon={UserPlus}>
        <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
          {['how1', 'how2', 'how3'].map((k) => <li key={k}>{t(`overview.${k}`)}</li>)}
        </ul>
      </Section>
    </div>
  );
}


function PersonCell({ name, id, avatar, left, t }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      {avatarSrc(avatar) ? <img src={avatarSrc(avatar)} alt="" className="h-6 w-6 shrink-0 rounded-full" /> : <span className="h-6 w-6 shrink-0 rounded-full bg-secondary/60" />}
      <div className="min-w-0">
        <div className="truncate font-medium">{name || id}</div>
        {left ? <div className="text-[10px] text-muted-foreground">{t('leaderboard.leftServer')}</div> : null}
      </div>
    </div>
  );
}

function LeaderboardTab({ guildId, t }) {
  const { errorText } = useErrorText();
  const [period, setPeriod] = useState('all');
  const [page, setPage] = useState(0);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [applied, setApplied] = useState({ from: '', to: '' });
  const custom = period === 'custom';
  const ready = !custom || Boolean(applied.from || applied.to);
  const qs = `period=${period}&page=${page}${custom ? `&from=${applied.from}&to=${applied.to}` : ''}`;
  const api = useApi(guildId, ready ? `invites/leaderboard?${qs}` : 'invites/leaderboard?period=all&page=0');
  const rows = ready ? api.data?.rows : null;
  const serverErrors = api.error === 'validation_failed' ? (api.details?.errors?.length ? api.details.errors : [{ field: 'from', code: 'invalid_range' }]) : [];

  return (
    <div className="space-y-4">
      <Card className="space-y-3 bg-card/60 p-4">
        <div className="grid gap-3 sm:grid-cols-[220px_1fr]">
          <Field label={t('leaderboard.period')}>
            <NativeSelect
              value={period} label={t('leaderboard.period')}
              onChange={(v) => { setPeriod(v); setPage(0); }}
              options={['all', 'month', 'week', 'custom'].map((k) => ({ value: k, label: t(`periods.${k}`) }))}
            />
          </Field>
          {custom ? (
            <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
              <Field label={t('leaderboard.from')}><Input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} /></Field>
              <Field label={t('leaderboard.to')}><Input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} /></Field>
              <Button variant="outline" disabled={!from && !to} onClick={() => { setApplied({ from, to }); setPage(0); }}>{t('leaderboard.apply')}</Button>
            </div>
          ) : <p className="self-end pb-2 text-xs text-muted-foreground">{t(`periodsHint.${period}`)}</p>}
        </div>
        {serverErrors.map((e, i) => <p key={i} className="text-xs text-red-400">{errorText(e)}</p>)}
      </Card>

      {custom && !ready ? <p className="text-sm text-muted-foreground">{t('leaderboard.pickRange')}</p> : null}
      {ready && api.loading && !api.data ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /> : null}
      {ready && api.error && api.error !== 'validation_failed' ? <p className="text-sm text-red-400">{t('leaderboard.loadFailed')}</p> : null}
      {rows && !rows.length ? (
        <Card className="bg-card/40 p-8 text-center text-sm text-muted-foreground">{t('leaderboard.empty')}</Card>
      ) : null}
      {rows && rows.length ? (
        <Card className="overflow-x-auto bg-card/60 p-2 sm:p-4">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr>
                <th className="w-10 py-2 pr-2 font-medium">#</th>
                <th className="py-2 pr-3 font-medium">{t('leaderboard.member')}</th>
                <th className="py-2 pr-3 text-right font-medium">{t('leaderboard.valid')}</th>
                <th className="py-2 pr-3 text-right font-medium">{t('leaderboard.total')}</th>
                <th className="py-2 pr-3 text-right font-medium">{t('leaderboard.left')}</th>
                <th className="py-2 pr-3 text-right font-medium">{t('leaderboard.fake')}</th>
                <th className="py-2 text-right font-medium">{t('leaderboard.retained')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.user_id} className="border-t border-border/40">
                  <td className="py-2 pr-2 tabular-nums text-muted-foreground">{r.rank}</td>
                  <td className="py-2 pr-3"><PersonCell name={r.name} id={r.user_id} avatar={r.avatar_url} left={r.left_server} t={t} /></td>
                  <td className="py-2 pr-3 text-right font-semibold tabular-nums">{r.valid}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{r.total}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{r.left}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{r.fake}</td>
                  <td className="py-2 text-right tabular-nums">{r.retained}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pager page={page} total={api.data.total} perPage={api.data.per_page} onChange={setPage} />
        </Card>
      ) : null}
    </div>
  );
}


function RecentTab({ guildId, t }) {
  const locale = useLocale();
  const [page, setPage] = useState(0);
  const api = useApi(guildId, `invites/recent?page=${page}`);
  const rows = api.data?.rows;
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t('recent.text')}</p>
      {api.loading && !api.data ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /> : null}
      {api.error && !api.data ? <p className="text-sm text-red-400">{t('leaderboard.loadFailed')}</p> : null}
      {rows && !rows.length ? <Card className="bg-card/40 p-8 text-center text-sm text-muted-foreground">{t('recent.empty')}</Card> : null}
      {rows && rows.length ? (
        <Card className="overflow-x-auto bg-card/60 p-2 sm:p-4">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr>
                <th className="py-2 pr-3 font-medium">{t('recent.member')}</th>
                <th className="py-2 pr-3 font-medium">{t('recent.invitedBy')}</th>
                <th className="py-2 pr-3 font-medium">{t('recent.how')}</th>
                <th className="py-2 pr-3 font-medium">{t('recent.status')}</th>
                <th className="py-2 text-right font-medium">{t('recent.when')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={`${r.user_id}-${r.joined_at}-${i}`} className="border-t border-border/40 align-top">
                  <td className="py-2 pr-3"><PersonCell name={r.name} id={r.user_id} avatar={r.avatar_url} left={r.left_server} t={t} /></td>
                  <td className="py-2 pr-3">
                    {r.inviter_id ? (r.inviter_name || r.inviter_id) : <span className="text-muted-foreground">{t('recent.unknown')}</span>}
                    {!r.inviter_id && r.reason && t.has(`reasons.${r.reason}`) ? <div className="text-[11px] text-muted-foreground">{t(`reasons.${r.reason}`)}</div> : null}
                  </td>
                  <td className="py-2 pr-3 text-xs">
                    <div>{t.has(`source.${r.source}`) ? t(`source.${r.source}`) : t('source.unknown')}{r.code ? <span className="ml-1 font-mono text-muted-foreground">{r.code}</span> : null}</div>
                    <div className="text-muted-foreground">{t.has(`confidence.${r.confidence}`) ? t(`confidence.${r.confidence}`) : t('confidence.none')}</div>
                  </td>
                  <td className="py-2 pr-3 text-xs">
                    {r.left ? <span className="text-muted-foreground">{t('recent.left')}</span> : <span className="text-emerald-300">{t('recent.here')}</span>}
                    {r.fake ? <span className="ml-1.5 text-amber-300">{t('recent.fake')}</span> : null}
                  </td>
                  <td className="py-2 text-right text-xs text-muted-foreground">{formatDate(r.joined_at, locale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pager page={page} total={api.data.total} perPage={api.data.per_page} onChange={setPage} />
        </Card>
      ) : null}
    </div>
  );
}


function SettingsTab({ s, set, channels, errors, t }) {
  return (
    <div className="space-y-5">
      <Section title={t('settings.logTitle')} description={t('settings.logText')} icon={ScrollText}>
        <SwitchRow label={t('settings.logEnabled')} hint={t('settings.logEnabledHint')} checked={Boolean(s.log_enabled)} onChange={(v) => set({ log_enabled: v })} />
        <Field label={t('settings.logChannel')} hint={t('settings.logChannelHint')} level={s.log_enabled ? 'required' : 'optional'} errors={errors} field="log_channel_id">
          <ChannelSelect value={s.log_channel_id} onChange={(v) => set({ log_channel_id: v })} channels={channels} />
        </Field>
      </Section>

      <Section title={t('settings.notifyTitle')} description={t('settings.notifyText')} icon={Bell}>
        <SwitchRow label={t('settings.notifyEnabled')} hint={t('settings.notifyEnabledHint')} checked={Boolean(s.notify_enabled)} onChange={(v) => set({ notify_enabled: v })} />
        <Field label={t('settings.notifyChannel')} hint={t('settings.notifyChannelHint')} level={s.notify_enabled ? 'required' : 'optional'} errors={errors} field="notify_channel_id">
          <ChannelSelect value={s.notify_channel_id} onChange={(v) => set({ notify_channel_id: v })} channels={channels} />
        </Field>
        <Field label={t('settings.notifyMessage')} hint={t('settings.notifyMessageHint')} errors={errors} field="notify_message">
          <Textarea rows={3} value={s.notify_message} maxLength={500} onChange={(e) => set({ notify_message: e.target.value })} />
        </Field>
        <Field label={t('settings.notifyUnknown')} hint={t('settings.notifyUnknownHint')} errors={errors} field="notify_unknown_message">
          <Textarea rows={2} value={s.notify_unknown_message} maxLength={500} onChange={(e) => set({ notify_unknown_message: e.target.value })} />
        </Field>
        <VariableChips
          variables={NOTIFY_VARS} describe={(v) => t(`vars.${varKey(v)}`)}
          onInsert={(tok) => set({ notify_message: `${s.notify_message}${s.notify_message && !s.notify_message.endsWith(' ') ? ' ' : ''}${tok}` })}
        />
        <p className="text-xs text-muted-foreground">{t('settings.postsEnglish')}</p>
      </Section>

      <Section title={t('settings.statsTitle')} description={t('settings.statsText')} icon={Users}>
        <Field label={t('settings.visibility')} hint={t('settings.visibilityHint')} errors={errors} field="stats_visibility">
          <NativeSelect
            value={s.stats_visibility} label={t('settings.visibility')} onChange={(v) => set({ stats_visibility: v })}
            options={[{ value: 'everyone', label: t('settings.visEveryone') }, { value: 'staff', label: t('settings.visStaff') }]}
          />
        </Field>
        <Field label={t('settings.minAge')} hint={t('settings.minAgeHint')} errors={errors} field="min_account_age_days">
          <Input
            type="number" inputMode="numeric" min={0} max={365} value={s.min_account_age_days}
            onChange={(e) => set({ min_account_age_days: e.target.value === '' ? 0 : Number.parseInt(e.target.value, 10) || 0 })}
          />
        </Field>
      </Section>
    </div>
  );
}


function WelcomeTab({ t, onOpenModule }) {
  return (
    <div className="space-y-5">
      <Section title={t('welcome.title')} description={t('welcome.text')} icon={Sparkles}>
        <ul className="space-y-2">
          {WELCOME_VARS.map((v) => (
            <li key={v} className="flex flex-col gap-0.5 rounded-lg border border-border/50 bg-secondary/10 px-3 py-2 sm:flex-row sm:items-baseline sm:gap-3">
              <code className="shrink-0 font-mono text-xs text-[#e6cd8c]">{`{${v}}`}</code>
              <span className="text-sm text-muted-foreground">{t(`vars.${varKey(v)}`)}</span>
            </li>
          ))}
        </ul>
        <p className="text-xs leading-relaxed text-muted-foreground">{t('welcome.neutral')}</p>
        <p className="text-xs leading-relaxed text-muted-foreground">{t('welcome.needsModule')}</p>
        <Button variant="outline" onClick={() => onOpenModule?.('welcome')} className="gap-2 self-start">{t('welcome.open')}</Button>
      </Section>
    </div>
  );
}


function DataTab({ guildId, t, onChanged }) {
  const [dialog, setDialog] = useState(null);
  const [userId, setUserId] = useState('');
  const [busy, setBusy] = useState(false);
  const idOk = /^\d{15,25}$/.test(userId.trim());
  const { apiErrorText } = useErrorText();

  const run = async () => {
    setBusy(true);
    const body = { confirm: true, ...(dialog === 'user' ? { user_id: userId.trim() } : {}) };
    const r = await callApi(guildId, 'invites/reset', { method: 'POST', body });
    setBusy(false);
    if (r.ok) {
      toast.success(t('data.done', { count: r.data.deleted ?? 0 }));
      setDialog(null);
      if (dialog === 'user') setUserId('');
      onChanged?.();
    } else toast.error(apiErrorText(r.data?.error || 'generic'));
  };

  return (
    <div className="space-y-5">
      <Section title={t('data.storedTitle')} description={t('data.storedText')} icon={Database}>
        <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
          {['stored1', 'stored2', 'stored3'].map((k) => <li key={k}>{t(`data.${k}`)}</li>)}
        </ul>
      </Section>
      <Section title={t('data.resetUserTitle')} description={t('data.resetUserText')} icon={Users}>
        <Field label={t('data.userId')} hint={t('data.userIdHint')}>
          <Input value={userId} inputMode="numeric" maxLength={25} onChange={(e) => setUserId(e.target.value.replace(/\D/g, ''))} placeholder="123456789012345678" />
        </Field>
        <Button variant="outline" disabled={!idOk} onClick={() => setDialog('user')}>{t('data.resetUser')}</Button>
      </Section>
      <Section title={t('data.resetAllTitle')} description={t('data.resetAllText')} icon={Trophy}>
        <Button variant="destructive" onClick={() => setDialog('all')}>{t('data.resetAll')}</Button>
      </Section>
      <ConfirmDialog
        open={Boolean(dialog)} onOpenChange={(v) => { if (!v) setDialog(null); }} busy={busy}
        title={dialog === 'user' ? t('data.confirmUserTitle') : t('data.confirmAllTitle')}
        description={dialog === 'user' ? t('data.confirmUserText', { id: userId.trim() }) : t('data.confirmAllText')}
        confirmLabel={t('data.confirm')} typed="RESET" onConfirm={run}
      />
    </div>
  );
}

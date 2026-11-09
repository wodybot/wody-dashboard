'use client';
// Dashboard > Counting. Create a counting game in a channel, tune every rule, and run competitions.
// The page never writes Counting data: each save is a request to the bot, which validates it and answers with field level problems.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ClipboardList, Pause, Play, Plus, RotateCcw, Save, Settings, Trash2, Trophy, Archive } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ConfirmDialog, ModuleTabs, formatDate, LoadingOrError } from '@/components/module-kit';
import { ChannelSelect, SaveBar } from '@/components/dashboard-kit';
import { MODES, COMPETITION_MODES } from '@/lib/counting/constants';
import { SECTIONS, TABS, MESSAGE_KEYS, LANGS, GOAL_TYPES, GOAL_UNITS } from '@/lib/counting/schema';
import { ct, useCt, useCtText, ConfigField, Problems, NumberInput, TextInput, SelectInput, DateInput, F } from './ct-kit';

const clone = (v) => JSON.parse(JSON.stringify(v ?? null));

function Toast({ message, tone }) {
  if (!message) return null;
  return <p role="status" className={`rounded-md border px-3 py-2 text-sm ${tone === 'error' ? 'border-red-400/40 bg-red-500/10 text-red-300' : 'border-emerald-400/40 bg-emerald-500/10 text-emerald-300'}`}>{message}</p>;
}

// ---------------------------------------------------------------------------------------------- games
function GamesTab({ guildId, meta, games, reload, onEdit }) {
  const t = useTranslations('counting');
  const modeT = useTranslations('counting.mode');
  const stateT = useTranslations('counting.state');
  const { api } = useCtText();
  const [channel, setChannel] = useState('');
  const [mode, setMode] = useState('classic');
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState([]);
  const [note, setNote] = useState(null);
  const [confirm, setConfirm] = useState(null);

  const create = async () => {
    setBusy(true); setErrors([]); setNote(null);
    const r = await ct(`guilds/${guildId}/games`, { method: 'POST', body: { channel_id: channel, mode } });
    setBusy(false);
    if (r.ok) { setNote({ tone: 'ok', text: t('games.created') }); setChannel(''); reload(); return; }
    if (r.data?.errors) setErrors(r.data.errors); else setNote({ tone: 'error', text: api(r.data?.error) });
  };
  const act = async (game, action) => {
    setBusy(true); setNote(null);
    const r = action === 'delete'
      ? await ct(`guilds/${guildId}/games/${game.channel_id}`, { method: 'DELETE' })
      : await ct(`guilds/${guildId}/games/${game.channel_id}/${action}`, { method: 'POST', body: {} });
    setBusy(false); setConfirm(null);
    setNote(r.ok ? { tone: 'ok', text: t(`games.done.${action}`) } : { tone: 'error', text: api(r.data?.error) });
    reload();
  };

  return (
    <div className="space-y-6">
      <Toast message={note?.text} tone={note?.tone} />
      <Card className="space-y-4 p-5">
        <h3 className="text-lg font-semibold">{t('games.new')}</h3>
        <p className="text-sm text-muted-foreground">{t('games.newHint')}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <F label={t('games.channel')} errors={errors} path="channel"><ChannelSelect value={channel} onChange={setChannel} channels={meta.channels} includeNone={false} /></F>
          <SelectInput label={t('games.mode')} value={mode} onChange={setMode} options={MODES.map((m) => ({ value: m, label: modeT(m) }))} errors={errors} path="mode" />
        </div>
        <Problems errors={errors} path="game" />
        <Button type="button" disabled={busy || !/^\d{15,21}$/.test(channel)} onClick={create}><Plus className="mr-2 h-4 w-4" />{t('games.create')}</Button>
      </Card>

      {games.length === 0 ? <p className="text-sm text-muted-foreground">{t('games.none')}</p> : games.map((g) => (
        <Card key={g.channel_id} className="space-y-3 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold">{g.name || g.channel_id}</h3>
              <p className="text-sm text-muted-foreground">{modeT(g.mode.startsWith('custom:') ? 'custom_sequence' : g.mode)} · {stateT(g.status)} · {t('games.record')}: {g.highest_index} · {t('games.total')}: {g.stats.total_valid}</p>
              {g.status === 'archived' ? <p className="mt-1 text-sm text-amber-300/90">{t('games.archivedHint')}</p> : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" disabled={g.status === 'archived'} onClick={() => onEdit(g.channel_id)}><Settings className="mr-1.5 h-4 w-4" />{t('games.settings')}</Button>
              {g.status === 'active' ? <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => act(g, 'pause')}><Pause className="mr-1.5 h-4 w-4" />{t('games.pause')}</Button> : null}
              {g.status === 'paused' ? <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => act(g, 'resume')}><Play className="mr-1.5 h-4 w-4" />{t('games.resume')}</Button> : null}
              <Button type="button" variant="outline" size="sm" disabled={busy || g.status === 'archived'} onClick={() => setConfirm({ g, action: 'reset' })}><RotateCcw className="mr-1.5 h-4 w-4" />{t('games.reset')}</Button>
              <Button type="button" variant="outline" size="sm" disabled={busy || g.status === 'archived'} onClick={() => setConfirm({ g, action: 'archive' })}><Archive className="mr-1.5 h-4 w-4" />{t('games.archive')}</Button>
              <Button type="button" variant="outline" size="sm" disabled={busy} className="border-red-500/40 text-red-400 hover:bg-red-500/10 hover:text-red-300" onClick={() => setConfirm({ g, action: 'delete' })}><Trash2 className="mr-1.5 h-4 w-4" />{t('games.delete')}</Button>
            </div>
          </div>
        </Card>
      ))}
      <ConfirmDialog
        open={Boolean(confirm)} onOpenChange={(o) => { if (!o) setConfirm(null); }} busy={busy}
        title={confirm ? t(`games.confirm.${confirm.action}.title`) : ''} description={confirm ? t(`games.confirm.${confirm.action}.text`) : ''}
        confirmLabel={confirm ? t(`games.${confirm.action}`) : ''} onConfirm={() => confirm && act(confirm.g, confirm.action)}
        typed={confirm?.action === 'delete' ? String(confirm.g.name || confirm.g.channel_id).trim() : undefined}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------------------------- list editors
function Repeater({ title, hint, items, max, onChange, blank, render, addLabel }) {
  const t = useTranslations('counting');
  return (
    <Card className="space-y-3 p-4">
      <div><h4 className="font-semibold">{title}</h4>{hint ? <p className="text-sm text-muted-foreground">{hint}</p> : null}</div>
      {items.map((item, i) => (
        <div key={i} className="space-y-3 rounded-lg border border-border/50 p-3">
          <div className="flex items-center justify-between"><span className="text-sm font-semibold">#{i + 1}</span>
            <Button type="button" variant="ghost" size="icon" aria-label={t('actions.remove')} onClick={() => onChange(items.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button></div>
          {render(item, (patch) => onChange(items.map((x, j) => (j === i ? { ...x, ...patch } : x))), i)}
        </div>
      ))}
      {items.length < max ? <Button type="button" variant="outline" size="sm" onClick={() => onChange([...items, blank(items.length + 1)])}><Plus className="mr-1.5 h-4 w-4" />{addLabel}</Button> : null}
    </Card>
  );
}

function RewardFields({ value, onChange, base, errors }) {
  const t = useTranslations('counting.reward');
  const r = value || {};
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <NumberInput label={t('xp')} value={r.xp ?? ''} min={0} onChange={(v) => onChange({ ...r, xp: v === '' ? undefined : v })} errors={errors} path={`${base}.xp`} />
      <TextInput label={t('badge')} value={r.badge ?? ''} max={32} mono onChange={(v) => onChange({ ...r, badge: v || undefined })} errors={errors} path={`${base}.badge`} />
      <NumberInput label={t('saves')} value={r.powerup?.amount ?? ''} min={0} max={10} onChange={(v) => onChange({ ...r, powerup: v ? { type: 'save', amount: v } : undefined })} errors={errors} path={`${base}.powerup`} />
    </div>
  );
}

// ---------------------------------------------------------------------------------------------- settings
function SettingsTab({ guildId, meta, games, selected, onSelect, reload }) {
  const t = useTranslations('counting');
  const secT = useTranslations('counting.sections');
  const tabT = useTranslations('counting.settingsTabs');
  const modeT = useTranslations('counting.mode');
  const { api } = useCtText();
  const game = games.find((g) => g.channel_id === selected) || null;
  const [cfg, setCfg] = useState(null);
  const [name, setName] = useState('');
  const [mode, setMode] = useState('classic');
  const [errors, setErrors] = useState([]);
  const [note, setNote] = useState(null);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState('rules');
  useEffect(() => { if (game) { setCfg(clone(game.cfg)); setName(game.name || ''); setMode(game.mode); setErrors([]); setNote(null); } }, [game?.channel_id, game?.version]); // eslint-disable-line react-hooks/exhaustive-deps
  const dirty = useMemo(() => game && cfg && (JSON.stringify(cfg) !== JSON.stringify(game.cfg) || name !== (game.name || '') || mode !== game.mode), [game, cfg, name, mode]);

  if (!games.length) return <p className="text-sm text-muted-foreground">{t('games.none')}</p>;
  const save = async () => {
    setBusy(true); setErrors([]); setNote(null);
    const body = { config: cfg, name };
    if (mode !== game.mode) body.mode = mode;
    const r = await ct(`guilds/${guildId}/games/${game.channel_id}`, { method: 'PATCH', body });
    setBusy(false);
    if (r.ok) { setNote({ tone: 'ok', text: t('settings.saved') }); reload(); return; }
    if (r.data?.errors) { setErrors(r.data.errors); setNote({ tone: 'error', text: t('settings.fixErrors') }); } else setNote({ tone: 'error', text: api(r.data?.error) });
  };
  const sectionIds = TABS[tab] || [];
  return (
    <div className="space-y-6">
      <F label={t('settings.game')}>
        <select value={selected || ''} onChange={(e) => onSelect(e.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
          <option value="" disabled>{t('settings.pick')}</option>
          {games.map((g) => <option key={g.channel_id} value={g.channel_id}>{g.name || g.channel_id}</option>)}
        </select>
      </F>
      {game && game.status === 'archived' ? <p role="status" className="rounded-md border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-300">{t('games.archivedHint')}</p> : null}
      {game && cfg && game.status !== 'archived' ? (
        <>
          <Toast message={note?.text} tone={note?.tone} />
          <div className="grid gap-3 sm:grid-cols-2">
            <TextInput label={t('settings.name')} value={name} max={60} onChange={setName} errors={errors} path="name" />
            <SelectInput label={t('games.mode')} hint={t('settings.modeHint')} value={mode} onChange={setMode} options={MODES.map((m) => ({ value: m, label: modeT(m) }))} errors={errors} path="mode" />
          </div>
          <ModuleTabs active={tab} onChange={setTab} tabs={[
            { key: 'rules', label: tabT('rules') }, { key: 'rewards', label: tabT('rewards') }, { key: 'milestones', label: tabT('milestones') },
            { key: 'goals', label: tabT('goals') }, { key: 'notify', label: tabT('notify') }, { key: 'messages', label: tabT('messages') }, { key: 'access', label: tabT('access') }]} />
          {sectionIds.map((sid) => {
            const sec = SECTIONS.find((s) => s.id === sid);
            return (
              <Card key={sid} className="space-y-4 p-5">
                <h3 className="text-lg font-semibold">{secT(sid)}</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  {sec.fields.filter((f) => !(sid === 'notify' && f.key === 'channel_id')).map((spec) => <ConfigField key={spec.key} section={sid} spec={spec} cfg={cfg} onChange={setCfg} errors={errors} />)}
                  {sid === 'notify' ? (
                    <F label={secT('notifyChannel')} errors={errors} path="notify.channel_id">
                      <ChannelSelect value={cfg.notify?.channel_id || ''} onChange={(v) => setCfg({ ...cfg, notify: { ...cfg.notify, channel_id: v && v !== '__none' ? v : null } })} channels={meta.channels} noneLabel={t('settings.sameChannel')} />
                    </F>
                  ) : null}
                </div>
              </Card>
            );
          })}
          {tab === 'rewards' && cfg.fail?.strikes ? (
            <Repeater title={secT('strikeSteps')} hint={secT('strikeStepsHint')} items={cfg.fail.strikes.steps || []} max={5}
              blank={(n) => ({ at: n, action: 'warn' })} addLabel={t('actions.add')} onChange={(steps) => setCfg({ ...cfg, fail: { ...cfg.fail, strikes: { ...cfg.fail.strikes, steps } } })}
              render={(s, put, i) => (
                <div className="grid gap-3 sm:grid-cols-3">
                  <NumberInput label={secT('stepAt')} value={s.at} min={1} max={100} onChange={(v) => put({ at: v })} errors={errors} path={`fail.strikes.steps.${i + 1}.at`} />
                  <SelectInput label={secT('stepAction')} value={s.action} options={['warn', 'strike', 'reset', 'lock', 'role', 'timeout'].map((a) => ({ value: a, label: t(`strike.${a}`) }))} onChange={(v) => put({ action: v })} errors={errors} path={`fail.strikes.steps.${i + 1}.action`} />
                  <NumberInput label={secT('stepSeconds')} value={s.seconds ?? ''} min={0} max={2419200} onChange={(v) => put({ seconds: v })} errors={errors} path={`fail.strikes.steps.${i + 1}.seconds`} />
                </div>)} />
          ) : null}
          {tab === 'milestones' ? (
            <Repeater title={secT('milestones')} hint={secT('milestonesHint')} items={cfg.milestones || []} max={20} blank={(n) => ({ id: `m${n * 100}`, at: n * 100, announce: true })}
              addLabel={t('actions.add')} onChange={(milestones) => setCfg({ ...cfg, milestones })}
              render={(m, put, i) => (
                <>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <NumberInput label={secT('milestoneAt')} value={m.at} min={1} onChange={(v) => put({ at: v, id: `m${v}` })} errors={errors} path={`milestones.${i + 1}.at`} />
                    <TextInput label={secT('milestoneName')} value={m.name ?? ''} max={60} onChange={(v) => put({ name: v })} errors={errors} path={`milestones.${i + 1}.name`} />
                    <SelectInput label={secT('announce')} value={m.announce === false ? 'no' : 'yes'} onChange={(v) => put({ announce: v === 'yes' })} options={[{ value: 'yes', label: t('common.yes') }, { value: 'no', label: t('common.no') }]} />
                  </div>
                  <RewardFields value={m.reward} onChange={(reward) => put({ reward })} base={`milestones.${i + 1}.reward`} errors={errors} />
                </>)} />
          ) : null}
          {tab === 'goals' ? (
            <Repeater title={secT('goals')} hint={secT('goalsHint')} items={cfg.goals || []} max={5} blank={(n) => ({ id: `goal${n}`, type: 'channel', unit: 'count', target: 1000, reset_after: false, visibility: 'public' })}
              addLabel={t('actions.add')} onChange={(goals) => setCfg({ ...cfg, goals })}
              render={(g, put, i) => (
                <>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <TextInput label={secT('goalId')} value={g.id ?? ''} max={32} mono onChange={(v) => put({ id: v.toLowerCase().replace(/[^a-z0-9_]/g, '') })} errors={errors} path={`goals.${i + 1}.id`} />
                    <SelectInput label={secT('goalType')} value={g.type} options={GOAL_TYPES.map((x) => ({ value: x, label: t(`goalType.${x}`) }))} onChange={(v) => put({ type: v })} errors={errors} path={`goals.${i + 1}.type`} />
                    <SelectInput label={secT('goalUnit')} value={g.unit} options={GOAL_UNITS.map((x) => ({ value: x, label: t(`goalUnit.${x}`) }))} onChange={(v) => put({ unit: v })} errors={errors} path={`goals.${i + 1}.unit`} />
                    <NumberInput label={secT('goalTarget')} value={g.target} min={1} onChange={(v) => put({ target: v })} errors={errors} path={`goals.${i + 1}.target`} />
                    <SelectInput label={secT('goalVisibility')} value={g.visibility} options={['public', 'private'].map((x) => ({ value: x, label: t(`visibility.${x}`) }))} onChange={(v) => put({ visibility: v })} errors={errors} path={`goals.${i + 1}.visibility`} />
                    <SelectInput label={secT('goalRepeat')} value={g.reset_after ? 'yes' : 'no'} onChange={(v) => put({ reset_after: v === 'yes' })} options={[{ value: 'yes', label: t('common.yes') }, { value: 'no', label: t('common.no') }]} />
                  </div>
                  <RewardFields value={g.reward} onChange={(reward) => put({ reward })} base={`goals.${i + 1}.reward`} errors={errors} />
                </>)} />
          ) : null}
          {tab === 'messages' ? (
            <Card className="space-y-4 p-5">
              <div><h3 className="text-lg font-semibold">{secT('messages')}</h3><p className="text-sm text-muted-foreground">{secT('messagesHint')}</p></div>
              {MESSAGE_KEYS.map((key) => (
                <div key={key} className="space-y-2 rounded-lg border border-border/50 p-3">
                  <h4 className="text-sm font-semibold">{t(`messageKey.${key}`)}</h4>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {LANGS.map((lg) => (
                      <TextInput key={lg} label={lg.toUpperCase()} value={cfg.messages?.[key]?.[lg] ?? ''} max={300}
                        onChange={(v) => setCfg({ ...cfg, messages: { ...(cfg.messages || {}), [key]: { ...(cfg.messages?.[key] || {}), [lg]: v } } })} errors={errors} path={`messages.${key}.${lg}`} />
                    ))}
                  </div>
                </div>
              ))}
            </Card>
          ) : null}
          <SaveBar dirty={Boolean(dirty)} saving={busy} onSave={save} onDiscard={() => { setCfg(clone(game.cfg)); setName(game.name || ''); setMode(game.mode); setErrors([]); }} />
        </>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------- competitions
const blankComp = () => ({ name: '', mode: 'most_valid', starts_at: new Date(Date.now() + 3600e3).toISOString(), ends_at: new Date(Date.now() + 7 * 86400e3).toISOString(), min_valid: 20, rewards: [{ rank: 1, reward: { xp: 100 } }], channels: [], participant_roles: [], teams: [], announce_channel_id: null });

function CompetitionsTab({ guildId, meta }) {
  const t = useTranslations('counting');
  const modeT = useTranslations('counting.competitionMode');
  const locale = useLocale();
  const { api } = useCtText();
  const { loading, data, error, reload } = useCt(`guilds/${guildId}/competitions`);
  const [draft, setDraft] = useState(null);
  const [errors, setErrors] = useState([]);
  const [note, setNote] = useState(null);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true); setErrors([]); setNote(null);
    const id = draft.id;
    const r = await ct(id ? `guilds/${guildId}/competitions/${id}` : `guilds/${guildId}/competitions`, { method: id ? 'PATCH' : 'POST', body: draft });
    setBusy(false);
    if (r.ok) { setDraft(null); reload(); return; }
    if (r.data?.errors) setErrors(r.data.errors); else setNote({ tone: 'error', text: api(r.data?.error) });
  };
  const cancel = async (id) => { await ct(`guilds/${guildId}/competitions/${id}`, { method: 'DELETE' }); reload(); };
  return (
    <LoadingOrError loading={loading} error={error} onRetry={reload} data={data}>
      <div className="space-y-4">
        <Toast message={note?.text} tone={note?.tone} />
        {draft ? (
          <Card className="space-y-4 p-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <TextInput label={t('comp.name')} value={draft.name} max={60} onChange={(v) => setDraft({ ...draft, name: v })} errors={errors} path="name" />
              <SelectInput label={t('comp.mode')} value={draft.mode} options={COMPETITION_MODES.map((m) => ({ value: m, label: modeT(m) }))} onChange={(v) => setDraft({ ...draft, mode: v })} errors={errors} path="mode" />
              <DateInput label={t('comp.starts')} value={draft.starts_at} onChange={(v) => setDraft({ ...draft, starts_at: v })} errors={errors} path="starts_at" />
              <DateInput label={t('comp.ends')} value={draft.ends_at} onChange={(v) => setDraft({ ...draft, ends_at: v })} errors={errors} path="ends_at" />
              <NumberInput label={t('comp.minValid')} value={draft.min_valid} min={1} onChange={(v) => setDraft({ ...draft, min_valid: v })} errors={errors} path="min_valid" />
              <F label={t('comp.announce')} errors={errors} path="announce_channel_id"><ChannelSelect value={draft.announce_channel_id || ''} onChange={(v) => setDraft({ ...draft, announce_channel_id: v && v !== '__none' ? v : null })} channels={meta.channels} /></F>
            </div>
            <Repeater title={t('comp.rewards')} hint={t('comp.rewardsHint')} items={draft.rewards} max={10} blank={(n) => ({ rank: n, reward: { xp: 50 } })} addLabel={t('actions.add')} onChange={(rewards) => setDraft({ ...draft, rewards })}
              render={(r, put, i) => (<><NumberInput label={t('comp.rank')} value={r.rank} min={1} max={100} onChange={(v) => put({ rank: v })} errors={errors} path={`rewards.${i + 1}.rank`} /><RewardFields value={r.reward} onChange={(reward) => put({ reward })} base={`rewards.${i + 1}.reward`} errors={errors} /></>)} />
            <Problems errors={errors} path="competition" /><Problems errors={errors} path="teams" />
            <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setDraft(null)}>{t('actions.discard')}</Button><Button type="button" disabled={busy} onClick={submit}><Save className="mr-2 h-4 w-4" />{t('actions.save')}</Button></div>
          </Card>
        ) : <Button type="button" onClick={() => setDraft(blankComp())}><Plus className="mr-2 h-4 w-4" />{t('comp.new')}</Button>}
        {(data?.competitions || []).map((c) => (
          <Card key={c.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div><h4 className="font-semibold">{c.name}</h4><p className="text-sm text-muted-foreground">{modeT(c.mode)} · {t(`comp.status.${c.status}`)} · {formatDate(c.starts_at, locale)} → {formatDate(c.ends_at, locale)}</p></div>
            {c.status === 'scheduled' || c.status === 'active' ? (
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setDraft({ ...c })}>{t('actions.edit')}</Button>
                <Button type="button" variant="outline" size="sm" onClick={() => cancel(c.id)}>{t('comp.cancel')}</Button>
              </div>) : null}
          </Card>
        ))}
      </div>
    </LoadingOrError>
  );
}

// ---------------------------------------------------------------------------------------------- panel
export default function CountingPanel({ guildId, meta }) {
  const t = useTranslations('counting');
  const { loading, data, error, reload } = useCt(`guilds/${guildId}/games`);
  const [tab, setTab] = useState('games');
  const [selected, setSelected] = useState(null);
  const games = data?.games || [];
  const edit = useCallback((id) => { setSelected(id); setTab('settings'); }, []);
  useEffect(() => {
    if (!games.length) { if (selected) setSelected(null); return; }
    if (!selected || !games.some((g) => g.channel_id === selected)) setSelected((games.find((g) => g.status !== 'archived') || games[0]).channel_id);
  }, [games, selected]);
  return (
    <div>
      <div className="mb-6"><h2 className="text-2xl font-bold">{t('title')}</h2><p className="mt-1.5 text-[15px] text-muted-foreground">{t('panelIntro')}</p></div>
      <ModuleTabs active={tab} onChange={setTab} tabs={[
        { key: 'games', label: t('tabs.games'), icon: ClipboardList }, { key: 'settings', label: t('tabs.settings'), icon: Settings }, { key: 'competitions', label: t('tabs.competitions'), icon: Trophy }]} />
      <LoadingOrError loading={loading && !data} error={error} onRetry={reload} data={data}>
        {tab === 'games' ? <GamesTab guildId={guildId} meta={meta} games={games} reload={reload} onEdit={edit} /> : null}
        {tab === 'settings' ? <SettingsTab guildId={guildId} meta={meta} games={games} selected={selected} onSelect={setSelected} reload={reload} /> : null}
        {tab === 'competitions' ? <CompetitionsTab guildId={guildId} meta={meta} /> : null}
      </LoadingOrError>
    </div>
  );
}

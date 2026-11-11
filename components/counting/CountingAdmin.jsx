'use client';
// Owner Panel > Counting. Global switches and limits, definitions (badges, achievements, challenges, collections, custom modes),
// seasons, global competitions, every game, statistics and the audit log. Delegates can read; only the owner writes.
// Every write is a request to the bot, which validates and writes it.
import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Plus, Save, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ModuleTabs, LoadingOrError, SwitchRow, formatDate, ConfirmDialog } from '@/components/module-kit';
import { MODES, POWERUPS, RARITIES, ACHIEVEMENT_METRICS, CHALLENGE_TYPES, COMPETITION_MODES } from '@/lib/counting/constants';
import { ct, useCt, useCtText, Problems, NumberInput, TextInput, SelectInput, DateInput } from './ct-kit';

const LIMITS = { max_channels_per_guild: [1, 50], max_participants: [1, 1000], max_milestones: [1, 100], max_goals: [1, 20], max_strike_steps: [1, 10], max_roles: [1, 50], max_xp_per_valid: [0, 1000], max_daily_xp: [0, 1000000], max_saves: [0, 100], min_rate_per_min: [1, 600] };
const POWER_NUMBERS = { max_per_member: [1, 99], hint_cooldown_s: [0, 86400], boost_counts: [1, 1000], boost_multiplier: [1, 10] };

function Note({ note }) {
  if (!note) return null;
  return <p role="status" className={`rounded-md border px-3 py-2 text-sm ${note.tone === 'error' ? 'border-red-400/40 bg-red-500/10 text-red-300' : 'border-emerald-400/40 bg-emerald-500/10 text-emerald-300'}`}>{note.text}</p>;
}

/** Sends a write and reports the result. Returns { ok, errors }. */
function useWrite(reload) {
  const t = useTranslations('counting');
  const { api } = useCtText();
  const [note, setNote] = useState(null);
  const [errors, setErrors] = useState([]);
  const [busy, setBusy] = useState(false);
  const run = async (path, method, body) => {
    setBusy(true); setErrors([]); setNote(null);
    const r = await ct(path, { method, body });
    setBusy(false);
    if (r.ok) { setNote({ tone: 'ok', text: t('settings.saved') }); reload?.(); return { ok: true, data: r.data }; }
    if (r.data?.errors) { setErrors(r.data.errors); setNote({ tone: 'error', text: t('settings.fixErrors') }); } else setNote({ tone: 'error', text: api(r.data?.error) });
    return { ok: false };
  };
  return { run, note, errors, busy, setNote, setErrors };
}

function Overview() {
  const t = useTranslations('counting.admin.overview');
  const { loading, data, error, reload } = useCt('owner/overview');
  return (
    <LoadingOrError loading={loading} error={error} onRetry={reload} data={data}>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {data ? ['games', 'active', 'paused', 'competitions', 'seasons', 'players', 'total_valid', 'total_errors', 'highest'].map((k) => (
          <Card key={k} className="p-4"><p className="text-sm text-muted-foreground">{t(k)}</p><p className="mt-1 text-2xl font-bold">{Number(data[k]).toLocaleString()}</p></Card>
        )) : null}
      </div>
    </LoadingOrError>
  );
}

function ConfigTab({ writable }) {
  const t = useTranslations('counting.admin.config');
  const modeT = useTranslations('counting.mode');
  const infoT = useTranslations('counting.modeInfo');
  const puT = useTranslations('counting.powerup');
  const { loading, data, error, reload } = useCt('owner/config');
  const w = useWrite(reload);
  const [draft, setDraft] = useState(null);
  const cfg = draft || data?.config;
  const patch = (k, v) => setDraft({ ...(cfg || {}), [k]: v });
  const save = () => w.run('owner/config', 'PATCH', { enabled: cfg.enabled, challenges_enabled: cfg.challenges_enabled, rewards_enabled: cfg.rewards_enabled, modes_enabled: cfg.modes_enabled, limits: cfg.limits, powerups: cfg.powerups, protection: cfg.protection }).then((r) => { if (r.ok) setDraft(null); });
  return (
    <LoadingOrError loading={loading} error={error} onRetry={reload} data={data}>
      {cfg ? (
        <div className="space-y-5">
          <Note note={w.note} />
          <Card className="space-y-3 p-5">
            <h3 className="text-lg font-semibold">{t('switches')}</h3>
            <SwitchRow label={t('enabled')} hint={t('enabledHint')} checked={cfg.enabled !== false} disabled={!writable} onChange={(v) => patch('enabled', v)} />
            <SwitchRow label={t('challenges')} checked={cfg.challenges_enabled !== false} disabled={!writable} onChange={(v) => patch('challenges_enabled', v)} />
            <SwitchRow label={t('rewards')} checked={cfg.rewards_enabled !== false} disabled={!writable} onChange={(v) => patch('rewards_enabled', v)} />
            <Problems errors={w.errors} path="modes_enabled" />
          </Card>
          <Card className="space-y-3 p-5">
            <h3 className="text-lg font-semibold">{t('modes')}</h3>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {MODES.map((m) => (
                <SwitchRow key={m} label={modeT(m)} hint={infoT(m)} checked={(cfg.modes_enabled || []).includes(m)} disabled={!writable}
                  onChange={(v) => patch('modes_enabled', v ? [...(cfg.modes_enabled || []), m] : (cfg.modes_enabled || []).filter((x) => x !== m))} />
              ))}
            </div>
          </Card>
          <Card className="space-y-3 p-5">
            <h3 className="text-lg font-semibold">{t('limits')}</h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Object.entries(LIMITS).map(([k, [lo, hi]]) => <NumberInput key={k} label={t(`limit.${k}`)} value={cfg.limits?.[k]} min={lo} max={hi} errors={w.errors} path={`limits.${k}`} onChange={(v) => writable && patch('limits', { ...cfg.limits, [k]: v })} />)}
            </div>
          </Card>
          <Card className="space-y-3 p-5">
            <h3 className="text-lg font-semibold">{t('powerups')}</h3>
            <SwitchRow label={t('powerupsEnabled')} checked={cfg.powerups?.enabled !== false} disabled={!writable} onChange={(v) => patch('powerups', { ...cfg.powerups, enabled: v })} />
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {POWERUPS.map((p) => <SwitchRow key={p} label={puT(p)} checked={(cfg.powerups?.types || []).includes(p)} disabled={!writable}
                onChange={(v) => patch('powerups', { ...cfg.powerups, types: v ? [...(cfg.powerups?.types || []), p] : (cfg.powerups?.types || []).filter((x) => x !== p) })} />)}
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {Object.entries(POWER_NUMBERS).map(([k, [lo, hi]]) => <NumberInput key={k} label={t(`power.${k}`)} value={cfg.powerups?.[k]} min={lo} max={hi} errors={w.errors} path={`powerups.${k}`} onChange={(v) => writable && patch('powerups', { ...cfg.powerups, [k]: v })} />)}
            </div>
          </Card>
          <Card className="space-y-3 p-5">
            <h3 className="text-lg font-semibold">{t('protection')}</h3>
            <NumberInput label={t('minRate')} value={cfg.protection?.min_rate_per_min} min={1} max={600} errors={w.errors} path="protection.min_rate_per_min" onChange={(v) => writable && patch('protection', { ...cfg.protection, min_rate_per_min: v })} />
            {['duplicate_protection', 'bot_exclusion', 'webhook_exclusion'].map((k) => <SwitchRow key={k} label={t(`prot.${k}`)} checked={cfg.protection?.[k] !== false} disabled={!writable} onChange={(v) => patch('protection', { ...cfg.protection, [k]: v })} />)}
          </Card>
          {writable ? <div className="flex justify-end"><Button type="button" disabled={!draft || w.busy} onClick={save}><Save className="mr-2 h-4 w-4" />{t('save')}</Button></div> : null}
        </div>
      ) : null}
    </LoadingOrError>
  );
}

const BLANK = {
  badge: { kind: 'badge', id: '', name: '', description: '', rarity: 'common', enabled: true },
  achievement: { kind: 'achievement', id: '', name: '', description: '', metric: 'valid_total', target: 100, visibility: 'public', reward: { xp: 10 }, enabled: true },
  challenge: { kind: 'challenge', id: '', name: '', description: '', type: 'valid_counts', target: 50, period: 'day', reward: { xp: 20 }, enabled: true },
  collection: { kind: 'collection', id: '', name: '', description: '', items: [], reward: { xp: 100 }, enabled: true },
  custom_mode: { kind: 'custom_mode', id: '', name: '', description: '', seq: { kind: 'formula', formula: 'prev + 2', start: 2 }, enabled: true },
};

function DefsTab({ writable }) {
  const t = useTranslations('counting.admin.defs');
  const rarity = useTranslations('counting.rarity');
  const [kind, setKind] = useState('badge');
  const { loading, data, error, reload } = useCt(`owner/defs?kind=${kind}`, [kind]);
  const w = useWrite(reload);
  const [draft, setDraft] = useState(null);
  const set = (p) => setDraft({ ...draft, ...p });
  const submit = async () => { const r = await w.run('owner/defs', 'POST', draft); if (r.ok) setDraft(null); };
  const retire = async (d) => { await w.run(`owner/defs/${d.kind}/${d.id}`, 'DELETE'); };
  const reward = draft?.reward || {};
  return (
    <div className="space-y-4">
      <ModuleTabs active={kind} onChange={(k) => { setKind(k); setDraft(null); }} tabs={Object.keys(BLANK).map((k) => ({ key: k, label: t(`kind.${k}`) }))} />
      <Note note={w.note} />
      {draft ? (
        <Card className="space-y-4 p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <TextInput label={t('id')} hint={t('idHint')} value={draft.id} max={32} mono onChange={(v) => set({ id: v.toLowerCase().replace(/[^a-z0-9_]/g, '') })} errors={w.errors} path="id" />
            <TextInput label={t('name')} value={draft.name} max={60} onChange={(v) => set({ name: v })} errors={w.errors} path="name" />
            <TextInput label={t('description')} value={draft.description} max={300} onChange={(v) => set({ description: v })} errors={w.errors} path="description" />
            {kind === 'badge' ? <SelectInput label={t('rarity')} value={draft.rarity} options={RARITIES.map((r) => ({ value: r, label: rarity(r) }))} onChange={(v) => set({ rarity: v })} errors={w.errors} path="rarity" /> : null}
            {kind === 'achievement' ? (<>
              <SelectInput label={t('metricLabel')} value={draft.metric} options={ACHIEVEMENT_METRICS.map((m) => ({ value: m, label: t(`metric.${m}`) }))} onChange={(v) => set({ metric: v })} errors={w.errors} path="metric" />
              <NumberInput label={t('target')} value={draft.target} min={1} onChange={(v) => set({ target: v })} errors={w.errors} path="target" />
              <SelectInput label={t('hidden')} value={draft.visibility} options={[{ value: 'public', label: t('public') }, { value: 'hidden', label: t('hiddenOpt') }]} onChange={(v) => set({ visibility: v })} errors={w.errors} path="visibility" />
            </>) : null}
            {kind === 'challenge' ? (<>
              <SelectInput label={t('type')} value={draft.type} options={CHALLENGE_TYPES.map((m) => ({ value: m, label: t(`challengeType.${m}`) }))} onChange={(v) => set({ type: v })} errors={w.errors} path="type" />
              <NumberInput label={t('target')} value={draft.target} min={1} onChange={(v) => set({ target: v })} errors={w.errors} path="target" />
              <SelectInput label={t('period')} value={draft.period} options={['none', 'day', 'week', 'month', 'season'].map((m) => ({ value: m, label: t(`periodOpt.${m}`) }))} onChange={(v) => set({ period: v })} errors={w.errors} path="period" />
            </>) : null}
            {kind === 'collection' ? <TextInput label={t('items')} hint={t('itemsHint')} value={(draft.items || []).join(', ')} mono onChange={(v) => set({ items: v.split(/[\s,;]+/).filter(Boolean) })} errors={w.errors} path="items" /> : null}
          </div>
          {kind === 'custom_mode' ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <SelectInput label={t('seqKind')} value={draft.seq?.kind || 'formula'} options={[{ value: 'formula', label: t('formula') }, { value: 'list', label: t('list') }]} onChange={(v) => set({ seq: { ...draft.seq, kind: v } })} errors={w.errors} path="seq.kind" />
              {draft.seq?.kind === 'list'
                ? <TextInput label={t('listItems')} value={(draft.seq.items || []).join(', ')} mono onChange={(v) => set({ seq: { ...draft.seq, items: v.split(/[,;\n]+/).map((x) => x.trim()).filter(Boolean) } })} errors={w.errors} path="seq.items" />
                : <TextInput label={t('formulaLabel')} hint={t('formulaHint')} value={draft.seq?.formula || ''} max={2000} mono onChange={(v) => set({ seq: { ...draft.seq, formula: v } })} errors={w.errors} path="seq.formula" />}
              <NumberInput label={t('start')} value={draft.seq?.start} decimal onChange={(v) => set({ seq: { ...draft.seq, start: v } })} errors={w.errors} path="seq.start" />
            </div>
          ) : null}
          {kind !== 'badge' && kind !== 'custom_mode' ? (
            <div className="grid gap-3 sm:grid-cols-3">
              <NumberInput label={t('rewardXp')} value={reward.xp ?? ''} min={0} onChange={(v) => set({ reward: { ...reward, xp: v === '' ? undefined : v } })} errors={w.errors} path="reward.xp" />
              <TextInput label={t('rewardBadge')} value={reward.badge ?? ''} max={32} mono onChange={(v) => set({ reward: { ...reward, badge: v || undefined } })} errors={w.errors} path="reward.badge" />
              <NumberInput label={t('rewardPowerup')} value={reward.powerup?.amount ?? ''} min={0} max={10} onChange={(v) => set({ reward: { ...reward, powerup: v ? { type: reward.powerup?.type || 'save', amount: v } : undefined } })} errors={w.errors} path="reward.powerup" />
            </div>
          ) : null}
          <SwitchRow label={t('enabled')} checked={draft.enabled !== false} onChange={(v) => set({ enabled: v })} />
          <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setDraft(null)}>{t('cancel')}</Button><Button type="button" disabled={w.busy} onClick={submit}><Save className="mr-2 h-4 w-4" />{t('save')}</Button></div>
        </Card>
      ) : writable ? <Button type="button" onClick={() => setDraft(structuredClone(BLANK[kind]))}><Plus className="mr-2 h-4 w-4" />{t('new')}</Button> : null}
      <LoadingOrError loading={loading} error={error} onRetry={reload} data={data}>
        <div className="space-y-2">
          {(data?.defs || []).map((d) => (
            <Card key={d.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div><p className="font-semibold">{d.name} <span className="font-mono text-xs text-muted-foreground">{d.id}</span></p><p className="text-sm text-muted-foreground">{d.description}{d.enabled === false ? ` · ${t('retired')}` : ''}</p></div>
              {writable ? (<div className="flex gap-2"><Button type="button" variant="outline" size="sm" onClick={() => setDraft({ ...BLANK[kind], ...d })}>{t('edit')}</Button>
                {d.enabled !== false ? <Button type="button" variant="ghost" size="icon" aria-label={t('retire')} onClick={() => retire(d)}><Trash2 className="h-4 w-4" /></Button> : null}</div>) : null}
            </Card>
          ))}
        </div>
      </LoadingOrError>
    </div>
  );
}

function DatedList({ area, writable, kind }) {
  const t = useTranslations('counting.admin.dated');
  const modeT = useTranslations('counting.competitionMode');
  const locale = useLocale();
  const { loading, data, error, reload } = useCt(`owner/${area}`);
  const w = useWrite(reload);
  const [draft, setDraft] = useState(null);
  const rows = data?.[area] || [];
  const blank = () => ({ name: '', starts_at: new Date(Date.now() + 86400e3).toISOString(), ends_at: new Date(Date.now() + 31 * 86400e3).toISOString(), reward: { xp: 100 }, min_valid: kind === 'season' ? 1 : 20, ...(kind === 'competition' ? { mode: 'most_valid', rewards: [{ rank: 1, reward: { xp: 100 } }] } : {}) });
  const submit = async () => {
    const id = draft.id;
    const body = kind === 'season' ? { name: draft.name, description: draft.description, starts_at: draft.starts_at, ends_at: draft.ends_at, reward: draft.reward, min_valid: draft.min_valid } : draft;
    const r = await w.run(id ? `owner/${area}/${id}` : `owner/${area}`, id ? 'PATCH' : 'POST', body);
    if (r.ok) setDraft(null);
  };
  return (
    <div className="space-y-4">
      <Note note={w.note} />
      {draft ? (
        <Card className="space-y-4 p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <TextInput label={t('name')} value={draft.name} max={60} onChange={(v) => setDraft({ ...draft, name: v })} errors={w.errors} path="name" />
            {kind === 'competition' ? <SelectInput label={t('mode')} value={draft.mode} options={COMPETITION_MODES.map((m) => ({ value: m, label: modeT(m) }))} onChange={(v) => setDraft({ ...draft, mode: v })} errors={w.errors} path="mode" /> : null}
            <DateInput label={t('starts')} value={draft.starts_at} onChange={(v) => setDraft({ ...draft, starts_at: v })} errors={w.errors} path="starts_at" />
            <DateInput label={t('ends')} value={draft.ends_at} onChange={(v) => setDraft({ ...draft, ends_at: v })} errors={w.errors} path="ends_at" />
            <NumberInput label={t('minValid')} value={draft.min_valid} min={1} onChange={(v) => setDraft({ ...draft, min_valid: v })} errors={w.errors} path="min_valid" />
            {kind === 'season' ? <NumberInput label={t('rewardXp')} value={draft.reward?.xp ?? ''} min={0} onChange={(v) => setDraft({ ...draft, reward: { ...draft.reward, xp: v === '' ? undefined : v } })} errors={w.errors} path="reward.xp" /> : <NumberInput label={t('firstPrizeXp')} value={draft.rewards?.[0]?.reward?.xp ?? ''} min={0} onChange={(v) => setDraft({ ...draft, rewards: [{ rank: 1, reward: { xp: v === '' ? undefined : v } }] })} errors={w.errors} path="rewards.1.reward.xp" />}
          </div>
          <Problems errors={w.errors} path="competition" />
          <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setDraft(null)}>{t('cancel')}</Button><Button type="button" disabled={w.busy} onClick={submit}><Save className="mr-2 h-4 w-4" />{t('save')}</Button></div>
        </Card>
      ) : writable ? <Button type="button" onClick={() => setDraft(blank())}><Plus className="mr-2 h-4 w-4" />{t(`new_${kind}`)}</Button> : null}
      <LoadingOrError loading={loading} error={error} onRetry={reload} data={data}>
        {rows.map((r) => (
          <Card key={r.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div><p className="font-semibold">{r.name}</p><p className="text-sm text-muted-foreground">{t(`status.${r.status}`)} · {formatDate(r.starts_at, locale)} → {formatDate(r.ends_at, locale)}</p></div>
            {writable && !['completed', 'archived', 'cancelled'].includes(r.status) ? (
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setDraft({ ...r })}>{t('edit')}</Button>
                {kind === 'season' ? (<>
                  {r.status === 'paused' ? <Button type="button" variant="outline" size="sm" onClick={() => w.run(`owner/seasons/${r.id}/resume`, 'POST', {})}>{t('resume')}</Button> : <Button type="button" variant="outline" size="sm" onClick={() => w.run(`owner/seasons/${r.id}/pause`, 'POST', {})}>{t('pause')}</Button>}
                  <Button type="button" variant="outline" size="sm" onClick={() => w.run(`owner/seasons/${r.id}/archive`, 'POST', {})}>{t('archive')}</Button>
                </>) : <Button type="button" variant="outline" size="sm" onClick={() => w.run(`owner/competitions/${r.id}`, 'DELETE')}>{t('cancelComp')}</Button>}
              </div>) : null}
          </Card>
        ))}
      </LoadingOrError>
    </div>
  );
}

function GamesTab({ writable }) {
  const t = useTranslations('counting.admin.games');
  const modeT = useTranslations('counting.mode');
  const stateT = useTranslations('counting.state');
  const [status, setStatus] = useState('');
  const [skip, setSkip] = useState(0);
  const { loading, data, error, reload } = useCt(`owner/games?skip=${skip}${status ? `&status=${status}` : ''}`, [status, skip]);
  const w = useWrite(reload);
  const confirmT = useTranslations('counting.games.confirm.delete');
  const [removing, setRemoving] = useState(null);
  return (
    <div className="space-y-4">
      <Note note={w.note} />
      <ConfirmDialog
        open={Boolean(removing)} onOpenChange={(o) => { if (!o) setRemoving(null); }} busy={w.busy}
        title={confirmT('title')} description={confirmT('text')} confirmLabel={t('delete')}
        typed={removing ? String(removing.name || removing.channel_id).trim() : undefined}
        onConfirm={async () => { const r = await w.run(`owner/games/${removing.channel_id}`, 'DELETE'); if (r.ok) setRemoving(null); }}
      />
      <SelectInput label={t('filter')} value={status} onChange={(v) => { setStatus(v); setSkip(0); }} options={[{ value: '', label: t('all') }, ...['active', 'paused', 'archived'].map((s) => ({ value: s, label: stateT(s) }))]} />
      <LoadingOrError loading={loading} error={error} onRetry={reload} data={data}>
        {(data?.games || []).map((g) => (
          <Card key={g.channel_id} className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div><p className="font-semibold">{g.name || g.channel_id}</p><p className="font-mono text-xs text-muted-foreground">{g.guild_id}</p><p className="text-sm text-muted-foreground">{modeT(g.mode.startsWith('custom:') ? 'custom_sequence' : g.mode)} · {stateT(g.status)} · {g.highest_index} · {g.stats.total_valid}</p></div>
            {writable ? (<div className="flex gap-2">
              {g.status === 'active' ? <Button type="button" variant="outline" size="sm" onClick={() => w.run(`owner/games/${g.channel_id}/pause`, 'POST', {})}>{t('pause')}</Button> : null}
              {g.status === 'paused' ? <Button type="button" variant="outline" size="sm" onClick={() => w.run(`owner/games/${g.channel_id}/resume`, 'POST', {})}>{t('resume')}</Button> : null}
              {g.status !== 'archived' ? <Button type="button" variant="outline" size="sm" onClick={() => w.run(`owner/games/${g.channel_id}/archive`, 'POST', {})}>{t('archive')}</Button> : null}
              <Button type="button" variant="outline" size="sm" className="border-red-500/40 text-red-400 hover:bg-red-500/10 hover:text-red-300" onClick={() => setRemoving(g)}><Trash2 className="mr-1.5 h-4 w-4" />{t('delete')}</Button>
            </div>) : null}
          </Card>))}
        <div className="flex justify-between"><Button type="button" variant="ghost" disabled={skip === 0} onClick={() => setSkip(Math.max(0, skip - 24))}>{t('prev')}</Button><Button type="button" variant="ghost" disabled={(data?.games || []).length < 24} onClick={() => setSkip(skip + 24)}>{t('next')}</Button></div>
      </LoadingOrError>
    </div>
  );
}

function StatsTab() {
  const t = useTranslations('counting.admin.stats');
  const modeT = useTranslations('counting.mode');
  const { loading, data, error, reload } = useCt('owner/stats');
  const max = Math.max(1, ...(data?.daily || []).map((d) => d.valid + d.errors));
  return (
    <LoadingOrError loading={loading} error={error} onRetry={reload} data={data}>
      <div className="space-y-5">
        <Card className="p-5">
          <h3 className="mb-3 text-lg font-semibold">{t('daily')}</h3>
          <div className="flex h-40 items-end gap-1" role="img" aria-label={t('daily')}>
            {(data?.daily || []).map((d) => (
              <div key={d.day} className="flex flex-1 flex-col justify-end" title={`${d.day}: ${d.valid} / ${d.errors}`}>
                <div className="bg-red-400/70" style={{ height: `${(d.errors / max) * 100}%` }} /><div className="bg-emerald-400/80" style={{ height: `${(d.valid / max) * 100}%` }} />
              </div>))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{t('legend')}</p>
        </Card>
        <Card className="p-5"><h3 className="mb-3 text-lg font-semibold">{t('modes')}</h3>
          {(data?.modes || []).map((m) => <p key={m.mode} className="flex justify-between text-sm"><span>{modeT(String(m.mode).startsWith('custom:') ? 'custom_sequence' : m.mode)}</span><span className="text-muted-foreground">{m.games} · {m.valid}</span></p>)}
        </Card>
      </div>
    </LoadingOrError>
  );
}

function AuditTab() {
  const t = useTranslations('counting.admin.audit');
  const locale = useLocale();
  const [skip, setSkip] = useState(0);
  const { loading, data, error, reload } = useCt(`owner/audit?skip=${skip}`, [skip]);
  return (
    <LoadingOrError loading={loading} error={error} onRetry={reload} data={data}>
      <div className="space-y-2">
        {(data?.rows || []).map((r, i) => (
          <Card key={i} className="p-3 text-sm"><p><span className="font-mono">{r.action}</span> {r.target ? <span className="text-muted-foreground">· {r.target}</span> : null}</p>
            <p className="text-xs text-muted-foreground">{formatDate(r.at, locale)} · {r.actor || '-'}{r.guild_id ? ` · ${r.guild_id}` : ''}</p></Card>))}
        <div className="flex justify-between"><Button type="button" variant="ghost" disabled={skip === 0} onClick={() => setSkip(Math.max(0, skip - 24))}>{t('prev')}</Button><Button type="button" variant="ghost" disabled={(data?.rows || []).length < 24} onClick={() => setSkip(skip + 24)}>{t('next')}</Button></div>
      </div>
    </LoadingOrError>
  );
}

export default function CountingAdmin({ writable = true }) {
  const t = useTranslations('counting.admin');
  const [tab, setTab] = useState('overview');
  return (
    <div>
      <div className="mb-6"><h2 className="text-2xl font-bold">{t('title')}</h2><p className="mt-1.5 text-[15px] text-muted-foreground">{writable ? t('intro') : t('readOnly')}</p></div>
      <ModuleTabs active={tab} onChange={setTab} tabs={['overview', 'config', 'defs', 'seasons', 'competitions', 'games', 'stats', 'audit'].map((k) => ({ key: k, label: t(`tabs.${k}`) }))} />
      {tab === 'overview' ? <Overview /> : null}
      {tab === 'config' ? <ConfigTab writable={writable} /> : null}
      {tab === 'defs' ? <DefsTab writable={writable} /> : null}
      {tab === 'seasons' ? <DatedList area="seasons" kind="season" writable={writable} /> : null}
      {tab === 'competitions' ? <DatedList area="competitions" kind="competition" writable={writable} /> : null}
      {tab === 'games' ? <GamesTab writable={writable} /> : null}
      {tab === 'stats' ? <StatsTab /> : null}
      {tab === 'audit' ? <AuditTab /> : null}
    </div>
  );
}

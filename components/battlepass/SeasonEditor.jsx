'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import {
  ArrowLeft, Award, Boxes, Copy, Gift, Layers, Languages, Loader2, Palette, Pause, Play, Archive, Flag, Settings2, Target, Trash2, Trophy, Gauge, AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ConfirmDialog, ModuleTabs, SaveFooter, LoadingOrError } from '@/components/module-kit';
import { bp, useBpText, setPath } from './bp-kit';
import GeneralTab from './editor/GeneralTab';
import LevelsTab from './editor/LevelsTab';
import XpTab from './editor/XpTab';
import RewardsTab from './editor/RewardsTab';
import QuestsTab from './editor/QuestsTab';
import AchievementsTab from './editor/AchievementsTab';
import CollectionsTab from './editor/CollectionsTab';
import ThemeTab from './editor/ThemeTab';
import LocalizationTab from './editor/LocalizationTab';
import PublishChecklist from './PublishChecklist';
import { readiness, conflictsAgainst } from '@/lib/battlepass/schedule.js';

export const STATUS_TONE = {
  draft: 'border-border/60 bg-secondary/40 text-muted-foreground', scheduled: 'border-sky-400/40 bg-sky-500/10 text-sky-300',
  active: 'border-emerald-400/40 bg-emerald-500/10 text-emerald-300', paused: 'border-amber-400/40 bg-amber-500/10 text-amber-300',
  completed: 'border-violet-400/40 bg-violet-500/10 text-violet-300', archived: 'border-border/60 bg-secondary/30 text-muted-foreground',
};
const STATUS_DOT = {
  draft: 'bg-muted-foreground/60', scheduled: 'bg-sky-300', active: 'bg-emerald-300', paused: 'bg-amber-300', completed: 'bg-violet-300', archived: 'bg-muted-foreground/50',
};
/** The status of a season as a small pill: a coloured dot (pulsing while it is live) and the word. */
export function StatusBadge({ status }) {
  const t = useTranslations('battlepass');
  const key = STATUS_TONE[status] ? status : 'draft';
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${STATUS_TONE[key]}`}>
      <span className="relative inline-flex h-1.5 w-1.5" aria-hidden="true">
        {key === 'active' ? <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300/70 motion-reduce:animate-none" /> : null}
        <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${STATUS_DOT[key]}`} />
      </span>
      {t(`status.${key}`)}
    </span>
  );
}

const TABS = [
  ['general', Settings2], ['levels', Layers], ['xp', Gauge], ['rewards', Gift], ['badges', Award], ['quests', Target],
  ['achievements', Trophy], ['collections', Boxes], ['artwork', Palette], ['localization', Languages],
];

// Which tab holds a field the server refused, so a refusal is never hidden on a tab the person is not looking at.
const TAB_OF = { name: 'general', description: 'general', starts_at: 'general', ends_at: 'general', notifications: 'general', protection: 'general',
  level_count: 'levels', curve: 'levels', overrides: 'levels', levels: 'levels', xp: 'xp', rewards: 'rewards', quests: 'quests',
  achievements: 'achievements', collections: 'collections', page: 'artwork', i18n: 'localization' };
const tabOfError = (e) => TAB_OF[String(e?.field || '').split('.')[0]] || 'general';

/** One season: every setting, validated by the server; the bot and the dashboard read the same document. */
export default function SeasonEditor({ base, scope, seasonId, onClose, onChanged }) {
  const t = useTranslations('battlepass');
  const text = useBpText();
  const [state, setState] = useState({ loading: true, error: null, season: null, effective: null, activation: null, limits: null, busy: [] });
  const [saved, setSaved] = useState(null);
  const [draft, setDraft] = useState(null);
  const [tab, setTab] = useState('general');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState([]);
  const [busy, setBusy] = useState('');
  const [confirm, setConfirm] = useState(null);

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    const r = await bp(`${base}/${seasonId}`);
    if (!r.ok) { setState((s) => ({ ...s, loading: false, error: text.api(r.data?.error) })); return; }
    setState({ loading: false, error: null, season: r.data.season, effective: r.data.effective_status, activation: r.data.activation, limits: r.data.limits, busy: r.data.busy || [] });
    setSaved(r.data.season); setDraft(r.data.season); setErrors([]);
  }, [base, seasonId, text]);
  useEffect(() => { load(); }, [load]);

  const set = useCallback((path, value) => setDraft((d) => setPath(d, path, value)), []);
  const dirty = useMemo(() => JSON.stringify(saved) !== JSON.stringify(draft), [saved, draft]);
  const errorBadges = useMemo(() => { const b = {}; for (const e of errors) { const k = tabOfError(e); b[k] = (b[k] || 0) + 1; } return b; }, [errors]);

  const save = async () => {
    setSaving(true); setErrors([]);
    const r = await bp(`${base}/${seasonId}`, { method: 'PATCH', body: draft });
    setSaving(false);
    if (r.ok) { toast.success(t('editor.saved')); await load(); onChanged?.(); return; }
    if (r.data?.error === 'validation_failed') { const list = r.data.errors || []; setErrors(list); if (list.length) setTab(tabOfError(list[0])); toast.error(t('editor.fixErrors')); } else toast.error(text.api(r.data?.error));
  };

  const act = async (action) => {
    setBusy(action);
    const r = await bp(`${base}/${seasonId}/${action}`, { method: 'POST' });
    setBusy('');
    if (r.ok) {
      toast.success(t(`editor.done.${action}`));
      onChanged?.();
      if (action === 'duplicate') { onClose?.(r.data.season.id); return; }
      await load();
      return;
    }
    toast.error(text.api(r.data?.error, r.data?.reason));
    if (r.data?.error === 'invalid_config') { setErrors(r.data.errors || []); setTab('general'); }
  };

  const remove = async () => {
    setBusy('delete');
    const r = await bp(`${base}/${seasonId}`, { method: 'DELETE' });
    setBusy('');
    if (r.ok) { toast.success(t('editor.done.delete')); onChanged?.(); onClose?.(); } else toast.error(text.api(r.data?.error));
    setConfirm(null);
  };

  const s = state.season;
  const eff = state.effective;
  const act1 = state.activation;
  const canActivate = s && ['draft', 'scheduled', 'paused'].includes(s.status);
  const report = useMemo(() => {
    if (!draft || !canActivate) return null;
    const now = new Date();
    const conflicts = scope === 'guild' ? conflictsAgainst(draft, state.busy, now) : [];
    return readiness({ ...draft, status: s?.status }, { scope, premium: true, conflicts, now });
  }, [draft, canActivate, scope, state.busy, s?.status]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" onClick={() => onClose?.()} className="gap-2"><ArrowLeft className="h-4 w-4" />{t('editor.back')}</Button>
        {s ? (
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={eff || s.status} />
            {canActivate ? <Button size="sm" disabled={busy !== '' || dirty || act1?.ok === false} onClick={() => act(s.status === 'paused' ? 'resume' : 'activate')}>{busy === 'activate' || busy === 'resume' ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Play className="mr-1.5 h-4 w-4" />}{s.status === 'paused' ? t('actions.resume') : t('actions.activate')}</Button> : null}
            {['active', 'scheduled'].includes(s.status) ? <Button size="sm" variant="outline" disabled={busy !== ''} onClick={() => act('pause')}><Pause className="mr-1.5 h-4 w-4" />{t('actions.pause')}</Button> : null}
            {['active', 'scheduled', 'paused'].includes(s.status) && eff !== 'completed' ? <Button size="sm" variant="outline" disabled={busy !== ''} onClick={() => setConfirm('complete')}><Flag className="mr-1.5 h-4 w-4" />{t('actions.complete')}</Button> : null}
            <Button size="sm" variant="outline" disabled={busy !== ''} onClick={() => act('duplicate')}><Copy className="mr-1.5 h-4 w-4" />{t('actions.duplicate')}</Button>
            {['draft', 'paused', 'completed'].includes(s.status) || eff === 'completed' ? <Button size="sm" variant="outline" disabled={busy !== ''} onClick={() => setConfirm('archive')}><Archive className="mr-1.5 h-4 w-4" />{t('actions.archive')}</Button> : null}
            {s.status === 'draft' ? <Button size="sm" variant="ghost" className="text-red-400" disabled={busy !== ''} onClick={() => setConfirm('delete')}><Trash2 className="mr-1.5 h-4 w-4" />{t('actions.delete')}</Button> : null}
          </div>
        ) : null}
      </div>

      <LoadingOrError loading={state.loading && !draft} error={state.error} onRetry={load} data={draft}>
        {draft ? (
          <>
            {act1 && act1.ok === false && canActivate ? (
              <Card role="status" className="flex items-start gap-3 border-amber-400/40 bg-amber-500/10 p-4 text-sm">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
                <span>{text.api('activation_refused', act1.reason)}</span>
              </Card>
            ) : null}
            <PublishChecklist report={report} onGo={setTab} />
            {dirty && canActivate ? <p className="text-xs text-muted-foreground">{t('editor.saveBeforeActivate')}</p> : null}
            <ModuleTabs tabs={TABS.map(([key, icon]) => ({ key, icon, label: t(`tabs.${key}`) }))} active={tab} onChange={setTab} badges={errorBadges} />
            {tab === 'general' && <GeneralTab draft={draft} set={set} errors={errors} scope={scope} base={base} seasonId={seasonId} status={s?.status} dirty={dirty} busy={state.busy} />}
            {tab === 'levels' && <LevelsTab draft={draft} set={set} errors={errors} />}
            {tab === 'xp' && <XpTab draft={draft} set={set} errors={errors} scope={scope} limits={state.limits} />}
            {tab === 'rewards' && <RewardsTab draft={draft} set={set} errors={errors} scope={scope} />}
            {tab === 'badges' && <RewardsTab draft={draft} set={set} errors={errors} scope={scope} onlyBadges />}
            {tab === 'quests' && <QuestsTab draft={draft} set={set} errors={errors} scope={scope} />}
            {tab === 'achievements' && <AchievementsTab draft={draft} set={set} errors={errors} />}
            {tab === 'collections' && <CollectionsTab draft={draft} set={set} errors={errors} />}
            {tab === 'artwork' && <ThemeTab draft={draft} set={set} errors={errors} />}
            {tab === 'localization' && <LocalizationTab draft={draft} set={set} />}
            <SaveFooter dirty={dirty} saving={saving} onSave={save} onDiscard={() => { setDraft(saved); setErrors([]); }} errors={errors} />
          </>
        ) : null}
      </LoadingOrError>

      <ConfirmDialog
        open={confirm !== null} onOpenChange={(o) => { if (!o) setConfirm(null); }}
        title={confirm ? t(`confirm.${confirm}.title`) : ''} description={confirm ? t(`confirm.${confirm}.text`) : ''}
        confirmLabel={confirm ? t(`confirm.${confirm}.button`) : ''} busy={busy !== ''} destructive={confirm === 'delete'}
        onConfirm={() => (confirm === 'delete' ? remove() : act(confirm).then(() => setConfirm(null)))}
      />
    </div>
  );
}

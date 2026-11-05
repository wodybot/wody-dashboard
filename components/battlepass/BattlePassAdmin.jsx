'use client';
// Owner Panel > Battle Pass. Global seasons are created, scheduled and activated here, and the Premium ceilings are set.
import { useCallback, useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Activity, Gauge, History, LayoutDashboard, Layers, ShieldCheck } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { ModuleTabs, Section, LoadingOrError, SaveFooter } from '@/components/module-kit';
import { NumberField, bp, useBpText } from './bp-kit';
import SeasonManager from './SeasonManager';
import { StatusBadge } from './SeasonEditor';
import PageStudio from './studio/PageStudio';
import { ic } from '@/components/gifstudio/gs-kit';

function Stat({ label, value }) {
  return <Card className="p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p></Card>;
}

function Overview() {
  const t = useTranslations('battlepass');
  const text = useBpText();
  const [s, setS] = useState({ loading: true, error: null, data: null });
  const load = useCallback(async () => { const r = await bp('owner/overview'); setS({ loading: false, error: r.ok ? null : text.api(r.data?.error), data: r.ok ? r.data : null }); }, [text]);
  useEffect(() => { load(); }, [load]);
  const d = s.data;
  return (
    <LoadingOrError loading={s.loading} error={s.error} onRetry={load} data={d}>
      {d ? (
        <div className="space-y-4">
          <Card className="p-4">
            <p className="text-xs text-muted-foreground">{t('owner.running')}</p>
            {d.global_running ? <div className="mt-1 flex items-center gap-2"><span className="text-lg font-semibold">{d.global_running.name}</span><StatusBadge status="active" /></div> : <p className="mt-1 text-sm">{t('owner.noneRunning')}</p>}
          </Card>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label={t('owner.participants')} value={d.participants.toLocaleString()} />
            <Stat label={t('owner.globalSeasons')} value={d.counts.global} />
            <Stat label={t('owner.serverSeasons')} value={d.counts.server} />
            <Stat label={t('owner.suspended')} value={d.counts.server_suspended} />
          </div>
          <Section title={t('owner.week')} description={t('owner.weekIntro')}>
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
              <Stat label={t('owner.xpMessages')} value={d.week.xp_message.toLocaleString()} />
              <Stat label={t('owner.xpVoice')} value={d.week.xp_voice.toLocaleString()} />
              <Stat label={t('owner.xpQuests')} value={d.week.xp_quest.toLocaleString()} />
              <Stat label={t('owner.claims')} value={d.week.rewards_claimed.toLocaleString()} />
              <Stat label={t('owner.achievements')} value={d.week.achievements.toLocaleString()} />
            </div>
          </Section>
        </div>
      ) : null}
    </LoadingOrError>
  );
}

const LIMIT_FIELDS = [
  ['max_message_xp', 1, 100], ['max_voice_xp', 1, 100], ['max_per_day', 100, 100000], ['max_per_week', 100, 500000],
  ['max_per_season', 1000, 100000000], ['max_multiplier', 0, 2], ['min_message_cooldown', 10, 3600], ['min_voice_interval', 60, 3600],
];
function Limits() {
  const t = useTranslations('battlepass');
  const text = useBpText();
  const [s, setS] = useState({ loading: true, error: null });
  const [saved, setSaved] = useState(null);
  const [draft, setDraft] = useState(null);
  const [errors, setErrors] = useState([]);
  const [saving, setSaving] = useState(false);
  const load = useCallback(async () => {
    const r = await bp('owner/limits');
    if (r.ok) { setSaved(r.data.limits); setDraft(r.data.limits); setS({ loading: false, error: null }); } else setS({ loading: false, error: text.api(r.data?.error) });
  }, [text]);
  useEffect(() => { load(); }, [load]);
  const dirty = JSON.stringify(saved) !== JSON.stringify(draft);
  const save = async () => {
    setSaving(true); setErrors([]);
    const r = await bp('owner/limits', { method: 'PATCH', body: draft });
    setSaving(false);
    if (r.ok) { setSaved(r.data.limits); setDraft(r.data.limits); toast.success(t('editor.saved')); } else if (r.data?.error === 'validation_failed') setErrors(r.data.errors); else toast.error(text.api(r.data?.error));
  };
  return (
    <LoadingOrError loading={s.loading} error={s.error} onRetry={load} data={draft}>
      {draft ? (
        <>
          <Section title={t('owner.limitsTitle')} description={t('owner.limitsIntro')} icon={ShieldCheck}>
            <div className="grid gap-4 sm:grid-cols-2">
              {LIMIT_FIELDS.map(([key, min, max]) => (
                <NumberField key={key} label={t(`owner.limits.${key}`)} hint={t(`owner.limits.${key}Hint`)} value={draft[key]} onChange={(v) => setDraft({ ...draft, [key]: v })} min={min} max={max} step={key === 'max_multiplier' ? 0.1 : 1} errors={errors} path={key} />
              ))}
            </div>
            <p className="text-xs text-muted-foreground">{t('owner.limitsFloor')}</p>
          </Section>
          <SaveFooter dirty={dirty} saving={saving} onSave={save} onDiscard={() => setDraft(saved)} errors={errors} />
        </>
      ) : null}
    </LoadingOrError>
  );
}

function Reports() {
  const t = useTranslations('battlepass');
  const text = useBpText();
  const [s, setS] = useState({ loading: true, error: null, days: [] });
  const load = useCallback(async () => { const r = await bp('owner/reports'); setS({ loading: false, error: r.ok ? null : text.api(r.data?.error), days: r.ok ? r.data.days : [] }); }, [text]);
  useEffect(() => { load(); }, [load]);
  const max = Math.max(1, ...s.days.map((d) => d.xp));
  return (
    <LoadingOrError loading={s.loading} error={s.error} onRetry={load} data={s.days}>
      <Section title={t('owner.reportsTitle')} description={t('owner.reportsIntro')} icon={Activity}>
        {s.days.length === 0 ? <p className="text-sm text-muted-foreground">{t('owner.reportsEmpty')}</p> : (
          <div className="overflow-x-auto"><table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground"><tr><th className="px-2 py-1.5 text-left">{t('owner.day')}</th><th className="px-2 py-1.5 text-left">XP</th><th className="px-2 py-1.5 text-right">{t('owner.claims')}</th><th className="px-2 py-1.5 text-right">{t('owner.refused')}</th></tr></thead>
            <tbody>{s.days.map((d) => (
              <tr key={d.day} className="border-t border-border/30">
                <td className="px-2 py-1.5 tabular-nums">{d.day.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3')}</td>
                <td className="px-2 py-1.5"><div className="flex items-center gap-2"><div className="h-2 w-40 overflow-hidden rounded-full bg-secondary/40"><div className="h-full bg-[#e6cd8c]" style={{ width: `${(d.xp / max) * 100}%` }} /></div><span className="tabular-nums">{d.xp.toLocaleString()}</span></div></td>
                <td className="px-2 py-1.5 text-right tabular-nums">{d.rewards}</td><td className="px-2 py-1.5 text-right tabular-nums">{d.refused}</td>
              </tr>))}</tbody>
          </table></div>
        )}
        <p className="text-xs text-muted-foreground">{t('owner.reportsPrivacy')}</p>
      </Section>
    </LoadingOrError>
  );
}

function Audit() {
  const t = useTranslations('battlepass');
  const text = useBpText();
  const locale = useLocale();
  const [s, setS] = useState({ loading: true, error: null, rows: [] });
  const load = useCallback(async () => { const r = await bp('owner/audit'); setS({ loading: false, error: r.ok ? null : text.api(r.data?.error), rows: r.ok ? r.data.entries : [] }); }, [text]);
  useEffect(() => { load(); }, [load]);
  return (
    <LoadingOrError loading={s.loading} error={s.error} onRetry={load} data={s.rows}>
      <Section title={t('owner.auditTitle')} description={t('owner.auditIntro')} icon={History}>
        {s.rows.length === 0 ? <p className="text-sm text-muted-foreground">{t('owner.auditEmpty')}</p> : (
          <ul className="divide-y divide-border/30 text-sm">
            {s.rows.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="font-mono text-xs">{r.action}</span>
                <span className="text-xs text-muted-foreground">{r.target || '-'} · {r.actor || '-'} · {r.at ? new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeStyle: 'short' }).format(new Date(r.at)) : ''}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </LoadingOrError>
  );
}

const PAGES_ICON = ic('studio');

export default function BattlePassAdmin({ readOnly = false }) {
  const t = useTranslations('battlepass');
  const ts = useTranslations('bpStudio');
  const [tab, setTab] = useState('overview');
  return (
    <div>
      <ModuleTabs
        tabs={[...[['overview', LayoutDashboard], ['seasons', Layers], ['protection', Gauge], ['reports', Activity], ['audit', History]].map(([key, icon]) => ({ key, icon, label: t(`ownerTabs.${key}`) })), ...(readOnly ? [] : [{ key: 'pages', icon: PAGES_ICON, label: ts('ui.tabs.pages') }])]}
        active={tab} onChange={setTab}
      />
      {tab === 'overview' && <Overview />}
      {tab === 'seasons' && <SeasonManager scope="global" canCreate={!readOnly} />}
      {tab === 'protection' && <Limits />}
      {tab === 'reports' && <Reports />}
      {tab === 'audit' && <Audit />}
      {tab === 'pages' && !readOnly && <PageStudio />}
    </div>
  );
}

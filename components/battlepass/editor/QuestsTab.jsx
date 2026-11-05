'use client';
import { useTranslations } from 'next-intl';
import { Target, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Section } from '@/components/module-kit';
import { NumberField, TextField, SelectField, Problems } from '../bp-kit';
import { METRICS, PERIODS } from '@/lib/battlepass/constants.js';

let counter = 0;
const newId = (p) => `${p}${Date.now().toString(36)}${(counter++).toString(36)}`.slice(0, 40);

export function RewardPicker({ label, value, onChange, rewards, errors, path, t, exclude = [] }) {
  const options = [{ value: '', label: t('common.none') }, ...rewards.filter((r) => !exclude.includes(r.id)).map((r) => ({ value: r.id, label: r.name || r.id }))];
  return <SelectField label={label} value={value || ''} onChange={(v) => onChange(v || undefined)} options={options} errors={errors} path={path} />;
}

export default function QuestsTab({ draft, set, errors, scope }) {
  const t = useTranslations('battlepass');
  const list = draft.quests || [];
  const update = (i, patch) => set('quests', list.map((q, j) => (j === i ? { ...q, ...patch } : q)));
  return (
    <Section title={t('quests.title')} description={t('quests.intro')} icon={Target}>
      {list.length === 0 ? <p className="text-sm text-muted-foreground">{t('quests.empty')}</p> : null}
      <div className="space-y-4">
        {list.map((q, i) => {
          const base = `quests.${i + 1}`;
          return (
            <Card key={q.id} className="space-y-4 border-border/60 bg-secondary/10 p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold">{q.name || t('quests.unnamed')}</span>
                <Button type="button" variant="ghost" size="icon" aria-label={t('actions.remove')} onClick={() => set('quests', list.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField label={t('fields.name')} value={q.name} onChange={(v) => update(i, { name: v })} max={60} errors={errors} path={`${base}.name`} />
                <TextField label={t('fields.description')} value={q.description} onChange={(v) => update(i, { description: v })} max={200} errors={errors} path={`${base}.description`} />
              </div>
              <div className="grid gap-4 sm:grid-cols-4">
                <SelectField label={t('fields.metric')} hint={t('fields.metricHint')} value={q.metric} onChange={(v) => update(i, { metric: v })} options={METRICS} translate={(m) => t(`metric.${m}`)} errors={errors} path={`${base}.metric`} />
                <NumberField label={t('fields.target')} value={q.target} onChange={(v) => update(i, { target: v })} min={1} errors={errors} path={`${base}.target`} />
                <SelectField label={t('fields.period')} hint={t('fields.periodHint')} value={q.period} onChange={(v) => update(i, { period: v })} options={PERIODS} translate={(p) => t(`period.${p}`)} errors={errors} path={`${base}.period`} />
                <NumberField label={t('fields.bonusXp')} hint={t('fields.bonusXpHint')} value={q.xp_reward} onChange={(v) => update(i, { xp_reward: v })} min={0} max={scope === 'guild' ? 500 : 10000} suffix="XP" errors={errors} path={`${base}.xp_reward`} />
              </div>
              <RewardPicker label={t('fields.rewardOnComplete')} value={q.reward_id} onChange={(v) => update(i, { reward_id: v })} rewards={draft.rewards || []} errors={errors} path={`${base}.reward_id`} t={t} />
              <Problems errors={errors} path={base} />
            </Card>
          );
        })}
      </div>
      <Button type="button" variant="outline" disabled={list.length >= 60} onClick={() => set('quests', [...list, { id: newId('q'), name: '', metric: 'messages', target: 10, period: 'season', xp_reward: 0 }])}><Plus className="mr-1.5 h-4 w-4" />{t('quests.add')}</Button>
    </Section>
  );
}

'use client';
import { useTranslations } from 'next-intl';
import { Trophy, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Section } from '@/components/module-kit';
import { NumberField, TextField, SelectField, Problems } from '../bp-kit';
import { RewardPicker } from './QuestsTab';
import { METRICS } from '@/lib/battlepass/constants.js';

let counter = 0;
const newId = (p) => `${p}${Date.now().toString(36)}${(counter++).toString(36)}`.slice(0, 40);

export default function AchievementsTab({ draft, set, errors }) {
  const t = useTranslations('battlepass');
  const list = draft.achievements || [];
  const update = (i, patch) => set('achievements', list.map((a, j) => (j === i ? { ...a, ...patch } : a)));
  const updateCond = (i, k, patch) => update(i, { conditions: list[i].conditions.map((c, j) => (j === k ? { ...c, ...patch } : c)) });
  return (
    <Section title={t('achievements.title')} description={t('achievements.intro')} icon={Trophy}>
      {list.length === 0 ? <p className="text-sm text-muted-foreground">{t('achievements.empty')}</p> : null}
      <div className="space-y-4">
        {list.map((a, i) => {
          const base = `achievements.${i + 1}`;
          return (
            <Card key={a.id} className="space-y-4 border-border/60 bg-secondary/10 p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold">{a.name || t('achievements.unnamed')}</span>
                <Button type="button" variant="ghost" size="icon" aria-label={t('actions.remove')} onClick={() => set('achievements', list.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField label={t('fields.name')} value={a.name} onChange={(v) => update(i, { name: v })} max={60} errors={errors} path={`${base}.name`} />
                <TextField label={t('fields.description')} value={a.description} onChange={(v) => update(i, { description: v })} max={200} errors={errors} path={`${base}.description`} />
              </div>
              <div className="space-y-3">
                <p className="text-sm font-medium">{t('achievements.conditions')}</p>
                {(a.conditions || []).map((c, k) => (
                  <div key={k} className="grid items-end gap-3 sm:grid-cols-[1fr_9rem_auto]">
                    <SelectField label={t('fields.metric')} value={c.metric} onChange={(v) => updateCond(i, k, { metric: v })} options={METRICS} translate={(m) => t(`metric.${m}`)} errors={errors} path={`${base}.conditions.${k + 1}.metric`} />
                    <NumberField label={t('fields.target')} value={c.target} onChange={(v) => updateCond(i, k, { target: v })} min={1} errors={errors} path={`${base}.conditions.${k + 1}.target`} />
                    <Button type="button" variant="ghost" size="icon" aria-label={t('actions.remove')} disabled={(a.conditions || []).length <= 1} onClick={() => update(i, { conditions: a.conditions.filter((_, j) => j !== k) })}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" disabled={(a.conditions || []).length >= 5} onClick={() => update(i, { conditions: [...(a.conditions || []), { metric: 'messages', target: 100 }] })}><Plus className="mr-1.5 h-4 w-4" />{t('achievements.addCondition')}</Button>
                <p className="text-xs text-muted-foreground">{t('achievements.allRequired')}</p>
                <Problems errors={errors} path={`${base}.conditions`} />
              </div>
              <RewardPicker label={t('fields.rewardOnComplete')} value={a.reward_id} onChange={(v) => update(i, { reward_id: v })} rewards={draft.rewards || []} errors={errors} path={`${base}.reward_id`} t={t} />
            </Card>
          );
        })}
      </div>
      <Button type="button" variant="outline" disabled={list.length >= 120} onClick={() => set('achievements', [...list, { id: newId('a'), name: '', conditions: [{ metric: 'level', target: 5 }] }])}><Plus className="mr-1.5 h-4 w-4" />{t('achievements.add')}</Button>
    </Section>
  );
}

'use client';
import { useTranslations } from 'next-intl';
import { Boxes, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Section } from '@/components/module-kit';
import { TextField, Problems } from '../bp-kit';
import { RewardPicker } from './QuestsTab';

let counter = 0;
const newId = (p) => `${p}${Date.now().toString(36)}${(counter++).toString(36)}`.slice(0, 40);

export default function CollectionsTab({ draft, set, errors }) {
  const t = useTranslations('battlepass');
  const list = draft.collections || [];
  const rewards = draft.rewards || [];
  const update = (i, patch) => set('collections', list.map((c, j) => (j === i ? { ...c, ...patch } : c)));
  const toggle = (i, id) => {
    const cur = list[i].reward_ids || [];
    update(i, { reward_ids: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id] });
  };
  return (
    <Section title={t('collections.title')} description={t('collections.intro')} icon={Boxes}>
      {list.length === 0 ? <p className="text-sm text-muted-foreground">{t('collections.empty')}</p> : null}
      <div className="space-y-4">
        {list.map((c, i) => {
          const base = `collections.${i + 1}`;
          return (
            <Card key={c.id} className="space-y-4 border-border/60 bg-secondary/10 p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold">{c.name || t('collections.unnamed')}</span>
                <Button type="button" variant="ghost" size="icon" aria-label={t('actions.remove')} onClick={() => set('collections', list.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField label={t('fields.name')} value={c.name} onChange={(v) => update(i, { name: v })} max={60} errors={errors} path={`${base}.name`} />
                <TextField label={t('fields.description')} value={c.description} onChange={(v) => update(i, { description: v })} max={200} errors={errors} path={`${base}.description`} />
              </div>
              <div>
                <p className="mb-2 text-sm font-medium">{t('collections.members')}</p>
                {rewards.length === 0 ? <p className="text-xs text-muted-foreground">{t('collections.needRewards')}</p> : (
                  <div className="flex flex-wrap gap-2">
                    {rewards.map((r) => {
                      const on = (c.reward_ids || []).includes(r.id);
                      return (
                        <button key={r.id} type="button" aria-pressed={on} onClick={() => toggle(i, r.id)}
                          className={`rounded-full border px-3 py-1 text-xs transition-colors ${on ? 'border-[#e6cd8c] bg-[#e6cd8c]/15 text-[#e6cd8c]' : 'border-border/60 text-muted-foreground hover:text-foreground'}`}>
                          {r.name || r.id}
                        </button>
                      );
                    })}
                  </div>
                )}
                <Problems errors={errors} path={`${base}.reward_ids`} />
              </div>
              <RewardPicker label={t('collections.completionReward')} value={c.completion_reward_id} onChange={(v) => update(i, { completion_reward_id: v })} rewards={rewards} exclude={c.reward_ids || []} errors={errors} path={`${base}.completion_reward_id`} t={t} />
              <p className="text-xs text-muted-foreground">{t('collections.completionNote')}</p>
            </Card>
          );
        })}
      </div>
      <Button type="button" variant="outline" disabled={list.length >= 40} onClick={() => set('collections', [...list, { id: newId('c'), name: '', reward_ids: [] }])}><Plus className="mr-1.5 h-4 w-4" />{t('collections.add')}</Button>
    </Section>
  );
}

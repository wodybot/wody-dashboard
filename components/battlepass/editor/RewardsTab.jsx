'use client';
import { useTranslations } from 'next-intl';
import { Gift, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Section, Field, SwitchRow } from '@/components/module-kit';
import { Input } from '@/components/ui/input';
import BadgeMark from '../BadgeMark';
import { NumberField, TextField, SelectField, DateField, RarityBadge, Problems, ColorInput } from '../bp-kit';
import { RARITIES, REWARD_TYPES, CLAIM_MODES, BADGE_SHAPES } from '@/lib/battlepass/constants.js';

let counter = 0;
const newId = (prefix) => `${prefix}${Date.now().toString(36)}${(counter++).toString(36)}`.slice(0, 40);

/** Rewards and badges share one list: the Badges tab shows only the rewards of type "badge". */
export default function RewardsTab({ draft, set, errors, scope = 'global', onlyBadges = false }) {
  const t = useTranslations('battlepass');
  const all = draft.rewards || [];
  const shown = all.map((r, index) => ({ r, index })).filter(({ r }) => (onlyBadges ? r.type === 'badge' : true));
  const update = (index, patch) => set('rewards', all.map((r, i) => (i === index ? { ...r, ...patch } : r)));

  const add = () => set('rewards', [...all, { id: newId('r'), name: '', type: 'badge', rarity: 'common', claim_mode: 'manual', level: 1, required_xp: 0 }]);

  // Removing a reward also removes every place that pointed to it, so the season stays consistent.
  const remove = (index) => {
    const id = all[index].id;
    const next = { rewards: all.filter((_, i) => i !== index) };
    next.quests = (draft.quests || []).map((q) => (q.reward_id === id ? { ...q, reward_id: undefined } : q));
    next.achievements = (draft.achievements || []).map((a) => (a.reward_id === id ? { ...a, reward_id: undefined } : a));
    next.collections = (draft.collections || []).map((c) => ({ ...c, reward_ids: (c.reward_ids || []).filter((x) => x !== id), completion_reward_id: c.completion_reward_id === id ? undefined : c.completion_reward_id }));
    for (const [k, v] of Object.entries(next)) set(k, v);
  };

  return (
    <Section title={onlyBadges ? t('badges.title') : t('rewards.title')} description={onlyBadges ? t('badges.intro') : t('rewards.intro')} icon={Gift}>
      {shown.length === 0 ? <p className="text-sm text-muted-foreground">{t('rewards.empty')}</p> : null}
      <div className="space-y-4">
        {shown.map(({ r, index }) => {
          const base = `rewards.${index + 1}`;
          return (
            <Card key={r.id} className="space-y-4 border-border/60 bg-secondary/10 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2"><span className="font-semibold">{r.name || t('rewards.unnamed')}</span><RarityBadge rarity={r.rarity} /><span className="text-xs text-muted-foreground">{t('levels.levelN', { level: r.level })}</span></div>
                <Button type="button" variant="ghost" size="icon" aria-label={t('actions.remove')} onClick={() => remove(index)}><Trash2 className="h-4 w-4" /></Button>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField label={t('fields.name')} value={r.name} onChange={(v) => update(index, { name: v })} max={60} errors={errors} path={`${base}.name`} />
                <SelectField label={t('fields.rewardType')} value={r.type} onChange={(v) => update(index, { type: v })} options={REWARD_TYPES} translate={(x) => t(`rewardType.${x}`)} errors={errors} path={`${base}.type`} />
              </div>
              <TextField label={t('fields.description')} value={r.description} onChange={(v) => update(index, { description: v })} max={200} errors={errors} path={`${base}.description`} />
              <div className="grid gap-4 sm:grid-cols-4">
                <SelectField label={t('fields.rarity')} value={r.rarity} onChange={(v) => update(index, { rarity: v })} options={RARITIES} translate={(x) => t(`rarity.${x}`)} errors={errors} path={`${base}.rarity`} />
                <NumberField label={t('fields.unlockLevel')} value={r.level} onChange={(v) => update(index, { level: v })} min={1} max={draft.level_count || 200} errors={errors} path={`${base}.level`} />
                <NumberField label={t('fields.requiredXp')} hint={t('fields.requiredXpHint')} value={r.required_xp} onChange={(v) => update(index, { required_xp: v })} min={0} errors={errors} path={`${base}.required_xp`} suffix="XP" />
                <SelectField label={t('fields.claimMode')} hint={t('fields.claimModeHint')} value={r.claim_mode} onChange={(v) => update(index, { claim_mode: v })} options={CLAIM_MODES} translate={(x) => t(`claimMode.${x}`)} errors={errors} path={`${base}.claim_mode`} />
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <TextField label={t('fields.iconUrl')} hint={t('fields.imageHint')} value={r.icon} onChange={(v) => update(index, { icon: v })} errors={errors} path={`${base}.icon`} placeholder="https://" />
                <TextField label={t('fields.artUrl')} hint={t('fields.imageHint')} value={r.art} onChange={(v) => update(index, { art: v })} errors={errors} path={`${base}.art`} placeholder="https://" />
                <DateField label={t('fields.availableUntil')} hint={t('fields.availableUntilHint')} value={r.availability?.until} onChange={(v) => update(index, { availability: v ? { until: v } : undefined })} errors={errors} path={`${base}.availability.until`} />
              </div>
              <div className="grid gap-4 rounded-xl border border-border/50 bg-background/30 p-4 sm:grid-cols-[auto_1fr]">
                <div className="flex flex-col items-center gap-1.5">
                  <BadgeMark badge={r.badge} image={r.art || r.icon} size={72} />
                  <span className="text-[11px] text-muted-foreground">{t('custom.preview')}</span>
                </div>
                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-semibold">{t('custom.lookTitle')}</p>
                    <p className="text-xs text-muted-foreground">{t('custom.lookHint')}</p>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <SelectField label={t('custom.shape')} value={r.badge?.shape || 'circle'} onChange={(v) => update(index, { badge: { ...(r.badge || {}), shape: v } })} options={BADGE_SHAPES} translate={(x) => t(`custom.shapes.${x}`)} errors={errors} path={`${base}.badge.shape`} />
                    <ColorInput label={t('custom.color')} value={r.badge?.color || ''} onChange={(v) => update(index, { badge: { ...(r.badge || {}), color: v } })} errors={errors} path={`${base}.badge.color`} />
                  </div>
                  {r.badge ? <Button type="button" variant="ghost" size="sm" onClick={() => update(index, { badge: undefined })}>{t('custom.resetLook')}</Button> : null}
                </div>
              </div>
              <div className="space-y-3 rounded-xl border border-border/50 bg-background/30 p-4">
                <div>
                  <p className="text-sm font-semibold">{t('custom.claimTitle')}</p>
                  <p className="text-xs text-muted-foreground">{t('custom.claimHint')}</p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <TextField label={t('custom.claimLabel')} hint={t('custom.claimLabelHint')} value={r.claim?.label} onChange={(v) => update(index, { claim: { ...(r.claim || {}), label: v } })} max={24} errors={errors} path={`${base}.claim.label`} placeholder={t('reward.claim')} />
                  {scope === 'guild' ? (
                    <Field label={t('custom.claimRole')} hint={t('custom.claimRoleHint')} errors={errors} field={`${base}.claim.role_id`}>
                      <Input value={r.claim?.role_id || ''} inputMode="numeric" placeholder="123456789012345678" onChange={(e) => update(index, { claim: { ...(r.claim || {}), role_id: e.target.value.trim() || undefined } })} />
                    </Field>
                  ) : null}
                </div>
                <TextField label={t('custom.claimMessage')} hint={t('custom.claimMessageHint')} value={r.claim?.message} onChange={(v) => update(index, { claim: { ...(r.claim || {}), message: v } })} max={300} errors={errors} path={`${base}.claim.message`} multiline rows={2} />
                <SwitchRow label={t('custom.claimDm')} hint={t('custom.claimDmHint')} checked={Boolean(r.claim?.dm)} onChange={(v) => update(index, { claim: { ...(r.claim || {}), dm: v } })} />
              </div>
              <Problems errors={errors} path={base} />
            </Card>
          );
        })}
      </div>
      <Button type="button" variant="outline" onClick={add} disabled={all.length >= 400}><Plus className="mr-1.5 h-4 w-4" />{onlyBadges ? t('badges.add') : t('rewards.add')}</Button>
    </Section>
  );
}

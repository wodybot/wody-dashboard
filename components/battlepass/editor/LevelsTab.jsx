'use client';
import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { Layers, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Section } from '@/components/module-kit';
import { NumberField, SelectField, Problems } from '../bp-kit';
import { resolveCosts, thresholds } from '@/lib/battlepass/curve.js';
import { CURVES } from '@/lib/battlepass/constants.js';

export default function LevelsTab({ draft, set, errors }) {
  const t = useTranslations('battlepass');
  const count = Number(draft.level_count) || 0;
  const curve = draft.curve || { type: 'fixed', base: 100 };
  const overrides = draft.overrides || {};
  const costs = useMemo(() => {
    try { return resolveCosts({ ...curve, costs: curve.costs || [] }, Math.max(0, Math.min(200, count)), overrides); } catch { return []; }
  }, [curve, count, overrides]);
  const thr = useMemo(() => thresholds(costs), [costs]);
  const total = thr.at(-1) || 0;
  const rows = Object.entries(overrides).map(([level, xp]) => ({ level, xp }));

  const setOverride = (oldLevel, level, xp) => {
    const next = { ...overrides };
    delete next[oldLevel];
    if (level !== '' && level !== null) next[level] = xp;
    set('overrides', next);
  };

  return (
    <div className="space-y-6">
      <Section title={t('levels.title')} description={t('levels.intro')} icon={Layers}>
        <div className="grid gap-4 sm:grid-cols-2">
          <NumberField label={t('fields.levelCount')} hint={t('fields.levelCountHint')} value={draft.level_count} onChange={(v) => set('level_count', v)} min={1} max={200} errors={errors} path="level_count" />
          <SelectField label={t('fields.curveType')} hint={t('fields.curveTypeHint')} value={curve.type} onChange={(v) => set('curve.type', v)} options={CURVES} translate={(c) => t(`curve.${c}`)} errors={errors} path="curve.type" />
        </div>
        {curve.type !== 'custom' ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <NumberField label={t('fields.curveBase')} hint={t('fields.curveBaseHint')} value={curve.base} onChange={(v) => set('curve.base', v)} min={1} max={1000000} suffix="XP" errors={errors} path="curve.base" />
            {curve.type === 'progressive' ? (
              <NumberField label={t('fields.curveStep')} hint={t('fields.curveStepHint')} value={curve.step} onChange={(v) => set('curve.step', v)} min={0} max={1000000} suffix="XP" errors={errors} path="curve.step" />
            ) : null}
          </div>
        ) : (
          <div>
            <label className="mb-1.5 block text-sm font-medium" htmlFor="bp-custom-costs">{t('fields.curveCosts')}</label>
            <textarea
              id="bp-custom-costs" rows={3} value={(curve.costs || []).join(', ')} placeholder="100, 120, 150, 200"
              onChange={(e) => set('curve.costs', e.target.value.split(/[\s,;]+/).filter(Boolean).map(Number))}
              className="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <p className="mt-1 text-xs text-muted-foreground">{t('fields.curveCostsHint')}</p>
            <Problems errors={errors} path="curve.costs" />
          </div>
        )}
        <Problems errors={errors} path="levels" />
      </Section>

      <Section title={t('levels.overrides')} description={t('levels.overridesIntro')}>
        {rows.map((row, i) => (
          <div key={`${row.level}-${i}`} className="flex flex-wrap items-center gap-2">
            <Input type="number" min={1} max={count || 200} value={row.level} className="w-24" aria-label={t('levels.level')} onChange={(e) => setOverride(row.level, e.target.value, row.xp)} />
            <Input type="number" min={1} value={row.xp} className="w-32" aria-label="XP" onChange={(e) => setOverride(row.level, row.level, Number(e.target.value))} />
            <span className="text-xs text-muted-foreground">XP</span>
            <Button type="button" variant="ghost" size="icon" aria-label={t('actions.remove')} onClick={() => setOverride(row.level, '', 0)}><Trash2 className="h-4 w-4" /></Button>
            <Problems errors={errors} path={`overrides.${row.level}`} />
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={() => setOverride('', String(Math.min(count || 1, rows.length + 1)), 100)}><Plus className="mr-1.5 h-4 w-4" />{t('levels.addOverride')}</Button>
      </Section>

      <Section title={t('levels.preview')} description={t('levels.previewIntro', { total: total.toLocaleString() })}>
        <div className="max-h-72 overflow-auto rounded-lg border border-border/50">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-card text-xs text-muted-foreground"><tr><th className="px-3 py-2 text-left">{t('levels.level')}</th><th className="px-3 py-2 text-right">{t('levels.cost')}</th><th className="px-3 py-2 text-right">{t('levels.cumulative')}</th></tr></thead>
            <tbody>{costs.map((c, i) => <tr key={i} className="border-t border-border/30"><td className="px-3 py-1.5">{i + 1}</td><td className="px-3 py-1.5 text-right tabular-nums">{c.toLocaleString()}</td><td className="px-3 py-1.5 text-right tabular-nums">{thr[i].toLocaleString()}</td></tr>)}</tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}

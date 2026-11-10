'use client';
// "What is still missing": the list changes with the dates the person picked (a season that starts later, one that starts now,
// one that would overlap Wody's own). Items that block publishing come first; each one jumps to the tab where it is fixed.
import { useTranslations } from 'next-intl';
import { Check, Circle, CircleAlert } from 'lucide-react';
import { Card } from '@/components/ui/card';

const TAB_FOR = { name: 'general', description: 'general', levels: 'levels', xp_source: 'xp', rewards: 'rewards', start_future: 'general', start_now: 'general', end_after_start: 'general', end_not_past: 'general', no_wody_overlap: 'general', channel: 'general' };

export default function PublishChecklist({ report, onGo }) {
  const t = useTranslations('battlepass');
  if (!report) return null;
  const missing = report.items.filter((i) => !i.ok && i.required);
  const advice = report.items.filter((i) => !i.ok && !i.required);
  const done = report.items.filter((i) => i.ok);
  const row = (i, tone) => {
    const tab = TAB_FOR[i.id];
    const body = (
      <>
        {tone === 'missing' ? <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" aria-hidden="true" /> : tone === 'advice' ? <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" /> : <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" aria-hidden="true" />}
        <span className="min-w-0 text-left">{t(`readiness.items.${i.id}`)}{tone !== 'done' && t.has(`readiness.fix.${i.id}`) ? <span className="block text-xs text-muted-foreground">{t(`readiness.fix.${i.id}`)}</span> : null}</span>
      </>
    );
    return (
      <li key={i.id}>
        {tab && tone !== 'done' && onGo
          ? <button type="button" onClick={() => onGo(tab)} className="flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#e6cd8c]">{body}</button>
          : <div className="flex items-start gap-2 px-2 py-1.5 text-sm">{body}</div>}
      </li>
    );
  };
  return (
    <Card className={`p-4 ${report.ready ? 'border-emerald-400/30 bg-emerald-500/5' : 'border-amber-400/30 bg-amber-500/5'}`} role="status">
      <p className="font-semibold">{report.ready ? t('readiness.ready') : t('readiness.missing', { count: missing.length })}</p>
      <p className="mb-2 text-xs text-muted-foreground">{report.later ? t('readiness.introLater') : t('readiness.introNow')}</p>
      <ul>
        {missing.map((i) => row(i, 'missing'))}
        {advice.map((i) => row(i, 'advice'))}
        {done.map((i) => row(i, 'done'))}
      </ul>
    </Card>
  );
}

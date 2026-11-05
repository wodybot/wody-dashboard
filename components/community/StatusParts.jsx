'use client';
import { useLocale, useTranslations } from 'next-intl';
import { CheckCircle2, Clock, Flag, MessageSquareWarning, PauseCircle, Rocket, Send, Sparkles, XCircle, EyeOff, FilePlus2 } from 'lucide-react';

const TONE = {
  draft: 'border-border/60 bg-secondary/40 text-muted-foreground',
  pending_review: 'border-amber-400/40 bg-amber-400/10 text-amber-300',
  changes_requested: 'border-orange-400/40 bg-orange-400/10 text-orange-300',
  approved: 'border-sky-400/40 bg-sky-400/10 text-sky-300',
  published: 'border-emerald-400/40 bg-emerald-400/10 text-emerald-300',
  rejected: 'border-red-400/40 bg-red-400/10 text-red-300',
  suspended: 'border-rose-500/40 bg-rose-500/10 text-rose-300',
  unpublished: 'border-slate-400/40 bg-slate-400/10 text-slate-300',
};

export function StatusBadge({ status, updateState = null, large = false }) {
  const t = useTranslations('community');
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <span className={`inline-flex items-center rounded-full border font-bold uppercase tracking-wide ${large ? 'px-3 py-1 text-sm' : 'px-2.5 py-0.5 text-[11px]'} ${TONE[status] || TONE.draft}`}>{t(`status.labels.${status}`)}</span>
      {updateState ? <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${updateState === 'pending' ? TONE.pending_review : TONE.changes_requested}`}>{t(`status.update.${updateState}`)}</span> : null}
    </span>
  );
}

const ICON = {
  created: FilePlus2, submitted: Send, resubmitted: Send, changes_requested: MessageSquareWarning, approved: CheckCircle2, published: Rocket,
  rejected: XCircle, suspended: PauseCircle, unpublished: EyeOff,
};

const TIMELINE_TONE = {
  approved: 'border-emerald-400/50 bg-emerald-500/15 text-emerald-300', published: 'border-emerald-400/50 bg-emerald-500/15 text-emerald-300',
  rejected: 'border-red-400/50 bg-red-500/15 text-red-300', suspended: 'border-red-400/50 bg-red-500/15 text-red-300', unpublished: 'border-red-400/40 bg-red-500/10 text-red-300',
  changes_requested: 'border-amber-400/50 bg-amber-500/15 text-amber-200',
  submitted: 'border-sky-400/50 bg-sky-500/15 text-sky-300', resubmitted: 'border-sky-400/50 bg-sky-500/15 text-sky-300',
};

export function Timeline({ items = [], admin = false }) {
  const t = useTranslations('community');
  const locale = useLocale();
  if (!items.length) return <p className="text-sm text-muted-foreground">{t('history.empty')}</p>;
  return (
    <ol className="relative ml-3.5 space-y-4 border-l border-border/60 pl-7">
      {items.map((item, i) => {
        const Icon = ICON[item.type] || (item.type.startsWith('report') ? Flag : item.type === 'note' ? Sparkles : Clock);
        const tone = TIMELINE_TONE[item.type] || 'border-border bg-background text-foreground/80';
        return (
          <li key={i} className="relative">
            <span className={`absolute -left-[2.6rem] top-0.5 flex h-7 w-7 items-center justify-center rounded-full border ${tone}`}><Icon className="h-3.5 w-3.5" aria-hidden="true" /></span>
            <div className="rounded-xl border border-border/50 bg-secondary/10 px-3 py-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold">{t.has(`timeline.${item.type}`) ? t(`timeline.${item.type}`) : item.type}</p>
                {item.version ? <span className="inline-flex items-center rounded-full border border-border/70 bg-background/50 px-2 py-0.5 font-mono text-[10px] font-semibold">{t('status.version')} {item.version}</span> : null}
              </div>
              <time className="mt-0.5 block text-xs text-muted-foreground" dateTime={item.at}>{new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(item.at))}{admin && item.actor ? ` · ${item.actor}` : ''}{item.kind ? ` · ${t(`timeline.by.${item.kind}`)}` : ''}</time>
              {item.reason ? <p className="mt-1.5 text-xs text-muted-foreground">{t.has(`reject.${item.reason}`) ? t(`reject.${item.reason}`) : item.reason}</p> : null}
              {item.message ? <p className="mt-2 whitespace-pre-line break-words rounded-lg bg-background/40 p-2.5 text-sm">{item.message}</p> : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

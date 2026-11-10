'use client';
// Dashboard > Premium > Battle Pass. Server seasons run in the same engine as the Global season; when a Global season is
// active it has priority and server seasons keep their settings and progress but do not run (the banner says so).
import { useCallback, useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { CalendarClock, Check, Copy, ExternalLink, Info, Layers, ClipboardList, Link2, Radio } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ModuleTabs, PremiumLock } from '@/components/module-kit';
import { bp, useBpText } from './bp-kit';
import SeasonManager from './SeasonManager';
import DeliveryFormPanel from './DeliveryFormPanel';
import LocalDate from './LocalDate';

const PILL = {
  live: 'border-emerald-400/40 bg-emerald-500/10 text-emerald-300',
  soon: 'border-amber-300/40 bg-amber-300/10 text-amber-200',
  paused: 'border-border/60 bg-secondary/40 text-muted-foreground',
  none: 'border-border/60 bg-secondary/30 text-muted-foreground',
};

/** The permanent address of the server's Battle Pass: always the same, whatever season runs, so it can be pinned in the server. */
function PermanentLink({ href }) {
  const t = useTranslations('battlepass');
  const [origin, setOrigin] = useState('');
  const [copied, setCopied] = useState(false);
  useEffect(() => { setOrigin(window.location.origin); }, []);
  const url = `${origin}${href}`;
  const copy = async () => {
    try { await navigator.clipboard.writeText(url); setCopied(true); toast.success(t('premiumPanel.copied')); setTimeout(() => setCopied(false), 2000); } catch { /* the field is selectable as a fallback */ }
  };
  return (
    <div className="rounded-xl border border-border/60 bg-background/40 p-3">
      <div className="mb-1.5 flex items-center gap-2 text-xs font-semibold text-muted-foreground"><Link2 className="h-3.5 w-3.5" aria-hidden="true" />{t('premiumPanel.permanentLink')}</div>
      <div className="flex flex-wrap items-center gap-2">
        <input readOnly value={url} aria-label={t('premiumPanel.permanentLink')} onFocus={(e) => e.target.select()} className="h-9 min-w-0 flex-1 rounded-lg border border-border/60 bg-secondary/20 px-3 font-mono text-xs" />
        <Button size="sm" variant="outline" onClick={copy}>{copied ? <Check className="mr-1.5 h-4 w-4 text-emerald-300" /> : <Copy className="mr-1.5 h-4 w-4" />}{t('premiumPanel.copyLink')}</Button>
        <Button asChild size="sm" variant="outline"><a href={href} target="_blank" rel="noopener noreferrer"><ExternalLink className="mr-1.5 h-4 w-4" />{t('premiumPanel.openPage')}</a></Button>
      </div>
      <p className="mt-1.5 text-[11px] text-muted-foreground">{t('premiumPanel.permanentHint')}</p>
    </div>
  );
}

/** Status of the server's Battle Pass: what runs now, what comes next (name, text and start date) and the permanent link. */
function StatusBanner({ guildId, premium }) {
  const t = useTranslations('battlepass');
  const text = useBpText();
  const locale = useLocale();
  const [s, setS] = useState(null);
  const load = useCallback(async () => { const r = await bp(`guilds/${guildId}/status`); if (r.ok) setS(r.data); }, [guildId]);
  useEffect(() => { load(); }, [load]);
  if (!s) return null;
  const href = `${locale === 'en' ? '' : `/${locale}`}/servers/${guildId}/battlepass`;
  const next = (s.upcoming || [])[0] || null;
  const nextName = next ? (next.i18n?.[locale]?.name || next.name) : '';
  const nextText = next ? (next.i18n?.[locale]?.description || next.description || '') : '';
  let kind = 'none'; let title = t('premiumPanel.nothingRunning'); let note = '';
  if (s.running) {
    kind = 'live'; title = s.running.name;
    if (s.running.scope === 'global') note = s.reason === 'global_active' ? text.api('activation_refused', 'global_active') : t('premiumPanel.globalRunning', { name: s.running.name });
  } else if (s.reason === 'not_premium') { note = text.api('activation_refused', 'not_premium'); }
  else if (next) { kind = 'soon'; title = nextName; }
  const pillLabel = kind === 'live' ? t('statusPublic.active') : kind === 'soon' ? t('statusPublic.scheduled') : t('premiumPanel.noneBadge');
  const PillIcon = kind === 'live' ? Radio : kind === 'soon' ? CalendarClock : Info;
  return (
    <Card role="status" aria-label={t('premiumPanel.statusTitle')} className="space-y-4 overflow-hidden border-border/60 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${PILL[kind]}`}><PillIcon className="h-3 w-3" aria-hidden="true" />{pillLabel}</span>
            {s.running ? <span className="rounded-full border border-border/60 bg-secondary/30 px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">{s.running.scope === 'global' ? t('premiumPanel.scopeGlobal') : t('premiumPanel.scopeServer')}</span> : null}
          </div>
          <h3 className="break-words text-lg font-bold leading-tight">{title}</h3>
          {s.running?.ends_at ? <p className="text-xs text-muted-foreground">{t.rich('premiumPanel.endsOn', { date: <LocalDate value={s.running.ends_at} /> })}</p> : null}
          {kind === 'soon' ? <p className="text-xs text-muted-foreground">{next.starts_at ? t.rich('premiumPanel.startsOn', { date: <LocalDate value={next.starts_at} /> }) : t('premiumPanel.noStartDate')}</p> : null}
          {kind === 'soon' && nextText ? <p className="max-w-xl whitespace-pre-line break-words text-sm text-muted-foreground">{nextText}</p> : null}
        </div>
      </div>
      {note ? <p className="flex items-start gap-2 rounded-lg border border-sky-400/30 bg-sky-500/10 p-3 text-sm"><Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />{note}</p> : null}
      {next && kind === 'live' ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-amber-300/30 bg-amber-300/[0.07] p-3 text-sm">
          <span className="inline-flex items-center gap-1.5 font-semibold text-amber-200"><CalendarClock className="h-4 w-4" aria-hidden="true" />{t('premiumPanel.nextSeason')}</span>
          <span className="min-w-0 truncate font-medium">{nextName}</span>
          <span className="text-xs text-muted-foreground">{next.starts_at ? t.rich('premiumPanel.startsOn', { date: <LocalDate value={next.starts_at} /> }) : t('premiumPanel.noStartDate')}</span>
        </div>
      ) : null}
      <PermanentLink href={href} />
    </Card>
  );
}

export default function BattlePassPremiumPanel({ guildId, premium, onGetPremium }) {
  const t = useTranslations('battlepass');
  const [tab, setTab] = useState('seasons');
  return (
    <div className="space-y-5">
      {!premium ? <PremiumLock title={t('premiumPanel.lockTitle')} text={t('premiumPanel.lockText')} onGetPremium={onGetPremium} /> : null}
      <StatusBanner guildId={guildId} premium={premium} />
      <ModuleTabs tabs={[{ key: 'seasons', icon: Layers, label: t('premiumPanel.tabs.seasons') }, { key: 'forms', icon: ClipboardList, label: t('forms.tab') }]} active={tab} onChange={setTab} />
      {tab === 'seasons' && <SeasonManager scope="guild" guildId={guildId} canCreate={premium} />}
      {tab === 'forms' && <DeliveryFormPanel guildId={guildId} premium={premium} />}
    </div>
  );
}

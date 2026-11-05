'use client';
// Dashboard > Premium > Battle Pass. Server seasons run in the same engine as the Global season; when a Global season is
// active it has priority and server seasons keep their settings and progress but do not run (the banner says so).
import { useCallback, useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ExternalLink, Info, Layers, ClipboardList } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ModuleTabs, PremiumLock } from '@/components/module-kit';
import { bp, useBpText } from './bp-kit';
import SeasonManager from './SeasonManager';
import DeliveryFormPanel from './DeliveryFormPanel';

function StatusBanner({ guildId, premium }) {
  const t = useTranslations('battlepass');
  const text = useBpText();
  const locale = useLocale();
  const [s, setS] = useState(null);
  const load = useCallback(async () => { const r = await bp(`guilds/${guildId}/status`); if (r.ok) setS(r.data); }, [guildId]);
  useEffect(() => { load(); }, [load]);
  if (!s) return null;
  const href = `${locale === 'en' ? '' : `/${locale}`}/servers/${guildId}/battlepass`;
  let tone = 'border-border/60 bg-secondary/20'; let message = t('premiumPanel.nothingRunning');
  if (s.running?.scope === 'global') {
    tone = 'border-sky-400/40 bg-sky-500/10';
    message = s.reason === 'global_active' ? text.api('activation_refused', 'global_active') : t('premiumPanel.globalRunning', { name: s.running.name });
  } else if (s.running) { tone = 'border-emerald-400/40 bg-emerald-500/10'; message = t('premiumPanel.serverRunning', { name: s.running.name }); }
  else if (s.reason === 'not_premium') { tone = 'border-amber-400/40 bg-amber-500/10'; message = text.api('activation_refused', 'not_premium'); }
  return (
    <Card role="status" className={`flex flex-wrap items-center justify-between gap-3 p-4 text-sm ${tone}`}>
      <span className="flex items-start gap-2"><Info className="mt-0.5 h-4 w-4 shrink-0" />{message}</span>
      {s.running ? <Button asChild variant="outline" size="sm"><a href={href} target="_blank" rel="noopener noreferrer"><ExternalLink className="mr-1.5 h-4 w-4" />{t('premiumPanel.openPage')}</a></Button> : null}
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

'use client';
// Wody Lookups (free, on by default). Members look things up on other services with /lookup <service>. There is nothing to
// configure per server besides the switch in the sidebar, so this page explains what is available and how it behaves.
// The command list is the bot's own (cogs/lookups.py, 16 commands); nothing here is sample data.
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Check, Copy, KeyRound, Search, ShieldCheck, Zap } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SectionHeader } from '@/components/dashboard-kit';
import { Section } from '@/components/module-kit';

export const LOOKUP_GROUPS = [
  { key: 'music', commands: ['nowplaying', 'itunes'] },
  { key: 'games', commands: ['mcserver', 'mcplayer', 'roblox', 'steam', 'chess'] },
  { key: 'creators', commands: ['twitch', 'kick', 'youtube', 'github'] },
  { key: 'media', commands: ['movie', 'show'] },
  { key: 'money', commands: ['crypto', 'convert'] },
  { key: 'social', commands: ['reddit'] },
];

export default function LookupsPanel({ onOpenModule }) {
  const t = useTranslations('guildSettings.lookups');
  const [copied, setCopied] = useState('');
  const copy = async (name) => {
    const text = `/lookup ${name}`;
    try { await navigator.clipboard.writeText(text); setCopied(name); toast.success(t('copied', { command: text })); setTimeout(() => setCopied(''), 1500); } catch { toast.error(t('copyFailed')); }
  };
  const total = LOOKUP_GROUPS.reduce((n, g) => n + g.commands.length, 0);
  return (
    <div className="space-y-5">
      <SectionHeader title={t('title')} description={t('description', { n: total })} />
      <div className="grid gap-3 sm:grid-cols-3">
        {[['free', ShieldCheck], ['fast', Zap], ['keys', KeyRound]].map(([k, Icon]) => (
          <Card key={k} className="flex gap-3 border-border/50 bg-secondary/10 p-4">
            <div className="module-icon-wrap flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"><Icon className="h-4 w-4" /></div>
            <div><p className="text-sm font-semibold">{t(`facts.${k}.title`)}</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{t(`facts.${k}.text`)}</p></div>
          </Card>
        ))}
      </div>
      {LOOKUP_GROUPS.map((g) => (
        <Section key={g.key} icon={Search} title={t(`groups.${g.key}.title`)} description={t(`groups.${g.key}.text`)}>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {g.commands.map((c) => (
              <div key={c} className="flex items-center justify-between gap-2 rounded-xl border border-border/50 bg-secondary/10 p-3">
                <div className="min-w-0">
                  <code className="text-sm">/lookup {c}</code>
                  <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{t(`commands.${c}`)}</p>
                </div>
                <Button size="sm" variant="ghost" onClick={() => copy(c)} aria-label={t('copy')}>{copied === c ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}</Button>
              </div>
            ))}
          </div>
        </Section>
      ))}
      <Card className="border-border/50 bg-secondary/10 p-4 text-sm text-muted-foreground">
        {t('footer')}
      </Card>
    </div>
  );
}

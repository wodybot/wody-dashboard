'use client';
import DiscordAppTag from '@/components/discord-app-tag';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Server } from 'lucide-react';
import { cn } from '@/lib/utils';
import AnimatedNumber from './animated-number';

export function BotStatusCard({ className = '' }) {
  const t = useTranslations('botStatus');
  const [status, setStatus] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch('/api/status/bot', { cache: 'no-store' });
        if (!res.ok) throw new Error('bad status');
        const d = await res.json();
        if (!cancelled) setStatus(d);
      } catch {
        if (!cancelled) setStatus((prev) => prev || { online: false, bot: null });
      }
    }
    load();
    const id = setInterval(load, 20_000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  const online = !!status?.online;
  const name = status?.bot?.username || 'Wody';

  const guildCount = status?.guild_count;
  const roundedGuildCount = guildCount != null ? Math.max(50, Math.floor(guildCount / 50) * 50) : null;

  const [imgFailed, setImgFailed] = useState(false);
  useEffect(() => { setImgFailed(false); }, [status?.bot?.avatar_url]);
  const avatar = imgFailed ? null : status?.bot?.avatar_url;

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-3xl border border-border bg-card/60 backdrop-blur px-6 py-5 shadow-[0_8px_30px_-8px_rgba(0,0,0,0.5)] ring-1 ring-white/[0.04] w-80',
        className
      )}
    >
      <div className="pointer-events-none absolute inset-x-0 -top-10 h-24 bg-gradient-to-b from-white/[0.06] to-transparent" />
      <div className="relative flex items-center gap-4">
        <div className="relative shrink-0">
          {avatar ? (
            <img
              src={avatar}
              alt=""
              className="w-16 h-16 rounded-full ring-2 ring-border"
              onError={() => setImgFailed(true)}
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center font-bold text-xl">W</div>
          )}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1 min-w-0">
            <span className="text-base font-semibold truncate">{name}</span>
            <DiscordAppTag />
          </div>
          <div className={`text-sm font-medium flex items-center gap-1.5 ${online ? 'text-green-400' : 'text-muted-foreground'}`}>
            <span className={`w-2 h-2 rounded-full ${online ? 'bg-green-400' : 'bg-zinc-500'}`} />
            {status === null ? t('checking') : online ? t('online') : t('offline')}
          </div>
          {online && (
            <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground/90">
              <span> </span>
              <span
                className="bg-clip-text text-transparent bg-[length:200%_100%] animate-shimmer"
                style={{ backgroundImage: 'linear-gradient(90deg, hsl(var(--muted-foreground)) 40%, hsl(var(--foreground)) 50%, hsl(var(--muted-foreground)) 60%)' }}
              >
               {t('awaitingCommand')}
              </span>
            </div>
          )}
        </div>
      </div>

      {online && roundedGuildCount != null && (
        <div className="mt-4 pt-4 border-t border-border/60 flex items-center gap-2.5">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#e08a4e]/15">
            <Server className="w-3.5 h-3.5 text-[#e08a4e]" />
          </div>
          <span className="text-[13px] font-medium text-muted-foreground">
            {t.rich('activeOnServers', {
              count: <AnimatedNumber value={roundedGuildCount} duration={2200} />,
              b: (chunks) => <span className="font-bold text-foreground tabular-nums">{chunks}</span>,
            })}
          </span>
        </div>
      )}
    </div>
  );
}

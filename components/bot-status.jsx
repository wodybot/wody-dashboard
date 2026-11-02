'use client';
import DiscordAppTag from '@/components/discord-app-tag';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Server } from 'lucide-react';
import { cn } from '@/lib/utils';
import AnimatedNumber from './animated-number';

// Polls the public /api/status/bot endpoint (no auth needed) and renders a
// live card: bot avatar, name, status, green + "Online" while the bot's
// heartbeat (written every ~20s from cogs/status.py) is recent, gray +
// "Offline" if it goes stale or is missing. Also shows the live server
// count, sourced from the same heartbeat document.
//
// Note: the old blinking/ping status dot on the avatar was removed on
// request (read as cheap rather than premium) in favor of a static ring +
// soft shadow, with the animation budget moved to the "awaiting a command"
// row below instead.
//
// Uptime used to be shown here too, sourced from the bot's own `started_at`
// heartbeat field. Removed on request, that field is written by the bot
// process (cogs/status.py, not part of this repo) and wasn't ticking the
// way it should here, so servers is now the one, more prominent stat.
export function BotStatusCard({ className = '' }) {
  const t = useTranslations('botStatus');
  const [status, setStatus] = useState(null); // null = loading

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

  // Shown as a rounded-down "+N" figure (steps of 50, e.g. 129 -> +100)
  // rather than the exact live count, on request: an exact number that
  // visibly ticks up or down by 1 as members' guilds add/remove the bot
  // reads as jumpy/nitpicky, a round "+100"-style figure reads as a
  // stable, deliberate stat. Floored (not rounded to nearest) so the
  // number shown is never higher than the real count.
  const guildCount = status?.guild_count;
  const roundedGuildCount = guildCount != null ? Math.max(50, Math.floor(guildCount / 50) * 50) : null;

  // avatar_url from /api/status/bot is always our own same-origin proxy
  // path (/api/status/bot-avatar), never a raw cdn.discordapp.com URL,
  // see that route for why. imgFailed covers the rare case where the
  // proxy itself 404s (bot has no avatar, or the upstream fetch failed):
  // fall back to the plain "W" avatar below instead of a broken-image
  // icon, and, importantly, never fall back to the real Discord CDN URL,
  // which would silently reopen the third-party request this proxy exists
  // to prevent.
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
      {/* Faint diagonal sheen across the top, for a bit of premium polish */}
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
          {/* Discord-style custom status line: small, sits right under the
              Online row rather than in its own card. Prefixed like a slash
              command, with a blinking terminal-style caret at the end. */}
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

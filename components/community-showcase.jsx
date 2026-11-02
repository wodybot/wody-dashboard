// FILE: community-showcase.jsx
// PUNE ÎN: components/community-showcase.jsx
// (fișier nou în proiectul wody-dashboard-main la această cale)

'use client';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Users } from 'lucide-react';
import { discordCdnUrl } from '@/lib/utils';

// "Servers already using Wody" strip. Pulls real guilds the bot is in,
// filtered to guilds with more than a configured member count, and
// scrolls them as two marquee rows moving in opposite directions.
//
// initialServers comes from the server (app/[locale]/page.js calls
// getShowcaseServers() directly at render time and passes the result
// down), so the very first paint already has the real, rotated list in
// it, no client-side loading state, no blank section popping in a
// moment after the rest of the page. The effect below only exists to
// keep that list fresh afterwards, polling the same data every 5
// minutes so a rotation change is picked up if the tab is left open;
// it never runs a "loading" state of its own.
//
// Icons go through discordCdnUrl() (see lib/utils.js), same as every other
// guild icon in this app, so the browser only ever requests images from
// our own origin, never cdn.discordapp.com directly, no cookie is set.
export function CommunityShowcase({ initialServers }) {
  const t = useTranslations('communityShowcase');
  const [servers, setServers] = useState(Array.isArray(initialServers) ? initialServers : []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch('/api/status/showcase', { cache: 'no-store' });
        if (!res.ok) throw new Error('bad showcase response');
        const d = await res.json();
        if (!cancelled && Array.isArray(d.servers)) setServers(d.servers);
      } catch {
        // Keep whatever is already on screen (the server-rendered list,
        // or the last successful poll) rather than clearing it on a
        // transient network hiccup.
      }
    }
    // The server-rendered initialServers already cover the first paint,
    // so the first poll only needs to run once the rotation window can
    // plausibly have changed, not immediately on mount.
    const id = setInterval(load, 5 * 60_000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  // Genuinely nothing to show (bot has no qualifying guilds, or the
  // lookup failed both on the server and on every poll since), render
  // nothing rather than an empty/broken-looking section.
  if (servers.length === 0) return null;

  // Split into two interleaved rows so both rows differ, and duplicate
  // each row's content once so the CSS marquee loop is seamless.
  const rowA = servers.filter((_, i) => i % 2 === 0);
  const rowB = servers.filter((_, i) => i % 2 === 1);

  return (
    <section className="max-w-7xl mx-auto px-6 py-14 md:py-16">
      <p className="text-center text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground mb-10">
        {t('heading')}
      </p>
      <div className="space-y-4">
        <MarqueeRow servers={rowA} direction="left" />
        <MarqueeRow servers={rowB.length ? rowB : rowA} direction="right" />
      </div>
    </section>
  );
}

function MarqueeRow({ servers, direction }) {
  const t = useTranslations('communityShowcase');
  if (!servers.length) return null;
  const loop = [...servers, ...servers];
  return (
    <div className="overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_6%,black_94%,transparent)]">
      <div
        className={`flex w-max gap-4 ${direction === 'left' ? 'animate-marquee-left' : 'animate-marquee-right'} hover:[animation-play-state:paused]`}
      >
        {loop.map((s, i) => (
          <ServerCard key={`${s.id}-${i}`} server={s} t={t} />
        ))}
      </div>
    </div>
  );
}

function ServerCard({ server, t }) {
  const [imgFailed, setImgFailed] = useState(false);
  const icon = !imgFailed && server.icon_url ? discordCdnUrl(server.icon_url) : null;

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border/70 bg-card/50 backdrop-blur-sm px-4 py-3 w-72 shrink-0 shadow-sm">
      {icon ? (
        <img
          src={icon}
          alt=""
          className="w-10 h-10 rounded-xl object-cover shrink-0"
          loading="lazy"
          onError={() => setImgFailed(true)}
        />
      ) : (
        <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center font-bold text-sm shrink-0">
          {server.name?.trim()?.[0]?.toUpperCase() || '#'}
        </div>
      )}
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="w-1.5 h-1.5 rounded-full bg-[#c46a2d] shrink-0" />
          <span className="text-sm font-semibold truncate">{server.name}</span>
        </div>
        {server.member_count != null && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
            <Users className="w-3 h-3 shrink-0" />
            <span className="tabular-nums">{t('members', { count: server.member_count.toLocaleString() })}</span>
          </div>
        )}
      </div>
    </div>
  );
}


'use client';
import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Users } from 'lucide-react';
import { discordCdnUrl } from '@/lib/utils';

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
      }
    }
    const id = setInterval(load, 5 * 60_000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  if (servers.length === 0) return null;

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
  const box = useRef(null);
  const [running, setRunning] = useState(false);
  useEffect(() => {
    const el = box.current;
    if (!el || typeof IntersectionObserver === 'undefined') { setRunning(true); return undefined; }
    let visible = false;
    const sync = () => setRunning(visible && !document.hidden);
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; sync(); }, { rootMargin: '80px' });
    io.observe(el);
    document.addEventListener('visibilitychange', sync);
    return () => { io.disconnect(); document.removeEventListener('visibilitychange', sync); };
  }, []);
  if (!servers.length) return null;
  const half = servers.length >= 6 ? servers : [...servers, ...servers, ...servers].slice(0, Math.max(6, servers.length));
  return (
    <div ref={box} className="marquee-box overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_6%,black_94%,transparent)]">
      <div className={`marquee-run flex w-max ${direction === 'left' ? 'marquee-run-left' : 'marquee-run-right'} ${running ? '' : 'marquee-paused'}`}>
        {[0, 1].map((copy) => (
          <div key={copy} className="flex shrink-0 gap-4 pr-4" aria-hidden={copy === 1 ? 'true' : undefined}>
            {half.map((s, i) => <ServerCard key={`${s.id}-${i}`} server={s} t={t} />)}
          </div>
        ))}
      </div>
    </div>
  );
}

function ServerCard({ server, t }) {
  const [imgFailed, setImgFailed] = useState(false);
  const icon = !imgFailed && server.icon_url ? discordCdnUrl(server.icon_url) : null;

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border/70 bg-card/80 px-4 py-3 w-72 shrink-0">
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

'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import MarqueeText from '@/components/marquee-text';

function formatRemaining(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const pad = (n) => String(n).padStart(2, '0');
  if (days > 0) return `${days}z ${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s`;
  return `${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s`;
}

export default function CountdownBanner({ initialConfig = null }) {
  const pathname = usePathname();
  const [config, setConfig] = useState(initialConfig);
  const [rawImg, setRawImg] = useState(false);
  const [now, setNow] = useState(null);

  const [offset, setOffset] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const refresh = () => {
      const sent = Date.now();
      fetch('/api/site/countdown-banner', { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (cancelled || !d || typeof d.enabled !== 'boolean') return;
          if (Number.isFinite(d.server_time)) setOffset(Math.round(d.server_time - (sent + Date.now()) / 2));
          const ready = d.enabled && d.text && d.target_at;
          setConfig((prev) => {
            if (!ready) return null;
            return prev && JSON.stringify({ ...prev, server_time: 0 }) === JSON.stringify({ ...d, server_time: 0 }) ? prev : d;
          });
        })
        .catch(() => {});
    };
    refresh();
    const id = setInterval(refresh, 60_000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  useEffect(() => {
    if (!config) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [config]);

  if (pathname?.includes('/dashboard') || pathname?.includes('/servers/preview-frame')) return null;
  if (!config) return null;

  const background_src = config.background_src || '';
  const remainingMs = now === null ? null : new Date(config.target_at).getTime() - (now + offset);
  const isOver = remainingMs !== null && remainingMs <= 0;
  if (isOver && !config.ended_text) return null;

  return (
    <div className={`relative z-[60] overflow-hidden border-b border-[#c46a35]/25 ${background_src ? 'bg-[#120a06]' : 'bg-gradient-to-r from-[#7c3010]/25 via-[#a3481c]/20 to-[#7c3010]/25 backdrop-blur-sm'}`}>
      {background_src ? (
        <>
          <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 -bottom-3">
            <Image src={background_src} alt="" aria-hidden="true" fill sizes="100vw" unoptimized={rawImg} onError={() => setRawImg(true)} className="select-none object-cover object-top" />
          </span>
          <span aria-hidden="true" className="pointer-events-none absolute inset-0" style={{ backgroundColor: `rgba(10, 6, 4, ${(Number(config.background_dim ?? 45) || 0) / 100})` }} />
          <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-2.5 bg-gradient-to-b from-transparent to-[#120a06]/80" />
        </>
      ) : null}
      <div className="relative px-4 py-2 text-center text-xs sm:text-sm [text-shadow:0_1px_2px_rgba(0,0,0,0.6)]">
        <MarqueeText className="lg:[&>span]:whitespace-normal motion-reduce:[&>span]:whitespace-normal">
          <span className="font-medium text-[#f2c091]">{config.text}</span>
          {remainingMs !== null && !isOver && (
            <span className="ml-2 font-mono tabular-nums text-[#f6d9b8]">{formatRemaining(remainingMs)}</span>
          )}
          {isOver && config.ended_text && (
            <span className="ml-2 text-[#f2c091]/80">{config.ended_text}</span>
          )}
        </MarqueeText>
      </div>
    </div>
  );
}

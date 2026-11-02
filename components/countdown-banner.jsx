'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import MarqueeText from '@/components/marquee-text';

// Bara de countdown de sus (vezi lib/countdown-banner.js pentru config si
// owner panel pentru editor). Montata o singura data in
// app/[locale]/layout.js, deci apare pe orice pagina publica.
//
// Nu retine nimic in browser: nu foloseste localStorage sau sessionStorage.
// Nu poate fi inchisa de vizitator, cat timp e activa din owner panel
// ramane afisata.
//
// Numaratoarea se recalculeaza in fiecare secunda dintr-un target_at fix
// (un timestamp ISO absolut trimis de server), asa ca arata identic
// pentru orice vizitator, indiferent de fusul lui orar.
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
  // Seeded from the server-rendered prop, so the very first paint already
  // shows the bar's TEXT (or correctly shows nothing) instead of starting
  // null and waiting on a client-side fetch.
  const [config, setConfig] = useState(initialConfig);
  // Deliberately NOT Date.now() here. This component renders once on the
  // server (to produce the initial HTML) and once again on the client
  // during hydration, and those two renders happen at genuinely different
  // moments, Date.now() during each would capture two different
  // timestamps, which can format to two different strings (a second
  // boundary crossed between them is enough) - a server/client TEXT
  // mismatch, which is exactly React error #418 (hydration failed). null
  // is deterministic: the server and the client's first render both see
  // the same value, so their HTML matches. The real clock only starts
  // ticking inside the effect below, which runs strictly after hydration
  // has already succeeded, so setting state there can never mismatch
  // anything, it's just an ordinary post-mount update.
  // If the resized copy cannot be made (the picture host is slow or refuses), show the same-site picture as it is.
  const [rawImg, setRawImg] = useState(false);
  const [now, setNow] = useState(null);

  // Background refresh only, so a change saved in the owner panel (or the
  // countdown simply ending) is picked up without a full page reload.
  // Runs on an interval rather than once, since this component stays
  // mounted across every public-page navigation.
  // Difference between the server's clock and this device's clock. A phone with a wrong clock used to end the
  // countdown early (and hide the bar); now every device counts down to the same moment.
  const [offset, setOffset] = useState(0);

  // Background refresh. It runs once right after mount and then every minute. Only a clear answer changes
  // what is shown: a failed request, a server error or an unreadable answer leaves the bar exactly as it is,
  // so one hiccup can never make it vanish.
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
            // Same content: keep the same object, so nothing restarts every minute.
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
    // First real timestamp, set right after mount, i.e. after hydration.
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [config]);

  // /dashboard/* have their own layout (a fixed-position sidebar on
  // mobile among other things) that doesn't reserve space for a bar
  // above it, so a fixed sidebar would sit on top of this instead of
  // being pushed down. Kept to the public/marketing pages only, where
  // this kind of announcement actually belongs anyway.
  // Not inside the dashboard, nor inside the Community listing preview frame.
  if (pathname?.includes('/dashboard') || pathname?.includes('/servers/preview-frame')) return null;
  if (!config) return null;

  // null until the post-mount effect above sets a real value, see the
  // comment on `now`'s useState above: both the server and the client's
  // first render agree on "unknown yet", so neither shows a countdown
  // number until it's safe to, avoiding any server/client text mismatch.
  const background_src = config.background_src || '';
  const remainingMs = now === null ? null : new Date(config.target_at).getTime() - (now + offset);
  const isOver = remainingMs !== null && remainingMs <= 0;
  if (isOver && !config.ended_text) return null;

  return (
    // Same warm gold/bronze family as .gradient-primary in globals.css,
    // just lighter and semi-transparent instead of solid, so this reads
    // as a quiet premium accent bar rather than a loud call-to-action
    // button stretched across the top of the page.
    <div className={`relative z-[60] overflow-hidden border-b border-[#c46a35]/25 ${background_src ? 'bg-[#120a06]' : 'bg-gradient-to-r from-[#7c3010]/25 via-[#a3481c]/20 to-[#7c3010]/25 backdrop-blur-sm'}`}>
      {background_src ? (
        <>
          {/* Background image across the whole width and height of the bar.
              background_src is a same-origin source signed by the server
              (lib/countdown-banner.js), so the visitor's browser never
              requests the picture from the external host, and next/image
              serves a resized copy instead of the full original file. */}
          {/* The picture is drawn a little taller than the bar and the bar clips it, so any line painted along the
              bottom edge of the picture itself never shows next to the bar's own border (it looked like a doubled
              line). A soft fade at the bottom then leads into the header instead of a hard cut. */}
          <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 -bottom-3">
            <Image src={background_src} alt="" aria-hidden="true" fill sizes="100vw" unoptimized={rawImg} onError={() => setRawImg(true)} className="select-none object-cover object-top" />
          </span>
          <span aria-hidden="true" className="pointer-events-none absolute inset-0" style={{ backgroundColor: `rgba(10, 6, 4, ${(Number(config.background_dim ?? 45) || 0) / 100})` }} />
          <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-2.5 bg-gradient-to-b from-transparent to-[#120a06]/80" />
        </>
      ) : null}
      <div className="relative px-4 py-2 text-center text-xs sm:text-sm [text-shadow:0_1px_2px_rgba(0,0,0,0.6)]">
        {/* Phones/tablets (< lg): the text, the countdown and the ended text
            sit on ONE line of fixed height. When that line is wider than the
            bar it slides left to reveal the cut-off end and back (the same
            MarqueeText the dashboard module titles use), so a long text never
            wraps and the bar never grows taller. Text that fits stays static
            and centered. On lg+ MarqueeText never animates, so the line is
            allowed to wrap there exactly like before; the same wrapping is
            the fallback for visitors who asked their device for reduced
            motion (the slide is disabled for them), so the full text is
            still readable. */}
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

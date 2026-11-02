'use client';

import { useEffect, useRef, useState, useLayoutEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { toast } from 'sonner';
import { ArrowRight, Sparkles } from 'lucide-react';
import { ICONS, HomepageModulePreview } from '@/components/module-preview-content';
import { hasModuleSeoPage } from '@/lib/module-seo';
import { useSessionUser } from '@/components/use-session-user';

// Scales its content down (never up) so the whole preview always fits the
// card's back face: nothing is cut off, whatever the message length or the
// card size. Re-measured whenever the box or the content changes size.
function FitBox({ children, className = '' }) {
  const outer = useRef(null);
  const inner = useRef(null);
  const [fit, setFit] = useState({ scale: 1, offset: 0 });
  useLayoutEffect(() => {
    const o = outer.current; const i = inner.current;
    if (!o || !i) return undefined;
    // The content is laid out at the box's own width (so image heights never
    // depend on the scale), then scaled down until it fits the height.
    const measure = () => {
      const W = o.clientWidth; const H = o.clientHeight;
      if (!W || !H) return;
      i.style.width = `${W}px`;
      const h = i.scrollHeight;
      const scale = h > H ? Math.max(0.3, (H - 1) / h) : 1;
      setFit((prev) => (Math.abs(prev.scale - scale) < 0.002 ? prev : { scale, offset: (W - W * scale) / 2 }));
    };
    measure();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    if (ro) { ro.observe(o); if (i.firstElementChild) ro.observe(i.firstElementChild); }
    return () => { if (ro) ro.disconnect(); };
  }, []);
  return (
    <div ref={outer} className={`module-fit relative overflow-hidden ${className}`}>
      <div ref={inner} className="absolute top-0 origin-top-left" style={{ left: `${fit.offset}px`, transform: `scale(${fit.scale})` }}>
        {children}
      </div>
    </div>
  );
}

export function ModuleFlipCard({ module, user: serverUser }) {
  const user = useSessionUser(serverUser);
  const [flipped, setFlipped] = useState(false);
  const [holding, setHolding] = useState(false);
  // Perf: the back face's HomepageModulePreview (a fairly heavy mock-Discord
  // render) used to mount for all 16 homepage module cards immediately on
  // page load, even though it's only ever visible after a flip. Mounting it
  // lazily, the first time a card is actually interacted with, means the
  // initial render/hydration only pays for the 16 lightweight front faces.
  // Once true this never goes back to false, so a card that's been flipped
  // doesn't re-pay the mount cost on a second flip.
  const [hasInteracted, setHasInteracted] = useState(false);
  const holdTimer = useRef(null);
  const Icon = ICONS[module.key] || Sparkles;
  const tCard = useTranslations('moduleCard');
  const seoPage = hasModuleSeoPage(module.key);
  // giveaways' embed text is 5 \n-separated lines (Prize/Winners/
  // Participants/Ends/"Click Enter…") plus the Enter button below it, more
  // content than any of the other dense previews. At the default 270px card
  // height that overflowed the fixed-height, overflow:hidden back face
  // (.module-card-back .module-embed { max-height:100%; overflow:hidden })
  // and clipped the button off entirely.
  const densePreview = ['moderation', 'automod', 'logging', 'pools', 'giveaways'].includes(module.key);

  useEffect(() => () => clearTimeout(holdTimer.current), []);
  const startHold = (event) => {
    if (event.pointerType === 'mouse') return;
    setHasInteracted(true);
    clearTimeout(holdTimer.current); setHolding(true);
    holdTimer.current = setTimeout(() => { setFlipped(v => !v); setHolding(false); if (navigator.vibrate) navigator.vibrate(14); }, 520);
  };
  const cancelHold = () => { clearTimeout(holdTimer.current); setHolding(false); };

  return (
    <div className={`module-flip-shell group relative ${densePreview ? 'min-h-[330px]' : 'min-h-[270px]'} select-none touch-manipulation`}
      tabIndex={0}
      role="button"
      aria-pressed={flipped}
      aria-label={`Preview ${module.title}`}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          setHasInteracted(true);
          setFlipped((value) => !value);
        }
      }}
      onPointerDown={startHold} onPointerUp={cancelHold} onPointerCancel={cancelHold}
      onPointerLeave={(e) => { cancelHold(); if (e.pointerType === 'mouse') setFlipped(false); }}
      onPointerEnter={(e) => { if (e.pointerType === 'mouse') { setHasInteracted(true); setFlipped(true); } }}>
      <div className={`module-flip-inner relative h-full ${densePreview ? 'min-h-[330px]' : 'min-h-[270px]'} ${flipped ? 'is-flipped' : ''}`}>
        <article
          className="module-card-front absolute inset-0 rounded-[22px] overflow-hidden p-6 [backface-visibility:hidden] flex flex-col text-center sm:text-left"
          style={{ pointerEvents: flipped ? 'none' : 'auto' }}
        >
          <div className="module-card-orbit" /><div className="module-card-grid" /><div className="module-card-shine" />
          <div className="relative z-10 flex items-center justify-center sm:justify-start gap-3 mb-3">
            <div className="module-icon-wrap w-11 h-11 rounded-[14px] flex items-center justify-center"><Icon className="w-5 h-5" /></div>
            <div className="font-semibold text-[15px] tracking-[-0.01em]">{module.title}</div>
          </div>
          <p className="relative z-10 text-sm text-muted-foreground leading-relaxed">{module.desc}</p>
          <div className="relative z-10 mt-auto pt-6 flex items-center justify-between gap-3">
            <div className="flex items-center justify-center sm:justify-start gap-2 text-[9px] font-bold tracking-[0.2em] text-[#e8a06a]/85 uppercase"><span className="module-hold-dot" />{tCard('pressHold')}</div>
            <div className={`module-hold-ring ${holding ? 'is-holding' : ''}`}><span /></div>
          </div>
        </article>

        <article
          className="module-card-back absolute inset-0 rounded-[22px] overflow-hidden p-3 [backface-visibility:hidden] [transform:rotateY(180deg)] flex flex-col"
          style={{ pointerEvents: flipped ? 'auto' : 'none' }}
        >
          <div className="module-back-aurora" /><div className="module-scanline" />
          {hasInteracted ? (
            <FitBox className="flex-1 min-h-0">
              <HomepageModulePreview moduleKey={module.key} previewLabel={tCard('preview')} />
            </FitBox>
          ) : (
            // Reserves the exact same space as HomepageModulePreview so
            // nothing shifts once it mounts on first interaction.
            <div className="flex-1 min-h-0 overflow-hidden" />
          )}
          {seoPage && (
            <Link
              href={`/modules/${module.key}`}
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              onPointerUp={(e) => e.stopPropagation()}
              onPointerCancel={(e) => e.stopPropagation()}
              className="module-learn-button relative mt-2 self-end inline-flex w-auto shrink-0 items-center justify-center gap-1 rounded-full px-2.5 py-1 text-[7px] font-bold tracking-[0.14em] uppercase"
            >
              {tCard('learnMore')} <ArrowRight className="w-3 h-3" />
            </Link>
          )}
          <Link
            href="/dashboard"
            onClick={(e) => {
              e.stopPropagation();
              if (!user) {
                e.preventDefault();
                toast.error(tCard('loginRequiredTitle'), { description: tCard('loginRequiredDesc') });
              }
            }}
            onPointerDown={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
            onPointerCancel={(e) => e.stopPropagation()}
            className="module-try-button relative mt-2.5 inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-[9px] font-bold tracking-[0.14em] uppercase"
          >{tCard('tryModule')} <ArrowRight className="w-3.5 h-3.5" /></Link>
        </article>
      </div>
    </div>
  );
}

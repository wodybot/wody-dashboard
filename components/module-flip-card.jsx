'use client';

import { useEffect, useRef, useState, useLayoutEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { toast } from 'sonner';
import { ArrowRight, Sparkles } from 'lucide-react';
import { ICONS, HomepageModulePreview } from '@/components/module-preview-content';
import { hasModuleSeoPage } from '@/lib/module-seo';
import { useSessionUser } from '@/components/use-session-user';

function FitBox({ children, className = '' }) {
  const outer = useRef(null);
  const inner = useRef(null);
  const [fit, setFit] = useState({ scale: 1, offset: 0 });
  useLayoutEffect(() => {
    const o = outer.current; const i = inner.current;
    if (!o || !i) return undefined;
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
  const [hasInteracted, setHasInteracted] = useState(false);
  const holdTimer = useRef(null);
  const Icon = ICONS[module.key] || Sparkles;
  const tCard = useTranslations('moduleCard');
  const seoPage = hasModuleSeoPage(module.key);
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
          {seoPage && (
            <Link
              href={`/modules/${module.key}`}
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              onPointerUp={(e) => e.stopPropagation()}
              onPointerCancel={(e) => e.stopPropagation()}
              className="relative z-10 mt-3 inline-flex items-center gap-1 self-center sm:self-start text-xs font-semibold text-[#e6cd8c] hover:underline underline-offset-4"
            >
              {tCard('learnMore')} <span className="sr-only">: {module.title}</span><ArrowRight className="w-3 h-3" />
            </Link>
          )}
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
            <div className="flex-1 min-h-0 overflow-hidden" />
          )}
          {seoPage && (
            <Link
              href={`/modules/${module.key}`}
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              onPointerUp={(e) => e.stopPropagation()}
              onPointerCancel={(e) => e.stopPropagation()}
              className="module-learn-button relative mt-2 self-end inline-flex w-auto shrink-0 items-center justify-center gap-1 rounded-full px-3 py-1.5 text-[9px] font-bold tracking-[0.12em] uppercase"
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

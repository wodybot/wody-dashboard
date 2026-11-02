'use client';
// Homepage teaser: ONE compact carousel with two slides (Marketplace and Passport).
// Little text on purpose, to make people curious. Native scroll snapping (swipe, trackpad, keyboard),
// arrows, dots, no autoplay, reduced motion respected. No cookies and no browser storage.
import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ArrowRight, Briefcase, ChevronLeft, ChevronRight, Crown, EyeOff, IdCard, ShieldCheck, Sparkles, Handshake } from 'lucide-react';
import { Link } from '@/i18n/navigation';

const LANGS = new Set(['en', 'ro', 'fr', 'it', 'de', 'es', 'pt', 'nl', 'tr']);
const chip = 'inline-flex items-center gap-1.5 rounded-full border border-[#e6cd8c]/30 bg-[#e6cd8c]/10 px-2.5 py-1 text-xs font-medium text-[#f3e1b0]';
const slideBox = 'relative w-full shrink-0 snap-center overflow-hidden rounded-3xl border border-[#e6cd8c]/25 bg-gradient-to-br from-[#e6cd8c]/[0.10] via-card/60 to-card/40 p-5 sm:p-7';
const cta = 'inline-flex items-center gap-2 rounded-full bg-[#e6cd8c] px-4 py-2 text-sm font-semibold text-[#2a1d0a] transition-opacity hover:opacity-90';

export default function EcosystemCarousel({ inviteUrl }) {
  const t = useTranslations('marketplace');
  const tp = useTranslations('passport');
  const rawLocale = useLocale();
  const locale = LANGS.has(rawLocale) ? rawLocale : 'en';
  const card = `/passport/passport-genesis-${locale}`;
  const previewSrc = `${card}.webp`;
  const ref = useRef(null);
  const [index, setIndex] = useState(0);
  const count = 2;

  const update = useCallback(() => {
    const el = ref.current; if (!el) return;
    setIndex(Math.max(0, Math.min(count - 1, Math.round(el.scrollLeft / Math.max(1, el.clientWidth)))));
  }, []);
  useEffect(() => {
    const el = ref.current; if (!el) return undefined;
    el.addEventListener('scroll', update, { passive: true });
    return () => el.removeEventListener('scroll', update);
  }, [update]);

  const go = (i) => {
    const el = ref.current; if (!el) return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    el.scrollTo({ left: Math.max(0, Math.min(count - 1, i)) * el.clientWidth, behavior: reduce ? 'auto' : 'smooth' });
  };
  const onKey = (e) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); go(index + 1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); go(index - 1); }
  };

  return (
    <div className="relative" role="region" aria-roledescription="carousel" aria-label={t('ecoTitle')}>
      <div ref={ref} tabIndex={0} onKeyDown={onKey} className="flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain scroll-smooth rounded-3xl [scrollbar-width:none] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#e6cd8c]/60 [&::-webkit-scrollbar]:hidden motion-reduce:scroll-auto">
        <article aria-roledescription="slide" aria-label={`1 / ${count}`} aria-hidden={index !== 0 || undefined} className={slideBox}>
          <Briefcase aria-hidden="true" className="pointer-events-none absolute -bottom-6 -right-4 h-44 w-44 text-[#e6cd8c]/[0.07] md:h-56 md:w-56" strokeWidth={1} />
          <div className="relative flex min-h-[200px] flex-col justify-between gap-5 sm:min-h-[210px] md:flex-row md:items-center">
            <div className="max-w-xl">
              <span className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#e6cd8c]/35 bg-[#e6cd8c]/10 text-[#f3e1b0]"><Briefcase className="h-5 w-5" aria-hidden="true" /></span>
              <p className="text-xs font-semibold uppercase tracking-widest text-[#e6cd8c]">{t('title')}</p>
              <h3 className="mt-1 text-2xl font-extrabold leading-tight sm:text-3xl">{t('carMkHook')}</h3>
              <ul className="mt-4 flex flex-wrap gap-2">
                <li className={chip}><ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />{t('carMkC1')}</li>
                <li className={chip}><Handshake className="h-3.5 w-3.5" aria-hidden="true" />{t('carMkC2')}</li>
                <li className={chip}><EyeOff className="h-3.5 w-3.5" aria-hidden="true" />{t('carMkC3')}</li>
              </ul>
            </div>
            <Link href="/marketplace" tabIndex={index === 0 ? 0 : -1} className={`${cta} self-start md:self-center`}>{t('browseAll')} <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
          </div>
        </article>
        <article aria-roledescription="slide" aria-label={`2 / ${count}`} aria-hidden={index !== 1 || undefined} className={slideBox}>
          <div className="flex min-h-[200px] flex-col justify-between gap-5 sm:min-h-[210px] md:flex-row md:items-center">
            <div className="max-w-md">
              <span className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#e6cd8c]/35 bg-[#e6cd8c]/10 text-[#f3e1b0]"><IdCard className="h-5 w-5" aria-hidden="true" /></span>
              <p className="text-xs font-semibold uppercase tracking-widest text-[#e6cd8c]">{tp('title')}</p>
              <h3 className="mt-1 text-2xl font-extrabold leading-tight sm:text-3xl">{t('carPpHook')}</h3>
              <ul className="mt-4 flex flex-wrap gap-2">
                <li className={chip}><Crown className="h-3.5 w-3.5" aria-hidden="true" />{t('carPpC1')}</li>
                <li className={chip}><Sparkles className="h-3.5 w-3.5" aria-hidden="true" />{t('carPpC2')}</li>
                <li className={chip}><ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />{t('carPpC3')}</li>
              </ul>
              <a href={inviteUrl} target="_blank" rel="noopener noreferrer" tabIndex={index === 1 ? 0 : -1} className={`${cta} mt-5`}>{tp('cta')} <ArrowRight className="h-4 w-4" aria-hidden="true" /></a>
            </div>
            <img src={previewSrc} srcSet={`${card}-sm.webp 450w, ${card}.webp 900w`} sizes="(min-width: 768px) 360px, 80vw" alt={tp('genesisAlt')} width="900" height="300" loading="lazy" decoding="async" className="block h-auto w-full max-w-[360px] rounded-xl shadow-2xl shadow-black/40 md:rotate-2" />
          </div>
        </article>
      </div>
      <div className="mt-3 flex items-center justify-center gap-3">
        <button type="button" onClick={() => go(index - 1)} disabled={index === 0} aria-label={t('prev')} className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border/60 bg-card/50 transition-colors hover:bg-card disabled:opacity-35"><ChevronLeft className="h-4 w-4" aria-hidden="true" /></button>
        <div className="flex items-center gap-2" role="group" aria-label={t('ecoTitle')}>
          {[0, 1].map((i) => (
            <button key={i} type="button" onClick={() => go(i)} aria-label={t('carSlide', { n: i + 1 })} aria-current={index === i ? 'true' : undefined} className="flex h-6 w-6 items-center justify-center"><span className={`block h-2 rounded-full transition-all ${index === i ? 'w-6 bg-[#e6cd8c]' : 'w-2 bg-border'}`} /></button>
          ))}
        </div>
        <button type="button" onClick={() => go(index + 1)} disabled={index === count - 1} aria-label={t('next')} className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border/60 bg-card/50 transition-colors hover:bg-card disabled:opacity-35"><ChevronRight className="h-4 w-4" aria-hidden="true" /></button>
      </div>
    </div>
  );
}

import { getLocale, getTranslations } from 'next-intl/server';
import { ArrowRight } from 'lucide-react';
import { PassportTilt } from '@/components/passport-tilt';
import { NavTag } from '@/components/nav';
import { INVITE_URL } from '@/lib/content';

const LANGS = new Set(['en', 'ro', 'fr', 'it', 'de', 'es', 'pt', 'nl', 'tr']);

const SPARKS = [
  { top: '4%', left: '8%', delay: '0s' },
  { top: '14%', left: '92%', delay: '1.1s' },
  { top: '52%', left: '2%', delay: '2s' },
  { top: '88%', left: '14%', delay: '0.6s' },
  { top: '70%', left: '96%', delay: '1.6s' },
  { top: '96%', left: '72%', delay: '2.4s' },
];

export async function PassportPromo() {
  const [t, tNav, rawLocale] = await Promise.all([getTranslations('passport'), getTranslations('nav'), getLocale()]);
  const locale = LANGS.has(rawLocale) ? rawLocale : 'en';
  const standard = `/passport/passport-${locale}`;
  const genesis = `/passport/passport-genesis-${locale}`;
  const previewSrc = `${standard}.webp`;
  const localUrl = `${genesis}.webp`;
  return (
    <section id="passport" className="pp-stage" aria-labelledby="passport-title">
      <div className="max-w-5xl mx-auto px-5 sm:px-6 py-16 md:py-28 text-center">
        <p className="flex items-center justify-center gap-2.5 text-xs font-medium tracking-[0.2em] uppercase text-[#e6cd8c] mb-5">{t('badge')}<NavTag kind="new" label={tNav('tags.new')} /></p>
        <h2 id="passport-title" className="pp-title text-4xl sm:text-5xl md:text-7xl font-extrabold tracking-tight leading-[1.05]">{t('title')}</h2>
        <p className="mt-6 text-muted-foreground leading-relaxed max-w-2xl mx-auto text-sm sm:text-base">{t('description')}</p>

        <p className="mt-7 flex flex-wrap justify-center gap-2.5">
          <code className="pp-pill">/claimpassport</code>
          <code className="pp-pill">/mypassport</code>
          <code className="pp-pill">/passport name:&lt;user&gt;</code>
        </p>

        <div className="pp-cards mt-14 md:mt-20 max-w-4xl mx-auto">
          <span className="pp-aura" aria-hidden="true" />
          {SPARKS.map((s, i) => (
            <span key={i} className="pp-spark" aria-hidden="true" style={{ top: s.top, left: s.left, animationDelay: s.delay }} />
          ))}

          <div className="pp-float w-full md:w-[70%] md:mr-auto" style={{ '--pp-r': '-2deg' }}>
            <PassportTilt>
              <div className="pp-card">
                <img
                  src={previewSrc}
                  srcSet={`${standard}-sm.webp 450w, ${standard}-md.webp 900w, ${standard}.webp 1800w`}
                  sizes="(min-width: 768px) 630px, 92vw"
                  alt={t('previewAlt')}
                  width="1800"
                  height="600"
                  loading="lazy"
                  decoding="async"
                  className="block w-full h-auto"
                />
              </div>
            </PassportTilt>
          </div>

          <div className="pp-float pp-float--b w-full md:w-[70%] md:ml-auto mt-6 md:-mt-20 relative z-10" style={{ '--pp-r': '2.5deg' }}>
            <PassportTilt>
              <div className="pp-card pp-card--genesis">
                <img
                  src={localUrl}
                  srcSet={`${genesis}-sm.webp 450w, ${genesis}-md.webp 900w, ${genesis}.webp 1800w`}
                  sizes="(min-width: 768px) 630px, 92vw"
                  alt={t('genesisAlt')}
                  width="1800"
                  height="600"
                  loading="lazy"
                  decoding="async"
                  className="block w-full h-auto"
                />
              </div>
            </PassportTilt>
          </div>
        </div>

        <div className="mt-16 md:mt-24 max-w-xl mx-auto">
          <h3 className="text-xl md:text-2xl font-bold uppercase tracking-[0.22em] text-[#f3e1b0]">{t('genesisTitle')}</h3>
          <p className="mt-3 text-muted-foreground leading-relaxed text-sm sm:text-base">{t('genesisText')}</p>
        </div>

        <div className="mt-9">
          <a href={INVITE_URL} target="_blank" rel="noopener noreferrer" className="pp-cta">
            {t('cta')} <ArrowRight className="w-5 h-5" aria-hidden="true" />
          </a>
          <p className="mt-5 text-[11px] text-muted-foreground">{t('fictional')}</p>
        </div>
      </div>
    </section>
  );
}

export function PassportPromoFallback() {
  return <section className="pp-stage" aria-hidden="true"><div className="max-w-5xl mx-auto px-6 py-28"><div className="rounded-xl border border-border/40 bg-card/30 h-64 animate-pulse" /></div></section>;
}

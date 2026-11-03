import { getLocale, getTranslations } from 'next-intl/server';
import { Eye, Link2 } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { TrioShowcase } from '@/components/trio-showcase';
import { CoastScene } from '@/components/profile/PageBackdrop';
import { PassportTilt } from '@/components/passport-tilt';
import { INVITE_URL } from '@/lib/content';

const HREFS = { profile: '/profile?tab=page', passport: INVITE_URL, collab: '/collab' };

const LANGS = new Set(['en', 'ro', 'fr', 'it', 'de', 'es', 'pt', 'nl', 'tr']);

export async function TrioSection() {
  const [t, rawLocale] = await Promise.all([getTranslations('landing.trio'), getLocale()]);
  const locale = LANGS.has(rawLocale) ? rawLocale : 'en';
  const base = `/passport/passport-${locale}`;
  const previewSrc = `${base}.webp`;
  const tabs = ['profile', 'passport', 'collab'].map((key) => ({
    key,
    name: t(`${key}.name`),
    blurb: t(`${key}.blurb`),
    cta: t(`${key}.cta`),
    href: HREFS[key],
    external: key === 'passport',
  }));

  const profile = (
    <div className="trio-mock trio-mock--profile">
      <div className="absolute inset-0" style={{ background: 'linear-gradient(175deg, #ff5e8a 0%, #7a2a7a 40%, #1a0b3b 100%)' }} />
      <div className="absolute inset-0"><CoastScene /></div>
      <div className="relative z-10 flex h-full flex-col items-center justify-center gap-3 p-6 text-center text-white">
        <span className="trio-avatar" aria-hidden="true" />
        <p className="name-fx-typewriter text-2xl font-extrabold tracking-tight">{t('mock.name')}</p>
        <p className="text-xs text-white/80">{t('mock.bio')}</p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          {['mock.l1', 'mock.l2', 'mock.l3'].map((k) => (
            <span key={k} className="inline-flex items-center gap-1 rounded-full border border-white/30 bg-white/10 px-3 py-1 text-[11px] backdrop-blur"><Link2 className="h-3 w-3" aria-hidden="true" />{t(k)}</span>
          ))}
        </div>
        <span className="inline-flex items-center gap-1.5 text-[11px] text-white/80"><Eye className="h-3.5 w-3.5" aria-hidden="true" />{t('mock.views')}</span>
      </div>
      <span className="trio-example">{t('mock.example')}</span>
    </div>
  );

  const passport = (
    <div className="trio-mock trio-mock--passport">
      <PassportTilt>
        <div className="pp-card">
          <img
            src={previewSrc}
            srcSet={`${base}-sm.webp 450w, ${base}-md.webp 900w`}
            sizes="(min-width: 1024px) 520px, 90vw"
            alt={t('passport.alt')}
            width="1800"
            height="600"
            loading="lazy"
            decoding="async"
            className="block h-auto w-full"
          />
        </div>
      </PassportTilt>
      <p className="mt-4 text-center text-[11px] text-[#eadcb8]/70">{t('passport.fictional')}</p>
    </div>
  );

  const collab = (
    <div className="trio-mock trio-mock--collab">
      <div className="flex items-center justify-between px-5 pt-5">
        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[#f3e1b0]">WODY Collab</span>
        <span className="inline-flex items-center gap-1.5 text-[11px] text-emerald-300"><span className="trio-live" aria-hidden="true" />{t('collab.live')}</span>
      </div>
      <ul className="space-y-2.5 p-5">
        {['r1', 'r2', 'r3'].map((k, i) => (
          <li key={k} className="trio-row" style={{ animationDelay: `${i * 0.35}s` }}>
            <span className="trio-row-dot" aria-hidden="true" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-[#fff6dc]">{t(`collab.${k}`)}</span>
              <span className="block truncate text-[11px] text-[#eadcb8]/70">{t(`collab.${k}s`)}</span>
            </span>
            <span className="rounded-full border border-[#e6cd8c]/40 px-2 py-0.5 text-[10px] text-[#f3e1b0]">{t(i === 1 ? 'collab.server' : 'collab.global')}</span>
          </li>
        ))}
      </ul>
      <span className="trio-example">{t('mock.example')}</span>
    </div>
  );

  return (
    <section id="ecosystem" aria-labelledby="trio-title" className="relative mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 md:py-16">
      <span id="passport" aria-hidden="true" className="absolute -top-20" />
      <span id="collab-home" aria-hidden="true" className="absolute -top-20" />
      <div className="trio-frame">
        <div className="trio-shell">
          <span className="trio-blob trio-blob-a" aria-hidden="true" />
          <span className="trio-blob trio-blob-b" aria-hidden="true" />
          <span className="trio-blob trio-blob-c" aria-hidden="true" />
          <span className="trio-dots" aria-hidden="true" />
          <TrioShowcase tabs={tabs} slots={[profile, passport, collab]}>
            <p className="trio-badge">{t('badge')}</p>
            <h2 id="trio-title" className="trio-title">{t('title')}</h2>
            <p className="trio-text">{t('text')}</p>
          </TrioShowcase>
          <p className="trio-note">
            {t('note')}{' '}
            <Link href="/gta6-discord-bot" className="underline decoration-dotted underline-offset-2 hover:text-[#f3e1b0]">{t('gtaLink')}</Link>
          </p>
        </div>
      </div>
    </section>
  );
}

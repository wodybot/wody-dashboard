import { getLocale, getTranslations } from 'next-intl/server';
import { ArrowRight, Briefcase, Eye, IdCard, Link2, UserRound } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { SvgScene } from '@/components/scenes';
import { PassportTilt } from '@/components/passport-tilt';
import { INVITE_URL } from '@/lib/content';

const LANGS = new Set(['en', 'ro', 'fr', 'it', 'de', 'es', 'pt', 'nl', 'tr']);

function Cta({ href, external, children }) {
  const inner = <>{children}<ArrowRight className="h-4 w-4" aria-hidden="true" /></>;
  return external
    ? <a href={href} target="_blank" rel="noopener noreferrer" className="trio-cta">{inner}</a>
    : <Link href={href} className="trio-cta">{inner}</Link>;
}

function ColHead({ icon: Icon, name, blurb }) {
  return (
    <div className="trio-colhead">
      <span className="trio-ico"><Icon className="h-5 w-5" aria-hidden="true" /></span>
      <div className="min-w-0"><h3 className="trio-name">{name}</h3><p className="trio-blurb">{blurb}</p></div>
    </div>
  );
}

export async function TrioSection() {
  const [t, rawLocale] = await Promise.all([getTranslations('landing.trio'), getLocale()]);
  const locale = LANGS.has(rawLocale) ? rawLocale : 'en';
  const standard = `/passport/passport-${locale}`;
  const genesis = `/passport/passport-genesis-${locale}`;
  const standard_src = `${standard}-md.webp`;
  const genesis_src = `${genesis}-md.webp`;
  return (
    <section id="ecosystem" aria-labelledby="trio-title" className="relative mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 md:py-16">
      <div className="trio-frame">
        <div className="trio-shell">
          <span className="trio-blob trio-blob-a" aria-hidden="true" />
          <span className="trio-blob trio-blob-b" aria-hidden="true" />
          <span className="trio-blob trio-blob-c" aria-hidden="true" />
          <span className="trio-dots" aria-hidden="true" />
          <div className="trio-head">
            <p className="trio-badge">{t('badge')}</p>
            <h2 id="trio-title" className="trio-title">{t('title')}</h2>
            <p className="trio-text">{t('text')}</p>
          </div>

          <div className="trio-row3">
            <article className="trio-col" data-k="profile">
              <ColHead icon={UserRound} name={t('profile.name')} blurb={t('profile.blurb')} />
              <div className="trio-preview trio-preview--profile">
                <SvgScene kind="coast" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#150a2e]/70 via-transparent to-transparent" />
                <div className="relative z-10 flex h-full flex-col items-center justify-center gap-2.5 p-5 text-center text-white">
                  <span className="trio-avatar" aria-hidden="true" />
                  <p className="name-fx-typewriter text-2xl font-extrabold tracking-tight">{t('mock.name')}</p>
                  <p className="text-xs text-white/85">{t('mock.bio')}</p>
                  <div className="flex flex-wrap items-center justify-center gap-1.5">
                    {['mock.l1', 'mock.l2', 'mock.l3'].map((k) => (
                      <span key={k} className="inline-flex items-center gap-1 rounded-full border border-white/30 bg-white/10 px-2.5 py-0.5 text-[11px] backdrop-blur"><Link2 className="h-3 w-3" aria-hidden="true" />{t(k)}</span>
                    ))}
                  </div>
                  <span className="inline-flex items-center gap-1.5 text-[11px] text-white/85"><Eye className="h-3.5 w-3.5" aria-hidden="true" />{t('mock.views')}</span>
                </div>
                <span className="trio-example">{t('mock.example')}</span>
              </div>
              <div className="mt-auto"><Cta href="/profile?tab=page">{t('profile.cta')}</Cta></div>
            </article>

            <article id="passport" className="trio-col" data-k="passport">
              <ColHead icon={IdCard} name={t('passport.name')} blurb={t('passport.blurb')} />
              <div className="trio-preview trio-preview--passport">
                <div className="trio-pp trio-pp--a">
                  <PassportTilt>
                    <div className="pp-card">
                      <img src={standard_src} alt={t('passport.alt')} width="900" height="300" loading="lazy" decoding="async" className="block h-auto w-full" />
                    </div>
                  </PassportTilt>
                </div>
                <div className="trio-pp trio-pp--b">
                  <PassportTilt>
                    <div className="pp-card pp-card--genesis">
                      <img src={genesis_src} alt="" width="900" height="300" loading="lazy" decoding="async" className="block h-auto w-full" />
                    </div>
                  </PassportTilt>
                </div>
                <span className="trio-example">{t('passport.fictional')}</span>
              </div>
              <div className="mt-auto"><Cta href={INVITE_URL} external>{t('passport.cta')}</Cta></div>
            </article>

            <article id="collab-home" className="trio-col" data-k="collab">
              <ColHead icon={Briefcase} name={t('collab.name')} blurb={t('collab.blurb')} />
              <div className="trio-preview trio-preview--collab">
                <div className="flex items-center justify-between px-4 pt-4">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9ff0ea]">WODY Collab</span>
                  <span className="inline-flex items-center gap-1.5 text-[11px] text-emerald-300"><span className="trio-live" aria-hidden="true" />{t('collab.live')}</span>
                </div>
                <ul className="space-y-2 px-4 pb-10 pt-3">
                  {['r1', 'r2', 'r3'].map((k, i) => (
                    <li key={k} className="trio-row" style={{ animationDelay: `${i * 0.3}s` }}>
                      <span className="trio-row-dot" aria-hidden="true" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-semibold text-white">{t(`collab.${k}`)}</span>
                        <span className="block truncate text-[11px] text-white/60">{t(`collab.${k}s`)}</span>
                      </span>
                      <span className="rounded-full border border-[#3fd0c9]/50 px-2 py-0.5 text-[10px] text-[#9ff0ea]">{t(i === 1 ? 'collab.server' : 'collab.global')}</span>
                    </li>
                  ))}
                </ul>
                <span className="trio-example">{t('mock.example')}</span>
              </div>
              <div className="mt-auto"><Cta href="/collab">{t('collab.cta')}</Cta></div>
            </article>
          </div>

          <p className="trio-note">
            {t('note')}{' '}
            <Link href="/miami-style-discord-bot" className="underline decoration-dotted underline-offset-2 hover:text-[#f3e1b0]">{t('miamiLink')}</Link>
          </p>
        </div>
      </div>
    </section>
  );
}

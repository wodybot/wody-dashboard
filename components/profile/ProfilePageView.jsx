import { cloneElement } from 'react';
import { useTranslations } from 'next-intl';
import { TreePalm, Lock, Eye, ExternalLink, Link2, IdCard, Globe, Users } from 'lucide-react';
import ProfileCardPreview from '@/components/profile/ProfileCardPreview';
import MusicButton from '@/components/profile/MusicButton';
import SocialLinks from '@/components/profile/SocialLinks';
import { pageAccent } from '@/lib/profile-page';
import { proxiedImageUrl } from '@/lib/utils';

const fmt = (iso, locale) => { try { return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(iso)); } catch { return ''; } };

function Block({ title, accent, span = '', delay = 0, children }) {
  return (
    <section className={`pv-in pv-lift rounded-3xl border bg-card/60 p-4 sm:p-6 ${span}`} style={{ borderColor: `${accent}40`, '--ac': accent, animationDelay: `${delay}s` }}>
      <h2 className="mb-3 text-lg font-black">{title}</h2>
      {children}
    </section>
  );
}

/** Single renderer used by the public profile page and by the editor's live preview. */
export default function ProfilePageView({ page, name, username, avatarSrc, memberSince, away, socials = {}, live = 0, views = 0, isPublic = false, locale = 'en', card = null, passport = null, pass = null, compact = false }) {
  const t = useTranslations('profile');
  const tp = useTranslations('profilePage');
  const tb = useTranslations('battlepass.profile');
  const accent = pageAccent(page) || '#e6cd8c';
  const hide = new Set(page.hide || []);
  const has = Object.keys(socials).length > 0;
  const order = (page.order && page.order.length ? page.order : ['bio', 'portfolio', 'skills', 'links', 'card']).filter((k) => !hide.has(k));

  const sections = {
    bio: page.bio ? <Block key="bio" title={tp('section.bio')} accent={accent} span="lg:col-span-2"><p className="whitespace-pre-line break-words text-sm leading-relaxed">{page.bio}</p></Block> : null,
    skills: page.skills?.length ? (
      <Block key="skills" title={tp('section.skills')} accent={accent} span="lg:col-span-1">
        <ul className="flex flex-wrap gap-2">{page.skills.map((s, i) => <li key={`${s}-${i}`} className="rounded-full border px-3 py-1 text-xs font-semibold" style={{ borderColor: `${accent}55`, background: `${accent}14` }}>{s}</li>)}</ul>
      </Block>
    ) : null,
    links: page.links?.length ? (
      <Block key="links" title={tp('section.links')} accent={accent} span="lg:col-span-3">
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {page.links.map((l, i) => {
            let host = '';
            try { host = new URL(l.url).hostname.replace(/^www\./, ''); } catch { }
            return (
              <li key={`${l.url}-${i}`}>
                <a href={l.url} target="_blank" rel="noopener noreferrer nofollow ugc" className="flex items-center gap-2 rounded-2xl border border-border/50 bg-background/40 px-3 py-2.5 text-sm font-semibold transition hover:border-[var(--ac)]" style={{ '--ac': accent }}>
                  <Link2 className="h-4 w-4 shrink-0" style={{ color: accent }} aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate">{l.label || host}</span>
                  <span className="hidden truncate text-xs font-normal text-muted-foreground sm:inline">{host}</span>
                </a>
              </li>
            );
          })}
        </ul>
      </Block>
    ) : null,
    portfolio: page.portfolio?.length ? (
      <Block key="portfolio" title={tp('section.portfolio')} accent={accent} span="lg:col-span-3">
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {page.portfolio.map((p, i) => {
            const inner = (
              <>
                {p.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={proxiedImageUrl(p.image)} alt="" loading="lazy" className="aspect-video w-full object-cover" />
                ) : null}
                <div className="p-3">
                  <div className="flex items-start justify-between gap-2"><h3 className="break-words text-sm font-black">{p.title}</h3>{p.url ? <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" /> : null}</div>
                  {p.desc ? <p className="mt-1 break-words text-xs text-muted-foreground">{p.desc}</p> : null}
                </div>
              </>
            );
            const cls = 'block overflow-hidden rounded-2xl border border-border/50 bg-background/40 transition hover:border-[var(--ac)]';
            return <li key={`${p.title}-${i}`}>{p.url ? <a href={p.url} target="_blank" rel="noopener noreferrer nofollow ugc" className={cls} style={{ '--ac': accent }}>{inner}</a> : <div className={cls}>{inner}</div>}</li>;
          })}
        </ul>
      </Block>
    ) : null,
    card: card ? (
      <section key="card" aria-label={tp('levelCardTitle')} className="pv-in pv-lift relative mx-auto w-full max-w-2xl overflow-hidden rounded-3xl border bg-card/60 p-3 sm:p-4 lg:col-span-3" style={{ borderColor: `${accent}66`, '--ac': accent }}>
        <div className="mb-3 flex items-center justify-center gap-2.5">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl" style={{ background: `${accent}26`, color: accent }}><IdCard className="h-4 w-4" aria-hidden="true" /></span>
          <h2 className="text-base font-black leading-tight">{tp('levelCardTitle')}</h2>
        </div>
        <div className="mx-auto max-w-xl" style={{ filter: `drop-shadow(0 0 22px ${card.cfg.accent}55)` }}>
          <ProfileCardPreview cfg={card.cfg} name={name} avatarSrc={avatarSrc} tagline={card.tagline || ''} />
        </div>
      </section>
    ) : null,
    passport: passport ? (
      <Block key="passport" title={tp('section.passport')} accent={accent} span="lg:col-span-1">
        <dl className="space-y-2">
          {[[tp('passportNo'), passport.number], [tp('daysWith'), new Intl.NumberFormat(locale).format(passport.days)], [tp('passportSince'), fmt(passport.since, locale)], [tp('bansLabel'), new Intl.NumberFormat(locale).format(passport.bans)]].map(([k, v]) => (
            <div key={k} className="flex items-baseline justify-between gap-3 rounded-xl border border-border/50 bg-background/40 px-3 py-2">
              <dt className="truncate text-xs text-muted-foreground">{k}</dt>
              <dd className="break-all text-right text-sm font-black tabular-nums" style={{ color: accent }}>{v}</dd>
            </div>
          ))}
        </dl>
      </Block>
    ) : null,
    battlepass: pass?.seasons?.length ? (
      <Block key="battlepass" title={tp('section.battlepass')} accent={accent} span="lg:col-span-3">
        <div className="space-y-5">
          {pass.seasons.map((se) => (
            <div key={se.id}>
              <h3 className="mb-2 flex flex-wrap items-center gap-2 text-sm font-black">
                <span>{se.i18n?.[locale]?.name || se.name}</span>
                <span className="rounded-full border px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground" style={{ borderColor: `${accent}40` }}>{se.scope === 'global' ? tb('scopeGlobal') : tb('scopeServer')}</span>
              </h3>
              <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {se.items.map((it) => (
                  <li key={it.item_id} className="flex items-center gap-3 rounded-xl border border-border/50 bg-background/40 px-3 py-2" style={it.item_id === pass.featured ? { borderColor: accent, boxShadow: `0 0 14px ${accent}40` } : undefined}>
                    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg text-lg" style={{ background: `${accent}1f` }}>
                      {it.art && /^https:\/\//.test(it.art) ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={proxiedImageUrl(it.art)} alt="" className="h-full w-full object-cover" /> : <span aria-hidden="true">{it.icon || ''}</span>}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">{it.i18n?.[locale]?.name || it.name}</span>
                      <span className="block truncate text-[0.7rem] text-muted-foreground">{it.group === 'badge' ? tb('groupBadge') : it.group === 'medal' ? tb('groupMedal') : tb('groupReward')}{it.item_id === pass.featured ? ` · ${tb('featured')}` : ''}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Block>
    ) : null,
  };

  return (
    <>
      <section aria-label={t('public.aria')} className="pv-in overflow-hidden rounded-3xl border bg-gradient-to-br from-[#e6cd8c]/[0.09] via-card/60 to-card/40 p-5 sm:p-8 lg:grid lg:grid-cols-[minmax(0,1fr)_16rem] lg:items-center lg:gap-8" style={{ borderColor: `${accent}40` }}>
        <div className="flex flex-col items-center gap-5 text-center sm:flex-row sm:text-left">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <span className="pv-ring" style={{ '--ac': accent }}><img src={avatarSrc} alt="" className="h-28 w-28 rounded-full border-[3px] border-[#120b08] object-cover sm:h-32 sm:w-32" /></span>
          <div className="min-w-0 flex-1">
            <h1 className={`break-words text-3xl font-black sm:text-4xl ${page.name_fx !== 'none' ? `name-fx name-fx-${page.name_fx}` : ''}`} style={page.name_fx === 'typewriter' ? { '--n': Math.max(1, [...name].length), '--accent': accent } : { '--accent': accent }}>{name}</h1>
            <p className="text-sm text-muted-foreground">@{username}{memberSince ? ` · ${t('hero.memberSince', { date: fmt(memberSince, locale) })}` : ''}</p>
            {away && (
              <p className="mt-3 inline-flex max-w-full items-start gap-2 rounded-2xl border border-sky-400/40 bg-sky-400/10 px-3 py-2 text-left text-sm text-sky-200">
                <TreePalm className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="min-w-0 break-words"><b>{t('away.badge')}</b>{away.until ? ` · ${t('away.until', { date: fmt(away.until, locale) })}` : ''}{away.note ? <span className="block text-xs text-sky-100/90">{away.note}</span> : null}</span>
              </p>
            )}
            {page.music ? <div className="mt-3 flex justify-center sm:justify-start"><MusicButton src={page.music} title={page.music_title} labels={{ play: tp('musicPlay'), pause: tp('musicPause'), note: tp('musicNote') }} /></div> : null}
            {!hide.has('socials') && (
              <div className="mt-4 flex justify-center sm:justify-start">
                {has ? <SocialLinks socials={socials} label={t('hero.socialsAria')} /> : <p className="text-sm text-muted-foreground">{t('public.noSocials')}</p>}
              </div>
            )}
          </div>
        </div>
        {!hide.has('stats') && (
          <dl className="mt-6 grid grid-cols-2 gap-3 lg:mt-0 lg:grid-cols-1">
            {[[Users, live, t('public.live')], [Eye, views, tp('views')]].map(([Icn, value, label]) => (
              <div key={label} className="flex min-h-[4.25rem] items-center gap-3 rounded-2xl border border-border/50 bg-background/40 px-4 py-3">
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ background: `${accent}22`, color: accent }}><Icn className="h-4 w-4" aria-hidden="true" /></span>
                <div className="min-w-0">
                  <dd className="text-xl font-black leading-none tabular-nums">{new Intl.NumberFormat(locale).format(value)}</dd>
                  <dt className="mt-1 truncate text-xs text-muted-foreground">{label}</dt>
                </div>
              </div>
            ))}
          </dl>
        )}
        <p className="mt-5 flex items-center gap-2 rounded-xl border border-border/50 bg-background/30 px-3 py-2 text-xs text-muted-foreground lg:col-span-2">
          {isPublic ? <Globe className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> : <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
          <span>{isPublic ? t('public.notePublic') : t('public.note')}</span>
        </p>
      </section>
      <div className="grid grid-flow-dense gap-6 lg:grid-cols-3">{order.map((k, i) => (sections[k] ? cloneElement(sections[k], { delay: 0.1 + i * 0.08 }) : null))}</div>
    </>
  );
}

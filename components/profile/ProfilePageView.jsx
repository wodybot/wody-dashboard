import { useTranslations } from 'next-intl';
import { TreePalm, Lock, Eye, ExternalLink, Link2 } from 'lucide-react';
import MusicButton from '@/components/profile/MusicButton';
import SocialLinks from '@/components/profile/SocialLinks';
import { pageAccent } from '@/lib/profile-page';
import { proxiedImageUrl } from '@/lib/utils';

const fmt = (iso, locale) => { try { return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(iso)); } catch { return ''; } };

function Block({ title, accent, children }) {
  return (
    <section className="rounded-3xl border bg-card/60 p-4 sm:p-6" style={{ borderColor: `${accent}40` }}>
      <h2 className="mb-3 text-lg font-black">{title}</h2>
      {children}
    </section>
  );
}

/** Single renderer used by the public profile page and by the editor's live preview. */
export default function ProfilePageView({ page, name, username, avatarSrc, memberSince, away, socials = {}, live = 0, views = 0, locale = 'en', levelCard = null, compact = false }) {
  const t = useTranslations('profile');
  const tp = useTranslations('profilePage');
  const accent = pageAccent(page) || '#e6cd8c';
  const hide = new Set(page.hide || []);
  const has = Object.keys(socials).length > 0;
  const order = (page.order && page.order.length ? page.order : ['bio', 'portfolio', 'skills', 'links', 'card']).filter((k) => !hide.has(k));

  const sections = {
    bio: page.bio ? <Block key="bio" title={tp('section.bio')} accent={accent}><p className="whitespace-pre-line break-words text-sm leading-relaxed">{page.bio}</p></Block> : null,
    skills: page.skills?.length ? (
      <Block key="skills" title={tp('section.skills')} accent={accent}>
        <ul className="flex flex-wrap gap-2">{page.skills.map((s, i) => <li key={`${s}-${i}`} className="rounded-full border px-3 py-1 text-xs font-semibold" style={{ borderColor: `${accent}55`, background: `${accent}14` }}>{s}</li>)}</ul>
      </Block>
    ) : null,
    links: page.links?.length ? (
      <Block key="links" title={tp('section.links')} accent={accent}>
        <ul className="grid gap-2 sm:grid-cols-2">
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
      <Block key="portfolio" title={tp('section.portfolio')} accent={accent}>
        <ul className={`grid gap-3 ${compact ? '' : 'sm:grid-cols-2'}`}>
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
    card: levelCard && !hide.has('card') ? <div key="card">{levelCard}</div> : null,
  };

  return (
    <>
      <section aria-label={t('public.aria')} className="overflow-hidden rounded-3xl border bg-gradient-to-br from-[#e6cd8c]/[0.09] via-card/60 to-card/40 p-5 sm:p-7" style={{ borderColor: `${accent}40` }}>
        <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={avatarSrc} alt="" className="h-24 w-24 shrink-0 rounded-full border-2 object-cover" style={{ borderColor: `${accent}99` }} />
          <div className="min-w-0 flex-1">
            <h1 className={`break-words text-3xl font-black ${page.name_fx !== 'none' ? `name-fx name-fx-${page.name_fx}` : ''}`} style={page.name_fx === 'typewriter' ? { '--n': Math.max(1, [...name].length), '--accent': accent } : { '--accent': accent }}>{name}</h1>
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
          <dl className="mt-6 grid grid-cols-2 gap-2">
            <div className="rounded-2xl border border-border/50 bg-background/40 px-3 py-2.5 text-center sm:text-left">
              <dd className="text-2xl font-black tabular-nums" style={{ color: accent }}>{live}</dd>
              <dt className="text-xs text-muted-foreground">{t('public.live')}</dt>
            </div>
            <div className="flex items-center justify-center gap-2 rounded-2xl border border-border/50 bg-background/40 px-3 py-2.5 sm:justify-start">
              <Eye className="h-4 w-4" style={{ color: accent }} aria-hidden="true" />
              <dd className="text-lg font-black tabular-nums">{new Intl.NumberFormat(locale).format(views)}</dd>
              <dt className="text-xs text-muted-foreground">{tp('views')}</dt>
            </div>
          </dl>
        )}
        <p className="mt-4 flex items-start gap-1.5 text-xs text-muted-foreground"><Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />{t('public.note')}</p>
      </section>
      {order.map((k) => sections[k])}
    </>
  );
}

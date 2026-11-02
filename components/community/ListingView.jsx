// The public community profile. Rendered by /server/[slug] and, with draft data, by the
// owner preview and the admin review page, so what an owner previews is what visitors get.
import { useLocale, useTranslations } from 'next-intl';
import { SealCheck } from '@/components/community/SealCheck';
import { Calendar, ShieldCheck, Circle, Mic, Rocket, Users, ExternalLink, Trophy, Sparkles, Shield } from 'lucide-react';
import { SafeMarkdown } from '@/components/community/SafeMarkdown';
import { themeVars, cardClass, resolveTheme } from '@/components/community/theme';
import { CardImage } from '@/components/community/ServerCard';
import ServerCard from '@/components/community/ServerCard';
import { BadgeChips } from '@/components/community/Badges';
import { SOCIAL_ICON } from '@/components/community/social-icons';
import { catalogName, formatCount } from '@/lib/community/names';

function Stat({ icon: Icon, label, value }) {
  const t = useTranslations('community');
  return (
    <div className="min-w-0 rounded-xl border border-white/10 bg-black/20 px-3.5 py-3">
      <div className="flex min-w-0 items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-white/60"><Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /><span className="truncate" title={label}>{label}</span></div>
      <div className="mt-1.5 truncate text-xl font-semibold tabular-nums">{value ?? <span className="text-white/40" title={t('stats.unavailable')}>-<span className="sr-only">{t('stats.unavailable')}</span></span>}</div>
    </div>
  );
}

function age(createdAt, t) {
  if (!createdAt) return null;
  const ms = Date.now() - new Date(createdAt).getTime();
  if (!Number.isFinite(ms) || ms < 0) return null;
  const days = Math.floor(ms / 86400_000);
  const years = Math.floor(days / 365);
  const months = Math.floor((days % 365) / 30);
  if (years) return months ? `${t('stats.ageYears', { count: years })} ${t('stats.ageMonths', { count: months })}` : t('stats.ageYears', { count: years });
  if (months) return t('stats.ageMonths', { count: months });
  return t('stats.ageDays', { count: days });
}

function Section({ id, title, children, style }) {
  return (
    <section aria-labelledby={`sec-${id}`} className={`rounded-2xl p-5 sm:p-6 ${style}`}>
      <h2 id={`sec-${id}`} className="mb-4 text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

export default function ListingView({ listing, catalog, slots = {}, similar = [], preview = false, optimize = true, fullBleed = false }) {
  const t = useTranslations('community');
  const locale = useLocale();
  const theme = resolveTheme(listing.theme);
  const card = cardClass(theme.card_style);
  const cat = catalog?.categories?.find((c) => c.slug === listing.category);
  const sub = catalog?.categories?.find((c) => c.slug === listing.subcategory);
  const enabled = (listing.sections || []).filter((s) => s.enabled);
  const features = (listing.features || []).map((slug) => catalog?.features?.find((f) => f.slug === slug) || slug);
  const joinHref = !preview && listing.invite ? `/api/community/join/${listing.slug}` : null;
  const stats = listing.stats;
  // `extra` lets the hero row give the button the same fixed size as the Favorites and Report buttons next to it.
  const makeJoin = (extra = '') => (
    joinHref
      ? <a href={joinHref} rel="nofollow noopener noreferrer" className={`inline-flex items-center justify-center gap-2 rounded-[var(--cm-radius-btn)] bg-[color:var(--cm-primary)] px-6 py-3 text-base font-bold text-[color:var(--cm-on-primary)] shadow-lg transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white motion-reduce:transition-none ${extra}`}>{t('profile.join')}<ExternalLink className="h-4 w-4" aria-hidden="true" /></a>
      : listing.invite
        ? <span className={`inline-flex items-center justify-center gap-2 rounded-[var(--cm-radius-btn)] bg-[color:var(--cm-primary)] px-6 py-3 text-base font-bold text-[color:var(--cm-on-primary)] ${extra}`}>{t('profile.join')}</span>
        : <span role="status" className={`inline-flex items-center justify-center rounded-[var(--cm-radius-btn)] border border-white/20 px-6 py-3 text-sm text-white/70 ${extra}`}>{t('profile.inviteUnavailable')}</span>
  );
  const joinBtn = makeJoin();

  const render = (key) => {
    switch (key) {
      case 'hero':
        return (
          <header key="hero" className={`overflow-hidden rounded-3xl ${card}`}>
            <div className="relative aspect-[16/5] min-h-[140px] w-full bg-gradient-to-br from-[color:var(--cm-primary)]/50 to-[color:var(--cm-accent)]/25">
              <CardImage src={listing.banner} sizes="(min-width:1024px) 1000px, 100vw" className="object-cover" priority optimize={optimize} />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
            </div>
            <div className="relative px-5 pb-6 sm:px-8">
              <div className="-mt-12 flex flex-wrap items-end gap-4 sm:-mt-14">
                <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-3xl border-4 border-[color:var(--cm-bg)] bg-secondary shadow-xl sm:h-28 sm:w-28">
                  {listing.icon ? <CardImage src={listing.icon} sizes="112px" optimize={false} className="object-cover" /> : <div className="flex h-full w-full items-center justify-center text-3xl font-bold" aria-hidden="true">{listing.name.slice(0, 1).toUpperCase()}</div>}
                </div>
                <div className="min-w-0 flex-1 pb-1">
                  <h1 className="flex flex-wrap items-center gap-2 break-words text-2xl font-bold sm:text-3xl">
                    <span className="min-w-0 break-words">{listing.name}</span>
                    {listing.verified ? <SealCheck className="h-6 w-6 shrink-0 text-emerald-400" label={t('badges.verified')} /> : null}
                  </h1>
                  {listing.badges?.length ? <div className="mt-2"><BadgeChips badges={listing.badges} /></div> : null}
                </div>
              </div>
              <p className="mt-4 max-w-3xl text-base text-white/85">{listing.short_description}</p>
              <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/75">
                <div className="flex items-center gap-1.5"><Users className="h-4 w-4" aria-hidden="true" /><dt className="sr-only">{t('stats.members')}</dt><dd>{stats?.members != null ? t('profile.membersCount', { count: formatCount(stats.members, locale) }) : t('stats.unavailable')}</dd></div>
                {stats?.online != null ? <div className="flex items-center gap-1.5"><Circle className="h-3 w-3 fill-emerald-400 text-emerald-400" aria-hidden="true" /><dt className="sr-only">{t('stats.online')}</dt><dd>{t('profile.onlineCount', { count: formatCount(stats.online, locale) })}</dd></div> : null}
                {cat ? <div><dt className="sr-only">{t('profile.category')}</dt><dd>{catalogName(t, 'categories', cat, locale)}{sub ? ` / ${catalogName(t, 'categories', sub, locale)}` : ''}</dd></div> : null}
                <div><dt className="sr-only">{t('card.languages')}</dt><dd className="uppercase tracking-wide">{(listing.languages || []).join(' · ')}</dd></div>
              </dl>
              <div className="mt-5 grid w-full max-w-2xl grid-cols-1 gap-3 sm:grid-cols-3">{makeJoin('min-h-12 w-full !py-2 px-4 leading-tight')}{slots.heroActions}</div>
            </div>
          </header>
        );
      case 'about':
        return listing.description ? <Section key="about" id="about" title={t('profile.about')} style={card}><SafeMarkdown text={listing.description} className="text-white/90" /></Section> : null;
      case 'statistics':
        return (
          <Section key="statistics" id="stats" title={t('profile.statistics')} style={card}>
            <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(8.5rem,1fr))]">
              <Stat icon={Users} label={t('stats.members')} value={stats?.members != null ? formatCount(stats.members, locale) : null} />
              <Stat icon={Circle} label={t('stats.online')} value={stats?.online != null ? formatCount(stats.online, locale) : null} />
              <Stat icon={Mic} label={t('stats.voice')} value={stats?.voice != null ? formatCount(stats.voice, locale) : null} />
              <Stat icon={Rocket} label={t('stats.bumps')} value={listing.bumps ? formatCount(listing.bumps, locale) : '0'} />
              <Stat icon={Rocket} label={t('stats.boosts')} value={stats?.boosts != null ? formatCount(stats.boosts, locale) : null} />
              <Stat icon={Calendar} label={t('stats.age')} value={age(stats?.created_at, t)} />
            </div>
            {stats?.fetched_at ? <p className="mt-3 text-xs text-white/50">{t('stats.updated', { date: new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(stats.fetched_at)) })}</p> : null}
          </Section>
        );
      case 'features':
        return features.length ? (
          <Section key="features" id="features" title={t('profile.features')} style={card}>
            <ul className="flex flex-wrap gap-2">{features.map((f) => <li key={f.slug || f} className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-sm">{catalogName(t, 'features', f, locale)}</li>)}</ul>
            {listing.tags?.length ? <ul className="mt-4 flex flex-wrap gap-1.5">{listing.tags.map((tag) => <li key={tag} className="rounded-full bg-[color:var(--cm-primary)]/15 px-2.5 py-0.5 text-xs text-[color:var(--cm-accent)]">{catalogName(t, 'tags', catalog?.tags?.find((x) => x.slug === tag) || tag, locale)}</li>)}</ul> : null}
          </Section>
        ) : null;
      case 'staff':
        return listing.staff?.length ? (
          <Section key="staff" id="staff" title={t('profile.staff')} style={card}>
            <ul className="flex flex-wrap gap-2">{listing.staff.map((r) => <li key={r.name} className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-sm"><Shield className="h-3.5 w-3.5" style={{ color: r.color || 'currentColor' }} aria-hidden="true" />{r.name}</li>)}</ul>
          </Section>
        ) : null;
      case 'events':
        return listing.events?.length ? (
          <Section key="events" id="events" title={t('profile.events')} style={card}>
            <ul className="space-y-2">{listing.events.map((e) => (
              <li key={e.type} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-black/20 px-4 py-3 text-sm">
                <span className="flex items-center gap-2 font-medium"><Sparkles className="h-4 w-4 text-[color:var(--cm-accent)]" aria-hidden="true" />{t.has(`events.type.${e.type}`) ? t(`events.type.${e.type}`) : e.type}{e.multiplier ? ` x${e.multiplier}` : ''}</span>
                <span className="text-white/60">{t('profile.eventEnds', { date: new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(e.ends_at)) })}</span>
              </li>))}</ul>
          </Section>
        ) : null;
      case 'achievements':
        return listing.achievements ? (
          <Section key="achievements" id="achievements" title={t('profile.achievements')} style={card}>
            <p className="flex items-center gap-2 text-sm text-white/85"><Trophy className="h-4 w-4 text-amber-400" aria-hidden="true" />{t('profile.achievementsText', { unlocked: formatCount(listing.achievements.unlocked, locale), players: formatCount(listing.achievements.players, locale) })}</p>
          </Section>
        ) : null;
      case 'social': {
        const entries = Object.entries(listing.socials || {});
        return entries.length ? (
          <Section key="social" id="social" title={t('profile.social')} style={card}>
            <ul className="flex flex-wrap gap-2">{entries.map(([k, url]) => {
              const Icon = SOCIAL_ICON[k];
              return <li key={k}><a href={url} target="_blank" rel="nofollow ugc noopener noreferrer" className="inline-flex items-center gap-2 rounded-[var(--cm-radius-btn)] border border-white/15 bg-white/5 px-4 py-2 text-sm hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">{Icon ? <Icon className="h-4 w-4" aria-hidden="true" /> : null}{t(`social.${k}`)}</a></li>;
            })}</ul>
          </Section>
        ) : null;
      }
      case 'reviews':
        return <Section key="reviews" id="reviews" title={t('profile.reviews')} style={card}>{slots.reviews || <p className="text-sm text-white/60">{t('reviews.previewNote')}</p>}</Section>;
      default:
        return null;
    }
  };

  return (
    <div style={themeVars(listing.theme)} className={`relative isolate overflow-hidden text-white ${fullBleed ? `w-full ${preview ? '' : 'min-h-[calc(100vh-4rem)]'}` : 'rounded-3xl'}`} data-community-profile>
      <div className="absolute inset-0 -z-10 bg-[color:var(--cm-bg)]" />
      {listing.background ? <div className="absolute inset-0 -z-10 opacity-30"><CardImage src={listing.background} sizes="100vw" className="object-cover" optimize={optimize} /></div> : null}
      <div className={fullBleed ? 'mx-auto w-full max-w-6xl space-y-5 px-3 py-5 sm:px-6 sm:py-8 lg:px-8' : 'mx-auto max-w-5xl space-y-5 p-3 sm:p-6'}>
        {enabled.map((s) => render(s.key))}
        {!preview ? (
          <p className="flex flex-wrap items-center justify-center gap-2 text-xs text-white/70">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-black/20 px-3 py-1"><ShieldCheck className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />{t('profile.trustReviewed')}</span>
            {listing.verified ? <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-black/20 px-3 py-1"><SealCheck className="h-3.5 w-3.5 text-emerald-400" />{t('badges.verified')}</span> : null}
          </p>
        ) : null}
        <section aria-labelledby="sec-join" className={`flex flex-col items-center gap-4 rounded-2xl p-8 text-center ${card}`}>
          <h2 id="sec-join" className="text-xl font-semibold">{t('profile.joinTitle', { name: listing.name })}</h2>
          {joinBtn}
          {slots.footerActions}
        </section>
        {similar.length ? (
          <section aria-labelledby="sec-similar">
            <h2 id="sec-similar" className="mb-3 text-lg font-semibold">{t('profile.similar')}</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{similar.map((s) => <ServerCard key={s.slug} server={s} catalog={catalog} />)}</div>
          </section>
        ) : null}
        {slots.footerNote || null}
      </div>
    </div>
  );
}

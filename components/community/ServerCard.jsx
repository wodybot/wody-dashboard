import Image from 'next/image';
import { SealCheck } from '@/components/community/SealCheck';
import { useLocale, useTranslations } from 'next-intl';
import { Users, Star, Circle, Mic } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { catalogName, formatCount } from '@/lib/community/names';
import { themeVars } from '@/components/community/theme';
import { BadgeChips } from '@/components/community/Badges';

export function CardImage({ src, alt = '', sizes, className = '', priority = false, optimize = true }) {
  if (!src) return null;
  if (!optimize) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt} className={`absolute inset-0 h-full w-full ${className}`} loading="lazy" decoding="async" />;
  }
  return <Image src={src} alt={alt} fill sizes={sizes || '(min-width:1024px) 360px, (min-width:640px) 50vw, 100vw'} className={className} priority={priority} quality={65} />;
}

export default function ServerCard({ server, catalog, priority = false, optimize = true, linkProps = {} }) {
  const t = useTranslations('community');
  const locale = useLocale();
  const cat = catalog?.categories?.find((c) => c.slug === server.category);
  const tags = (server.tags || []).slice(0, 3).map((slug) => catalog?.tags?.find((x) => x.slug === slug) || slug);
  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-border/60 bg-card/60 transition duration-200 hover:-translate-y-0.5 hover:border-[color:var(--cm-primary)]/60 hover:shadow-[0_10px_40px_-18px_rgb(var(--cm-primary-rgb)/0.6)] motion-reduce:transition-none motion-reduce:hover:translate-y-0 focus-within:ring-2 focus-within:ring-[color:var(--cm-primary)]"
      style={themeVars(server.theme ? { preset: 'custom', ...server.theme } : null)}>
      <div className="relative aspect-[16/6] w-full overflow-hidden bg-gradient-to-br from-[color:var(--cm-primary)]/40 to-[color:var(--cm-accent)]/20">
        <CardImage src={server.banner} sizes="(min-width:1280px) 380px, (min-width:640px) 45vw, 100vw" className="object-cover transition duration-300 group-hover:scale-[1.03] motion-reduce:transition-none" priority={priority} optimize={optimize} />
        {server.badges?.length ? <div className="absolute right-2 top-2"><BadgeChips badges={server.badges} compact /></div> : null}
      </div>
      <div className="relative flex flex-1 flex-col gap-3 p-4 pt-9">
        <div className="absolute -top-7 left-4 h-14 w-14 overflow-hidden rounded-2xl border-4 border-card bg-secondary shadow-lg">
          {server.icon ? <CardImage src={server.icon} sizes="56px" optimize={false} className="object-cover" /> : <div className="flex h-full w-full items-center justify-center text-lg font-bold" aria-hidden="true">{server.name.slice(0, 1).toUpperCase()}</div>}
        </div>
        <div className="min-w-0">
          <h3 className="flex items-center gap-1.5 text-base font-semibold leading-tight">
            <Link href={server.path || `/server/${server.slug}`} className="truncate after:absolute after:inset-0 after:content-[''] focus:outline-none" {...linkProps}>{server.name}</Link>
            {server.verified ? <SealCheck className="h-4 w-4 shrink-0 text-emerald-400" label={t('badges.verified')} /> : null}
          </h3>
          <p className="mt-1 line-clamp-2 min-h-[2.5rem] text-sm text-muted-foreground">{server.short_description}</p>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {server.stats_available ? (
            <>
              <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" aria-hidden="true" /><span className="sr-only">{t('stats.members')}</span>{formatCount(server.members, locale)}</span>
              {server.online != null ? <span className="inline-flex items-center gap-1"><Circle className="h-2.5 w-2.5 fill-emerald-400 text-emerald-400" aria-hidden="true" /><span className="sr-only">{t('stats.online')}</span>{formatCount(server.online, locale)}</span> : null}
            </>
          ) : <span>{t('stats.unavailable')}</span>}
          {server.rating ? <span className="inline-flex items-center gap-1"><Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" aria-hidden="true" />{server.rating}</span> : null}
          <span className="uppercase tracking-wide" aria-label={t('card.languages')}>{(server.languages || []).join(' · ')}</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {cat ? <span className="rounded-full bg-[color:var(--cm-primary)]/15 px-2.5 py-0.5 text-[11px] font-medium text-[color:var(--cm-accent)]">{catalogName(t, 'categories', cat, locale)}</span> : null}
          {tags.map((tag) => <span key={tag.slug || tag} className="rounded-full border border-border/60 px-2.5 py-0.5 text-[11px] text-muted-foreground">{catalogName(t, 'tags', tag, locale)}</span>)}
        </div>
        <div className="mt-auto pt-1">
          <span className="inline-flex w-full items-center justify-center rounded-[var(--cm-radius-btn)] bg-[color:var(--cm-primary)] px-4 py-2 text-sm font-semibold text-[color:var(--cm-on-primary)]">{t('card.view')}</span>
        </div>
      </div>
    </article>
  );
}

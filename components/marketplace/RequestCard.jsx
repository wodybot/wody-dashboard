'use client';
import { ArrowRight, Clock } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { catName, fmtDate } from './client';

export default function RequestCard({ item, categories, band = false }) {
  const t = useTranslations('marketplace');
  const locale = useLocale();
  const cat = categories?.find?.((c) => c.slug === item.category);
  return (
    <article className={`mk-card group flex shrink-0 snap-start flex-col rounded-2xl border border-border/60 bg-card/60 p-4 backdrop-blur transition hover:border-[#e6cd8c]/50 hover:bg-card/80 ${band ? 'w-[78vw] max-w-[320px] sm:w-[300px]' : 'w-[78vw] max-w-[300px] sm:w-[280px]'}`}>
      <div className="mb-2 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
        <span className="truncate rounded-full border border-border/60 px-2 py-0.5">{cat ? catName(cat, locale) : item.category}</span>
        <span className="inline-flex shrink-0 items-center gap-1"><Clock className="h-3 w-3" aria-hidden="true" />{fmtDate(item.published_at, locale)}</span>
      </div>
      <h3 className="line-clamp-2 text-base font-semibold leading-snug">{item.title}</h3>
      <p className="mt-2 line-clamp-3 flex-1 text-sm text-muted-foreground">{item.summary}</p>
      {item.tags?.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5" aria-label={t('tags')}>
          {item.tags.slice(0, 4).map((tag) => <li key={tag} className="rounded-md bg-muted/60 px-1.5 py-0.5 text-[11px]">#{tag}</li>)}
        </ul>
      )}
      <Link href={`/marketplace/${item.id}`} className="mt-4 inline-flex items-center gap-1.5 self-start rounded-lg border border-border/70 px-3 py-1.5 text-sm font-medium transition hover:border-[#e6cd8c]/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e6cd8c]">
        {t('view')} <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" aria-hidden="true" />
      </Link>
    </article>
  );
}

export function CardSkeletons({ n = 4 }) {
  return Array.from({ length: n }, (_, i) => (
    <div key={i} className="h-[200px] w-[78vw] max-w-[300px] shrink-0 animate-pulse rounded-2xl border border-border/40 bg-card/30 sm:w-[280px]" aria-hidden="true" />
  ));
}

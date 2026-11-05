import { useTranslations } from 'next-intl';
import { Activity, Heart, ShieldCheck, Sparkles } from 'lucide-react';

const ITEMS = [[1, ShieldCheck], [2, Activity], [3, Sparkles], [4, Heart]];

export default function Highlights() {
  const t = useTranslations('community.home');
  return (
    <ul aria-label={t('hlLabel')} className="-mx-4 mb-10 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-4 [&::-webkit-scrollbar]:hidden">
      {ITEMS.map(([n, Icon]) => (
        <li key={n} className="group relative w-[78%] shrink-0 snap-start overflow-hidden rounded-2xl border border-[#e6cd8c]/25 bg-gradient-to-br from-[#e6cd8c]/[0.12] via-card/50 to-transparent p-4 transition-colors hover:border-[#e08a4e]/60 sm:w-auto sm:p-5">
          <span className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#e08a4e]/35 bg-[#e6cd8c]/15 text-[#f0c08e] transition-transform group-hover:scale-105 motion-reduce:transition-none"><Icon className="h-5 w-5" aria-hidden="true" /></span>
          <p className="text-sm font-semibold leading-snug">{t(`hl${n}Title`)}</p>
          <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{t(`hl${n}Text`)}</p>
        </li>
      ))}
    </ul>
  );
}

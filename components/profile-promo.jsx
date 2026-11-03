import { getTranslations } from 'next-intl/server';
import { ArrowRight, Image as ImageIcon, IdCard, Link2 } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { CoastScene } from '@/components/profile/PageBackdrop';

export async function ProfilePromo() {
  const t = await getTranslations('landing.profilePromo');
  const items = [[ImageIcon, 'f1'], [IdCard, 'f2'], [Link2, 'f3']];
  return (
    <section className="max-w-7xl mx-auto px-6 py-10" aria-labelledby="profile-promo-title">
      <div className="relative isolate overflow-hidden rounded-3xl border border-[#ff5e8a]/30">
        <div className="absolute inset-0 -z-10" style={{ background: 'linear-gradient(175deg, #ff5e8a 0%, #7a2a7a 38%, #1a0b3b 100%)' }} />
        <div className="absolute inset-y-0 right-0 -z-10 w-full opacity-60 md:w-[58%] md:opacity-95"><CoastScene /></div>
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-[#2a0b3b]/70 via-transparent to-transparent md:from-transparent" />
        <div className="relative max-w-xl p-6 sm:p-10 md:p-12 text-white">
          <p className="text-xs uppercase tracking-wider text-[#ffd9b0] mb-2">{t('badge')}</p>
          <h2 id="profile-promo-title" className="text-3xl sm:text-4xl font-bold tracking-tight">{t('title')}</h2>
          <p className="mt-3 text-sm sm:text-base text-white/85 leading-relaxed">{t('text')}</p>
          <ul className="mt-5 space-y-2">
            {items.map(([Icon, k]) => (
              <li key={k} className="flex items-center gap-2 text-sm text-white/90"><Icon className="h-4 w-4 shrink-0 text-[#ffd9b0]" />{t(k)}</li>
            ))}
          </ul>
          <Link href="/profile?tab=page" className="mt-6 inline-flex items-center gap-2 rounded-full bg-white/95 px-5 py-2.5 text-sm font-semibold text-[#2a0b3b] transition hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
            {t('cta')}<ArrowRight className="h-4 w-4" />
          </Link>
          <p className="mt-4 text-[11px] text-white/60">{t('note')}</p>
        </div>
      </div>
    </section>
  );
}

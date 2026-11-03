import { getTranslations } from 'next-intl/server';
import { ArrowRight, Briefcase, Globe, PenLine, ShieldCheck, Wallet } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { NavTag } from '@/components/nav';

const CHIPS = [['ecoChip1', Globe], ['ecoChip2', ShieldCheck], ['ecoChip3', Wallet]];

export async function EcosystemSection() {
  const t = await getTranslations('collab');
  const tNav = await getTranslations('nav');
  return (
    <section id="ecosystem" aria-labelledby="ecosystem-title" className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 md:py-14">
      <div className="rounded-[2rem] bg-gradient-to-br from-[#f3e1b0]/70 via-[#a04820]/45 to-[#e6cd8c]/70 p-[1.5px] shadow-[0_24px_80px_-30px_rgba(230,205,140,0.35)]">
        <div className="relative isolate overflow-hidden rounded-[calc(2rem-1.5px)] bg-gradient-to-br from-[#2a1809] via-[#1a0e06] to-[#110a05] px-5 py-10 sm:px-10 md:py-14">
          <div aria-hidden="true" className="pointer-events-none absolute -top-24 left-1/2 -z-10 h-64 w-[34rem] max-w-full -translate-x-1/2 rounded-full bg-[#e6cd8c]/15 blur-3xl" />
          <div aria-hidden="true" className="pointer-events-none absolute -bottom-28 left-1/2 -z-10 h-56 w-[30rem] max-w-full -translate-x-1/2 rounded-full bg-[#a04820]/30 blur-3xl" />
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 opacity-[0.07] [background-image:radial-gradient(#e6cd8c_1px,transparent_1px)] [background-size:22px_22px]" />
          <div className="mb-8 flex justify-center"><span className="inline-flex items-center gap-2 rounded-full border border-[#e6cd8c]/40 bg-[#e6cd8c]/10 px-3.5 py-1.5 text-xs font-medium uppercase tracking-[0.2em] text-[#f3e1b0]"><Briefcase className="h-3.5 w-3.5" aria-hidden="true" />WODY Collab<NavTag kind="new" label={tNav('tags.new')} /></span></div>
          <div className="mx-auto max-w-3xl">
            <div className="flex flex-col items-center text-center">
              <h2 id="ecosystem-title" className="bg-gradient-to-b from-[#fff6dc] to-[#e6cd8c] bg-clip-text text-3xl font-extrabold uppercase leading-tight tracking-tight text-transparent sm:text-4xl lg:text-5xl">{t('ecoTitle')}</h2>
              <p className="mt-4 max-w-xl text-base text-[#eadcb8]/80 sm:text-lg">{t('bandText')}</p>
              <ul className="mt-6 flex flex-wrap items-center justify-center gap-2">
                {CHIPS.map(([key, Icon]) => (
                  <li key={key} className="inline-flex items-center gap-1.5 rounded-full border border-[#e6cd8c]/40 bg-[#e6cd8c]/10 px-3 py-1.5 text-xs font-medium text-[#f3e1b0] sm:text-sm">
                    <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />{t(key)}
                  </li>
                ))}
              </ul>
              <div className="mt-8 flex w-full flex-col items-stretch gap-3 sm:w-auto sm:flex-row sm:items-center">
                <Link href="/collab" className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#f3e1b0] to-[#e6cd8c] px-7 py-3 text-sm font-semibold text-[#2a1d0a] shadow-lg shadow-black/30 transition hover:brightness-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e6cd8c]">
                  {t('browseAll')} <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                <Link href="/profile?new=1" className="inline-flex items-center justify-center gap-2 rounded-full border border-[#e6cd8c]/50 bg-[#e6cd8c]/5 px-7 py-3 text-sm font-semibold text-[#f3e1b0] transition hover:bg-[#e6cd8c]/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e6cd8c]">
                  <PenLine className="h-4 w-4" aria-hidden="true" /> {t('ecoPost')}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

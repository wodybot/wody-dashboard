'use client';
// Lists every place a server theme is visible, so owners know where to look.
// Links open the real pages in a new tab; the dashboard card has its own switch, saved with the usual save bar.
import { ExternalLink } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import WodyIcon from '@/components/wody-icon';

const PLACES = [
  { id: 'battlepass', icon: 'trophy', path: (g) => `/servers/${g}/battlepass` },
  { id: 'leaderboard', icon: 'medal', path: (g) => `/leaderboard/${g}` },
  { id: 'community', icon: 'community', path: () => '/dashboard/community' },
  { id: 'dashboard', icon: 'dashboard', path: null },
];

export default function WhereItShows({ guildId, published, dashboardOn, onToggleDashboard }) {
  const t = useTranslations('themes');
  const locale = useLocale();
  const base = locale === 'en' ? '' : `/${locale}`;
  return (
    <section className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/[0.12] via-card/60 to-card/60 p-4 sm:p-5" aria-labelledby="where-title" data-where-theme>
      <h3 id="where-title" className="text-base font-semibold sm:text-lg">{t('where.title')}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{published ? t('where.hintLive') : t('where.hintDraft')}</p>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
        {PLACES.map((p) => {
          const on = p.id === 'dashboard' ? dashboardOn : true;
          const live = on && published;
          return (
            <li key={p.id} className="flex h-full flex-col gap-3 rounded-xl border border-border/80 bg-background/50 p-4 transition-colors hover:border-primary/50">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-primary/30 bg-primary/10"><WodyIcon name={p.icon} size={22} inline={false} /></span>
                <strong className="min-w-0 flex-1 truncate text-sm sm:text-base">{t(`where.${p.id}.name`)}</strong>
                <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${live ? 'bg-emerald-400/15 text-emerald-300 ring-1 ring-emerald-400/30' : 'bg-white/10 text-muted-foreground ring-1 ring-white/10'}`}>{live ? t('where.statusOn') : t('where.statusOff')}</span>
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground">{t(`where.${p.id}.text`)}</p>
              <div className="mt-auto flex flex-wrap gap-2 pt-1">
                {p.path ? (
                  <a href={`${base}${p.path(guildId)}`} target="_blank" rel="noopener noreferrer"
                    className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-[0_6px_18px_-8px_var(--tw-shadow-color)] shadow-primary transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
                    {t('where.open')}<ExternalLink className="h-4 w-4" aria-hidden="true" />
                  </a>
                ) : null}
                {p.id === 'dashboard' ? (
                  <button type="button" role="switch" aria-checked={dashboardOn} onClick={() => onToggleDashboard(!dashboardOn)}
                    className={`inline-flex min-h-10 items-center gap-3 rounded-lg border px-3 text-sm font-semibold transition ${dashboardOn ? 'border-primary/60 bg-primary/10 text-foreground' : 'border-border text-muted-foreground hover:bg-white/5'}`}>
                    <span aria-hidden="true" className={`relative h-5 w-9 rounded-full transition ${dashboardOn ? 'bg-primary' : 'bg-white/20'}`}><span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${dashboardOn ? 'left-[18px]' : 'left-0.5'}`} /></span>
                    {dashboardOn ? t('where.dashboard.turnOff') : t('where.dashboard.turnOn')}
                  </button>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

'use client';
// Lists every place a server theme is visible, so owners know where to look.
// Links open the real pages in a new tab; the dashboard row reflects the saved switch.
import { useLocale, useTranslations } from 'next-intl';
import WodyIcon from '@/components/wody-icon';

const PLACES = [
  { id: 'battlepass', icon: 'trophy', path: (g) => `/servers/${g}/battlepass` },
  { id: 'leaderboard', icon: 'medal', path: (g) => `/leaderboard/${g}` },
  { id: 'community', icon: 'community', path: null },
  { id: 'dashboard', icon: 'dashboard_globe', path: null },
];

export default function WhereItShows({ guildId, published, dashboardOn, onToggleDashboard }) {
  const t = useTranslations('themes');
  const locale = useLocale();
  const base = locale === 'en' ? '' : `/${locale}`;
  return (
    <section className="rounded-2xl border border-primary/30 bg-primary/[0.06] p-4" aria-labelledby="where-title" data-where-theme>
      <h3 id="where-title" className="text-base font-semibold">{t('where.title')}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{published ? t('where.hintLive') : t('where.hintDraft')}</p>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {PLACES.map((p) => {
          const on = p.id === 'dashboard' ? dashboardOn : true;
          return (
            <li key={p.id} className="flex h-full flex-col gap-2 rounded-xl border border-border bg-background/40 p-3">
              <span className="flex items-center gap-2 text-sm font-semibold"><WodyIcon name={p.icon} size={16} />{t(`where.${p.id}.name`)}
                <span className={`ml-auto rounded-full px-2 py-0.5 text-[11px] font-medium ${on && published ? 'bg-emerald-400/15 text-emerald-300' : 'bg-white/10 text-muted-foreground'}`}>{on && published ? t('where.statusOn') : t('where.statusOff')}</span>
              </span>
              <span className="text-xs text-muted-foreground">{t(`where.${p.id}.text`)}</span>
              <span className="mt-auto flex flex-wrap gap-2">
                {p.path ? <a href={`${base}${p.path(guildId)}`} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-9 items-center rounded-lg border border-primary/50 px-3 text-xs font-semibold text-primary hover:bg-primary/10">{t('where.open')}</a> : null}
                {p.id === 'dashboard' ? <button type="button" role="switch" aria-checked={dashboardOn} onClick={() => onToggleDashboard(!dashboardOn)} className="inline-flex min-h-9 items-center rounded-lg border border-border px-3 text-xs font-semibold hover:bg-white/5">{dashboardOn ? t('where.dashboard.turnOff') : t('where.dashboard.turnOn')}</button> : null}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

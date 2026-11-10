import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import WodyIcon from '@/components/wody-icon';
import PageBackdrop from '@/components/profile/PageBackdrop';
import PassPage from './PassPage';
import LocalDate from './LocalDate';
import { CalendarClock, Sparkles } from 'lucide-react';

/** The text of a coming season in the visitor's language, falling back to the one written first. */
function soonText(item, locale) {
  const tr = item?.i18n?.[locale] || {};
  return { name: tr.name || item.name, description: tr.description || item.description || '' };
}

/** "Coming soon": a published season that has not started. Name, optional description and the start date. */
function ComingSoon({ item, t, locale, backHref }) {
  const { name, description } = soonText(item, locale);
  return (
    <>
      <PageBackdrop page={{}} />
      <main id="main-content" className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center gap-5 px-4 py-16 text-center sm:px-8">
        <span className="relative grid h-24 w-24 place-items-center rounded-3xl border border-amber-300/40 bg-amber-300/10 shadow-[0_0_60px_-12px_rgba(240,178,50,0.55)]">
          <WodyIcon name="scheduled" size={48} inline={false} />
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/40 bg-amber-300/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-amber-200"><Sparkles className="h-3.5 w-3.5" aria-hidden="true" />{t('page.comingSoon.title')}</span>
        <h1 className="break-words text-3xl font-black tracking-tight sm:text-4xl">{name}</h1>
        {description ? <p className="max-w-md whitespace-pre-line break-words text-muted-foreground">{description}</p> : null}
        <p className="inline-flex items-center gap-2 rounded-2xl border border-border/60 bg-card/50 px-4 py-2.5 text-sm font-semibold">
          <CalendarClock className="h-4 w-4 text-amber-200" aria-hidden="true" />
          {item.starts_at ? <span>{t.rich('page.comingSoon.startsOn', { date: <LocalDate value={item.starts_at} /> })}</span> : <span>{t('page.comingSoon.noDate')}</span>}
        </p>
        <Link href={backHref} className="mt-2 inline-flex min-h-11 items-center rounded-full bg-[#e6cd8c] px-6 text-sm font-semibold text-black transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e6cd8c]">{t('page.back')}</Link>
      </main>
    </>
  );
}

// The root layout sends only a short list of message namespaces to the browser, so the Battle Pass page brings its own.
async function withMessages(children) {
  const all = await getMessages();
  const messages = { battlepass: all.battlepass, bpStudio: all.bpStudio, guildSettings: { kit: all.guildSettings?.kit } };
  return <NextIntlClientProvider messages={messages}>{children}</NextIntlClientProvider>;
}

/** The page frame shared by the Battle Pass routes: no site header or footer, a back link, and the pass or an empty state. */
export default async function PassShell({ data, t, backHref, guildName, loginHref, emptyKey, studio = null, theme }) {
  const { season, state, viewer, leaderboard } = data;
  const locale = await getLocale();
  const next = (data.upcoming || [])[0] || null;
  return withMessages(
    <div className="min-h-screen flex flex-col">
      {season && next ? (
        <div className="relative z-10 mx-auto mt-3 flex w-full max-w-3xl justify-center px-4">
          <p className="inline-flex max-w-full flex-wrap items-center justify-center gap-x-2 rounded-full border border-amber-300/40 bg-black/50 px-4 py-1.5 text-xs font-semibold text-amber-100 backdrop-blur">
            <CalendarClock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">{t('page.comingSoon.next', { name: soonText(next, locale).name })}</span>
            <span className="text-amber-200/80">{next.starts_at ? <LocalDate value={next.starts_at} /> : t('page.comingSoon.noDate')}</span>
          </p>
        </div>
      ) : null}
      {season ? <PassPage season={season} initialState={state} viewer={viewer} guildName={guildName} backHref={backHref} loginHref={loginHref} leaderboard={leaderboard} studio={studio} theme={theme} /> : next ? <ComingSoon item={next} t={t} locale={locale} backHref={backHref} /> : (
        <>
          <PageBackdrop page={{}} />
          <main id="main-content" className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center sm:px-8">
            <span className="grid h-20 w-20 place-items-center rounded-3xl border border-[#e6cd8c]/30 bg-[#e6cd8c]/10"><WodyIcon name="trophy" size={44} inline={false} /></span>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t(`page.${emptyKey}.title`)}</h1>
            <p className="max-w-md text-muted-foreground">{t(`page.${emptyKey}.text`)}</p>
            <Link href={backHref} className="mt-2 inline-flex min-h-11 items-center rounded-full bg-[#e6cd8c] px-6 text-sm font-semibold text-black transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e6cd8c]">{t('page.back')}</Link>
          </main>
        </>
      )}
    </div>,
  );
}

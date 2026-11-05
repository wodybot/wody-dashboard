import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { ArrowLeft } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import PageBackdrop from '@/components/profile/PageBackdrop';
import PassPage from './PassPage';

// The root layout sends only a short list of message namespaces to the browser, so the Battle Pass page brings its own.
async function withMessages(children) {
  const all = await getMessages();
  const messages = { battlepass: all.battlepass, bpStudio: all.bpStudio, guildSettings: { kit: all.guildSettings?.kit } };
  return <NextIntlClientProvider messages={messages}>{children}</NextIntlClientProvider>;
}

/** The page frame shared by the Battle Pass routes: no site header or footer, a back link, and the pass or an empty state. */
export default async function PassShell({ data, t, backHref, guildName, loginHref, emptyKey, studio = null, theme }) {
  const { season, state, viewer, leaderboard } = data;
  return withMessages(
    <div className="min-h-screen flex flex-col">
      {season ? <PassPage season={season} initialState={state} viewer={viewer} guildName={guildName} backHref={backHref} loginHref={loginHref} leaderboard={leaderboard} studio={studio} theme={theme} /> : (
        <>
          <PageBackdrop page={{}} />
          <div className="mx-auto w-full max-w-3xl px-4 pt-5 sm:px-8">
            <Link href={backHref} className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/40 px-3.5 py-1.5 text-xs font-semibold backdrop-blur transition hover:border-[#e6cd8c]/60 hover:text-[#e6cd8c] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#e6cd8c]"><ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />{t('page.back')}</Link>
          </div>
          <main id="main-content" className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-3 px-4 py-16 sm:px-8">
            <h1 className="text-3xl font-bold tracking-tight">{t(`page.${emptyKey}.title`)}</h1>
            <p className="text-muted-foreground">{t(`page.${emptyKey}.text`)}</p>
          </main>
        </>
      )}
    </div>,
  );
}

import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import WodyIcon from '@/components/wody-icon';
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

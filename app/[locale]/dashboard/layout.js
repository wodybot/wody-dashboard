import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import DashboardTopNav from '@/components/dashboard-top-nav';

export const metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default async function DashboardLayout({ children }) {
  // The root [locale]/layout.js only passes client components a trimmed
  // set of translation namespaces (perf: see the comment there) since most
  // routes don't need the ~45KB `guildSettings` namespace or the rest of
  // the dashboard's translations. The dashboard does need all of it, so
  // this re-provides the full, untrimmed message set for just this
  // subtree, same messages as before this change, nothing here loses any
  // translations.
  const messages = await getMessages();

  return (
    <NextIntlClientProvider messages={messages}>
      {/* The server list keeps the existing desktop/mobile split; selected servers use the compact header on every screen size. */}
      <DashboardTopNav />
      {children}
    </NextIntlClientProvider>
  );
}

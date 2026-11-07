import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import DashboardTopNav from '@/components/dashboard-top-nav';
import { clientMessages } from '@/lib/i18n-server-only';

export const metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default async function DashboardLayout({ children }) {
  // Only the texts that client components read are sent to the browser; legal pages, the landing page and other server-only texts stay
  // on the server, which keeps every dashboard page much lighter.
  const messages = clientMessages(await getMessages());

  return (
    <NextIntlClientProvider messages={messages}>
      <DashboardTopNav />
      {children}
    </NextIntlClientProvider>
  );
}

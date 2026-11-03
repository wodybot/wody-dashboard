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
  const messages = await getMessages();

  return (
    <NextIntlClientProvider messages={messages}>
      <DashboardTopNav />
      {children}
    </NextIntlClientProvider>
  );
}

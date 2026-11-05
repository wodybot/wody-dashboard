import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { loadStudioPage } from '@/lib/battlepass/studio/public';
import { studioTheme } from '@/lib/battlepass/studio/theme';
import PreviewFrame from '@/components/battlepass/studio/PreviewFrame';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';

export const dynamic = 'force-dynamic';
export const metadata = { robots: { index: false, follow: false }, title: 'Battle Pass preview' };

// Owner only: the live preview of the draft inside the Page Studio. It listens for the draft sent by the studio (same origin).
export default async function StudioPreview({ params }) {
  const { locale, sid } = await params;
  setRequestLocale(locale);
  const data = await loadStudioPage({ sid, preview: true });
  if (!data) notFound();
  const all = await getMessages();
  const messages = { battlepass: all.battlepass, bpStudio: all.bpStudio, guildSettings: { kit: all.guildSettings?.kit } };
  await getTranslations({ locale, namespace: 'battlepass' });
  return (
    <NextIntlClientProvider messages={messages}>
      <PreviewFrame data={{ ...data, theme: studioTheme(data.season.page, data.config) }} />
    </NextIntlClientProvider>
  );
}

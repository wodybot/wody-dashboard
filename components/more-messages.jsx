'use client';
import { NextIntlClientProvider, useLocale, useMessages } from 'next-intl';

export default function MoreMessages({ extra, children }) {
  const base = useMessages();
  const locale = useLocale();
  return <NextIntlClientProvider locale={locale} messages={{ ...base, ...extra }}>{children}</NextIntlClientProvider>;
}

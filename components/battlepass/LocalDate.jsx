'use client';
import { useEffect, useState } from 'react';
import { useLocale } from 'next-intl';

/** A moment shown in the visitor's own time zone and language. The first paint uses UTC (what the server knows), then the browser's zone. */
export default function LocalDate({ value, withTime = true, className = '' }) {
  const locale = useLocale();
  const [zone, setZone] = useState(undefined);
  useEffect(() => { try { setZone(Intl.DateTimeFormat().resolvedOptions().timeZone); } catch { /* keep UTC */ } }, []);
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  let label = '';
  try {
    label = new Intl.DateTimeFormat(locale, { dateStyle: 'long', ...(withTime ? { timeStyle: 'short' } : {}), timeZone: zone || 'UTC' }).format(date);
  } catch { label = date.toISOString().slice(0, 16).replace('T', ' '); }
  return <time dateTime={date.toISOString()} className={className} suppressHydrationWarning>{label}{!zone && withTime ? ' UTC' : ''}</time>;
}

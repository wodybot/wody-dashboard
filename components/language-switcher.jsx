'use client';
import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tip } from '@/components/tip';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { usePathname, useRouter } from '@/i18n/navigation';
import { routing, LOCALE_LABELS } from '@/i18n/routing';
import { CONSENT_EVENT, readCookieConsent } from '@/components/cookie-consent';

const LOCALE_COOKIE = 'wody_language';
const LOCALE_MAX_AGE = 60 * 60 * 24 * 180;

export function useLanguageChoice() {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const params = useParams();
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    const sync = () => setAllowed(readCookieConsent()?.preferences === true);
    sync();
    window.addEventListener(CONSENT_EVENT, sync);
    return () => window.removeEventListener(CONSENT_EVENT, sync);
  }, []);

  function select(nextLocale) {
    if (!readCookieConsent()?.preferences) return;
    document.cookie = `${LOCALE_COOKIE}=${encodeURIComponent(nextLocale)}; Path=/; Max-Age=${LOCALE_MAX_AGE}; SameSite=Lax; Secure`;
    router.replace({ pathname, params }, { locale: nextLocale });
  }

  return { allowed, locale, locales: routing.locales, labels: LOCALE_LABELS, select };
}

export default function LanguageSwitcher({ size = 'sm', className = '', labelClassName = '' }) {
  const t = useTranslations('nav');
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const params = useParams();
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    const sync = () => setAllowed(readCookieConsent()?.preferences === true);
    sync();
    window.addEventListener(CONSENT_EVENT, sync);
    return () => window.removeEventListener(CONSENT_EVENT, sync);
  }, []);

  function handleSelect(nextLocale) {
    if (!readCookieConsent()?.preferences) return;
    document.cookie = `${LOCALE_COOKIE}=${encodeURIComponent(nextLocale)}; Path=/; Max-Age=${LOCALE_MAX_AGE}; SameSite=Lax; Secure`;
    router.replace({ pathname, params }, { locale: nextLocale });
  }

  if (!allowed) return null;

  return (
    <DropdownMenu>
      <Tip label={t('language')}><DropdownMenuTrigger asChild><Button size={size} variant="ghost" aria-label={t('language')} className={`gap-1.5 border border-border/60 bg-card/40 hover:bg-card/80 hover:border-border transition-colors px-2.5 ${className}`}><Globe className="w-4 h-4" /><span className={`uppercase text-xs font-semibold ${labelClassName}`}>{locale}</span></Button></DropdownMenuTrigger></Tip>
      <DropdownMenuContent align="end" className="w-48"><DropdownMenuLabel>{t('language')}</DropdownMenuLabel><DropdownMenuSeparator />{routing.locales.map((l) => <DropdownMenuItem key={l} onSelect={() => handleSelect(l)} className={l === locale ? 'font-semibold text-primary' : ''}>{LOCALE_LABELS[l]}</DropdownMenuItem>)}</DropdownMenuContent>
    </DropdownMenu>
  );
}

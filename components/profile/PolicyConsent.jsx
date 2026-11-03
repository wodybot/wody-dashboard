'use client';

import { useId } from 'react';
import { useTranslations } from 'next-intl';

const LINKS = [['content', '/policies/content-policy'], ['copyright', '/policies/copyright'], ['gta', '/policies/gta-notice']];

export default function PolicyConsent({ ns = 'profile', checked, onChange, className = '' }) {
  const t = useTranslations(ns);
  const id = useId();
  return (
    <div className={`rounded-xl border border-amber-400/30 bg-amber-400/5 p-3 ${className}`}>
      <label htmlFor={id} className="flex cursor-pointer items-start gap-2.5 text-sm">
        <input id={id} type="checkbox" required className="mt-1 h-4 w-4 shrink-0 accent-[#e6cd8c]" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span>{t('consent.label')}</span>
      </label>
      <p className="mt-2 pl-6 text-xs text-muted-foreground">
        {t('consent.read')}{' '}
        {LINKS.map(([k, href], i) => (
          <span key={k}>
            <a href={href} target="_blank" rel="noopener noreferrer" className="text-[#e6cd8c] underline-offset-2 hover:underline">{t(`consent.${k}`)}</a>
            {i < LINKS.length - 1 ? ' · ' : ''}
          </span>
        ))}
      </p>
    </div>
  );
}

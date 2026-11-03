'use client';

import { useId } from 'react';
import { Loader2, RotateCcw, Save, Undo2 } from 'lucide-react';
import { btn, btnMain } from '@/components/collab/ProfileParts';

const LINKS = [['content', '/policies/content-policy'], ['copyright', '/policies/copyright'], ['miami', '/policies/miami-notice']];

/** One always-visible save bar: policy agreement + Save / Discard / Reset. */
export default function SaveBar({ t, dirty, busy, canSave = true, consent, onConsent, onSave, onDiscard, onReset, msg }) {
  const id = useId();
  const blocked = !dirty || busy || !canSave;
  return (
    <div className="sticky bottom-3 z-30 col-span-full mt-2 rounded-2xl border border-[#e6cd8c]/40 bg-background/90 p-3 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.8)] backdrop-blur-md">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="min-w-[14rem] flex-1">
          <label htmlFor={id} className="flex cursor-pointer items-start gap-2 text-sm">
            <input id={id} type="checkbox" className="mt-1 h-4 w-4 shrink-0 accent-[#e6cd8c]" checked={consent} onChange={(e) => onConsent(e.target.checked)} />
            <span>{t('consent.label')}</span>
          </label>
          <p className="mt-1 pl-6 text-xs text-muted-foreground">
            {t('consent.read')}{' '}
            {LINKS.map(([k, href], i) => (
              <span key={k}><a href={href} target="_blank" rel="noopener noreferrer" className="text-[#e6cd8c] underline-offset-2 hover:underline">{t(`consent.${k}`)}</a>{i < LINKS.length - 1 ? ' · ' : ''}</span>
            ))}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={onSave} disabled={blocked || !consent} className={`${btnMain} disabled:opacity-50`}>{busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Save className="h-4 w-4" aria-hidden="true" />}{busy ? t('saving') : t('save')}</button>
          <button type="button" onClick={onDiscard} disabled={!dirty || busy} className={`${btn} disabled:opacity-50`}><Undo2 className="h-3.5 w-3.5" aria-hidden="true" />{t('discard')}</button>
          {onReset ? <button type="button" onClick={onReset} disabled={busy} className={btn}><RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />{t('reset')}</button> : null}
        </div>
      </div>
      <p role="status" aria-live="polite" className={`mt-1.5 min-h-5 text-sm ${msg?.kind === 'err' ? 'text-red-300' : 'text-emerald-300'}`}>{msg ? msg.text : dirty ? <span className="text-amber-300">{consent ? t('unsaved') : t('consent.required')}</span> : ''}</p>
    </div>
  );
}

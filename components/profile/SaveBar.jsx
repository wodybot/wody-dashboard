'use client';

import { useEffect, useId } from 'react';
import { useTranslations } from 'next-intl';
import { Check, Loader2, RotateCcw, Save, Undo2 } from 'lucide-react';

const LINKS = [['content', '/policies/content-policy'], ['copyright', '/policies/copyright']];
const base = 'inline-flex h-10 min-w-[6.5rem] items-center justify-center gap-2 rounded-full px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-45';
const ghost = `${base} border border-border/70 bg-white/[0.03] text-foreground/90 hover:border-[#e6cd8c]/50 hover:bg-white/[0.07]`;

/** Floating save bar: only shown while there is something to save. */
export default function SaveBar({ t, dirty, busy, canSave = true, consent, onConsent, onSave, onDiscard, onReset, msg, onMsgDone }) {
  const id = useId();
  const tp = useTranslations('profile');
  useEffect(() => {
    if (!msg || msg.kind !== 'ok' || dirty || !onMsgDone) return undefined;
    const h = setTimeout(onMsgDone, 2600);
    return () => clearTimeout(h);
  }, [msg, dirty, onMsgDone]);
  if (!dirty && !msg) return null;
  if (!dirty) {
    return (
      <div className="sticky bottom-4 z-30 col-span-full flex justify-center" role="status" aria-live="polite">
        <span className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold shadow-lg backdrop-blur-md ${msg.kind === 'err' ? 'border-red-400/50 bg-red-950/80 text-red-200' : 'border-emerald-400/50 bg-emerald-950/80 text-emerald-200'}`}>{msg.kind === 'err' ? null : <Check className="h-4 w-4" aria-hidden="true" />}{msg.text}</span>
      </div>
    );
  }
  return (
    <div className="sticky bottom-4 z-30 col-span-full flex justify-center px-1">
      <div className="flex w-full max-w-3xl flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-2xl border border-[#e6cd8c]/40 bg-background/95 px-3 py-2.5 shadow-[0_12px_40px_-8px_rgba(0,0,0,0.85)] backdrop-blur-md">
        <label htmlFor={id} className="flex min-w-0 cursor-pointer items-center gap-2 text-xs">
          <input id={id} type="checkbox" className="h-4 w-4 shrink-0 accent-[#e6cd8c]" checked={consent} onChange={(e) => onConsent(e.target.checked)} />
          <span className="min-w-0">
            {tp('saveBar.agree')}{' '}
            {LINKS.map(([k, href], i) => (
              <span key={k}><a href={href} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-[#e6cd8c] underline-offset-2 hover:underline">{tp(`consent.${k}`)}</a>{i < LINKS.length - 1 ? ' · ' : ''}</span>
            ))}
          </span>
        </label>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {msg?.kind === 'err' ? <span role="alert" className="mr-1 text-xs text-red-300">{msg.text}</span> : null}
          {onReset ? <button type="button" onClick={onReset} disabled={busy} className={ghost}><RotateCcw className="h-4 w-4" aria-hidden="true" />{t('reset')}</button> : null}
          <button type="button" onClick={onDiscard} disabled={busy} className={ghost}><Undo2 className="h-4 w-4" aria-hidden="true" />{t('discard')}</button>
          <button type="button" onClick={onSave} disabled={busy || !canSave || !consent} className={`${base} bg-gradient-to-b from-[#f0dba4] to-[#e6cd8c] font-bold text-[#1b1204] shadow-[0_6px_20px_-8px_#e6cd8c] hover:brightness-105`}>{busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Save className="h-4 w-4" aria-hidden="true" />}{busy ? t('saving') : t('save')}</button>
        </div>
      </div>
    </div>
  );
}

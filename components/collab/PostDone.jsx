'use client';
import { useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { CheckCircle2, Clock, ShieldAlert, Copy, Check, ExternalLink } from 'lucide-react';
import { btn, btnMain } from './ui';

const TARGETS = [
  { key: 'discord', label: 'Discord', cls: 'border-[#5865F2]/45 bg-[#5865F2]/15 text-[#c9d0ff]', href: () => 'https://discord.com/channels/@me' },
  { key: 'instagram', label: 'Instagram', cls: 'border-[#E4405F]/40 bg-[#E4405F]/10 text-[#ffb3c1]', href: () => 'https://www.instagram.com/' },
  { key: 'whatsapp', label: 'WhatsApp', cls: 'border-[#25D366]/40 bg-[#25D366]/10 text-[#9af0bb]', href: (u, x) => `https://wa.me/?text=${encodeURIComponent(`${x} ${u}`)}` },
  { key: 'telegram', label: 'Telegram', cls: 'border-[#27A7E7]/40 bg-[#27A7E7]/10 text-[#a6dcf7]', href: (u, x) => `https://t.me/share/url?url=${encodeURIComponent(u)}&text=${encodeURIComponent(x)}` },
  { key: 'x', label: 'X', cls: 'border-border/70 bg-card/60', href: (u, x) => `https://twitter.com/intent/tweet?url=${encodeURIComponent(u)}&text=${encodeURIComponent(x)}` },
  { key: 'facebook', label: 'Facebook', cls: 'border-[#1877F2]/40 bg-[#1877F2]/10 text-[#b3d1ff]', href: (u) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(u)}` },
];

const TONES = {
  published: { Icon: CheckCircle2, box: 'border-emerald-400/40 bg-emerald-400/10', text: 'text-emerald-300' },
  pending_review: { Icon: ShieldAlert, box: 'border-amber-400/40 bg-amber-400/10', text: 'text-amber-300' },
  pending_server: { Icon: Clock, box: 'border-sky-400/40 bg-sky-400/10', text: 'text-sky-300' },
};

export default function PostDone({ id, title, outcome, onNew, onClose }) {
  const t = useTranslations('collab');
  const locale = useLocale();
  const [copied, setCopied] = useState(false);
  const [origin, setOrigin] = useState('');
  const field = useRef(null);
  useEffect(() => { setOrigin(window.location.origin); }, []);
  const tone = TONES[outcome] || TONES.published;
  const Icon = tone.Icon;
  const url = origin ? `${origin}/${locale}/collab/${id}` : '';
  const live = outcome === 'published';
  async function copy() {
    try { await navigator.clipboard.writeText(url); } catch { field.current?.select(); try { document.execCommand('copy'); } catch { } }
    setCopied(true); setTimeout(() => setCopied(false), 2500);
  }
  async function open(tg) {
    if (tg.key === 'discord' || tg.key === 'instagram') await copy();
    window.open(tg.href(url, title || ''), '_blank', 'noopener,noreferrer');
  }
  return (
    <div className="space-y-4" data-outcome={outcome}>
      <div role="status" className={`rounded-2xl border p-4 ${tone.box}`}>
        <div className="flex items-start gap-3">
          <Icon className={`mt-0.5 h-6 w-6 shrink-0 ${tone.text}`} aria-hidden="true" />
          <div className="min-w-0">
            <p className={`text-base font-bold ${tone.text}`}>{t(`done.${outcome}.title`)}</p>
            <p className="mt-1 text-sm text-foreground/90">{t(`done.${outcome}.text`)}</p>
            {title && <p className="mt-2 break-words text-xs text-muted-foreground">{title}</p>}
          </div>
        </div>
      </div>
      <div className="rounded-2xl border border-border/60 bg-card/50 p-4">
        <p className="text-sm font-semibold">{t('done.shareTitle')}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{live ? t('done.shareLive') : t('done.shareLater')}</p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <label className="sr-only" htmlFor="pd-link">{t('done.link')}</label>
          <input id="pd-link" ref={field} readOnly value={url} onFocus={(e) => e.target.select()} className="w-full min-w-0 rounded-lg border border-input bg-background px-3 py-2 text-sm" />
          <button type="button" onClick={copy} className={`${btnMain} justify-center`}>{copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}{copied ? t('done.copied') : t('done.copy')}</button>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {TARGETS.map((tg) => (
            <button key={tg.key} type="button" onClick={() => open(tg)} disabled={!url} className={`inline-flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition hover:brightness-125 disabled:opacity-50 ${tg.cls}`}>
              {tg.label}<ExternalLink className="h-3 w-3 opacity-70" aria-hidden="true" />
            </button>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">{t('done.discordNote')}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={btn} onClick={onNew}>{t('done.another')}</button>
        <button type="button" className={btn} onClick={onClose}>{t('done.back')}</button>
      </div>
    </div>
  );
}

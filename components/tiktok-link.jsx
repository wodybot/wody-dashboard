'use client';
import { useCallback, useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, Eye, Heart, Link2, Loader2, LogIn, RefreshCw, ShieldCheck, Unlink, Video, Lock } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { proxiedImageUrl } from '@/lib/utils';

const btn = 'inline-flex items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold transition disabled:opacity-60';
const main = `${btn} bg-[#e6cd8c] text-[#1a1208] hover:bg-[#f3e1b0]`;
const ghost = `${btn} border border-border/70 hover:bg-secondary/60`;

function Fact({ icon: Icon, title, text }) {
  return (
    <li className="flex gap-3 rounded-2xl border border-border/60 bg-card/50 p-4">
      <Icon className="mt-0.5 h-5 w-5 shrink-0 text-[#e6cd8c]" aria-hidden="true" />
      <div><p className="text-sm font-semibold">{title}</p><p className="mt-1 text-sm text-muted-foreground">{text}</p></div>
    </li>
  );
}

export default function TikTokLink() {
  const t = useTranslations('tiktokLink');
  const locale = useLocale();
  const params = useSearchParams();
  const result = params.get('tiktok');
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/tiktok-link', { cache: 'no-store', credentials: 'same-origin' });
      setData(await r.json());
    } catch { setData({ error: 'network' }); }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function connect() {
    setBusy(true); setMsg('');
    try {
      const r = await fetch('/api/tiktok-link', { method: 'POST', credentials: 'same-origin' });
      const d = await r.json();
      if (r.ok && d.url) { window.location.assign(d.url); return; }
      setMsg(t(d.error === 'provider_unavailable' ? 'unavailable' : d.error === 'rate_limited' ? 'rateLimited' : 'failed'));
    } catch { setMsg(t('failed')); }
    setBusy(false);
  }
  async function disconnect() {
    setBusy(true); setMsg('');
    try {
      const r = await fetch('/api/tiktok-link', { method: 'DELETE', credentials: 'same-origin' });
      if (!r.ok) throw new Error('x');
      setMsg(t('disconnected'));
      await load();
    } catch { setMsg(t('failed')); }
    setBusy(false);
  }

  const note = result && ['connected', 'denied', 'invalid', 'expired', 'failed', 'unavailable'].includes(result) ? t(`result.${result}`) : '';
  const fmt = new Intl.NumberFormat(locale, { notation: 'compact' });
  const date = (s) => (s ? new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(s * 1000)) : '');

  return (
    <div>
      <header className="text-center">
        <p className="inline-flex items-center gap-2 rounded-full border border-[#e6cd8c]/40 bg-[#e6cd8c]/10 px-3 py-1 text-xs font-medium text-[#e6cd8c]"><Video className="h-3.5 w-3.5" aria-hidden="true" />{t('badge')}</p>
        <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">{t('title')}</h1>
        <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">{t('lead')}</p>
      </header>

      {note && <p role="status" className="mx-auto mt-6 max-w-xl rounded-xl border border-border/70 bg-card/60 px-4 py-3 text-center text-sm">{note}</p>}
      {msg && <p role="status" className="mx-auto mt-4 max-w-xl text-center text-sm text-muted-foreground">{msg}</p>}

      <section className="mx-auto mt-8 max-w-2xl rounded-3xl border border-border/60 bg-card/60 p-6 sm:p-8" aria-live="polite">
        {!data ? (
          <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />{t('loading')}</p>
        ) : data.error ? (
          <div className="text-center"><p className="text-sm text-muted-foreground">{t('failed')}</p><button type="button" onClick={load} className={`${ghost} mt-4`}><RefreshCw className="h-4 w-4" aria-hidden="true" />{t('retry')}</button></div>
        ) : !data.signed_in ? (
          <div className="text-center">
            <p className="text-sm text-muted-foreground">{t('signInText')}</p>
            <a href={`/api/auth/login?next=${encodeURIComponent('/tiktok')}`} className={`${main} mt-5`}><LogIn className="h-4 w-4" aria-hidden="true" />{t('signIn')}</a>
          </div>
        ) : !data.connected ? (
          <div className="text-center">
            <p className="text-sm text-muted-foreground">{t('connectText')}</p>
            <button type="button" onClick={connect} disabled={busy || !data.available} className={`${main} mt-5`}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Link2 className="h-4 w-4" aria-hidden="true" />}{t('connect')}
            </button>
            {!data.available && <p className="mt-3 text-xs text-muted-foreground">{t('unavailable')}</p>}
          </div>
        ) : (
          <div>
            <div className="flex flex-wrap items-center gap-4">
              {data.profile?.avatar ? <img src={proxiedImageUrl(data.profile.avatar)} alt="" width={64} height={64} className="h-16 w-16 rounded-full border border-border object-cover" /> : <span className="flex h-16 w-16 items-center justify-center rounded-full border border-border bg-secondary"><Video className="h-6 w-6" aria-hidden="true" /></span>}
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 truncate text-lg font-semibold"><CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" aria-hidden="true" />{data.profile?.name || data.profile?.username}</p>
                {data.profile?.username && <p className="truncate text-sm text-muted-foreground">@{data.profile.username}</p>}
              </div>
              <button type="button" onClick={disconnect} disabled={busy} className={ghost}><Unlink className="h-4 w-4" aria-hidden="true" />{t('disconnect')}</button>
            </div>
            {data.state === 'expired' && (
              <div className="mt-5 rounded-xl border border-amber-400/40 bg-amber-400/10 p-4 text-sm">
                <p>{t('expired')}</p>
                <button type="button" onClick={connect} disabled={busy} className={`${main} mt-3`}><Link2 className="h-4 w-4" aria-hidden="true" />{t('reconnect')}</button>
              </div>
            )}
            {data.state === 'unreachable' && <p className="mt-5 text-sm text-muted-foreground">{t('unreachable')}</p>}
            {data.state === 'ok' && (
              <div className="mt-6">
                <h2 className="text-base font-semibold">{t('latest')}</h2>
                {data.videos?.length ? (
                  <ul className="mt-3 grid gap-3 sm:grid-cols-2">
                    {data.videos.map((v) => (
                      <li key={v.id} className="overflow-hidden rounded-2xl border border-border/60 bg-background/40">
                        {v.cover ? <img src={proxiedImageUrl(v.cover)} alt="" loading="lazy" className="aspect-[9/12] w-full object-cover" /> : <div className="aspect-[9/12] w-full bg-secondary" />}
                        <div className="p-3">
                          <p className="line-clamp-2 text-sm">{v.title || t('untitled')}</p>
                          <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                            <span>{date(v.created)}</span>
                            <span className="inline-flex items-center gap-1"><Eye className="h-3.5 w-3.5" aria-hidden="true" />{fmt.format(v.views)}</span>
                            <span className="inline-flex items-center gap-1"><Heart className="h-3.5 w-3.5" aria-hidden="true" />{fmt.format(v.likes)}</span>
                          </p>
                          {v.url && <a href={v.url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-xs underline underline-offset-4">{t('open')}</a>}
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : <p className="mt-3 text-sm text-muted-foreground">{t('noVideos')}</p>}
              </div>
            )}
          </div>
        )}
      </section>

      <ul className="mx-auto mt-8 grid max-w-3xl gap-3 sm:grid-cols-3">
        <Fact icon={ShieldCheck} title={t('f1Title')} text={t('f1Text')} />
        <Fact icon={Lock} title={t('f2Title')} text={t('f2Text')} />
        <Fact icon={Unlink} title={t('f3Title')} text={t('f3Text')} />
      </ul>
      <p className="mt-8 text-center text-xs text-muted-foreground">
        <Link href="/privacy" className="underline underline-offset-4">{t('privacy')}</Link> · <Link href="/terms" className="underline underline-offset-4">{t('terms')}</Link> · <Link href="/cookies" className="underline underline-offset-4">{t('cookies')}</Link>
      </p>
    </div>
  );
}

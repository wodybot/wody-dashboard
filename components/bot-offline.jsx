'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { WifiOff } from 'lucide-react';
import { Card } from '@/components/ui/card';

const POLL_MS = 20_000;

const BotStatusContext = createContext({ state: 'checking', lastHeartbeat: null });

export function useBotStatusPoll() {
  const [status, setStatus] = useState({ state: 'checking', lastHeartbeat: null });
  const alive = useRef(true);
  const inflight = useRef(0);

  const load = useCallback(async () => {
    const id = ++inflight.current;
    try {
      const res = await fetch('/api/status/bot', { cache: 'no-store' });
      if (!res.ok) throw new Error(String(res.status));
      const d = await res.json();
      if (!alive.current || id !== inflight.current) return;
      setStatus({ state: d?.online ? 'online' : 'offline', lastHeartbeat: d?.last_heartbeat || null });
    } catch {
      if (!alive.current || id !== inflight.current) return;
      setStatus((prev) => (prev.state === 'checking' ? { state: 'unknown', lastHeartbeat: null } : prev));
    }
  }, []);

  useEffect(() => {
    alive.current = true;
    load();
    const tick = setInterval(() => { if (document.visibilityState === 'visible') load(); }, POLL_MS);
    const onVisible = () => { if (document.visibilityState === 'visible') load(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      alive.current = false;
      clearInterval(tick);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [load]);

  return status;
}

export function BotStatusProvider({ value, children }) {
  const memo = useMemo(() => value, [value]);
  return <BotStatusContext.Provider value={memo}>{children}</BotStatusContext.Provider>;
}

export function useBotStatus() {
  const ctx = useContext(BotStatusContext);
  return { ...ctx, offline: ctx.state === 'offline' };
}

function relativeTime(iso, locale) {
  if (!iso) return null;
  const ms = new Date(iso).getTime();
  if (!Number.isFinite(ms)) return null;
  const sec = Math.round((ms - Date.now()) / 1000);
  const abs = Math.abs(sec);
  try {
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
    if (abs < 3600) return rtf.format(Math.round(sec / 60), 'minute');
    if (abs < 86400) return rtf.format(Math.round(sec / 3600), 'hour');
    return rtf.format(Math.round(sec / 86400), 'day');
  } catch { return null; }
}

export function BotOfflineBanner() {
  const t = useTranslations('guildSettings.common');
  const locale = useLocale();
  const { offline, lastHeartbeat } = useBotStatus();
  if (!offline) return null;
  const seen = relativeTime(lastHeartbeat, locale);
  return (
    <Card role="status" data-testid="bot-offline-banner" className="mb-5 flex items-start gap-3.5 border-amber-400/25 bg-gradient-to-r from-amber-400/[0.07] to-card/40 p-4 sm:p-5">
      <span className="relative mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-amber-400/25 bg-amber-400/10 text-amber-300" aria-hidden="true">
        <WifiOff className="h-[18px] w-[18px]" />
      </span>
      <div className="min-w-0 text-sm">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <span className="font-semibold text-foreground">{t('botOfflineTitle')}</span>
          {seen && <span className="rounded-full border border-border/70 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">{t('botOfflineSeen', { time: seen })}</span>}
        </div>
        <p className="mt-1.5 leading-relaxed text-muted-foreground">{t('botOfflineText')}</p>
      </div>
    </Card>
  );
}

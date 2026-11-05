'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocale, useTranslations } from 'next-intl';
import { Bell, Briefcase, Check, Compass, Crown, Gift, IdCard, Loader2, Server, ShieldCheck } from 'lucide-react';
import { useRouter } from '@/i18n/navigation';
import { Tip } from '@/components/tip';

const POLL_MS = 60_000;
export const NOTIFICATIONS_REFRESH = 'wody:notifications-refresh';

const SOURCES = {
  collab: Briefcase, community: Compass, premium: Crown, bot: Server, giveaway: Gift, passport: IdCard, staff: ShieldCheck,
};
const LABEL = { bot: 'server' };
const SOURCE_ALIAS = { marketplace: 'collab' };
const sourceOf = (type) => {
  const raw = String(type).split('_')[0];
  const key = SOURCE_ALIAS[raw] || raw;
  return SOURCES[key] ? key : 'bot';
};

async function api(path, init) {
  try {
    const res = await fetch(`/api/notifications${path}`, { cache: 'no-store', ...init });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  } catch {
    return { ok: false, status: 0, data: {} };
  }
}

function ago(iso, locale) {
  const ms = new Date(iso).getTime() - Date.now();
  if (!Number.isFinite(ms)) return '';
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  const abs = Math.abs(ms);
  if (abs < 60_000) return rtf.format(0, 'minute');
  if (abs < 3_600_000) return rtf.format(Math.round(ms / 60_000), 'minute');
  if (abs < 86_400_000) return rtf.format(Math.round(ms / 3_600_000), 'hour');
  if (abs < 30 * 86_400_000) return rtf.format(Math.round(ms / 86_400_000), 'day');
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(iso));
}

export default function NotificationBell({ className = '', buttonClassName = '' }) {
  const t = useTranslations('bell');
  const locale = useLocale();
  const router = useRouter();
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [state, setState] = useState({ loading: false, error: false, items: null });
  const [enabled, setEnabled] = useState(true);
  const wrap = useRef(null);
  const panel = useRef(null);
  const [pos, setPos] = useState(null);
  const button = useRef(null);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  const poll = useCallback(async (force = false) => {
    if (!enabled || (!force && document.visibilityState === 'hidden')) return;
    const r = await api('?summary=1');
    if (!alive.current) return;
    if (r.status === 401) { setEnabled(false); return; }
    if (r.ok) setUnread(Number(r.data.unread) || 0);
  }, [enabled]);

  const loadList = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: false }));
    const r = await api('');
    if (!alive.current) return;
    if (r.status === 401) { setEnabled(false); setOpen(false); return; }
    if (!r.ok) { setState({ loading: false, error: true, items: null }); return; }
    setUnread(Number(r.data.unread) || 0);
    setState({ loading: false, error: false, items: Array.isArray(r.data.items) ? r.data.items : [] });
  }, []);

  useEffect(() => {
    if (!enabled) return undefined;
    poll(true);
    const timer = setInterval(() => poll(), POLL_MS);
    const onVisible = () => { if (document.visibilityState === 'visible') poll(); };
    const onRefresh = () => { poll(true); if (open) loadList(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    window.addEventListener(NOTIFICATIONS_REFRESH, onRefresh);
    window.addEventListener('wody:community-changed', onRefresh);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
      window.removeEventListener(NOTIFICATIONS_REFRESH, onRefresh);
      window.removeEventListener('wody:community-changed', onRefresh);
    };
  }, [enabled, poll, open, loadList]);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (wrap.current && !wrap.current.contains(e.target) && !(panel.current && panel.current.contains(e.target))) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') { setOpen(false); button.current?.focus(); } };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown, { passive: true });
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const place = () => {
      const r = button.current?.getBoundingClientRect();
      if (!r) return;
      const vw = window.innerWidth;
      const width = Math.min(400, vw - 24);
      const left = Math.min(Math.max(12, r.right - width), vw - width - 12);
      setPos({ top: Math.round(r.bottom + 8), left: Math.round(left), width });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true); };
  }, [open]);

  if (!enabled) return null;

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next) loadList();
  };

  const markOne = async (item) => {
    if (item.read || item.src === 's') return;
    setState((s) => ({ ...s, items: (s.items || []).map((x) => (x.id === item.id ? { ...x, read: true } : x)) }));
    setUnread((n) => Math.max(0, n - 1));
    await api('/read', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: [item.id] }) });
  };
  const markAll = async () => {
    setState((s) => ({ ...s, items: (s.items || []).map((x) => (x.src === 's' ? x : { ...x, read: true })) }));
    const staff = (state.items || []).filter((x) => x.src === 's').length;
    setUnread(staff);
    await api('/read', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ all: true }) });
  };
  const openItem = async (item) => {
    await markOne(item);
    if (item.url) { setOpen(false); router.push(item.url); }
  };

  const text = (item) => {
    const key = `types.${item.type}`;
    if (!t.has(key)) return t('title');
    const params = { ...item.params };
    if (typeof params.until === 'number' && params.until < 1e12) params.until *= 1000;
    return t(key, params);
  };

  const badge = unread > 99 ? '99+' : String(unread);
  const items = state.items || [];
  const hasUnreadStored = items.some((x) => !x.read && x.src !== 's');

  return (
    <div ref={wrap} className={`relative ${className}`}>
      <Tip label={t('title')}>
      <button
        ref={button}
        type="button"
        onClick={toggle}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={unread ? t('open', { count: unread }) : t('openNone')}
        className={`relative inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border/60 bg-card/40 transition-colors hover:border-border hover:bg-card/80 ${buttonClassName}`}
      >
        <Bell className="h-4 w-4" aria-hidden="true" />
        {unread > 0 && (
          <span aria-hidden="true" className="absolute -right-1.5 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-background">{badge}</span>
        )}
      </button>
      </Tip>
      {open && pos && typeof document !== 'undefined' && createPortal(
        <div ref={panel} role="dialog" aria-label={t('title')} style={{ top: pos.top, left: pos.left, width: pos.width }} className="fixed z-[70] flex max-h-[min(75vh,34rem)] flex-col overflow-hidden rounded-2xl border border-border bg-popover text-popover-foreground shadow-2xl">
          <div className="flex items-center justify-between gap-2 border-b border-border/60 px-4 py-3">
            <p className="text-sm font-semibold">{t('title')}</p>
            {hasUnreadStored && (
              <button type="button" onClick={markAll} className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-[#e6cd8c] transition-colors hover:bg-secondary/60">
                <Check className="h-3.5 w-3.5" aria-hidden="true" />{t('markAll')}
              </button>
            )}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            {state.loading && !state.items && (
              <div role="status" className="flex items-center justify-center gap-2 p-8 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /></div>
            )}
            {state.error && (
              <div role="alert" className="p-6 text-center text-sm text-muted-foreground">
                <p>{t('error')}</p>
                <button type="button" onClick={loadList} className="mt-2 text-xs font-medium text-[#e6cd8c] underline underline-offset-4">{t('retry')}</button>
              </div>
            )}
            {!state.error && state.items && items.length === 0 && (
              <div className="flex flex-col items-center gap-1 p-8 text-center">
                <Bell className="mb-1 h-6 w-6 text-muted-foreground/60" aria-hidden="true" />
                <p className="text-sm font-medium">{t('empty')}</p>
                <p className="text-xs text-muted-foreground">{t('emptyText')}</p>
              </div>
            )}
            {items.length > 0 && (
              <ul>
                {items.map((item) => {
                  const src = sourceOf(item.type);
                  const Icon = SOURCES[src];
                  const body = (
                    <>
                      <span className={`mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${item.read ? 'border-border/60 bg-card/40 text-muted-foreground' : 'border-[#e6cd8c]/40 bg-[#e6cd8c]/10 text-[#f3e1b0]'}`}><Icon className="h-4 w-4" aria-hidden="true" /></span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{t(`src.${LABEL[src] || src}`)}{item.src === 's' ? '' : ` · ${ago(item.at, locale)}`}</span>
                        <span className={`mt-0.5 block break-words text-sm leading-snug ${item.read ? 'text-muted-foreground' : 'font-medium'}`}>{text(item)}</span>
                      </span>
                      {!item.read && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[#e6cd8c]" role="img" aria-label={t('unread')} />}
                    </>
                  );
                  return (
                    <li key={item.id} className="border-b border-border/40 last:border-0">
                      <button type="button" onClick={() => openItem(item)} className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-secondary/50 focus-visible:bg-secondary/50 focus-visible:outline-none">{body}</button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

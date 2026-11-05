'use client';
// Building blocks of the GIF Preview Studio. Every symbol is a Wody custom emoji drawn by WodyIcon (no Unicode emoji, no icon font).
import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import WodyIcon from '@/components/wody-icon';

/** Calls /api/gifstudio/<path>. Never throws: { ok, status, data }. */
export async function gs(path, { method = 'GET', body } = {}) {
  try {
    const res = await fetch(`/api/gifstudio/${path}`, { method, headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  } catch { return { ok: false, status: 0, data: { error: 'unreachable' } }; }
}

/** An icon component for ModuleTabs, which expects a component and passes it a className. */
export const ic = (name, size = 16) => function TabIcon() { return <WodyIcon name={name} size={size} />; };

export function useErrText() {
  const t = useTranslations('gifStudio.ui');
  return (code) => {
    const c = String(code || 'generic');
    return t.has(`err.${c}`) ? t(`err.${c}`) : t('err.generic');
  };
}

export const STATUS_TONE = {
  draft: 'bg-zinc-500/15 text-zinc-300 border-zinc-500/30', generating: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
  ready: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30', published: 'bg-green-500/15 text-green-300 border-green-500/30',
  scheduled: 'bg-amber-500/15 text-amber-300 border-amber-500/30', archived: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
  failed: 'bg-red-500/15 text-red-300 border-red-500/30',
};

export function StatusBadge({ status }) {
  const t = useTranslations('gifStudio.ui');
  return (
    <Badge variant="outline" className={`gap-1.5 text-[11px] ${STATUS_TONE[status] || ''}`}>
      <WodyIcon name={status} size={14} />{t(`status.${status}`)}
    </Badge>
  );
}

export const fmtBytes = (n) => (n >= 1048576 ? `${(n / 1048576).toFixed(2)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
export const fmtMs = (ms) => `${(ms / 1000).toFixed(1)} s`;

'use client';
import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { AlertTriangle, Hash, Shield, Wrench } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { safeJson } from '@/components/dashboard-kit';
import { channelOf, cleanPerms, errorKind, titleKey } from '@/lib/error-log';

// Every entry says, in the reader's language: what went wrong, which permissions Wody lacks (by their Discord name) and where, and
// how to fix it. The bot's own sentence stays underneath as the technical detail.
export default function ErrorLog({ guildId, meta }) {
  const t = useTranslations('guildSettings.common.errorLog');
  const tm = useTranslations('modules');
  const locale = useLocale();
  const [errors, setErrors] = useState(null);
  useEffect(() => { safeJson(`/api/guilds/${guildId}/errors`, null).then((d) => setErrors(d?.errors || [])); }, [guildId]);
  if (errors === null) return null;

  const channels = new Map((meta?.channels || []).map((c) => [String(c.id), c.name]));
  const roles = new Map((meta?.roles || []).map((r) => [String(r.id), r.name]));
  const moduleName = (key) => (key && tm.has(`${key}.title`) ? tm(`${key}.title`) : String(key || 'Wody').replace(/_/g, ' '));
  const title = (code) => { const k = titleKey(code, t.has); return k ? t(k) : t('fallback'); };
  const channelLabel = (id) => (id ? (channels.has(id) ? `#${channels.get(id)}` : t('unknownChannel')) : null);
  const roleLabel = (id) => (id ? (roles.has(id) ? `@${roles.get(id)}` : t('unknownRole')) : null);
  const when = (iso) => { try { return new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeStyle: 'medium' }).format(new Date(iso)); } catch { return ''; } };

  return (
    <Card className="p-6 bg-card/60 mb-10">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <div className="font-semibold flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-amber-500" />{t('title')}</div>
          <p className="text-xs text-muted-foreground mt-1">{t('intro')}</p>
        </div>
        <Badge variant="secondary">{errors.length}</Badge>
      </div>
      {!errors.length ? (
        <div className="rounded-xl border border-dashed border-border/70 bg-secondary/10 p-5">
          <div className="font-medium text-sm">{t('emptyTitle')}</div>
          <p className="text-xs text-muted-foreground mt-1">{t('emptyText')}</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {errors.map((e) => {
            const kind = errorKind(e.code);
            const perms = cleanPerms(e.perms);
            const channelId = channelOf(e);
            const channel = channelLabel(channelId);
            const role = roleLabel(e.role_id ? String(e.role_id) : null);
            const fix = kind === 'permissions' || perms.length
              ? (channel ? t('fixPermissionsChannel', { channel }) : t('fixPermissionsServer'))
              : kind === 'role_order' ? t('fixRoleOrder', { role: role || t('theRole') }) : null;
            return (
              <li key={e._id} className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
                <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" aria-hidden="true" />
                    <span className="font-medium text-sm break-words">{moduleName(e.module)}: {title(e.code)}</span>
                  </div>
                  <span className="text-[11px] text-muted-foreground shrink-0">{e.created_at ? when(e.created_at) : ''}</span>
                </div>
                <p className="text-sm mt-2 leading-relaxed">{t(`help.${kind}`)}</p>
                {perms.length > 0 && (
                  <div className="mt-3">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5"><Shield className="w-3.5 h-3.5" aria-hidden="true" />{t('missingLabel')}</div>
                    <ul className="mt-1.5 flex flex-wrap gap-1.5">
                      {perms.map((p) => <li key={p} className="rounded-md border border-red-400/40 bg-red-500/10 px-2 py-0.5 text-xs font-semibold text-red-200">{t(`perms.${p}`)}</li>)}
                    </ul>
                  </div>
                )}
                {(channel || role || kind === 'permissions') && (
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    {channel ? <span className="inline-flex items-center gap-1"><Hash className="w-3.5 h-3.5" aria-hidden="true" />{t('whereChannel', { channel })}</span> : (kind === 'permissions' && perms.length > 0 ? <span>{t('whereServer')}</span> : null)}
                    {role ? <span>{t('whereRole', { role })}</span> : null}
                  </div>
                )}
                {fix && <p className="mt-2 text-xs leading-relaxed text-[#e6cd8c] flex gap-1.5"><Wrench className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden="true" /><span>{fix}</span></p>}
                {e.detail ? (
                  <p className="mt-2 text-[11px] text-muted-foreground/80 whitespace-pre-wrap break-words"><span className="font-semibold">{t('detailLabel')}:</span> {String(e.detail).replace(/<#(\d{15,25})>/g, (_, id) => channelLabel(id))}</p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

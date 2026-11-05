'use client';
import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { ArrowDown, ArrowUp, Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ConfirmDialog, LoadingOrError, NativeSelect } from '@/components/module-kit';
import { cfetch, useCApi } from '@/components/community/client';
import { catalogName } from '@/lib/community/names';
import { routing } from '@/i18n/routing';

export function CatalogManager({ kind }) {
  const t = useTranslations('community');
  const locale = useLocale();
  const api = useCApi(`admin/catalog/${kind}`);
  const [edit, setEdit] = useState(null);
  const [del, setDel] = useState(null);
  const items = api.data?.items || [];
  const parents = items.filter((i) => !i.parent);
  const reorder = async (list, from, to) => {
    if (to < 0 || to >= list.length) return;
    const next = [...list]; const [it] = next.splice(from, 1); next.splice(to, 0, it);
    const r = await cfetch(`admin/catalog/${kind}/reorder`, { method: 'POST', body: { ids: next.map((x) => x.id) } });
    if (r.ok) api.reload(); else toast.error(t('errors.generic'));
  };
  const toggle = async (item) => { const r = await cfetch(`admin/catalog/${kind}/${item.id}`, { method: 'PATCH', body: { enabled: !item.enabled } }); if (r.ok) api.reload(); else toast.error(t('errors.generic')); };
  const remove = async () => {
    const r = await cfetch(`admin/catalog/${kind}/${del.id}`, { method: 'DELETE' });
    setDel(null);
    if (r.ok) { toast.success(t('admin.done')); api.reload(); } else toast.error(r.data?.error === 'in_use' ? t('errors.in_use') : t('errors.generic'));
  };
  const rows = kind === 'categories' ? [...parents.flatMap((p) => [p, ...items.filter((c) => c.parent === p.slug)])] : items;
  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3"><p className="text-sm text-muted-foreground">{t(`admin.catalog.${kind}Text`)}</p><Button onClick={() => setEdit({})} className="gap-2"><Plus className="h-4 w-4" />{t('admin.catalog.add')}</Button></div>
      <LoadingOrError loading={api.loading} error={api.error} data={api.data} onRetry={api.reload}>
        <Card className="divide-y divide-border/50">
          {rows.map((it, i) => {
            const group = kind === 'categories' ? items.filter((x) => (x.parent || null) === (it.parent || null)) : items;
            const idx = group.indexOf(it);
            return (
              <div key={it.id} className={`flex flex-wrap items-center gap-3 px-4 py-2.5 ${it.parent ? 'pl-10' : ''}`}>
                <div className="min-w-0 flex-1"><div className="truncate text-sm font-medium">{catalogName(t, kind, it, locale)}</div><div className="font-mono text-xs text-muted-foreground">{it.slug}{it.seo_slug ? ` · ${it.seo_slug}` : ''}</div></div>
                <div className="flex items-center gap-1">
                  <Button size="icon" variant="ghost" onClick={() => reorder(group, idx, idx - 1)} disabled={idx <= 0} aria-label={t('common.moveUp')}><ArrowUp className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => reorder(group, idx, idx + 1)} disabled={idx >= group.length - 1} aria-label={t('common.moveDown')}><ArrowDown className="h-4 w-4" /></Button>
                  <Switch checked={it.enabled} onCheckedChange={() => toggle(it)} aria-label={t('admin.catalog.enabled')} />
                  <Button size="icon" variant="ghost" onClick={() => setEdit(it)} aria-label={t('common.edit')}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => setDel(it)} aria-label={t('common.remove')}><Trash2 className="h-4 w-4 text-red-400" /></Button>
                </div>
              </div>
            );
          })}
        </Card>
      </LoadingOrError>
      {edit ? <CatalogDialog kind={kind} item={edit} parents={parents} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); api.reload(); }} /> : null}
      <ConfirmDialog open={Boolean(del)} onOpenChange={(o) => !o && setDel(null)} title={t('admin.catalog.deleteTitle')} description={t('admin.catalog.deleteText')} confirmLabel={t('common.remove')} onConfirm={remove} />
    </div>
  );
}

function NamesFields({ names, setNames, locale }) {
  const t = useTranslations('community');
  return (
    <fieldset className="space-y-2"><legend className="mb-1 text-sm font-medium">{t('admin.catalog.names')}</legend>
      <div className="grid gap-2 sm:grid-cols-2">{routing.locales.map((l) => (
        <div key={l}><label htmlFor={`n-${l}`} className="mb-0.5 block text-xs uppercase text-muted-foreground">{l}</label><Input id={`n-${l}`} value={names[l] || ''} maxLength={60} onChange={(e) => setNames({ ...names, [l]: e.target.value })} /></div>
      ))}</div>
    </fieldset>
  );
}

function CatalogDialog({ kind, item, parents, onClose, onSaved }) {
  const t = useTranslations('community');
  const locale = useLocale();
  const isNew = !item.id;
  const [slug, setSlug] = useState(item.slug || '');
  const [names, setNames] = useState(item.names || {});
  const [parent, setParent] = useState(item.parent || '');
  const [seo, setSeo] = useState(item.seo_slug || '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const save = async () => {
    setBusy(true); setErr('');
    const body = isNew ? { slug, names, parent: parent || null, seo_slug: seo || slug } : { names, seo_slug: seo };
    const r = await cfetch(isNew ? `admin/catalog/${kind}` : `admin/catalog/${kind}/${item.id}`, { method: isNew ? 'POST' : 'PATCH', body });
    setBusy(false);
    if (r.ok) { toast.success(t('admin.done')); onSaved(); } else setErr(r.data?.errors?.[0] ? t(`errors.${r.data.errors[0].code}`) : t.has(`errors.${r.data?.error}`) ? t(`errors.${r.data.error}`) : t('errors.generic'));
  };
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader><DialogTitle>{isNew ? t('admin.catalog.add') : t('admin.catalog.edit')}</DialogTitle><DialogDescription>{t('admin.catalog.dialogText')}</DialogDescription></DialogHeader>
        <div className="space-y-3">
          <div><label htmlFor="slug" className="mb-1 block text-sm">{t('admin.catalog.slug')}</label><Input id="slug" value={slug} disabled={!isNew} onChange={(e) => setSlug(e.target.value.toLowerCase())} className="font-mono" /></div>
          {kind === 'categories' && isNew ? <div><label className="mb-1 block text-sm">{t('admin.catalog.parent')}</label><NativeSelect value={parent} onChange={setParent} label={t('admin.catalog.parent')} options={[{ value: '', label: t('common.none') }, ...parents.map((p) => ({ value: p.slug, label: catalogName(t, 'categories', p, locale) }))]} /></div> : null}
          {kind === 'categories' ? <div><label htmlFor="seo" className="mb-1 block text-sm">{t('admin.catalog.seo')}</label><Input id="seo" value={seo} onChange={(e) => setSeo(e.target.value.toLowerCase())} className="font-mono" /></div> : null}
          <NamesFields names={names} setNames={setNames} locale={locale} />
          {err ? <p role="alert" className="text-sm text-red-400">{err}</p> : null}
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>{t('common.cancel')}</Button><Button onClick={save} disabled={busy || !slug}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}{t('common.save')}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function BadgeManager() {
  const t = useTranslations('community');
  const locale = useLocale();
  const api = useCApi('admin/badges');
  const [edit, setEdit] = useState(null);
  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3"><p className="text-sm text-muted-foreground">{t('admin.catalog.badgesText')}</p><Button onClick={() => setEdit({ color: '#22c55e' })} className="gap-2"><Plus className="h-4 w-4" />{t('admin.catalog.add')}</Button></div>
      <LoadingOrError loading={api.loading} error={api.error} data={api.data} onRetry={api.reload}>
        <Card className="divide-y divide-border/50">{(api.data?.items || []).map((b) => (
          <div key={b.id} className="flex items-center gap-3 px-4 py-3"><span className="h-4 w-4 rounded-full" style={{ background: b.color }} aria-hidden="true" /><div className="min-w-0 flex-1"><div className="text-sm font-medium">{catalogName(t, 'badges', b, locale)}</div><div className="font-mono text-xs text-muted-foreground">{b.key}</div></div><Badge variant="secondary">{t('admin.catalog.official')}</Badge><Button size="icon" variant="ghost" onClick={() => setEdit(b)} aria-label={t('common.edit')}><Pencil className="h-4 w-4" /></Button></div>
        ))}</Card>
      </LoadingOrError>
      {edit ? <BadgeDialog item={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); api.reload(); }} /> : null}
    </div>
  );
}

function BadgeDialog({ item, onClose, onSaved }) {
  const t = useTranslations('community');
  const isNew = !item.id;
  const [key, setKey] = useState(item.key || '');
  const [color, setColor] = useState(item.color || '#22c55e');
  const [names, setNames] = useState(item.names || {});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const save = async () => {
    setBusy(true); setErr('');
    const r = await cfetch(isNew ? 'admin/badges' : `admin/badges/${item.id}`, { method: isNew ? 'POST' : 'PATCH', body: { key, color, names, icon: 'star' } });
    setBusy(false);
    if (r.ok) { toast.success(t('admin.done')); onSaved(); } else setErr(r.data?.errors?.[0] ? t(`errors.${r.data.errors[0].code}`) : t('errors.generic'));
  };
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader><DialogTitle>{isNew ? t('admin.catalog.add') : t('admin.catalog.edit')}</DialogTitle><DialogDescription>{t('admin.catalog.badgesText')}</DialogDescription></DialogHeader>
        <div className="space-y-3">
          <div><label htmlFor="bkey" className="mb-1 block text-sm">{t('admin.catalog.slug')}</label><Input id="bkey" value={key} disabled={!isNew} onChange={(e) => setKey(e.target.value.toLowerCase())} className="font-mono" /></div>
          <div><label htmlFor="bcolor" className="mb-1 block text-sm">{t('fields.color_primary')}</label><div className="flex items-center gap-2"><input id="bcolor" type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-10 w-12 rounded border border-border bg-transparent p-1" /><Input value={color} onChange={(e) => setColor(e.target.value)} maxLength={7} className="font-mono" aria-label={t('fields.color_primary')} /></div></div>
          <NamesFields names={names} setNames={setNames} />
          {err ? <p role="alert" className="text-sm text-red-400">{err}</p> : null}
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>{t('common.cancel')}</Button><Button onClick={save} disabled={busy || !key}>{t('common.save')}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

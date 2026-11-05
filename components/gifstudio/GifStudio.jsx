'use client';
// Owner Panel > Appearance > Discord Link Preview > GIF Preview Studio. Library, link preview source and the editor.
import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ConfirmDialog, NativeSelect, formatDate } from '@/components/module-kit';
import WodyIcon from '@/components/wody-icon';
import { gs, useErrText, StatusBadge, fmtBytes, fmtMs } from './gs-kit';
import GifEditor from './GifEditor';

const SOURCES = ['image', 'gif', 'module', 'latest', 'custom'];
const SOURCE_ICON = { image: 'image', gif: 'gif', module: 'module', latest: 'updates', custom: 'design' };
const MODULE_ICON = { profile: 'profile', passport: 'passport', collab: 'collab' };

function Thumb({ item }) {
  const t = useTranslations('gifStudio.ui');
  if (!item.has_blob) {
    return <div className="flex h-20 w-36 shrink-0 items-center justify-center rounded-lg border border-border/50 bg-secondary/20"><WodyIcon name={item.status === 'generating' ? 'loading' : 'gif'} size={28} className={item.status === 'generating' ? 'animate-spin' : ''} /></div>;
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={`/api/gifstudio/items/${item.id}/file?v=${item.version}`} alt={t('library.thumbAlt', { name: item.name })} loading="lazy" className="h-20 w-36 shrink-0 rounded-lg border border-border/50 object-cover" />;
}

export default function GifStudio() {
  const t = useTranslations('gifStudio.ui');
  const locale = useLocale();
  const errText = useErrText();
  const [meta, setMeta] = useState(null);
  const [items, setItems] = useState(null);
  const [loadErr, setLoadErr] = useState(null);
  const [open, setOpen] = useState(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({ name: '', kind: 'module', module: 'profile' });
  const [busy, setBusy] = useState('');
  const [del, setDel] = useState(null);
  const [og, setOg] = useState(null);
  const [src, setSrc] = useState('image');
  const [gif, setGif] = useState('');
  const [savingSrc, setSavingSrc] = useState(false);
  const [filter, setFilter] = useState('all');
  const poll = useRef(null);

  const load = useCallback(async () => {
    const [m, l, o] = await Promise.all([gs('meta'), gs('items'), fetch('/api/site/og-embed').then((r) => r.json()).catch(() => null)]);
    if (m.ok) setMeta(m.data);
    if (!l.ok) { setLoadErr(l.data?.error || 'unreachable'); return; }
    setLoadErr(null); setItems(l.data.items);
    if (o) { setOg(o); setSrc(o.preview_source || 'image'); setGif(o.preview_gif || ''); }
  }, []);
  useEffect(() => { load(); }, [load]);

  // While something is generating the library refreshes by itself so progress and the final status show up.
  useEffect(() => {
    clearInterval(poll.current);
    if (items?.some((i) => i.status === 'generating')) poll.current = setInterval(async () => { const r = await gs('items'); if (r.ok) setItems(r.data.items); }, 2000);
    return () => clearInterval(poll.current);
  }, [items]);

  const replace = (it) => setItems((cur) => (cur || []).map((x) => (x.id === it.id ? it : x)));

  async function act(item, sub, body, okKey) {
    setBusy(`${item.id}:${sub}`);
    const r = await gs(`items/${item.id}/${sub}`, { method: 'POST', body: body || {} });
    setBusy('');
    if (!r.ok) { toast.error(errText(r.data?.error)); return null; }
    if (r.data.item) replace(r.data.item);
    if (okKey) toast.success(t(okKey));
    return r.data;
  }

  async function create() {
    setBusy('create');
    const r = await gs('items', { method: 'POST', body: draft });
    setBusy('');
    if (!r.ok) { toast.error(errText(r.data?.error)); return; }
    toast.success(t('toast.created'));
    setItems((cur) => [r.data.item, ...(cur || [])]);
    setCreating(false); setDraft({ name: '', kind: 'module', module: 'profile' });
    setOpen(r.data.item.id);
  }

  async function seed() {
    setBusy('seed');
    const r = await gs('items/seed', { method: 'POST', body: {} });
    setBusy('');
    if (!r.ok) { toast.error(errText(r.data?.error)); return; }
    toast.success(t('toast.seeded'));
    setItems((cur) => [...r.data.items, ...(cur || [])]);
  }

  // Generates every item that has no file yet, one after the other (the server builds one GIF at a time).
  async function generateAll() {
    setBusy('all');
    for (const it of (items || []).filter((x) => !x.has_blob && x.status !== 'archived')) {
      const r = await gs(`items/${it.id}/generate`, { method: 'POST', body: {} });
      if (!r.ok) { toast.error(`${it.name}: ${errText(r.data?.error)}`); continue; }
      for (let i = 0; i < 240; i += 1) {
        await new Promise((ok) => setTimeout(ok, 1500));
        const s = await gs(`items/${it.id}/status`);
        if (s.ok) { replace({ ...it, ...s.data.item, has_blob: s.data.item.has_blob }); if (s.data.item.status !== 'generating') break; }
      }
    }
    await load(); setBusy(''); toast.success(t('toast.allDone'));
  }

  async function remove() {
    setBusy('del');
    const r = await gs(`items/${del.id}`, { method: 'DELETE', body: { confirm: true } });
    setBusy('');
    if (!r.ok) { toast.error(errText(r.data?.error)); return; }
    toast.success(t('toast.deleted'));
    setItems((cur) => cur.filter((x) => x.id !== del.id)); setDel(null);
  }

  async function saveSource() {
    setSavingSrc(true);
    const r = await fetch('/api/site/og-embed', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ preview_source: src, preview_gif: src === 'image' ? '' : gif }) });
    const data = await r.json().catch(() => ({}));
    setSavingSrc(false);
    if (!r.ok) { toast.error(errText(data?.error)); return; }
    setOg(data); toast.success(t('toast.sourceSaved'));
  }

  if (open) {
    const item = items?.find((i) => i.id === open);
    return <GifEditor id={open} meta={meta} og={og} initial={item} onClose={() => { setOpen(null); load(); }} onChange={replace} />;
  }

  const candidates = (items || []).filter((i) => i.status === 'published' && (src === 'gif' ? true : i.kind === src));
  const shown = (items || []).filter((i) => filter === 'all' || i.status === filter);
  const currentSelected = og?.preview_gif ? items?.find((i) => i.slug === og.preview_gif) : null;

  return (
    <div className="space-y-5">
      <Card className="p-5 bg-card/60 border-[#a04820]/40">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 font-semibold text-[#e08a4e]"><WodyIcon name="studio" size={22} />{t('title')}</div>
            <p className="mt-1 max-w-2xl text-xs text-muted-foreground">{t('intro')}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" disabled={busy === 'seed'} onClick={seed} title={t('library.seedHint')}><WodyIcon name="module" size={16} className="mr-2" />{t('library.seed')}</Button>
            <Button variant="outline" disabled={busy === 'all' || !(items || []).some((x) => !x.has_blob && x.status !== 'archived')} onClick={generateAll}><WodyIcon name={busy === 'all' ? 'loading' : 'regenerate'} size={16} className={`mr-2 ${busy === 'all' ? 'animate-spin' : ''}`} />{t('library.generateAll')}</Button>
            <Button onClick={() => setCreating((v) => !v)} className="gradient-primary"><WodyIcon name="add" size={16} className="mr-2" />{t('library.new')}</Button>
          </div>
        </div>

        {creating && (
          <div className="mt-4 grid gap-3 rounded-xl border border-border/50 bg-secondary/10 p-4 sm:grid-cols-3">
            <div className="sm:col-span-3"><Label className="mb-1.5 block text-xs">{t('field.name')}</Label><Input value={draft.name} maxLength={60} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder={t('field.namePh')} /></div>
            <div><Label className="mb-1.5 block text-xs">{t('field.kind')}</Label>
              <NativeSelect label={t('field.kind')} value={draft.kind} onChange={(v) => setDraft({ ...draft, kind: v })} options={[{ value: 'module', label: t('kind.module') }, { value: 'latest', label: t('kind.latest') }, { value: 'custom', label: t('kind.custom') }]} /></div>
            {draft.kind === 'module' && (
              <div><Label className="mb-1.5 block text-xs">{t('field.module')}</Label>
                <NativeSelect label={t('field.module')} value={draft.module} onChange={(v) => setDraft({ ...draft, module: v })} options={['trio', 'profile', 'passport', 'collab', 'link', 'battlepass', 'counting', 'statistics', 'themes'].map((m) => ({ value: m, label: t(`module.${m}`) }))} /></div>
            )}
            <div className="flex items-end gap-2 sm:col-span-1">
              <Button onClick={create} disabled={busy === 'create' || !draft.name.trim()} className="gradient-primary"><WodyIcon name="save" size={16} className="mr-2" />{t('library.create')}</Button>
              <Button variant="outline" onClick={() => setCreating(false)}>{t('cancel')}</Button>
            </div>
          </div>
        )}
      </Card>

      <Card className="p-5 bg-card/60 border-[#a04820]/40">
        <div className="flex items-center gap-2 font-semibold"><WodyIcon name="link_preview" size={20} />{t('source.title')}</div>
        <p className="mt-1 mb-4 text-xs text-muted-foreground">{t('source.hint')}</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5" role="radiogroup" aria-label={t('source.title')}>
          {SOURCES.map((s) => (
            <button key={s} type="button" role="radio" aria-checked={src === s} onClick={() => { setSrc(s); setGif(''); }}
              className={`flex items-center gap-2 rounded-xl border p-3 text-left text-sm transition-colors ${src === s ? 'border-[#e08a4e] bg-[#e08a4e]/10' : 'border-border/50 hover:bg-secondary/20'}`}>
              <WodyIcon name={SOURCE_ICON[s]} size={22} /><span className="font-medium">{t(`source.opt.${s}`)}</span>
            </button>
          ))}
        </div>
        {src !== 'image' && (
          <div className="mt-3 max-w-md">
            <Label className="mb-1.5 block text-xs">{t('source.pick')}</Label>
            <NativeSelect label={t('source.pick')} value={gif} onChange={setGif} options={[{ value: '', label: candidates.length ? t('source.choose') : t('source.noneReady') }, ...candidates.map((i) => ({ value: i.slug, label: i.name }))]} />
          </div>
        )}
        <p className="mt-3 flex items-start gap-2 text-xs text-muted-foreground"><WodyIcon name="info" size={16} className="mt-0.5" />{t('source.limit')}</p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button onClick={saveSource} disabled={savingSrc || (src !== 'image' && !gif) || (src === (og?.preview_source || 'image') && gif === (og?.preview_gif || ''))} className="gradient-primary">
            {savingSrc ? <WodyIcon name="loading" size={16} className="mr-2 animate-spin" /> : <WodyIcon name="save" size={16} className="mr-2" />}{t('save')}
          </Button>
          <span className="text-xs text-muted-foreground">{t('source.current')}: <b>{t(`source.opt.${og?.preview_source || 'image'}`)}</b>{currentSelected ? ` · ${currentSelected.name}` : ''}</span>
        </div>
      </Card>

      <Card className="p-5 bg-card/60 border-[#a04820]/40">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 font-semibold"><WodyIcon name="library" size={20} />{t('library.title')}</div>
          <div className="w-44"><NativeSelect label={t('library.filter')} value={filter} onChange={setFilter} options={[{ value: 'all', label: t('library.all') }, ...['draft', 'generating', 'ready', 'published', 'scheduled', 'archived', 'failed'].map((s) => ({ value: s, label: t(`status.${s}`) }))]} /></div>
        </div>
        {loadErr ? (
          <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm"><WodyIcon name="error" size={18} />{errText(loadErr)}<Button size="sm" variant="outline" className="ml-auto" onClick={load}>{t('retry')}</Button></div>
        ) : !items ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><WodyIcon name="loading" size={18} className="animate-spin" />{t('loading')}</div>
        ) : shown.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center"><WodyIcon name="gif" size={44} /><p className="font-medium">{t('library.emptyTitle')}</p><p className="max-w-sm text-xs text-muted-foreground">{t('library.emptyText')}</p></div>
        ) : (
          <ul className="space-y-3">
            {shown.map((it) => {
              const cur = it.current;
              const b = (sub) => busy === `${it.id}:${sub}`;
              return (
                <li key={it.id} className="flex flex-col gap-3 rounded-xl border border-border/50 bg-secondary/10 p-3 lg:flex-row">
                  <Thumb item={it} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <WodyIcon name={it.module ? MODULE_ICON[it.module] : (it.kind === 'latest' ? 'updates' : 'design')} size={18} />
                      <span className="truncate font-medium">{it.name}</span><StatusBadge status={it.status} />
                      {it.version > 0 && <span className="text-[11px] text-muted-foreground">v{it.version}{it.published_version && it.published_version !== it.version ? ` · ${t('library.live')} v${it.published_version}` : ''}</span>}
                    </div>
                    <dl className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-0.5 text-[11px] text-muted-foreground sm:grid-cols-3">
                      <div>{t('library.type')}: {it.module ? t(`module.${it.module}`) : t(`kind.${it.kind}`)}</div>
                      <div>{t('library.preset')}: {t(`preset.${it.config.preset}`)}</div>
                      {cur ? <><div>{cur.width}x{cur.height} · {fmtMs(cur.duration_ms)}</div><div>{fmtBytes(cur.bytes)}{cur.optimized ? ` · ${t('library.optimized')}` : ''}</div></> : <div className="col-span-2">{t('library.notGenerated')}</div>}
                      <div>{t('library.created')}: {formatDate(it.created_at, locale)}</div>
                      <div>{t('library.updated')}: {formatDate(it.updated_at, locale)}</div>
                      {it.published_at && <div>{t('library.published')}: {formatDate(it.published_at, locale)}</div>}
                    </dl>
                    {it.status === 'generating' && it.job && <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-secondary/40" role="progressbar" aria-valuenow={Math.round(it.job.progress * 100)} aria-valuemin={0} aria-valuemax={100}><div className="h-full bg-[#e08a4e] transition-all" style={{ width: `${Math.round(it.job.progress * 100)}%` }} /></div>}
                    {it.status === 'failed' && it.job?.error && <p className="mt-1 flex items-center gap-1.5 text-xs text-red-300"><WodyIcon name="error" size={14} />{errText(it.job.error)}</p>}
                    {it.public_path && (
                      <button type="button" className="mt-1.5 inline-flex items-center gap-1.5 text-xs text-[#e08a4e] hover:underline" onClick={() => { navigator.clipboard?.writeText(`${window.location.origin}${it.public_path}`); toast.success(t('toast.copied')); }}>
                        <WodyIcon name="link" size={14} />{t('library.copyLink')}
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap content-start gap-1.5 lg:w-56 lg:justify-end">
                    <Button size="sm" variant="outline" onClick={() => setOpen(it.id)} title={t('act.edit')}><WodyIcon name="edit" size={15} className="mr-1.5" />{t('act.edit')}</Button>
                    {it.status !== 'generating' && <Button size="sm" variant="outline" disabled={b('generate')} onClick={() => act(it, 'generate', {}, 'toast.generating')}><WodyIcon name="regenerate" size={15} className="mr-1.5" />{it.has_blob ? t('act.regenerate') : t('act.generate')}</Button>}
                    {it.status === 'generating' && <Button size="sm" variant="outline" disabled={b('cancel')} onClick={() => act(it, 'cancel', {}, 'toast.cancelled')}><WodyIcon name="cancel" size={15} className="mr-1.5" />{t('act.cancel')}</Button>}
                    {it.has_blob && it.status !== 'generating' && it.status !== 'archived' && it.version !== it.published_version && <Button size="sm" disabled={b('publish')} className="gradient-primary" onClick={() => act(it, 'publish', {}, 'toast.published')}><WodyIcon name="publish" size={15} className="mr-1.5" />{t('act.publish')}</Button>}
                    {(it.status === 'published' || it.status === 'scheduled') && <Button size="sm" variant="outline" disabled={b('unpublish')} onClick={() => act(it, 'unpublish', {}, 'toast.unpublished')}><WodyIcon name="lock" size={15} className="mr-1.5" />{t('act.unpublish')}</Button>}
                    <Button size="sm" variant="outline" disabled={b('duplicate')} onClick={async () => { const d = await act(it, 'duplicate', {}, 'toast.duplicated'); if (d?.item) setItems((cur) => [d.item, ...cur]); }}><WodyIcon name="duplicate" size={15} className="mr-1.5" />{t('act.duplicate')}</Button>
                    {it.status === 'archived'
                      ? <Button size="sm" variant="outline" onClick={() => act(it, 'unarchive', {}, 'toast.restored')}><WodyIcon name="restore" size={15} className="mr-1.5" />{t('act.unarchive')}</Button>
                      : <Button size="sm" variant="outline" disabled={it.status === 'generating'} onClick={() => act(it, 'archive', {}, 'toast.archived')}><WodyIcon name="archived" size={15} className="mr-1.5" />{t('act.archive')}</Button>}
                    <Button size="sm" variant="outline" className="text-red-300" disabled={it.status === 'generating'} onClick={() => setDel(it)}><WodyIcon name="delete" size={15} className="mr-1.5" />{t('act.delete')}</Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <ConfirmDialog open={!!del} onOpenChange={(o) => { if (!o) setDel(null); }} icon={<WodyIcon name="warning" size={22} />} title={t('delete.title')}
        description={t('delete.text', { name: del?.name || '' })} confirmLabel={t('act.delete')} onConfirm={remove} busy={busy === 'del'} />
    </div>
  );
}

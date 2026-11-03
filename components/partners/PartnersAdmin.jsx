'use client';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Eye, EyeOff, ExternalLink, Handshake, Loader2, Pencil, Plus, Star, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import PartnerCard from '@/components/partners/PartnerCard';
import { proxiedImageUrl } from '@/lib/utils';

const EMPTY = {
  name: '', tagline: '', description: '', avatar_url: '', banner_url: '', invite_url: '', website_url: '', support_url: '',
  tags: '', color: '#c46a2d', servers: '', order: 0, featured: false, enabled: true,
};

const ERRORS = {
  invalid_name: 'The name needs at least 2 characters.',
  invalid_url: 'That link is not valid. Use a full link starting with https://',
  invite_required: 'The bot invite link is required.',
  invalid_color: 'The color must be a hex code like #c46a2d.',
  invalid_servers: 'The server count must be a positive number.',
  limit_reached: 'You reached the maximum number of partners.',
  forbidden: 'Only the owner can manage partners.',
};

async function api(path, { method = 'GET', body } = {}) {
  try {
    const r = await fetch(`/api/${path}`, { method, headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined, cache: 'no-store' });
    const data = await r.json().catch(() => ({}));
    return { ok: r.ok, data };
  } catch {
    return { ok: false, data: { error: 'unreachable' } };
  }
}

function toForm(p) {
  return { ...EMPTY, ...p, tags: (p.tags || []).join(', '), servers: p.servers ?? '' };
}

function toBody(f) {
  return { ...f, tags: f.tags.split(',').map((t) => t.trim()).filter(Boolean), servers: f.servers === '' ? null : Number(f.servers), order: Number(f.order) || 0 };
}

export default function PartnersAdmin() {
  const [items, setItems] = useState(null);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState({ text: '', field: '' });

  const load = async () => {
    const r = await api('owner/partners');
    setItems(r.ok ? r.data.items || [] : []);
    if (!r.ok) toast.error(ERRORS[r.data?.error] || 'Could not load partners');
  };
  useEffect(() => { load(); }, []);

  const open = (p) => { setEditing(p ? p.id : 'new'); setForm(p ? toForm(p) : { ...EMPTY, order: (items?.length || 0) }); setError({ text: '', field: '' }); };
  const close = () => { setEditing(null); setForm(EMPTY); setError({ text: '', field: '' }); };
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const save = async () => {
    setBusy(true); setError({ text: '', field: '' });
    const r = editing === 'new'
      ? await api('partners', { method: 'POST', body: toBody(form) })
      : await api(`partners/${editing}`, { method: 'PATCH', body: toBody(form) });
    setBusy(false);
    if (!r.ok) { setError({ text: ERRORS[r.data?.error] || 'Could not save the partner.', field: r.data?.field || '' }); return; }
    toast.success(editing === 'new' ? 'Partner added' : 'Partner updated');
    close(); load();
  };

  const quick = async (p, patch) => {
    const r = await api(`partners/${p.id}`, { method: 'PATCH', body: patch });
    if (r.ok) { setItems((list) => list.map((x) => (x.id === p.id ? r.data : x))); } else toast.error('Could not update the partner');
  };

  const remove = async (p) => {
    if (!window.confirm(`Remove ${p.name} from the partners page? This cannot be undone.`)) return;
    const r = await api(`partners/${p.id}`, { method: 'DELETE' });
    if (r.ok) { toast.success('Partner removed'); setItems((list) => list.filter((x) => x.id !== p.id)); } else toast.error('Could not remove the partner');
  };

  const preview = useMemo(() => ({ ...toBody(form), id: 'preview' }), [form]);
  const field = (name) => (error.field === name ? 'border-red-400/70 focus-visible:ring-red-400/50' : '');

  return (
    <div className="space-y-6">
      <Card className="relative overflow-hidden border-[#a04820]/40 bg-card/60 p-6">
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-[#a04820]/15 blur-3xl" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 font-semibold text-[#e08a4e]"><Handshake className="h-4 w-4" /> Partner bots</div>
            <p className="mt-1 max-w-xl text-xs text-muted-foreground">
              The bots shown on the public <a href="/partners" target="_blank" rel="noreferrer" className="text-[#e08a4e] hover:underline">/partners</a> page.
              Featured partners get the big spotlight card at the top. Hidden partners stay saved here but are not shown on the site.
            </p>
          </div>
          {editing === null ? <Button onClick={() => open(null)} className="gradient-primary gap-1.5"><Plus className="h-4 w-4" /> Add partner</Button> : null}
        </div>
      </Card>

      {editing !== null ? (
        <Card className="border-[#a04820]/40 bg-card/60 p-6">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div className="font-semibold">{editing === 'new' ? 'New partner' : `Edit ${form.name || 'partner'}`}</div>
            <Button variant="ghost" size="icon" onClick={close} aria-label="Close"><X className="h-4 w-4" /></Button>
          </div>
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
            <div className="grid gap-4 sm:grid-cols-2">
              <div><Label className="mb-1.5 block">Bot name *</Label><Input className={field('name')} value={form.name} maxLength={60} onChange={(e) => set({ name: e.target.value })} placeholder="Wody" /></div>
              <div><Label className="mb-1.5 block">Tagline</Label><Input value={form.tagline} maxLength={90} onChange={(e) => set({ tagline: e.target.value })} placeholder="Music that never stops" /></div>
              <div className="sm:col-span-2"><Label className="mb-1.5 block">Description</Label><Textarea rows={3} value={form.description} maxLength={600} onChange={(e) => set({ description: e.target.value })} placeholder="What the bot does and why it is a great partner." /><p className="mt-1 text-right text-[11px] text-muted-foreground">{form.description.length}/600</p></div>
              <div><Label className="mb-1.5 block">Avatar image link</Label><Input className={field('avatar_url')} type="url" value={form.avatar_url} onChange={(e) => set({ avatar_url: e.target.value })} placeholder="https://cdn.discordapp.com/avatars/…" /></div>
              <div><Label className="mb-1.5 block">Banner image link</Label><Input className={field('banner_url')} type="url" value={form.banner_url} onChange={(e) => set({ banner_url: e.target.value })} placeholder="https://…/banner.png" /></div>
              <div className="sm:col-span-2"><Label className="mb-1.5 block">Bot invite link *</Label><Input className={field('invite_url')} type="url" value={form.invite_url} onChange={(e) => set({ invite_url: e.target.value })} placeholder="https://discord.com/oauth2/authorize?client_id=…" /></div>
              <div><Label className="mb-1.5 block">Website</Label><Input className={field('website_url')} type="url" value={form.website_url} onChange={(e) => set({ website_url: e.target.value })} placeholder="https://…" /></div>
              <div><Label className="mb-1.5 block">Support server</Label><Input className={field('support_url')} type="url" value={form.support_url} onChange={(e) => set({ support_url: e.target.value })} placeholder="https://discord.gg/…" /></div>
              <div className="sm:col-span-2"><Label className="mb-1.5 block">Tags (comma separated, up to 6)</Label><Input value={form.tags} onChange={(e) => set({ tags: e.target.value })} placeholder="Music, Moderation, Fun" /></div>
              <div>
                <Label className="mb-1.5 block">Brand color</Label>
                <div className="flex gap-2"><Input type="color" className="h-10 w-14 p-1" value={/^#[0-9a-fA-F]{6}$/.test(form.color) ? form.color : '#c46a2d'} onChange={(e) => set({ color: e.target.value })} /><Input className={field('color')} value={form.color} onChange={(e) => set({ color: e.target.value })} /></div>
              </div>
              <div><Label className="mb-1.5 block">Servers (optional)</Label><Input className={field('servers')} type="number" min={0} value={form.servers} onChange={(e) => set({ servers: e.target.value })} placeholder="12000" /></div>
              <div><Label className="mb-1.5 block">Position</Label><Input type="number" min={0} value={form.order} onChange={(e) => set({ order: e.target.value })} /><p className="mt-1 text-[11px] text-muted-foreground">Lower numbers are shown first.</p></div>
              <div className="flex flex-col justify-end gap-3">
                <label className="flex items-center gap-3 text-sm"><Switch checked={form.featured} onCheckedChange={(v) => set({ featured: v })} /> Featured (spotlight card)</label>
                <label className="flex items-center gap-3 text-sm"><Switch checked={form.enabled} onCheckedChange={(v) => set({ enabled: v })} /> Shown on the site</label>
              </div>
              {error.text ? <p role="alert" className="sm:col-span-2 rounded-lg border border-red-400/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error.text}</p> : null}
              <div className="flex gap-2 sm:col-span-2">
                <Button onClick={save} disabled={busy} className="gradient-primary">{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}{editing === 'new' ? 'Add partner' : 'Save changes'}</Button>
                <Button variant="outline" onClick={close} disabled={busy}>Cancel</Button>
              </div>
            </div>
            <div>
              <Label className="mb-2 block text-xs text-muted-foreground">Live preview</Label>
              <div className="rounded-2xl border border-border/60 bg-[#0d0806] p-3">
                <PartnerCard partner={preview} labels={{ add: 'Add to Discord', website: 'Website', support: 'Support', servers: 'servers', partner: 'Partner' }} />
              </div>
            </div>
          </div>
        </Card>
      ) : null}

      <Card className="border-border/60 bg-card/60 p-2 sm:p-4">
        {items === null ? (
          <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : items.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">No partners yet. Add the first one, the page shows a “Become a partner” invitation until then.</p>
        ) : (
          <ul className="divide-y divide-border/50">
            {items.map((p) => (
              <li key={p.id} className="flex items-center gap-3 px-2 py-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border/60" style={{ backgroundColor: `${p.color}33` }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {p.avatar_url ? <img src={proxiedImageUrl(p.avatar_url)} alt="" className="h-full w-full object-cover" /> : <span className="font-bold" style={{ color: p.color }}>{p.name.slice(0, 1)}</span>}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2"><span className="truncate font-medium">{p.name}</span>{p.featured ? <Star className="h-3.5 w-3.5 shrink-0 fill-[#f2c091] text-[#f2c091]" /> : null}{!p.enabled ? <span className="rounded border border-border/60 px-1.5 text-[10px] uppercase text-muted-foreground">Hidden</span> : null}</div>
                  <div className="truncate text-xs text-muted-foreground">{p.tagline || p.invite_url}</div>
                </div>
                <span className="hidden w-10 text-center text-xs tabular-nums text-muted-foreground sm:block" title="Position">#{p.order}</span>
                <Button variant="ghost" size="icon" title={p.featured ? 'Remove from spotlight' : 'Feature in spotlight'} onClick={() => quick(p, { featured: !p.featured })}><Star className={`h-4 w-4 ${p.featured ? 'fill-[#f2c091] text-[#f2c091]' : ''}`} /></Button>
                <Button variant="ghost" size="icon" title={p.enabled ? 'Hide from the site' : 'Show on the site'} onClick={() => quick(p, { enabled: !p.enabled })}>{p.enabled ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}</Button>
                <a href={p.invite_url} target="_blank" rel="noreferrer" title="Open invite" className="hidden h-9 w-9 items-center justify-center rounded-md hover:bg-secondary sm:inline-flex"><ExternalLink className="h-4 w-4" /></a>
                <Button variant="ghost" size="icon" title="Edit" onClick={() => open(p)}><Pencil className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" title="Remove" onClick={() => remove(p)} className="text-red-300 hover:text-red-200"><Trash2 className="h-4 w-4" /></Button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

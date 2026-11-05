'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Check, ExternalLink, Globe, Hash, Loader2, Lock, Pencil, Plus, ShieldCheck, Trash2, Users } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { mfetch } from './client';
import { errText } from './RequestActions';
import { SERVER_CAT_LIMITS } from '@/lib/collab/constants';
import ServerCollabSettings from './ServerCollabSettings';
import { input, lab, btn, btnMain } from './ui';

const ACCESS = [
  ['public', Globe, 'pub', 'pubHint'],
  ['roles', Users, 'roles', 'rolesHint'],
  ['private', Lock, 'priv', 'privHint'],
];

function CategoryForm({ gid, initial, onSaved, onCancel }) {
  const t = useTranslations('collab');
  const [d, setD] = useState({ name: initial?.name || '', access: initial?.access || 'public', roles: initial?.roles || [], channel_id: initial?.channel_id || '', channel_name: initial?.channel_name || '', also_default: Boolean(initial?.also_default) });
  const [channels, setChannels] = useState(null);
  const [picking, setPicking] = useState(false);
  const [chBusy, setChBusy] = useState(false);
  const [roles, setRoles] = useState(null);
  const [rolesBusy, setRolesBusy] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  useEffect(() => {
    if (d.access !== 'roles' || roles || rolesBusy) return;
    setRolesBusy(true);
    mfetch(`server/${gid}/categories/roles`).then((r) => {
      if (!alive.current) return;
      setRolesBusy(false);
      if (r.ok) setRoles(r.data.roles); else setNote(t('serverCats.rolesFail'));
    });
  }, [d.access, roles, rolesBusy, gid, t]);

  async function openPicker() {
    setPicking(true); setNote('');
    if (channels) return;
    setChBusy(true);
    let r = await mfetch(`server/${gid}/channels`);
    if (!r.ok && r.status !== 404) r = await mfetch(`server/${gid}/channels`);
    if (!alive.current) return;
    setChBusy(false);
    if (r.ok) setChannels(r.data.channels); else { setPicking(false); setNote(t('servers.announceFail')); }
  }
  function pickChannel(e) {
    const id = e.target.value; const c = (channels || []).find((x) => x.id === id);
    setD((x) => ({ ...x, channel_id: id, channel_name: c ? c.name : '', also_default: id ? x.also_default : false }));
  }
  const toggle = (id) => setD((x) => ({ ...x, roles: x.roles.includes(id) ? x.roles.filter((r) => r !== id) : [...x.roles, id].slice(0, SERVER_CAT_LIMITS.roles) }));
  const dirty = !initial || d.name.trim() !== initial.name || d.access !== initial.access || (d.access === 'roles' && [...d.roles].sort().join() !== [...(initial.roles || [])].sort().join()) || d.channel_id !== (initial.channel_id || '') || (Boolean(d.channel_id) && d.also_default !== Boolean(initial.also_default));

  async function save() {
    setBusy(true); setNote('');
    const body = { name: d.name, access: d.access, channel_id: d.channel_id || null, also_default: Boolean(d.channel_id && d.also_default), ...(d.access === 'roles' ? { roles: d.roles } : {}) };
    const r = initial ? await mfetch(`server/${gid}/categories/${initial.id}`, { method: 'PUT', body }) : await mfetch(`server/${gid}/categories`, { method: 'POST', body });
    if (!alive.current) return;
    setBusy(false);
    if (!r.ok) { setNote(errText(t, r.data)); return; }
    onSaved(r.data.category);
  }

  return (
    <div className="space-y-4 rounded-2xl border border-[#e6cd8c]/30 bg-background/40 p-4">
      <div>
        <label className={lab} htmlFor={`sc-name-${initial?.id || 'new'}`}>{t('serverCats.name')}</label>
        <input id={`sc-name-${initial?.id || 'new'}`} className={`${input} min-h-11`} value={d.name} maxLength={SERVER_CAT_LIMITS.name.max} placeholder={t('serverCats.namePh')} onChange={(e) => setD((x) => ({ ...x, name: e.target.value }))} autoComplete="off" />
      </div>
      <fieldset>
        <legend className={lab}>{t('serverCats.access')}</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {ACCESS.map(([val, Icon, label, hint]) => (
            <label key={val} className={`flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors ${d.access === val ? 'border-[#e6cd8c]/60 bg-[#e6cd8c]/10' : 'border-border/60 bg-card/40 hover:border-border'}`}>
              <input type="radio" name={`sc-acc-${initial?.id || 'new'}`} className="sr-only" checked={d.access === val} onChange={() => setD((x) => ({ ...x, access: val }))} />
              <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${d.access === val ? 'text-[#f3e1b0]' : 'text-muted-foreground'}`} aria-hidden="true" />
              <span className="min-w-0"><span className="block text-sm font-semibold">{t(`serverCats.${label}`)}</span><span className="block text-[11px] text-muted-foreground">{t(`serverCats.${hint}`)}</span></span>
            </label>
          ))}
        </div>
      </fieldset>
      {d.access === 'roles' && (
        <div>
          <span className={lab}>{t('serverCats.pickRoles')}</span>
          {rolesBusy ? (
            <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />{t('loading')}</p>
          ) : roles && roles.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('serverCats.noRoles')}</p>
          ) : (
            <div className="flex max-h-48 flex-wrap gap-2 overflow-y-auto">
              {(roles || []).map((r) => {
                const on = d.roles.includes(r.id);
                return (
                  <button key={r.id} type="button" aria-pressed={on} onClick={() => toggle(r.id)} className={`inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 py-1 text-sm ${on ? 'border-[#e6cd8c]/70 bg-[#e6cd8c]/15 text-[#f3e1b0]' : 'border-border/60 text-muted-foreground hover:border-border'}`}>
                    <span className="h-2.5 w-2.5 rounded-full border border-white/20" style={{ background: r.color ? `#${r.color.toString(16).padStart(6, '0')}` : 'transparent' }} aria-hidden="true" />
                    <span className="max-w-[12rem] truncate">{r.name}</span>
                    {on && <Check className="h-3.5 w-3.5" aria-hidden="true" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
      <div>
        <span className={lab} id={`sc-ch-l-${initial?.id || 'new'}`}>{t('serverCats.channel')}</span>
        {!picking ? (
          <div className="flex min-h-11 items-center gap-3 rounded-xl border border-border/60 bg-background/40 px-3 py-2">
            <Hash className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate text-sm">{d.channel_id ? (d.channel_name || d.channel_id) : <span className="text-muted-foreground">{t('serverCats.channelNone')}</span>}</span>
            <button type="button" onClick={openPicker} className={`${btn} min-h-9 shrink-0`}>{t('servers.announceChange')}</button>
          </div>
        ) : chBusy ? (
          <p role="status" className="flex min-h-11 items-center gap-2 rounded-xl border border-border/60 bg-background/40 px-3 py-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />{t('loading')}</p>
        ) : (
          <select aria-labelledby={`sc-ch-l-${initial?.id || 'new'}`} className={`${input} min-h-11`} value={d.channel_id} onChange={pickChannel} autoFocus>
            <option value="">{t('serverCats.channelNone')}</option>
            {d.channel_id && !(channels || []).some((c) => c.id === d.channel_id) && <option value={d.channel_id}>#{d.channel_name || d.channel_id}</option>}
            {(channels || []).map((c) => <option key={c.id} value={c.id}>#{c.name}</option>)}
          </select>
        )}
        {d.channel_id && (
          <label className="mt-2 flex min-h-10 cursor-pointer items-center gap-3 text-sm">
            <input type="checkbox" className="h-5 w-5 shrink-0 accent-[#e6cd8c]" checked={d.also_default} onChange={(e) => setD((x) => ({ ...x, also_default: e.target.checked }))} />
            <span>{t('serverCats.alsoDefault')}</span>
          </label>
        )}
        <p className="mt-1.5 text-[11px] text-muted-foreground">{t('serverCats.channelHint')}</p>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border/50 pt-3">
        {note && <span role="alert" className="min-w-0 flex-1 text-right text-xs text-destructive">{note}</span>}
        <button type="button" onClick={onCancel} disabled={busy} className={`${btn} min-h-10`}>{t('serverCats.cancel')}</button>
        <button type="button" onClick={save} disabled={busy || !dirty || d.name.trim().length < SERVER_CAT_LIMITS.name.min} className={`${btnMain} min-h-10`}>
          {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}{initial ? t('serverCats.save') : t('serverCats.create')}
        </button>
      </div>
    </div>
  );
}

export default function ServerCategoriesPanel({ guildId }) {
  const t = useTranslations('collab');
  const [st, setSt] = useState({ state: 'loading', items: [], max: SERVER_CAT_LIMITS.perServer });
  const [edit, setEdit] = useState(null);
  const [msg, setMsg] = useState({ kind: '', text: '', id: '' });
  const [busyId, setBusyId] = useState('');

  const load = useCallback(async () => {
    const r = await mfetch(`server/${guildId}/categories`);
    if (r.ok) setSt({ state: 'ok', items: r.data.categories, max: r.data.max || SERVER_CAT_LIMITS.perServer });
    else setSt((s) => ({ ...s, state: r.status === 404 ? 'denied' : 'error' }));
  }, [guildId]);
  useEffect(() => { setSt({ state: 'loading', items: [], max: SERVER_CAT_LIMITS.perServer }); setEdit(null); setMsg({ kind: '', text: '', id: '' }); load(); }, [load]);

  async function remove(c) {
    if (!window.confirm(t('serverCats.confirmDelete'))) return;
    setBusyId(c.id);
    const r = await mfetch(`server/${guildId}/categories/${c.id}`, { method: 'DELETE' });
    setBusyId('');
    setMsg(r.ok ? { kind: 'ok', text: t('serverCats.deleted'), id: '' } : { kind: 'err', text: errText(t, r.data), id: c.id });
    if (r.ok) load();
  }
  async function toggleEnabled(c) {
    setBusyId(c.id);
    const r = await mfetch(`server/${guildId}/categories/${c.id}`, { method: 'PUT', body: { enabled: !c.enabled } });
    setBusyId('');
    setMsg(r.ok ? { kind: 'ok', text: t('serverCats.saved'), id: c.id } : { kind: 'err', text: errText(t, r.data), id: c.id });
    if (r.ok) load();
  }

  if (st.state === 'loading') return <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />{t('loading')}</p>;
  if (st.state === 'denied') {
    return (
      <div className="space-y-4">
        <p className="rounded-2xl border border-dashed border-border/70 p-5 text-sm text-muted-foreground">{t('serverCats.notOwner')}</p>
        <ServerCollabSettings guildId={guildId} />
      </div>
    );
  }
  if (st.state === 'error') return <p role="alert" className="rounded-2xl border border-destructive/40 bg-destructive/5 p-4 text-sm">{t('serverCats.loadFail')} <button type="button" className={btn} onClick={load}>{t('retry')}</button></p>;

  const full = st.items.length >= st.max;
  return (
    <div className="space-y-6" data-testid="collab-categories">
      <section className="rounded-2xl border border-border/60 bg-card/50 p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="flex items-center gap-2 text-base font-semibold"><ShieldCheck className="h-4 w-4 text-[#e6cd8c]" aria-hidden="true" />{t('serverCats.title')}</h3>
            <p className="mt-1 max-w-2xl text-xs text-muted-foreground">{t('serverCats.intro')}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">{t('serverCats.howTo')}</p>
          </div>
          <div className="flex w-full shrink-0 flex-wrap items-center gap-2 sm:w-auto">
            {msg.text && !msg.id && <span role={msg.kind === 'err' ? 'alert' : 'status'} className={`inline-flex items-center gap-1.5 text-sm ${msg.kind === 'err' ? 'text-destructive' : 'text-emerald-300'}`}>{msg.kind !== 'err' && <Check className="h-3.5 w-3.5" aria-hidden="true" />}{msg.text}</span>}
            <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto">
              <button type="button" className={`${btnMain} min-h-10 min-w-0 flex-1 justify-center whitespace-nowrap px-3 sm:flex-none sm:px-4`} disabled={full || edit === 'new'} onClick={() => { setEdit('new'); setMsg({ kind: '', text: '', id: '' }); }}><Plus className="h-4 w-4 shrink-0" aria-hidden="true" /><span className="truncate">{t('serverCats.new')}</span></button>
              <Link href={`/collab/server/${guildId}`} className={`${btn} min-h-10 min-w-0 flex-1 justify-center whitespace-nowrap px-3 sm:flex-none sm:px-4`}><ExternalLink className="h-4 w-4 shrink-0" aria-hidden="true" /><span className="truncate">{t('serverCats.open')}</span></Link>
            </div>
          </div>
        </div>
        <p className="mt-3 text-[11px] text-muted-foreground">{t('serverCats.count', { n: st.items.length, max: st.max })}</p>
        {edit === 'new' && <div className="mt-4"><CategoryForm gid={guildId} onCancel={() => setEdit(null)} onSaved={() => { setEdit(null); setMsg({ kind: 'ok', text: t('serverCats.saved'), id: '' }); load(); }} /></div>}
        {st.items.length === 0 && edit !== 'new' ? (
          <p className="mt-4 rounded-2xl border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">{t('serverCats.empty')}</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {st.items.map((c) => {
              const Icon = ACCESS.find((a) => a[0] === c.access)?.[1] || Globe;
              return (
                <li key={c.id} className="rounded-2xl border border-border/60 bg-background/30 p-3 sm:p-4">
                  {edit === c.id ? (
                    <CategoryForm gid={guildId} initial={c} onCancel={() => setEdit(null)} onSaved={() => { setEdit(null); setMsg({ kind: 'ok', text: t('serverCats.saved'), id: c.id }); load(); }} />
                  ) : (
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border/60 text-[#e6cd8c]"><Icon className="h-4 w-4" aria-hidden="true" /></span>
                      <div className="min-w-0 flex-1">
                        <p className={`truncate text-sm font-semibold ${c.enabled ? '' : 'text-muted-foreground line-through'}`}>{c.name}</p>
                        <p className="text-[11px] text-muted-foreground">{t(`serverCats.${ACCESS.find((a) => a[0] === c.access)?.[2] || 'pub'}`)} · {t('serverCats.posts', { n: c.posts || 0 })}{c.channel_id ? ` · #${c.channel_name || c.channel_id}${c.also_default ? ' +' : ''}` : ''}</p>
                      </div>
                      <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                        <input type="checkbox" className="h-5 w-5 accent-[#e6cd8c]" checked={c.enabled} disabled={busyId === c.id} onChange={() => toggleEnabled(c)} />{t('serverCats.enabled')}
                      </label>
                      {msg.text && msg.id === c.id && <span role={msg.kind === 'err' ? 'alert' : 'status'} className={`inline-flex items-center gap-1.5 text-xs ${msg.kind === 'err' ? 'text-destructive' : 'text-emerald-300'}`}>{msg.kind !== 'err' && <Check className="h-3.5 w-3.5" aria-hidden="true" />}{msg.text}</span>}
                      <button type="button" className={`${btn} min-h-10`} onClick={() => { setEdit(c.id); setMsg({ kind: '', text: '', id: '' }); }}><Pencil className="h-4 w-4" aria-hidden="true" />{t('serverCats.edit')}</button>
                      <button type="button" className={`${btn} min-h-10 text-destructive`} disabled={busyId === c.id} onClick={() => remove(c)}><Trash2 className="h-4 w-4" aria-hidden="true" />{t('serverCats.delete')}</button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
      <ServerCollabSettings guildId={guildId} />
    </div>
  );
}

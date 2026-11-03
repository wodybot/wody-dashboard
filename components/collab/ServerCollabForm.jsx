'use client';
import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Check, Hash, LayoutDashboard, Loader2 } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { mfetch } from './client';
import { errText } from './RequestActions';
import { input, lab, btn, btnMain } from './ui';

export default function ServerCollabForm({ gid, initial, owner = true, onSaved, dashLink = false }) {
  const t = useTranslations('collab');
  const base = useRef({ require_approval: Boolean(initial.require_approval), id: initial.announce_channel_id || '', name: initial.announce_channel_name || '' });
  const [d, setD] = useState({ ...base.current });
  const [channels, setChannels] = useState(null);
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState({ load: false, save: false });
  const [note, setNote] = useState({ kind: '', msg: '' });
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  const dirty = d.require_approval !== base.current.require_approval || d.id !== base.current.id;

  async function openPicker() {
    setPicking(true); setNote({ kind: '', msg: '' });
    if (channels) return;
    setBusy((b) => ({ ...b, load: true }));
    let r = await mfetch(`server/${gid}/channels`);
    if (!r.ok && r.status !== 404) r = await mfetch(`server/${gid}/channels`);
    if (!alive.current) return;
    setBusy((b) => ({ ...b, load: false }));
    if (r.ok) setChannels(r.data.channels); else { setPicking(false); setNote({ kind: 'err', msg: t('servers.announceFail') }); }
  }

  function pick(e) {
    const id = e.target.value;
    const c = (channels || []).find((x) => x.id === id);
    setD((x) => ({ ...x, id, name: c ? c.name : '' }));
    setNote({ kind: '', msg: '' });
  }

  async function save() {
    const body = {};
    if (d.require_approval !== base.current.require_approval) body.require_approval = d.require_approval;
    if (d.id !== base.current.id) body.announce_channel_id = d.id || null;
    setBusy((b) => ({ ...b, save: true })); setNote({ kind: '', msg: '' });
    const r = await mfetch(`server/${gid}/settings`, { method: 'PUT', body });
    if (!alive.current) return;
    setBusy((b) => ({ ...b, save: false }));
    if (!r.ok) { setNote({ kind: 'err', msg: errText(t, r.data) }); return; }
    base.current = { require_approval: Boolean(r.data.require_approval), id: r.data.announce_channel_id || '', name: r.data.announce_channel_name || '' };
    setD({ ...base.current }); setPicking(false);
    setNote({ kind: 'ok', msg: t('servers.announceSaved') });
    onSaved?.(r.data);
  }

  function cancel() { setD({ ...base.current }); setPicking(false); setNote({ kind: '', msg: '' }); }

  return (
    <div className="space-y-4">
      {owner && (
        <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-border/60 bg-background/40 px-3 py-2.5 text-sm">
          <input type="checkbox" className="h-5 w-5 shrink-0 accent-[#e6cd8c]" checked={d.require_approval} onChange={(e) => { setD((x) => ({ ...x, require_approval: e.target.checked })); setNote({ kind: '', msg: '' }); }} />
          <span className="min-w-0 flex-1">{t('servers.require')}</span>
        </label>
      )}
      <div>
        <span className={lab} id={`ann-l-${gid}`}>{t('servers.announce')}</span>
        {!picking ? (
          <div className="flex min-h-11 items-center gap-3 rounded-xl border border-border/60 bg-background/40 px-3 py-2">
            <Hash className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate text-sm">{d.id ? (d.name || d.id) : <span className="text-muted-foreground">{t('servers.announceNone')}</span>}</span>
            <button type="button" onClick={openPicker} className={`${btn} min-h-9 shrink-0`}>{t('servers.announceChange')}</button>
          </div>
        ) : busy.load ? (
          <div role="status" className="flex min-h-11 items-center gap-2 rounded-xl border border-border/60 bg-background/40 px-3 py-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />{t('loading')}</div>
        ) : (
          <select aria-labelledby={`ann-l-${gid}`} className={`${input} min-h-11`} value={d.id} onChange={pick} autoFocus>
            <option value="">{t('servers.announceNone')}</option>
            {d.id && !(channels || []).some((c) => c.id === d.id) && <option value={d.id}>#{d.name || d.id}</option>}
            {(channels || []).map((c) => <option key={c.id} value={c.id}>#{c.name}</option>)}
          </select>
        )}
        <p className="mt-1.5 text-[11px] text-muted-foreground">{t('servers.announceHint')}</p>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border/50 pt-3">
        {note.msg && (
          <span role={note.kind === 'err' ? 'alert' : 'status'} className={`min-w-0 flex-1 justify-end text-right inline-flex items-center gap-1.5 text-xs ${note.kind === 'err' ? 'text-destructive' : 'text-emerald-300'}`}>
            {note.kind === 'ok' && <Check className="h-3.5 w-3.5" aria-hidden="true" />}{note.msg}
          </span>
        )}
        {dashLink && <Link href={`/dashboard/${gid}?module=collab`} className={`${btn} min-h-10`}><LayoutDashboard className="h-4 w-4" aria-hidden="true" />{t('servers.dashCollab')}</Link>}
        {dirty && <button type="button" onClick={cancel} disabled={busy.save} className={`${btn} min-h-10`}>{t('servers.cancel')}</button>}
        <button type="button" onClick={save} disabled={!dirty || busy.save} className={`${btnMain} min-h-10`}>
          {busy.save && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}{t('servers.save')}
        </button>
      </div>
    </div>
  );
}

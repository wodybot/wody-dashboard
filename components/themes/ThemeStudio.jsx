'use client';
// Owner Panel > Website > Themes. Theme list, Theme Studio (with Characters), Assets, Audit. Global themes can be changed by the Owner only.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import ThemeEditor from './ThemeEditor';
import { Card } from './fields';
import { themeApi, errorText } from './api';
import { ASSET_KINDS, LICENSE_TYPES, ASSET_MIN, LIMITS } from '@/lib/themes/constants';

const TABS = ['themes', 'characters', 'assets', 'audit'];
const issueText = (t, i) => { const [base, rest] = String(i).split(':'); return `${t.has(`issues.${base}`) ? t(`issues.${base}`) : base}${rest ? ` (${rest})` : ''}`; };
const clone = (v) => JSON.parse(JSON.stringify(v));
const fmt = (iso, locale) => { try { return new Date(iso).toLocaleString(locale); } catch { return iso || ''; } };
const Btn = ({ children, ...p }) => <button type="button" {...p} className={`min-h-9 rounded-lg border border-border px-3 text-sm disabled:opacity-50 ${p.className || ''}`}>{children}</button>;

function Status({ t, status }) {
  const tone = { published: 'text-emerald-400', scheduled: 'text-sky-400', preview: 'text-amber-400', disabled: 'text-red-300', archived: 'text-muted-foreground', draft: '' }[status] || '';
  return <span className={`rounded-full border border-border px-2 py-0.5 text-xs ${tone}`}>{t(`status.${status}`)}</span>;
}

export default function ThemeStudio({ writer = true }) {
  const t = useTranslations('themes');
  const locale = useLocale();
  const [tab, setTab] = useState('themes');
  const [list, setList] = useState(null);
  const [assets, setAssets] = useState([]);
  const [audit, setAudit] = useState([]);
  const [sel, setSel] = useState(null);       // full theme view
  const [cfg, setCfg] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [section, setSection] = useState('identity');
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState('');
  const readOnly = !writer;

  const loadList = useCallback(async () => {
    const [a, b] = await Promise.all([themeApi('owner/themes'), themeApi('owner/assets')]);
    if (a.ok) setList(a.data.themes); else setMsg({ bad: true, text: errorText(t, a) });
    if (b.ok) setAssets(b.data.assets);
  }, [t]);
  useEffect(() => { loadList(); }, [loadList]);
  useEffect(() => { if (tab === 'audit') themeApi('owner/audit').then((r) => r.ok && setAudit(r.data.entries)); }, [tab]);

  const open = async (id, sectionName = 'identity') => {
    if (dirty && !window.confirm(t('owner.discard'))) return;
    const r = await themeApi(`owner/themes/${id}`);
    if (!r.ok) { setMsg({ bad: true, text: errorText(t, r) }); return; }
    setSel(r.data.theme); setCfg(clone(r.data.theme.draft)); setDirty(false); setSection(sectionName); setMsg(null);
  };
  const setCfgDirty = (fn) => { setCfg((c) => (typeof fn === 'function' ? fn(c) : fn)); setDirty(true); };
  const adopt = (th) => { setSel(th); setCfg(clone(th.draft)); setDirty(false); loadList(); };

  async function act(kind, path, body, okText) {
    setBusy(kind); setMsg(null);
    const r = await themeApi(path, { method: kind === 'save' ? 'PATCH' : 'POST', body });
    setBusy('');
    if (!r.ok) {
      const list = r.issues || r.data?.issues; const extra = list ? ` ${list.map((i) => issueText(t, i)).join(' · ')}` : '';
      setMsg({ bad: true, text: errorText(t, r) + extra }); return null;
    }
    if (r.data.theme) adopt(r.data.theme);
    setMsg({ text: okText }); return r.data;
  }
  const save = () => act('save', `owner/themes/${sel.id}`, { config: cfg }, t('owner.saved'));
  const post = (sub, body, ok) => act(sub, `owner/themes/${sel.id}/${sub}`, body || {}, ok);

  if (list === null) return <p role="status" className="text-sm text-muted-foreground">{t('common.loading')}</p>;

  return (
    <div className="grid gap-4" data-theme-studio>
      <div role="tablist" aria-label={t('owner.title')} className="flex flex-wrap gap-1.5">
        {TABS.map((x) => <button key={x} role="tab" aria-selected={tab === x} type="button" onClick={() => setTab(x)} className={`min-h-9 rounded-lg border px-3 text-sm ${tab === x ? 'border-primary bg-primary/15' : 'border-border'}`}>{t(`owner.tab.${x}`)}</button>)}
      </div>
      {readOnly ? <p className="text-sm text-amber-400">{t('owner.readOnly')}</p> : null}
      {msg ? <p role={msg.bad ? 'alert' : 'status'} className={`text-sm ${msg.bad ? 'text-red-400' : 'text-emerald-400'}`}>{msg.text}</p> : null}

      {(tab === 'themes' || tab === 'characters') ? (
        <div className="grid gap-4 lg:grid-cols-[18rem_1fr]">
          <aside className="grid content-start gap-2" aria-label={t('owner.tab.themes')}>
            {writer ? <NewTheme t={t} list={list} onCreate={async (id, name, from) => { const r = await themeApi('owner/themes', { method: 'POST', body: { id, ...(from ? { from } : { name }) } }); if (!r.ok) { setMsg({ bad: true, text: errorText(t, r) }); return; } await loadList(); adopt(r.data.theme); setSection('identity'); }} /> : null}
            <ul className="grid gap-1.5">
              {list.map((th) => (
                <li key={th.id}>
                  <button type="button" onClick={() => open(th.id, tab === 'characters' ? 'character' : 'identity')} aria-current={sel?.id === th.id} className={`w-full rounded-xl border p-2.5 text-left ${sel?.id === th.id ? 'border-primary bg-primary/10' : 'border-border'}`}>
                    <span className="flex items-center justify-between gap-2"><strong className="truncate text-sm">{th.official && t.has(`official.${th.id}.name`) ? t(`official.${th.id}.name`) : th.name}</strong><Status t={t} status={th.status} /></span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">{t(`categories.${th.category}`)} · v{th.version}{th.availability === 'scheduled_wait' ? ` · ${t('owner.waiting')}` : ''}</span>
                    {th.issues.length ? <span className="mt-1 block text-xs text-amber-400">{t('owner.issuesCount', { count: th.issues.length })}</span> : null}
                  </button>
                </li>
              ))}
            </ul>
          </aside>

          <div className="grid min-w-0 content-start gap-4">
            {tab === 'characters' ? <p className="text-sm text-muted-foreground">{t('owner.charactersHint')}</p> : null}
            {!sel || !cfg ? <p className="text-sm text-muted-foreground">{t('owner.pick')}</p> : (
              <>
                <Card title={`${sel.official && t.has(`official.${sel.id}.name`) ? t(`official.${sel.id}.name`) : sel.name}`} hint={sel.official ? t('owner.officialHint') : null}>
                  <div className="flex flex-wrap items-center gap-2"><Status t={t} status={sel.status} /><span className="text-sm text-muted-foreground">v{sel.version}</span>
                    {sel.schedule ? <span className="text-sm text-sky-400">{t('owner.scheduleRange', { start: fmt(sel.schedule.start, locale), end: sel.schedule.end ? fmt(sel.schedule.end, locale) : t('owner.noEnd') })}</span> : null}
                  </div>
                  {sel.issues.length ? (
                    <div role="alert" className="rounded-xl border border-amber-400/40 bg-amber-400/10 p-3 text-sm">
                      <strong>{t('owner.blocked')}</strong>
                      <ul className="mt-1 list-disc pl-5">{sel.issues.map((i) => <li key={i}>{issueText(t, i)}</li>)}</ul>
                    </div>
                  ) : <p className="text-sm text-emerald-400">{t('owner.ready')}</p>}
                  {writer ? (
                    <div className="flex flex-wrap gap-2">
                      <Btn disabled={!dirty || Boolean(busy)} onClick={save}>{busy === 'save' ? t('common.saving') : t('owner.saveDraft')}</Btn>
                      <Btn disabled={Boolean(busy) || dirty || sel.status === 'archived'} onClick={() => post('preview', null, t('owner.previewOn'))}>{t('owner.markPreview')}</Btn>
                      <Btn disabled={Boolean(busy) || dirty || sel.status === 'archived'} onClick={() => post('publish', null, t('owner.publishedOk'))} className="border-primary bg-primary/15">{t('owner.publish')}</Btn>
                      {sel.status === 'disabled' ? <Btn disabled={Boolean(busy)} onClick={() => post('enable', null, t('owner.enabledOk'))}>{t('owner.enable')}</Btn> : <Btn disabled={Boolean(busy) || sel.status === 'archived'} onClick={() => post('disable', null, t('owner.disabledOk'))}>{t('owner.disable')}</Btn>}
                      {sel.status === 'archived' ? <Btn disabled={Boolean(busy)} onClick={() => post('unarchive', null, t('owner.unarchivedOk'))}>{t('owner.unarchive')}</Btn> : <Btn disabled={Boolean(busy)} onClick={() => window.confirm(t('owner.archiveConfirm')) && post('archive', null, t('owner.archivedOk'))}>{t('owner.archive')}</Btn>}
                      <Btn disabled={Boolean(busy)} onClick={() => post('duplicate', null, t('owner.duplicatedOk'))}>{t('owner.duplicate')}</Btn>
                    </div>
                  ) : null}
                  {writer ? <Schedule t={t} disabled={Boolean(busy) || dirty || sel.status === 'archived'} onSchedule={(start, end) => post('schedule', { start, ...(end ? { end } : {}) }, t('owner.scheduledOk'))} /> : null}
                </Card>
                <ThemeEditor theme={sel} cfg={cfg} setCfg={setCfgDirty} assets={assets} section={tab === 'characters' ? 'character' : section} setSection={setSection} only={tab === 'characters' ? 'character' : null} readOnly={readOnly || sel.status === 'archived'} />
                <Card title={t('owner.versions')}>
                  {sel.versions.length === 0 ? <p className="text-sm text-muted-foreground">{t('owner.noVersions')}</p> : (
                    <ul className="grid gap-1.5">{sel.versions.map((v) => <li key={v.v} className="flex flex-wrap items-center justify-between gap-2 text-sm"><span>v{v.v} · {fmt(v.at, locale)} · {v.by}</span>{writer ? <Btn disabled={Boolean(busy)} onClick={() => window.confirm(t('owner.restoreConfirm', { v: v.v })) && post('restore', { version: v.v }, t('owner.restoredOk'))}>{t('owner.restore')}</Btn> : null}</li>)}</ul>
                  )}
                </Card>
                <Card title={t('owner.history')}>
                  <ul className="grid gap-1 text-sm text-muted-foreground">{sel.history.map((h, i) => <li key={i}>{fmt(h.at, locale)} · {h.by} · {h.action}{h.detail ? ` · ${h.detail}` : ''}</li>)}</ul>
                </Card>
              </>
            )}
          </div>
        </div>
      ) : null}

      {tab === 'assets' ? <Assets t={t} locale={locale} assets={assets} writer={writer} reload={loadList} setMsg={setMsg} /> : null}

      {tab === 'audit' ? (
        <Card title={t('owner.tab.audit')} hint={t('owner.auditHint')}>
          {audit.length === 0 ? <p className="text-sm text-muted-foreground">{t('owner.noAudit')}</p> : (
            <div className="overflow-x-auto"><table className="w-full text-left text-sm">
              <thead><tr><th className="py-1 pr-3">{t('owner.at')}</th><th className="pr-3">{t('owner.admin')}</th><th className="pr-3">{t('owner.action')}</th><th className="pr-3">{t('owner.theme')}</th><th className="pr-3">{t('owner.result')}</th><th>{t('owner.detail')}</th></tr></thead>
              <tbody>{audit.map((a, i) => <tr key={i} className="border-t border-border"><td className="py-1 pr-3 whitespace-nowrap">{fmt(a.at, locale)}</td><td className="pr-3">{a.actor}</td><td className="pr-3">{a.action}</td><td className="pr-3">{a.theme}</td><td className={`pr-3 ${a.result === 'ok' ? 'text-emerald-400' : 'text-red-300'}`}>{a.result === 'ok' ? t('owner.ok') : t('owner.denied')}</td><td>{a.detail}</td></tr>)}</tbody>
            </table></div>
          )}
        </Card>
      ) : null}
    </div>
  );
}

function NewTheme({ t, list, onCreate }) {
  const [id, setId] = useState(''); const [name, setName] = useState(''); const [from, setFrom] = useState('');
  const ok = /^[a-z][a-z0-9_]{2,39}$/.test(id) && (from || name.trim());
  return (
    <div className="grid gap-1.5 rounded-xl border border-border p-2.5">
      <strong className="text-sm">{t('owner.newTheme')}</strong>
      <input aria-label={t('owner.themeId')} placeholder={t('owner.themeId')} value={id} onChange={(e) => setId(e.target.value.toLowerCase())} className="min-h-9 rounded-lg border border-border bg-background px-2 text-sm" />
      <input aria-label={t('editor.name')} placeholder={t('editor.name')} maxLength={LIMITS.name} value={name} onChange={(e) => setName(e.target.value)} className="min-h-9 rounded-lg border border-border bg-background px-2 text-sm" />
      <select aria-label={t('owner.copyFrom')} value={from} onChange={(e) => setFrom(e.target.value)} className="min-h-9 rounded-lg border border-border bg-background px-2 text-sm">
        <option value="">{t('owner.blank')}</option>
        {list.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
      </select>
      <Btn disabled={!ok} onClick={() => { onCreate(id, name.trim(), from); setId(''); setName(''); setFrom(''); }}>{t('owner.create')}</Btn>
    </div>
  );
}

function Schedule({ t, disabled, onSchedule }) {
  const [start, setStart] = useState(''); const [end, setEnd] = useState('');
  return (
    <div className="flex flex-wrap items-end gap-2">
      <label className="grid gap-1 text-sm">{t('owner.scheduleStart')}<input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} className="min-h-9 rounded-lg border border-border bg-background px-2" /></label>
      <label className="grid gap-1 text-sm">{t('owner.scheduleEnd')}<input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} className="min-h-9 rounded-lg border border-border bg-background px-2" /></label>
      <Btn disabled={disabled || !start} onClick={() => onSchedule(new Date(start).toISOString(), end ? new Date(end).toISOString() : null)}>{t('owner.schedule')}</Btn>
    </div>
  );
}

function Assets({ t, locale, assets, writer, reload, setMsg }) {
  const [form, setForm] = useState({ kind: 'character', name: '', license_type: 'owned', license_source: '', license_confirmed: false });
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const min = ASSET_MIN[form.kind];
  const ok = file && form.name.trim() && form.license_source.trim() && form.license_confirmed;
  async function upload() {
    setBusy(true); setMsg(null);
    const fd = new FormData();
    fd.set('file', file); for (const [k, v] of Object.entries(form)) fd.set(k, String(v));
    const r = await themeApi('owner/assets', { method: 'POST', form: fd });
    setBusy(false);
    if (!r.ok) { setMsg({ bad: true, text: `${errorText(t, r)}${r.data?.min ? ` (${r.data.min})` : ''}` }); return; }
    setMsg({ text: t('assets.uploaded') }); setFile(null); setForm((f) => ({ ...f, name: '', license_source: '', license_confirmed: false })); reload();
  }
  async function remove(a) {
    if (!window.confirm(t('assets.deleteConfirm', { name: a.name }))) return;
    const r = await themeApi(`owner/assets/${a.id}`, { method: 'DELETE' });
    if (!r.ok) setMsg({ bad: true, text: errorText(t, r) }); else { setMsg({ text: t('assets.deleted') }); reload(); }
  }
  return (
    <div className="grid gap-4">
      {writer ? (
        <Card title={t('assets.upload')} hint={t('assets.rules')}>
          <label className="grid gap-1 text-sm">{t('assets.kind')}<select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })} className="min-h-9 rounded-lg border border-border bg-background px-2">{ASSET_KINDS.map((k) => <option key={k} value={k}>{t(`assets.kinds.${k}`)}</option>)}</select></label>
          <p className="text-xs text-muted-foreground">{t('assets.minimum', { size: `${min.w}x${min.h}` })}{min.alpha ? ` · ${t('assets.needsAlpha')}` : ''}</p>
          <label className="grid gap-1 text-sm">{t('editor.name')}<input maxLength={LIMITS.name} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="min-h-9 rounded-lg border border-border bg-background px-2" /></label>
          <label className="grid gap-1 text-sm">{t('assets.file')}<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => setFile(e.target.files?.[0] || null)} className="text-sm" /></label>
          <label className="grid gap-1 text-sm">{t('assets.licenseType')}<select value={form.license_type} onChange={(e) => setForm({ ...form, license_type: e.target.value })} className="min-h-9 rounded-lg border border-border bg-background px-2">{LICENSE_TYPES.map((k) => <option key={k} value={k}>{t(`assets.licenses.${k}`)}</option>)}</select></label>
          <label className="grid gap-1 text-sm">{t('assets.licenseSource')}<input maxLength={LIMITS.license} value={form.license_source} onChange={(e) => setForm({ ...form, license_source: e.target.value })} className="min-h-9 rounded-lg border border-border bg-background px-2" /></label>
          <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={form.license_confirmed} onChange={(e) => setForm({ ...form, license_confirmed: e.target.checked })} className="mt-0.5 h-5 w-5" />{t('assets.licenseConfirm')}</label>
          <Btn disabled={!ok || busy} onClick={upload} className="justify-self-start border-primary bg-primary/15">{busy ? t('common.saving') : t('assets.uploadBtn')}</Btn>
        </Card>
      ) : null}
      <Card title={t('assets.library')}>
        {assets.length === 0 ? <p className="text-sm text-muted-foreground">{t('assets.none')}</p> : (
          <ul className="grid gap-2 sm:grid-cols-2">{assets.map((a) => (
            <li key={a.id} className="rounded-xl border border-border p-3 text-sm">
              <strong>{a.name}</strong> <span className="text-xs text-muted-foreground">{t(`assets.kinds.${a.kind}`)}</span>
              <div className="text-xs text-muted-foreground">{a.width}x{a.height} · {(a.bytes / 1024).toFixed(0)} KB · {a.mime.replace('image/', '')} · {a.has_alpha ? t('assets.transparent') : t('assets.opaque')}</div>
              <div className="text-xs text-muted-foreground">{t(`assets.licenses.${a.license.type}`)} · {a.license.source}</div>
              {a.warnings.includes('heavy') ? <div className="text-xs text-amber-400">{t('assets.heavy')}</div> : null}
              <div className="text-xs">{a.used_by.length ? t('assets.usedBy', { themes: a.used_by.join(', ') }) : t('assets.unused')}</div>
              {writer ? <Btn onClick={() => remove(a)} disabled={a.used_by.length > 0} className="mt-2">{t('assets.delete')}</Btn> : null}
            </li>
          ))}</ul>
        )}
      </Card>
    </div>
  );
}

'use client';
// Owner Panel > Battle Pass > Page Studio. One public page per season: pick a season, edit its draft, preview it at three sizes,
// then publish, schedule, unpublish, disable or archive it. The public page never changes until the owner publishes.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ConfirmDialog, Field, LoadingOrError, ModuleTabs, Section, formatDate } from '@/components/module-kit';
import WodyIcon from '@/components/wody-icon';
import { ic } from '@/components/gifstudio/gs-kit';
import { bp } from '../bp-kit';
import ThemeTab from '../editor/ThemeTab';
import { PRESET_THEMES } from '@/lib/battlepass/studio/constants';
import { normalizeTheme } from '@/lib/battlepass/page-theme';
import { SectionsTab, ContentTab, SeoTab, icn } from './EditorTabs';

const STATUS_ICON = { draft: 'draft', generating: 'generating', ready: 'ready', published: 'published', scheduled: 'scheduled', archived: 'archived', disabled: 'disabled', failed: 'failed' };
const STATUS_TONE = { published: 'text-emerald-300 border-emerald-400/40', scheduled: 'text-sky-300 border-sky-400/40', failed: 'text-red-300 border-red-400/40', disabled: 'text-amber-300 border-amber-400/40', archived: 'text-muted-foreground border-border/60' };

function Status({ status }) {
  const t = useTranslations('bpStudio');
  if (!status) return <span className="text-xs text-muted-foreground">{t('ui.status.none')}</span>;
  return <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs ${STATUS_TONE[status] || 'border-border/60'}`}><WodyIcon name={STATUS_ICON[status]} size={14} />{t(`ui.status.${status}`)}</span>;
}

function useStudioError() {
  const t = useTranslations('bpStudio');
  return useCallback((code) => (code && t.has(`err.${code}`) ? t(`err.${code}`) : t('err.generic')), [t]);
}

const ZOOM = { desktop: 1280, tablet: 820, mobile: 390 };

function Preview({ sid, cfg }) {
  const t = useTranslations('bpStudio');
  const locale = useLocale();
  const [device, setDevice] = useState('desktop');
  const frame = useRef(null);
  const ready = useRef(false);
  const [box, setBox] = useState(0);
  const wrap = useRef(null);
  const post = useCallback(() => { if (ready.current && frame.current?.contentWindow) frame.current.contentWindow.postMessage({ type: 'wody-studio-config', config: cfg }, window.location.origin); }, [cfg]);
  useEffect(() => {
    const onMsg = (e) => { if (e.origin === window.location.origin && e.source === frame.current?.contentWindow && e.data?.type === 'wody-studio-ready') { ready.current = true; post(); } };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, [post]);
  useEffect(() => { const id = setTimeout(post, 250); return () => clearTimeout(id); }, [post]);
  useEffect(() => {
    if (!wrap.current) return undefined;
    const ro = new ResizeObserver(([e]) => setBox(e.contentRect.width));
    ro.observe(wrap.current);
    return () => ro.disconnect();
  }, []);
  const width = ZOOM[device];
  const scale = box ? Math.min(1, box / width) : 1;
  const src = `${locale === 'en' ? '' : `/${locale}`}/battlepass/preview/${sid}`;
  return (
    <Card className="p-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-medium"><WodyIcon name="preview" size={18} />{t('ui.preview.title')}</p>
        <div role="group" aria-label={t('ui.preview.device')} className="flex gap-1">
          {Object.keys(ZOOM).map((d) => (
            <Button key={d} type="button" size="sm" variant={device === d ? 'default' : 'outline'} aria-pressed={device === d} onClick={() => setDevice(d)}>{t(`ui.preview.${d}`)}</Button>
          ))}
        </div>
      </div>
      <div ref={wrap} className="w-full overflow-hidden rounded-lg border border-border/50 bg-black/30" style={{ height: 560 * scale + 8 }}>
        <iframe ref={frame} title={t('ui.preview.title')} src={src} onLoad={() => { ready.current = false; }} sandbox="allow-scripts allow-same-origin" referrerPolicy="same-origin"
          style={{ width, height: 560 / scale, transform: `scale(${scale})`, transformOrigin: '0 0', border: 0 }} />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{t('ui.preview.note')}</p>
    </Card>
  );
}

function ThemePresets({ onPick }) {
  const t = useTranslations('bpStudio');
  return (
    <Section title={t('ui.presets.title')} description={t('ui.presets.intro')} icon={icn('theme')}>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {Object.entries(PRESET_THEMES).map(([name, p]) => (
          <button key={name} type="button" onClick={() => onPick(name)} className="rounded-xl border border-border/60 p-2 text-left text-xs transition hover:border-[#e6cd8c]/70">
            <span className="block h-10 rounded-lg" style={{ background: p.mode === 'solid' ? p.from : `linear-gradient(135deg, ${p.from}, ${p.to})`, boxShadow: `inset 0 -3px 0 ${p.accent}` }} />
            <span className="mt-1.5 block">{t(`ui.presets.${name}`)}</span>
          </button>
        ))}
      </div>
    </Section>
  );
}

function PublishTab({ page, readiness, busy, act, errText }) {
  const t = useTranslations('bpStudio');
  const locale = useLocale();
  const [when, setWhen] = useState('');
  const [channel, setChannel] = useState('');
  const [note, setNote] = useState('');
  const [confirm, setConfirm] = useState(null);
  const st = page.status;
  const live = st === 'published';
  const origin = typeof window === 'undefined' ? '' : window.location.origin;
  const url = `${origin}/battlepass/${page.slug}`;
  const checks = readiness?.checks || [];
  return (
    <div className="space-y-6">
      <Section title={t('ui.publish.title')} description={t('ui.publish.intro')} icon={icn('publish')}>
        <div className="flex flex-wrap items-center gap-3"><Status status={st} />{page.published_version ? <span className="text-xs text-muted-foreground">{t('ui.publish.version', { v: page.published_version })}</span> : null}
          {live ? <a className="text-sm underline" href={url} target="_blank" rel="noopener noreferrer">{url}</a> : null}</div>
        {page.schedule_at ? <p className="text-sm text-sky-300">{t('ui.publish.scheduledFor', { date: formatDate(page.schedule_at, locale) })}</p> : null}
        {page.error ? <p className="text-sm text-red-400">{errText(page.error)}</p> : null}
        <ul className="grid gap-1.5 text-sm sm:grid-cols-2">
          {checks.map((c) => <li key={c.id} className="flex items-center gap-2"><WodyIcon name={c.ok ? 'success' : 'warning'} size={16} />{t(`ui.checks.${c.id}`)}</li>)}
        </ul>
        {!readiness?.ok ? <p className="text-sm text-amber-300">{t('ui.publish.incomplete')}</p> : null}
        <Field label={t('ui.publish.note')}><Input value={note} maxLength={120} onChange={(e) => setNote(e.target.value)} placeholder={t('ui.publish.notePlaceholder')} /></Field>
        <div className="flex flex-wrap gap-2">
          <Button disabled={busy || !readiness?.ok || ['disabled', 'archived'].includes(st)} onClick={() => act('publish', { note })}><WodyIcon name="publish" size={16} className="mr-2" />{live ? t('ui.publish.update') : t('ui.publish.publish')}</Button>
          <Button variant="outline" disabled={busy || !(live || st === 'scheduled')} onClick={() => setConfirm('unpublish')}><WodyIcon name="reset" size={16} className="mr-2" />{t('ui.publish.unpublish')}</Button>
          {st === 'disabled'
            ? <Button variant="outline" disabled={busy} onClick={() => act('enable')}><WodyIcon name="enabled" size={16} className="mr-2" />{t('ui.publish.enable')}</Button>
            : <Button variant="outline" disabled={busy || st === 'archived'} onClick={() => setConfirm('disable')}><WodyIcon name="disabled" size={16} className="mr-2" />{t('ui.publish.disable')}</Button>}
          {st === 'archived'
            ? <Button variant="outline" disabled={busy} onClick={() => act('unarchive')}><WodyIcon name="restore" size={16} className="mr-2" />{t('ui.publish.unarchive')}</Button>
            : <Button variant="outline" disabled={busy} onClick={() => setConfirm('archive')}><WodyIcon name="archived" size={16} className="mr-2" />{t('ui.publish.archive')}</Button>}
          <Button variant="outline" disabled={busy} onClick={() => setConfirm('regenerate')}><WodyIcon name="regenerate" size={16} className="mr-2" />{t('ui.publish.regenerate')}</Button>
        </div>
      </Section>

      <Section title={t('ui.schedule.title')} description={t('ui.schedule.intro')} icon={icn('calendar')}>
        <div className="flex flex-wrap items-end gap-3">
          <Field label={t('ui.schedule.when')}><Input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} /></Field>
          <Button variant="outline" disabled={busy || !when || !readiness?.ok} onClick={() => act('schedule', { schedule_at: new Date(when).toISOString() })}><WodyIcon name="scheduled" size={16} className="mr-2" />{t('ui.schedule.button')}</Button>
        </div>
      </Section>

      <Section title={t('ui.announce.title')} description={t('ui.announce.intro')} icon={icn('discord')}>
        <div className="flex flex-wrap items-end gap-3">
          <Field label={t('ui.announce.channel')} hint={t('ui.announce.hint')}><Input inputMode="numeric" value={channel} onChange={(e) => setChannel(e.target.value.replace(/\D/g, '').slice(0, 25))} placeholder="123456789012345678" /></Field>
          <Button variant="outline" disabled={busy || !live || channel.length < 15} onClick={() => act('announce', { channel_id: channel }, t('ui.announce.sent'))}><WodyIcon name="discord" size={16} className="mr-2" />{t('ui.announce.button')}</Button>
        </div>
        {!live ? <p className="text-xs text-muted-foreground">{t('ui.announce.needsPublished')}</p> : null}
      </Section>

      <ConfirmDialog open={Boolean(confirm)} onOpenChange={(o) => { if (!o) setConfirm(null); }} icon={<WodyIcon name="warning" size={20} />} destructive={confirm !== 'regenerate'}
        title={confirm ? t(`ui.confirm.${confirm}.title`) : ''} description={confirm ? t(`ui.confirm.${confirm}.text`) : ''} confirmLabel={confirm ? t(`ui.confirm.${confirm}.button`) : ''} busy={busy}
        onConfirm={async () => { const c = confirm; setConfirm(null); await act(c); }} />
    </div>
  );
}

function VersionsTab({ page, cfg, busy, act, dirty }) {
  const t = useTranslations('bpStudio');
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [restoreV, setRestoreV] = useState(null);
  const pub = page.published;
  // Compare draft and published, section by section: a short list of what differs, not a raw diff.
  const diff = useMemo(() => {
    if (!pub) return null;
    const out = [];
    for (const k of ['sections', 'theme', 'layout', 'hero', 'overview', 'faq', 'footer', 'seo', 'discord']) if (JSON.stringify(pub[k]) !== JSON.stringify(cfg[k])) out.push(k);
    return out;
  }, [pub, cfg]);
  return (
    <div className="space-y-6">
      <Section title={t('ui.compare.title')} description={t('ui.compare.intro')} icon={icn('history')}>
        {!pub ? <p className="text-sm text-muted-foreground">{t('ui.compare.neverPublished')}</p>
          : diff.length === 0 ? <p className="flex items-center gap-2 text-sm"><WodyIcon name="success" size={16} />{t('ui.compare.same')}</p>
            : <ul className="flex flex-wrap gap-2">{diff.map((k) => <li key={k} className="rounded-full border border-amber-400/40 px-2.5 py-0.5 text-xs text-amber-300">{t(`ui.compare.parts.${k}`)}</li>)}</ul>}
        {dirty ? <p className="text-xs text-muted-foreground">{t('ui.compare.unsaved')}</p> : null}
      </Section>
      <Section title={t('ui.versions.title')} description={t('ui.versions.intro')} icon={icn('restore')}>
        {page.versions.length === 0 ? <p className="text-sm text-muted-foreground">{t('ui.versions.empty')}</p> : (
          <ul className="space-y-2">
            {page.versions.map((v) => (
              <li key={v.v} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/50 bg-secondary/10 px-3 py-2 text-sm">
                <span>{t('ui.versions.row', { v: v.v, date: formatDate(v.at, locale) })}{v.note ? ` · ${v.note}` : ''}{v.v === page.published_version ? ` · ${t('ui.versions.live')}` : ''}</span>
                <Button size="sm" variant="outline" disabled={busy} onClick={() => setRestoreV(v.v)}><WodyIcon name="restore" size={14} className="mr-1.5" />{t('ui.versions.restore')}</Button>
              </li>
            ))}
          </ul>
        )}
      </Section>
      <Section title={t('ui.history.title')} description={t('ui.history.intro')} icon={icn('audit')}>
        <button type="button" className="text-sm underline" onClick={() => setOpen(!open)}>{open ? t('ui.history.hide') : t('ui.history.show', { n: page.history.length })}</button>
        {open ? <ul className="space-y-1 text-xs text-muted-foreground">{page.history.map((h, i) => <li key={i}>{formatDate(h.at, locale)} · {t.has(`ui.history.actions.${h.action}`) ? t(`ui.history.actions.${h.action}`) : h.action}{h.detail ? ` · ${h.detail}` : ''}</li>)}</ul> : null}
      </Section>
      <ConfirmDialog open={restoreV !== null} onOpenChange={(o) => { if (!o) setRestoreV(null); }} icon={<WodyIcon name="restore" size={20} />} destructive={false}
        title={t('ui.versions.restoreTitle')} description={t('ui.versions.restoreText', { v: restoreV ?? '' })} confirmLabel={t('ui.versions.restore')} busy={busy}
        onConfirm={async () => { const v = restoreV; setRestoreV(null); await act('restore', { version: v }); }} />
    </div>
  );
}

function Editor({ sid, onBack }) {
  const t = useTranslations('bpStudio');
  const errText = useStudioError();
  const [state, setState] = useState({ loading: true, error: null, page: null, readiness: null });
  const [cfg, setCfg] = useState(null);
  const [slug, setSlug] = useState('');
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [fieldErr, setFieldErr] = useState(null);
  const [tab, setTab] = useState('sections');
  const origin = typeof window === 'undefined' ? '' : window.location.origin;

  const apply = useCallback((d, keepDraft = false) => {
    setState({ loading: false, error: null, page: d.page, readiness: d.readiness });
    if (!keepDraft) { setCfg(d.page.draft); setSlug(d.page.slug); setDirty(false); }
  }, []);
  const load = useCallback(async () => {
    const r = await bp(`owner/pages/${sid}`);
    if (r.ok) apply(r.data); else setState({ loading: false, error: errText(r.data?.error), page: null, readiness: null });
  }, [sid, apply, errText]);
  useEffect(() => { load(); }, [load]);

  const set = (key, value) => { setCfg((c) => ({ ...c, [key]: value })); setDirty(true); setFieldErr(null); };
  const themeDraft = useMemo(() => ({ page: cfg ? normalizeTheme(cfg.theme) : {} }), [cfg]);
  const setTheme = (path, value) => { const k = path.replace(/^page\./, ''); setCfg((c) => ({ ...c, theme: { ...c.theme, [k]: value } })); setDirty(true); setFieldErr(null); };

  async function save() {
    setBusy(true); setFieldErr(null);
    const body = { config: cfg };
    if (state.page && slug !== state.page.slug) body.slug = slug;
    const r = await bp(`owner/pages/${sid}`, { method: 'PATCH', body });
    setBusy(false);
    if (r.ok) { apply(r.data); toast.success(t('ui.saved')); return true; }
    setFieldErr({ field: r.data?.field || null, code: r.data?.error });
    toast.error(errText(r.data?.error));
    return false;
  }
  async function act(action, body, okText) {
    // the server publishes the saved draft, so unsaved edits are saved first
    if (dirty && ['publish', 'schedule'].includes(action) && !(await save())) return;
    setBusy(true);
    const r = await bp(`owner/pages/${sid}/${action}`, { method: 'POST', body: body || {} });
    setBusy(false);
    if (r.ok) { apply(r.data, dirty && !['restore', 'regenerate'].includes(action)); toast.success(okText || t(`ui.done.${action}`)); } else toast.error(errText(r.data?.error));
  }

  const errMsg = fieldErr ? errText(fieldErr.code) : '';
  if (state.loading || state.error || !cfg) return <LoadingOrError loading={state.loading} error={state.error} onRetry={load} data={cfg} />;
  const { page, readiness } = state;
  const tabs = [['sections', 'module'], ['content', 'edit'], ['theme', 'theme'], ['seo', 'seo'], ['versions', 'history'], ['publish', 'publish']].map(([key, icon]) => ({ key, icon: ic(icon), label: t(`ui.tabs.${key}`) }));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack}><WodyIcon name="back" size={16} className="mr-1.5" />{t('ui.back')}</Button>
          <h2 className="truncate text-lg font-semibold">{page.season.name}</h2>
          <Status status={page.status} />
        </div>
        <div className="flex items-center gap-2">
          {dirty ? <span className="text-xs text-amber-300">{t('ui.unsaved')}</span> : null}
          <Button disabled={busy || !dirty} onClick={save}><WodyIcon name="save" size={16} className="mr-2" />{t('ui.save')}</Button>
        </div>
      </div>
      <ModuleTabs tabs={tabs} active={tab} onChange={setTab} />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="min-w-0">
          {tab === 'sections' && <SectionsTab cfg={cfg} set={set} fieldErr={fieldErr} errText={errMsg} />}
          {tab === 'content' && <ContentTab cfg={cfg} set={set} fieldErr={fieldErr} errText={errMsg} />}
          {tab === 'theme' && (
            <div className="space-y-6">
              <ThemePresets onPick={(name) => { setCfg((c) => ({ ...c, theme: { ...PRESET_THEMES[name] } })); setDirty(true); }} />
              <ThemeTab draft={themeDraft} set={setTheme} errors={fieldErr?.code === 'invalid_theme' ? [{ field: 'page', code: 'invalid' }] : []} hideSections />
              {fieldErr?.code === 'low_contrast' ? <p className="text-sm text-red-400">{errMsg}</p> : null}
            </div>
          )}
          {tab === 'seo' && <SeoTab cfg={cfg} set={set} slug={slug} setSlug={(v) => { setSlug(v); setDirty(true); setFieldErr(null); }} slugLocked={page.status === 'published'} fieldErr={fieldErr} errText={errMsg} origin={origin} />}
          {tab === 'versions' && <VersionsTab page={page} cfg={cfg} busy={busy} act={act} dirty={dirty} />}
          {tab === 'publish' && <PublishTab page={page} readiness={readiness} busy={busy} act={act} errText={errText} />}
        </div>
        <div className="min-w-0 xl:sticky xl:top-4 xl:self-start"><Preview sid={sid} cfg={cfg} /></div>
      </div>
    </div>
  );
}

export default function PageStudio() {
  const t = useTranslations('bpStudio');
  const errText = useStudioError();
  const locale = useLocale();
  const [sid, setSid] = useState(null);
  const [state, setState] = useState({ loading: true, error: null, rows: [] });
  const load = useCallback(async () => {
    const r = await bp('owner/pages');
    setState({ loading: false, error: r.ok ? null : errText(r.data?.error), rows: r.ok ? r.data.pages : [] });
  }, [errText]);
  useEffect(() => { if (!sid) load(); }, [sid, load]);
  if (sid) return <Editor sid={sid} onBack={() => setSid(null)} />;
  return (
    <LoadingOrError loading={state.loading} error={state.error} onRetry={load} data={state.rows}>
      <Section title={t('ui.list.title')} description={t('ui.list.intro')} icon={icn('studio')}>
        {state.rows.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center"><WodyIcon name="battlepass" size={36} /><p className="text-sm text-muted-foreground">{t('ui.list.empty')}</p></div>
        ) : (
          <ul className="space-y-2">
            {state.rows.map((r) => (
              <li key={r.season_id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/50 bg-secondary/10 p-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{r.season.name}</p>
                  <p className="text-xs text-muted-foreground">{t(`ui.list.scope.${r.season.scope}`)} · {t('ui.list.counts', { levels: r.season.level_count, rewards: r.season.rewards_count })}{r.path ? ` · ${r.path}` : ''}</p>
                </div>
                <div className="flex items-center gap-3">
                  <Status status={r.status} />
                  {!r.eligible && !r.status ? <span className="text-xs text-amber-300">{t('ui.list.incomplete')}</span> : null}
                  <Button size="sm" variant="outline" disabled={!r.status && !r.eligible} onClick={() => setSid(r.season_id)}><WodyIcon name="edit" size={14} className="mr-1.5" />{t('ui.list.open')}</Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </LoadingOrError>
  );
}

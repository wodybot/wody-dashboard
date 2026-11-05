'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import {
  AlertTriangle, ArrowLeft, ArrowLeftRight, CheckCircle2, Gauge, History, Languages, Loader2, Pause, Play, Plus, RefreshCw, Save, ShieldCheck, Trash2, XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { SectionHeader, Empty, Skeleton, SaveBar } from '@/components/dashboard-kit';
import { ConfirmDialog, Field, ModuleTabs, NativeSelect, Section, SwitchRow, formatDate } from '@/components/module-kit';

// Wody Link talks to its own API (/api/link): ownership is checked there, per request, against live Discord data.
// Nothing here polls: data is read on open and after a change the user made.
async function lk(path, { method = 'GET', body } = {}) {
  try {
    const res = await fetch(`/api/link/${path}`, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  } catch {
    return { ok: false, status: 0, data: { error: 'unreachable' } };
  }
}

const STATUS_TONE = {
  active: 'border-emerald-400/40 bg-emerald-500/10 text-emerald-300',
  paused: 'border-border/60 bg-secondary/40 text-muted-foreground',
  suspended: 'border-red-400/40 bg-red-500/10 text-red-300',
  degraded: 'border-amber-400/40 bg-amber-500/10 text-amber-300',
};
const STEPS = ['serverA', 'channelA', 'serverB', 'channelB', 'options', 'checks', 'confirm'];
const LANG_LABEL = {
  en: 'English', ro: 'Română', fr: 'Français', it: 'Italiano', de: 'Deutsch', es: 'Español', pt: 'Português', nl: 'Nederlands', tr: 'Türkçe', pl: 'Polski', ru: 'Русский',
  uk: 'Українська', cs: 'Čeština', hu: 'Magyar', bg: 'Български', el: 'Ελληνικά', sv: 'Svenska', ar: 'العربية', zh: '中文', ja: '日本語', ko: '한국어',
};

function useLinkErrors() {
  const t = useTranslations('guildSettings.link');
  return useCallback((code) => (code && t.has(`errors.${code}`) ? t(`errors.${code}`) : t('errors.generic')), [t]);
}

function StatusBadge({ status }) {
  const t = useTranslations('guildSettings.link');
  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${STATUS_TONE[status] || STATUS_TONE.paused}`}>{t(`status.${status}`)}</span>;
}

export default function LinkPanel({ guildId }) {
  const t = useTranslations('guildSettings.link');
  const errText = useLinkErrors();
  const [state, setState] = useState({ loading: true, error: null, bridges: [], summary: null, caps: null });
  const [openId, setOpenId] = useState(null);
  const [wizard, setWizard] = useState(false);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    const [list, caps] = await Promise.all([lk('bridges'), lk('capabilities')]);
    if (!alive.current) return;
    if (!list.ok) { setState((s) => ({ ...s, loading: false, error: list.data?.error || 'generic' })); return; }
    setState({ loading: false, error: null, bridges: list.data.bridges || [], summary: list.data.summary, caps: caps.ok ? caps.data : null });
  }, []);
  useEffect(() => { load(); }, [load]);

  if (state.loading && !state.summary) return <Skeleton />;
  if (state.error && !state.summary) {
    return (
      <Card className="space-y-3 p-8 text-center">
        <AlertTriangle className="mx-auto h-7 w-7 text-amber-400" />
        <p className="text-sm text-muted-foreground">{errText(state.error)}</p>
        <Button variant="outline" onClick={load} className="gap-2"><RefreshCw className="h-4 w-4" />{t('retry')}</Button>
      </Card>
    );
  }

  const open = state.bridges.find((b) => b.id === openId);
  if (openId && open) {
    return <BridgeDetail bridge={open} caps={state.caps} onBack={() => setOpenId(null)} onChanged={load} onDeleted={() => { setOpenId(null); load(); }} />;
  }

  const { summary } = state;
  return (
    <div>
      <SectionHeader
        title={t('title')}
        description={t('description')}
        action={<Button onClick={() => setWizard(true)} className="gradient-primary gap-2 self-start"><Plus className="h-4 w-4" />{t('new')}</Button>}
      />
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {['total', 'active', 'paused', 'attention'].map((k) => (
          <Card key={k} className="bg-card/60 p-4">
            <div className="text-2xl font-bold">{summary?.[k] ?? 0}</div>
            <div className="text-xs text-muted-foreground">{t(`summary.${k}`)}</div>
          </Card>
        ))}
      </div>

      {state.bridges.length === 0 ? (
        <Empty
          title={t('empty.title')}
          text={t('empty.text')}
          action={<Button onClick={() => setWizard(true)} className="gradient-primary gap-2"><Plus className="h-4 w-4" />{t('new')}</Button>}
        />
      ) : (
        <div className="space-y-3">
          {state.bridges.map((b) => <BridgeCard key={b.id} bridge={b} onOpen={() => setOpenId(b.id)} />)}
        </div>
      )}

      {wizard ? (
        <Wizard
          open={wizard} onOpenChange={setWizard} caps={state.caps} startGuildId={guildId}
          onCreated={(bridge) => { setWizard(false); toast.success(t('wizard.created')); load().then(() => setOpenId(bridge.id)); }}
        />
      ) : null}
    </div>
  );
}

function SideLine({ side, t }) {
  if (!side.owned) return <span className="truncate text-muted-foreground">{side.guild_name || t('otherOwner')} · {t('otherOwnerHint')}</span>;
  return <span className="truncate"><span className="font-medium">{side.guild_name || side.guild_id}</span> <span className="text-muted-foreground">#{side.channel_name || side.channel_id}</span></span>;
}

function BridgeCard({ bridge, onOpen }) {
  const t = useTranslations('guildSettings.link');
  const locale = useLocale();
  return (
    <Card className="bg-card/60 p-4 sm:p-5">
      <button type="button" onClick={onOpen} className="block w-full text-left">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold">{bridge.name}</span>
          <StatusBadge status={bridge.status} />
          {bridge.translation_enabled ? <Badge variant="outline" className="gap-1"><Languages className="h-3 w-3" />{t('translation.badge')}</Badge> : null}
        </div>
        <div className="mt-2 flex flex-col gap-1 text-sm sm:flex-row sm:items-center sm:gap-3">
          <SideLine side={bridge.a} t={t} />
          <ArrowLeftRight className="hidden h-4 w-4 shrink-0 text-muted-foreground sm:block" />
          <SideLine side={bridge.b} t={t} />
        </div>
        <div className="mt-2 text-xs text-muted-foreground">
          {bridge.status_reason ? <span className="mr-2 text-amber-300">{t.has(`reason.${bridge.status_reason}`) ? t(`reason.${bridge.status_reason}`) : t('status.degraded')}</span> : null}
          {bridge.last_activity_at ? t('lastActivity', { date: formatDate(bridge.last_activity_at, locale) }) : t('noActivity')}
        </div>
      </button>
    </Card>
  );
}

// ------------------------------------------------------------------------------------------------ detail
function BridgeDetail({ bridge: listed, caps, onBack, onChanged, onDeleted }) {
  const t = useTranslations('guildSettings.link');
  const errText = useLinkErrors();
  const [tab, setTab] = useState('overview');
  const [full, setFull] = useState(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(null);

  const reload = useCallback(async () => {
    const r = await lk(`bridges/${listed.id}`);
    if (r.ok) setFull(r.data);
  }, [listed.id]);
  useEffect(() => { reload(); }, [reload]);

  const bridge = full?.bridge || listed;
  const act = async (path, method, okKey) => {
    setBusy(true);
    const r = await lk(`bridges/${bridge.id}${path}`, { method });
    setBusy(false);
    if (!r.ok) { toast.error(errText(r.data?.error)); return false; }
    if (okKey) toast.success(t(okKey));
    return true;
  };

  const doPause = async () => { if (await act('/pause', 'POST', 'toast.paused')) { await reload(); onChanged(); } };
  const doResume = async () => {
    if (await act('/resume', 'POST', 'toast.resumed')) { await reload(); onChanged(); }
  };
  const doDelete = async () => {
    if (await act('', 'DELETE', 'toast.deleted')) { setConfirm(null); onDeleted(); }
  };

  const tabs = [
    { key: 'overview', label: t('tabs.overview'), icon: Gauge },
    ...(bridge.manage ? [{ key: 'translation', label: t('tabs.translation'), icon: Languages }, { key: 'antispam', label: t('tabs.antispam'), icon: ShieldCheck }] : []),
    { key: 'history', label: t('tabs.history'), icon: History },
  ];

  return (
    <div>
      <button type="button" onClick={onBack} className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />{t('back')}</button>
      <SectionHeader
        title={bridge.name}
        description={<span className="inline-flex flex-wrap items-center gap-2"><StatusBadge status={bridge.status} />{bridge.status_reason ? <span className="text-amber-300">{t.has(`reason.${bridge.status_reason}`) ? t(`reason.${bridge.status_reason}`) : t('status.degraded')}</span> : null}</span>}
        action={(
          <div className="flex flex-wrap gap-2">
            {bridge.status === 'active' || bridge.status === 'degraded' ? (
              bridge.can_pause ? <Button variant="outline" disabled={busy} onClick={doPause} className="gap-2"><Pause className="h-4 w-4" />{t('actions.pause')}</Button> : null
            ) : null}
            {bridge.status === 'paused' && bridge.manage ? <Button disabled={busy} onClick={doResume} className="gradient-primary gap-2"><Play className="h-4 w-4" />{t('actions.resume')}</Button> : null}
            {bridge.status === 'suspended' && bridge.manage ? <Button disabled={busy} onClick={doResume} className="gap-2"><Play className="h-4 w-4" />{t('actions.reactivate')}</Button> : null}
            {bridge.can_delete ? <Button variant="outline" disabled={busy} onClick={() => setConfirm('delete')} className="gap-2 text-red-400"><Trash2 className="h-4 w-4" />{t('actions.delete')}</Button> : null}
          </div>
        )}
      />
      {!bridge.manage ? <Card className="mb-4 border-amber-400/30 bg-amber-500/5 p-4 text-sm text-amber-200">{t('limitedAccess')}</Card> : null}
      <ModuleTabs tabs={tabs} active={tab} onChange={setTab} />
      {tab === 'overview' ? <Overview bridge={bridge} full={full} /> : null}
      {tab === 'translation' && bridge.manage ? <TranslationTab bridge={bridge} caps={caps} onSaved={async () => { await reload(); onChanged(); }} /> : null}
      {tab === 'antispam' && bridge.manage ? <AntiSpamTab bridge={bridge} caps={caps} onSaved={async () => { await reload(); onChanged(); }} /> : null}
      {tab === 'history' ? <HistoryTab bridge={bridge} /> : null}

      <ConfirmDialog
        open={confirm === 'delete'} onOpenChange={(o) => !o && setConfirm(null)} busy={busy}
        title={t('delete.title')} description={t('delete.text', { name: bridge.name })} confirmLabel={t('actions.delete')} onConfirm={doDelete}
      />
    </div>
  );
}

function Overview({ bridge, full }) {
  const t = useTranslations('guildSettings.link');
  const locale = useLocale();
  const d = full?.delivery_24h;
  const modules = full?.modules || {};
  return (
    <div className="space-y-4">
      <Section title={t('overview.channels')} icon={ArrowLeftRight}>
        {['a', 'b'].map((k) => (
          <div key={k} className="flex flex-col gap-1 rounded-xl border border-border/50 bg-secondary/10 p-3.5 text-sm sm:flex-row sm:items-center sm:justify-between">
            <SideLine side={bridge[k]} t={t} />
            {bridge[k].channel_missing ? <Badge variant="outline" className="w-fit gap-1 text-red-300"><XCircle className="h-3 w-3" />{t('overview.channelMissing')}</Badge> : null}
            {bridge[k].owned && modules[k] === false ? <Badge variant="outline" className="w-fit gap-1 text-amber-300"><AlertTriangle className="h-3 w-3" />{t('overview.moduleOff')}</Badge> : null}
          </div>
        ))}
        <p className="text-xs text-muted-foreground">{t('overview.created', { date: formatDate(bridge.created_at, locale) })}</p>
        {bridge.last_error ? <p className="text-xs text-amber-300">{t('overview.lastError', { error: String(bridge.last_error).slice(0, 120) })}</p> : null}
      </Section>
      <Section title={t('overview.delivery')} description={t('overview.deliveryHint')} icon={Gauge}>
        {d ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {['delivered', 'suppressed', 'failed', 'retry_scheduled', 'deleted', 'pending'].map((k) => (
              <div key={k} className="rounded-xl border border-border/50 bg-secondary/10 p-3">
                <div className="text-xl font-bold">{d[k] ?? 0}</div>
                <div className="text-xs text-muted-foreground">{t(`delivery.${k}`)}</div>
              </div>
            ))}
          </div>
        ) : <Skeleton />}
      </Section>
    </div>
  );
}

function TranslationTab({ bridge, caps, onSaved }) {
  const t = useTranslations('guildSettings.link');
  const errText = useLinkErrors();
  const [draft, setDraft] = useState(bridge.translation);
  const [saving, setSaving] = useState(false);
  const available = caps?.translation === true;
  const dirty = JSON.stringify(draft) !== JSON.stringify(bridge.translation);
  const langs = (caps?.languages || Object.keys(LANG_LABEL)).map((l) => ({ value: l, label: LANG_LABEL[l] || l }));
  const save = async () => {
    setSaving(true);
    const r = await lk(`bridges/${bridge.id}`, { method: 'PATCH', body: { translation: draft } });
    setSaving(false);
    if (!r.ok) { toast.error(errText(r.data?.errors?.[0]?.code || r.data?.error)); return; }
    toast.success(t('toast.saved'));
    onSaved();
  };
  return (
    <div className="space-y-4">
      {!available ? <Card className="border-amber-400/30 bg-amber-500/5 p-4 text-sm text-amber-200">{t('translation.unavailable')}</Card> : null}
      <Section title={t('translation.title')} description={t('translation.description')} icon={Languages}>
        <SwitchRow label={t('translation.enable')} hint={t('translation.enableHint')} checked={draft.enabled} onChange={(v) => setDraft({ ...draft, enabled: v })} disabled={!available && !draft.enabled} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('translation.langA', { name: bridge.a.guild_name || 'A' })}><NativeSelect value={draft.a_lang} onChange={(v) => setDraft({ ...draft, a_lang: v })} options={langs} disabled={!draft.enabled} /></Field>
          <Field label={t('translation.langB', { name: bridge.b.guild_name || 'B' })}><NativeSelect value={draft.b_lang} onChange={(v) => setDraft({ ...draft, b_lang: v })} options={langs} disabled={!draft.enabled} /></Field>
        </div>
        <p className="text-xs text-muted-foreground">{t('translation.fallback')}</p>
      </Section>
      <SaveBar dirty={dirty} saving={saving} onSave={save} onDiscard={() => setDraft(bridge.translation)} />
    </div>
  );
}

const SPAM_FIELDS = ['max_messages', 'window_seconds', 'max_duplicates', 'duplicate_window_seconds', 'max_mentions', 'restriction_seconds'];

function AntiSpamTab({ bridge, caps, onSaved }) {
  const t = useTranslations('guildSettings.link');
  const errText = useLinkErrors();
  const [draft, setDraft] = useState(bridge.antispam);
  const [saving, setSaving] = useState(false);
  const bounds = caps?.antispam_bounds || {};
  const dirty = JSON.stringify(draft) !== JSON.stringify(bridge.antispam);
  const save = async () => {
    setSaving(true);
    const r = await lk(`bridges/${bridge.id}`, { method: 'PATCH', body: { antispam: draft } });
    setSaving(false);
    if (!r.ok) { toast.error(errText(r.data?.error)); return; }
    toast.success(t('toast.saved'));
    onSaved();
  };
  return (
    <div className="space-y-4">
      <Section title={t('antispam.title')} description={t('antispam.description')} icon={ShieldCheck}>
        <SwitchRow label={t('antispam.enable')} hint={t('antispam.enableHint')} checked={draft.enabled} onChange={(v) => setDraft({ ...draft, enabled: v })} />
        <div className="grid gap-4 sm:grid-cols-2">
          {SPAM_FIELDS.map((k) => (
            <Field key={k} label={t(`antispam.fields.${k}`)} hint={t(`antispam.hints.${k}`)}>
              <Input
                type="number" inputMode="numeric" disabled={!draft.enabled} value={draft[k]}
                min={bounds[k]?.[0]} max={bounds[k]?.[1]}
                onChange={(e) => setDraft({ ...draft, [k]: e.target.value === '' ? '' : Number(e.target.value) })}
              />
              {bounds[k] ? <p className="mt-1 text-[11px] text-muted-foreground">{t('antispam.range', { min: bounds[k][0], max: bounds[k][1] })}</p> : null}
            </Field>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">{t('antispam.noPunish')}</p>
      </Section>
      <SaveBar dirty={dirty} saving={saving} onSave={save} onDiscard={() => setDraft(bridge.antispam)} />
    </div>
  );
}

function HistoryTab({ bridge }) {
  const t = useTranslations('guildSettings.link');
  const locale = useLocale();
  const errText = useLinkErrors();
  const [items, setItems] = useState(null);
  const [next, setNext] = useState(null);
  const [error, setError] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const load = useCallback(async (before) => {
    const r = await lk(`bridges/${bridge.id}/history${before ? `?before=${before}` : ''}`);
    if (!r.ok) { setError(r.data?.error || 'generic'); return; }
    setError(null);
    setItems((cur) => (before ? [...(cur || []), ...r.data.items] : r.data.items));
    setNext(r.data.next);
  }, [bridge.id]);
  useEffect(() => { load(); }, [load]);
  if (error && !items) return <p className="text-sm text-muted-foreground">{errText(error)}</p>;
  if (!items) return <Skeleton />;
  if (!items.length) return <Empty title={t('history.empty')} text={t('history.emptyText')} />;
  return (
    <Card className="divide-y divide-border/50 bg-card/60">
      {items.map((it) => (
        <div key={it.id} className="flex flex-col gap-1 p-3.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm">
            {t.has(`history.types.${it.type}`) ? t(`history.types.${it.type}`) : t('history.other')}{it.count > 1 ? <span className="text-muted-foreground"> ×{it.count}</span> : null}
            {it.meta?.reason ? <span className="text-muted-foreground"> · {t.has(`reason.${it.meta.reason}`) ? t(`reason.${it.meta.reason}`) : t('history.other')}</span> : null}
          </div>
          <div className="text-xs text-muted-foreground">{formatDate(it.at, locale)}</div>
        </div>
      ))}
      {next ? (
        <div className="p-3 text-center">
          <Button variant="outline" size="sm" disabled={loadingMore} onClick={async () => { setLoadingMore(true); await load(next); setLoadingMore(false); }}>{t('history.more')}</Button>
        </div>
      ) : null}
    </Card>
  );
}

// ------------------------------------------------------------------------------------------------ wizard (7 steps)
function Wizard({ open, onOpenChange, caps, startGuildId, onCreated }) {
  const t = useTranslations('guildSettings.link');
  const errText = useLinkErrors();
  const [step, setStep] = useState(0);
  const [servers, setServers] = useState(null);
  const [serversError, setServersError] = useState(null);
  const [sel, setSel] = useState({ ga: '', ca: '', gb: '', cb: '' });
  const [channels, setChannels] = useState({});               // guildId -> { loading, error, list }
  const [name, setName] = useState('');
  const [translation, setTranslation] = useState(null);
  const [antispam, setAntispam] = useState(null);
  const [checks, setChecks] = useState(null);
  const [checking, setChecking] = useState(false);
  const [creating, setCreating] = useState(false);
  const [problem, setProblem] = useState(null);

  useEffect(() => {
    if (caps) { setTranslation((v) => v || { ...caps.defaults.translation }); setAntispam((v) => v || { ...caps.defaults.antispam }); }
  }, [caps]);

  useEffect(() => {
    let live = true;
    lk('servers').then((r) => {
      if (!live) return;
      if (!r.ok) { setServersError(r.data?.error || 'generic'); return; }
      setServers(r.data.servers || []);
      const mine = (r.data.servers || []).find((s) => s.id === startGuildId);
      if (mine) setSel((s) => ({ ...s, ga: mine.id }));
    });
    return () => { live = false; };
  }, [startGuildId]);

  const loadChannels = useCallback(async (gid) => {
    if (!gid) return;
    setChannels((c) => (c[gid]?.list ? c : { ...c, [gid]: { loading: true } }));
    const r = await lk(`servers/${gid}/channels`);
    setChannels((c) => ({ ...c, [gid]: r.ok ? { list: r.data.channels } : { error: r.data?.error || 'generic' } }));
  }, []);
  useEffect(() => { if (step === 1) loadChannels(sel.ga); if (step === 3) loadChannels(sel.gb); }, [step, sel.ga, sel.gb, loadChannels]);

  const nameOf = (gid) => servers?.find((s) => s.id === gid)?.name || gid;
  const chanOf = (gid, cid) => channels[gid]?.list?.find((c) => c.id === cid);
  const body = useMemo(() => ({
    a: { guild_id: sel.ga, channel_id: sel.ca }, b: { guild_id: sel.gb, channel_id: sel.cb },
    translation, antispam, ...(name.trim() ? { name: name.trim() } : {}),
  }), [sel, translation, antispam, name]);

  const runChecks = useCallback(async () => {
    setChecking(true); setProblem(null); setChecks(null);
    const r = await lk('bridges/validate', { method: 'POST', body });
    setChecking(false);
    if (r.data?.checks) setChecks(r.data.checks);
    if (!r.ok) setProblem(r.data?.error || (r.data?.errors?.[0]?.code) || 'validation_failed');
    else setChecks(r.data.checks);
    return r.ok;
  }, [body]);

  useEffect(() => { if (step === 5) runChecks(); }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  const create = async () => {
    setCreating(true); setProblem(null);
    const r = await lk('bridges', { method: 'POST', body });
    setCreating(false);
    if (!r.ok) { setProblem(r.data?.error || 'generic'); if (r.data?.checks) setChecks(r.data.checks); return; }
    onCreated(r.data.bridge);
  };

  const canNext = [
    Boolean(sel.ga), Boolean(sel.ca), Boolean(sel.gb) && sel.gb !== sel.ga, Boolean(sel.cb),
    Boolean(translation && antispam), Boolean(checks) && !checking && !problem && checks.every((c) => c.ok || c.level === 'warning'), true,
  ][step];

  const serverOptions = (exclude) => [{ value: '', label: t('wizard.pick') }, ...(servers || []).filter((s) => s.id !== exclude).map((s) => ({ value: s.id, label: s.name }))];
  const channelOptions = (gid) => [{ value: '', label: t('wizard.pick') }, ...((channels[gid]?.list || []).filter((c) => c.eligible).map((c) => ({ value: c.id, label: `#${c.name}` })))];
  const hidden = (gid) => (channels[gid]?.list || []).filter((c) => c.eligible === false).length;

  const stepBody = () => {
    if (serversError) return <p className="text-sm text-red-300">{errText(serversError)}</p>;
    if (!servers && step <= 3) return <Skeleton />;
    if ((step === 0 || step === 2) && servers.filter((s) => s.id !== (step === 2 ? sel.ga : '')).length === 0) {
      return <p className="text-sm text-amber-300">{t('wizard.noServers')}</p>;
    }
    switch (step) {
      case 0: return <Field label={t('wizard.serverA')} hint={t('wizard.ownerOnly')}><NativeSelect value={sel.ga} onChange={(v) => setSel({ ...sel, ga: v, ca: '' })} options={serverOptions('')} label={t('wizard.serverA')} /></Field>;
      case 1:
      case 3: {
        const gid = step === 1 ? sel.ga : sel.gb;
        const cur = channels[gid];
        const key = step === 1 ? 'ca' : 'cb';
        if (!cur || cur.loading) return <Skeleton />;
        if (cur.error) return <p className="text-sm text-red-300">{errText(cur.error)}</p>;
        return (
          <div className="space-y-2">
            <Field label={t(step === 1 ? 'wizard.channelA' : 'wizard.channelB', { server: nameOf(gid) })}>
              <NativeSelect value={sel[key]} onChange={(v) => setSel({ ...sel, [key]: v })} options={channelOptions(gid)} label={t('wizard.channel')} />
            </Field>
            {hidden(gid) ? <p className="text-xs text-muted-foreground">{t('wizard.hiddenChannels', { count: hidden(gid) })}</p> : null}
          </div>
        );
      }
      case 2: return <Field label={t('wizard.serverB')} hint={t('wizard.ownerOnly')}><NativeSelect value={sel.gb} onChange={(v) => setSel({ ...sel, gb: v, cb: '' })} options={serverOptions(sel.ga)} label={t('wizard.serverB')} /></Field>;
      case 4: return (
        <div className="space-y-4">
          <Field label={t('wizard.name')} hint={t('wizard.nameHint')}><Input value={name} maxLength={caps?.limits?.name_max || 60} onChange={(e) => setName(e.target.value)} placeholder={`${nameOf(sel.ga)} {wy:sync} ${nameOf(sel.gb)}`} /></Field>
          <SwitchRow
            label={t('translation.enable')} hint={t('translation.enableHint')} checked={Boolean(translation?.enabled && caps?.translation)}
            disabled={!caps?.translation} onChange={(v) => setTranslation({ ...translation, enabled: v })}
          >
            {!caps?.translation ? <p className="mt-1 text-xs text-amber-300">{t('translation.unavailable')}</p> : null}
          </SwitchRow>
          {translation?.enabled && caps?.translation ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t('translation.langA', { name: nameOf(sel.ga) })}><NativeSelect value={translation.a_lang} onChange={(v) => setTranslation({ ...translation, a_lang: v })} options={(caps.languages || []).map((l) => ({ value: l, label: LANG_LABEL[l] || l }))} /></Field>
              <Field label={t('translation.langB', { name: nameOf(sel.gb) })}><NativeSelect value={translation.b_lang} onChange={(v) => setTranslation({ ...translation, b_lang: v })} options={(caps.languages || []).map((l) => ({ value: l, label: LANG_LABEL[l] || l }))} /></Field>
            </div>
          ) : null}
          <SwitchRow label={t('antispam.enable')} hint={t('antispam.enableHint')} checked={Boolean(antispam?.enabled)} onChange={(v) => setAntispam({ ...antispam, enabled: v })} />
          <p className="text-xs text-muted-foreground">{t('wizard.optionsLater')}</p>
        </div>
      );
      case 5: return (
        <div className="space-y-2">
          {checking ? <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />{t('wizard.checking')}</p> : null}
          {(checks || []).map((c, i) => (
            <div key={`${c.side}-${c.code}-${i}`} className="flex items-start gap-2 text-sm">
              {c.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" /> : c.level === 'warning' ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />}
              <span className={c.ok ? 'text-muted-foreground' : ''}>{t.has(`checks.${c.code}${c.ok ? '' : '_fail'}`) ? t(`checks.${c.code}${c.ok ? '' : '_fail'}`, { side: c.side === 'a' ? nameOf(sel.ga) : c.side === 'b' ? nameOf(sel.gb) : '' }) : c.code}</span>
            </div>
          ))}
          {problem && problem !== 'validation_failed' ? <p className="text-sm text-red-300">{errText(problem)}</p> : null}
          {!checking ? <Button variant="outline" size="sm" onClick={runChecks} className="mt-2 gap-2"><RefreshCw className="h-4 w-4" />{t('wizard.recheck')}</Button> : null}
        </div>
      );
      default: return (
        <div className="space-y-3 text-sm">
          <div className="rounded-xl border border-border/50 bg-secondary/10 p-3.5">
            <div className="font-medium">{nameOf(sel.ga)} <span className="text-muted-foreground">#{chanOf(sel.ga, sel.ca)?.name}</span></div>
            <div className="my-1 text-muted-foreground"><ArrowLeftRight className="inline h-4 w-4" /></div>
            <div className="font-medium">{nameOf(sel.gb)} <span className="text-muted-foreground">#{chanOf(sel.gb, sel.cb)?.name}</span></div>
          </div>
          <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
            <li>{translation?.enabled && caps?.translation ? t('wizard.sumTranslationOn', { a: LANG_LABEL[translation.a_lang], b: LANG_LABEL[translation.b_lang] }) : t('wizard.sumTranslationOff')}</li>
            <li>{antispam?.enabled ? t('wizard.sumSpamOn') : t('wizard.sumSpamOff')}</li>
            <li>{t('wizard.sumModule')}</li>
          </ul>
          {problem ? <p className="text-red-300">{errText(problem)}</p> : null}
        </div>
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('wizard.title')}</DialogTitle>
          <DialogDescription>{t('wizard.step', { n: step + 1, total: STEPS.length })} · {t(`wizard.steps.${STEPS[step]}`)}</DialogDescription>
        </DialogHeader>
        <div className="flex gap-1" aria-hidden="true">
          {STEPS.map((s, i) => <div key={s} className={`h-1 flex-1 rounded-full ${i <= step ? 'bg-[#e6cd8c]' : 'bg-secondary'}`} />)}
        </div>
        <div className="min-h-[120px] py-2">{stepBody()}</div>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => (step === 0 ? onOpenChange(false) : setStep(step - 1))} disabled={creating}>{step === 0 ? t('cancel') : t('wizard.back')}</Button>
          {step < STEPS.length - 1
            ? <Button onClick={() => setStep(step + 1)} disabled={!canNext} className="gradient-primary">{t('wizard.next')}</Button>
            : <Button onClick={create} disabled={creating} className="gradient-primary gap-2">{creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowLeftRight className="h-4 w-4" />}{t('wizard.create')}</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

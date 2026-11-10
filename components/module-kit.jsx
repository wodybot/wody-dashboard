'use client';
import FloatingBar from '@/components/floating-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import {
  AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, Crown, ExternalLink, Info, Loader2, RefreshCw, Save, Send, Sparkles, Wand2, XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { InfoHint, EmbedPreview, CardPreview, Skeleton, DiscordMessage, DiscordText, DiscordButtons, V2Container, PreviewImage } from '@/components/dashboard-kit';
import { discordCdnUrl } from '@/lib/utils';
import { useBotStatus } from '@/components/bot-offline';
import IconText, { Icon } from '@/components/icon-text';


export async function callApi(guildId, path, { method = 'GET', body } = {}) {
  try {
    const res = await fetch(`/api/guilds/${guildId}/${path}`, {
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

export function useApi(guildId, path) {
  const [state, setState] = useState({ data: null, loading: true, error: null, details: null });
  const alive = useRef(true);
  const seq = useRef(0);
  const lastPath = useRef(path);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const load = useCallback(async () => {
    const id = ++seq.current;
    const samePath = lastPath.current === path;
    lastPath.current = path;
    setState((s) => ({ ...s, data: samePath ? s.data : null, loading: true, error: null, details: null }));
    const r = await callApi(guildId, path);
    if (!alive.current || id !== seq.current) return null;
    if (r.ok) setState({ data: r.data, loading: false, error: null, details: null });
    else setState((s) => ({ data: samePath ? s.data : null, loading: false, error: r.data?.error || 'generic', details: r.data || null }));
    return r.ok ? r.data : null;
  }, [guildId, path]);
  useEffect(() => { load(); }, [load]);
  const setData = useCallback((updater) => setState((s) => ({ ...s, data: typeof updater === 'function' ? updater(s.data) : updater })), []);
  return { ...state, reload: load, setData };
}


const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export function useDraft(initial) {
  const [saved, setSaved] = useState(initial);
  const [draft, setDraft] = useState(initial);
  const reset = useCallback((next) => { setSaved(next); setDraft(next); }, []);
  const set = useCallback((patch) => setDraft((d) => ({ ...d, ...patch })), []);
  const commit = useCallback((sent) => setSaved((s) => ({ ...s, ...sent })), []);
  const dirty = useMemo(() => !same(saved, draft), [saved, draft]);
  const patch = useMemo(() => {
    const out = {};
    for (const k of Object.keys(draft || {})) if (!same(draft[k], saved?.[k])) out[k] = draft[k];
    return out;
  }, [draft, saved]);
  return { draft, saved, set, setDraft, reset, commit, dirty, patch };
}


export function useErrorText() {
  const t = useTranslations('guildSettings.kit');
  const tc = useTranslations('community');
  const errorText = useCallback((err) => {
    if (!err) return '';
    const key = `errors.${err.code}`;
    if (t.has(key)) return t(key, err.params || {});
    if (tc.has(key)) return tc(key, err.params || {});
    return t('errors.invalid');
  }, [t, tc]);
  const apiErrorText = useCallback((code) => {
    if (t.has(`apiErrors.${code}`)) return t(`apiErrors.${code}`);
    if (tc.has(`errors.${code}`)) return tc(`errors.${code}`);
    return t('apiErrors.generic');
  }, [t, tc]);
  return { errorText, apiErrorText };
}

export function fieldErrors(errors, field) {
  return (errors || []).filter((e) => e.field === field || e.field.startsWith(`${field}.`));
}

export function FieldError({ errors, field }) {
  const { errorText } = useErrorText();
  const list = fieldErrors(errors, field);
  if (!list.length) return null;
  return (
    <div role="alert" className="mt-1.5 space-y-0.5">
      {list.map((e, i) => (
        <p key={i} className="flex items-start gap-1.5 text-xs text-red-400"><XCircle className="w-3.5 h-3.5 mt-px shrink-0" />{errorText(e)}</p>
      ))}
    </div>
  );
}


const LEVEL_STYLE = {
  required: 'border-red-400/40 bg-red-500/10 text-red-300',
  recommended: 'border-emerald-400/40 bg-emerald-500/10 text-emerald-300',
  optional: 'border-border/60 bg-secondary/30 text-muted-foreground',
  advanced: 'border-[#e6cd8c]/45 bg-[#e6cd8c]/10 text-[#e6cd8c]',
};

export function LevelBadge({ level }) {
  const t = useTranslations('guildSettings.kit');
  if (!level) return null;
  return <span className={`inline-flex items-center rounded-full border px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide ${LEVEL_STYLE[level]}`}>{t(`levels.${level}`)}</span>;
}

export function Field({ label, hint, level, errors, field, recommended, children, className = '' }) {
  const t = useTranslations('guildSettings.kit');
  return (
    <div className={`min-w-0 ${className}`}>
      <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
        <Label className="mb-0">{label}</Label>
        <LevelBadge level={level} />
        <InfoHint>{hint}</InfoHint>
      </div>
      {children}
      {recommended ? <p className="mt-1 text-[11px] text-emerald-300/80">{t('recommendedValue', { value: recommended })}</p> : null}
      {field ? <FieldError errors={errors} field={field} /> : null}
    </div>
  );
}

export function SwitchRow({ label, hint, level, checked, onChange, disabled, children }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border border-border/50 bg-secondary/10 p-3.5">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-sm font-medium">{label}</span>
          <LevelBadge level={level} />
          <InfoHint>{hint}</InfoHint>
        </div>
        {children}
      </div>
      <button
        type="button" role="switch" aria-checked={Boolean(checked)} aria-label={label} disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full border transition-colors disabled:opacity-50 ${checked ? 'border-[#e6cd8c] bg-[#e6cd8c]' : 'border-border bg-secondary/60'}`}
      >
        <span className={`absolute top-0.5 rounded-full bg-white shadow transition-all ${checked ? 'left-[22px]' : 'left-0.5'}`} style={{ height: 18, width: 18 }} />
      </button>
    </div>
  );
}

export function Section({ title, description, icon: Icon, children, className = '' }) {
  return (
    <Card className={`p-4 sm:p-6 bg-card/60 ${className}`}>
      <div className="mb-4 flex items-start gap-3">
        {Icon ? <div className="module-icon-wrap flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"><Icon className="h-4 w-4" /></div> : null}
        <div className="min-w-0">
          <h3 className="font-semibold leading-tight">{title}</h3>
          {description ? <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p> : null}
        </div>
      </div>
      <div className="space-y-4">{children}</div>
    </Card>
  );
}


export function ModuleTabs({ tabs, active, onChange, badges = {} }) {
  return (
    <div role="tablist" className="-mx-1 mb-6 flex gap-1 overflow-x-auto rounded-xl border border-border/50 bg-card/40 p-1 scrollbar-thin">
      {tabs.map(({ key, label, icon: Icon }) => (
        <button
          key={key} type="button" role="tab" aria-selected={active === key} onClick={() => onChange(key)}
          className={`inline-flex h-9 shrink-0 items-center gap-2 rounded-lg px-3.5 text-sm font-medium transition-colors ${active === key ? 'bg-[#e6cd8c]/20 text-[#f2c091] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]' : 'text-muted-foreground hover:bg-white/[0.04] hover:text-foreground'}`}
        >
          {Icon ? <Icon className="h-4 w-4 shrink-0" /> : null}
          {label}
          {badges[key] ? <span className="ml-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500/80 px-1 text-[10px] font-bold text-white">{badges[key]}</span> : null}
        </button>
      ))}
    </div>
  );
}


export function IssueBanner({ issues, onRefresh, loading }) {
  const t = useTranslations('guildSettings.kit');
  const list = issues || [];
  if (!list.length && !loading) return null;
  return (
    <Card className="mb-6 border-amber-400/30 bg-amber-400/[0.05] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 font-semibold text-amber-300"><AlertTriangle className="h-4 w-4" />{t('issues.title')}</div>
        <Button size="sm" variant="outline" onClick={onRefresh} disabled={loading} className="gap-1.5">
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}{t('issues.recheck')}
        </Button>
      </div>
      <ul className="mt-3 space-y-2">
        {list.map((issue, i) => {
          let text;
          try { text = t.has(`issues.${issue.code}`) ? t(`issues.${issue.code}`, issue.params || {}) : t('issues.generic'); } catch { text = t('issues.generic'); }
          return (
            <li key={`${issue.code}-${i}`} className="flex items-start gap-2 text-sm">
              {issue.severity === 'error' ? <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />}
              <span>{text}</span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

export function useDiagnose(guildId, path = 'modules/diagnose?module=birthdays') {
  const [state, setState] = useState({ issues: [], loading: false, unreachable: false });
  const run = useCallback(async () => {
    setState((s) => ({ ...s, loading: true }));
    const r = await callApi(guildId, path);
    if (r.ok) setState({ issues: r.data?.result?.issues || [], loading: false, unreachable: false });
    else if (r.data?.error === 'rate_limited') setState((s) => ({ ...s, loading: false }));
    else setState({ issues: [], loading: false, unreachable: r.data?.error === 'bot_unreachable' });
    return r;
  }, [guildId, path]);
  useEffect(() => { run(); }, [run]);
  return { ...state, run };
}


export function SaveFooter({ dirty, saving, onSave, onDiscard, errors = [], disabled }) {
  const t = useTranslations('guildSettings.kit');
  const { errorText } = useErrorText();
  if (!dirty && !errors.length) return null;
  return (
    <FloatingBar>
      <div className="flex w-full max-w-3xl flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#e6cd8c]/40 bg-background/95 px-4 py-2.5 shadow-[0_12px_40px_-8px_rgba(0,0,0,0.85)] backdrop-blur-md">
        <div className="min-w-0 text-sm">
          {errors.length ? (
            <div role="alert" className="space-y-0.5 text-red-400">
              <div className="flex items-center gap-1.5 font-medium"><XCircle className="h-4 w-4" />{t('validation.title')}</div>
              {errors.slice(0, 3).map((e, i) => <p key={i} className="pl-5 text-xs">{errorText(e)}</p>)}
              {errors.length > 3 ? <p className="pl-5 text-xs">{t('validation.more', { count: errors.length - 3 })}</p> : null}
            </div>
          ) : (
            <span className="inline-flex items-center gap-2 font-medium text-[#e6cd8c]"><span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-[#e08a4e]" />{t('unsaved')}</span>
          )}
        </div>
        <div className="ml-auto flex shrink-0 gap-2">
          {dirty && onDiscard ? <Button variant="outline" onClick={onDiscard} disabled={saving} className="rounded-full">{t('discard')}</Button> : null}
          <Button onClick={onSave} disabled={!dirty || saving || disabled} className="gradient-primary rounded-full px-5">
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}{t('save')}
          </Button>
        </div>
      </div>
    </FloatingBar>
  );
}

export function useSave(guildId, path, { onSaved, testAction } = {}) {
  const t = useTranslations('guildSettings.kit');
  const { apiErrorText } = useErrorText();
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState([]);
  const save = useCallback(async (patch) => {
    setSaving(true);
    setErrors([]);
    const r = await callApi(guildId, path, { method: 'PUT', body: patch });
    setSaving(false);
    if (r.ok) {
      toast.success(t('saved'), testAction ? { action: { label: t('testNow'), onClick: testAction } } : undefined);
      onSaved?.(r.data);
      return true;
    }
    if (r.data?.error === 'validation_failed') setErrors(r.data.errors || []);
    else toast.error(apiErrorText(r.data?.error || 'generic'));
    return false;
  }, [guildId, path, t, apiErrorText, onSaved, testAction]);
  return { save, saving, errors, setErrors };
}


export function RecommendedBar({ items, onApply }) {
  const t = useTranslations('guildSettings.kit');
  const [open, setOpen] = useState(false);
  return (
    <>
      <Card className="mb-6 flex flex-col gap-3 border-emerald-400/25 bg-emerald-500/[0.05] p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" />
          <div className="min-w-0">
            <div className="text-sm font-semibold">{t('recommended.title')}</div>
            <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{t('recommended.text')}</p>
          </div>
        </div>
        <Button variant="outline" className="shrink-0 gap-1.5 border-emerald-400/40" onClick={() => setOpen(true)}><Wand2 className="h-4 w-4" />{t('recommended.button')}</Button>
      </Card>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('recommended.dialogTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('recommended.dialogText')}</AlertDialogDescription>
          </AlertDialogHeader>
          <ul className="max-h-64 space-y-1.5 overflow-y-auto rounded-lg border border-border/50 bg-secondary/10 p-3 text-sm">
            {items.map((row) => (
              <li key={row.label} className="flex items-start justify-between gap-3"><span className="text-muted-foreground">{row.label}</span><span className="text-right font-medium">{row.value}</span></li>
            ))}
          </ul>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={() => { onApply(); toast.success(t('recommended.applied')); }}>{t('recommended.apply')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export function QuickSetup({ title, intro, steps, onFinish, onSkip, finishing, finishLabel, errors = [] }) {
  const t = useTranslations('guildSettings.kit');
  const [index, setIndex] = useState(0);
  const step = steps[index];
  const last = index === steps.length - 1;
  const ok = step.valid ? step.valid() : true;
  return (
    <div className="space-y-5">
      <Card className="relative overflow-hidden border-[#e6cd8c]/40 bg-gradient-to-br from-[#7c3010]/20 to-transparent p-5 sm:p-6">
        <div className="flex items-start gap-4">
          <div className="module-icon-wrap flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"><Wand2 className="h-5 w-5" /></div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[#e6cd8c]">{t('quick.badge')}</div>
            <h2 className="mt-1 text-xl font-bold leading-tight">{title}</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{intro}</p>
          </div>
        </div>
        <ol className="mt-5 flex items-center gap-1.5" aria-label={t('quick.progress')}>
          {steps.map((s, i) => (
            <li key={s.key} className="flex flex-1 items-center gap-1.5">
              <span aria-current={i === index ? 'step' : undefined} className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-bold ${i < index ? 'border-emerald-400/60 bg-emerald-500/20 text-emerald-300' : i === index ? 'border-[#e6cd8c] bg-[#e6cd8c]/25 text-[#f3e1b0]' : 'border-border/60 text-muted-foreground'}`}>
                {i < index ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
              </span>
              {i < steps.length - 1 ? <span className={`h-px flex-1 ${i < index ? 'bg-emerald-400/50' : 'bg-border/60'}`} /> : null}
            </li>
          ))}
        </ol>
      </Card>
      <Card className="p-4 sm:p-6 bg-card/60">
        <div className="mb-1 text-xs text-muted-foreground">{t('quick.stepOf', { current: index + 1, total: steps.length })}</div>
        <h3 className="text-lg font-semibold">{step.title}</h3>
        <p className="mb-5 mt-1 text-sm text-muted-foreground">{step.description}</p>
        <div className="space-y-4">{step.render()}</div>
        {errors.length && last ? <div className="mt-4"><FieldErrorList errors={errors} /></div> : null}
      </Card>
      <div className="flex items-center justify-between gap-3">
        <Button variant="ghost" onClick={onSkip} className="text-muted-foreground">{t('quick.skip')}</Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setIndex((i) => Math.max(0, i - 1))} disabled={index === 0} className="gap-1"><ChevronLeft className="h-4 w-4" />{t('quick.back')}</Button>
          {last ? (
            <Button onClick={onFinish} disabled={!ok || finishing} className="gradient-primary gap-1.5">
              {finishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}{finishLabel || t('quick.finish')}
            </Button>
          ) : (
            <Button onClick={() => setIndex((i) => i + 1)} disabled={!ok} className="gradient-primary gap-1">{t('quick.next')}<ChevronRight className="h-4 w-4" /></Button>
          )}
        </div>
      </div>
    </div>
  );
}

export function FieldErrorList({ errors }) {
  const { errorText } = useErrorText();
  return (
    <div role="alert" className="space-y-1 rounded-lg border border-red-400/30 bg-red-500/[0.06] p-3">
      {errors.map((e, i) => <p key={i} className="flex items-start gap-1.5 text-xs text-red-300"><XCircle className="mt-px h-3.5 w-3.5 shrink-0" />{errorText(e)}</p>)}
    </div>
  );
}

export function SetupDone({ onOpenAdvanced }) {
  const t = useTranslations('guildSettings.kit');
  return (
    <Card className="mb-6 flex flex-col gap-3 border-emerald-400/30 bg-emerald-500/[0.06] p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3"><CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-300" /><div><div className="text-sm font-semibold">{t('quick.doneTitle')}</div><p className="mt-0.5 text-xs text-muted-foreground">{t('quick.doneText')}</p></div></div>
      <Button variant="outline" onClick={onOpenAdvanced} className="shrink-0">{t('quick.openAdvanced')}</Button>
    </Card>
  );
}


export function SendTestButton({ label, onSend, disabled, disabledReason, className = '' }) {
  const t = useTranslations('guildSettings.kit');
  const { apiErrorText } = useErrorText();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const { offline: botOffline } = useBotStatus();
  if (botOffline) { disabled = true; disabledReason = t('test.botOffline'); }
  const run = async () => {
    setBusy(true); setResult(null);
    const r = await onSend();
    setBusy(false);
    if (r.ok) setResult({ ok: true, url: r.data?.result?.message_url });
    else setResult({ ok: false, text: r.data?.message || apiErrorText(r.data?.error || 'generic') });
  };
  return (
    <div className={className}>
      <Button variant="outline" onClick={run} disabled={busy || disabled} className="gap-2" title={disabled ? disabledReason : undefined}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}{label || t('test.send')}
      </Button>
      {disabled && disabledReason ? <p className="mt-1.5 text-xs text-muted-foreground">{disabledReason}</p> : null}
      {result?.ok ? (
        <p className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-emerald-300"><CheckCircle2 className="h-3.5 w-3.5" />{t('test.sent')}
          {result.url ? <a href={result.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 underline underline-offset-2">{t('test.view')}<ExternalLink className="h-3 w-3" /></a> : null}
        </p>
      ) : null}
      {result && !result.ok ? <p role="alert" className="mt-2 flex items-start gap-1.5 text-xs text-red-400"><XCircle className="mt-px h-3.5 w-3.5 shrink-0" />{result.text}</p> : null}
      <p className="mt-1.5 text-[11px] text-muted-foreground">{t('test.note')}</p>
    </div>
  );
}


export function renderTemplate(text, vars) {
  let out = String(text || '');
  for (const [k, v] of Object.entries(vars || {})) out = out.split(`{${k}}`).join(String(v));
  return out;
}

export function DiscordMessagePreview({
  mention, embed, card, buttons = [], banner, label, useEmbed = true, thumbnailUrl, imageUrl, sampleNote = true, imagePlaceholder,
}) {
  const t = useTranslations('guildSettings.kit');
  const placeholderNode = !imageUrl && !card && imagePlaceholder ? (
    <div className="relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-[8px] bg-gradient-to-br from-[#2a1f3d] via-[#1d1d22] to-[#111114] text-[12px] font-medium text-white/70">
      <span className="absolute left-2 top-2 rounded bg-[#e91916] px-1.5 py-0.5 text-[10px] font-bold text-white">LIVE</span>{imagePlaceholder}
    </div>
  ) : null;
  const discordButtons = buttons.map((b) => ({ label: b.label, emoji: b.emoji, style: b.style || 'link' }));
  const cardNode = card ? <div className="overflow-hidden rounded-[8px]"><CardPreview {...card} /></div> : null;
  return (
    <div className="min-w-0">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label || t('preview.title')}</span>
        {sampleNote ? <Badge variant="secondary" className="text-[10px]">{t('preview.sample')}</Badge> : null}
      </div>
      <DiscordMessage>
        {banner ? <DiscordText>{`-# {wy:eco_testtube} ${banner}`}</DiscordText> : null}
        {mention ? <DiscordText>{mention}</DiscordText> : null}
        {useEmbed ? (
          <EmbedPreview
            accentColor={embed.color} title={embed.title} description={embed.description} footer={embed.footer}
            timestamp={embed.timestamp} imageUrl={card ? null : imageUrl} imageAsThumbnail={false} thumbnailUrl={thumbnailUrl}
            buttons={discordButtons} attachment={cardNode}
          >{placeholderNode}</EmbedPreview>
        ) : (
          <V2Container accentColor={embed.color}>
            <DiscordText>{`${embed.title ? `## ${embed.title}\n` : ''}${embed.description || ''}` || '\u200b'}</DiscordText>
            {embed.footer ? <DiscordText>{`-# ${embed.footer}`}</DiscordText> : null}
            {cardNode || (imageUrl ? <PreviewImage url={imageUrl} alt="" className="max-h-[350px] w-full rounded-[8px] object-cover" /> : placeholderNode)}
            <DiscordButtons buttons={discordButtons} />
          </V2Container>
        )}
      </DiscordMessage>
    </div>
  );
}


export function VariableChips({ variables, onInsert, describe }) {
  const t = useTranslations('guildSettings.kit');
  return (
    <div>
      <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">{t('variables.title')}<InfoHint>{t('variables.hint')}</InfoHint></div>
      <div className="flex flex-wrap gap-1.5">
        {variables.map((v) => (
          <span key={v} className="inline-flex items-center gap-0.5 rounded-md border border-border/60 bg-secondary/30 pl-2 pr-0.5 text-xs">
            <button type="button" onClick={() => onInsert(`{${v}}`)} className="font-mono text-[#e6cd8c] hover:underline" aria-label={t('variables.insert', { name: v })}>{`{${v}}`}</button>
            <InfoHint>{describe(v)}</InfoHint>
          </span>
        ))}
      </div>
    </div>
  );
}


export function PremiumLock({ title, text, onGetPremium }) {
  const t = useTranslations('guildSettings.kit');
  return (
    <Card className="mx-auto max-w-xl border-[#e6cd8c]/40 bg-gradient-to-br from-[#7c3010]/20 to-transparent p-8 text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#e6cd8c]/20 text-[#f2c091]"><Crown className="h-7 w-7" /></div>
      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[#e6cd8c]"><Icon file="lock" size={14} /> {t('lock.badge')}</div>
      <h2 className="mt-2 text-2xl font-bold">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">{text}</p>
      <p className="mx-auto mt-3 max-w-md text-xs text-muted-foreground">{t('lock.availableWith')}</p>
      <Button onClick={onGetPremium} className="gradient-primary mt-5 gap-2"><Crown className="h-4 w-4" />{t('lock.button')}</Button>
    </Card>
  );
}


export function ConfirmDialog({ icon, open, onOpenChange, title, description, confirmLabel, onConfirm, typed, destructive = true, busy, confirmDisabled = false, children = null }) {
  const t = useTranslations('guildSettings.kit');
  const [value, setValue] = useState('');
  useEffect(() => { if (!open) setValue(''); }, [open]);
  const ready = !typed || value.trim() === typed;
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">{icon ?? (destructive ? <AlertTriangle className="h-5 w-5 text-amber-400" /> : <Info className="h-5 w-5" />)}{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {typed ? (
          <div>
            <Label className="mb-1.5 block text-xs">{t('confirm.typeToConfirm', { word: typed })}</Label>
            <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder={typed} autoComplete="off" />
          </div>
        ) : null}
        {children}
        <AlertDialogFooter>
          <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
          <AlertDialogAction
            disabled={!ready || busy || confirmDisabled}
            onClick={(e) => { e.preventDefault(); onConfirm(); }}
            className={destructive ? 'bg-red-600 hover:bg-red-700 text-white' : ''}
          >
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}{confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}


export function LoadingOrError({ loading, error, onRetry, children, data }) {
  const t = useTranslations('guildSettings.kit');
  const { apiErrorText } = useErrorText();
  if (loading && !data) return <Skeleton />;
  if (error && !data) {
    return (
      <Card className="space-y-3 p-8 text-center">
        <AlertTriangle className="mx-auto h-7 w-7 text-amber-400" />
        <p className="text-sm text-muted-foreground">{apiErrorText(error)}</p>
        <Button variant="outline" onClick={onRetry} className="gap-2"><RefreshCw className="h-4 w-4" />{t('retry')}</Button>
      </Card>
    );
  }
  return children;
}

export function avatarSrc(url) { return url ? discordCdnUrl(url) : null; }

export function StatusDot({ tone = 'muted' }) {
  const color = { ok: 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)]', warn: 'bg-amber-400', bad: 'bg-red-400', muted: 'bg-muted-foreground/50' }[tone];
  return <span className={`inline-block h-2 w-2 rounded-full ${color}`} />;
}

export function formatDate(value, locale) {
  if (!value) return '';
  try { return new Date(value).toLocaleString(locale || undefined, { dateStyle: 'medium', timeStyle: 'short' }); } catch { return String(value); }
}


export function ColorField({ value, onChange, label }) {
  const safe = /^#[0-9a-fA-F]{6}$/.test(value || '') ? value : '#c46a2d';
  return (
    <div className="flex items-center gap-2">
      <input type="color" aria-label={label} value={safe} onChange={(e) => onChange(e.target.value)} className="h-10 w-12 shrink-0 cursor-pointer rounded-md border border-border bg-transparent p-1" />
      <Input value={value || ''} onChange={(e) => onChange(e.target.value)} maxLength={7} placeholder="#c46a2d" className="font-mono" aria-label={label} />
    </div>
  );
}

export function ButtonsEditor({ value, onChange, max = 2, errors, field }) {
  const t = useTranslations('guildSettings.kit');
  const list = value || [];
  const update = (i, patch) => onChange(list.map((b, idx) => (idx === i ? { ...b, ...patch } : b)));
  return (
    <div className="space-y-2">
      {list.map((b, i) => (
        <div key={i} className="grid gap-2 sm:grid-cols-[1fr_2fr_auto]">
          <Input value={b.label || ''} onChange={(e) => update(i, { label: e.target.value })} maxLength={80} placeholder={t('buttons.label')} aria-label={t('buttons.label')} />
          <Input value={b.url || ''} onChange={(e) => update(i, { url: e.target.value })} maxLength={500} placeholder="https://" aria-label={t('buttons.url')} />
          <Button type="button" variant="outline" size="icon" onClick={() => onChange(list.filter((_, idx) => idx !== i))} aria-label={t('buttons.remove')}><XCircle className="h-4 w-4" /></Button>
        </div>
      ))}
      {field ? <FieldError errors={errors} field={field} /> : null}
      {list.length < max ? (
        <Button type="button" variant="outline" size="sm" onClick={() => onChange([...list, { label: '', url: '' }])}>{t('buttons.add')}</Button>
      ) : <p className="text-xs text-muted-foreground">{t('buttons.max', { max })}</p>}
    </div>
  );
}

export function NativeSelect({ value, onChange, options, disabled, label, className = '' }) {
  return (
    <select
      value={value ?? ''} onChange={(e) => onChange(e.target.value)} disabled={disabled} aria-label={label}
      className={`h-10 w-full rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 ${className}`}
    >
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

export function Pager({ page, total, perPage, onChange }) {
  const t = useTranslations('guildSettings.kit');
  const pages = Math.max(1, Math.ceil(total / perPage));
  return (
    <div className="mt-4 flex items-center justify-center gap-3">
      <Button variant="outline" size="sm" disabled={page <= 0} onClick={() => onChange(page - 1)} aria-label={t('previous')}><ChevronLeft className="h-4 w-4" /></Button>
      <span className="text-sm text-muted-foreground">{t('pageOf', { page: page + 1, pages })}</span>
      <Button variant="outline" size="sm" disabled={page >= pages - 1} onClick={() => onChange(page + 1)} aria-label={t('next')}><ChevronRight className="h-4 w-4" /></Button>
    </div>
  );
}

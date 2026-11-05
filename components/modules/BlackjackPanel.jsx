'use client';
import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { BarChart3, Gift, SlidersHorizontal, Gamepad2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { SectionHeader } from '@/components/dashboard-kit';
import {
  ConfirmDialog, Field, LoadingOrError, ModuleTabs, NativeSelect, PremiumLock, QuickSetup, RecommendedBar, Section, SaveFooter, SwitchRow, callApi, useApi, useDraft, useSave,
} from '@/components/module-kit';
import IconText, { Icon } from '@/components/icon-text';

const GAME_ROWS = [
  ['blackjack', 'min_bet', 'max_bet'], ['slots', 'slots_min_bet', 'slots_max_bet'],
  ['coinflip', 'coinflip_min_bet', 'coinflip_max_bet'], ['dice', 'dice_min_bet', 'dice_max_bet'],
];
const GAME_EMOJI = { blackjack: '{wy:blackjack}', slots: '{wy:jackpot}', coinflip: '{wy:coins}', dice: '{wy:dice}' };
const LIMIT_KEYS = GAME_ROWS.flatMap(([, a, b]) => [a, b]);

function GameLimits({ t, s, d, set, errors }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {GAME_ROWS.map(([game, minKey, maxKey]) => (
        <Card key={game} className="p-4 bg-secondary/10">
          <div className="mb-3 flex items-center gap-2 font-semibold"><span className="text-lg" aria-hidden="true"><IconText text={GAME_EMOJI[game]} size={24} /></span>{t(`games.${game}`)}</div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t(game === 'blackjack' ? 'fields.min_bet' : `fields.${minKey}`)} hint={t(game === 'blackjack' ? 'hints.min_bet' : `hints.${minKey}`)} level="required" errors={errors} field={minKey} recommended={d[minKey]}><Input type="number" min={1} value={s[minKey]} onChange={(e) => set(minKey, num(e.target.value))} /></Field>
            <Field label={t(game === 'blackjack' ? 'fields.max_bet' : `fields.${maxKey}`)} hint={t(game === 'blackjack' ? 'hints.max_bet' : `hints.${maxKey}`)} level="required" errors={errors} field={maxKey} recommended={d[maxKey]}><Input type="number" min={1} value={s[maxKey]} onChange={(e) => set(maxKey, num(e.target.value))} /></Field>
          </div>
        </Card>
      ))}
    </div>
  );
}

const num = (v) => (v === '' || v === null || v === undefined ? '' : Number(v));

export default function BlackjackPanel({ guildId, onGetPremium }) {
  const t = useTranslations('guildSettings.blackjack');
  const api = useApi(guildId, 'blackjack');
  return (
    <LoadingOrError loading={api.loading} error={api.error} data={api.data} onRetry={api.reload}>
      {api.data && api.data.premium === false ? <PremiumLock title={t('lock.title')} text={t('lock.text')} onGetPremium={onGetPremium} /> : null}
      {api.data && api.data.premium !== false ? <Editor guildId={guildId} data={api.data} reload={api.reload} /> : null}
    </LoadingOrError>
  );
}

function Editor({ guildId, data, reload }) {
  const t = useTranslations('guildSettings.blackjack');
  const tk = useTranslations('guildSettings.kit');
  const form = useDraft(data.settings);
  const [tab, setTab] = useState('general');
  const [wizard, setWizard] = useState(!data.settings.setup_completed);
  const [finishing, setFinishing] = useState(false);
  const [wizardErrors, setWizardErrors] = useState([]);
  const { save, saving, errors } = useSave(guildId, 'blackjack');
  const s = form.draft;
  const d = data.defaults;
  const set = (k, v) => form.set({ [k]: v });
  const doSave = async () => { if (await save(form.patch)) form.reset({ ...form.draft }); };

  const recommended = useMemo(() => {
    const keys = [...LIMIT_KEYS, 'blackjack_payout', 'decks', 'starter_chips', 'daily_chips', 'convert_rate', 'convert_min_chips', 'convert_daily_limit'];
    return { items: keys.map((k) => ({ label: t(`fields.${k}`), value: String(d[k]) })), apply: () => form.set(Object.fromEntries(keys.map((k) => [k, d[k]]))) };
  }, [d, t, form]);

  const finish = async () => {
    setFinishing(true); setWizardErrors([]);
    const body = { ...Object.fromEntries(LIMIT_KEYS.map((k) => [k, s[k]])), daily_chips: s.daily_chips, convert_enabled: s.convert_enabled, convert_rate: s.convert_rate, convert_min_chips: s.convert_min_chips, setup_completed: true };
    const r = await callApi(guildId, 'blackjack', { method: 'PUT', body });
    setFinishing(false);
    if (r.ok) { form.reset({ ...form.draft }); setWizard(false); toast.success(tk('saved')); reload(); } else if (r.data?.error === 'validation_failed') setWizardErrors(r.data.errors || []); else toast.error(tk('apiErrors.generic'));
  };
  const skip = async () => { await callApi(guildId, 'blackjack', { method: 'PUT', body: { setup_completed: true } }); setWizard(false); };

  const coinsFor = (chips) => Math.floor(Number(chips || 0) / Math.max(1, Number(s.convert_rate || 1)));

  if (wizard) {
    const steps = [
      { key: 'bets', title: t('quick.bets'), description: t('quick.betsText'), render: () => <GameLimits t={t} s={s} d={d} set={set} errors={wizardErrors} /> },
      { key: 'daily', title: t('quick.daily'), description: t('quick.dailyText'), render: () => (
        <Field label={t('fields.daily_chips')} hint={t('hints.daily_chips')} level="recommended" errors={wizardErrors} field="daily_chips" recommended={d.daily_chips}><Input type="number" min={0} value={s.daily_chips} onChange={(e) => set('daily_chips', num(e.target.value))} /></Field>) },
      { key: 'convert', title: t('quick.convert'), description: t('quick.convertText'), render: () => (
        <div className="space-y-4">
          <SwitchRow label={t('fields.convert_enabled')} hint={t('hints.convert_enabled')} checked={s.convert_enabled} onChange={(v) => set('convert_enabled', v)} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('fields.convert_rate')} hint={t('hints.convert_rate')} level="recommended" errors={wizardErrors} field="convert_rate" recommended={d.convert_rate}><Input type="number" min={1} value={s.convert_rate} onChange={(e) => set('convert_rate', num(e.target.value))} /></Field>
            <Field label={t('fields.convert_min_chips')} hint={t('hints.convert_min_chips')} level="recommended" errors={wizardErrors} field="convert_min_chips" recommended={d.convert_min_chips}><Input type="number" min={1} value={s.convert_min_chips} onChange={(e) => set('convert_min_chips', num(e.target.value))} /></Field>
          </div>
        </div>) },
    ];
    return <QuickSetup title={t('quick.title')} intro={t('quick.intro')} steps={steps} onFinish={finish} onSkip={skip} finishing={finishing} finishLabel={t('quick.finish')} errors={wizardErrors} />;
  }

  const tabs = [
    { key: 'general', label: tk('tabs.general'), icon: Gamepad2 }, { key: 'chips', label: t('tabs.chips'), icon: Gift },
    { key: 'stats', label: t('tabs.stats'), icon: BarChart3 }, { key: 'advanced', label: tk('tabs.advanced'), icon: SlidersHorizontal },
  ];

  return (
    <div>
      <SectionHeader title={t('title')} description={t('description')} />
      <RecommendedBar items={recommended.items} onApply={recommended.apply} />
      <ModuleTabs tabs={tabs} active={tab} onChange={setTab} />

      {tab === 'general' ? (
        <div className="space-y-6">
          <Section title={t('sections.bets')} description={t('sections.betsText')}>
            <GameLimits t={t} s={s} d={d} set={set} errors={errors} />
          </Section>
          <Section title={t('sections.rules')} description={t('sections.rulesText')}>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label={t('fields.blackjack_payout')} hint={t('hints.blackjack_payout')} level="recommended" errors={errors} field="blackjack_payout" recommended={d.blackjack_payout}>
                <NativeSelect value={s.blackjack_payout} onChange={(v) => set('blackjack_payout', v)} label={t('fields.blackjack_payout')} options={data.payouts.map((p) => ({ value: p, label: p }))} />
              </Field>
              <Field label={t('fields.decks')} hint={t('hints.decks')} level="optional" errors={errors} field="decks" recommended={d.decks}><Input type="number" min={1} max={8} value={s.decks} onChange={(e) => set('decks', num(e.target.value))} /></Field>
              <Field label={t('fields.max_hands')} hint={t('hints.max_hands')} level="optional" errors={errors} field="max_hands" recommended={d.max_hands}><Input type="number" min={1} max={4} value={s.max_hands} onChange={(e) => set('max_hands', num(e.target.value))} /></Field>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <SwitchRow label={t('fields.insurance')} hint={t('hints.insurance')} checked={s.insurance} onChange={(v) => set('insurance', v)} />
              <SwitchRow label={t('fields.double_after_split')} hint={t('hints.double_after_split')} checked={s.double_after_split} onChange={(v) => set('double_after_split', v)} />
              <SwitchRow label={t('fields.dealer_hits_soft_17')} hint={t('hints.dealer_hits_soft_17')} checked={s.dealer_hits_soft_17} onChange={(v) => set('dealer_hits_soft_17', v)} />
            </div>
          </Section>
        </div>
      ) : null}

      {tab === 'chips' ? (
        <div className="space-y-6">
          <Section title={t('sections.chips')} description={t('sections.chipsText')}>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label={t('fields.starter_chips')} hint={t('hints.starter_chips')} level="optional" errors={errors} field="starter_chips" recommended={d.starter_chips}><Input type="number" min={0} value={s.starter_chips} onChange={(e) => set('starter_chips', num(e.target.value))} /></Field>
              <Field label={t('fields.daily_chips')} hint={t('hints.daily_chips')} level="recommended" errors={errors} field="daily_chips" recommended={d.daily_chips}><Input type="number" min={0} value={s.daily_chips} onChange={(e) => set('daily_chips', num(e.target.value))} /></Field>
              <Field label={t('fields.daily_streak_bonus')} hint={t('hints.daily_streak_bonus')} level="optional" errors={errors} field="daily_streak_bonus" recommended={d.daily_streak_bonus}><Input type="number" min={0} max={100} value={s.daily_streak_bonus} onChange={(e) => set('daily_streak_bonus', num(e.target.value))} /></Field>
            </div>
          </Section>
          <Section title={t('sections.convert')} description={t('sections.convertText')}>
            <SwitchRow label={t('fields.convert_enabled')} hint={t('hints.convert_enabled')} checked={s.convert_enabled} onChange={(v) => set('convert_enabled', v)} />
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <Field label={t('fields.convert_rate')} hint={t('hints.convert_rate')} level="recommended" errors={errors} field="convert_rate" recommended={d.convert_rate}><Input type="number" min={1} value={s.convert_rate} onChange={(e) => set('convert_rate', num(e.target.value))} /></Field>
              <Field label={t('fields.convert_min_chips')} hint={t('hints.convert_min_chips')} level="recommended" errors={errors} field="convert_min_chips" recommended={d.convert_min_chips}><Input type="number" min={1} value={s.convert_min_chips} onChange={(e) => set('convert_min_chips', num(e.target.value))} /></Field>
              <Field label={t('fields.convert_daily_limit')} hint={t('hints.convert_daily_limit')} level="advanced" errors={errors} field="convert_daily_limit" recommended={d.convert_daily_limit}><Input type="number" min={0} value={s.convert_daily_limit} onChange={(e) => set('convert_daily_limit', num(e.target.value))} /></Field>
            </div>
            <Card className="mt-4 border-dashed bg-secondary/10 p-3 text-sm" aria-live="polite">
              <div className="mb-1 text-[11px] uppercase tracking-wide text-muted-foreground">{t('calculator.title')}</div>
              {[Number(s.convert_min_chips), Number(s.convert_min_chips) * 4].map((chips) => (
                <div key={chips}>{t('calculator.line', { chips: chips.toLocaleString(), coins: coinsFor(chips).toLocaleString() })}</div>
              ))}
              <div className="text-xs text-muted-foreground">{t('calculator.daily', { chips: (Number(s.convert_daily_limit) * Number(s.convert_rate)).toLocaleString(), coins: Number(s.convert_daily_limit).toLocaleString() })}</div>
            </Card>
          </Section>
        </div>
      ) : null}

      {tab === 'stats' ? (
        <div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
            {['players', 'games', 'wagered', 'chips', 'converted'].map((k) => (
              <Card key={k} className="p-4"><div className="text-xs text-muted-foreground">{t(`stats.${k}`)}</div><div className="mt-1 text-xl font-semibold">{Number(data.summary[k]).toLocaleString()}</div></Card>
            ))}
          </div>
          {data.summary.players === 0 ? <p className="mt-4 text-sm text-muted-foreground">{t('stats.empty')}</p> : null}
        </div>
      ) : null}

      {tab === 'advanced' ? <ResetZone guildId={guildId} onDone={reload} /> : null}

      {['general', 'chips'].includes(tab) ? <SaveFooter dirty={form.dirty} saving={saving} onSave={doSave} onDiscard={() => form.reset(form.saved)} errors={errors} /> : null}
    </div>
  );
}

function ResetZone({ guildId, onDone }) {
  const t = useTranslations('guildSettings.blackjack');
  const tk = useTranslations('guildSettings.kit');
  const [scope, setScope] = useState(null);
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    const r = await callApi(guildId, 'blackjack/reset', { method: 'POST', body: { scope, confirm: `blackjack-${scope}` } });
    setBusy(false);
    if (r.ok) { toast.success(t('danger.done')); setScope(null); onDone(); } else toast.error(tk('apiErrors.generic'));
  };
  return (
    <Card className="border-red-500/30 bg-red-500/[0.04] p-5">
      <h3 className="font-semibold text-red-300">{t('danger.title')}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{t('danger.text')}</p>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {['stats', 'chips'].map((k) => (
          <div key={k} className="flex items-center justify-between gap-3 rounded-lg border border-border/50 p-3">
            <div className="min-w-0"><div className="text-sm font-medium">{t(`danger.scope.${k}`)}</div><p className="text-xs text-muted-foreground">{t(`danger.scopeText.${k}`)}</p></div>
            <Button size="sm" variant="outline" className="border-red-500/40 text-red-300" onClick={() => setScope(k)}>{t('danger.reset')}</Button>
          </div>
        ))}
      </div>
      <ConfirmDialog open={Boolean(scope)} onOpenChange={(o) => { if (!o) setScope(null); }} typed={scope ? `blackjack-${scope}` : undefined}
        title={t('danger.confirmTitle')} description={scope ? t(`danger.scopeText.${scope}`) : ''} confirmLabel={t('danger.reset')} busy={busy} onConfirm={run} />
    </Card>
  );
}

'use client';
import { useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Briefcase, Building2, Coins, Crown, Dices, Gem, Gift, Landmark, Loader2, Pencil, Plus, ScrollText, ShieldCheck, ShoppingBag, SlidersHorizontal, Spade, Sparkles, Store, Trash2, TrendingUp, Users, Wallet, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ChannelSelect, RoleSelect, SectionHeader, Empty } from '@/components/dashboard-kit';
import {
  ConfirmDialog, Field, LoadingOrError, ModuleTabs, NativeSelect, PremiumLock, QuickSetup, RecommendedBar, Section, SaveFooter,
  SwitchRow, Pager, callApi, formatDate, useApi, useDraft, useErrorText, useSave,
} from '@/components/module-kit';

const RATE_KEYS = ['bank_interest_rate', 'savings_interest_rate', 'transfer_tax', 'market_tax', 'money_multiplier', 'xp_multiplier', 'job_reward_multiplier'];
const num = (v) => (v === '' || v === null || v === undefined ? '' : Number(v));

export default function EconomyPanel({ guildId, meta, onGetPremium }) {
  const t = useTranslations('guildSettings.economy');
  const api = useApi(guildId, 'economy');
  return (
    <LoadingOrError loading={api.loading} error={api.error} data={api.data} onRetry={api.reload}>
      {api.data && api.data.premium === false ? <PremiumLock title={t('lock.title')} text={t('lock.text')} onGetPremium={onGetPremium} /> : null}
      {api.data && api.data.premium !== false ? <Editor guildId={guildId} meta={meta} data={api.data} reload={api.reload} /> : null}
    </LoadingOrError>
  );
}

function Editor({ guildId, meta, data, reload }) {
  const t = useTranslations('guildSettings.economy');
  const tk = useTranslations('guildSettings.kit');
  const form = useDraft(data.settings);
  const [tab, setTab] = useState('general');
  const [wizard, setWizard] = useState(!data.settings.setup_completed);
  const [finishing, setFinishing] = useState(false);
  const [wizardErrors, setWizardErrors] = useState([]);
  const { save, saving, errors } = useSave(guildId, 'economy', {});
  const s = form.draft;
  const canAdmin = data.can_admin !== false;
  const { apiErrorText } = useErrorText();
  const ref = data.reference;
  const set = (k, v) => form.set({ [k]: v });
  const setIn = (group, k, v) => form.set({ [group]: { ...s[group], [k]: v } });

  const doSave = async () => { if (await save(form.patch)) form.reset({ ...form.draft }); };

  const recommended = useMemo(() => {
    const d = data.defaults || {};
    const keys = ['starting_balance', 'daily_reward', 'weekly_reward', 'bank_interest_rate', 'savings_interest_rate', 'transfer_tax', 'market_tax', 'sell_ratio'];
    return {
      items: keys.map((k) => ({ label: t(`fields.${k}`), value: String(d[k]) })),
      apply: () => form.set(Object.fromEntries(keys.map((k) => [k, d[k]]))),
    };
  }, [data.defaults, t, form]);

  const finish = async () => {
    setFinishing(true); setWizardErrors([]);
    const body = { currency_name: s.currency_name, currency_symbol: s.currency_symbol, currency_icon: s.currency_icon, starting_balance: s.starting_balance, daily_reward: s.daily_reward, log_channel_id: s.log_channel_id, setup_completed: true };
    const r = await callApi(guildId, 'economy', { method: 'PUT', body });
    setFinishing(false);
    if (r.ok) { form.reset({ ...form.draft }); setWizard(false); toast.success(tk('saved')); reload(); } else if (r.data?.error === 'validation_failed') setWizardErrors(r.data.errors || []); else toast.error(tk('apiErrors.generic'));
  };

  const skip = async () => {
    await callApi(guildId, 'economy', { method: 'PUT', body: { setup_completed: true } });
    setWizard(false);
  };

  const tabs = [
    { key: 'general', label: tk('tabs.general'), icon: Coins }, { key: 'rewards', label: t('tabs.rewards'), icon: Sparkles },
    { key: 'shop', label: t('tabs.shop'), icon: ShoppingBag }, { key: 'jobs', label: t('tabs.jobs'), icon: Briefcase },
    { key: 'events', label: t('tabs.events'), icon: Zap }, { key: 'advanced', label: tk('tabs.advanced'), icon: SlidersHorizontal },
    { key: 'logs', label: tk('tabs.logs'), icon: ScrollText },
  ];

  if (wizard) {
    const stepsDef = [
      { key: 'currency', title: t('quick.currency'), description: t('quick.currencyText'), render: () => (
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label={t('fields.currency_name')} hint={t('hints.currency_name')} level="required" errors={wizardErrors} field="currency_name"><Input maxLength={24} value={s.currency_name} onChange={(e) => set('currency_name', e.target.value)} /></Field>
          <Field label={t('fields.currency_symbol')} hint={t('hints.currency_symbol')} level="optional" errors={wizardErrors} field="currency_symbol"><Input maxLength={4} value={s.currency_symbol} onChange={(e) => set('currency_symbol', e.target.value)} /></Field>
          <Field label={t('fields.currency_icon')} hint={t('hints.currency_icon')} level="optional" errors={wizardErrors} field="currency_icon"><Input maxLength={40} value={s.currency_icon} onChange={(e) => set('currency_icon', e.target.value)} /></Field>
        </div>) , valid: () => Boolean(String(s.currency_name || '').trim()) },
      { key: 'rewards', title: t('quick.rewards'), description: t('quick.rewardsText'), render: () => (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('fields.starting_balance')} hint={t('hints.starting_balance')} level="recommended" errors={wizardErrors} field="starting_balance" recommended={data.defaults?.starting_balance}><Input type="number" min={0} value={s.starting_balance} onChange={(e) => set('starting_balance', num(e.target.value))} /></Field>
          <Field label={t('fields.daily_reward')} hint={t('hints.daily_reward')} level="recommended" errors={wizardErrors} field="daily_reward" recommended={data.defaults?.daily_reward}><Input type="number" min={0} value={s.daily_reward} onChange={(e) => set('daily_reward', num(e.target.value))} /></Field>
        </div>) },
      { key: 'logs', title: t('quick.logs'), description: t('quick.logsText'), render: () => (
        <Field label={t('fields.log_channel_id')} hint={t('hints.log_channel_id')} level="optional" errors={wizardErrors} field="log_channel_id">
          <ChannelSelect value={s.log_channel_id} onChange={(v) => set('log_channel_id', v)} channels={meta?.channels || []} placeholder={t('fields.noChannel')} />
        </Field>) },
    ];
    return <QuickSetup title={t('quick.title')} intro={t('quick.intro')} steps={stepsDef} onFinish={finish} onSkip={skip} finishing={finishing} finishLabel={t('quick.finish')} errors={wizardErrors} />;
  }

  return (
    <div>
      <SectionHeader title={t('title')} description={t('description')} />
      <SummaryCards t={t} summary={data.summary} />
      <RecommendedBar items={recommended.items} onApply={recommended.apply} />
      <ModuleTabs tabs={tabs} active={tab} onChange={setTab} />

      {tab === 'general' ? (
        <div className="space-y-6">
          <Section title={t('sections.currency')} description={t('sections.currencyText')}>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label={t('fields.currency_name')} hint={t('hints.currency_name')} level="required" errors={errors} field="currency_name"><Input maxLength={24} value={s.currency_name} onChange={(e) => set('currency_name', e.target.value)} /></Field>
              <Field label={t('fields.currency_symbol')} hint={t('hints.currency_symbol')} level="optional" errors={errors} field="currency_symbol"><Input maxLength={4} value={s.currency_symbol} onChange={(e) => set('currency_symbol', e.target.value)} /></Field>
              <Field label={t('fields.currency_icon')} hint={t('hints.currency_icon')} level="optional" errors={errors} field="currency_icon"><Input maxLength={40} value={s.currency_icon} onChange={(e) => set('currency_icon', e.target.value)} /></Field>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">{t('fields.currencyPreview', { value: `${s.currency_icon || ''} ${Number(s.starting_balance || 0).toLocaleString()} ${s.currency_name || ''}` })}</p>
          </Section>
          <Section title={t('sections.features')} description={t('sections.featuresText')}>
            <div className="grid gap-3 sm:grid-cols-2">
              {ref.features.map((f) => <SwitchRow key={f} label={t(`features.${f}`)} hint={t(`featureHints.${f}`)} checked={s.features[f] !== false} onChange={(v) => setIn('features', f, v)} />)}
            </div>
          </Section>
        </div>
      ) : null}

      {tab === 'rewards' ? (
        <div className="space-y-6">
          <Section title={t('sections.rewards')} description={t('sections.rewardsText')}>
            <NumberGrid keys={['starting_balance', 'daily_reward', 'daily_streak_bonus', 'weekly_reward']} s={s} set={set} errors={errors} bounds={ref.bounds} defaults={data.defaults} t={t} />
          </Section>
          <Section title={t('sections.bank')} description={t('sections.bankText')}>
            <NumberGrid keys={['bank_base_limit', 'bank_limit_per_level', 'bank_interest_rate', 'savings_interest_rate', 'savings_limit_multiplier', 'max_interest_per_day']} s={s} set={set} errors={errors} bounds={ref.bounds} defaults={data.defaults} t={t} />
          </Section>
          <Section title={t('sections.trade')} description={t('sections.tradeText')}>
            <NumberGrid keys={['transfer_tax', 'market_tax', 'sell_ratio', 'max_transfer', 'min_transfer_level']} s={s} set={set} errors={errors} bounds={ref.bounds} defaults={data.defaults} t={t} />
          </Section>
        </div>
      ) : null}

      {tab === 'shop' ? <ShopTab guildId={guildId} reference={ref} settings={s} /> : null}

      {tab === 'jobs' ? (
        <div className="space-y-6">
          <Section title={t('sections.jobs')} description={t('sections.jobsText')}>
            <CatalogGrid group="jobs" catalog={ref.jobs} s={s} setIn={setIn} extra="salary_multiplier" t={t} errors={errors} />
          </Section>
          <Section title={t('sections.businesses')} description={t('sections.businessesText')}>
            <CatalogGrid group="businesses" catalog={ref.businesses} s={s} setIn={setIn} extra="price_multiplier" t={t} errors={errors} />
          </Section>
          <Section title={t('sections.quests')} description={t('sections.questsText')}>
            <div className="grid gap-3 sm:grid-cols-2">
              {['daily', 'weekly', 'monthly', 'special'].map((k) => <SwitchRow key={k} label={t(`quests.${k}`)} checked={s.quests[k] !== false} onChange={(v) => form.set({ quests: { ...s.quests, [k]: v } })} />)}
            </div>
            <div className="mt-4 max-w-xs">
              <Field label={t('quests.reward_multiplier')} hint={t('hints.quest_multiplier')} level="optional" errors={errors} field="quests.reward_multiplier">
                <Input type="number" step="0.1" min={0.1} max={10} value={s.quests.reward_multiplier} onChange={(e) => form.set({ quests: { ...s.quests, reward_multiplier: num(e.target.value) } })} />
              </Field>
            </div>
          </Section>
        </div>
      ) : null}

      {tab === 'events' ? <EventsTab guildId={guildId} reference={ref} /> : null}

      {tab === 'advanced' ? (
        <div className="space-y-6">
          <Section title={t('sections.limits')} description={t('sections.limitsText')}>
            <NumberGrid keys={['max_businesses', 'max_pets', 'max_market_listings', 'start_plots', 'max_plots', 'game_min_bet', 'game_max_bet']} s={s} set={set} errors={errors} bounds={ref.bounds} defaults={data.defaults} t={t} />
          </Section>
          <Section title={t('sections.multipliers')} description={t('sections.multipliersText')}>
            <NumberGrid keys={['money_multiplier', 'xp_multiplier', 'job_reward_multiplier']} s={s} set={set} errors={errors} bounds={ref.bounds} defaults={data.defaults} t={t} step="0.1" />
          </Section>
          <Section title={t('sections.cooldowns')} description={t('sections.cooldownsText')}>
            <div className="grid gap-4 sm:grid-cols-3">
              {ref.cooldowns.map((k) => (
                <Field key={k} label={t(`cooldowns.${k}`)} hint={t('hints.cooldown')} level="advanced" errors={errors} field={`cooldowns.${k}`}>
                  <Input type="number" min={0} value={s.cooldowns[k]} onChange={(e) => form.set({ cooldowns: { ...s.cooldowns, [k]: num(e.target.value) } })} />
                </Field>
              ))}
            </div>
          </Section>
          <Section title={t('sections.staff')} description={t('sections.staffText')}>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label={t('fields.staff_role_ids')} hint={t('hints.staff_role_ids')} level="optional" errors={errors} field="staff_role_ids">
                <div className={canAdmin ? '' : 'pointer-events-none opacity-60'} aria-disabled={!canAdmin}>
                  <RoleMulti value={s.staff_role_ids || []} onChange={(v) => set('staff_role_ids', v)} roles={meta?.roles || []} max={10} t={t} />
                </div>
                {!canAdmin ? <p className="mt-1.5 text-xs text-amber-400">{apiErrorText('admin_required')}</p> : null}
              </Field>
              <Field label={t('fields.log_channel_id')} hint={t('hints.log_channel_id')} level="recommended" errors={errors} field="log_channel_id">
                <ChannelSelect value={s.log_channel_id} onChange={(v) => set('log_channel_id', v)} channels={meta?.channels || []} placeholder={t('fields.noChannel')} />
              </Field>
            </div>
          </Section>
          <DangerZone guildId={guildId} onDone={reload} canAdmin={canAdmin} />
        </div>
      ) : null}

      {tab === 'logs' ? <LogsTab guildId={guildId} /> : null}

      {['general', 'rewards', 'jobs', 'advanced'].includes(tab) ? <SaveFooter dirty={form.dirty} saving={saving} onSave={doSave} onDiscard={() => form.reset(form.saved)} errors={errors} /> : null}
    </div>
  );
}

function NumberGrid({ keys, s, set, errors, bounds, defaults, t, step }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {keys.map((k) => {
        const [min, max] = bounds[k] || [0, undefined];
        const isRate = RATE_KEYS.includes(k);
        return (
          <Field key={k} label={t(`fields.${k}`)} hint={t(`hints.${k}`)} level={isRate ? 'advanced' : 'optional'} errors={errors} field={k} recommended={defaults?.[k]}>
            <Input type="number" min={min} max={max} step={step || (isRate ? '0.1' : '1')} value={s[k]} onChange={(e) => set(k, num(e.target.value))} />
          </Field>
        );
      })}
    </div>
  );
}

function CatalogGrid({ group, catalog, s, setIn, extra, t, errors }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {Object.entries(catalog).map(([key, def]) => {
        const cur = s[group]?.[key] || { enabled: true, [extra]: 1 };
        return (
          <Card key={key} className="flex items-center gap-3 p-3">
            <span className="text-2xl" aria-hidden>{def.emoji}</span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{def.name}</div>
              <div className="mt-1 flex items-center gap-2">
                <label className="text-[11px] text-muted-foreground" htmlFor={`${group}-${key}`}>{t(`catalog.${extra}`)}</label>
                <Input id={`${group}-${key}`} type="number" step="0.1" min={0.1} max={10} className="h-8 w-20" value={cur[extra]} onChange={(e) => setIn(group, key, { ...cur, [extra]: num(e.target.value) })} />
              </div>
            </div>
            <Switch checked={cur.enabled !== false} onCheckedChange={(v) => setIn(group, key, { ...cur, enabled: v })} aria-label={def.name} />
          </Card>
        );
      })}
    </div>
  );
}

function RoleMulti({ value, onChange, roles, max, t }) {
  const available = roles.filter((r) => !value.includes(String(r.id)));
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {value.map((id) => {
          const role = roles.find((r) => String(r.id) === String(id));
          return <Badge key={id} variant="secondary" className="gap-1">{role?.name || id}<button type="button" aria-label={t('fields.removeRole')} onClick={() => onChange(value.filter((v) => v !== id))}>×</button></Badge>;
        })}
      </div>
      {value.length < max ? <RoleSelect value="" onChange={(v) => v && onChange([...value, String(v)])} roles={available} placeholder={t('fields.addRole')} includeNone={false} /> : null}
    </div>
  );
}


const BLANK_ITEM = { name: '', description: '', emoji: '📦', image: '', category: 'custom', rarity: 'common', currency: 'coins', price: 100, stock: null, max_purchase: null, restock_amount: null, restock_hours: null, cooldown: 0, discount: 0, enabled: true, featured: false, available_from: null, available_until: null, sale_ends_at: null };
const toLocalInput = (v) => { if (!v) return ''; const d = new Date(v); if (Number.isNaN(d.getTime())) return ''; const p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };

function ShopTab({ guildId, reference, settings }) {
  const t = useTranslations('guildSettings.economy');
  const tk = useTranslations('guildSettings.kit');
  const api = useApi(guildId, 'economy/items');
  const [editing, setEditing] = useState(null);
  const [removing, setRemoving] = useState(null);
  const [filter, setFilter] = useState('all');
  const [busy, setBusy] = useState(false);
  const items = (api.data?.items || []).filter((i) => filter === 'all' || i.category === filter);

  const remove = async () => {
    setBusy(true);
    const r = await callApi(guildId, `economy/items/${removing.item_id}`, { method: 'DELETE' });
    setBusy(false);
    if (r.ok) { toast.success(t('shop.removed')); setRemoving(null); api.reload(); } else toast.error(tk('apiErrors.generic'));
  };
  const toggle = async (item) => {
    const r = await callApi(guildId, `economy/items/${item.item_id}`, { method: 'PUT', body: { enabled: item.enabled === false } });
    if (r.ok) api.reload(); else toast.error(tk('apiErrors.generic'));
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <NativeSelect value={filter} onChange={setFilter} label={t('shop.category')} className="max-w-[220px]"
          options={[{ value: 'all', label: t('shop.allCategories') }, ...reference.categories.map(([k, name, emoji]) => ({ value: k, label: `${emoji} ${name}` }))]} />
        <div className="flex-1" />
        <Button size="sm" className="gap-1.5" onClick={() => setEditing({ ...BLANK_ITEM, isNew: true })}><Plus className="h-4 w-4" />{t('shop.add')}</Button>
      </div>
      <LoadingOrError loading={api.loading} error={api.error} data={api.data} onRetry={api.reload}>
        {api.data && items.length === 0 ? <Empty title={t('shop.emptyTitle')} text={t('shop.emptyText')} /> : null}
        <div className="grid gap-3 md:grid-cols-2">
          {items.map((i) => (
            <Card key={i.item_id} className={`flex items-center gap-3 p-3 ${i.enabled === false ? 'opacity-60' : ''}`}>
              <span className="text-2xl" aria-hidden>{i.emoji}</span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2"><span className="truncate text-sm font-medium">{i.name}</span><Badge variant="secondary" className="text-[10px]">{i.rarity}</Badge>{i.featured ? <Badge className="text-[10px]">{t('shop.featured')}</Badge> : null}</div>
                <p className="text-xs text-muted-foreground">{Number(i.price).toLocaleString()} {i.currency === 'gems' ? t('shop.gems') : settings.currency_name}{i.stock !== null && i.stock !== undefined ? ` · ${t('shop.stock', { count: i.stock })}` : ''}</p>
              </div>
              <Switch checked={i.enabled !== false} onCheckedChange={() => toggle(i)} aria-label={t('shop.enabled')} />
              <Button size="icon" variant="ghost" onClick={() => setEditing({ ...BLANK_ITEM, ...i })} aria-label={t('shop.edit')}><Pencil className="h-4 w-4" /></Button>
              <Button size="icon" variant="ghost" onClick={() => setRemoving(i)} aria-label={t('shop.remove')}><Trash2 className="h-4 w-4 text-red-400" /></Button>
            </Card>
          ))}
        </div>
      </LoadingOrError>
      {editing ? <ItemDialog guildId={guildId} item={editing} reference={reference} settings={settings} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); api.reload(); }} /> : null}
      <ConfirmDialog open={Boolean(removing)} onOpenChange={(o) => { if (!o) setRemoving(null); }} title={t('shop.removeTitle')} description={t('shop.removeText', { name: removing?.name || '' })} confirmLabel={t('shop.remove')} onConfirm={remove} busy={busy} />
    </div>
  );
}

function ItemDialog({ guildId, item, reference, settings, onClose, onSaved }) {
  const t = useTranslations('guildSettings.economy');
  const tk = useTranslations('guildSettings.kit');
  const { apiErrorText } = useErrorText();
  const [it, setIt] = useState(item);
  const [errors, setErrors] = useState([]);
  const [saving, setSaving] = useState(false);
  const set = (patch) => setIt((x) => ({ ...x, ...patch }));
  const nullable = (v) => (v === '' || v === null ? null : Number(v));

  const submit = async () => {
    setSaving(true); setErrors([]);
    const body = {
      name: it.name, description: it.description, emoji: it.emoji, image: it.image || '', category: it.category, rarity: it.rarity, currency: it.currency,
      price: Number(it.price), stock: nullable(it.stock), max_purchase: nullable(it.max_purchase), restock_amount: nullable(it.restock_amount), restock_hours: nullable(it.restock_hours),
      cooldown: Number(it.cooldown || 0), discount: Number(it.discount || 0), enabled: it.enabled !== false, featured: Boolean(it.featured),
      available_from: it.available_from ? new Date(it.available_from).toISOString() : null, available_until: it.available_until ? new Date(it.available_until).toISOString() : null,
      sale_ends_at: it.sale_ends_at ? new Date(it.sale_ends_at).toISOString() : null,
    };
    const r = it.isNew ? await callApi(guildId, 'economy/items', { method: 'POST', body }) : await callApi(guildId, `economy/items/${it.item_id}`, { method: 'PUT', body });
    setSaving(false);
    if (r.ok) { toast.success(t('shop.saved')); onSaved(); return; }
    if (r.data?.error === 'validation_failed') setErrors(r.data.errors || []); else toast.error(r.data?.error === 'limit_reached' ? t('shop.limit') : apiErrorText(r.data?.error || 'generic'));
  };

  const finalPrice = Math.max(0, Math.round(Number(it.price || 0) * (1 - Number(it.discount || 0) / 100)));
  const unit = it.currency === 'gems' ? t('shop.gems') : settings.currency_name;

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader><DialogTitle>{it.isNew ? t('shop.add') : t('shop.editTitle', { name: item.name })}</DialogTitle><DialogDescription>{t('shop.editText')}</DialogDescription></DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('shop.name')} hint={t('shopHints.name')} level="required" errors={errors} field="name"><Input maxLength={60} value={it.name} onChange={(e) => set({ name: e.target.value })} /></Field>
          <Field label={t('shop.emoji')} hint={t('shopHints.emoji')} level="optional" errors={errors} field="emoji"><Input maxLength={40} value={it.emoji} onChange={(e) => set({ emoji: e.target.value })} /></Field>
          <div className="sm:col-span-2"><Field label={t('shop.description')} hint={t('shopHints.description')} level="optional" errors={errors} field="description"><Textarea rows={2} maxLength={300} value={it.description} onChange={(e) => set({ description: e.target.value })} /></Field></div>
          <Field label={t('shop.category')} hint={t('shopHints.category')} level="required" errors={errors} field="category"><NativeSelect value={it.category} onChange={(v) => set({ category: v })} label={t('shop.category')} options={reference.categories.map(([k, name, emoji]) => ({ value: k, label: `${emoji} ${name}` }))} /></Field>
          <Field label={t('shop.rarity')} hint={t('shopHints.rarity')} level="optional" errors={errors} field="rarity"><NativeSelect value={it.rarity} onChange={(v) => set({ rarity: v })} label={t('shop.rarity')} options={reference.rarities.map((r) => ({ value: r, label: r }))} /></Field>
          <Field label={t('shop.currency')} hint={t('shopHints.currency')} level="required" errors={errors} field="currency"><NativeSelect value={it.currency} onChange={(v) => set({ currency: v })} label={t('shop.currency')} options={[{ value: 'coins', label: settings.currency_name }, { value: 'gems', label: t('shop.gems') }]} /></Field>
          <Field label={t('shop.price')} hint={t('shopHints.price')} level="required" errors={errors} field="price"><Input type="number" min={0} value={it.price} onChange={(e) => set({ price: e.target.value })} /></Field>
          <Field label={t('shop.discount')} hint={t('shopHints.discount')} level="optional" errors={errors} field="discount"><Input type="number" min={0} max={95} value={it.discount} onChange={(e) => set({ discount: e.target.value })} /></Field>
          <Field label={t('shop.stockLabel')} hint={t('shopHints.stock')} level="optional" errors={errors} field="stock"><Input type="number" min={0} value={it.stock ?? ''} placeholder={t('shop.unlimited')} onChange={(e) => set({ stock: e.target.value })} /></Field>
          <Field label={t('shop.maxPurchase')} hint={t('shopHints.maxPurchase')} level="optional" errors={errors} field="max_purchase"><Input type="number" min={1} value={it.max_purchase ?? ''} placeholder={t('shop.unlimited')} onChange={(e) => set({ max_purchase: e.target.value })} /></Field>
          <Field label={t('shop.restockAmount')} hint={t('shopHints.restock')} level="advanced" errors={errors} field="restock_amount"><Input type="number" min={1} value={it.restock_amount ?? ''} onChange={(e) => set({ restock_amount: e.target.value })} /></Field>
          <Field label={t('shop.restockHours')} hint={t('shopHints.restock')} level="advanced" errors={errors} field="restock_hours"><Input type="number" min={1} value={it.restock_hours ?? ''} onChange={(e) => set({ restock_hours: e.target.value })} /></Field>
          <Field label={t('shop.cooldown')} hint={t('shopHints.cooldown')} level="advanced" errors={errors} field="cooldown"><Input type="number" min={0} value={it.cooldown} onChange={(e) => set({ cooldown: e.target.value })} /></Field>
          <Field label={t('shop.image')} hint={t('shopHints.image')} level="optional" errors={errors} field="image"><Input maxLength={500} placeholder="https://" value={it.image || ''} onChange={(e) => set({ image: e.target.value })} /></Field>
          <Field label={t('shop.availableFrom')} hint={t('shopHints.window')} level="advanced" errors={errors} field="available_from"><Input type="datetime-local" value={toLocalInput(it.available_from)} onChange={(e) => set({ available_from: e.target.value })} /></Field>
          <Field label={t('shop.availableUntil')} hint={t('shopHints.window')} level="advanced" errors={errors} field="available_until"><Input type="datetime-local" value={toLocalInput(it.available_until)} onChange={(e) => set({ available_until: e.target.value })} /></Field>
          <Field label={t('shop.saleEnds')} hint={t('shopHints.saleEnds')} level="advanced" errors={errors} field="sale_ends_at"><Input type="datetime-local" value={toLocalInput(it.sale_ends_at)} onChange={(e) => set({ sale_ends_at: e.target.value })} /></Field>
          <div className="space-y-2 sm:col-span-2">
            <SwitchRow label={t('shop.enabled')} hint={t('shopHints.enabled')} checked={it.enabled !== false} onChange={(v) => set({ enabled: v })} />
            <SwitchRow label={t('shop.featuredLabel')} hint={t('shopHints.featured')} checked={Boolean(it.featured)} onChange={(v) => set({ featured: v })} />
          </div>
          <Card className="border-dashed bg-secondary/10 p-3 sm:col-span-2" aria-label={t('shop.preview')}>
            <div className="mb-1 text-[11px] uppercase tracking-wide text-muted-foreground">{t('shop.preview')}</div>
            <div className="flex items-center gap-3"><span className="text-3xl">{it.emoji}</span><div><div className="font-semibold">{it.name || t('shop.name')}</div><div className="text-xs text-muted-foreground">{it.description}</div><div className="mt-1 text-sm">{Number(it.discount) > 0 ? <><s className="text-muted-foreground">{Number(it.price || 0).toLocaleString()}</s> </> : null}<b>{finalPrice.toLocaleString()}</b> {unit}</div></div></div>
          </Card>
        </div>
        <DialogFooter className="gap-2"><Button variant="outline" onClick={onClose}>{tk('cancel')}</Button><Button onClick={submit} disabled={saving} className="gap-2">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}{tk('save')}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


function EventsTab({ guildId, reference }) {
  const t = useTranslations('guildSettings.economy');
  const tk = useTranslations('guildSettings.kit');
  const locale = useLocale();
  const api = useApi(guildId, 'economy/events');
  const { apiErrorText } = useErrorText();
  const [type, setType] = useState(Object.keys(reference.events)[0]);
  const [hours, setHours] = useState(24);
  const [multiplier, setMultiplier] = useState(2);
  const [goal, setGoal] = useState(1000000);
  const [busy, setBusy] = useState(false);

  const start = async () => {
    setBusy(true);
    const r = await callApi(guildId, 'economy/events', { method: 'POST', body: { type, hours: Number(hours), multiplier: Number(multiplier), goal_target: Number(goal) } });
    setBusy(false);
    if (r.ok) { toast.success(t('events.started')); api.reload(); } else toast.error(r.data?.error === 'event_running' ? t('events.alreadyRunning') : apiErrorText(r.data?.error || 'generic'));
  };
  const stop = async (id) => {
    const r = await callApi(guildId, `economy/events/${id}`, { method: 'DELETE' });
    if (r.ok) { toast.success(t('events.stopped')); api.reload(); } else toast.error(tk('apiErrors.generic'));
  };

  return (
    <div className="space-y-6">
      <Section title={t('events.startTitle')} description={t('events.startText')}>
        <div className="grid gap-4 sm:grid-cols-4">
          <Field label={t('events.type')} hint={t('events.typeHint')} level="required">
            <NativeSelect value={type} onChange={setType} label={t('events.type')} options={Object.entries(reference.events).map(([k, e]) => ({ value: k, label: `${e.emoji} ${e.name}` }))} />
          </Field>
          <Field label={t('events.hours')} hint={t('events.hoursHint')} level="required"><Input type="number" min={0.25} max={720} step="0.25" value={hours} onChange={(e) => setHours(e.target.value)} /></Field>
          <Field label={t('events.multiplier')} hint={t('events.multiplierHint')} level="optional"><Input type="number" min={1} max={10} step="0.5" value={multiplier} onChange={(e) => setMultiplier(e.target.value)} /></Field>
          {type === 'community_goal' ? <Field label={t('events.goal')} hint={t('events.goalHint')} level="required"><Input type="number" min={1000} value={goal} onChange={(e) => setGoal(e.target.value)} /></Field> : null}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">{reference.events[type]?.text}</p>
        <Button className="mt-4 gap-2" onClick={start} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}{t('events.start')}</Button>
      </Section>
      <Section title={t('events.recent')}>
        <LoadingOrError loading={api.loading} error={api.error} data={api.data} onRetry={api.reload}>
          {api.data && api.data.events.length === 0 ? <Empty title={t('events.emptyTitle')} text={t('events.emptyText')} /> : null}
          <ul className="divide-y divide-border/50">
            {(api.data?.events || []).map((e) => (
              <li key={e._id} className="flex flex-wrap items-center gap-3 py-2 text-sm">
                <span>{reference.events[e.type]?.emoji}</span>
                <span className="flex-1">{reference.events[e.type]?.name || e.type} <span className="text-xs text-muted-foreground">x{e.multiplier} · {formatDate(e.starts_at, locale)} / {formatDate(e.ends_at, locale)}</span></span>
                {e.running ? <><Badge className="bg-emerald-600/80">{t('events.running')}</Badge><Button size="sm" variant="outline" onClick={() => stop(e._id)}>{t('events.stop')}</Button></> : <Badge variant="outline">{t('events.ended')}</Badge>}
              </li>
            ))}
          </ul>
        </LoadingOrError>
      </Section>
    </div>
  );
}


const TX_CATEGORY = [
  [/^game_/, 'games'], [/^blackjack_/, 'blackjack'], [/^(transfer|trade)_/, 'transfer'],
  [/^(deposit|withdraw|move|interest)$/, 'bank'], [/^(market_|commodity_)/, 'market'], [/^(purchase|sale|chest)$/, 'shop'],
  [/^business_/, 'business'], [/^(reward|level_reward|event_drop|fishing_gems|farming_gems|starting_balance)$/, 'rewards'], [/^admin$/, 'admin'],
];
const CAT_STYLE = {
  earn: [ArrowDownLeft, 'text-emerald-300 bg-emerald-500/15 border-emerald-400/30'],
  spend: [ArrowUpRight, 'text-red-300 bg-red-500/15 border-red-400/30'],
  transfer: [ArrowLeftRight, 'text-sky-300 bg-sky-500/15 border-sky-400/30'],
  bank: [Landmark, 'text-indigo-300 bg-indigo-500/15 border-indigo-400/30'],
  games: [Dices, 'text-rose-300 bg-rose-500/15 border-rose-400/30'],
  blackjack: [Spade, 'text-rose-300 bg-rose-500/15 border-rose-400/30'],
  market: [TrendingUp, 'text-cyan-300 bg-cyan-500/15 border-cyan-400/30'],
  shop: [ShoppingBag, 'text-amber-300 bg-amber-500/15 border-amber-400/30'],
  business: [Building2, 'text-orange-300 bg-orange-500/15 border-orange-400/30'],
  rewards: [Gift, 'text-fuchsia-300 bg-fuchsia-500/15 border-fuchsia-400/30'],
  admin: [ShieldCheck, 'text-[#e6cd8c] bg-[#e6cd8c]/15 border-[#e6cd8c]/40'],
};
const CUR_ICON = { money: Wallet, gems: Gem, chips: Coins };
const PLACES = ['wallet', 'bank', 'savings', 'gems', 'chips', 'economy', 'shop', 'market'];

function txCategory(row) {
  const type = String(row.type || '');
  for (const [re, cat] of TX_CATEGORY) if (re.test(type)) return cat;
  return Number(row.amount) < 0 ? 'spend' : 'earn';
}
const pretty = (v) => String(v || '').replace(/[_:]+/g, ' ').replace(/\s+/g, ' ').trim().replace(/^./, (c) => c.toUpperCase());

function SummaryCards({ t, summary }) {
  const cards = [['members', Users], ['listings', Store], ['net_worth', Wallet], ['gems', Gem]];
  return (
    <Card className="mb-6 overflow-hidden border-[#e6cd8c]/30 bg-gradient-to-br from-[#e6cd8c]/[0.10] via-card/60 to-card/40 p-4 sm:p-5">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#e6cd8c]/20 text-[#e6cd8c]"><Crown className="h-3.5 w-3.5" /></span>
        <div><div className="text-sm font-semibold">{t('summaryTitle')}</div><div className="text-xs text-muted-foreground">{t('summarySubtitle')}</div></div>
      </div>
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map(([k, Icon]) => (
          <div key={k} className="flex items-center gap-3 rounded-xl border border-border/60 bg-background/40 p-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#e6cd8c]/40 bg-[#e6cd8c]/15 text-[#e6cd8c]"><Icon className="h-5 w-5" /></span>
            <div className="min-w-0">
              <dt className="truncate text-xs text-muted-foreground">{t(`summary.${k}`)}:</dt>
              <dd className="truncate text-lg font-bold tabular-nums">{Number(summary?.[k] || 0).toLocaleString()}</dd>
            </div>
          </div>
        ))}
      </dl>
    </Card>
  );
}

function LogField({ label, children, className = '' }) {
  return (
    <div className={`min-w-0 ${className}`}>
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}:</dt>
      <dd className="truncate text-sm">{children}</dd>
    </div>
  );
}

function LogsTab({ guildId }) {
  const t = useTranslations('guildSettings.economy');
  const locale = useLocale();
  const [kind, setKind] = useState('logs');
  const [page, setPage] = useState(0);
  const api = useApi(guildId, `economy/logs?kind=${kind}&page=${page}`);
  const names = api.data?.names || {};
  const nameOf = (id) => (id ? names[String(id)] || String(id) : '-');
  const place = (v) => {
    const raw = String(v || '');
    if (!raw) return '-';
    if (raw.startsWith('user:')) return nameOf(raw.slice(5));
    if (raw.startsWith('staff:')) return `${t('logs.place.staff')} (${nameOf(raw.slice(6))})`;
    if (raw.startsWith('game:')) return pretty(raw.slice(5));
    if (PLACES.includes(raw)) return t(`logs.place.${raw}`);
    return pretty(raw);
  };
  const actionLabel = (a) => (t.has(`logs.act.${a}`) ? t(`logs.act.${a}`) : pretty(a));
  return (
    <div>
      <div className="mb-4 inline-flex rounded-xl border border-border/60 bg-secondary/20 p-1" role="tablist" aria-label={t('logs.kind')}>
        {[['logs', t('logs.admin'), ShieldCheck], ['transactions', t('logs.transactions'), ScrollText]].map(([k, label, Icon]) => (
          <button key={k} type="button" role="tab" aria-selected={kind === k} onClick={() => { setKind(k); setPage(0); }}
            className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition ${kind === k ? 'bg-[#e6cd8c]/20 text-[#f3d2ac] shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
            <Icon className="h-4 w-4" />{label}
          </button>
        ))}
      </div>
      <LoadingOrError loading={api.loading} error={api.error} data={api.data} onRetry={api.reload}>
        {api.data && api.data.rows.length === 0 ? <Empty title={t('logs.emptyTitle')} text={t('logs.emptyText')} /> : null}
        {api.data && api.data.rows.length > 0 ? (
          <>
            <ul className="space-y-2">
              {api.data.rows.map((r) => {
                if (api.data.kind === 'economy_transactions') {
                  const cat = txCategory(r);
                  const [Icon, tone] = CAT_STYLE[cat];
                  const cur = ['money', 'gems', 'chips'].includes(r.currency) ? r.currency : 'money';
                  const CurIcon = CUR_ICON[cur];
                  const amount = Number(r.amount || 0);
                  return (
                    <li key={r._id} className="rounded-xl border border-border/60 bg-card/50 p-3 sm:p-4">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <span className={`flex h-8 w-8 items-center justify-center rounded-lg border ${tone}`}><Icon className="h-4 w-4" /></span>
                        <span className="font-semibold">{t(`logs.cat.${cat}`)}</span>
                        <code className="rounded bg-secondary/50 px-1.5 py-0.5 text-[10px] text-muted-foreground">{r.type}</code>
                        <span className={`ml-auto font-mono text-base font-bold tabular-nums ${amount < 0 ? 'text-red-300' : 'text-emerald-300'}`}>{amount > 0 ? '+' : ''}{amount.toLocaleString()}</span>
                      </div>
                      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3 lg:grid-cols-6">
                        <LogField label={t('logs.f.member')}>{nameOf(r.user_id)}</LogField>
                        <LogField label={t('logs.f.amount')}><span className="tabular-nums">{Math.abs(amount).toLocaleString()}</span></LogField>
                        <LogField label={t('logs.f.currency')}><span className="inline-flex items-center gap-1"><CurIcon className="h-3.5 w-3.5 text-[#e6cd8c]" />{t(`logs.cur.${cur}`)}</span></LogField>
                        <LogField label={t('logs.f.from')}>{place(r.source)}</LogField>
                        <LogField label={t('logs.f.to')}>{place(r.destination)}</LogField>
                        <LogField label={t('logs.f.date')}>{formatDate(r.created_at, locale)}</LogField>
                      </dl>
                    </li>
                  );
                }
                const [Icon, tone] = CAT_STYLE.admin;
                return (
                  <li key={r._id} className="rounded-xl border border-border/60 bg-card/50 p-3 sm:p-4">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span className={`flex h-8 w-8 items-center justify-center rounded-lg border ${tone}`}><Icon className="h-4 w-4" /></span>
                      <span className="font-semibold">{actionLabel(r.action || r.kind)}</span>
                      {r.amount !== null && r.amount !== undefined ? <span className="ml-auto font-mono text-base font-bold tabular-nums">{Number(r.amount).toLocaleString()}</span> : null}
                    </div>
                    <dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
                      <LogField label={t('logs.f.by')}>{nameOf(r.actor_id)}</LogField>
                      <LogField label={t('logs.f.member')}>{nameOf(r.target_id || r.user_id)}</LogField>
                      <LogField label={t('logs.f.date')}>{formatDate(r.created_at, locale)}</LogField>
                      <LogField label={t('logs.f.details')} className="col-span-2 sm:col-span-4"><span className="whitespace-normal break-words">{r.detail || r.reason || '-'}</span></LogField>
                    </dl>
                  </li>
                );
              })}
            </ul>
            <Pager page={page} total={api.data.total} perPage={20} onChange={setPage} />
          </>
        ) : null}
      </LoadingOrError>
    </div>
  );
}


function DangerZone({ guildId, onDone, canAdmin = true }) {
  const t = useTranslations('guildSettings.economy');
  const tk = useTranslations('guildSettings.kit');
  const [scope, setScope] = useState(null);
  const [memberId, setMemberId] = useState('');
  const [userReset, setUserReset] = useState(false);
  const [busy, setBusy] = useState(false);
  const run = async (path, body, after) => {
    setBusy(true);
    const r = await callApi(guildId, path, { method: 'POST', body });
    setBusy(false);
    if (r.ok) { toast.success(t('danger.done')); after(); onDone(); } else toast.error(r.data?.error === 'validation_failed' ? tk('errors.invalid') : tk('apiErrors.generic'));
  };
  return (
    <Card className="border-red-500/30 bg-red-500/[0.04] p-5">
      <h3 className="font-semibold text-red-300">{t('danger.title')}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{t('danger.text')}</p>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {['economy', 'shop', 'market', 'leaderboard'].map((k) => (
          <div key={k} className="flex items-center justify-between gap-3 rounded-lg border border-border/50 p-3">
            <div className="min-w-0"><div className="text-sm font-medium">{t(`danger.scope.${k}`)}</div><p className="text-xs text-muted-foreground">{t(`danger.scopeText.${k}`)}</p></div>
            <Button size="sm" variant="outline" className="border-red-500/40 text-red-300" disabled={!canAdmin} onClick={() => setScope(k)}>{t('danger.reset')}</Button>
          </div>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap items-end gap-2">
        <div className="min-w-[220px] flex-1"><Field label={t('danger.memberId')} hint={t('danger.memberHint')} level="optional"><Input inputMode="numeric" value={memberId} onChange={(e) => setMemberId(e.target.value.replace(/\D/g, '').slice(0, 25))} placeholder="123456789012345678" /></Field></div>
        <Button variant="outline" className="border-red-500/40 text-red-300" disabled={!canAdmin || memberId.length < 15} onClick={() => setUserReset(true)}>{t('danger.resetMember')}</Button>
      </div>
      <ConfirmDialog open={Boolean(scope)} onOpenChange={(o) => { if (!o) setScope(null); }} typed={scope || undefined}
        title={t('danger.confirmTitle')} description={t('danger.confirmText', { scope: scope ? t(`danger.scope.${scope}`) : '' })} confirmLabel={t('danger.reset')} busy={busy}
        onConfirm={() => run('economy/reset', { scope, confirm: scope }, () => setScope(null))} />
      <ConfirmDialog open={userReset} onOpenChange={setUserReset} typed="RESET"
        title={t('danger.confirmTitle')} description={t('danger.confirmMemberText', { id: memberId })} confirmLabel={t('danger.resetMember')} busy={busy}
        onConfirm={() => run('economy/reset-user', { user_id: memberId, confirm: 'RESET' }, () => { setUserReset(false); setMemberId(''); })} />
    </Card>
  );
}

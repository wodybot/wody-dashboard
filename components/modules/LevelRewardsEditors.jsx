'use client';
// Levels page: "Level Rewards" and "Role XP Bonuses". Both are plain lists kept
// in the Levels settings (level_rewards / level_role_bonuses) and saved with the
// page's own Save bar, so they use the same permission check as every other
// Levels setting. The API validates everything again; the checks here only give
// the admin a clear message before anything is sent.
import { useTranslations } from 'next-intl';
import { Gift, Plus, Trash2, Zap, AlertTriangle, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { RoleSelect } from '@/components/dashboard-kit';

export const MAX_LEVEL_REWARDS = 50;
export const MAX_ROLE_BONUSES = 25;

const newId = () => {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID().replace(/-/g, '').slice(0, 12);
  } catch { /* fall through */ }
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
};

const num = (v) => (v === '' || v === null || v === undefined ? NaN : Number(v));
const roleName = (roles, id) => (roles || []).find((r) => String(r.id) === String(id))?.name;

// Returns the translation key (under guildSettings.levels) of the first problem, or null.
export function levelRulesIssue(settings, roles) {
  const known = new Set((roles || []).map((r) => String(r.id)));
  for (const r of settings.level_rewards || []) {
    const level = num(r.level);
    if (!Number.isInteger(level) || level < 1 || level > 1000) return 'rwErrLevel';
    const bonus = r.bonus_xp === '' || r.bonus_xp == null ? 0 : num(r.bonus_xp);
    if (!Number.isInteger(bonus) || bonus < 0 || bonus > 1000000) return 'rwErrBonus';
    if (!r.role_id && bonus === 0) return 'rwErrEmpty';
    if (r.role_id && known.size && !known.has(String(r.role_id))) return 'rwErrRole';
  }
  const seen = new Set();
  for (const b of settings.level_role_bonuses || []) {
    if (!b.role_id || (known.size && !known.has(String(b.role_id)))) return 'rbErrRole';
    if (seen.has(String(b.role_id))) return 'rbErrDuplicate';
    seen.add(String(b.role_id));
    const mult = b.multiplier === '' || b.multiplier == null ? 1 : num(b.multiplier);
    if (!Number.isFinite(mult) || mult < 1 || mult > 10) return 'rbErrMultiplier';
    const flat = b.flat_xp === '' || b.flat_xp == null ? 0 : num(b.flat_xp);
    if (!Number.isInteger(flat) || flat < 0 || flat > 1000) return 'rbErrFlat';
    const prio = b.priority === '' || b.priority == null ? 0 : num(b.priority);
    if (!Number.isInteger(prio) || prio < 0 || prio > 1000) return 'rbErrPriority';
    if (mult === 1 && flat === 0) return 'rbErrEmpty';
  }
  return null;
}

function Header({ icon: Icon, title, hint, count, max, onAdd, addLabel, disabled }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start gap-3">
      <div className="flex items-start gap-3 min-w-0 flex-1">
        <div className="h-10 w-10 shrink-0 rounded-lg gradient-primary text-white grid place-items-center"><Icon className="w-5 h-5" /></div>
        <div className="min-w-0">
          <div className="font-semibold leading-tight flex items-center gap-2 flex-wrap">{title}<Badge variant="secondary">{count} / {max}</Badge></div>
          <p className="text-xs text-muted-foreground mt-1">{hint}</p>
        </div>
      </div>
      <Button type="button" size="sm" className="gradient-primary w-full sm:w-auto shrink-0" onClick={onAdd} disabled={disabled}><Plus className="w-4 h-4 mr-1" />{addLabel}</Button>
    </div>
  );
}

function RowShell({ enabled, onToggle, onDelete, label, children, warning }) {
  return (
    <div className={`rounded-xl border p-4 space-y-3 transition-colors ${enabled ? 'border-border/60 bg-secondary/10' : 'border-border/40 bg-secondary/5 opacity-70'}`}>
      {children}
      {warning && <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-600 dark:text-amber-400"><AlertTriangle className="w-4 h-4 shrink-0 mt-px" /><span>{warning}</span></div>}
      <div className="flex items-center justify-between gap-3 border-t border-border/40 pt-3">
        <label className="flex items-center gap-2 text-xs font-medium cursor-pointer"><Switch checked={enabled} onCheckedChange={onToggle} aria-label={label} />{label}</label>
        <Button type="button" variant="ghost" size="sm" onClick={onDelete} className="text-destructive hover:text-destructive"><Trash2 className="w-4 h-4" /></Button>
      </div>
    </div>
  );
}

export function LevelRewardsEditor({ rewards, onChange, roles }) {
  const t = useTranslations('guildSettings.levels');
  const list = Array.isArray(rewards) ? rewards : [];
  const full = list.length >= MAX_LEVEL_REWARDS;
  const patch = (id, p) => onChange(list.map((r) => (r.id === id ? { ...r, ...p } : r)));
  const remove = (id) => onChange(list.filter((r) => r.id !== id));
  const add = () => onChange([...list, { id: newId(), level: 5, role_id: null, bonus_xp: 100, name: '', description: '', enabled: true }]);
  const preview = list.filter((r) => r.enabled !== false && Number.isInteger(num(r.level))).sort((a, b) => num(a.level) - num(b.level));
  return (
    <Card className="p-6 bg-card/60 space-y-5">
      <Header icon={Gift} title={t('rwTitle')} hint={t('rwHint')} count={list.length} max={MAX_LEVEL_REWARDS} onAdd={add} addLabel={t('rwAdd')} disabled={full} />
      {list.length === 0 && <div className="rounded-xl border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">{t('rwEmpty')}</div>}
      <div className="space-y-3">
        {list.map((r) => {
          const bonus = r.bonus_xp === '' || r.bonus_xp == null ? 0 : num(r.bonus_xp);
          const missingRole = r.role_id && (roles || []).length > 0 && !roleName(roles, r.role_id);
          const warning = missingRole ? t('rwRoleMissing') : (!r.role_id && !(bonus > 0) ? t('rwNeedsReward') : null);
          return (
            <RowShell key={r.id} enabled={r.enabled !== false} onToggle={(v) => patch(r.id, { enabled: v })} onDelete={() => remove(r.id)} label={r.enabled !== false ? t('rwEnabled') : t('rwDisabled')} warning={warning}>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="lg:col-span-2"><Label>{t('rwName')}</Label><Input value={r.name || ''} maxLength={60} onChange={(e) => patch(r.id, { name: e.target.value })} placeholder={t('rwNamePlaceholder')} /></div>
                <div><Label>{t('rwLevel')}</Label><Input type="number" inputMode="numeric" min={1} max={1000} value={r.level ?? ''} onChange={(e) => patch(r.id, { level: e.target.value === '' ? '' : Number(e.target.value) })} /></div>
                <div><Label>{t('rwBonusXp')}</Label><Input type="number" inputMode="numeric" min={0} max={1000000} value={r.bonus_xp ?? ''} onChange={(e) => patch(r.id, { bonus_xp: e.target.value === '' ? '' : Number(e.target.value) })} /></div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div><Label>{t('rwRole')}</Label><RoleSelect value={r.role_id} onChange={(v) => patch(r.id, { role_id: v })} roles={roles} placeholder={t('rwNoRole')} /></div>
                <div><Label>{t('rwDescription')}</Label><Input value={r.description || ''} maxLength={200} onChange={(e) => patch(r.id, { description: e.target.value })} placeholder={t('rwDescriptionPlaceholder')} /></div>
              </div>
            </RowShell>
          );
        })}
      </div>
      {preview.length > 0 && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-primary mb-2">{t('rwPreviewTitle')}</div>
          <ol className="space-y-1.5">
            {preview.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                <span className="inline-flex min-w-[4.5rem] justify-center rounded-md bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary">{t('rwPreviewLevel', { level: num(r.level) })}</span>
                <span className="font-medium">{r.name || t('rwPreviewDefaultName', { level: num(r.level) })}</span>
                {r.role_id && <span className="text-muted-foreground">@{roleName(roles, r.role_id) || '?'}</span>}
                {num(r.bonus_xp) > 0 && <span className="text-muted-foreground">+{num(r.bonus_xp)} XP</span>}
              </li>
            ))}
          </ol>
        </div>
      )}
      <p className="flex items-start gap-2 text-xs text-muted-foreground"><ShieldCheck className="w-4 h-4 shrink-0 mt-px" />{t('rwBotNote')}</p>
    </Card>
  );
}

export function RoleXpBonusesEditor({ bonuses, onChange, roles }) {
  const t = useTranslations('guildSettings.levels');
  const list = Array.isArray(bonuses) ? bonuses : [];
  const full = list.length >= MAX_ROLE_BONUSES;
  const patch = (id, p) => onChange(list.map((r) => (r.id === id ? { ...r, ...p } : r)));
  const remove = (id) => onChange(list.filter((r) => r.id !== id));
  const add = () => onChange([...list, { id: newId(), role_id: null, multiplier: 1.5, flat_xp: 0, priority: 0, enabled: true }]);
  const used = list.map((b) => String(b.role_id || '')).filter(Boolean);
  return (
    <Card className="p-6 bg-card/60 space-y-5">
      <Header icon={Zap} title={t('rbTitle')} hint={t('rbHint')} count={list.length} max={MAX_ROLE_BONUSES} onAdd={add} addLabel={t('rbAdd')} disabled={full} />
      {list.length === 0 && <div className="rounded-xl border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">{t('rbEmpty')}</div>}
      <div className="space-y-3">
        {list.map((b) => {
          const mult = b.multiplier === '' || b.multiplier == null ? 1 : num(b.multiplier);
          const flat = b.flat_xp === '' || b.flat_xp == null ? 0 : num(b.flat_xp);
          const dup = b.role_id && used.filter((x) => x === String(b.role_id)).length > 1;
          const missingRole = b.role_id && (roles || []).length > 0 && !roleName(roles, b.role_id);
          const warning = dup ? t('rbDuplicate') : missingRole ? t('rwRoleMissing') : (mult === 1 && flat === 0 ? t('rbNeedsEffect') : null);
          return (
            <RowShell key={b.id} enabled={b.enabled !== false} onToggle={(v) => patch(b.id, { enabled: v })} onDelete={() => remove(b.id)} label={b.enabled !== false ? t('rwEnabled') : t('rwDisabled')} warning={warning}>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="sm:col-span-2 lg:col-span-1"><Label>{t('rbRole')}</Label><RoleSelect value={b.role_id} onChange={(v) => patch(b.id, { role_id: v })} roles={roles} includeNone={false} placeholder={t('rbPickRole')} /></div>
                <div><Label>{t('rbMultiplier')}</Label><Input type="number" inputMode="decimal" min={1} max={10} step={0.1} value={b.multiplier ?? ''} onChange={(e) => patch(b.id, { multiplier: e.target.value === '' ? '' : Number(e.target.value) })} /></div>
                <div><Label>{t('rbFlat')}</Label><Input type="number" inputMode="numeric" min={0} max={1000} value={b.flat_xp ?? ''} onChange={(e) => patch(b.id, { flat_xp: e.target.value === '' ? '' : Number(e.target.value) })} /></div>
                <div><Label>{t('rbPriority')}</Label><Input type="number" inputMode="numeric" min={0} max={1000} value={b.priority ?? ''} onChange={(e) => patch(b.id, { priority: e.target.value === '' ? '' : Number(e.target.value) })} /></div>
              </div>
              {b.role_id && !missingRole && (
                <div className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">@{roleName(roles, b.role_id) || '?'}</span>: {mult > 1 ? t('rbPreviewMult', { mult }) : ''}{mult > 1 && flat > 0 ? ' · ' : ''}{flat > 0 ? t('rbPreviewFlat', { xp: flat }) : ''}
                </div>
              )}
            </RowShell>
          );
        })}
      </div>
      <div className="rounded-xl border border-border/50 bg-secondary/10 p-3 text-xs text-muted-foreground space-y-1">
        <p>{t('rbRuleNote')}</p>
        <p>{t('rbExample')}</p>
      </div>
    </Card>
  );
}

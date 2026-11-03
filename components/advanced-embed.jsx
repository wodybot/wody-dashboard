'use client';
import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export function useAdvancedEmbed() {
  const [mode, setMode] = useState('simple');
  const [authorName, setAuthorName] = useState('');
  const [fields, setFields] = useState([]);
  const [buttons, setButtons] = useState([]);
  const updateRow = (setter, i, patch) => setter((rows) => rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const reset = () => { setAuthorName(''); setFields([]); setButtons([]); };
  return { mode, setMode, advanced: mode === 'advanced', authorName, setAuthorName, fields, setFields, buttons, setButtons, updateRow, reset };
}

export function buildAdvancedPayload(adv, t, { withEmbed = true } = {}) {
  if (!adv.advanced) return { payload: undefined };
  const cleanFields = withEmbed ? adv.fields.filter((f) => f.name.trim() || f.value.trim()) : [];
  if (cleanFields.some((f) => !f.name.trim() || !f.value.trim())) return { error: t('fieldIncomplete') };
  const cleanButtons = [];
  for (const b of adv.buttons) {
    if (!b.label.trim() && !b.url.trim()) continue;
    if (!b.label.trim()) return { error: t('buttonNeedsLabel') };
    try {
      const u = new URL(b.url.trim());
      if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new Error('bad_protocol');
      cleanButtons.push({ label: b.label.trim(), url: u.href, emoji: b.emoji.trim() || undefined });
    } catch {
      return { error: t('invalidButtonUrl', { label: b.label.trim() }) };
    }
  }
  return {
    payload: {
      author: withEmbed ? (adv.authorName.trim() || undefined) : undefined,
      fields: cleanFields.map((f) => ({ name: f.name.trim(), value: f.value.trim() })),
      buttons: cleanButtons,
    },
  };
}

export function previewFields(adv) { return adv.advanced ? adv.fields.filter((f) => f.name.trim() || f.value.trim()) : []; }
export function previewButtons(adv) { return adv.advanced ? adv.buttons.filter((b) => b.label.trim()).map((b) => ({ label: b.label.trim(), emoji: b.emoji.trim(), style: 'link' })) : []; }

export function AdvancedModeToggle({ adv, t }) {
  return (
    <div role="group" aria-label={t('modeLabel')} className="inline-flex rounded-lg border border-border/60 bg-background/50 p-0.5">
      {['simple', 'advanced'].map((m) => (
        <button key={m} type="button" aria-pressed={adv.mode === m} onClick={() => adv.setMode(m)} className={`h-9 px-4 rounded-md text-sm font-medium transition-colors ${adv.mode === m ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
          {t(m === 'simple' ? 'modeSimple' : 'modeAdvanced')}
        </button>
      ))}
    </div>
  );
}

export function AdvancedFields({ adv, t, showEmbedParts = true }) {
  const { fields, setFields, buttons, setButtons, updateRow } = adv;
  return (
    <div className="space-y-4 rounded-xl border border-border/60 bg-background/40 p-3 sm:p-4">
      <p className="text-xs text-muted-foreground">{t('advancedHint')}</p>
      {showEmbedParts ? (
        <>
          <div><Label>{t('authorLabel')}</Label><Input value={adv.authorName} maxLength={256} onChange={(e) => adv.setAuthorName(e.target.value)} /></div>
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2"><Label className="mb-0">{t('fieldsTitle')} ({fields.length}/10)</Label>
              <Button type="button" size="sm" variant="outline" disabled={fields.length >= 10} onClick={() => setFields((r) => [...r, { name: '', value: '' }])}><Plus className="w-3.5 h-3.5 mr-1" />{t('addField')}</Button></div>
            {fields.map((f, i) => (
              <div key={i} className="rounded-lg border border-border/50 p-2 space-y-2">
                <div className="flex gap-2"><Input placeholder={t('fieldName')} maxLength={256} value={f.name} onChange={(e) => updateRow(setFields, i, { name: e.target.value })} />
                  <Button type="button" size="sm" variant="ghost" aria-label={t('remove')} onClick={() => setFields((r) => r.filter((_, j) => j !== i))}><Trash2 className="w-4 h-4" /></Button></div>
                <Textarea placeholder={t('fieldValue')} rows={2} maxLength={1024} value={f.value} onChange={(e) => updateRow(setFields, i, { value: e.target.value })} />
              </div>
            ))}
          </div>
        </>
      ) : null}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2"><Label className="mb-0">{t('buttonsTitle')} ({buttons.length}/5)</Label>
          <Button type="button" size="sm" variant="outline" disabled={buttons.length >= 5} onClick={() => setButtons((r) => [...r, { label: '', url: '', emoji: '' }])}><Plus className="w-3.5 h-3.5 mr-1" />{t('addButton')}</Button></div>
        {buttons.map((b, i) => (
          <div key={i} className="rounded-lg border border-border/50 p-2 grid sm:grid-cols-[1fr_1.4fr_5rem_auto] gap-2 items-center">
            <Input placeholder={t('buttonLabel')} maxLength={80} value={b.label} onChange={(e) => updateRow(setButtons, i, { label: e.target.value })} />
            <Input placeholder="https://" maxLength={512} value={b.url} onChange={(e) => updateRow(setButtons, i, { url: e.target.value })} />
            <Input placeholder={t('buttonEmoji')} maxLength={8} value={b.emoji} onChange={(e) => updateRow(setButtons, i, { emoji: e.target.value })} />
            <Button type="button" size="sm" variant="ghost" aria-label={t('remove')} onClick={() => setButtons((r) => r.filter((_, j) => j !== i))}><Trash2 className="w-4 h-4" /></Button>
          </div>
        ))}
      </div>
    </div>
  );
}

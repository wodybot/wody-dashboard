'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { ArrowDown, ArrowUp, Bold, CheckCircle2, GripVertical, Heading2, ImageIcon, Italic, Link2, List, Loader2, Monitor, Smile, Smartphone, Tablet, Trash2, Upload, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Field, NativeSelect, Section, ColorField } from '@/components/module-kit';
import { SafeMarkdown } from '@/components/community/SafeMarkdown';
import { cfetch, colorOf } from '@/components/community/client';
import { catalogName } from '@/lib/community/names';
import { previewProfile } from '@/lib/community/preview';
import { resolveTheme } from '@/components/community/theme';
import { LIMITS, THEME_PRESETS, SOCIAL_PLATFORMS, LOCKED_SECTIONS, CARD_STYLES, BUTTON_STYLES, SERVER_TYPES, LANGUAGES } from '@/lib/community/constants';
import { routing } from '@/i18n/routing';

const EMOJI = ['😀', '😄', '😎', '🥳', '🔥', '⭐', '🎮', '🎧', '🏆', '🎉', '💬', '❤️', '🤝', '🌍', '📚', '💻', '🎨', '🎵', '🚀', '✨', '👾', '⚔️', '🎲', '☕'];

function Chips({ items, selected, onToggle, label, disabled, max }) {
  const t = useTranslations('community');
  const set = new Set(selected);
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {items.map((it) => {
        const on = set.has(it.value);
        const blocked = disabled || (!on && max && selected.length >= max);
        return (
          <button key={it.value} type="button" aria-pressed={on} disabled={blocked} onClick={() => onToggle(it.value)}
            className={`rounded-full border px-3 py-1 text-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#e6cd8c] disabled:opacity-50 motion-reduce:transition-none ${on ? 'border-[#e6cd8c] bg-[#e6cd8c]/25 text-[#f2c091]' : 'border-border/60 text-muted-foreground hover:bg-secondary/50'}`}>
            {on ? <CheckCircle2 className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" /> : null}{it.label}
          </button>
        );
      })}
      {max ? <span className="self-center text-xs text-muted-foreground">{t('owner.selectedOf', { count: selected.length, max })}</span> : null}
    </div>
  );
}

const toggleIn = (list, v) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

export function OwnerProfile({ guildId, draft, set, options, errors, disabled, urlPrefix = 'server' }) {
  const t = useTranslations('community');
  const locale = useLocale();
  const area = useRef(null);
  const [showPreview, setShowPreview] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [invite, setInvite] = useState(null);
  const [checking, setChecking] = useState(false);
  const [roles, setRoles] = useState(null);
  const subs = options.categories.filter((c) => c.parent === draft.category);
  const cats = options.categories.filter((c) => !c.parent);

  const wrap = (before, after = before, placeholder = '') => {
    const el = area.current; if (!el || disabled) return;
    const { selectionStart: s, selectionEnd: e } = el;
    const sel = draft.description.slice(s, e) || placeholder;
    set({ description: `${draft.description.slice(0, s)}${before}${sel}${after}${draft.description.slice(e)}` });
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(s + before.length, s + before.length + sel.length); });
  };
  const linePrefix = (prefix) => {
    const el = area.current; if (!el || disabled) return;
    const s = el.selectionStart; const start = draft.description.lastIndexOf('\n', s - 1) + 1;
    set({ description: `${draft.description.slice(0, start)}${prefix}${draft.description.slice(start)}` });
    requestAnimationFrame(() => el.focus());
  };
  const insert = (text) => { const el = area.current; const s = el?.selectionStart ?? draft.description.length; set({ description: `${draft.description.slice(0, s)}${text}${draft.description.slice(s)}` }); setEmojiOpen(false); requestAnimationFrame(() => el?.focus()); };

  const checkInvite = async () => {
    setChecking(true);
    const r = await cfetch(`owner/${guildId}/invite-check`, { method: 'POST', body: { invite: draft.invite_code } });
    setChecking(false); setInvite(r.ok ? r.data : { status: 'unreachable' });
  };
  const loadRoles = async () => { const r = await cfetch(`owner/${guildId}/roles`); if (r.ok) setRoles(r.data.items); else toast.error(t('errors.discord_unavailable')); };
  const roleName = (id) => (roles || draft.staff_roles || []).find((r) => String(r.id) === String(id))?.name || id;

  return (
    <div className="space-y-6">
      <Section title={t('owner.sections.basics')} description={t('owner.sections.basicsText')}>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label={t('fields.name')} hint={`${t('hints.name')} ${t('hints.range', { min: LIMITS.name[0], max: LIMITS.name[1] })}`} level="required" errors={errors} field="name">
            <Input value={draft.name} onChange={(e) => set({ name: e.target.value })} maxLength={LIMITS.name[1]} disabled={disabled} />
          </Field>
          <Field label={t('fields.slug')} hint={`${t('hints.slug')} ${t('hints.range', { min: LIMITS.slug[0], max: LIMITS.slug[1] })}`} level="required" errors={errors} field="slug">
            <Input value={draft.slug} onChange={(e) => set({ slug: e.target.value.toLowerCase() })} maxLength={LIMITS.slug[1]} disabled={disabled} className="font-mono" />
            <p className="mt-1 break-all text-xs text-muted-foreground">{t('owner.publicUrl', { url: `wody.online/${urlPrefix}/${draft.slug || '...'}` })}</p>
          </Field>
          <div className="md:col-span-2">
            <Field label={t('fields.short_description')} hint={`${t('hints.short_description')} ${t('hints.range', { min: LIMITS.short[0], max: LIMITS.short[1] })}`} level="required" errors={errors} field="short_description">
              <Input value={draft.short_description} onChange={(e) => set({ short_description: e.target.value })} maxLength={LIMITS.short[1]} disabled={disabled} />
              <p className="mt-1 text-right text-xs text-muted-foreground">{draft.short_description.length}/{LIMITS.short[1]}</p>
            </Field>
          </div>
          <div className="md:col-span-2">
            <Field label={t('fields.description')} hint={`${t('hints.description')} ${t('hints.range', { min: LIMITS.description[0], max: LIMITS.description[1] })}`} level="required" errors={errors} field="description">
              <div className="rounded-md border border-input">
                <div className="flex flex-wrap items-center gap-1 border-b border-input p-1.5" role="toolbar" aria-label={t('owner.editor.toolbar')}>
                  <Button type="button" size="icon" variant="ghost" onClick={() => wrap('**', '**', t('owner.editor.bold'))} aria-label={t('owner.editor.bold')} disabled={disabled}><Bold className="h-4 w-4" /></Button>
                  <Button type="button" size="icon" variant="ghost" onClick={() => wrap('*', '*', t('owner.editor.italic'))} aria-label={t('owner.editor.italic')} disabled={disabled}><Italic className="h-4 w-4" /></Button>
                  <Button type="button" size="icon" variant="ghost" onClick={() => linePrefix('# ')} aria-label={t('owner.editor.heading')} disabled={disabled}><Heading2 className="h-4 w-4" /></Button>
                  <Button type="button" size="icon" variant="ghost" onClick={() => linePrefix('- ')} aria-label={t('owner.editor.list')} disabled={disabled}><List className="h-4 w-4" /></Button>
                  <Button type="button" size="icon" variant="ghost" onClick={() => wrap('[', '](https://)', t('owner.editor.linkText'))} aria-label={t('owner.editor.link')} disabled={disabled}><Link2 className="h-4 w-4" /></Button>
                  <div className="relative">
                    <Button type="button" size="icon" variant="ghost" onClick={() => setEmojiOpen((o) => !o)} aria-expanded={emojiOpen} aria-label={t('owner.editor.emoji')} disabled={disabled}><Smile className="h-4 w-4" /></Button>
                    {emojiOpen ? <div role="dialog" aria-label={t('owner.editor.emoji')} className="absolute left-0 top-10 z-20 grid w-56 grid-cols-6 gap-1 rounded-lg border border-border bg-popover p-2 shadow-xl">{EMOJI.map((e) => <button key={e} type="button" onClick={() => insert(e)} className="rounded p-1 text-lg hover:bg-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#e6cd8c]" aria-label={e}>{e}</button>)}</div> : null}
                  </div>
                  <div className="ml-auto"><Button type="button" size="sm" variant={showPreview ? 'secondary' : 'ghost'} onClick={() => setShowPreview((v) => !v)} aria-pressed={showPreview}>{t('owner.editor.preview')}</Button></div>
                </div>
                {showPreview ? <div className="min-h-[12rem] p-3 text-sm"><SafeMarkdown text={draft.description} /></div> : (
                  <Textarea ref={area} value={draft.description} onChange={(e) => set({ description: e.target.value })} rows={9} maxLength={LIMITS.description[1]} disabled={disabled} className="border-0 focus-visible:ring-0" aria-label={t('fields.description')} />
                )}
              </div>
              <p className="mt-1 flex justify-between text-xs text-muted-foreground"><span>{t('owner.editor.note')}</span><span>{draft.description.length}/{LIMITS.description[1]}</span></p>
            </Field>
          </div>
        </div>
      </Section>

      <Section title={t('owner.sections.classification')} description={t('owner.sections.classificationText')}>
        <div className="grid gap-4 md:grid-cols-3">
          <Field label={t('fields.category')} hint={t('hints.category')} level="required" errors={errors} field="category">
            <NativeSelect value={draft.category} onChange={(v) => set({ category: v, subcategory: '' })} label={t('fields.category')} disabled={disabled} options={[{ value: '', label: t('common.choose') }, ...cats.map((c) => ({ value: c.slug, label: catalogName(t, 'categories', c, locale) }))]} />
          </Field>
          <Field label={t('fields.subcategory')} hint={t('hints.subcategory')} level="optional" errors={errors} field="subcategory">
            <NativeSelect value={draft.subcategory || ''} onChange={(v) => set({ subcategory: v })} label={t('fields.subcategory')} disabled={disabled || !subs.length} options={[{ value: '', label: t('common.none') }, ...subs.map((c) => ({ value: c.slug, label: catalogName(t, 'categories', c, locale) }))]} />
          </Field>
          <Field label={t('fields.server_type')} hint={t('hints.server_type')} level="recommended" errors={errors} field="server_type">
            <NativeSelect value={draft.server_type} onChange={(v) => set({ server_type: v })} label={t('fields.server_type')} disabled={disabled} options={SERVER_TYPES.map((s) => ({ value: s, label: t(`types.${s}`) }))} />
          </Field>
          <div className="md:col-span-3"><Field label={t('fields.languages')} hint={t('hints.languages')} level="required" errors={errors} field="languages">
            <Chips items={LANGUAGES.map((l) => ({ value: l, label: t(`languages.${l}`) }))} selected={draft.languages} onToggle={(v) => set({ languages: toggleIn(draft.languages, v) })} label={t('fields.languages')} disabled={disabled} max={LIMITS.languages} />
          </Field></div>
          <div className="md:col-span-3"><Field label={t('fields.tags')} hint={t('hints.tags')} level="required" errors={errors} field="tags">
            <Chips items={options.tags.map((x) => ({ value: x.slug, label: catalogName(t, 'tags', x, locale) }))} selected={draft.tags} onToggle={(v) => set({ tags: toggleIn(draft.tags, v) })} label={t('fields.tags')} disabled={disabled} max={LIMITS.tags} />
          </Field></div>
          <div className="md:col-span-3"><Field label={t('fields.features')} hint={t('hints.features')} level="recommended" errors={errors} field="features">
            <Chips items={options.features.map((x) => ({ value: x.slug, label: catalogName(t, 'features', x, locale) }))} selected={draft.features} onToggle={(v) => set({ features: toggleIn(draft.features, v) })} label={t('fields.features')} disabled={disabled} max={LIMITS.features} />
          </Field></div>
        </div>
      </Section>

      <Section title={t('owner.sections.invite')} description={t('owner.sections.inviteText')}>
        <Field label={t('fields.invite_code')} hint={t('hints.invite_code')} level="required" errors={errors} field="invite_code">
          <div className="flex gap-2">
            <Input value={draft.invite_code} onChange={(e) => { set({ invite_code: e.target.value.trim() }); setInvite(null); }} placeholder="https://discord.gg/..." disabled={disabled} maxLength={80} />
            <Button type="button" variant="outline" onClick={checkInvite} disabled={checking || !draft.invite_code || disabled}>{checking ? <Loader2 className="h-4 w-4 animate-spin" /> : null}{t('owner.invite.check')}</Button>
          </div>
          {invite ? <p role="status" className={`mt-2 flex items-center gap-1.5 text-sm ${invite.status === 'valid' ? 'text-emerald-400' : 'text-red-400'}`}>{invite.status === 'valid' ? <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> : <XCircle className="h-4 w-4" aria-hidden="true" />}{t(`owner.invite.${invite.status}`)}</p> : null}
          <p className="mt-1 text-xs text-muted-foreground">{t('owner.invite.note')}</p>
        </Field>
      </Section>

      <Section title={t('owner.sections.staff')} description={t('owner.sections.staffText')}>
        <Field label={t('fields.staff_role_ids')} hint={t('hints.staff_role_ids')} level="optional" errors={errors} field="staff_role_ids">
          <div className="flex flex-wrap gap-2">
            {draft.staff_role_ids.map((id) => <span key={id} className="inline-flex items-center gap-1 rounded-full border border-border/60 px-3 py-1 text-sm">{roleName(id)}<button type="button" disabled={disabled} onClick={() => set({ staff_role_ids: draft.staff_role_ids.filter((x) => x !== id) })} aria-label={t('common.remove')}><XCircle className="h-3.5 w-3.5" /></button></span>)}
            {!roles ? <Button type="button" variant="outline" size="sm" onClick={loadRoles} disabled={disabled}>{t('owner.loadRoles')}</Button> : null}
          </div>
          {roles ? <div className="mt-3"><Chips items={roles.map((r) => ({ value: r.id, label: r.name }))} selected={draft.staff_role_ids} onToggle={(v) => set({ staff_role_ids: toggleIn(draft.staff_role_ids, v) })} label={t('fields.staff_role_ids')} disabled={disabled} max={LIMITS.staff_roles} /></div> : null}
        </Field>
      </Section>
    </div>
  );
}

function ImageUpload({ guildId, kind, id, options, onImage, disabled, error }) {
  const t = useTranslations('community');
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState('');
  const [drag, setDrag] = useState(false);
  const rule = options.image_rules[kind];
  const [localUrl, setLocalUrl] = useState(null);
  const [remoteLoaded, setRemoteLoaded] = useState(false);
  useEffect(() => { setRemoteLoaded(false); }, [id]);
  useEffect(() => () => { if (localUrl) URL.revokeObjectURL(localUrl); }, [localUrl]);
  const upload = async (file) => {
    if (!file) return;
    setBusy(true); setLocalError('');
    const preview = URL.createObjectURL(file);
    setLocalUrl(preview);
    const form = new FormData(); form.set('kind', kind); form.set('file', file);
    const r = await cfetch(`owner/${guildId}/image`, { method: 'POST', form });
    setBusy(false);
    if (r.ok) {
      const newId = r.data.listing?.content?.[`${kind}_id`];
      if (newId && typeof window !== 'undefined') { const im = new window.Image(); im.src = `/api/community/img/${newId}`; }
      onImage(r.data.listing); toast.success(t('owner.imageSaved'));
    } else {
      setLocalUrl(null);
      const e = r.data?.errors?.[0]; setLocalError(e ? t(`errors.${e.code}`, e.params || {}) : (t.has(`errors.${r.data?.error}`) ? t(`errors.${r.data.error}`) : t('errors.generic')));
    }
  };
  const remove = async () => { setBusy(true); const r = await cfetch(`owner/${guildId}/image?kind=${kind}`, { method: 'DELETE' }); setBusy(false); if (r.ok) { setLocalUrl(null); onImage(r.data.listing); } };
  const showLocal = Boolean(localUrl) && (busy || !remoteLoaded);
  return (
    <div>
      <div
        onDragOver={(e) => { e.preventDefault(); if (!disabled) setDrag(true); }} onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); if (!disabled) upload(e.dataTransfer.files?.[0]); }}
        className={`relative flex min-h-[9rem] flex-col items-center justify-center overflow-hidden rounded-xl border-2 border-dashed p-4 text-center text-sm ${drag ? 'border-[#e6cd8c] bg-[#e6cd8c]/10' : 'border-border/60'}`}>
        {id ? <img key={id} src={`/api/community/img/${id}`} alt={t(`fields.${kind}`)} decoding="async" onLoad={() => setRemoteLoaded(true)} className="absolute inset-0 h-full w-full object-cover opacity-70" /> : null}
        {showLocal ? <img src={localUrl} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover opacity-70" /> : null}
        <div className="relative z-10 flex flex-col items-center gap-2 rounded-lg bg-background/80 px-3 py-2 backdrop-blur">
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImageIcon className="h-5 w-5" aria-hidden="true" />}
          <span>{t('owner.imageDrop')}</span>
          <div className="flex gap-2">
            <label className={`inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-secondary/50 focus-within:ring-2 focus-within:ring-ring ${disabled ? 'pointer-events-none opacity-50' : ''}`}>
              <Upload className="h-4 w-4" aria-hidden="true" />{id ? t('owner.imageReplace') : t('owner.imageUpload')}
              <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="sr-only" disabled={disabled || busy} onChange={(e) => { upload(e.target.files?.[0]); e.target.value = ''; }} />
            </label>
            {id ? <Button type="button" variant="outline" size="sm" onClick={remove} disabled={disabled || busy}><Trash2 className="mr-1 h-4 w-4" />{t('common.remove')}</Button> : null}
          </div>
        </div>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{t('owner.imageRules', { w: rule.minW, h: rule.minH, mb: 2 })}</p>
      {localError || error ? <p role="alert" className="mt-1 text-sm text-red-400">{localError}</p> : null}
    </div>
  );
}

export function OwnerDesign({ guildId, draft, set, options, errors, disabled, adopt }) {
  const t = useTranslations('community');
  const theme = resolveTheme(draft.theme);
  const custom = draft.theme?.preset === 'custom';
  const choose = (preset) => set({ theme: preset === 'custom' ? { preset: 'custom', ...theme } : { preset, ...THEME_PRESETS[preset] } });
  const patchTheme = (patch) => set({ theme: { preset: 'custom', ...theme, ...patch } });
  return (
    <div className="space-y-6">
      <Section title={t('owner.sections.images')} description={t('owner.sections.imagesText')}>
        <div className="grid gap-5 md:grid-cols-2">
          <Field label={t('fields.banner')} hint={t('hints.banner')} level="required" errors={errors} field="banner"><ImageUpload guildId={guildId} kind="banner" id={draft.banner_id} options={options} onImage={adopt} disabled={disabled} /></Field>
          <Field label={t('fields.background')} hint={t('hints.background')} level="optional" errors={errors} field="background"><ImageUpload guildId={guildId} kind="background" id={draft.background_id} options={options} onImage={adopt} disabled={disabled} /></Field>
        </div>
      </Section>
      <Section title={t('owner.sections.theme')} description={t('owner.sections.themeText')}>
        <div role="radiogroup" aria-label={t('fields.theme')} className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {[...Object.keys(THEME_PRESETS), 'custom'].map((key) => {
            const p = key === 'custom' ? theme : THEME_PRESETS[key];
            const on = (draft.theme?.preset || 'dark') === key;
            return (
              <button key={key} type="button" role="radio" aria-checked={on} disabled={disabled} onClick={() => choose(key)}
                className={`rounded-xl border-2 p-3 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#e6cd8c] disabled:opacity-50 motion-reduce:transition-none ${on ? 'border-[#e6cd8c]' : 'border-border/60 hover:border-border'}`}>
                <div className="mb-2 flex h-10 overflow-hidden rounded-md" aria-hidden="true"><span className="flex-1" style={{ background: p.background }} /><span className="flex-1" style={{ background: p.secondary }} /><span className="flex-1" style={{ background: p.primary }} /><span className="flex-1" style={{ background: p.accent }} /></div>
                <span className="text-sm font-medium">{t(`themes.${key}`)}</span>
              </button>
            );
          })}
        </div>
        {custom ? (
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {['primary', 'accent', 'secondary', 'background'].map((k) => (
              <Field key={k} label={t(`fields.color_${k}`)} hint={t('hints.color')} level="optional" errors={errors} field={`theme.${k}`}><ColorField value={theme[k]} onChange={(v) => patchTheme({ [k]: v })} label={t(`fields.color_${k}`)} /></Field>
            ))}
            <Field label={t('fields.card_style')} hint={t('hints.card_style')} level="optional" errors={errors} field="theme.card_style"><NativeSelect value={theme.card_style} onChange={(v) => patchTheme({ card_style: v })} label={t('fields.card_style')} options={CARD_STYLES.map((s) => ({ value: s, label: t(`cardStyles.${s}`) }))} /></Field>
            <Field label={t('fields.button_style')} hint={t('hints.button_style')} level="optional" errors={errors} field="theme.button_style"><NativeSelect value={theme.button_style} onChange={(v) => patchTheme({ button_style: v })} label={t('fields.button_style')} options={BUTTON_STYLES.map((s) => ({ value: s, label: t(`buttonStyles.${s}`) }))} /></Field>
          </div>
        ) : <p className="mt-4 text-xs text-muted-foreground">{t('owner.customNote')}</p>}
      </Section>
    </div>
  );
}

export function OwnerSections({ draft, set, options, disabled }) {
  const t = useTranslations('community');
  const [dragKey, setDragKey] = useState(null);
  const list = draft.sections;
  const move = (from, to) => {
    if (to < 1 || to >= list.length || from < 1) return;
    const next = [...list]; const [item] = next.splice(from, 1); next.splice(to, 0, item); set({ sections: next });
  };
  const toggle = (key) => set({ sections: list.map((s) => (s.key === key ? { ...s, enabled: !s.enabled } : s)) });
  return (
    <Section title={t('owner.sections.order')} description={t('owner.sections.orderText')}>
      <ol className="space-y-2">
        {list.map((s, i) => {
          const locked = LOCKED_SECTIONS.includes(s.key);
          return (
            <li key={s.key} draggable={!disabled && !locked}
              onDragStart={() => setDragKey(s.key)} onDragOver={(e) => { if (dragKey && !locked) e.preventDefault(); }}
              onDrop={(e) => { e.preventDefault(); const from = list.findIndex((x) => x.key === dragKey); move(from, i); setDragKey(null); }}
              className={`flex items-center gap-3 rounded-xl border bg-card/50 px-3 py-2.5 ${dragKey === s.key ? 'opacity-50' : ''} ${s.enabled ? 'border-border/60' : 'border-dashed border-border/40 opacity-70'}`}>
              <GripVertical className={`h-4 w-4 shrink-0 ${locked ? 'opacity-20' : 'cursor-grab text-muted-foreground'}`} aria-hidden="true" />
              <div className="min-w-0 flex-1"><div className="text-sm font-medium">{t(`profile.${s.key === 'social' ? 'social' : s.key === 'statistics' ? 'statistics' : s.key}`)}</div>{locked ? <div className="text-xs text-muted-foreground">{t('owner.sectionLocked')}</div> : null}</div>
              <div className="flex items-center gap-1">
                <Button type="button" size="icon" variant="ghost" onClick={() => move(i, i - 1)} disabled={disabled || locked || i <= 1} aria-label={t('owner.moveUp', { name: t(`profile.${s.key}`) })}><ArrowUp className="h-4 w-4" /></Button>
                <Button type="button" size="icon" variant="ghost" onClick={() => move(i, i + 1)} disabled={disabled || locked || i >= list.length - 1} aria-label={t('owner.moveDown', { name: t(`profile.${s.key}`) })}><ArrowDown className="h-4 w-4" /></Button>
                <Switch checked={s.enabled} onCheckedChange={() => toggle(s.key)} disabled={disabled || locked} aria-label={t('owner.toggleSection', { name: t(`profile.${s.key}`) })} />
              </div>
            </li>
          );
        })}
      </ol>
      <p className="mt-3 text-xs text-muted-foreground">{t('owner.sectionsNote')}</p>
    </Section>
  );
}

export function OwnerSocial({ draft, set, options, errors, disabled }) {
  const t = useTranslations('community');
  return (
    <Section title={t('owner.sections.social')} description={t('owner.sections.socialText')}>
      <div className="grid gap-4 md:grid-cols-2">
        {options.socials.map((k) => (
          <Field key={k} label={t(`social.${k}`)} hint={t('hints.social', { hosts: SOCIAL_PLATFORMS[k].hosts ? SOCIAL_PLATFORMS[k].hosts.join(', ') : t('owner.anyHost') })} level="optional" errors={errors} field={`socials.${k}`}>
            <Input type="url" inputMode="url" value={draft.socials?.[k] || ''} onChange={(e) => set({ socials: { ...draft.socials, [k]: e.target.value.trim() } })} placeholder="https://" disabled={disabled} maxLength={300} />
          </Field>
        ))}
      </div>
    </Section>
  );
}

const DEVICES = { desktop: { width: 1100, icon: Monitor }, tablet: { width: 768, icon: Tablet }, mobile: { width: 390, icon: Smartphone } };

export function OwnerPreview({ draft, state, options, guildId, active = true }) {
  const profile = useMemo(() => previewProfile(draft, state, guildId), [draft, state, guildId]);
  const catalog = useMemo(() => ({ categories: options.categories, tags: options.tags, features: options.features }), [options]);
  return <DevicePreview profile={profile} catalog={catalog} active={active} />;
}

export function DevicePreview({ profile, catalog, active = true }) {
  const t = useTranslations('community');
  const locale = useLocale();
  const [device, setDevice] = useState('desktop');
  const [ready, setReady] = useState(false);
  const [scale, setScale] = useState(1);
  const [height, setHeight] = useState(900);
  const frame = useRef(null);
  const box = useRef(null);
  const src = `${locale === routing.defaultLocale ? '' : `/${locale}`}/servers/preview-frame`;
  useEffect(() => {
    const onMessage = (e) => {
      if (e.origin !== window.location.origin || e.source !== frame.current?.contentWindow) return;
      if (e.data?.type === 'wody-community-preview-ready') setReady(true);
      if (e.data?.type === 'wody-community-preview-height' && Number(e.data.height) > 0) setHeight(Math.min(6000, Math.max(500, Math.ceil(e.data.height))));
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);
  const sentOnce = useRef(false);
  useEffect(() => {
    if (!ready || !profile) return undefined;
    const send = () => frame.current?.contentWindow?.postMessage({ type: 'wody-community-preview', listing: profile, catalog }, window.location.origin);
    if (!sentOnce.current || active) { sentOnce.current = true; send(); return undefined; }
    const id = setTimeout(send, 60);
    return () => clearTimeout(id);
  }, [ready, profile, catalog, active]);
  useEffect(() => {
    const el = box.current; if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const update = () => { if (el.clientWidth > 0) setScale(Math.min(1, (el.clientWidth - 16) / DEVICES[device].width)); };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el); return () => ro.disconnect();
  }, [device, active]);
  const w = DEVICES[device].width;
  const viewH = Math.min(height, 1400);
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div role="radiogroup" aria-label={t('preview.device')} className="inline-flex rounded-lg border border-border/60 p-0.5">
          {Object.entries(DEVICES).map(([key, { icon: Icon }]) => (
            <Button key={key} type="button" size="sm" variant={device === key ? 'secondary' : 'ghost'} role="radio" aria-checked={device === key} onClick={() => setDevice(key)} className="gap-1.5"><Icon className="h-4 w-4" aria-hidden="true" />{t(`preview.${key}`)}</Button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">{t('preview.note')}</p>
      </div>
      <div ref={box} className="overflow-hidden rounded-2xl border border-border/60 bg-[#0b0b0d] p-2 shadow-inner">
        <div className="mx-auto overflow-hidden rounded-xl" style={{ width: w * scale, height: viewH * scale }}>
          <iframe ref={frame} title={t('preview.title')} src={src} loading="eager" sandbox="allow-scripts allow-same-origin" scrolling="yes" style={{ width: w, height: viewH, transform: `scale(${scale})`, transformOrigin: 'top left', border: 0, background: '#0b0b0d', display: 'block' }} />
        </div>
      </div>
    </div>
  );
}

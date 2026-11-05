'use client';
// Page Studio editor tabs that edit the page configuration: sections, content, search and Discord. Text: bpStudio.ui.
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { ConfirmDialog, Field, NativeSelect, Section, SwitchRow } from '@/components/module-kit';
import { OwnerImageField } from '@/components/owner-image-field';
import WodyIcon from '@/components/wody-icon';
import { ic } from '@/components/gifstudio/gs-kit';
import { SECTION_TYPES, BLOCK_TYPES, LIMITS, LAYOUT_WIDTH, SPACING } from '@/lib/battlepass/studio/constants';

const HIGHLIGHT_ICONS = ['medal', 'trophy', 'gift', 'quests', 'xp', 'crown', 'star', 'level', 'rewards', 'leaderboard', 'gem', 'sparkles'];
const ICONS = {};
export const icn = (name) => (ICONS[name] ||= ic(name, 18));
const newId = (type) => `${type}_${Math.random().toString(36).slice(2, 8)}`;

function Txt({ label, value, onChange, max, multiline, placeholder, error, hint }) {
  return (
    <Field label={label} hint={hint}>
      {multiline
        ? <textarea className="min-h-[84px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm" value={value || ''} maxLength={max} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
        : <Input value={value || ''} maxLength={max} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />}
      {error ? <p className="mt-1 text-xs text-red-400">{error}</p> : null}
    </Field>
  );
}

/** Which field the server last refused, so the matching input can show the message. */
const errFor = (fieldErr, field, text) => (fieldErr && fieldErr.field === field ? text : null);

export function SectionsTab({ cfg, set, fieldErr, errText }) {
  const t = useTranslations('bpStudio');
  const [removing, setRemoving] = useState(null);
  const secs = cfg.sections;
  const setSecs = (next) => set('sections', next);
  const patch = (i, p) => setSecs(secs.map((s, j) => (j === i ? { ...s, ...p } : s)));
  const move = (i, d) => { const j = i + d; if (j < 0 || j >= secs.length) return; const n = [...secs]; [n[i], n[j]] = [n[j], n[i]]; setSecs(n); };
  const have = new Set(secs.map((s) => s.type));
  const missing = SECTION_TYPES.filter((x) => !have.has(x));
  const blocks = secs.filter((s) => BLOCK_TYPES.includes(s.type)).length;
  const isBlock = (s) => BLOCK_TYPES.includes(s.type);
  const label = (s) => (isBlock(s) ? t(`ui.block.${s.type}`) : t(`ui.section.${s.type}`));
  const dup = (i) => { const s = secs[i]; const n = [...secs]; n.splice(i + 1, 0, { ...s, id: newId(s.type) }); setSecs(n); };
  const add = (type, block) => setSecs([...secs, block ? { id: newId(type), type, on: true, title: '', ...(type === 'button' ? { label: '', url: '' } : {}), ...(type === 'image' ? { url: '', alt: '' } : {}), ...(type === 'text' ? { text: '' } : {}) } : { id: type, type, on: true, title: '' }]);

  return (
    <div className="space-y-6">
      <Section title={t('ui.sections.title')} description={t('ui.sections.intro')} icon={icn('module')}>
        <ul className="space-y-2">
          {secs.map((s, i) => (
            <li key={s.id} className="rounded-xl border border-border/50 bg-secondary/10 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Switch checked={s.on !== false} onCheckedChange={(v) => patch(i, { on: v })} aria-label={t('ui.sections.toggle', { name: label(s) })} disabled={s.type === 'hero'} />
                <span className={`min-w-0 flex-1 truncate text-sm font-medium ${s.on === false ? 'text-muted-foreground line-through' : ''}`}>{label(s)}</span>
                <Button type="button" variant="ghost" size="sm" aria-label={t('ui.sections.up')} disabled={i === 0} onClick={() => move(i, -1)}><WodyIcon name="back" size={16} /></Button>
                <Button type="button" variant="ghost" size="sm" aria-label={t('ui.sections.down')} disabled={i === secs.length - 1} onClick={() => move(i, 1)}><WodyIcon name="next" size={16} /></Button>
                <Button type="button" variant="ghost" size="sm" aria-label={t('ui.sections.duplicate')} title={isBlock(s) ? undefined : t('ui.sections.noDuplicate')} disabled={!isBlock(s) || blocks >= LIMITS.blocks} onClick={() => dup(i)}><WodyIcon name="duplicate" size={16} /></Button>
                <Button type="button" variant="ghost" size="sm" aria-label={t('ui.sections.remove')} disabled={s.type === 'hero'} onClick={() => setRemoving(i)}><WodyIcon name="delete" size={16} /></Button>
              </div>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                <Input value={s.title || ''} maxLength={60} placeholder={t('ui.sections.titlePlaceholder')} aria-label={t('ui.sections.titleLabel')} onChange={(e) => patch(i, { title: e.target.value })} />
                {s.type === 'text' ? <Input value={s.text || ''} maxLength={LIMITS.text} placeholder={t('ui.sections.textPlaceholder')} aria-label={t('ui.sections.textLabel')} onChange={(e) => patch(i, { text: e.target.value })} /> : null}
                {s.type === 'button' ? (<>
                  <Input value={s.label || ''} maxLength={LIMITS.label} placeholder={t('ui.sections.buttonLabel')} aria-label={t('ui.sections.buttonLabel')} onChange={(e) => patch(i, { label: e.target.value })} />
                  <Input value={s.url || ''} placeholder="https://" aria-label={t('ui.sections.url')} onChange={(e) => patch(i, { url: e.target.value })} />
                </>) : null}
                {s.type === 'image' ? (<>
                  <div className="sm:col-span-2"><OwnerImageField compact label={t('ui.sections.image')} value={s.url || ''} onChange={(v) => patch(i, { url: v })} /></div>
                  <Input value={s.alt || ''} maxLength={LIMITS.alt} placeholder={t('ui.sections.alt')} aria-label={t('ui.sections.alt')} onChange={(e) => patch(i, { alt: e.target.value })} />
                </>) : null}
              </div>
            </li>
          ))}
        </ul>
        {fieldErr?.field === 'sections' ? <p className="text-xs text-red-400">{errText}</p> : null}
        <div className="flex flex-wrap gap-2 pt-2">
          {missing.map((x) => <Button key={x} type="button" size="sm" variant="outline" onClick={() => add(x, false)}><WodyIcon name="add" size={14} className="mr-1.5" />{t(`ui.section.${x}`)}</Button>)}
          {BLOCK_TYPES.map((x) => <Button key={x} type="button" size="sm" variant="outline" disabled={blocks >= LIMITS.blocks} onClick={() => add(x, true)}><WodyIcon name="add" size={14} className="mr-1.5" />{t(`ui.block.${x}`)}</Button>)}
        </div>
        <p className="text-xs text-muted-foreground">{t('ui.sections.dataNote')}</p>
      </Section>

      <Section title={t('ui.layout.title')} description={t('ui.layout.intro')} icon={icn('design')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('ui.layout.width')}><NativeSelect value={cfg.layout.width} onChange={(v) => set('layout', { ...cfg.layout, width: v })} options={Object.keys(LAYOUT_WIDTH).map((v) => ({ value: v, label: t(`ui.layout.widths.${v}`) }))} label={t('ui.layout.width')} /></Field>
          <Field label={t('ui.layout.spacing')}><NativeSelect value={cfg.layout.spacing} onChange={(v) => set('layout', { ...cfg.layout, spacing: v })} options={SPACING.map((v) => ({ value: v, label: t(`ui.layout.spacings.${v}`) }))} label={t('ui.layout.spacing')} /></Field>
        </div>
      </Section>

      <ConfirmDialog open={removing !== null} onOpenChange={(o) => { if (!o) setRemoving(null); }} icon={<WodyIcon name="warning" size={20} />}
        title={t('ui.sections.removeTitle')} description={removing !== null ? t('ui.sections.removeText', { name: label(secs[removing] || {}) }) : ''} confirmLabel={t('ui.sections.remove')}
        onConfirm={() => { setSecs(secs.filter((_, j) => j !== removing)); setRemoving(null); }} />
    </div>
  );
}

export function ContentTab({ cfg, set, fieldErr, errText }) {
  const t = useTranslations('bpStudio');
  const hero = cfg.hero; const ov = cfg.overview;
  const e = (f) => errFor(fieldErr, f, errText);
  return (
    <div className="space-y-6">
      <Section title={t('ui.hero.title')} description={t('ui.hero.intro')} icon={icn('battlepass')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Txt label={t('ui.hero.eyebrow')} value={hero.eyebrow} max={40} onChange={(v) => set('hero', { ...hero, eyebrow: v })} error={e('hero.eyebrow')} />
          <Txt label={t('ui.hero.titleField')} value={hero.title} max={80} onChange={(v) => set('hero', { ...hero, title: v })} placeholder={t('ui.hero.titleFallback')} error={e('hero.title')} />
        </div>
        <Txt label={t('ui.hero.subtitle')} value={hero.subtitle} max={160} onChange={(v) => set('hero', { ...hero, subtitle: v })} error={e('hero.subtitle')} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Txt label={t('ui.hero.ctaLabel')} value={hero.cta_label} max={LIMITS.label} onChange={(v) => set('hero', { ...hero, cta_label: v })} error={e('hero.cta_label')} />
          <Txt label={t('ui.hero.ctaUrl')} value={hero.cta_url} placeholder="https://" onChange={(v) => set('hero', { ...hero, cta_url: v })} error={e('hero.cta_url')} />
        </div>
      </Section>

      <Section title={t('ui.overview.title')} description={t('ui.overview.intro')} icon={icn('info')}>
        <Txt label={t('ui.overview.text')} value={ov.text} max={600} multiline onChange={(v) => set('overview', { ...ov, text: v })} error={e('overview.text')} />
        <ul className="space-y-2">
          {ov.highlights.map((h, i) => (
            <li key={i} className="flex flex-wrap items-center gap-2">
              <WodyIcon name={h.icon || 'sparkles'} size={20} />
              <div className="w-40"><NativeSelect value={h.icon || ''} onChange={(v) => set('overview', { ...ov, highlights: ov.highlights.map((x, j) => (j === i ? { ...x, icon: v } : x)) })} options={[{ value: '', label: t('ui.overview.noIcon') }, ...HIGHLIGHT_ICONS.map((n) => ({ value: n, label: t(`ui.icons.${n}`) }))]} label={t('ui.overview.icon')} /></div>
              <Input className="min-w-0 flex-1" value={h.text} maxLength={80} aria-label={t('ui.overview.highlight')} onChange={(ev) => set('overview', { ...ov, highlights: ov.highlights.map((x, j) => (j === i ? { ...x, text: ev.target.value } : x)) })} />
              <Button type="button" variant="ghost" size="sm" aria-label={t('ui.remove')} onClick={() => set('overview', { ...ov, highlights: ov.highlights.filter((_, j) => j !== i) })}><WodyIcon name="delete" size={16} /></Button>
            </li>
          ))}
        </ul>
        <Button type="button" size="sm" variant="outline" disabled={ov.highlights.length >= LIMITS.highlights} onClick={() => set('overview', { ...ov, highlights: [...ov.highlights, { icon: 'star', text: '' }] })}><WodyIcon name="add" size={14} className="mr-1.5" />{t('ui.overview.add')}</Button>
      </Section>

      <Section title={t('ui.faq.title')} description={t('ui.faq.intro')} icon={icn('faq')}>
        {cfg.faq.map((f, i) => (
          <Card key={i} className="space-y-2 p-3">
            <Input value={f.q} maxLength={LIMITS.q} placeholder={t('ui.faq.q')} aria-label={t('ui.faq.q')} onChange={(ev) => set('faq', cfg.faq.map((x, j) => (j === i ? { ...x, q: ev.target.value } : x)))} />
            <textarea className="min-h-[64px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm" value={f.a} maxLength={LIMITS.a} placeholder={t('ui.faq.a')} aria-label={t('ui.faq.a')} onChange={(ev) => set('faq', cfg.faq.map((x, j) => (j === i ? { ...x, a: ev.target.value } : x)))} />
            <Button type="button" variant="ghost" size="sm" onClick={() => set('faq', cfg.faq.filter((_, j) => j !== i))}><WodyIcon name="delete" size={14} className="mr-1.5" />{t('ui.remove')}</Button>
          </Card>
        ))}
        <Button type="button" size="sm" variant="outline" disabled={cfg.faq.length >= LIMITS.faq} onClick={() => set('faq', [...cfg.faq, { q: '', a: '' }])}><WodyIcon name="add" size={14} className="mr-1.5" />{t('ui.faq.add')}</Button>
        <p className="text-xs text-muted-foreground">{t('ui.faq.note')}</p>
        {e('faq') ? <p className="text-xs text-red-400">{errText}</p> : null}
      </Section>

      <Section title={t('ui.footer.title')} description={t('ui.footer.intro')} icon={icn('link')}>
        <Txt label={t('ui.footer.text')} value={cfg.footer.text} max={200} onChange={(v) => set('footer', { ...cfg.footer, text: v })} error={e('footer.text')} />
        {cfg.footer.links.map((l, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2">
            <Input className="w-40" value={l.label} maxLength={LIMITS.label} placeholder={t('ui.footer.linkLabel')} aria-label={t('ui.footer.linkLabel')} onChange={(ev) => set('footer', { ...cfg.footer, links: cfg.footer.links.map((x, j) => (j === i ? { ...x, label: ev.target.value } : x)) })} />
            <Input className="min-w-0 flex-1" value={l.url} placeholder="https://" aria-label={t('ui.sections.url')} onChange={(ev) => set('footer', { ...cfg.footer, links: cfg.footer.links.map((x, j) => (j === i ? { ...x, url: ev.target.value } : x)) })} />
            <Button type="button" variant="ghost" size="sm" aria-label={t('ui.remove')} onClick={() => set('footer', { ...cfg.footer, links: cfg.footer.links.filter((_, j) => j !== i) })}><WodyIcon name="delete" size={16} /></Button>
          </div>
        ))}
        <Button type="button" size="sm" variant="outline" disabled={cfg.footer.links.length >= LIMITS.links} onClick={() => set('footer', { ...cfg.footer, links: [...cfg.footer.links, { label: '', url: '' }] })}><WodyIcon name="add" size={14} className="mr-1.5" />{t('ui.footer.add')}</Button>
        {e('footer.links') ? <p className="text-xs text-red-400">{errText}</p> : null}
      </Section>
    </div>
  );
}

export function SeoTab({ cfg, set, slug, setSlug, slugLocked, fieldErr, errText, origin }) {
  const t = useTranslations('bpStudio');
  const e = (f) => errFor(fieldErr, f, errText);
  return (
    <div className="space-y-6">
      <Section title={t('ui.url.title')} description={t('ui.url.intro')} icon={icn('link')}>
        <Field label={t('ui.url.slug')} hint={slugLocked ? t('ui.url.locked') : t('ui.url.hint')}>
          <div className="flex items-center gap-2 text-sm"><span className="text-muted-foreground">{origin}/battlepass/</span><Input value={slug} maxLength={LIMITS.slug} disabled={slugLocked} onChange={(ev) => setSlug(ev.target.value)} aria-label={t('ui.url.slug')} /></div>
          {e('slug') ? <p className="mt-1 text-xs text-red-400">{errText}</p> : null}
        </Field>
      </Section>

      <Section title={t('ui.seo.title')} description={t('ui.seo.intro')} icon={icn('seo')}>
        <Txt label={t('ui.seo.pageTitle')} value={cfg.seo.title} max={LIMITS.title} onChange={(v) => set('seo', { ...cfg.seo, title: v })} error={e('seo.title')} />
        <Txt label={t('ui.seo.description')} value={cfg.seo.description} max={LIMITS.description} multiline onChange={(v) => set('seo', { ...cfg.seo, description: v })} error={e('seo.description')} />
        <OwnerImageField label={t('ui.seo.image')} hint={t('ui.seo.imageHint')} value={cfg.seo.og_image} onChange={(v) => set('seo', { ...cfg.seo, og_image: v })} />
        {e('seo.og_image') ? <p className="text-xs text-red-400">{errText}</p> : null}
        <SwitchRow label={t('ui.seo.noindex')} hint={t('ui.seo.noindexHint')} checked={cfg.seo.noindex} onChange={(v) => set('seo', { ...cfg.seo, noindex: v })} />
      </Section>

      <Section title={t('ui.discord.title')} description={t('ui.discord.intro')} icon={icn('discord')}>
        <Txt label={t('ui.discord.embedTitle')} value={cfg.discord.title} max={100} onChange={(v) => set('discord', { ...cfg.discord, title: v })} error={e('discord.title')} />
        <Txt label={t('ui.discord.embedText')} value={cfg.discord.description} max={300} multiline onChange={(v) => set('discord', { ...cfg.discord, description: v })} error={e('discord.description')} />
        <OwnerImageField label={t('ui.discord.image')} value={cfg.discord.image} onChange={(v) => set('discord', { ...cfg.discord, image: v })} />
        {e('discord.image') ? <p className="text-xs text-red-400">{errText}</p> : null}
      </Section>
    </div>
  );
}

'use client';
import { useTranslations } from 'next-intl';
import { Palette, Type, Sparkles, Wand2, Volume2, LayoutTemplate, ImageIcon, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Section, SwitchRow } from '@/components/module-kit';
import { SelectField, ColorInput, RangeField, TextField, Problems } from '../bp-kit';
import { THEME_CHOICES, THEME_PRESETS, THEME_SECTIONS, themeColors } from '@/lib/battlepass/page-theme.js';
import { playSound, SOUND_EVENTS } from '@/lib/battlepass/sounds.js';
import ThemePreview from '../ThemePreview';

export default function ThemeTab({ draft, set, errors, hideSections = false }) {
  const t = useTranslations('battlepass');
  const th = draft.page || {};
  const put = (key) => (v) => set(`page.${key}`, v);
  const sel = (key, options, label = t(`theme.fields.${key}`), hint) => (
    <SelectField label={label} hint={hint} value={th[key]} onChange={put(key)} options={options} translate={(o) => t(`theme.options.${key}.${o}`)} errors={errors} path={`page.${key}`} />
  );
  const range = (key, min, max, suffix = '', step = 1) => <RangeField label={t(`theme.fields.${key}`)} value={th[key]} onChange={put(key)} min={min} max={max} suffix={suffix} step={step} />;
  const sw = (key) => <SwitchRow label={t(`theme.fields.${key}`)} hint={t.has(`theme.hints.${key}`) ? t(`theme.hints.${key}`) : undefined} checked={Boolean(th[key])} onChange={put(key)} />;
  const colors = themeColors(th);
  const order = th.order || THEME_SECTIONS;
  const move = (i, d) => { const next = [...order]; const j = i + d; if (j < 0 || j >= next.length) return; [next[i], next[j]] = [next[j], next[i]]; put('order')(next); };
  const hidden = new Set(th.hide || []);

  return (
    <div className="space-y-6">
      <ThemePreview theme={th} />

      <Section title={t('theme.background')} description={t('theme.backgroundIntro')} icon={ImageIcon}>
        {sel('mode', THEME_CHOICES.background.mode)}
        {th.mode === 'preset' ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {Object.entries(THEME_PRESETS).map(([name, p]) => (
              <button key={name} type="button" aria-pressed={th.preset === name} onClick={() => put('preset')(name)}
                className={`rounded-xl border p-2 text-left text-xs transition ${th.preset === name ? 'border-[#e6cd8c] ring-1 ring-[#e6cd8c]/60' : 'border-border/60 hover:border-border'}`}>
                <span className="block h-8 rounded-lg" style={{ background: `linear-gradient(135deg, ${p.from}, ${p.to})`, boxShadow: `inset 0 -3px 0 ${p.accent}` }} />
                <span className="mt-1.5 block capitalize">{t(`theme.options.preset.${name}`)}</span>
              </button>
            ))}
          </div>
        ) : null}
        {th.mode === 'gradient' || th.mode === 'solid' ? (
          <div className="grid gap-4 sm:grid-cols-3">
            <ColorInput label={t('theme.fields.from')} value={th.from} onChange={put('from')} errors={errors} path="page.from" />
            {th.mode === 'gradient' ? <ColorInput label={t('theme.fields.to')} value={th.to} onChange={put('to')} errors={errors} path="page.to" /> : null}
            {th.mode === 'gradient' ? range('angle', 0, 360, '°') : null}
          </div>
        ) : null}
        {th.mode === 'image' ? <TextField label={t('theme.fields.image')} hint={t('theme.hints.image')} value={th.image || ''} onChange={(v) => put('image')(v || null)} errors={errors} path="page.image" placeholder="https://" /> : null}
        <div className="grid gap-4 sm:grid-cols-3">
          {sel('pattern', THEME_CHOICES.background.pattern)}
          {range('dim', 0, 90, '%')}
          {range('blur', 0, 24, 'px')}
        </div>
        {sw('parallax')}
        {sw('aurora')}
        <div className="grid gap-4 sm:grid-cols-3">
          {range('grain', 0, 60, '%')}
          {range('vignette', 0, 80, '%')}
          {range('scanlines', 0, 40, '%')}
        </div>
      </Section>

      <Section title={t('theme.colors')} description={t('theme.colorsIntro')} icon={Palette}>
        {th.mode !== 'preset' ? (
          <div className="grid gap-4 sm:grid-cols-2"><ColorInput label={t('theme.fields.accent')} value={th.accent} onChange={put('accent')} errors={errors} path="page.accent" /><ColorInput label={t('theme.fields.accent2')} value={th.accent2} onChange={put('accent2')} errors={errors} path="page.accent2" /></div>
        ) : <p className="text-xs text-muted-foreground">{t('theme.presetColors', { accent: colors.accent })}</p>}
        <div className="grid gap-4 sm:grid-cols-3">
          <ColorInput label={t('theme.fields.text')} value={th.text} onChange={put('text')} errors={errors} path="page.text" />
          <ColorInput label={t('theme.fields.muted')} value={th.muted} onChange={put('muted')} errors={errors} path="page.muted" />
          <ColorInput label={t('theme.fields.surface')} value={th.surface} onChange={put('surface')} errors={errors} path="page.surface" />
          <ColorInput label={t('theme.fields.border')} value={th.border} onChange={put('border')} errors={errors} path="page.border" />
          <ColorInput label={t('theme.fields.good')} value={th.good} onChange={put('good')} errors={errors} path="page.good" />
          <ColorInput label={t('theme.fields.particle_color')} value={th.particle_color} onChange={put('particle_color')} errors={errors} path="page.particle_color" />
        </div>
      </Section>

      <Section title={t('theme.typography')} description={t('theme.typographyIntro')} icon={Type}>
        <div className="grid gap-4 sm:grid-cols-2">
          {sel('heading_font', THEME_CHOICES.heading_font)}
          {sel('body_font', THEME_CHOICES.body_font)}
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {range('scale', 85, 125, '%')}
          {range('weight', 400, 800, '', 100)}
          {range('letter', -2, 8, 'px')}
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {sel('card_style', THEME_CHOICES.card_style)}
          {sel('density', THEME_CHOICES.density)}
          {range('radius', 0, 36, 'px')}
        </div>
        {range('max_width', 880, 1760, 'px', 20)}
      </Section>

      <Section title={t('theme.hero')} description={t('theme.heroIntro')} icon={LayoutTemplate}>
        <div className="grid gap-4 sm:grid-cols-2">
          {sel('layout', THEME_CHOICES.layout)}
          {sel('progress_style', THEME_CHOICES.progress_style)}
          {sel('title_fx', THEME_CHOICES.title_fx)}
          {sel('rarity_glow', THEME_CHOICES.rarity_glow)}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label={t('theme.fields.banner')} hint={t('theme.hints.banner')} value={th.banner || ''} onChange={(v) => put('banner')(v || null)} errors={errors} path="page.banner" placeholder="https://" />
          <TextField label={t('theme.fields.logo')} hint={t('theme.hints.logo')} value={th.logo || ''} onChange={(v) => put('logo')(v || null)} errors={errors} path="page.logo" placeholder="https://" />
        </div>
        <TextField label={t('theme.fields.subtitle')} value={th.subtitle} onChange={put('subtitle')} max={140} errors={errors} path="page.subtitle" />
        <TextField label={t('theme.fields.rules_note')} hint={t('theme.hints.rules_note')} value={th.rules_note} onChange={put('rules_note')} max={400} errors={errors} path="page.rules_note" multiline />
        {sw('show_timer')}{sw('show_rank')}{sw('show_percent')}{sw('show_next')}{sw('sticky_progress')}{sw('hide_locked_names')}
      </Section>

      <Section title={t('theme.effects')} description={t('theme.effectsIntro')} icon={Sparkles}>
        <div className="grid gap-4 sm:grid-cols-2">{sel('particles', THEME_CHOICES.particles)}{range('particle_intensity', 0, 100, '%')}{range('particle_speed', 10, 300, '%')}{range('glow', 0, 100, '%')}</div>
        {sw('confetti_on_open')}
      </Section>

      <Section title={t('theme.animations')} description={t('theme.animationsIntro')} icon={Wand2}>
        <div className="grid gap-4 sm:grid-cols-2">{sel('entrance', THEME_CHOICES.entrance)}{sel('hover', THEME_CHOICES.hover)}{sel('level_up_fx', THEME_CHOICES.level_up_fx)}{sel('claim_fx', THEME_CHOICES.claim_fx)}</div>
        {range('motion', 50, 200, '%')}
        <p className="text-xs text-muted-foreground">{t('theme.reducedMotion')}</p>
      </Section>

      <Section title={t('theme.sounds')} description={t('theme.soundsIntro')} icon={Volume2}>
        {sw('sound_enabled')}
        <div className="grid gap-4 sm:grid-cols-2">{sel('sound_pack', THEME_CHOICES.sound_pack)}{range('volume', 0, 100, '%')}</div>
        <div className="flex flex-wrap gap-2">
          {SOUND_EVENTS.map((ev) => (
            <Button key={ev} type="button" variant="outline" size="sm" disabled={th.sound_pack === 'none'} onClick={() => playSound(th.sound_pack, ev, th.volume)}><Play className="mr-1.5 h-3.5 w-3.5" />{t(`theme.events.${ev}`)}</Button>
          ))}
        </div>
        <TextField label={t('theme.fields.ambient')} hint={t('theme.hints.ambient')} value={th.ambient || ''} onChange={(v) => put('ambient')(v || null)} errors={errors} path="page.ambient" placeholder="https://" />
        {th.ambient ? <RangeField label={t('theme.fields.ambient_volume')} value={th.ambient_volume} onChange={put('ambient_volume')} min={0} max={60} suffix="%" /> : null}
        <p className="text-xs text-muted-foreground">{t('theme.soundsNote')}</p>
      </Section>

      {hideSections ? null : <Section title={t('theme.sections')} description={t('theme.sectionsIntro')} icon={LayoutTemplate}>
        <ul className="space-y-2">
          {order.map((id, i) => (
            <li key={id} className="flex items-center justify-between gap-2 rounded-lg border border-border/50 bg-secondary/10 px-3 py-2">
              <span className={hidden.has(id) ? 'text-muted-foreground line-through' : ''}>{t(`theme.sectionNames.${id}`)}</span>
              <span className="flex gap-1">
                <Button type="button" variant="ghost" size="sm" aria-label={t('actions.moveUp')} disabled={i === 0} onClick={() => move(i, -1)}>↑</Button>
                <Button type="button" variant="ghost" size="sm" aria-label={t('actions.moveDown')} disabled={i === order.length - 1} onClick={() => move(i, 1)}>↓</Button>
                <Button type="button" variant="outline" size="sm" onClick={() => put('hide')(hidden.has(id) ? [...hidden].filter((x) => x !== id) : [...hidden, id])}>{hidden.has(id) ? t('actions.show') : t('actions.hide')}</Button>
              </span>
            </li>
          ))}
        </ul>
        <Problems errors={errors} path="page" />
      </Section>}
    </div>
  );
}

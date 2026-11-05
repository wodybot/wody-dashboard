'use client';
// Live preview of a render theme at desktop, tablet and mobile widths. Everything inside is sample content built from translated labels.
import { useState } from 'react';
import ThemeStage, { stageLabels } from './ThemeStage';
import WodyIcon from '@/components/wody-icon';

export const SIZES = { desktop: 1180, tablet: 780, mobile: 380 };

function Sample({ t, name }) {
  return (
    <div style={{ padding: 18, display: 'grid', gap: 12 }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '10px 14px', borderRadius: 'var(--wt-radius)', background: 'var(--wt-card-bg)', border: '1px solid var(--wt-card-border)', backdropFilter: 'blur(var(--wt-blur))' }}>
        <strong style={{ fontFamily: 'var(--wt-font-heading)' }}>{name}</strong>
        <span style={{ fontSize: 12, color: 'var(--wt-muted)' }}>{t('preview.nav')}</span>
      </header>
      <section style={{ padding: 18, borderRadius: 'var(--wt-radius)', background: 'var(--wt-card-bg)', border: '1px solid var(--wt-card-border)', boxShadow: 'var(--wt-card-shadow)', backdropFilter: 'blur(var(--wt-blur))' }}>
        <h3 style={{ margin: 0, fontSize: 20, fontFamily: 'var(--wt-font-heading)' }}>{t('preview.title')}</h3>
        <p style={{ margin: '6px 0 12px', color: 'var(--wt-muted)', fontSize: 14 }}>{t('preview.body')}</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <span style={{ background: 'var(--wt-button)', color: 'var(--wt-on-button)', borderRadius: 'var(--wt-btn-radius)', boxShadow: 'var(--wt-btn-shadow)', padding: '8px 16px', fontSize: 14, fontWeight: 600 }}>{t('preview.primary')}</span>
          <span style={{ border: '1px solid var(--wt-border)', color: 'var(--wt-text)', borderRadius: 'var(--wt-btn-radius)', padding: '8px 16px', fontSize: 14 }}>{t('preview.secondary')}</span>
          <span style={{ color: 'var(--wt-accent)', padding: '8px 4px', fontSize: 14 }}>{t('preview.accent')}</span>
        </div>
      </section>
    </div>
  );
}

export default function Preview({ theme, t, name, heightPx = 440 }) {
  const [size, setSize] = useState('desktop');
  const [replay, setReplay] = useState(0);
  if (!theme) return <p className="text-sm text-muted-foreground">{t('preview.none')}</p>;
  const w = SIZES[size];
  return (
    <div className="min-w-0 space-y-2">
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t('preview.size')}>
        {Object.keys(SIZES).map((s) => (
          <button key={s} type="button" aria-pressed={size === s} onClick={() => setSize(s)} className={`min-h-9 rounded-lg border px-3 text-sm ${size === s ? 'border-primary bg-primary/15' : 'border-border'}`}>{t(`preview.${s}`)}</button>
        ))}
        {theme.intro ? <button type="button" onClick={() => setReplay((n) => n + 1)} className="ml-auto inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-sm"><WodyIcon name="play" size={14} /> {t('preview.playIntro')}</button> : null}
      </div>
      <div className="overflow-auto rounded-xl border border-border bg-black/40" style={{ maxHeight: heightPx + 20 }}>
        <div style={{ width: w, maxWidth: '100%', height: heightPx, margin: '0 auto', position: 'relative', overflow: 'hidden' }}>
          <ThemeStage key={`${size}:${replay}:${theme.id}`} theme={theme} labels={stageLabels(t)} mode="embedded" autoIntro={replay > 0} className="h-full">
            <Sample t={t} name={name} />
          </ThemeStage>
        </div>
      </div>
    </div>
  );
}

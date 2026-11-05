'use client';
import WodyIcon from '@/components/wody-icon';
// A small live preview in the editor. It uses the same style variables, backdrop and card classes as the real page.
import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { themeModel, themeClasses } from '@/lib/battlepass/theme-style.js';
import { PASS_CSS } from './pass-css';
import Backdrop from './Backdrop';

export default function ThemePreview({ theme }) {
  const t = useTranslations('battlepass');
  const model = useMemo(() => themeModel(theme), [theme]);
  const th = model.theme;
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/60" style={{ height: 300, contain: 'paint' }}>
      <style>{PASS_CSS}</style>
      <div className={`bp-root ${themeClasses(th)}`} style={{ ...model.vars, minHeight: 300, height: 300, '--bp-bg': 'none' }}>
        <Backdrop model={model} fixed={false} />
        <div className="bp-wrap" style={{ padding: 16, gap: 10 }}>
          <div className={`bp-card bp-card-${th.card_style} bp-hero`} style={{ padding: 14 }}>
            <h1 className={`bp-h1 bp-title-${th.title_fx}`} style={{ fontSize: '1.5rem' }}>{t('theme.previewTitle')}</h1>
            <p className="bp-sub" style={{ fontSize: '.8rem' }}>{th.subtitle || t('theme.previewSubtitle')}</p>
            <div className="bp-bar"><i style={{ width: '62%' }} /></div>
          </div>
          <div className="bp-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            {['claimed', 'available', 'locked'].map((s, i) => (
              <div key={s} className={`bp-reward bp-state-${s}`} style={{ '--rc': ['#4ade80', '#b9a4ff', '#a1a1aa'][i], padding: 8 }}>
                <div className="bp-art"><WodyIcon name="star" size={26} /></div>
                <span className="bp-tag">{t(`state.${s}`)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

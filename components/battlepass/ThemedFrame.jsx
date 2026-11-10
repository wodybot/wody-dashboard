'use client';
// Wraps a Battle Pass page that is not the full pass (for example "Coming soon") in the season's own theme: colours, fonts,
// background, pattern and particles. Same model and styles as PassPage, so a published theme shows everywhere the season shows.
import { useMemo } from 'react';
import { themeModel, themeClasses } from '@/lib/battlepass/theme-style.js';
import { PASS_CSS } from './pass-css';
import Backdrop from './Backdrop';

export default function ThemedFrame({ page, children }) {
  const model = useMemo(() => themeModel(page || {}), [page]);
  return (
    <div className={`bp-root ${themeClasses(model.theme)}`} style={{ ...model.vars, '--bp-bg': 'none' }}>
      <style>{PASS_CSS}</style>
      <Backdrop model={model} />
      <div className="relative z-[1] flex min-h-screen flex-col">{children}</div>
    </div>
  );
}

// FILE: seasonal-effects-mount.jsx
// PUNE ÎN: components/seasonal/seasonal-effects-mount.jsx
// (fișier nou în proiectul wody-dashboard-main la această cale)

'use client';
import dynamic from 'next/dynamic';
import { usePathname } from '@/i18n/navigation';
import { useSeasonConfig } from './seasonal-context';

// The real layer (SVG pieces, gradients, drop-shadow filters, keyframe
// CSS) is behind next/dynamic, so its chunk is only requested by the
// browser once useSeasonConfig() resolves to an enabled config. ssr:
// false because there's nothing to server-render here: the config this
// depends on is only ever known client-side (see seasonal-context.jsx).
const SeasonalEffectsLayer = dynamic(() => import('./seasonal-effects-layer'), { ssr: false });

// Homepage-only decoration (same product decision Autumn Mode already
// made): it must not follow the visitor into /dashboard, /premium, etc.
// usePathname() here is the locale-stripped pathname, so '/' reliably
// means "the landing page" across every locale (/, /ro, /fr, ...).
export default function SeasonalEffectsMount() {
  const config = useSeasonConfig();
  const pathname = usePathname();
  const isHome = pathname === '/';
  if (!config?.enabled || !isHome) return null;
  return <SeasonalEffectsLayer config={config} />;
}

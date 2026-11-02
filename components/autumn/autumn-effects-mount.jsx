'use client';
import dynamic from 'next/dynamic';
import { usePathname } from '@/i18n/navigation';
import { useAutumnConfig } from './autumn-context';

// The real layer (leaf SVGs, gradients, drop-shadow filters, keyframe
// CSS) is behind next/dynamic, so its chunk is only requested by the
// browser on the branch below that actually returns it, i.e. only once
// useAutumnConfig() resolves to an enabled config. ssr: false because
// there is nothing to server-render here: the config this depends on is
// only ever known client-side (see autumn-context.jsx), so a server pass
// would just render nothing anyway.
const AutumnEffectsLayer = dynamic(() => import('./autumn-effects-layer'), { ssr: false });

// The falling-leaves layer is a homepage-only decoration (product
// decision: it must not follow the visitor into /dashboard, /premium,
// etc.). `usePathname()` here is the locale-stripped pathname (see
// i18n/navigation.js), so '/' reliably means "the landing page" across
// every locale (/, /ro, /fr, ...).
export default function AutumnEffectsMount() {
  const config = useAutumnConfig();
  const pathname = usePathname();
  const isHome = pathname === '/';
  if (!config?.enabled || !isHome) return null;
  return <AutumnEffectsLayer config={config} />;
}

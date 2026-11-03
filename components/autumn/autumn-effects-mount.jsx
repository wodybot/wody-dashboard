'use client';
import dynamic from 'next/dynamic';
import { usePathname } from '@/i18n/navigation';
import { useAutumnConfig } from './autumn-context';

const AutumnEffectsLayer = dynamic(() => import('./autumn-effects-layer'), { ssr: false });

export default function AutumnEffectsMount() {
  const config = useAutumnConfig();
  const pathname = usePathname();
  const isHome = pathname === '/';
  if (!config?.enabled || !isHome) return null;
  return <AutumnEffectsLayer config={config} />;
}

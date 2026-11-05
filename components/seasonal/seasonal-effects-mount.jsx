
'use client';
import dynamic from 'next/dynamic';
import { usePathname } from '@/i18n/navigation';
import { useSeasonConfig } from './seasonal-context';

const SeasonalEffectsLayer = dynamic(() => import('./seasonal-effects-layer'), { ssr: false });

export default function SeasonalEffectsMount() {
  const config = useSeasonConfig();
  const pathname = usePathname();
  const isHome = pathname === '/';
  if (!config?.enabled || !isHome) return null;
  return <SeasonalEffectsLayer config={config} />;
}

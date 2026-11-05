import { useLocale, useTranslations } from 'next-intl';
import { Star, Landmark, TrendingUp, Handshake, Award } from 'lucide-react';
import { SealCheck } from '@/components/community/SealCheck';
import { catalogName } from '@/lib/community/names';

const ICONS = { 'shield-check': SealCheck, star: Star, landmark: Landmark, 'trending-up': TrendingUp, handshake: Handshake };
const HEX = /^#[0-9a-fA-F]{6}$/;

export function BadgeChips({ badges = [], compact = false }) {
  const t = useTranslations('community');
  const locale = useLocale();
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label={t('badges.title')}>
      {badges.map((b) => {
        const Icon = ICONS[b.icon] || Award;
        const color = HEX.test(b.color || '') ? b.color : '#9ca3af';
        const label = catalogName(t, 'badges', b, locale);
        return (
          <li key={b.key} className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold backdrop-blur" style={{ background: `${color}26`, color, border: `1px solid ${color}55` }} title={label}>
            <Icon className="h-3 w-3" aria-hidden="true" />{compact ? <span className="sr-only">{label}</span> : label}
          </li>
        );
      })}
    </ul>
  );
}

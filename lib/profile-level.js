// The highest level a member has on any server where Wody counts XP, turned into the texts the level card shows.
// `t` is a translator for the profileCard namespace (server or client).
const compact = (n, locale) => new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 }).format(n);

export function buildLevelCard(level, t, locale = 'en') {
  if (!level) return null;
  const needed = Math.max(1, level.needed || 1);
  return {
    level: level.level, xp: level.xp, needed,
    levelText: t('levelText', { level: level.level }),
    rankText: level.rank ? t('rankText', { rank: level.rank }) : '',
    toNext: t('toNext', { percent: Math.min(99, Math.floor((level.xp / needed) * 100)), next: level.level + 1 }),
    xpText: `${compact(level.xp, locale)} / ${compact(needed, locale)} XP`,
  };
}

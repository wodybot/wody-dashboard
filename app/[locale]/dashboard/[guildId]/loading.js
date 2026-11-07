import { getTranslations } from 'next-intl/server';
import GuildSkeleton from '@/components/dashboard/guild-skeleton';

// Shown at once when a server is opened from the list, so the click is answered immediately while the page loads.
export default async function Loading() {
  const t = await getTranslations('guildSettings.common');
  return <GuildSkeleton label={t('loadingServer')} />;
}

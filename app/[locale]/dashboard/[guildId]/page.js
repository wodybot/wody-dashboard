import { getTranslations } from 'next-intl/server';
import ThemeStage from '@/components/themes/ThemeStage';
import { stageLabels } from '@/lib/themes/stage-labels';
import { getDb } from '@/lib/mongo';
import { resolveGuildTheme } from '@/lib/themes/store';
import GuildDashboardClient from './GuildDashboardClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function GuildDashboardPage({ params }) {
  const { locale, guildId } = await params;
  // A server that chose "use this theme in the dashboard" sees its published theme here too. Any failure leaves the standard dashboard.
  let theme = null;
  try {
    if (/^\d{15,25}$/.test(String(guildId))) {
      const found = await resolveGuildTheme(await getDb(), String(guildId), { locale });
      theme = found && found.dashboard ? found : null;
    }
  } catch { theme = null; }
  if (!theme) return <GuildDashboardClient />;
  const tt = await getTranslations({ locale, namespace: 'themes' });
  return <ThemeStage theme={theme} labels={stageLabels(tt)} mode="dashboard"><GuildDashboardClient /></ThemeStage>;
}

// Server component: dresses a page with the published theme of one server (Premium servers only). Any failure leaves the page as it is.
import { getTranslations } from 'next-intl/server';
import ThemeStage from '@/components/themes/ThemeStage';
import { stageLabels } from '@/lib/themes/stage-labels';
import { getDb } from '@/lib/mongo';
import { resolveGuildTheme } from '@/lib/themes/store';

export default async function GuildThemed({ guildId, locale, mode = 'page', children }) {
  let theme = null;
  try {
    if (/^\d{15,25}$/.test(String(guildId))) theme = await resolveGuildTheme(await getDb(), String(guildId), { locale });
  } catch { theme = null; }
  if (!theme) return children;
  const tt = await getTranslations({ locale, namespace: 'themes' });
  return <ThemeStage theme={theme} labels={stageLabels(tt)} mode={mode}>{children}</ThemeStage>;
}

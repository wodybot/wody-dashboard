import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import PassShell from '@/components/battlepass/PassShell';
import { loadPublicPass } from '@/lib/battlepass/public';
import { passMetadata, passJsonLd } from '@/lib/battlepass/seo';
import { getBotGuild } from '@/lib/discord';
import ThemeStage, { stageLabels } from '@/components/themes/ThemeStage';
import { getDb } from '@/lib/mongo';
import { resolveGuildTheme } from '@/lib/themes/store';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
const ID = /^\d{15,25}$/;

async function guildName(id) {
  try { return (await getBotGuild(id))?.name || ''; } catch { return ''; }
}

export async function generateMetadata({ params }) {
  const { locale, server } = await params;
  setRequestLocale(locale);
  if (!ID.test(server)) return { robots: { index: false, follow: false } };
  return passMetadata({ locale, path: `/servers/${server}/battlepass`, t: await getTranslations({ locale, namespace: 'battlepass' }), scope: 'guild', name: await guildName(server) });
}

export default async function ServerBattlePassPage({ params }) {
  const { locale, server } = await params;
  if (!ID.test(server)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'battlepass' });
  const [data, name] = await Promise.all([loadPublicPass(server), guildName(server)]);
  const prefix = locale === 'en' ? '' : `/${locale}`;
  const path = `/servers/${server}/battlepass`;
  const loginHref = `/api/auth/login?next=${encodeURIComponent(`${prefix}${path}`)}`;
  const emptyKey = data.reason === 'not_premium' ? 'emptyNotPremium' : 'emptyServer';
  const ld = passJsonLd({ locale, path, t, season: data.season, guildName: name });
  // the server's published theme (if it chose one) dresses this page too
  let theme = null;
  try { theme = await resolveGuildTheme(await getDb(), String(server), { locale }); } catch { theme = null; }
  const page = (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, '\\u003c') }} />
      <PassShell data={data} t={t} backHref="/servers" guildName={name} loginHref={loginHref} emptyKey={emptyKey} />
    </>
  );
  if (!theme) return page;
  const tt = await getTranslations({ locale, namespace: 'themes' });
  return <ThemeStage theme={theme} labels={stageLabels(tt)} mode="page">{page}</ThemeStage>;
}

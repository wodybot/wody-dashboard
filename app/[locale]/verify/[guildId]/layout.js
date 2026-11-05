import GuildThemed from '@/components/themes/GuildThemed';

export const metadata = { robots: { index: false, follow: false } };

export default async function VerifyLayout({ children, params }) {
  const { locale, guildId } = await params;
  return <GuildThemed guildId={guildId} locale={locale}>{children}</GuildThemed>;
}

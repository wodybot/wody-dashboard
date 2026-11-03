import { redirect } from 'next/navigation';
import { getLocale, getMessages } from 'next-intl/server';
import MoreMessages from '@/components/more-messages';
import ProfileClient from '@/components/profile/ProfileClient';
import { getSession } from '@/lib/session';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const metadata = { title: 'Profile', robots: { index: false, follow: false } };

export default async function ProfilePage({ searchParams }) {
  const session = await getSession();
  if (!session?.user?.id) {
    const locale = await getLocale();
    const sp = (await searchParams) || {};
    const q = typeof sp.tab === 'string' && /^[a-z_]{1,20}$/.test(sp.tab) ? `?tab=${sp.tab}` : '';
    redirect(`/api/auth/login?next=${encodeURIComponent(`${locale === 'en' ? '' : `/${locale}`}/profile${q}`)}`);
  }
  const all = await getMessages();
  const extra = { profileCard: all.profileCard, cardFonts: all.cardFonts, profilePage: all.profilePage };
  return <MoreMessages extra={extra}><ProfileClient /></MoreMessages>;
}

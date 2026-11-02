import { redirect } from 'next/navigation';
import { getLocale } from 'next-intl/server';
import ProfileClient from '@/components/profile/ProfileClient';
import { getSession } from '@/lib/session';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const metadata = { title: 'Profile', robots: { index: false, follow: false } };

// A profile is only for signed in people: everyone else goes to the login and comes back here.
// Everything shown is checked again by the API on every call; the page only draws the screens.
export default async function ProfilePage({ searchParams }) {
  const session = await getSession();
  if (!session?.user?.id) {
    const locale = await getLocale();
    const sp = (await searchParams) || {};
    const q = typeof sp.tab === 'string' && /^[a-z_]{1,20}$/.test(sp.tab) ? `?tab=${sp.tab}` : '';
    redirect(`/api/auth/login?next=${encodeURIComponent(`${locale === 'en' ? '' : `/${locale}`}/profile${q}`)}`);
  }
  return <ProfileClient />;
}

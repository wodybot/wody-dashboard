import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { INVITE_URL } from '@/lib/content';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function generateMetadata() {
  try {
    const t = await getTranslations('invite');
    return {
      title: t('metaTitle'),
      robots: { index: false, follow: true },
    };
  } catch (error) {
    console.error('invite generateMetadata failed, serving minimal fallback metadata', error);
    return { title: 'Invite Wody', robots: { index: false, follow: true } };
  }
}

export default function InvitePage() {
  redirect(INVITE_URL);
}

import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { INVITE_URL } from '@/lib/content';

// getTranslations() (next-intl) opts a Server Component into dynamic
// rendering internally; without this export Next.js still tried to
// STATICALLY prerender this page at build time, the two conflicted, and
// the failed prerender is what actually produced the generic "Server
// Components render" error visitors saw, on every request, not just
// intermittently. Same fix already applied to /team, /blog, /updates,
// /commands and others.
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

import { redirect } from '@/i18n/navigation';
import { setRequestLocale } from 'next-intl/server';
import { CATEGORY_RE } from '@/lib/collab/constants';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const metadata = { title: 'Create a Collab', robots: { index: false, follow: false } };

export default async function CreateCollab({ params, searchParams }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const q = new URLSearchParams({ tab: 'requests', new: '1' });
  if (/^\d{15,25}$/.test(String(sp?.guild || ''))) q.set('guild', String(sp.guild));
  if (CATEGORY_RE.test(String(sp?.category || ''))) q.set('category', String(sp.category));
  redirect({ href: `/profile?${q}`, locale });
}

import { redirect, notFound } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { ArrowLeft } from 'lucide-react';
import ProfilePageView from '@/components/profile/ProfilePageView';
import ReportButton from '@/components/profile/ReportButton';
import { Link } from '@/i18n/navigation';
import PageBackdrop from '@/components/profile/PageBackdrop';
import { pageAccent, publicPageView } from '@/lib/profile-page';
import { getSession } from '@/lib/session';
import { getDb } from '@/lib/mongo';
import { discordCdnUrl } from '@/lib/utils';
import { M } from '@/lib/collab/db';
import { loadPublicProfile } from '@/lib/collab/public-profile';
import { cleanUsername } from '@/lib/collab/profile';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export async function generateMetadata({ params }) {
  const { username } = await params;
  const clean = cleanUsername(decodeURIComponent(String(username || '')));
  const t = await getTranslations('profile');
  const base = { robots: { index: false, follow: false } };
  try {
    const session = await getSession();
    const pf = clean ? await loadPublicProfile(await getDb(), clean) : null;
    if (pf && (pf.shared || session?.user?.id)) return { ...base, title: `${t('metaTitle')} | ${pf.name} (@${pf.username})`, description: t('public.note') };
  } catch { }
  return { ...base, title: `${t('metaTitle')} | Wody` };
}

const fmt = (iso, locale) => { try { return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(iso)); } catch { return ''; } };

export default async function PublicProfilePage({ params }) {
  const { username } = await params;
  const locale = await getLocale();
  const clean = cleanUsername(decodeURIComponent(String(username || '')));
  const session = await getSession();
  if (!clean) notFound();
  const t = await getTranslations('profile');
  const tcard = await getTranslations('profileCard');
  const tpage = await getTranslations('profilePage');
  const trep = await getTranslations('report');
  const pf = await loadPublicProfile(await getDb(), clean);
  const viewerId = String(session?.user?.id || '');
  if (!viewerId && !pf?.shared) {
    const back = `${locale === 'en' ? '' : `/${locale}`}/profile/${clean}`;
    redirect(`/api/auth/login?next=${encodeURIComponent(back)}`);
  }
  if (!pf) notFound();
  let views = pf.views;
  if (viewerId !== pf.id) {
    views += 1;
    try { await (await getDb()).collection(M.profiles).updateOne({ username_lc: pf.username }, { $inc: { views: 1 } }); } catch { /* a missed count never blocks the page */ }
  }
  const src = pf.avatar ? `https://cdn.discordapp.com/avatars/${pf.id}/${pf.avatar}.png?size=128` : 'https://cdn.discordapp.com/embed/avatars/0.png';
  const accent = pageAccent(pf.page) || '#e6cd8c';
  const card = pf.card ? { cfg: pf.card.config, tagline: pf.member_since ? tcard('tagline', { date: fmt(pf.member_since, locale) }) : '' } : null;
  const view = publicPageView(pf.page);
  return (
    <div className="min-h-screen flex flex-col">
      <PageBackdrop page={pf.page} />
      <div className="mx-auto w-full max-w-[96rem] px-4 pt-5 sm:px-8 lg:px-12"><Link href="/" className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/40 px-3.5 py-1.5 text-xs font-semibold text-foreground/90 backdrop-blur transition hover:border-[#e6cd8c]/60 hover:text-[#e6cd8c] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#e6cd8c]"><ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />{t('backToWody')}</Link></div>
      <main id="main-content" className="mx-auto flex w-full max-w-[96rem] flex-1 flex-col gap-6 px-4 py-6 sm:px-8 lg:px-12">
        <ProfilePageView page={view} name={pf.name} username={pf.username} avatarSrc={discordCdnUrl(src)} memberSince={pf.member_since} away={pf.away} socials={pf.socials} live={pf.live} views={views} isPublic={Boolean(pf.shared)} locale={locale} card={card} passport={pf.passport} />
        {viewerId && viewerId !== pf.id ? <div className="flex justify-center"><ReportButton username={pf.username} complaintHref={`${locale === 'en' ? '' : `/${locale}`}/policies/complaint?user=${encodeURIComponent(pf.username)}`} labels={Object.fromEntries(['button', 'title', 'kind', 'image', 'profile', 'prohibited', 'abuse', 'reason', 'send', 'sent', 'dupe', 'error', 'rights', 'cancel'].map((k) => [k, trep(k)]))} /></div> : null}
      </main>
    </div>
  );
}

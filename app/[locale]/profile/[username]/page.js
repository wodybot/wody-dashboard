import { redirect, notFound } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { TreePalm, Lock, IdCard, Eye } from 'lucide-react';
import MusicButton from '@/components/profile/MusicButton';
import ReportButton from '@/components/profile/ReportButton';
import { Footer, TopNav } from '@/components/nav';
import PageBackdrop from '@/components/profile/PageBackdrop';
import { pageAccent } from '@/lib/profile-page';
import SocialLinks from '@/components/profile/SocialLinks';
import ProfileCardPreview from '@/components/profile/ProfileCardPreview';
import { getSession } from '@/lib/session';
import { getDb } from '@/lib/mongo';
import { discordCdnUrl } from '@/lib/utils';
import { M } from '@/lib/collab/db';
import { loadPublicProfile } from '@/lib/collab/public-profile';
import { cleanUsername } from '@/lib/collab/profile';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const metadata = { title: 'Profile', robots: { index: false, follow: false } };

const fmt = (iso, locale) => { try { return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(iso)); } catch { return ''; } };

export default async function PublicProfilePage({ params }) {
  const { username } = await params;
  const locale = await getLocale();
  const clean = cleanUsername(decodeURIComponent(String(username || '')));
  const session = await getSession();
  if (!session?.user?.id) {
    const back = `${locale === 'en' ? '' : `/${locale}`}/profile/${clean || 'x'}`;
    redirect(`/api/auth/login?next=${encodeURIComponent(back)}`);
  }
  if (!clean) notFound();
  const t = await getTranslations('profile');
  const tcard = await getTranslations('profileCard');
  const tpage = await getTranslations('profilePage');
  const trep = await getTranslations('report');
  const pf = await loadPublicProfile(await getDb(), clean);
  if (!pf) notFound();
  let views = pf.views;
  if (String(session.user.id) !== pf.id) {
    views += 1;
    (await getDb()).collection(M.profiles).updateOne({ username_lc: pf.username }, { $inc: { views: 1 } }).catch(() => {});
  }
  const src = pf.avatar ? `https://cdn.discordapp.com/avatars/${pf.id}/${pf.avatar}.png?size=128` : 'https://cdn.discordapp.com/embed/avatars/0.png';
  const has = Object.keys(pf.socials).length > 0;
  const accent = pageAccent(pf.page) || '#e6cd8c';
  const levelCard = pf.card ? (
    <section aria-label={tpage('levelCardTitle')} className="relative overflow-hidden rounded-3xl border bg-card/60 p-4 sm:p-6" style={{ borderColor: `${accent}66`, boxShadow: `0 0 90px -30px ${accent}` }}>
      <div className="mb-4 flex items-center gap-2.5">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: `${accent}26`, color: accent }}><IdCard className="h-5 w-5" aria-hidden="true" /></span>
        <div className="min-w-0"><h2 className="text-lg font-black leading-tight">{tpage('levelCardTitle')}</h2><p className="text-xs text-muted-foreground">{tpage('levelCardHint')}</p></div>
      </div>
      <div style={{ borderRadius: 26, boxShadow: `0 0 80px -20px ${pf.card.config.accent}` }}>
        <ProfileCardPreview cfg={pf.card.config} name={pf.name} avatarSrc={discordCdnUrl(src)} tagline={pf.member_since ? tcard('tagline', { date: fmt(pf.member_since, locale) }) : ''} />
      </div>
    </section>
  ) : null;
  return (
    <div className="min-h-screen flex flex-col">
      <PageBackdrop page={pf.page} />
      <TopNav />
      <main id="main-content" className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
        {pf.page.card_place === 'top' && levelCard}
        <section aria-label={t('public.aria')} className="overflow-hidden rounded-3xl border bg-gradient-to-br from-[#e6cd8c]/[0.09] via-card/60 to-card/40 p-5 sm:p-7" style={{ borderColor: `${accent}40` }}>
          <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={discordCdnUrl(src)} alt="" className="h-24 w-24 shrink-0 rounded-full border-2 border-[#e6cd8c]/60 object-cover" />
            <div className="min-w-0 flex-1">
              <h1 className={`break-words text-3xl font-black ${pf.page.name_fx !== 'none' ? `name-fx name-fx-${pf.page.name_fx}` : ''}`} style={pf.page.name_fx === 'typewriter' ? { '--n': Math.max(1, [...pf.name].length), '--accent': accent } : { '--accent': accent }}>{pf.name}</h1>
              <p className="text-sm text-muted-foreground">@{pf.username}{pf.member_since ? ` · ${t('hero.memberSince', { date: fmt(pf.member_since, locale) })}` : ''}</p>
              {pf.away && (
                <p className="mt-3 inline-flex max-w-full items-start gap-2 rounded-2xl border border-sky-400/40 bg-sky-400/10 px-3 py-2 text-left text-sm text-sky-200">
                  <TreePalm className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <span className="min-w-0 break-words"><b>{t('away.badge')}</b>{pf.away.until ? ` · ${t('away.until', { date: fmt(pf.away.until, locale) })}` : ''}{pf.away.note ? <span className="block text-xs text-sky-100/90">{pf.away.note}</span> : null}</span>
                </p>
              )}
              {pf.page.music ? <div className="mt-3 flex justify-center sm:justify-start"><MusicButton src={pf.page.music} title={pf.page.music_title} labels={{ play: tpage('musicPlay'), pause: tpage('musicPause'), note: tpage('musicNote') }} /></div> : null}
              <div className="mt-4 flex justify-center sm:justify-start">
                {has ? <SocialLinks socials={pf.socials} label={t('hero.socialsAria')} /> : <p className="text-sm text-muted-foreground">{t('public.noSocials')}</p>}
              </div>
            </div>
          </div>
          <dl className="mt-6 grid grid-cols-1 gap-2">
            <div className="rounded-2xl border border-border/50 bg-background/40 px-3 py-2.5 text-center sm:text-left">
              <dd className="text-2xl font-black tabular-nums text-[#e6cd8c]">{pf.live}</dd>
              <dt className="text-xs text-muted-foreground">{t('public.live')}</dt>
            </div>
            <div className="flex items-center justify-center gap-2 rounded-2xl border border-border/50 bg-background/40 px-3 py-2.5 sm:justify-start">
              <Eye className="h-4 w-4 text-[#e6cd8c]" aria-hidden="true" />
              <dd className="text-lg font-black tabular-nums">{new Intl.NumberFormat(locale).format(views)}</dd>
              <dt className="text-xs text-muted-foreground">{tpage('views')}</dt>
            </div>
          </dl>
          <p className="mt-4 flex items-start gap-1.5 text-xs text-muted-foreground"><Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />{t('public.note')}</p>
        </section>
        {pf.page.card_place !== 'top' && levelCard}
        {String(session.user.id) !== pf.id ? <div className="flex justify-center"><ReportButton username={pf.username} complaintHref={`${locale === 'en' ? '' : `/${locale}`}/policies/complaint?user=${encodeURIComponent(pf.username)}`} labels={Object.fromEntries(['button', 'title', 'kind', 'image', 'profile', 'prohibited', 'abuse', 'reason', 'send', 'sent', 'dupe', 'error', 'rights', 'cancel'].map((k) => [k, trep(k)]))} /></div> : null}
      </main>
      <Footer />
    </div>
  );
}

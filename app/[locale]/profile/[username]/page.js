// Public profile by Discord username. Visible only to signed in people; everyone else is sent to the login.
import { redirect, notFound } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { TreePalm, Lock } from 'lucide-react';
import { Footer, TopNav } from '@/components/nav';
import SocialLinks from '@/components/profile/SocialLinks';
import { getSession } from '@/lib/session';
import { getDb } from '@/lib/mongo';
import { discordCdnUrl } from '@/lib/utils';
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
  const pf = await loadPublicProfile(await getDb(), clean);
  if (!pf) notFound();
  const src = pf.avatar ? `https://cdn.discordapp.com/avatars/${pf.id}/${pf.avatar}.png?size=128` : 'https://cdn.discordapp.com/embed/avatars/0.png';
  const has = Object.keys(pf.socials).length > 0;
  return (
    <div className="min-h-screen flex flex-col">
      <TopNav />
      <main id="main-content" className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6">
        <section aria-label={t('public.aria')} className="overflow-hidden rounded-3xl border border-[#e6cd8c]/25 bg-gradient-to-br from-[#e6cd8c]/[0.09] via-card/60 to-card/40 p-5 sm:p-7">
          <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={discordCdnUrl(src)} alt="" className="h-24 w-24 shrink-0 rounded-full border-2 border-[#e6cd8c]/60 object-cover" />
            <div className="min-w-0 flex-1">
              <h1 className="break-words text-3xl font-black">{pf.name}</h1>
              <p className="text-sm text-muted-foreground">@{pf.username}{pf.member_since ? ` · ${t('hero.memberSince', { date: fmt(pf.member_since, locale) })}` : ''}</p>
              {pf.away && (
                <p className="mt-3 inline-flex max-w-full items-start gap-2 rounded-2xl border border-sky-400/40 bg-sky-400/10 px-3 py-2 text-left text-sm text-sky-200">
                  <TreePalm className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <span className="min-w-0 break-words"><b>{t('away.badge')}</b>{pf.away.until ? ` · ${t('away.until', { date: fmt(pf.away.until, locale) })}` : ''}{pf.away.note ? <span className="block text-xs text-sky-100/90">{pf.away.note}</span> : null}</span>
                </p>
              )}
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
          </dl>
          <p className="mt-4 flex items-start gap-1.5 text-xs text-muted-foreground"><Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />{t('public.note')}</p>
        </section>
      </main>
      <Footer />
    </div>
  );
}

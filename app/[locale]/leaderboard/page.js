import { getLocale, getTranslations } from 'next-intl/server';
import { Trophy, Crown, Users, Server, Bot } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Footer, TopNav } from '@/components/nav';
import { localizedAlternates } from '@/lib/community/seo';
import { getGlobalBoard, boardAvatar } from '@/lib/global-board';
import { discordCdnUrl } from '@/lib/utils';
import { INVITE_URL } from '@/lib/content';
import { OG_IMAGES, TWITTER_CARD } from '@/lib/seo-social';

const SITE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://wody.online';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function generateMetadata() {
  const t = await getTranslations('globalBoard');
  const locale = await getLocale();
  return {
    title: { absolute: `${t('metaTitle')} · Wody` },
    description: t('metaDescription'),
    alternates: localizedAlternates(locale, '/leaderboard'),
    twitter: TWITTER_CARD,
      openGraph: { images: OG_IMAGES, title: t('metaTitle'), description: t('metaDescription'), url: `${SITE_URL}/leaderboard`, type: 'website' },
  };
}

function fmt(n, locale) {
  try { return new Intl.NumberFormat(locale).format(n); } catch { return String(n); }
}

function Avatar({ row, size }) {
  const src = discordCdnUrl(boardAvatar(row));
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" width={size} height={size} loading="lazy" decoding="async" className="rounded-full bg-secondary object-cover shrink-0" style={{ width: size, height: size }} />
  );
}

const MOBILE_ORDER = { 1: 'order-1', 2: 'order-2', 3: 'order-3' };
const PODIUM = {
  1: { ring: 'border-[#e6c36a]/60 bg-[#e6c36a]/[0.07]', tone: 'text-[#e6c36a]', label: '1' },
  2: { ring: 'border-[#c0c6d0]/40 bg-[#c0c6d0]/[0.05]', tone: 'text-[#c0c6d0]', label: '2' },
  3: { ring: 'border-[#cd8b5a]/45 bg-[#cd8b5a]/[0.06]', tone: 'text-[#cd8b5a]', label: '3' },
};

export default async function GlobalLeaderboardPage() {
  const [t, locale, board] = await Promise.all([getTranslations('globalBoard'), getLocale(), getGlobalBoard()]);
  const top = board.rows.slice(0, 3);
  const rest = board.rows.slice(3);
  const podiumOrder = [top[1], top[0], top[2]].filter(Boolean);
  let updated = '';
  if (board.updatedAt) {
    try { updated = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }).format(new Date(board.updatedAt)) + ' UTC'; } catch { updated = board.updatedAt; }
  }

  return (
    <div className="relative min-h-screen overflow-x-hidden">
      <div className="absolute inset-0 pointer-events-none -z-10">
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full bg-[#7c3010]/20 blur-3xl" />
        <div className="absolute top-[40%] -right-40 w-[500px] h-[500px] rounded-full bg-[#c9a24a]/10 blur-3xl" />
      </div>
      <TopNav />
      <main id="main-content" className="max-w-3xl mx-auto px-4 sm:px-6 py-12 md:py-16">
        <header className="text-center mb-10">
          <p className="text-xs font-medium tracking-[0.2em] uppercase text-muted-foreground mb-4">{t('badge')}</p>
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">{t('title')}</h1>
          <p className="mt-3 text-sm sm:text-base text-muted-foreground max-w-md mx-auto">{t('subtitle')}</p>
          {board.ok && board.rows.length > 0 && (
            <dl className="mt-7 flex flex-wrap items-stretch justify-center gap-3">
              <div className="rounded-xl border border-border/60 bg-card/50 px-4 py-2.5 min-w-[8.5rem]">
                <dt className="text-[11px] text-muted-foreground flex items-center justify-center gap-1.5"><Users className="w-3.5 h-3.5" aria-hidden="true" />{t('statMembers')}</dt>
                <dd className="text-lg font-semibold tabular-nums">{fmt(board.members, locale)}</dd>
              </div>
              <div className="rounded-xl border border-border/60 bg-card/50 px-4 py-2.5 min-w-[8.5rem]">
                <dt className="text-[11px] text-muted-foreground flex items-center justify-center gap-1.5"><Server className="w-3.5 h-3.5" aria-hidden="true" />{t('statServers')}</dt>
                <dd className="text-lg font-semibold tabular-nums">{fmt(board.servers, locale)}</dd>
              </div>
            </dl>
          )}
        </header>

        {!board.ok ? (
          <div className="rounded-2xl border border-border/60 bg-card/50 p-10 text-center" role="status">
            <p className="text-sm text-muted-foreground">{t('unavailable')}</p>
          </div>
        ) : board.rows.length === 0 ? (
          <div className="rounded-2xl border border-border/60 bg-card/50 p-10 sm:p-14 text-center">
            <Trophy className="w-8 h-8 text-muted-foreground/50 mx-auto mb-4" aria-hidden="true" />
            <h2 className="text-lg font-semibold mb-2">{t('emptyTitle')}</h2>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">{t('emptyText')}</p>
          </div>
        ) : (
          <>
            <ol className="grid gap-3 sm:grid-cols-3 sm:items-end mb-6" aria-label={t('podium')}>
              {podiumOrder.map((r) => {
                const p = PODIUM[r.rank] || PODIUM[3];
                const first = r.rank === 1;
                return (
                  <li key={r.userId} className={`${MOBILE_ORDER[r.rank] || 'order-3'} sm:order-none rounded-2xl border ${p.ring} p-4 flex sm:flex-col items-center gap-3 sm:gap-2 text-left sm:text-center ${first ? 'sm:pb-7 sm:pt-6' : ''}`}>
                    <div className="relative shrink-0">
                      <Avatar row={r} size={first ? 64 : 52} />
                      {first && <Crown className="w-5 h-5 text-[#e6c36a] absolute -top-3 left-1/2 -translate-x-1/2" aria-hidden="true" />}
                    </div>
                    <div className="min-w-0 flex-1 sm:flex-none sm:w-full">
                      <div className={`text-xs font-semibold tracking-wider ${p.tone}`}>#{r.rank}</div>
                      <div className="font-medium truncate">{r.name || t('unknownUser')}</div>
                      <div className="text-sm font-semibold tabular-nums mt-0.5">{t('coins', { n: fmt(r.total, locale) })}</div>
                      <div className="text-[11px] text-muted-foreground">{t('servers', { count: r.servers })}</div>
                    </div>
                  </li>
                );
              })}
            </ol>

            {rest.length > 0 && (
              <ol className="rounded-2xl border border-border/60 bg-card/50 overflow-hidden" aria-label={t('list')}>
                {rest.map((r) => (
                  <li key={r.userId} className="flex items-center gap-3 sm:gap-4 px-4 py-3 border-b border-border/40 last:border-b-0 hover:bg-secondary/20 transition-colors">
                    <span className="w-9 shrink-0 text-sm text-muted-foreground tabular-nums">#{r.rank}</span>
                    <Avatar row={r} size={36} />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">{r.name || t('unknownUser')}</div>
                      <div className="text-[11px] text-muted-foreground">{t('servers', { count: r.servers })}</div>
                    </div>
                    <div className="text-sm font-semibold tabular-nums shrink-0 text-right">{t('coins', { n: fmt(r.total, locale) })}</div>
                  </li>
                ))}
              </ol>
            )}

            <div className="mt-8 space-y-2 text-center">
              {updated && <p className="text-xs text-muted-foreground">{t('updated', { time: updated })}</p>}
              <p className="text-xs text-muted-foreground max-w-lg mx-auto">{t('netWorthNote')}</p>
              <p className="text-xs text-muted-foreground max-w-lg mx-auto">{t('hideNote')}</p>
            </div>
          </>
        )}

        <div className="mx-auto mt-12 max-w-xl overflow-hidden rounded-3xl border border-[#c46a2d]/30 bg-gradient-to-br from-[#c46a2d]/15 via-card/60 to-card/40 p-6 text-center sm:p-8">
          <h2 className="text-lg font-bold sm:text-xl">{t('ctaTitle')}</h2>
          <p className="mx-auto mt-1.5 max-w-md text-sm text-muted-foreground">{t('ctaText')}</p>
          <a href={INVITE_URL} target="_blank" rel="noopener noreferrer" className="mt-5 inline-block">
            <Button className="gradient-primary h-11 gap-2 px-6 text-sm font-semibold shadow-lg shadow-[#c46a2d]/20">
              <Bot className="h-4 w-4" aria-hidden="true" />{t('cta')}
            </Button>
          </a>
        </div>
      </main>
      <Footer />
    </div>
  );
}

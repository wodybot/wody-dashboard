import { localizedAlternates } from '@/lib/community/seo';
import { getLocale, getTranslations } from 'next-intl/server';
import { Trophy, Users, ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';
import { Footer, TopNav } from '@/components/nav';
import { Link } from '@/i18n/navigation';
import { getDb, toLong } from '@/lib/mongo';
import { getBotGuild, getGuildMembersProfileMap, guildIconUrl } from '@/lib/discord';
import { discordCdnUrl } from '@/lib/utils';
import { OG_IMAGES, TWITTER_CARD } from '@/lib/seo-social';
import { Icon } from '@/components/icon-text';
import ThemeStage from '@/components/themes/ThemeStage';
import { stageLabels } from '@/lib/themes/stage-labels';
import { resolveGuildTheme } from '@/lib/themes/store';

const SITE_URL = (process.env.NEXT_PUBLIC_BASE_URL || 'https://wody.online').replace(/\/+$/, '');
const PAGE_SIZE = 25;

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function validGuildId(guildId) {
  return /^\d{5,25}$/.test(String(guildId || ''));
}

function xpForLevel(level) {
  return 5 * (level ** 2) + 50 * level + 100;
}

const HAS_XP_FILTER = { $or: [{ xp: { $gt: 0 } }, { level: { $gt: 0 } }] };

export async function generateMetadata({ params }) {
  const { guildId } = await params;
  if (!validGuildId(guildId)) return { robots: { index: false, follow: false } };
  const guild = await getBotGuild(guildId).catch(() => null);
  const t = await getTranslations('leaderboardPage');
  const title = guild?.name ? t('metaTitle', { name: guild.name }) : t('metaTitleFallback');
  return {
    title: { absolute: `${title} · Wody` },
    description: guild?.name
      ? t('metaDescription', { name: guild.name })
      : t('metaDescriptionFallback'),
    alternates: localizedAlternates(await getLocale(), `/leaderboard/${guildId}`),
    robots: { index: false, follow: false },
    twitter: TWITTER_CARD,
      openGraph: { images: OG_IMAGES,
      title,
      url: `${SITE_URL}/leaderboard/${guildId}`,
      type: 'website',
    },
  };
}

async function getLeaderboard(guildId, page) {
  try {
    const db = await getDb();
    const gidLong = toLong(guildId);
    const filter = { guild_id: gidLong, ...HAS_XP_FILTER };
    const [guild, total, rows] = await Promise.all([
      getBotGuild(guildId, { withCounts: true }).catch(() => null),
      db.collection('levels').countDocuments(filter),
      db.collection('levels').find(filter).sort({ level: -1, xp: -1 })
        .skip((page - 1) * PAGE_SIZE).limit(PAGE_SIZE).toArray(),
    ]);
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const profiles = await getGuildMembersProfileMap(guildId, rows.map((r) => r.user_id));
    const members = rows.map((r, idx) => {
      const level = r.level || 0;
      const xp = r.xp || 0;
      const needed = xpForLevel(level);
      const profile = profiles.get(String(r.user_id)) || { state: 'unknown', name: null, avatar_url: null };
      return {
        rank: (page - 1) * PAGE_SIZE + idx + 1,
        user_id: String(r.user_id),
        name: profile.name || null,
        avatar_url: profile.avatar_url || null,
        left_server: profile.state === 'left',
        level,
        xp,
        needed,
        progress: needed > 0 ? Math.max(0, Math.min(1, xp / needed)) : 0,
      };
    });
    return { guild, members, total, totalPages };
  } catch (error) {
    console.error('leaderboard page failed to load data, showing empty state', error);
    return { guild: null, members: [], total: 0, totalPages: 1 };
  }
}

// Places 1, 2 and 3 use the numbered gold, silver and bronze Wody medals, the same artwork the bot shows in Discord.
const RANK_MEDAL = { 1: 'place_1', 2: 'place_2', 3: 'place_3' };

function paginationItems(current, total) {
  const items = [1];
  for (let p = current - 1; p <= current + 1; p++) {
    if (p > 1 && p < total) {
      const last = items[items.length - 1];
      if (typeof last === 'number' && p > last + 1) items.push('…');
      if (typeof last !== 'number' || p > last) items.push(p);
    }
  }
  if (total > 1) {
    const last = items[items.length - 1];
    if (typeof last === 'number' && total > last + 1) items.push('…');
    if (last !== total) items.push(total);
  }
  return items;
}

function Pagination({ guildId, page, totalPages, label }) {
  if (totalPages <= 1) return null;
  const items = paginationItems(page, totalPages);
  const href = (p) => (p <= 1 ? `/leaderboard/${guildId}` : `/leaderboard/${guildId}?page=${p}`);
  return (
    <nav aria-label={label} className="mt-8 flex items-center justify-center gap-1.5 flex-wrap">
      <Link
        href={href(Math.max(1, page - 1))}
        aria-disabled={page <= 1}
        className={`inline-flex items-center justify-center w-9 h-9 rounded-lg border text-sm transition-colors ${page <= 1 ? 'pointer-events-none opacity-40 border-border/50' : 'border-border/70 hover:bg-secondary/40'}`}
      >
        <ChevronLeft className="w-4 h-4" />
      </Link>
      {items.map((item, idx) => item === '…' ? (
        <span key={`gap-${idx}`} className="w-9 h-9 inline-flex items-center justify-center text-sm text-muted-foreground">…</span>
      ) : (
        <Link
          key={item}
          href={href(item)}
          aria-current={item === page ? 'page' : undefined}
          className={`inline-flex items-center justify-center w-9 h-9 rounded-lg border text-sm font-medium transition-colors ${item === page ? 'border-primary bg-primary/15 text-primary' : 'border-border/70 hover:bg-secondary/40'}`}
        >
          {item}
        </Link>
      ))}
      <Link
        href={href(Math.min(totalPages, page + 1))}
        aria-disabled={page >= totalPages}
        className={`inline-flex items-center justify-center w-9 h-9 rounded-lg border text-sm transition-colors ${page >= totalPages ? 'pointer-events-none opacity-40 border-border/50' : 'border-border/70 hover:bg-secondary/40'}`}
      >
        <ChevronRight className="w-4 h-4" />
      </Link>
    </nav>
  );
}

export default async function LeaderboardPage({ params, searchParams }) {
  const { guildId } = await params;
  const sp = await searchParams;
  const requestedPage = parseInt(sp?.page, 10);
  const page = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const t = await getTranslations('leaderboardPage');

  if (!validGuildId(guildId)) {
    return (
      <div className="relative min-h-screen">
        <TopNav />
        <main className="max-w-2xl mx-auto px-4 py-24 text-center">
          <h1 className="text-2xl font-semibold mb-2">{t('notFoundTitle')}</h1>
          <p className="text-muted-foreground text-sm">{t('notFoundText')}</p>
        </main>
        <Footer />
      </div>
    );
  }

  const { guild, members, total, totalPages } = await getLeaderboard(guildId, page);
  const locale = await getLocale();
  let theme = null;
  try { theme = await resolveGuildTheme(await getDb(), String(guildId), { locale }); } catch { theme = null; }

  const view = (
    <div className="relative min-h-screen overflow-x-hidden">
      <div className="absolute inset-0 pointer-events-none -z-10">
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full bg-[#7c3010]/20 blur-3xl" />
        <div className="absolute top-[45%] -right-40 w-[500px] h-[500px] rounded-full bg-[#c46a2d]/10 blur-3xl" />
      </div>

      <TopNav />

      <main id="main-content" className="max-w-3xl mx-auto px-4 sm:px-6 py-12 md:py-16">
        <header className="flex flex-col items-center text-center mb-10 w-full">
          {guild?.icon ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={discordCdnUrl(guildIconUrl(guild))}
              alt=""
              className="w-16 h-16 rounded-2xl border border-border/70 mb-4"
            />
          ) : (
            <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center mb-4">
              <Trophy className="w-7 h-7 text-[#e08a4e]" />
            </div>
          )}
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-card/70 px-3 py-1.5 text-xs text-muted-foreground mb-4">
            <Trophy className="w-3.5 h-3.5 text-primary" />
            {t('badge')}
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight max-w-full break-words [overflow-wrap:anywhere]">
            {guild?.name || t('serverFallback')} <span className="gradient-text-shimmer">{t('titleSuffix')}</span>
          </h1>
          <p className="mt-3 text-sm sm:text-base text-muted-foreground max-w-md">
            {total > 0 ? t('activeMembers', { count: total }) : t('rankedOnly')}
          </p>
          {typeof guild?.approximate_member_count === 'number' && (
            <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/55 px-4 py-2 text-xs text-muted-foreground">
              <Users className="w-3.5 h-3.5" />
              {t('members', { count: guild.approximate_member_count })}
            </div>
          )}
        </header>

        {members.length === 0 ? (
          <div className="rounded-3xl border border-border/70 bg-card/55 backdrop-blur-sm p-10 sm:p-14 text-center">
            <Trophy className="w-8 h-8 text-muted-foreground/50 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">{t('emptyTitle')}</h2>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              {t('emptyText')}
            </p>
          </div>
        ) : (
          <div className="rounded-3xl border border-border/70 bg-card/55 backdrop-blur-sm overflow-hidden">
            {members.map((m) => (
              <div
                key={m.user_id}
                className="flex items-center gap-3 sm:gap-4 px-4 sm:px-5 py-3 border-b border-border/40 last:border-b-0 hover:bg-secondary/20 transition-colors"
              >
                <div className="w-8 shrink-0 text-center text-sm font-semibold text-muted-foreground">
                  {RANK_MEDAL[m.rank] ? <Icon file={RANK_MEDAL[m.rank]} size={32} title={`#${m.rank}`} /> : `#${m.rank}`}
                </div>
                {m.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={discordCdnUrl(m.avatar_url)} alt="" className="w-9 h-9 sm:w-10 sm:h-10 rounded-full shrink-0" />
                ) : (
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-secondary shrink-0 flex items-center justify-center text-xs font-bold">
                    ?
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-sm sm:text-base font-medium flex items-center gap-1.5 min-w-0">
                    <span className="truncate min-w-0">{m.name || t('userFallback', { id: m.user_id })}</span>
                    {m.left_server && (
                      <span className="text-[10px] font-normal text-muted-foreground/70 whitespace-nowrap shrink-0">
                        <Icon file="leave" size={12} /> <em className="not-italic">{t('leftServer')}</em>
                      </span>
                    )}
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-secondary/60 overflow-hidden max-w-[220px]">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#7c3010] to-[#e08a4e]"
                      style={{ width: `${Math.round(m.progress * 100)}%` }}
                    />
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-xs sm:text-sm font-semibold text-[#e08a4e]">{t('levelShort', { level: m.level })}</div>
                  <div className="text-[11px] text-muted-foreground">{m.xp}/{m.needed} XP</div>
                </div>
              </div>
            ))}
          </div>
        )}

        <Pagination guildId={guildId} page={page} totalPages={totalPages} label={t('pagesLabel')} />

        <div className="mt-8 text-center">
          <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" /> {t('back')}
          </Link>
        </div>
      </main>

      <Footer />
    </div>
  );
  if (!theme) return view;
  const tt = await getTranslations({ locale, namespace: 'themes' });
  return <ThemeStage theme={theme} labels={stageLabels(tt)} mode="page">{view}</ThemeStage>;
}


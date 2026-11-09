
import { localizedAlternates } from '@/lib/community/seo';
import { Users, BriefcaseBusiness, ArrowRight, ShieldCheck, Server } from 'lucide-react';
import { getTranslations, getLocale } from 'next-intl/server';
import { Footer, TopNav } from '@/components/nav';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { getDb } from '@/lib/mongo';
import { STAFF_COLLECTION, SOCIAL_PLATFORMS } from '@/lib/staff';
import { getDiscordUserById, avatarUrl } from '@/lib/discord';
import { discordCdnUrl } from '@/lib/utils';
import { OG_IMAGES, TWITTER_CARD } from '@/lib/seo-social';

const SITE_URL = (process.env.NEXT_PUBLIC_BASE_URL || 'https://wody.online').replace(/\/+$/, '');

const SOCIAL_ICONS = {
  discord: (p) => (
    <svg viewBox="0 0 24 24" fill="currentColor" {...p}><path d="M20.317 4.37a19.79 19.79 0 0 0-4.885-1.515.07.07 0 0 0-.075.035c-.211.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.6 12.6 0 0 0-.617-1.25.077.077 0 0 0-.076-.035A19.74 19.74 0 0 0 3.68 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.058a.082.082 0 0 0 .031.056 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.2 14.2 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.1 13.1 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.094.252-.192.372-.291a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.073.073 0 0 1 .078.01c.12.099.246.197.373.291a.077.077 0 0 1-.006.127 12.3 12.3 0 0 1-1.873.893.076.076 0 0 0-.04.106c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.029 19.84 19.84 0 0 0 6.002-3.03.077.077 0 0 0 .032-.055c.5-5.177-.838-9.674-3.549-13.66a.06.06 0 0 0-.031-.028ZM8.02 15.33c-1.183 0-2.157-1.086-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.211 0 2.176 1.096 2.157 2.42 0 1.332-.955 2.418-2.157 2.418Zm7.975 0c-1.183 0-2.157-1.086-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.211 0 2.176 1.096 2.157 2.42 0 1.332-.946 2.418-2.157 2.418Z" /></svg>
  ),
  youtube: (p) => (
    <svg viewBox="0 0 24 24" fill="currentColor" {...p}><path d="M23.498 6.186a3.02 3.02 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.376.505A3.02 3.02 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.02 3.02 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.376-.505a3.02 3.02 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814ZM9.545 15.568V8.432L15.818 12l-6.273 3.568Z" /></svg>
  ),
  instagram: (p) => (
    <svg viewBox="0 0 24 24" fill="currentColor" {...p}><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069Zm0 2.16c-3.149 0-3.5.013-4.736.068-2.05.093-3.098 1.14-3.192 3.192-.055 1.234-.067 1.585-.067 4.736 0 3.152.013 3.503.067 4.737.094 2.05 1.14 3.098 3.192 3.192 1.234.055 1.585.068 4.736.068 3.152 0 3.503-.013 4.737-.068 2.052-.093 3.098-1.14 3.192-3.192.055-1.235.068-1.586.068-4.737s-.013-3.502-.068-4.736c-.093-2.052-1.14-3.098-3.192-3.192-1.235-.055-1.586-.068-4.737-.068Zm0 3.678a4 4 0 1 1 0 8 4 4 0 0 1 0-8Zm0 6.6a2.6 2.6 0 1 0 0-5.2 2.6 2.6 0 0 0 0 5.2Zm5.098-6.847a.937.937 0 1 1-1.874 0 .937.937 0 0 1 1.874 0Z" /></svg>
  ),
  facebook: (p) => (
    <svg viewBox="0 0 24 24" fill="currentColor" {...p}><path d="M22 12.06C22 6.505 17.523 2 12 2S2 6.505 2 12.06c0 5.02 3.657 9.184 8.437 9.94v-7.03H7.898v-2.91h2.54V9.845c0-2.507 1.492-3.89 3.777-3.89 1.094 0 2.238.196 2.238.196v2.457h-1.26c-1.243 0-1.63.775-1.63 1.57v1.882h2.773l-.443 2.91h-2.33V22c4.78-.756 8.437-4.92 8.437-9.94Z" /></svg>
  ),
  tiktok: (p) => (
    <svg viewBox="0 0 24 24" fill="currentColor" {...p}><path d="M16.6 0h-3.32v16.34a3.11 3.11 0 0 1-3.11 3.08 3.11 3.11 0 0 1 0-6.22c.31 0 .61.05.89.13V9.9a6.5 6.5 0 0 0-.89-.06A6.44 6.44 0 0 0 3.7 16.28a6.44 6.44 0 0 0 6.47 6.44 6.44 6.44 0 0 0 6.47-6.44V7.94a8.2 8.2 0 0 0 4.76 1.52V6.13a4.85 4.85 0 0 1-4.8-4.8V0Z" /></svg>
  ),
  twitter: (p) => (
    <svg viewBox="0 0 24 24" fill="currentColor" {...p}><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231ZM17.083 19.77h1.833L7.084 4.126H5.117Z" /></svg>
  ),
};

function SocialLinks({ socials }) {
  const entries = SOCIAL_PLATFORMS.filter((key) => socials?.[key]);
  if (entries.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1.5 mt-2.5 max-w-full">
      {entries.map((key) => {
        const Icon = SOCIAL_ICONS[key];
        return (
          <a
            key={key}
            href={socials[key]}
            target="_blank"
            rel="noopener noreferrer nofollow"
            aria-label={key}
            className="text-muted-foreground/70 hover:text-[#e08a4e] transition-colors"
          >
            <Icon className="w-3.5 h-3.5" />
          </a>
        );
      })}
    </div>
  );
}


export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function generateMetadata() {
  try {
    const t = await getTranslations('team');
    return {
      title: { absolute: t('metaTitle') },
      description: t('metaDescription'),
      alternates: localizedAlternates(await getLocale(), '/team'),
      robots: { index: true, follow: true },
      openGraph: { images: OG_IMAGES,
        title: t('ogTitle'),
        description: t('metaDescription'),
        url: `${SITE_URL}/team`,
        type: 'website',
      },
    };
  } catch (error) {
    console.error('team generateMetadata failed, serving minimal fallback metadata', error);
    return { title: { absolute: 'Team' }, alternates: { canonical: '/team' } };
  }
}

const STAFF_LOOKUP_TIMEOUT_MS = 5000;

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}

async function getTeam() {
  try {
    const db = await getDb();
    const docs = await db.collection(STAFF_COLLECTION)
      .find({})
      .sort({ hierarchy_position: 1, position: 1 })
      .toArray();
    const resolved = await Promise.all(docs.map(async (d) => {
      const user = await withTimeout(getDiscordUserById(d.discord_user_id).catch(() => null), STAFF_LOOKUP_TIMEOUT_MS);
      if (!user) return null;
      return {
        id: String(d._id),
        rank: d.rank,
        hierarchy: d.hierarchy,
        hierarchy_position: d.hierarchy_position ?? 0,
        name: user.global_name || user.username,
        avatar_url: avatarUrl(user),
        socials: d.socials || {},
      };
    }));

    const groups = new Map();
    for (const member of resolved) {
      if (!member) continue;
      if (!groups.has(member.hierarchy)) groups.set(member.hierarchy, { name: member.hierarchy, position: member.hierarchy_position, members: [] });
      groups.get(member.hierarchy).members.push(member);
    }
    return [...groups.values()].sort((a, b) => a.position - b.position);
  } catch {
    return [];
  }
}

async function getBotGuildCount() {
  try {
    const db = await getDb();
    const heartbeat = await db.collection('bot_status').findOne({ _id: 'heartbeat' });
    const lastBeat = heartbeat?.last_heartbeat ? new Date(heartbeat.last_heartbeat) : null;
    const online = !!lastBeat && (Date.now() - lastBeat.getTime()) < 90_000;
    return online ? (heartbeat?.guild_count ?? null) : null;
  } catch {
    return null;
  }
}

export default async function TeamPage() {
  let t;
  try {
    t = await getTranslations('team');
  } catch (error) {
    console.error('team page failed to load translations, showing degraded state', error);
    return (
      <div className="relative min-h-screen">
        <TopNav />
        <main className="max-w-2xl mx-auto px-4 py-24 text-center">
          <Users className="w-8 h-8 text-muted-foreground/50 mx-auto mb-4" />
          <h1 className="text-2xl font-semibold mb-2">Team</h1>
          <p className="text-muted-foreground text-sm">This page couldn&apos;t load right now, please try again shortly.</p>
        </main>
        <Footer />
      </div>
    );
  }
  const [groups, guildCount] = await Promise.all([getTeam(), getBotGuildCount()]);
  const memberCount = groups.reduce((sum, g) => sum + g.members.length, 0);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Wody',
    url: SITE_URL,
    member: groups.flatMap((g) => g.members.map((m) => ({
      '@type': 'Person',
      name: m.name,
      jobTitle: m.rank,
    }))),
  };

  return (
    <div className="relative min-h-screen overflow-x-hidden">
      <div className="absolute inset-0 pointer-events-none -z-10">
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full bg-[#7c3010]/20 blur-3xl" />
        <div className="absolute top-[45%] -right-40 w-[500px] h-[500px] rounded-full bg-[#c46a2d]/10 blur-3xl" />
      </div>

      <TopNav />

      <main id="main-content" className="max-w-5xl mx-auto px-4 sm:px-6 py-12 md:py-16">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

        <header className="max-w-3xl mx-auto text-center mb-10 md:mb-12">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-card/70 px-3 py-1.5 text-xs text-muted-foreground mb-5">
            <Users className="w-3.5 h-3.5 text-primary" />
            {t('badge')}
          </div>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight">
            {t('titleLine1')} <span className="gradient-text-shimmer">{t('titleHighlight')}</span>
          </h1>
          <p className="mt-5 text-base sm:text-lg text-muted-foreground leading-relaxed max-w-2xl mx-auto">
            {t('subtitle')}
          </p>
        </header>

        {(memberCount > 0 || guildCount) && (
          <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 mb-12 md:mb-16">
            {memberCount > 0 && (
              <div className="flex items-center gap-2.5 rounded-2xl border border-border/70 bg-card/55 backdrop-blur-sm px-5 py-3">
                <ShieldCheck className="w-4 h-4 text-[#e08a4e]" />
                <span className="text-lg font-bold">{memberCount}</span>
                <span className="text-xs text-muted-foreground">{t('statsTeamMembers')}</span>
              </div>
            )}
            {guildCount && (
              <div className="flex items-center gap-2.5 rounded-2xl border border-border/70 bg-card/55 backdrop-blur-sm px-5 py-3">
                <Server className="w-4 h-4 text-[#e08a4e]" />
                <span className="text-lg font-bold">{guildCount.toLocaleString()}</span>
                <span className="text-xs text-muted-foreground">{t('statsServers')}</span>
              </div>
            )}
          </div>
        )}

        {groups.length === 0 ? (
          <div className="rounded-3xl border border-border/70 bg-card/55 backdrop-blur-sm p-10 sm:p-14 text-center">
            <Users className="w-8 h-8 text-muted-foreground/50 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">{t('emptyTitle')}</h2>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">{t('emptyText')}</p>
          </div>
        ) : (
          <>
            <p className="max-w-xl mx-auto text-center text-sm text-muted-foreground mb-12 md:mb-16">
              {t('orgSubtitle')}
            </p>

            <div className="relative">
              <div
                aria-hidden
                className="hidden md:block absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-px bg-gradient-to-b from-transparent via-[#c46a2d]/50 to-transparent"
              />

              <div className="space-y-14 md:space-y-20">
                {groups.map((group, groupIndex) => (
                  <section key={group.name} className="relative">
                    <div className="flex flex-col items-center mb-7">
                      <div className="hidden md:flex w-3 h-3 rounded-full bg-[#e08a4e] ring-4 ring-[#e08a4e]/20 mb-4" />
                      <h2 className="inline-flex items-center gap-2 rounded-full border border-[#c46a2d]/40 bg-card/70 backdrop-blur-sm px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.15em] text-[#e08a4e]">
                        {group.name}
                      </h2>
                    </div>

                    <div className="flex flex-wrap justify-center gap-4 sm:gap-5 max-w-4xl mx-auto">
                      {group.members.map((m) => (
                        <div
                          key={m.id}
                          className="group relative w-[calc(50%-0.5rem)] sm:w-40 md:w-44 rounded-2xl border border-border/70 bg-card/55 backdrop-blur-sm p-5 flex flex-col items-center text-center transition-all duration-300 hover:-translate-y-1.5 hover:border-[#e08a4e]/60 hover:bg-card/80 hover:shadow-[0_12px_30px_-12px_rgba(196,106,45,0.45)]"
                        >
                          <div className="absolute inset-x-0 top-0 h-0.5 rounded-t-2xl bg-gradient-to-r from-transparent via-[#e08a4e]/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                          <div className="relative mb-3">
                            <div className="absolute inset-0 rounded-full bg-[#e08a4e]/25 blur-md opacity-0 group-hover:opacity-100 transition-opacity" />
                            {m.avatar_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={discordCdnUrl(m.avatar_url)}
                                alt=""
                                className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-full border-2 border-[#c46a2d]/40 group-hover:border-[#e08a4e]/70 transition-colors"
                              />
                            ) : (
                              <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-secondary flex items-center justify-center text-lg font-bold">
                                {m.name?.[0]?.toUpperCase() || '?'}
                              </div>
                            )}
                          </div>
                          <div className="font-semibold text-sm sm:text-base truncate max-w-full">{m.name}</div>
                          <div className="inline-flex mt-1.5 rounded-full bg-[#7c3010]/20 border border-[#c46a2d]/30 px-2.5 py-0.5 text-[11px] font-medium text-[#e08a4e]">
                            {m.rank}
                          </div>
                          <SocialLinks socials={m.socials} />
                        </div>
                      ))}
                    </div>

                    {groupIndex < groups.length - 1 && (
                      <div
                        aria-hidden
                        className="hidden md:block absolute left-1/2 -translate-x-1/2 -bottom-10 md:-bottom-14 w-px h-10 md:h-14 bg-gradient-to-b from-[#c46a2d]/50 to-transparent"
                      />
                    )}
                  </section>
                ))}
              </div>
            </div>
          </>
        )}

        <section className="max-w-2xl mx-auto mt-16 md:mt-20 rounded-3xl border border-border/70 bg-gradient-to-br from-[#7c3010]/15 via-card/45 to-transparent p-8 sm:p-10 text-center">
          <div className="w-11 h-11 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-5">
            <BriefcaseBusiness className="w-5 h-5 text-primary" />
          </div>
          <h2 className="text-xl sm:text-2xl font-semibold">{t('joinTitle')}</h2>
          <p className="mt-3 text-sm sm:text-base text-muted-foreground leading-relaxed">
            {t('joinText')}
          </p>
          <Link href="/careers" className="inline-block mt-6">
            <Button className="gradient-primary gap-2">
              {t('joinButton')} <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </section>
      </main>

      <Footer />
    </div>
  );
}

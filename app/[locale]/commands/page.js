import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { Bot, Check, ChevronRight, Command, Crown } from 'lucide-react';
import { INVITE_URL } from '@/lib/content';
import { Button } from '@/components/ui/button';
import { Footer, TopNav, NavTag } from '@/components/nav';
import { ROBOTS_INDEX, localePath, localizedAlternates, ogLocale } from '@/lib/community/seo';
import { OG_IMAGES, TWITTER_CARD } from '@/lib/seo-social';

const SITE_URL = (process.env.NEXT_PUBLIC_BASE_URL || 'https://wody.online').replace(/\/+$/, '');

const NEW_GROUPS = new Set(['passport', 'collab']);
const NEW_COMMANDS = new Set(['/globalleaderboard', '/claimpassport', '/mypassport', '/passport', '/collab browse', '/collab mine', '/collab create', '/collab categories', '/collab channel', '/battlepass info']);

export const revalidate = 3600;

export async function generateMetadata({ params }) {
  try {
    const { locale } = await params;
    setRequestLocale(locale);
    const t = await getTranslations({ locale, namespace: 'commands' });
    const path = localePath(locale, '/commands');
    return {
      title: { absolute: t('metaTitle') },
      description: t('metaDescription'),
      alternates: localizedAlternates(locale, '/commands'),
      robots: ROBOTS_INDEX,
      twitter: TWITTER_CARD,
      openGraph: { images: OG_IMAGES,
        title: t('ogTitle'),
        description: t('ogDescription'),
        url: `${SITE_URL}${path}`,
        type: 'website',
        siteName: 'Wody',
        ...ogLocale(locale),
      },
    };
  } catch (error) {
    console.error('commands generateMetadata failed, serving minimal fallback metadata', error);
    return { title: { absolute: 'Commands' }, alternates: { canonical: '/commands' } };
  }
}

export default async function CommandsPage({ params }) {
  const { locale } = await params;
  setRequestLocale(locale);
  let t, tNav, groups, flatCommands;
  try {
    t = await getTranslations({ locale, namespace: 'commands' });
    tNav = await getTranslations({ locale, namespace: 'nav' });
    groups = t.raw('groups').filter((group) => group.key !== 'owner' && group.key !== 'premium');
    flatCommands = groups.flatMap((group) => group.commands);
  } catch (error) {
    console.error('commands page failed to load translations, showing degraded state', error);
    return (
      <div className="relative min-h-screen">
        <TopNav />
        <main className="max-w-2xl mx-auto px-4 py-24 text-center">
          <h1 className="text-2xl font-semibold mb-2">Commands</h1>
          <p className="text-muted-foreground text-sm">This page couldn&apos;t load right now, please try again shortly.</p>
        </main>
        <Footer />
      </div>
    );
  }

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Wody Discord Bot Commands',
    url: `${SITE_URL}/commands`,
    numberOfItems: flatCommands.length,
    itemListElement: flatCommands.map((cmd, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: cmd.name,
      description: cmd.description,
    })),
  };

  return (
    <div className="relative min-h-screen overflow-x-hidden">
      <div className="absolute inset-0 pointer-events-none -z-10">
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full bg-[#7c3010]/20 blur-3xl" />
        <div className="absolute top-[40%] -right-48 w-[500px] h-[500px] rounded-full bg-[#c46a2d]/10 blur-3xl" />
      </div>

      <TopNav />

      <main id="main-content" className="max-w-7xl mx-auto px-4 sm:px-6 py-12 md:py-16">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

        <header className="max-w-3xl mx-auto text-center mb-10 md:mb-14">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-card/70 px-3 py-1.5 text-xs text-muted-foreground mb-5">
            <Command className="w-3.5 h-3.5 text-primary" />
            {t('badge')}
          </div>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight">
            {t('headingPrefix')} <span className="gradient-text">{t('headingHighlight')}</span>
          </h1>
          <p className="mt-5 text-base sm:text-lg text-muted-foreground leading-relaxed max-w-2xl mx-auto">
            {t('subtitle')}
          </p>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 mt-7">
            <a href={INVITE_URL} target="_blank" rel="noopener noreferrer">
              <Button className="gradient-primary w-full sm:w-auto gap-2">
                <Bot className="w-4 h-4" /> {t('inviteBtn')}
              </Button>
            </a>
            <Link href="/help">
              <Button variant="outline" className="w-full sm:w-auto gap-2">
                {t('helpBtn')} <ChevronRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </header>

        <section className="grid lg:grid-cols-[220px_1fr] gap-8 items-start">
          <aside className="lg:sticky lg:top-24 rounded-2xl border border-border/70 bg-card/40 backdrop-blur-sm p-4">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">{t('onThisPage')}</div>
            <nav className="space-y-1">
              {groups.map((group) => (
                <a
                  key={group.key}
                  href={`#${group.key}`}
                  className="flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors"
                >
                  <span>{group.title}{NEW_GROUPS.has(group.key) && <>{' '}<NavTag kind="new" label={tNav('tags.new')} /></>}</span>
                  <span className="text-xs opacity-60">{group.commands.length}</span>
                </a>
              ))}
            </nav>
          </aside>

          <div className="space-y-8 min-w-0">
            {groups.map((group) => (
              <section
                key={group.key}
                id={group.key}
                className="scroll-mt-24"
              >
                <div className="flex items-center justify-between gap-4 mb-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                      {group.premium ? <Crown className="w-4 h-4 text-primary" /> : <Command className="w-4 h-4 text-primary" />}
                    </div>
                    <div>
                      <h2 className="text-2xl font-semibold">{group.title}{NEW_GROUPS.has(group.key) && <>{' '}<NavTag kind="new" label={tNav('tags.new')} /></>}</h2>
                      <p className="text-xs text-muted-foreground mt-0.5">{group.commands.length} {t('commandsSuffix')}</p>
                    </div>
                  </div>
                  {group.premium && (
                    <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-[#c46a2d]/50 bg-[#c46a2d]/10 px-2.5 py-1 text-xs text-[#f2c091] shrink-0">
                      <Crown className="w-3 h-3" /> {t('premiumBadge')}
                    </span>
                  )}
                </div>

                <div className="grid sm:grid-cols-2 gap-3">
                  {group.commands.map((cmd) => (
                    <article key={cmd.name} className="rounded-2xl border border-border/70 bg-card/45 backdrop-blur-sm p-5 hover:border-primary/30 hover:bg-card/65 transition-colors min-w-0">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg bg-[#7c3010]/20 text-[#e08a4e] flex items-center justify-center shrink-0 mt-0.5">
                          <Check className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-semibold text-foreground break-all">{cmd.name}{NEW_COMMANDS.has(cmd.name) && <>{' '}<NavTag kind="new" label={tNav('tags.new')} /></>}</h3>
                          <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{cmd.description}</p>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}

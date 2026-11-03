import { localizedAlternates } from '@/lib/community/seo';
import { Megaphone, Bot, ChevronRight } from 'lucide-react';
import { getTranslations, getLocale } from 'next-intl/server';
import { INVITE_URL } from '@/lib/content';
import { Button } from '@/components/ui/button';
import { Footer, TopNav } from '@/components/nav';
import { getDb, serializeDoc } from '@/lib/mongo';
import { SimpleMarkdown } from '@/components/simple-markdown';
import { OG_IMAGES, TWITTER_CARD } from '@/lib/seo-social';

const SITE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://wody.online';

// This page shows owner-posted updates, so it must always reflect what's
// currently in the database (a newly posted or deleted update should show
// up immediately, not after the next redeploy or a stale cache window).
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function generateMetadata() {
  // See app/[locale]/layout.js and /team's generateMetadata for the same
  // fix and the same reasoning: unguarded, a transient translation-load
  // failure here crashed the whole page instead of just this page's
  // title, with the exact generic "Server Components render" error.
  try {
    const t = await getTranslations('updates');
    return {
      title: { absolute: t('metaTitle') },
      description: t('metaDescription'),
      alternates: localizedAlternates(await getLocale(), '/updates'),
      robots: { index: true, follow: true },
      twitter: TWITTER_CARD,
      openGraph: { images: OG_IMAGES,
        title: t('ogTitle'),
        description: t('metaDescription'),
        url: `${SITE_URL}/updates`,
        type: 'website',
      },
    };
  } catch (error) {
    console.error('updates generateMetadata failed, serving minimal fallback metadata', error);
    return { title: { absolute: 'Updates' }, alternates: { canonical: '/updates' } };
  }
}

const TAG_STYLES = {
  Feature: 'border-[#c46a2d]/50 bg-[#c46a2d]/10 text-[#f2c091]',
  Fix: 'border-sky-500/40 bg-sky-500/10 text-sky-300',
  Announcement: 'border-violet-500/40 bg-violet-500/10 text-violet-300',
  Update: 'border-border/70 bg-card/60 text-muted-foreground',
};

function tagClass(tag) {
  return TAG_STYLES[tag] || TAG_STYLES.Update;
}

// Owners write updates in the dashboard using **bold**, *italic*,
// [links](https://...), "## " headings and "- " bullet lists, see
// components/simple-markdown.jsx, the update text is rendered through
// exactly that shared renderer so this page and the Blog stay in sync on
// what formatting is available and how it looks, rather than each having
// its own slightly different implementation of the same idea.

// Reads the same 'updates' collection GET /api/updates serves publicly,
// queried directly here (same lib/mongo helpers route.js itself uses)
// instead of the page calling its own API over HTTP, avoids a self-fetch
// round trip and renders the list server-side so it's indexable and shows
// up without requiring client-side JavaScript.
async function getUpdates() {
  try {
    const db = await getDb();
    const docs = await db.collection('updates').find({}).sort({ created_at: -1 }).limit(100).toArray();
    return docs.map(serializeDoc);
  } catch {
    return [];
  }
}

export default async function UpdatesPage() {
  let t;
  try {
    t = await getTranslations('updates');
  } catch (error) {
    console.error('updates page failed to load translations, showing degraded state', error);
    return (
      <div className="relative min-h-screen">
        <TopNav />
        <main className="max-w-2xl mx-auto px-4 py-24 text-center">
          <h1 className="text-2xl font-semibold mb-2">Updates</h1>
          <p className="text-muted-foreground text-sm">This page couldn&apos;t load right now, please try again shortly.</p>
        </main>
        <Footer />
      </div>
    );
  }
  const locale = await getLocale();
  const updates = await getUpdates();

  // Tags are stored in the DB as fixed English enum values (set from the
  // owner panel's dropdown), so they're mapped to a localized label for
  // display only, the stored value itself stays untranslated.
  const tagLabel = (tag) => t.raw('tags')[tag] || tag || t('tags.Update');

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: t('ogTitle'),
    url: `${SITE_URL}/updates`,
    description: t('metaDescription'),
    hasPart: updates.map((u) => ({
      '@type': 'Article',
      headline: u.title,
      datePublished: u.created_at,
    })),
  };

  return (
    <div className="relative min-h-screen overflow-x-hidden">
      <div className="absolute inset-0 pointer-events-none -z-10">
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full bg-[#7c3010]/20 blur-3xl" />
        <div className="absolute top-[45%] -right-40 w-[500px] h-[500px] rounded-full bg-[#c46a2d]/10 blur-3xl" />
      </div>

      <TopNav />

      <main id="main-content" className="max-w-4xl mx-auto px-4 sm:px-6 py-12 md:py-16">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

        <header className="max-w-3xl mx-auto text-center mb-10 md:mb-14">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-card/70 px-3 py-1.5 text-xs text-muted-foreground mb-5">
            <Megaphone className="w-3.5 h-3.5 text-primary" />
            {t('badge')}
          </div>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight">
            {t('titleLine1')} <span className="gradient-text">{t('titleHighlight')}</span>
          </h1>
          <p className="mt-5 text-base sm:text-lg text-muted-foreground leading-relaxed max-w-2xl mx-auto">
            {t('subtitle')}
          </p>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 mt-7">
            <a href={INVITE_URL} target="_blank" rel="noopener noreferrer">
              <Button className="gradient-primary w-full sm:w-auto gap-2">
                <Bot className="w-4 h-4" /> {t('inviteButton')}
              </Button>
            </a>
            <a href="/commands">
              <Button variant="outline" className="w-full sm:w-auto gap-2">
                {t('browseCommands')} <ChevronRight className="w-4 h-4" />
              </Button>
            </a>
          </div>
        </header>

        {updates.length === 0 ? (
          <div className="rounded-3xl border border-border/70 bg-card/55 backdrop-blur-sm p-10 sm:p-14 text-center">
            <Megaphone className="w-8 h-8 text-muted-foreground/50 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">{t('emptyTitle')}</h2>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              {t('emptyText')}
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {updates.map((u) => (
              <article key={u._id} className="rounded-3xl border border-border/70 bg-card/55 backdrop-blur-sm p-6 sm:p-8">
                <div className="flex flex-wrap items-center gap-3 mb-3">
                  <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${tagClass(u.tag)}`}>
                    {tagLabel(u.tag)}
                  </span>
                  {u.created_at && (
                    <time className="text-xs text-muted-foreground" dateTime={u.created_at}>
                      {new Date(u.created_at).toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric' })}
                    </time>
                  )}
                </div>
                <h2 className="text-xl sm:text-2xl font-semibold mb-3">{u.title}</h2>
                <SimpleMarkdown text={u.body} className="text-sm sm:text-base text-muted-foreground" />
              </article>
            ))}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}

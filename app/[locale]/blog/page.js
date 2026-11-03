// FILE: page.js
// PUNE ÎN: app/[locale]/blog/page.js
// (fișier nou în proiectul wody-dashboard-main la această cale)

import { localizedAlternates } from '@/lib/community/seo';
import { BookOpen, ChevronRight, Bot } from 'lucide-react';
import { getTranslations, getLocale } from 'next-intl/server';
import { INVITE_URL } from '@/lib/content';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { Footer, TopNav } from '@/components/nav';
import { getDb, serializeDoc } from '@/lib/mongo';
import { BLOG_COLLECTION, readWithRetry } from '@/lib/blog';
import { BlogCover } from '@/components/blog-cover';
import { OG_IMAGES, TWITTER_CARD } from '@/lib/seo-social';

const SITE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://wody.online';

// Owner-posted posts must show up here immediately (a new post or an
// edit shouldn't wait for the next redeploy or a stale cache window),
// same reasoning as /updates using this exact pair of exports.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function generateMetadata() {
  // See app/[locale]/layout.js and /team's generateMetadata for the same
  // fix and the same reasoning: unguarded, a transient translation-load
  // failure here crashed the whole page instead of just this page's
  // title, with the exact generic "Server Components render" error.
  try {
    const t = await getTranslations('blog');
    return {
      title: { absolute: t('metaTitle') },
      description: t('metaDescription'),
      alternates: localizedAlternates(await getLocale(), '/blog'),
      robots: { index: true, follow: true },
      twitter: TWITTER_CARD,
      openGraph: { images: OG_IMAGES,
        title: t('ogTitle'),
        description: t('metaDescription'),
        url: `${SITE_URL}/blog`,
        type: 'website',
      },
    };
  } catch (error) {
    console.error('blog generateMetadata failed, serving minimal fallback metadata', error);
    return { title: { absolute: 'Blog' }, alternates: { canonical: '/blog' } };
  }
}

// Reads the 'blog' collection directly (same lib/mongo helpers route.js
// itself uses) rather than the page calling its own public API over
// HTTP, avoids a self-fetch round trip and renders the list server-side
// so it's indexable and shows up without requiring client-side
// JavaScript, same pattern as getUpdates() in the /updates page.
async function getPublishedPosts() {
  // Retries a few times and then lets the error reach the error screen, instead of pretending there are no posts.
  const docs = await readWithRetry(async () => {
    const db = await getDb();
    return db.collection(BLOG_COLLECTION)
      .find({ published: true })
      .sort({ published_at: -1 })
      .limit(200)
      .toArray();
  });
  return docs.map(serializeDoc);
}

export default async function BlogPage() {
  // See /team's page component for the same fix and reasoning: this was
  // the one getTranslations() call generateMetadata's own try/catch never
  // covered, since it's a separate function.
  let t;
  try {
    t = await getTranslations('blog');
  } catch (error) {
    console.error('blog page failed to load translations, showing degraded state', error);
    return (
      <div className="relative min-h-screen">
        <TopNav />
        <main className="max-w-2xl mx-auto px-4 py-24 text-center">
          <h1 className="text-2xl font-semibold mb-2">Blog</h1>
          <p className="text-muted-foreground text-sm">This page couldn&apos;t load right now, please try again shortly.</p>
        </main>
        <Footer />
      </div>
    );
  }
  const locale = await getLocale();
  const posts = await getPublishedPosts();

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Blog',
    name: t('ogTitle'),
    url: `${SITE_URL}/blog`,
    description: t('metaDescription'),
    blogPost: posts.map((p) => ({
      '@type': 'BlogPosting',
      headline: p.title,
      url: `${SITE_URL}/blog/${p.slug}`,
      datePublished: p.published_at,
      ...(p.author_name ? { author: { '@type': 'Person', name: p.author_name } } : {}),
    })),
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

        <header className="max-w-3xl mx-auto text-center mb-10 md:mb-14">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-card/70 px-3 py-1.5 text-xs text-muted-foreground mb-5">
            <BookOpen className="w-3.5 h-3.5 text-primary" />
            {t('badge')}
          </div>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight">
            {t('titleLine1')} <span className="gradient-text-shimmer">{t('titleHighlight')}</span>
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
          </div>
        </header>

        {posts.length === 0 ? (
          <div className="rounded-3xl border border-border/70 bg-card/55 backdrop-blur-sm p-10 sm:p-14 text-center">
            <BookOpen className="w-8 h-8 text-muted-foreground/50 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">{t('emptyTitle')}</h2>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">{t('emptyText')}</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-5">
            {posts.map((p) => (
              <Link key={p._id} href={`/blog/${p.slug}`} className="group block">
                <article className="h-full rounded-3xl border border-border/70 bg-card/55 backdrop-blur-sm overflow-hidden transition-colors group-hover:border-[#c46a2d]/50 flex flex-col">
                  {p.cover_image_url ? (
                    <div className="relative w-full h-44 sm:h-48">
                      <BlogCover src={p.cover_image_url} sizes="(max-width: 640px) 100vw, 50vw" />
                    </div>
                  ) : (
                    <div className="w-full h-44 sm:h-48 bg-gradient-to-br from-[#3d1e0d] to-[#1a0e08] flex items-center justify-center">
                      <BookOpen className="w-8 h-8 text-[#c46a2d]/50" />
                    </div>
                  )}
                  <div className="p-5 sm:p-6 flex-1 flex flex-col">
                    {p.published_at && (
                      <time className="text-xs text-muted-foreground mb-2" dateTime={p.published_at}>
                        {new Date(p.published_at).toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric' })}
                      </time>
                    )}
                    <h2 className="text-lg sm:text-xl font-semibold mb-2 group-hover:text-[#e08a4e] transition-colors">
                      {p.title}
                    </h2>
                    {p.excerpt && (
                      <p className="text-sm text-muted-foreground leading-6 line-clamp-3">{p.excerpt}</p>
                    )}
                    <div className="mt-auto pt-4 flex items-center gap-1 text-sm font-medium text-[#e08a4e]">
                      {t('readMore')} <ChevronRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                    </div>
                  </div>
                </article>
              </Link>
            ))}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}

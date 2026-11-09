import { absoluteImage } from '@/lib/site-image-path';

import { localizedAlternates } from '@/lib/community/seo';
import { notFound } from 'next/navigation';
import { ArrowLeft, BookOpen } from 'lucide-react';
import { getTranslations, getLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { Footer, TopNav } from '@/components/nav';
import { SimpleMarkdown } from '@/components/simple-markdown';
import { getDb, serializeDoc } from '@/lib/mongo';
import { BLOG_COLLECTION, readWithRetry } from '@/lib/blog';
import { BlogCover } from '@/components/blog-cover';
import { OG_IMAGES, TWITTER_CARD } from '@/lib/seo-social';

const SITE_URL = (process.env.NEXT_PUBLIC_BASE_URL || 'https://wody.online').replace(/\/+$/, '');

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function getPostBySlug(slug) {
  const doc = await readWithRetry(async () => {
    const db = await getDb();
    return db.collection(BLOG_COLLECTION).findOne({ slug, published: true });
  });
  return doc ? serializeDoc(doc) : null;
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  let post;
  try {
    post = await getPostBySlug(slug);
  } catch (error) {
    console.error('blog post metadata failed', error);
    return { title: { absolute: 'Wody Blog' } };
  }
  if (!post) return { robots: { index: false, follow: true } };

  const title = post.seo_title || post.title;
  const description = post.seo_description || post.excerpt || undefined;

  return {
    title: { absolute: `${title} - Wody Blog` },
    description,
    alternates: localizedAlternates(await getLocale(), `/blog/${post.slug}`),
    robots: { index: true, follow: true },
    twitter: TWITTER_CARD,
      openGraph: {
      title,
      description,
      url: `${SITE_URL}/blog/${post.slug}`,
      type: 'article',
      publishedTime: post.published_at,
      ...(post.cover_image_url ? { images: [{ url: absoluteImage(post.cover_image_url, SITE_URL) }] } : {}),
    },
  };
}

export default async function BlogPostPage({ params }) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) notFound();

  let t;
  try {
    t = await getTranslations('blog');
  } catch (error) {
    console.error('blog post page failed to load translations, showing degraded state', error);
    return (
      <div className="relative min-h-screen">
        <TopNav />
        <main className="max-w-2xl mx-auto px-4 py-24 text-center">
          <h1 className="text-2xl font-semibold mb-2">{post.title}</h1>
          <p className="text-muted-foreground text-sm">This page couldn&apos;t fully load right now, please try again shortly.</p>
        </main>
        <Footer />
      </div>
    );
  }
  const locale = await getLocale();

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.seo_description || post.excerpt || undefined,
    url: `${SITE_URL}/blog/${post.slug}`,
    datePublished: post.published_at,
    dateModified: post.updated_at || post.published_at,
    ...(post.author_name ? { author: { '@type': 'Person', name: post.author_name } } : {}),
    ...(post.cover_image_url ? { image: absoluteImage(post.cover_image_url, SITE_URL) } : {}),
    publisher: {
      '@type': 'Organization',
      name: 'Wody',
      url: SITE_URL,
      logo: { '@type': 'ImageObject', url: `${SITE_URL}/icon` },
    },
    mainEntityOfPage: { '@type': 'WebPage', '@id': `${SITE_URL}/blog/${post.slug}` },
  };

  return (
    <div className="relative min-h-screen overflow-x-hidden">
      <div className="absolute inset-0 pointer-events-none -z-10">
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full bg-[#7c3010]/20 blur-3xl" />
        <div className="absolute top-[45%] -right-40 w-[500px] h-[500px] rounded-full bg-[#c46a2d]/10 blur-3xl" />
      </div>

      <TopNav />

      <main id="main-content" className="max-w-3xl mx-auto px-4 sm:px-6 py-12 md:py-16">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

        <Link href="/blog" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-8">
          <ArrowLeft className="w-3.5 h-3.5" /> {t('backToBlog')}
        </Link>

        <article>
          {post.cover_image_url && (
            <div className="relative w-full h-56 sm:h-80 rounded-2xl border border-border/70 mb-8 overflow-hidden">
              <BlogCover src={post.cover_image_url} sizes="(max-width: 768px) 100vw, 768px" priority />
            </div>
          )}

          <header className="mb-8">
            {post.published_at && (
              <time className="text-xs text-muted-foreground" dateTime={post.published_at}>
                {new Date(post.published_at).toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric' })}
                {post.author_name ? ` · ${post.author_name}` : ''}
              </time>
            )}
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mt-3">{post.title}</h1>
          </header>

          <SimpleMarkdown text={post.content} className="text-base sm:text-lg text-muted-foreground" />
        </article>

        <div className="mt-14 pt-8 border-t border-border/60">
          <Link href="/blog" className="inline-flex items-center gap-2 text-sm font-medium text-[#e08a4e] hover:text-[#f2c091]">
            <BookOpen className="w-4 h-4" /> {t('moreArticles')}
          </Link>
        </div>
      </main>

      <Footer />
    </div>
  );
}

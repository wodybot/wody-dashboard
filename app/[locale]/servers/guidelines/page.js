import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Footer, TopNav } from '@/components/nav';
import { Link } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
import { ROBOTS_INDEX, localizedAlternates, ogLocale } from '@/lib/community/seo';
import { CONTENT } from '@/lib/content';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
const SITE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://wody.online';

export async function generateMetadata({ params }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'community' });
  const path = locale === routing.defaultLocale ? '/servers/guidelines' : `/${locale}/servers/guidelines`;
  return {
    title: { absolute: t('guidelines.metaTitle') }, description: t('guidelines.metaDescription'), alternates: localizedAlternates(locale, '/servers/guidelines'), robots: ROBOTS_INDEX,
    openGraph: { title: t('guidelines.metaTitle'), description: t('guidelines.metaDescription'), url: `${SITE_URL}${path}`, type: 'article', siteName: 'Wody', ...ogLocale(locale) },
  };
}

export default async function GuidelinesPage({ params }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('community');
  const sections = t.raw('guidelines.sections');
  const discord = t.raw('guidelines.discordSections');
  return (
    <div className="min-h-screen">
      <TopNav />
      <main id="main-content" className="mx-auto w-full max-w-3xl px-4 py-10 sm:py-14">
        <h1 className="text-3xl font-black sm:text-4xl">{t('guidelines.title')}</h1>
        <p className="mt-2 text-xs text-muted-foreground">{CONTENT.legal.guidelinesUpdated}</p>
        <p className="mt-3 text-muted-foreground">{t('guidelines.intro')}</p>
        <nav aria-label={t('guidelines.toc')} className="mt-6 rounded-xl border border-border/60 bg-card/50 p-4">
          <ol className="list-decimal space-y-1 pl-5 text-sm">{sections.map((s, i) => <li key={i}><a href={`#g${i}`} className="text-[#e08a4e] underline-offset-4 hover:underline">{s.heading}</a></li>)}</ol>
          <a href="#discord-community" className="mt-3 inline-block text-sm text-[#e08a4e] underline-offset-4 hover:underline">{t('guidelines.discordTitle')}</a>
        </nav>
        <div className="mt-8 space-y-8">
          {sections.map((s, i) => (
            <section key={i} id={`g${i}`} aria-labelledby={`g${i}-h`} className="scroll-mt-24">
              <h2 id={`g${i}-h`} className="text-xl font-bold">{i + 1}. {s.heading}</h2>
              {s.body.map((p, j) => <p key={j} className="mt-2 text-muted-foreground">{p}</p>)}
              {s.list ? <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">{s.list.map((li, k) => <li key={k}>{li}</li>)}</ul> : null}
            </section>
          ))}
        </div>
        <section id="discord-community" aria-labelledby="discord-community-h" className="mt-14 scroll-mt-24 border-t border-border/60 pt-10">
          <h2 id="discord-community-h" className="text-2xl font-black">{t('guidelines.discordTitle')}</h2>
          <p className="mt-3 text-muted-foreground" dangerouslySetInnerHTML={{ __html: t.raw('guidelines.discordIntro') }} />
          <div className="mt-6 space-y-6">
            {discord.map(([heading, body], i) => (
              <section key={i} id={`d${i + 1}`} className="scroll-mt-24">
                <h3 className="text-lg font-bold">{heading}</h3>
                <p className="mt-2 text-muted-foreground" dangerouslySetInnerHTML={{ __html: body }} />
              </section>
            ))}
          </div>
          <p className="mt-8 text-sm text-muted-foreground">
            <a href="mailto:contact@wody.online" className="text-[#e08a4e] underline-offset-4 hover:underline">contact@wody.online</a>
            {' · '}<a href="/terms" className="text-[#e08a4e] underline-offset-4 hover:underline">Terms</a>
            {' · '}<a href="/privacy" className="text-[#e08a4e] underline-offset-4 hover:underline">Privacy</a>
            {' · '}<a href="/cookies" className="text-[#e08a4e] underline-offset-4 hover:underline">Cookies</a>
          </p>
        </section>
        <p className="mt-10 text-sm"><Link href="/servers" className="text-[#e08a4e] underline-offset-4 hover:underline">{t('guidelines.back')}</Link></p>
      </main>
      <Footer />
    </div>
  );
}

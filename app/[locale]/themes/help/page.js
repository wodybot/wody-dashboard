import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
import { Footer, TopNav } from '@/components/nav';
import { moduleOgImages, moduleTwitter } from '@/lib/seo-social';

const SITE = process.env.NEXT_PUBLIC_BASE_URL || 'https://wody.online';
const PATH = '/themes/help';
const urlFor = (locale) => `${SITE}${locale === routing.defaultLocale ? '' : `/${locale}`}${PATH}`;

export const revalidate = 3600;

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'themesHelp' });
  const languages = Object.fromEntries(routing.locales.map((l) => [l, urlFor(l)]));
  languages['x-default'] = `${SITE}${PATH}`;
  return {
    title: { absolute: t('meta.title') }, description: t('meta.description'),
    alternates: { canonical: urlFor(locale), languages },
    robots: { index: true, follow: true },
    twitter: moduleTwitter('themes', locale),
    openGraph: { images: moduleOgImages('themes', locale), title: t('meta.title'), description: t('meta.description'), url: urlFor(locale), type: 'article', locale },
  };
}

export default async function ThemesHelpPage({ params }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'themesHelp' });
  const faq = [1, 2, 3, 4, 5, 6].map((n) => ({ q: t(`faq.q${n}`), a: t(`faq.a${n}`) }));
  const ld = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'FAQPage', '@id': `${urlFor(locale)}#faq`, inLanguage: locale, mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) },
      { '@type': 'WebPage', '@id': `${urlFor(locale)}#page`, url: urlFor(locale), name: t('meta.title'), description: t('meta.description'), inLanguage: locale },
      { '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Wody', item: `${SITE}${locale === routing.defaultLocale ? '' : `/${locale}`}/` },
        { '@type': 'ListItem', position: 2, name: t('h1'), item: urlFor(locale) }] },
    ],
  };
  const sections = [
    { id: 'how', title: t('how.title'), items: [t('how.body')] },
    { id: 'who', title: t('who.title'), items: [t('who.basic'), t('who.premium'), t('who.owner')] },
    { id: 'intro', title: t('intro.title'), items: [t('intro.body')] },
    { id: 'access', title: t('access.title'), items: [t('access.body')] },
    { id: 'assets', title: t('assets.title'), items: [t('assets.body')] },
    { id: 'safe', title: t('safe.title'), items: [t('safe.body')] },
  ];
  return (
    <div className="min-h-screen">
      <TopNav />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, '\\u003c') }} />
      <main id="main-content" className="mx-auto max-w-3xl px-6 py-14">
        <h1 className="text-3xl font-bold tracking-tight">{t('h1')}</h1>
        <p className="mt-4 text-muted-foreground">{t('lead')}</p>
        {sections.map((s) => (
          <section key={s.id} className="mt-10" aria-labelledby={`th-${s.id}`}>
            <h2 id={`th-${s.id}`} className="mb-3 text-xl font-semibold">{s.title}</h2>
            <div className="space-y-3">{s.items.map((p) => <p key={p} className="text-sm leading-relaxed text-muted-foreground">{p}</p>)}</div>
          </section>
        ))}
        <section className="mt-10" aria-labelledby="th-faq">
          <h2 id="th-faq" className="mb-4 text-xl font-semibold">{t('faq.title')}</h2>
          <div className="space-y-3">
            {faq.map((f) => (
              <details key={f.q} className="rounded-xl border border-border/60 bg-card/40 p-4">
                <summary className="cursor-pointer font-medium marker:text-[#e6cd8c]">{f.q}</summary>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.a}</p>
              </details>
            ))}
          </div>
        </section>
        <nav aria-label={t('h1')} className="mt-10 flex flex-wrap gap-3 border-t border-border/60 pt-6 text-sm">
          <Link href="/" className="text-[#e6cd8c] underline-offset-2 hover:underline">{t('back')}</Link>
        </nav>
      </main>
      <Footer />
    </div>
  );
}

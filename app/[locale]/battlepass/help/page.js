import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
import { Footer, TopNav } from '@/components/nav';
import { OG_IMAGES, TWITTER_CARD } from '@/lib/seo-social';

const SITE = process.env.NEXT_PUBLIC_BASE_URL || 'https://wody.online';
const PATH = '/battlepass/help';
const urlFor = (locale) => `${SITE}${locale === routing.defaultLocale ? '' : `/${locale}`}${PATH}`;

export const revalidate = 3600;

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'battlepassHelp' });
  const languages = Object.fromEntries(routing.locales.map((l) => [l, urlFor(l)]));
  languages['x-default'] = `${SITE}${PATH}`;
  return {
    title: { absolute: t('metaTitle') }, description: t('metaDescription'),
    alternates: { canonical: urlFor(locale), languages },
    robots: { index: true, follow: true },
    twitter: TWITTER_CARD,
    openGraph: { images: OG_IMAGES, title: t('metaTitle'), description: t('metaDescription'), url: urlFor(locale), type: 'article', locale },
  };
}

export default async function BattlePassHelpPage({ params }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'battlepassHelp' });
  const steps = t.raw('steps');
  const faq = t.raw('faq');
  const ld = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'FAQPage', '@id': `${urlFor(locale)}#faq`, inLanguage: locale, mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) },
      { '@type': 'HowTo', '@id': `${urlFor(locale)}#howto`, name: t('title'), inLanguage: locale, step: steps.map((s, i) => ({ '@type': 'HowToStep', position: i + 1, name: s.title, text: s.text })) },
      { '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Wody', item: `${SITE}${locale === routing.defaultLocale ? '' : `/${locale}`}/` },
        { '@type': 'ListItem', position: 2, name: t('title'), item: urlFor(locale) }] },
    ],
  };
  return (
    <div className="min-h-screen">
      <TopNav />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, '\\u003c') }} />
      <main id="main-content" className="mx-auto max-w-3xl px-6 py-14">
        <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
        <p className="mt-4 text-muted-foreground">{t('intro')}</p>
        <section className="mt-10" aria-labelledby="bp-help-steps">
          <h2 id="bp-help-steps" className="mb-4 text-xl font-semibold">{t('stepsTitle')}</h2>
          <ol className="space-y-4">
            {steps.map((s, i) => (
              <li key={s.title} className="rounded-xl border border-border/60 bg-card/40 p-4">
                <h3 className="font-semibold"><span className="mr-2 text-[#e6cd8c]">{i + 1}.</span>{s.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{s.text}</p>
              </li>
            ))}
          </ol>
        </section>
        <section className="mt-10" aria-labelledby="bp-help-faq">
          <h2 id="bp-help-faq" className="mb-4 text-xl font-semibold">{t('faqTitle')}</h2>
          <div className="space-y-3">
            {faq.map((f) => (
              <details key={f.q} className="group rounded-xl border border-border/60 bg-card/40 p-4">
                <summary className="cursor-pointer font-medium marker:text-[#e6cd8c]">{f.q}</summary>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.a}</p>
              </details>
            ))}
          </div>
        </section>
        <nav aria-label={t('linksTitle')} className="mt-10 flex flex-wrap gap-3 border-t border-border/60 pt-6 text-sm">
          <Link href="/policies/battle-pass" className="text-[#e6cd8c] underline-offset-2 hover:underline">{t('policyLink')}</Link>
          <Link href="/battlepass" className="text-[#e6cd8c] underline-offset-2 hover:underline">{t('pageLink')}</Link>
          <Link href="/" className="text-[#e6cd8c] underline-offset-2 hover:underline">{t('homeLink')}</Link>
        </nav>
      </main>
      <Footer />
    </div>
  );
}

import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { TopNav, Footer } from '@/components/nav';
import ComplaintForm from '@/components/moderation/ComplaintForm';

const DOCS = ['content-policy', 'copyright', 'complaint'];
const REVIEW = { en: '3 November 2026', ro: '3 noiembrie 2026' };

export const revalidate = 3600;
export const metadata = { robots: { index: false, follow: false } };

export function generateStaticParams() {
  return DOCS.map((doc) => ({ doc }));
}

export default async function PolicyPage({ params, searchParams }) {
  const { locale, doc } = await params;
  if (!DOCS.includes(doc)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'policies' });
  const page = t.raw(doc);
  const review = REVIEW[locale] || REVIEW.en;
  const sp = (await searchParams) || {};
  const rows = [['version', page.version], ['updated', review]];
  return (
    <div className="min-h-screen">
      <TopNav />
      <main id="main-content" className="mx-auto max-w-3xl px-6 py-14">
        <h1 className="text-3xl font-bold tracking-tight">{page.title}</h1>
        <dl className="mt-5 grid grid-cols-2 gap-2 rounded-xl border border-border/60 bg-card/40 p-4 text-sm">
          {rows.map(([k, v]) => (
            <div key={k}><dt className="text-xs text-muted-foreground">{t(k)}</dt><dd className="font-medium">{v}</dd></div>
          ))}
        </dl>
        <div className="mt-8 space-y-8">
          {page.sections.map((s) => (
            <section key={s.heading}>
              <h2 className="mb-2 text-xl font-semibold">{s.heading}</h2>
              <div className="prose prose-invert max-w-none text-sm leading-relaxed text-muted-foreground [&_li]:ml-5 [&_li]:list-disc [&_ol_li]:list-decimal [&_p]:mb-3" dangerouslySetInnerHTML={{ __html: s.html }} />
            </section>
          ))}
        </div>
        {doc === 'complaint' ? <ComplaintForm labels={page.form} initialUser={String(sp.user || '').slice(0, 40)} /> : null}
        <nav aria-label={t('related')} className="mt-10 flex flex-wrap gap-3 border-t border-border/60 pt-6 text-sm">
          {DOCS.filter((d) => d !== doc).map((d) => <Link key={d} href={`/policies/${d}`} className="text-[#e6cd8c] underline-offset-2 hover:underline">{t(`nav.${d}`)}</Link>)}
        </nav>
      </main>
      <Footer />
    </div>
  );
}

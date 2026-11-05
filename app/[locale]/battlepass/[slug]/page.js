import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import PassShell from '@/components/battlepass/PassShell';
import { loadStudioPage } from '@/lib/battlepass/studio/public';
import { studioTheme } from '@/lib/battlepass/studio/theme';
import { studioMetadata, studioJsonLd } from '@/lib/battlepass/studio/seo';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function generateMetadata({ params }) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const data = await loadStudioPage({ slug });
  if (!data) return { title: 'Battle Pass', robots: { index: false } };
  return studioMetadata({ locale, data, t: await getTranslations({ locale, namespace: 'battlepass' }) });
}

export default async function SeasonPassPage({ params }) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const data = await loadStudioPage({ slug });
  if (!data) notFound();
  const t = await getTranslations({ locale, namespace: 'battlepass' });
  const prefix = locale === 'en' ? '' : `/${locale}`;
  const path = `/battlepass/${data.page.slug}`;
  const loginHref = `/api/auth/login?next=${encodeURIComponent(`${prefix}${path}`)}`;
  const ld = studioJsonLd({ locale, data, t });
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, '\\u003c') }} />
      <PassShell data={data} t={t} backHref="/battlepass" loginHref={loginHref} emptyKey="emptyGlobal" studio={{ config: data.config, stats: data.stats }} theme={studioTheme(data.season.page, data.config)} />
    </>
  );
}

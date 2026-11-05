import { getTranslations, setRequestLocale } from 'next-intl/server';
import PassShell from '@/components/battlepass/PassShell';
import { loadPublicPass } from '@/lib/battlepass/public';
import { passMetadata, passJsonLd } from '@/lib/battlepass/seo';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function generateMetadata({ params }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return passMetadata({ locale, path: '/battlepass', t: await getTranslations({ locale, namespace: 'battlepass' }), scope: 'global' });
}

export default async function GlobalBattlePassPage({ params }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'battlepass' });
  const data = await loadPublicPass(null);
  const prefix = locale === 'en' ? '' : `/${locale}`;
  const loginHref = `/api/auth/login?next=${encodeURIComponent(`${prefix}/battlepass`)}`;
  const ld = passJsonLd({ locale, path: '/battlepass', t, season: data.season });
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, '\\u003c') }} />
      <PassShell data={data} t={t} backHref="/" loginHref={loginHref} emptyKey="emptyGlobal" />
    </>
  );
}

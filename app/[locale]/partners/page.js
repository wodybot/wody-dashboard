import Image from 'next/image';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ArrowDown, Handshake, Orbit, Rocket, Sparkles, MessageCircle, Mail, BadgeCheck } from 'lucide-react';
import { Footer, TopNav, WodyLogo } from '@/components/nav';
import { Link } from '@/i18n/navigation';
import PartnerCard from '@/components/partners/PartnerCard';
import { getPublicPartners } from '@/lib/partners';
import { COMMUNITY_INVITE } from '@/lib/content';
import { ROBOTS_INDEX, absolute, jsonLd, localePath, localizedAlternates, ogLocale } from '@/lib/community/seo';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function generateMetadata({ params }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'partners' });
  const url = absolute(localePath(locale, '/partners'));
  return {
    title: { absolute: t('metaTitle') },
    description: t('metaDescription'),
    keywords: t('metaKeywords').split(',').map((k) => k.trim()).filter(Boolean),
    alternates: localizedAlternates(locale, '/partners'),
    robots: ROBOTS_INDEX,
    openGraph: { title: t('metaTitle'), description: t('metaDescription'), url, type: 'website', siteName: 'Wody', ...ogLocale(locale), images: [{ url: absolute('/opengraph-image') }] },
    twitter: { card: 'summary_large_image', title: t('metaTitle'), description: t('metaDescription') },
  };
}

function orbitLayout(partners) {
  const inner = partners.slice(0, 6);
  const outer = partners.slice(6, 16);
  return [
    { key: 'inner', items: inner, radius: 118, speed: '55s', reverse: false },
    { key: 'outer', items: outer, radius: 190, speed: '85s', reverse: true },
  ].filter((ring) => ring.items.length);
}

function Satellite({ partner, angle, radius }) {
  return (
    <span className="absolute left-1/2 top-1/2" style={{ transform: `rotate(${angle}deg) translate(${radius}px) rotate(${-angle}deg)` }}>
      <span className="partner-satellite relative -ml-6 -mt-6 flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl border-2 bg-[#120c09] shadow-lg" style={{ borderColor: partner.color, boxShadow: `0 0 24px -4px ${partner.color}` }} title={partner.name}>
        {partner.avatar_src
          ? <Image src={partner.avatar_src} alt="" fill sizes="48px" className="object-cover" />
          : <span className="text-lg font-black" style={{ color: partner.color }}>{partner.name.slice(0, 1).toUpperCase()}</span>}
      </span>
    </span>
  );
}

function OrbitHero({ partners }) {
  const rings = orbitLayout(partners);
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[26rem] origin-center scale-[0.78] sm:scale-100" aria-hidden="true">
      <span className="absolute inset-[18%] rounded-full border border-dashed border-[#c46a2d]/30" />
      <span className="absolute inset-0 rounded-full border border-[#c46a2d]/15" />
      <span className="absolute inset-[34%] rounded-full bg-[#c46a2d]/10 blur-2xl" />
      <span className="absolute left-1/2 top-1/2 -ml-11 -mt-11">
        <span className="partner-core block rounded-3xl"><WodyLogo className="h-[5.5rem] w-[5.5rem] !rounded-3xl" /></span>
      </span>
      {rings.length ? rings.map((ring) => (
        <span key={ring.key} className={`partner-ring absolute inset-0 ${ring.reverse ? 'partner-ring-reverse' : ''}`} style={{ '--orbit-speed': ring.speed }}>
          {ring.items.map((p, i) => <Satellite key={p.id} partner={p} radius={ring.radius} angle={(360 / ring.items.length) * i + (ring.reverse ? 30 : 0)} />)}
        </span>
      )) : (
        <span className="partner-ring absolute inset-0" style={{ '--orbit-speed': '40s' }}>
          {[0, 120, 240].map((a) => (
            <span key={a} className="absolute left-1/2 top-1/2" style={{ transform: `rotate(${a}deg) translate(118px)` }}>
              <span className="-ml-5 -mt-5 flex h-10 w-10 items-center justify-center rounded-2xl border-2 border-dashed border-[#c46a2d]/50 text-[#f2c091]/70">?</span>
            </span>
          ))}
        </span>
      )}
    </div>
  );
}

export default async function PartnersPage({ params }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('partners');
  const partners = await getPublicPartners();
  const featured = partners.filter((p) => p.featured).slice(0, 2);
  const rest = partners.filter((p) => !featured.includes(p));
  const totalServers = partners.reduce((sum, p) => sum + (typeof p.servers === 'number' ? p.servers : 0), 0);
  const labels = { add: t('card.add'), website: t('card.website'), support: t('card.support'), servers: t('card.servers'), partner: t('card.partner') };
  const fmt = (n) => { try { return new Intl.NumberFormat(locale, { notation: n >= 10000 ? 'compact' : 'standard', maximumFractionDigits: 1 }).format(n); } catch { return String(n); } };
  const steps = t.raw('become.steps');
  const pageUrl = absolute(localePath(locale, '/partners'));
  const ld = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'CollectionPage', '@id': `${pageUrl}#webpage`, url: pageUrl, name: t('metaTitle'), description: t('metaDescription'), inLanguage: locale, isPartOf: { '@type': 'WebSite', '@id': `${absolute('/')}#website`, name: 'Wody', url: absolute('/') }, ...(partners.length ? { mainEntity: { '@id': `${pageUrl}#list` } } : {}) },
      ...(partners.length ? [{
        '@type': 'ItemList', '@id': `${pageUrl}#list`, numberOfItems: partners.length,
        itemListElement: partners.map((p, i) => ({
          '@type': 'ListItem', position: i + 1,
          item: { '@type': 'SoftwareApplication', name: p.name, applicationCategory: 'CommunicationApplication', operatingSystem: 'Discord', description: p.tagline || p.description || undefined, url: p.website_url || p.invite_url, ...(p.avatar_url ? { image: p.avatar_url } : {}), offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' } },
        })),
      }] : []),
    ],
  };

  return (
    <div className="relative min-h-screen overflow-x-clip">
      <TopNav />
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(ld)} />
      <main id="main-content">
        <section className="relative">
          <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-[38rem] bg-[radial-gradient(60%_60%_at_70%_30%,rgba(196,106,45,0.22),transparent_70%)]" />
          <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-6 pb-16 pt-14 md:pt-20 lg:grid-cols-[1.05fr_1fr]">
            <div className="text-center lg:text-left">
              <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#c46a2d]/40 bg-[#c46a2d]/10 px-3 py-1 text-xs font-medium text-[#f2c091]"><Handshake className="h-3.5 w-3.5" /> {t('badge')}</p>
              <h1 className="text-4xl font-black leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
                {t('title')} <span className="bg-gradient-to-r from-[#f2c091] via-[#e08a4e] to-[#c46a2d] bg-clip-text text-transparent">{t('titleHighlight')}</span>
              </h1>
              <p className="mx-auto mt-5 max-w-xl text-lg text-muted-foreground lg:mx-0">{t('subtitle')}</p>
              <div className="mx-auto mt-8 grid w-full max-w-lg grid-cols-2 gap-3 lg:mx-0">
                <a href="#partners" className="inline-flex h-12 w-full items-center justify-center gap-2 whitespace-nowrap rounded-xl px-3 text-sm font-semibold sm:px-5 sm:text-base gradient-primary">
                  <Orbit className="h-4 w-4" /> {t('ctaExplore')} <ArrowDown className="h-4 w-4" />
                </a>
                <a href="#become" className="inline-flex h-12 w-full items-center justify-center gap-2 whitespace-nowrap rounded-xl px-3 text-sm font-semibold sm:px-5 sm:text-base border border-border/70 bg-card/40 hover:bg-card/80">
                  <Rocket className="h-4 w-4 text-[#e08a4e]" /> {t('ctaBecome')}
                </a>
              </div>
              <dl className="mx-auto mt-10 grid max-w-lg grid-cols-3 gap-3 lg:mx-0">
                {[
                  [t('stats.partners'), fmt(partners.length)],
                  [t('stats.servers'), totalServers ? fmt(totalServers) : '0'],
                  [t('stats.handpicked'), '100%'],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-2xl border border-border/60 bg-card/40 px-3 py-3 backdrop-blur">
                    <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</dt>
                    <dd className="mt-1 text-2xl font-bold tabular-nums text-[#f2c091]">{value}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <OrbitHero partners={partners} />
          </div>
        </section>

        <section id="partners" className="mx-auto max-w-7xl scroll-mt-24 px-6 pb-20">
          {partners.length ? (
            <>
              {featured.length ? (
                <div className="mb-12">
                  <h2 className="mb-5 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.16em] text-[#f2c091]"><Sparkles className="h-4 w-4" /> {t('featured')}</h2>
                  <div className="grid gap-6">{featured.map((p) => <PartnerCard key={p.id} partner={p} labels={labels} featured />)}</div>
                </div>
              ) : null}
              {rest.length ? (
                <div>
                  <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
                    <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">{t('all')}</h2>
                    <p className="flex items-center gap-1.5 text-sm text-muted-foreground"><BadgeCheck className="h-4 w-4 text-[#e08a4e]" /> {t('allNote')}</p>
                  </div>
                  <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{rest.map((p) => <PartnerCard key={p.id} partner={p} labels={labels} />)}</div>
                </div>
              ) : null}
            </>
          ) : (
            <div className="rounded-3xl border border-dashed border-[#c46a2d]/40 bg-card/30 px-6 py-16 text-center">
              <Orbit className="mx-auto h-10 w-10 text-[#e08a4e]" />
              <h2 className="mt-4 text-2xl font-bold">{t('emptyTitle')}</h2>
              <p className="mx-auto mt-2 max-w-md text-muted-foreground">{t('emptyText')}</p>
            </div>
          )}
        </section>

        <section id="become" className="mx-auto max-w-7xl scroll-mt-24 px-6 pb-24">
          <div className="relative overflow-hidden rounded-[2rem] border-2 border-[#c46a2d]/50 bg-gradient-to-br from-[#7c3010]/30 via-[#2a1208]/40 to-transparent p-8 md:p-12">
            <div aria-hidden="true" className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-[#f2c091]/10 blur-3xl" />
            <div className="relative grid gap-10 lg:grid-cols-[1fr_1.2fr] lg:items-center">
              <div>
                <p className="mb-3 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-[#f2c091]"><Rocket className="h-3.5 w-3.5" /> {t('become.badge')}</p>
                <h2 className="text-3xl font-black tracking-tight sm:text-4xl">{t('become.title')}</h2>
                <p className="mt-3 text-muted-foreground">{t('become.text')}</p>
                <div className="mt-7 grid w-full max-w-md grid-cols-1 gap-3 sm:grid-cols-2">
                  <a href={COMMUNITY_INVITE} target="_blank" rel="noopener noreferrer" className="inline-flex h-12 w-full items-center justify-center gap-2 whitespace-nowrap rounded-xl px-3 text-sm font-semibold sm:px-5 sm:text-base gradient-primary"><MessageCircle className="h-4 w-4" /> {t('become.apply')}</a>
                  <Link href="/contact" className="inline-flex h-12 w-full items-center justify-center gap-2 whitespace-nowrap rounded-xl px-3 text-sm font-semibold sm:px-5 sm:text-base border border-border/70 bg-card/40 hover:bg-card/80"><Mail className="h-4 w-4 text-[#e08a4e]" /> {t('become.contact')}</Link>
                </div>
              </div>
              <ol className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
                {Array.isArray(steps) ? steps.map((step, i) => (
                  <li key={i} className="relative rounded-2xl border border-[#c46a2d]/30 bg-black/25 p-5">
                    <span className="text-4xl font-black text-[#c46a2d]/40">0{i + 1}</span>
                    <h3 className="mt-2 font-semibold">{step.title}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{step.text}</p>
                  </li>
                )) : null}
              </ol>
            </div>
          </div>
        </section>
        <p className="max-w-3xl mx-auto px-6 pb-12 text-xs text-muted-foreground leading-relaxed text-center">
          {t('disclaimer')} <a href="/terms" className="text-[#e08a4e] hover:underline">{t('disclaimerLink')}</a>
        </p>
      </main>
      <Footer />
    </div>
  );
}

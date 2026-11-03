import Image from 'next/image';
import { ArrowUpRight, Globe, LifeBuoy, Plus, Server } from 'lucide-react';
import { proxiedImageUrl } from '@/lib/utils';

const HEX = /^#[0-9a-fA-F]{6}$/;

export function partnerImage(partner, key) {
  const signed = partner[`${key}_src`];
  if (typeof signed === 'string') return { src: signed || null, optimized: Boolean(signed) };
  return { src: proxiedImageUrl(partner[`${key}_url`]) || null, optimized: false };
}

function PartnerPicture({ image, alt, sizes, className, priority = false }) {
  if (!image.src) return null;
  if (image.optimized) {
    return <Image src={image.src} alt={alt} fill sizes={sizes} className={className} priority={priority} />;
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={image.src} alt={alt} loading="lazy" decoding="async" className={`h-full w-full ${className}`} />;
}

function formatServers(n) {
  if (typeof n !== 'number' || !Number.isFinite(n)) return null;
  try { return new Intl.NumberFormat('en', { notation: n >= 10000 ? 'compact' : 'standard', maximumFractionDigits: 1 }).format(n); } catch { return String(n); }
}

export default function PartnerCard({ partner, labels, featured = false }) {
  const color = HEX.test(partner.color || '') ? partner.color : '#c46a2d';
  const servers = formatServers(partner.servers);
  const initial = (partner.name || '?').trim().slice(0, 1).toUpperCase();
  const banner = partnerImage(partner, 'banner');
  const avatar = partnerImage(partner, 'avatar');
  return (
    <article
      className={`partner-card group relative flex h-full flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#120c09]/90 transition duration-300 hover:-translate-y-1 motion-reduce:transition-none motion-reduce:hover:translate-y-0 ${featured ? 'lg:flex-row' : ''}`}
      style={{ '--brand': color }}
    >
      <span aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-3xl opacity-0 transition-opacity duration-300 group-hover:opacity-100" style={{ boxShadow: `inset 0 0 0 1px ${color}80, 0 20px 60px -20px ${color}66` }} />

      <div className={`relative shrink-0 overflow-hidden ${featured ? 'h-40 lg:h-auto lg:w-[44%]' : 'h-28'}`}>
        {banner.src
          ? <PartnerPicture image={banner} alt="" priority={featured} sizes={featured ? '(min-width:1024px) 560px, 100vw' : '(min-width:1024px) 400px, (min-width:640px) 50vw, 100vw'} className="object-cover transition-transform duration-500 group-hover:scale-105 motion-reduce:transition-none" />
          : <div className="h-full w-full" style={{ background: `radial-gradient(120% 140% at 15% 0%, ${color}cc 0%, ${color}33 45%, transparent 75%), linear-gradient(135deg, #1b100b, #0c0705)` }} />}
        <div aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(transparent_55%,rgba(18,12,9,0.95))]" />
        <div aria-hidden="true" className="absolute inset-0 opacity-[0.07] [background-image:radial-gradient(#fff_1px,transparent_1px)] [background-size:14px_14px]" />
      </div>

      <div className={`relative flex flex-1 flex-col p-5 ${featured ? 'lg:p-8' : ''}`}>
        <div className={`flex items-end gap-3 ${featured ? '-mt-14 lg:mt-0' : '-mt-12'}`}>
          <span className="partner-avatar relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-2 bg-[#120c09] shadow-xl" style={{ borderColor: color }}>
            {avatar.src
              ? <PartnerPicture image={avatar} alt={partner.name} sizes="64px" className="object-cover" />
              : <span className="text-2xl font-black" style={{ color }}>{initial}</span>}
          </span>
          <span className="mb-1 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em]" style={{ borderColor: `${color}66`, color, backgroundColor: `${color}1a` }}>
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} /> {labels.partner}
          </span>
        </div>

        <h3 className={`mt-3 font-bold tracking-tight text-white ${featured ? 'text-3xl' : 'text-xl'}`}>{partner.name || '…'}</h3>
        {partner.tagline ? <p className="mt-1 text-sm font-medium" style={{ color }}>{partner.tagline}</p> : null}
        {partner.description ? <p className={`mt-3 text-sm leading-relaxed text-white/70 ${featured ? 'line-clamp-5' : 'line-clamp-3'}`}>{partner.description}</p> : null}

        {(partner.tags?.length || servers) ? (
          <div className="mt-4 flex flex-wrap items-center gap-1.5">
            {servers ? <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-xs text-white/85"><Server className="h-3 w-3" /> {servers} {labels.servers}</span> : null}
            {(partner.tags || []).map((tag) => <span key={tag} className="rounded-full border border-white/10 px-2.5 py-1 text-xs text-white/70">{tag}</span>)}
          </div>
        ) : null}

        <div className="mt-auto flex flex-wrap gap-2 pt-5">
          {partner.invite_url ? (
            <a href={partner.invite_url} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-lg transition hover:brightness-110" style={{ backgroundColor: color, boxShadow: `0 10px 30px -12px ${color}` }}>
              <Plus className="h-4 w-4" /> {labels.add}
            </a>
          ) : null}
          {partner.website_url ? (
            <a href={partner.website_url} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 px-3.5 py-2 text-sm text-white/85 transition hover:border-white/30 hover:bg-white/5">
              <Globe className="h-4 w-4" /> {labels.website} <ArrowUpRight className="h-3.5 w-3.5 opacity-60" />
            </a>
          ) : null}
          {partner.support_url ? (
            <a href={partner.support_url} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 px-3.5 py-2 text-sm text-white/85 transition hover:border-white/30 hover:bg-white/5">
              <LifeBuoy className="h-4 w-4" /> {labels.support}
            </a>
          ) : null}
        </div>
      </div>
    </article>
  );
}

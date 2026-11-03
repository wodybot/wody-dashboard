import { SvgScene } from '@/components/scenes';
import { PAGE_PATTERNS, pageGradient } from '@/lib/profile-page';
import { proxiedImageUrl } from '@/lib/utils';

const PALM = 'M50 200 C52 140 50 90 46 40 M46 40 C30 30 12 34 2 50 M46 40 C34 22 18 16 6 20 M46 40 C58 24 74 20 90 28 M46 40 C60 36 80 44 92 62 M46 40 C44 24 50 10 62 4';

export function CoastScene() {
  return (
    <div className="coast-scene absolute inset-0">
      <div className="coast-sun" />
      <div className="coast-floor" />
      <svg className="coast-palm coast-palm-l" viewBox="0 0 100 210" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round"><path d={PALM} /></svg>
      <svg className="coast-palm coast-palm-r" viewBox="0 0 100 210" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round"><path d={PALM} /></svg>
    </div>
  );
}

export default function PageBackdrop({ page, fixed = true }) {
  if (!page || page.mode === 'none') return null;
  const pat = PAGE_PATTERNS[page.pattern];
  const pos = fixed ? 'fixed' : 'absolute';
  return (
    <div aria-hidden="true" className={`pointer-events-none ${pos} inset-0 -z-10 overflow-hidden`}>
      <div className="absolute inset-0" style={{ background: pageGradient(page) || '#120b08' }} />
      {page.mode === 'image' && page.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={proxiedImageUrl(page.image)} alt="" className="absolute inset-0 h-full w-full object-cover" style={page.blur ? { filter: `blur(${page.blur}px)`, transform: 'scale(1.08)' } : undefined} />
      ) : null}
      {page.mode === 'image' ? <div className="absolute inset-0 bg-black" style={{ opacity: page.dim / 100 }} /> : null}
      {page.pattern === 'coast' ? <CoastScene /> : null}
      {page.pattern === 'skyline' || page.pattern === 'miami' ? <SvgScene kind={page.pattern} /> : null}
      {pat ? <div className="absolute inset-0" style={{ backgroundImage: pat.image, backgroundSize: pat.size, opacity: page.mode === 'image' ? 0.6 : 1 }} /> : null}
    </div>
  );
}

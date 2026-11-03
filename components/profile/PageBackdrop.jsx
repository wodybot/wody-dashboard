import { SvgScene } from '@/components/scenes';
import { PAGE_PATTERNS, pageGradient } from '@/lib/profile-page';
import { proxiedImageUrl } from '@/lib/utils';

const SCENE_PATTERNS = ['coast', 'dusk', 'skyline', 'miami'];

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
      {SCENE_PATTERNS.includes(page.pattern) ? <SvgScene kind={page.pattern} /> : null}
      {pat ? <div className="absolute inset-0" style={{ backgroundImage: pat.image, backgroundSize: pat.size, opacity: page.mode === 'image' ? 0.6 : 1 }} /> : null}
    </div>
  );
}

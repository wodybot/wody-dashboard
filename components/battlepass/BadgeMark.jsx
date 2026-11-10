// A reward picture inside the shape and colour the author chose for it. Used by the editor preview and by the public page.
import WodyIcon from '@/components/wody-icon';
import { proxiedImageUrl } from '@/lib/utils';

const CLIP = {
  circle: 'circle(50% at 50% 50%)',
  shield: 'polygon(50% 0, 100% 14%, 100% 58%, 50% 100%, 0 58%, 0 14%)',
  star: 'polygon(50% 0, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)',
  hex: 'polygon(25% 5%, 75% 5%, 100% 50%, 75% 95%, 25% 95%, 0 50%)',
  ribbon: 'polygon(0 0, 100% 0, 100% 100%, 50% 80%, 0 100%)',
};

export default function BadgeMark({ badge, image, fallbackIcon = 'rewards', size = 56, accent = '#e6cd8c' }) {
  const shape = badge?.shape && CLIP[badge.shape] ? badge.shape : null;
  const color = badge?.color || accent;
  if (!shape && !badge?.color) {
    return image ? <img src={proxiedImageUrl(image)} alt="" loading="lazy" referrerPolicy="no-referrer" style={{ width: size, height: size, objectFit: 'contain' }} /> : <WodyIcon name={fallbackIcon} size={size * 0.7} inline={false} />;
  }
  return (
    <span aria-hidden="true" style={{ display: 'inline-grid', placeItems: 'center', width: size, height: size, background: `linear-gradient(160deg, ${color}, ${color}99)`, clipPath: CLIP[shape || 'circle'] }}>
      {image ? <img src={proxiedImageUrl(image)} alt="" loading="lazy" referrerPolicy="no-referrer" style={{ width: '68%', height: '68%', objectFit: 'contain' }} /> : <WodyIcon name={fallbackIcon} size={size * 0.5} inline={false} />}
    </span>
  );
}

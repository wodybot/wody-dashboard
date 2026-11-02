'use client';
import dynamic from 'next/dynamic';
import { useAutumnConfig } from './autumn-context';
import styles from './login-leaf-accent.module.css';

// next/dynamic means the OvalLeaf SVG module (and its gradient/shadow
// markup) is only ever fetched by the browser on the branch below that
// actually renders it - i.e. only when Autumn is enabled AND the leaves
// effect is on. When disabled, this whole file amounts to a context read
// and an `if`: no extra network request, no extra DOM.
const OvalLeaf = dynamic(() => import('./leaf-assets').then((m) => m.OvalLeaf), { ssr: true });

// Purely decorative: doesn't move the button, doesn't change its size or
// hit target, ignored by assistive tech, never intercepts clicks. Meant to
// be rendered inside a `position: relative` wrapper around the Login
// button (see components/nav.jsx).
export default function LoginLeafAccent() {
  const autumn = useAutumnConfig();
  if (!autumn?.enabled || autumn.effects?.leaves === false) return null;

  const animated = autumn.effects?.animations !== false;
  const withShadow = autumn.effects?.shadows !== false;

  return (
    <span
      aria-hidden="true"
      className={[styles.leaf, animated ? styles.animated : ''].filter(Boolean).join(' ')}
      style={{ filter: withShadow ? 'drop-shadow(0 1px 2px rgba(10,5,2,0.35))' : 'none' }}
    >
      <OvalLeaf className="w-full h-full" />
    </span>
  );
}

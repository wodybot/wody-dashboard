'use client';
import dynamic from 'next/dynamic';
import { useAutumnConfig } from './autumn-context';
import styles from './login-leaf-accent.module.css';

const OvalLeaf = dynamic(() => import('./leaf-assets').then((m) => m.OvalLeaf), { ssr: true });

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

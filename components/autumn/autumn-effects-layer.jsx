'use client';
import { useMemo } from 'react';
import styles from './autumn-effects.module.css';
import { MapleLeaf, OvalLeaf, OakLeaf, Acorn } from './leaf-assets';

const LEAF_TYPES = [MapleLeaf, OvalLeaf, OakLeaf, OakLeaf, Acorn];

const INTENSITY_OPACITY = { low: 0.7, medium: 0.85, high: 0.95 };
const DENSITY_COUNT = { low: 7, medium: 13, high: 20 };
const EDGE_BAND_VW = 9;

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildLeaves(count) {
  const rand = mulberry32(count * 97 + 13);
  const perSide = Math.ceil(count / 2);
  const laneStep = 1 / perSide;
  const leaves = [];
  for (let i = 0; i < count; i++) {
    const side = i % 2 === 0 ? 'left' : 'right';
    const lane = Math.floor(i / 2);
    const Leaf = LEAF_TYPES[Math.floor(rand() * LEAF_TYPES.length)];
    const edgeOffset = rand() * EDGE_BAND_VW;
    const size = 1.4 + rand() * 1.3;
    const fallDur = 13 + rand() * 11;
    const spinDur = 4 + rand() * 5;
    const laneDelay = laneStep * lane * fallDur;
    const delay = -((rand() * fallDur * 1.6) + laneDelay);
    const spinDelay = -(rand() * spinDur);
    const sway = (rand() * 0.5 + 0.35) * (rand() < 0.5 ? -1 : 1);
    const rotStart = Math.floor(rand() * 360);
    const staticTop = 4 + rand() * 88;
    const mobileOk = i % 3 !== 0;
    leaves.push({
      id: `leaf-${i}`, Leaf, side, edgeOffset, size, fallDur, spinDur, delay, spinDelay,
      sway, rotStart, staticTop, mobileOk,
    });
  }
  return leaves;
}

export default function AutumnEffectsLayer({ config }) {
  const density = config?.density || 'low';
  const intensity = config?.intensity || 'low';
  const showLeaves = config?.effects?.leaves !== false;
  const showShadows = config?.effects?.shadows !== false;
  const animate = config?.effects?.animations !== false;

  const count = DENSITY_COUNT[density] ?? DENSITY_COUNT.low;
  const opacity = INTENSITY_OPACITY[intensity] ?? 0.55;

  const leaves = useMemo(() => buildLeaves(count), [count]);

  if (!config?.enabled || !showLeaves) return null;

  return (
    <div className={styles.layer} aria-hidden="true">
      {leaves.map(({ id, Leaf, side, edgeOffset, size, fallDur, spinDur, delay, spinDelay, sway, rotStart, staticTop, mobileOk }) => (
        <div
          key={id}
          className={[
            styles.piece,
            animate ? styles.animated : '',
            showShadows ? '' : styles.noShadow,
            mobileOk ? '' : styles.mobileHidden,
          ].filter(Boolean).join(' ')}
          style={{
            [side]: `${edgeOffset}vw`,
            width: `${size}rem`,
            opacity,
            '--fallDur': `${fallDur}s`,
            '--spinDur': `${spinDur}s`,
            '--delay': `${delay}s`,
            '--spinDelay': `${spinDelay}s`,
            '--sway': sway,
            '--rStart': `${rotStart}deg`,
            '--staticTop': `${staticTop}%`,
          }}
        >
          <Leaf className="w-full h-auto" />
        </div>
      ))}
    </div>
  );
}

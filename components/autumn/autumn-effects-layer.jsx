'use client';
import { useMemo } from 'react';
import styles from './autumn-effects.module.css';
import { MapleLeaf, OvalLeaf, OakLeaf, Acorn } from './leaf-assets';

// Pool of pieces that make sense tumbling through the air (the twig
// cluster asset is intentionally excluded here, a branch "falling" reads
// as broken, not autumnal, it stays reserved for the static login accent).
const LEAF_TYPES = [MapleLeaf, OvalLeaf, OakLeaf, OakLeaf, Acorn];

// Bumped up from the previous 0.55/0.72/0.85: now that pieces stay out of
// the text column and dip *behind* content (see the layer's z-index in
// autumn-effects.module.css) instead of drawing on top of it, they can
// afford to be more vivid wherever they ARE visible without turning back
// into visual clutter over the copy.
const INTENSITY_OPACITY = { low: 0.7, medium: 0.85, high: 0.95 };
// How many pieces are in the air at once per density level. Kept modest on
// purpose: every piece is a single absolutely-positioned element animated
// with only `translate`/`rotate` (GPU-composited, no layout thrashing), so
// this scales fine, but "realistic" doesn't need to mean "cluttered".
const DENSITY_COUNT = { low: 7, medium: 13, high: 20 };
// Leaves live in a band hugging each viewport edge, anchored in vw (not
// as a % of page width) so the band stays a genuine "margin" regardless
// of how wide the centered content container is. Combined with the small
// sway amplitude in the CSS keyframes, a leaf's total horizontal excursion
// stays within roughly this band and never wanders into the text column.
const EDGE_BAND_VW = 9;

// Small deterministic PRNG (mulberry32) so the field of leaves looks
// randomly scattered but doesn't reshuffle/jump on every re-render, only
// when density actually changes (see useMemo below).
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
  // Pieces alternate left/right edge, and within each side are spread
  // across evenly-sized *vertical* lanes (via fall duration + negative
  // delay, not position) so a run of bad luck can't cluster several onto
  // the same side/timing and read as "stacked".
  const perSide = Math.ceil(count / 2);
  const laneStep = 1 / perSide;
  const leaves = [];
  for (let i = 0; i < count; i++) {
    const side = i % 2 === 0 ? 'left' : 'right';
    const lane = Math.floor(i / 2);
    const Leaf = LEAF_TYPES[Math.floor(rand() * LEAF_TYPES.length)];
    // Anchor within the edge band, never as a % of full width, so it
    // can't drift toward center on wide screens.
    const edgeOffset = rand() * EDGE_BAND_VW;
    const size = 1.4 + rand() * 1.3; // rem
    const fallDur = 13 + rand() * 11; // 13s - 24s, varied fall speeds
    const spinDur = 4 + rand() * 5; // independent tumble speed
    // Stagger start point by lane so pieces on the same side don't all
    // enter/exit together, in addition to the natural spread from varied
    // fallDur.
    const laneDelay = laneStep * lane * fallDur;
    const delay = -((rand() * fallDur * 1.6) + laneDelay);
    const spinDelay = -(rand() * spinDur);
    // Small amplitude, biased back toward the edge rather than a full
    // +/- swing, so the sway reads as a natural drift/tumble instead of
    // pushing the piece across the margin boundary into the text column.
    const sway = (rand() * 0.5 + 0.35) * (rand() < 0.5 ? -1 : 1);
    const rotStart = Math.floor(rand() * 360);
    const staticTop = 4 + rand() * 88; // resting spot for the no-animation fallback
    // Every third-ish piece drops out on narrow viewports, where the
    // margin band itself all but disappears, so mobile stays light
    // instead of stacking leaves onto the text.
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

  // Recomputed only when density changes, not on every parent re-render
  // (e.g. the panel's live-preview toggling other fields shouldn't reshuffle
  // leaves that are already mid-fall).
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
            // Anchored to whichever edge this piece belongs to, in vw,
            // this is what keeps it in the margin instead of the % lane
            // used previously.
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

// FILE: seasonal-effects-layer.jsx
// PUNE ÎN: components/seasonal/seasonal-effects-layer.jsx
// (fișier nou în proiectul wody-dashboard-main la această cale)

'use client';
import { useMemo } from 'react';
import styles from './seasonal-effects.module.css';
import { MapleLeaf, OvalLeaf, OakLeaf, Acorn } from '../autumn/leaf-assets';
import { DendriteSnowflake, PlateSnowflake, DustSnowflake } from './snow-assets';
import { Bat, Pumpkin, Ghost, Witch, Cauldron, Spider, CandyCorn } from './halloween-assets';

// One config object per season: which pieces fall, whether they also
// tumble (a bat endlessly cartwheeling reads wrong, so Halloween skips
// the spin keyframe, see .animatedNoSpin in the CSS module), and the
// size range in rem. Autumn reuses components/autumn/leaf-assets.jsx
// directly rather than a copy, so any future tweak to leaf art only
// needs to happen in one place. Winter mixes the two "hero" crystal
// shapes with a plainer dust flake at 2x the weight (DustSnowflake
// repeated), so most of the field is the small filler piece and the
// detailed dendrite/plate crystals stand out as occasional larger ones.
const SEASONS = {
  autumn: { pieces: [MapleLeaf, OvalLeaf, OakLeaf, OakLeaf, Acorn], spin: true, sizeRange: [1.4, 2.7], rotRange: [0, 360] },
  winter: { pieces: [DendriteSnowflake, PlateSnowflake, DustSnowflake, DustSnowflake, DustSnowflake], spin: true, sizeRange: [0.7, 2.1], rotRange: [0, 360] },
  // Halloween pieces have a real "up" (a ghost's face, a witch's hat), so
  // they start only slightly tilted (rotRange) and gently swing instead of
  // tumbling. layout: 'gutter' = they only fall down the empty side margins
  // (never across the text), one piece per lane, evenly spaced in time, so
  // they can't overlap each other or pop in/out mid-screen.
  halloween: { pieces: [Bat, Pumpkin, Ghost, Witch, Cauldron, Spider, CandyCorn], spin: false, sizeRange: [2, 3.2], rotRange: [-12, 12], layout: 'gutter' },
};

const INTENSITY_OPACITY = { low: 0.7, medium: 0.85, high: 0.95 };
// How many pieces are in the air at once per density level. Winter gets a
// noticeably higher count at the same density label: snow reads as snow
// when there's a lot of it, and each flake is small/cheap to render
// (still just one absolutely-positioned, transform-animated element, so
// this scales fine).
const DENSITY_COUNT = {
  autumn: { low: 7, medium: 13, high: 20 },
  winter: { low: 14, medium: 24, high: 36 },
  halloween: { low: 6, medium: 11, high: 16 },
};
const EDGE_BAND_VW = 9;

// Small deterministic PRNG (mulberry32) so the field looks randomly
// scattered but doesn't reshuffle/jump on every re-render, only when
// season or density actually changes (see useMemo below).
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildPieces(count, pieceTypes, sizeRange, rotRange) {
  const rand = mulberry32(count * 97 + 13);
  const perSide = Math.ceil(count / 2);
  const laneStep = 1 / perSide;
  const [minSize, maxSize] = sizeRange;
  const pieces = [];
  for (let i = 0; i < count; i++) {
    const side = i % 2 === 0 ? 'left' : 'right';
    const lane = Math.floor(i / 2);
    const Piece = pieceTypes[Math.floor(rand() * pieceTypes.length)];
    const edgeOffset = rand() * EDGE_BAND_VW;
    const size = minSize + rand() * (maxSize - minSize);
    const fallDur = 13 + rand() * 11;
    const spinDur = 4 + rand() * 5;
    const laneDelay = laneStep * lane * fallDur;
    const delay = -((rand() * fallDur * 1.6) + laneDelay);
    const spinDelay = -(rand() * spinDur);
    const sway = (rand() * 0.5 + 0.35) * (rand() < 0.5 ? -1 : 1);
    const rotStart = Math.round(rotRange[0] + rand() * (rotRange[1] - rotRange[0]));
    const staticTop = 4 + rand() * 88;
    const mobileOk = i % 3 !== 0;
    pieces.push({
      id: `piece-${i}`, Piece, side, edgeOffset, size, fallDur, spinDur, delay, spinDelay,
      sway, rotStart, staticTop, mobileOk,
    });
  }
  return pieces;
}

// Halloween layout. Every side gets its own lane list; all pieces on one
// side share the SAME fall duration and are spaced evenly in phase, so two
// pieces can never catch up with each other (no overlaps, ever), while a
// little jitter in phase/horizontal position keeps it from looking like a
// conveyor belt. Piece types come from a shuffled "bag" so the same type
// never shows up twice in a row.
function buildGutterPieces(count, pool, sizeRange, rotRange) {
  const rand = mulberry32(count * 131 + 7);
  const [minSize, maxSize] = sizeRange;
  const sideCount = [Math.ceil(count / 2), Math.floor(count / 2)];

  const makeSequence = (n) => {
    const seq = [];
    let bag = [];
    while (seq.length < n) {
      if (bag.length === 0) {
        bag = [...pool];
        for (let k = bag.length - 1; k > 0; k--) {
          const j = Math.floor(rand() * (k + 1));
          [bag[k], bag[j]] = [bag[j], bag[k]];
        }
        if (seq.length && bag[bag.length - 1] === seq[seq.length - 1]) bag.reverse();
      }
      seq.push(bag.pop());
    }
    return seq;
  };
  const sequences = [makeSequence(sideCount[0]), makeSequence(sideCount[1])];

  const pieces = [];
  for (let i = 0; i < count; i++) {
    const sideIdx = i % 2;
    const side = sideIdx === 0 ? 'left' : 'right';
    const lane = Math.floor(i / 2);
    const n = sideCount[sideIdx];
    const fallDur = sideIdx === 0 ? 26 : 31;
    const phase = (lane + 0.5 + sideIdx * 0.5 + (rand() - 0.5) * 0.24) / n;
    const spinDur = 4.5 + rand() * 3;
    pieces.push({
      id: `piece-${i}`,
      Piece: sequences[sideIdx][lane],
      side,
      size: minSize + rand() * (maxSize - minSize),
      pos: 0.12 + 0.76 * ((lane * 0.618 + sideIdx * 0.3 + rand() * 0.25) % 1),
      fallDur,
      spinDur,
      delay: -(phase * fallDur),
      spinDelay: -(rand() * spinDur),
      sway: (rand() * 0.5 + 0.5) * (rand() < 0.5 ? -1 : 1),
      rotStart: Math.round(rotRange[0] + rand() * (rotRange[1] - rotRange[0])),
      staticTop: Math.min(92, 2 + ((lane + 0.5 + sideIdx * 0.5) / n) * 88),
      mobileOk: lane % 2 === 0,
    });
  }
  return pieces;
}

export default function SeasonalEffectsLayer({ config }) {
  const season = SEASONS[config?.season] ? config.season : 'autumn';
  const seasonCfg = SEASONS[season];
  const density = config?.density || 'low';
  const intensity = config?.intensity || 'low';
  const showPieces = config?.effects?.particles !== false;
  const showShadows = config?.effects?.shadows !== false;
  const animate = config?.effects?.animations !== false;

  const count = DENSITY_COUNT[season][density] ?? DENSITY_COUNT[season].low;
  const opacity = INTENSITY_OPACITY[intensity] ?? 0.55;

  // Recomputed only when season/count actually change, not on every
  // parent re-render (e.g. the owner panel's live-preview toggling other
  // fields shouldn't reshuffle pieces already mid-fall).
  const isGutter = seasonCfg.layout === 'gutter';
  const pieces = useMemo(
    () => (isGutter
      ? buildGutterPieces(count, seasonCfg.pieces, seasonCfg.sizeRange, seasonCfg.rotRange)
      : buildPieces(count, seasonCfg.pieces, seasonCfg.sizeRange, seasonCfg.rotRange)),
    [count, season, seasonCfg, isGutter],
  );

  if (!config?.enabled || !showPieces) return null;

  const animatedClass = seasonCfg.spin ? styles.animated : styles.animatedNoSpin;

  return (
    <div className={[styles.layer, isGutter ? styles.gutter : ''].filter(Boolean).join(' ')} aria-hidden="true">
      {pieces.map(({ id, Piece, side, edgeOffset, size, pos, fallDur, spinDur, delay, spinDelay, sway, rotStart, staticTop, mobileOk }) => (
        <div
          key={id}
          className={[
            styles.piece,
            isGutter ? styles[side] : '',
            animate ? animatedClass : '',
            showShadows ? '' : styles.noShadow,
            mobileOk ? '' : styles.mobileHidden,
          ].filter(Boolean).join(' ')}
          style={{
            ...(isGutter
              ? { '--w': `${size}rem`, '--pos': pos, '--op': opacity }
              : { [side]: `${edgeOffset}vw`, width: `${size}rem`, opacity }),
            '--fallDur': `${fallDur}s`,
            '--spinDur': `${spinDur}s`,
            '--delay': `${delay}s`,
            '--spinDelay': `${spinDelay}s`,
            '--sway': sway,
            '--rStart': `${rotStart}deg`,
            '--staticTop': `${staticTop}%`,
          }}
        >
          <Piece className="w-full h-auto" />
        </div>
      ))}
    </div>
  );
}

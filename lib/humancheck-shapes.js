import { newPuzzleSpec, sealPuzzle, SHAPES } from './humancheck.js';

const SHAPES_ALL = SHAPES;

const r1 = (n) => Math.round(n * 10) / 10;

function poly(points) {
  return `M${points.map(([x, y]) => `${r1(x)} ${r1(y)}`).join('L')}Z`;
}
function ngon(n, rad, rot, cx, cy) {
  const pts = [];
  for (let i = 0; i < n; i += 1) {
    const a = (rot * Math.PI) / 180 + (i * 2 * Math.PI) / n - Math.PI / 2;
    pts.push([cx + rad * Math.cos(a), cy + rad * Math.sin(a)]);
  }
  return pts;
}
function star(rad, rot, cx, cy) {
  const pts = [];
  for (let i = 0; i < 10; i += 1) {
    const a = (rot * Math.PI) / 180 + (i * Math.PI) / 5 - Math.PI / 2;
    const rr = i % 2 === 0 ? rad : rad * 0.45;
    pts.push([cx + rr * Math.cos(a), cy + rr * Math.sin(a)]);
  }
  return pts;
}
function cross(rad, rot, cx, cy) {
  const t = rad * 0.36;
  const base = [[-t, -rad], [t, -rad], [t, -t], [rad, -t], [rad, t], [t, t], [t, rad], [-t, rad], [-t, t], [-rad, t], [-rad, -t], [-t, -t]];
  const a = (rot * Math.PI) / 180;
  return base.map(([x, y]) => [cx + x * Math.cos(a) - y * Math.sin(a), cy + x * Math.sin(a) + y * Math.cos(a)]);
}

const SAMPLES = 56;

function resample(pts, n) {
  const closed = [...pts, pts[0]];
  const seg = [];
  let total = 0;
  for (let i = 0; i < closed.length - 1; i += 1) {
    const l = Math.hypot(closed[i + 1][0] - closed[i][0], closed[i + 1][1] - closed[i][1]);
    seg.push(l); total += l;
  }
  const out = [];
  for (let k = 0; k < n; k += 1) {
    let d = (k / n) * total;
    let i = 0;
    while (i < seg.length - 1 && d > seg[i]) { d -= seg[i]; i += 1; }
    const f = seg[i] ? d / seg[i] : 0;
    out.push([closed[i][0] + (closed[i + 1][0] - closed[i][0]) * f, closed[i][1] + (closed[i + 1][1] - closed[i][1]) * f]);
  }
  return out;
}

function jitterOf(seed) {
  let x = (seed || 1) >>> 0;
  return () => { x = (x * 1664525 + 1013904223) >>> 0; return (x / 4294967296 - 0.5) * 2.2; };
}

export function shapePath(t) {
  const cx = 50 + t.dx;
  const cy = 50 + t.dy;
  const rad = t.size * 0.62;
  let pts;
  switch (t.shape) {
    case 'circle': pts = Array.from({ length: SAMPLES }, (_, i) => [cx + rad * Math.cos((i / SAMPLES) * 2 * Math.PI), cy + rad * Math.sin((i / SAMPLES) * 2 * Math.PI)]); break;
    case 'triangle': pts = resample(ngon(3, rad * 1.1, t.rot, cx, cy), SAMPLES); break;
    case 'square': pts = resample(ngon(4, rad * 1.15, t.rot + 45, cx, cy), SAMPLES); break;
    case 'pentagon': pts = resample(ngon(5, rad * 1.08, t.rot, cx, cy), SAMPLES); break;
    case 'star': pts = resample(star(rad * 1.2, t.rot, cx, cy), SAMPLES); break;
    default: pts = resample(cross(rad * 1.05, t.rot, cx, cy), SAMPLES);
  }
  const j = jitterOf(t.seed);
  return poly(pts.map(([x, y]) => [x + j(), y + j()]));
}

function noise(seed) {
  let x = seed || 1;
  const rnd = () => { x = (x * 1664525 + 1013904223) >>> 0; return x / 4294967296; };
  const out = [];
  for (let i = 0; i < 7; i += 1) out.push(`M${r1(rnd() * 100)} ${r1(rnd() * 100)}L${r1(rnd() * 100)} ${r1(rnd() * 100)}`);
  return out.join('');
}

export function buildPuzzle(challenge, round = 0, total = 1) {
  const spec = newPuzzleSpec();
  const token = sealPuzzle(challenge, spec.mask, round, total);
  return {
    token, round: round + 1, total,
    sample: { d: shapePath(spec.sample), hue: spec.sample.hue },
    tiles: spec.tiles.map((t) => ({
      d: shapePath(t), hue: t.hue, n: noise(t.seed),
      g: shapePath({ ...t, shape: SHAPES_ALL[(t.seed >>> 3) % SHAPES_ALL.length], dx: -t.dx, dy: -t.dy, rot: t.rot + 90, size: t.size + 8, seed: t.seed + 7 }),
    })),
  };
}

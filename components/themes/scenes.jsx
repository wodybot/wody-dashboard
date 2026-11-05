// Environment Engine: neon and atmospheric scenes drawn as small SVG layers. Every colour comes from the theme palette, so a server can
// recolour a scene completely. Procedural and tiny; a real background image, when one is uploaded, is drawn under these layers.
// Nothing here is a character or an animal: only light, sky, sea, city, planets and plants.
import { useMemo } from 'react';

function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
const f = (n) => Number(n.toFixed(1));

function ridge(seed, base, amp, step) {
  const r = rng(seed); let d = `M0 900 L0 ${base}`;
  for (let x = step; x <= 1600 + step; x += step) d += ` L${x} ${f(base - r() * amp)}`;
  return `${d} L1600 900 Z`;
}
function softRidge(seed, base, amp, step) {
  const r = rng(seed); const pts = []; for (let x = 0; x <= 1600 + step; x += step) pts.push([x, base - r() * amp]);
  let d = `M0 900 L${pts[0][0]} ${f(pts[0][1])}`;
  for (let i = 1; i < pts.length; i += 1) { const [x0, y0] = pts[i - 1]; const [x1, y1] = pts[i]; d += ` Q${f((x0 + x1) / 2)} ${f(Math.min(y0, y1) - 20)} ${x1} ${f(y1)}`; }
  return `${d} L1600 900 Z`;
}
function stars(seed, n, ymax = 620) {
  const r = rng(seed); const out = [];
  for (let i = 0; i < n; i += 1) out.push(<circle key={i} cx={f(r() * 1600)} cy={f(r() * ymax)} r={f(0.5 + r() * 1.5)} className="wt-star" style={{ animationDelay: `${f(r() * 6)}s` }} opacity={f(0.35 + r() * 0.65)} />);
  return out;
}
function skyline(seed, color, windows, y0 = 640) {
  const r = rng(seed); const bars = []; const lights = []; let x = 0; let i = 0;
  while (x < 1600) {
    const w = 38 + r() * 70; const h = 60 + r() * 190; bars.push(<rect key={`b${i}`} x={f(x)} y={f(y0 - h)} width={f(w)} height={f(h + 260)} fill={color} />);
    for (let k = 0; k < 7; k += 1) if (r() < 0.5) lights.push(<rect key={`l${i}-${k}`} x={f(x + 6 + r() * (w - 14))} y={f(y0 - h + 10 + r() * (h - 16))} width="3" height="4" fill={windows} className="wt-window" style={{ animationDelay: `${f(r() * 5)}s` }} />);
    x += w + 4 + r() * 14; i += 1;
  }
  return <g>{bars}{lights}</g>;
}
function palm(x, y, scale, flip, color) {
  const sx = flip ? -scale : scale;
  const fronds = [[-170, -40], [-130, -90], [-70, -120], [0, -130], [70, -118], [130, -88], [170, -38]];
  return (
    <g transform={`translate(${x} ${y}) scale(${sx} ${scale})`} className="wt-sway-slow" style={{ transformOrigin: `${x}px ${y}px` }}>
      <path d="M0 0 C 10 -120 -18 -230 6 -330 L 20 -330 C 0 -230 28 -120 22 0 Z" fill={color} />
      {fronds.map(([dx, dy], i) => <path key={i} d={`M10 -330 Q ${dx * 0.5} ${dy * 0.9 - 340} ${dx} ${dy - 300} Q ${dx * 0.45} ${dy * 0.6 - 322} 14 -322 Z`} fill={color} />)}
    </g>
  );
}
function sunStripes(cx, cy, r, count, id) {
  const out = [];
  for (let i = 0; i < count; i += 1) { const y = cy + r * (0.05 + (i / count) * 0.95); const h = 3 + (i / count) * 14; out.push(<rect key={i} x={cx - r - 4} y={f(y)} width={r * 2 + 8} height={f(h)} fill="#000" />); }
  return <mask id={id} maskUnits="userSpaceOnUse" x={cx - r - 8} y={cy - r - 8} width={r * 2 + 16} height={r * 2 + 16}><rect x={cx - r - 8} y={cy - r - 8} width={r * 2 + 16} height={r * 2 + 16} fill="#fff" />{out}</mask>;
}

const hex = (h, a) => `${h}${Math.round(Math.min(1, Math.max(0, a)) * 255).toString(16).padStart(2, '0')}`;

const SKY = {
  miami: (p) => `linear-gradient(180deg, #08031a 0%, ${p.secondary} 52%, ${p.primary} 92%, ${p.accent} 118%)`,
  synthwave: (p) => `linear-gradient(180deg, #05010f 0%, ${p.secondary} 55%, ${hex(p.primary, 0.85)} 100%)`,
  aurora: (p) => `linear-gradient(180deg, #02050c 0%, #07142a 55%, ${hex(p.secondary, 0.9)} 125%)`,
  cosmos: (p) => `radial-gradient(120% 90% at 50% 100%, ${hex(p.secondary, 0.9)} 0%, #060414 60%, #02010a 100%)`,
  sakura: (p) => `linear-gradient(180deg, #120716 0%, ${hex(p.secondary, 0.95)} 58%, ${hex(p.primary, 0.55)} 118%)`,
  ocean: (p) => `linear-gradient(180deg, #020813 0%, #06203a 52%, ${hex(p.secondary, 0.95)} 100%)`,
  stadium: (p) => `linear-gradient(180deg, #03060d 0%, ${hex(p.secondary, 0.95)} 70%, ${hex(p.primary, 0.4)} 120%)`,
  taxi: (p) => `linear-gradient(180deg, #05050c 0%, ${hex(p.secondary, 0.9)} 70%, ${hex(p.accent, 0.35)} 118%)`,
  ring: (p) => `radial-gradient(90% 80% at 50% 0%, ${hex(p.secondary, 0.95)} 0%, #05040a 70%)`,
  racing: (p) => `linear-gradient(180deg, #02030a 0%, ${hex(p.secondary, 0.9)} 62%, ${hex(p.primary, 0.5)} 100%)`,
  arcade: (p) => `radial-gradient(100% 100% at 50% 40%, ${hex(p.secondary, 0.9)} 0%, #04030c 100%)`,
  court: (p) => `linear-gradient(180deg, #05060c 0%, ${hex(p.secondary, 0.95)} 70%, #0a0a12 100%)`,
  lofi: (p) => `linear-gradient(180deg, ${hex(p.secondary, 0.95)} 0%, #07080f 100%)`,
  festival: (p) => `radial-gradient(110% 90% at 50% 20%, ${hex(p.secondary, 0.95)} 0%, #05040a 75%)`,
  cyberpunk: (p) => `linear-gradient(180deg, #04030c 0%, ${hex(p.secondary, 0.9)} 65%, ${hex(p.primary, 0.45)} 115%)`,
  plain: (p) => `linear-gradient(${p.gradient.angle}deg, ${p.gradient.from}, ${p.gradient.to})`,
};

function Miami({ p, animate }) {
  const sunMask = 'wt-sunmask-miami';
  return (
    <svg className="wt-scene-svg" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMax slice" focusable="false">
      <defs>
        <linearGradient id="wt-sun-m" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={p.accent} /><stop offset="1" stopColor={p.primary} /></linearGradient>
        <radialGradient id="wt-halo-m"><stop offset="0" stopColor={hex(p.accent, 0.55)} /><stop offset="1" stopColor={hex(p.accent, 0)} /></radialGradient>
        <linearGradient id="wt-sea-m" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={hex(p.primary, 0.55)} /><stop offset="1" stopColor="#07020f" /></linearGradient>
        {sunStripes(800, 430, 230, 9, sunMask)}
      </defs>
      <circle cx="800" cy="430" r="460" fill="url(#wt-halo-m)" className={animate ? 'wt-pulse' : ''} />
      <circle cx="800" cy="430" r="230" fill="url(#wt-sun-m)" mask={`url(#${sunMask})`} />
      <g className="wt-layer wt-layer-0">{skyline(7, '#12041f', p.accent, 640)}</g>
      <rect x="0" y="640" width="1600" height="260" fill="url(#wt-sea-m)" />
      <g className={animate ? 'wt-shimmer' : ''} stroke={p.accent} strokeLinecap="round" opacity="0.55">
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => <line key={i} x1={800 - 150 + i * 6} x2={800 + 150 - i * 6} y1={668 + i * 26} y2={668 + i * 26} strokeWidth={2 + i * 0.6} />)}
      </g>
      <g className="wt-layer wt-layer-1">{palm(150, 900, 1.25, false, '#07010d')}{palm(1470, 900, 1.35, true, '#07010d')}{palm(330, 900, 0.8, false, '#0b0213')}</g>
    </svg>
  );
}

function Synthwave({ p, animate }) {
  const sunMask = 'wt-sunmask-s';
  const lines = []; for (let i = -16; i <= 16; i += 1) lines.push(<line key={`v${i}`} x1={800 + i * 38} y1="560" x2={800 + i * 260} y2="900" />);
  return (
    <svg className="wt-scene-svg" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMax slice" focusable="false">
      <defs>
        <linearGradient id="wt-sun-s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={p.accent} /><stop offset="1" stopColor={p.primary} /></linearGradient>
        <linearGradient id="wt-floor-s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={hex(p.secondary, 0.95)} /><stop offset="1" stopColor="#04010a" /></linearGradient>
        {sunStripes(800, 360, 200, 8, sunMask)}
      </defs>
      <g>{stars(3, 60, 380)}</g>
      <circle cx="800" cy="360" r="200" fill="url(#wt-sun-s)" mask={`url(#${sunMask})`} />
      <path d={ridge(61, 560, 110, 80)} fill="#07010f" stroke={p.primary} strokeWidth="1.5" opacity="0.9" />
      <rect x="0" y="560" width="1600" height="340" fill="url(#wt-floor-s)" />
      <g stroke={p.primary} strokeWidth="1.4" opacity="0.8" filter="none">{lines}</g>
      <g className={animate ? 'wt-grid-move' : ''} stroke={p.accent} strokeWidth="1.4" opacity="0.8">
        {[0, 1, 2, 3, 4, 5, 6].map((i) => { const y = 560 + (i * i * 9) + i * 8; return <line key={i} x1="0" x2="1600" y1={y} y2={y} />; })}
      </g>
      <rect x="0" y="556" width="1600" height="6" fill={p.accent} opacity="0.7" />
    </svg>
  );
}

function Aurora({ p, animate }) {
  return (
    <svg className="wt-scene-svg" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMax slice" focusable="false">
      <defs>
        <linearGradient id="wt-au1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={hex(p.primary, 0)} /><stop offset="0.5" stopColor={hex(p.primary, 0.55)} /><stop offset="1" stopColor={hex(p.primary, 0)} /></linearGradient>
        <linearGradient id="wt-au2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={hex(p.accent, 0)} /><stop offset="0.5" stopColor={hex(p.accent, 0.45)} /><stop offset="1" stopColor={hex(p.accent, 0)} /></linearGradient>
        <filter id="wt-blur-a" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="22" /></filter>
      </defs>
      <g>{stars(9, 120, 520)}</g>
      <g filter="url(#wt-blur-a)" className={animate ? 'wt-aurora-sway' : ''}>
        <path d="M-100 360 C 200 120 420 460 700 220 S 1200 160 1700 340 L1700 520 C 1300 360 1000 520 700 400 S 200 560 -100 480 Z" fill="url(#wt-au1)" />
        <path d="M-100 260 C 260 60 520 360 820 140 S 1300 120 1700 240 L1700 380 C 1300 240 1000 400 780 300 S 300 420 -100 360 Z" fill="url(#wt-au2)" opacity="0.8" />
      </g>
      <path d={softRidge(81, 640, 130, 120)} fill="#040a14" />
      <path d={softRidge(82, 740, 100, 100)} fill="#02060d" />
      <rect x="0" y="800" width="1600" height="100" fill={hex(p.primary, 0.12)} />
    </svg>
  );
}

function Cosmos({ p, animate }) {
  return (
    <svg className="wt-scene-svg" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" focusable="false">
      <defs>
        <radialGradient id="wt-neb1"><stop offset="0" stopColor={hex(p.primary, 0.5)} /><stop offset="1" stopColor={hex(p.primary, 0)} /></radialGradient>
        <radialGradient id="wt-neb2"><stop offset="0" stopColor={hex(p.accent, 0.35)} /><stop offset="1" stopColor={hex(p.accent, 0)} /></radialGradient>
        <radialGradient id="wt-neb3"><stop offset="0" stopColor={hex(p.secondary, 0.8)} /><stop offset="1" stopColor={hex(p.secondary, 0)} /></radialGradient>
        <radialGradient id="wt-planet" cx="0.35" cy="0.3"><stop offset="0" stopColor={p.accent} /><stop offset="0.6" stopColor={p.primary} /><stop offset="1" stopColor="#0a0418" /></radialGradient>
      </defs>
      <circle cx="380" cy="300" r="520" fill="url(#wt-neb1)" className={animate ? 'wt-pulse' : ''} />
      <circle cx="1240" cy="560" r="560" fill="url(#wt-neb3)" />
      <circle cx="900" cy="220" r="380" fill="url(#wt-neb2)" />
      <g>{stars(5, 240, 900)}</g>
      <g className={animate ? 'wt-float-slow' : ''}>
        <ellipse cx="1190" cy="250" rx="190" ry="46" fill="none" stroke={hex(p.accent, 0.5)} strokeWidth="6" transform="rotate(-18 1190 250)" />
        <circle cx="1190" cy="250" r="96" fill="url(#wt-planet)" />
        <path d="M1000 278 A 190 46 0 0 0 1380 222" fill="none" stroke={hex(p.accent, 0.75)} strokeWidth="6" transform="rotate(-18 1190 250)" />
      </g>
      <circle cx="260" cy="640" r="34" fill="url(#wt-planet)" opacity="0.85" />
      {animate ? <line x1="-40" y1="80" x2="140" y2="160" stroke={p.text} strokeWidth="2" strokeLinecap="round" className="wt-shooting" /> : null}
    </svg>
  );
}

function Sakura({ p, animate }) {
  const r = rng(77); const blossoms = [];
  for (let i = 0; i < 70; i += 1) { const t = r(); const x = 40 + t * 520; const y = 40 + Math.sin(t * 3.2) * 90 + r() * 120; blossoms.push(<circle key={i} cx={f(x)} cy={f(y)} r={f(6 + r() * 12)} fill={p.primary} opacity={f(0.45 + r() * 0.45)} />); }
  const r2 = rng(78); const right = [];
  for (let i = 0; i < 50; i += 1) { const t = r2(); const x = 1200 + t * 400; const y = 30 + Math.cos(t * 3) * 70 + r2() * 110; right.push(<circle key={i} cx={f(x)} cy={f(y)} r={f(6 + r2() * 11)} fill={p.accent} opacity={f(0.4 + r2() * 0.45)} />); }
  return (
    <svg className="wt-scene-svg" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMax slice" focusable="false">
      <defs><radialGradient id="wt-moon-k"><stop offset="0" stopColor="#fff7fb" /><stop offset="0.7" stopColor={p.accent} /><stop offset="1" stopColor={hex(p.accent, 0)} /></radialGradient></defs>
      <circle cx="1000" cy="260" r="200" fill="url(#wt-moon-k)" opacity="0.35" className={animate ? 'wt-pulse' : ''} />
      <circle cx="1000" cy="260" r="96" fill="#fff4f8" opacity="0.92" />
      <g className={animate ? 'wt-sway-slow' : ''} style={{ transformOrigin: '0px 0px' }}>
        <path d="M-20 140 C 180 120 300 200 560 120 L 560 134 C 320 214 190 140 -20 160 Z" fill="#12050f" />
        <path d="M1620 120 C 1420 110 1360 180 1190 110 L 1190 124 C 1370 196 1430 128 1620 138 Z" fill="#12050f" />
        <g>{blossoms}</g><g>{right}</g>
      </g>
      <path d={softRidge(91, 700, 120, 140)} fill="#12061a" />
      <path d={softRidge(92, 790, 90, 120)} fill="#0b0310" />
    </svg>
  );
}

function Ocean({ p, animate }) {
  const wave = (y, amp, color, dur, delay = 0) => {
    let d = `M-200 ${y}`; for (let x = -200; x <= 1800; x += 100) d += ` Q ${x + 50} ${y - amp} ${x + 100} ${y}`;
    return <path d={`${d} L1800 900 L-200 900 Z`} fill={color} className={animate ? 'wt-wave' : ''} style={{ animationDuration: `${dur}s`, animationDelay: `${delay}s` }} />;
  };
  return (
    <svg className="wt-scene-svg" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMax slice" focusable="false">
      <defs><radialGradient id="wt-moon-o"><stop offset="0" stopColor="#f4fbff" /><stop offset="0.65" stopColor={p.accent} /><stop offset="1" stopColor={hex(p.accent, 0)} /></radialGradient></defs>
      <g>{stars(13, 110, 420)}</g>
      <circle cx="1120" cy="250" r="190" fill="url(#wt-moon-o)" opacity="0.3" className={animate ? 'wt-pulse' : ''} />
      <circle cx="1120" cy="250" r="82" fill="#f4fbff" opacity="0.94" />
      <rect x="0" y="470" width="1600" height="430" fill={hex(p.secondary, 0.95)} />
      <g stroke={p.accent} strokeLinecap="round" opacity="0.6" className={animate ? 'wt-shimmer' : ''}>
        {[0, 1, 2, 3, 4, 5].map((i) => <line key={i} x1={1120 - 90 + i * 8} x2={1120 + 90 - i * 8} y1={500 + i * 34} y2={500 + i * 34} strokeWidth={2 + i * 0.7} />)}
      </g>
      {wave(560, 26, hex(p.primary, 0.22), 14)}
      {wave(640, 34, hex(p.primary, 0.3), 11, -3)}
      {wave(730, 44, hex(p.secondary, 0.95), 9, -5)}
      {wave(820, 50, '#020813', 7, -2)}
    </svg>
  );
}

// ---- sport, street and entertainment scenes: objects and light only (no people, no animals)
const SVG = ({ children }) => <svg className="wt-scene-svg" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMax slice" focusable="false">{children}</svg>;

function beam(x, y, spread, len, color, a, key) {
  return <polygon key={key} points={`${x - 6},${y} ${x + 6},${y} ${x + spread},${y + len} ${x - spread},${y + len}`} fill={hex(color, a)} />;
}
function floodlight(x, y, p, h = 250) {
  const lamps = []; for (let r = 0; r < 3; r += 1) for (let c = 0; c < 4; c += 1) lamps.push(<circle key={`${r}${c}`} cx={x - 33 + c * 22} cy={y - h - 30 + r * 22} r="8" fill="#fff" />);
  return <g><rect x={x - 5} y={y - h} width="10" height={h} fill="#0a0e18" /><rect x={x - 46} y={y - h - 46} width="92" height="70" rx="6" fill="#0a0e18" />{lamps}<circle cx={x} cy={y - h - 10} r="90" fill={hex(p.accent, 0.22)} className="wt-pulse" /></g>;
}

function Stadium({ p, animate }) {
  const stripes = []; for (let i = 0; i < 10; i += 1) { const y0 = 560 + i * i * 3.4 + i * 10; const y1 = 560 + (i + 1) * (i + 1) * 3.4 + (i + 1) * 10; stripes.push(<rect key={i} x="0" y={f(y0)} width="1600" height={f(y1 - y0 + 1)} fill={i % 2 ? hex(p.primary, 0.5) : hex(p.primary, 0.34)} />); }
  const crowd = []; const r = rng(31); for (let i = 0; i < 90; i += 1) crowd.push(<rect key={i} x={f(r() * 1600)} y={f(430 + r() * 110)} width="3" height="3" fill="#fff" className="wt-window" style={{ animationDelay: `${f(r() * 5)}s` }} />);
  return (
    <SVG>
      <defs><linearGradient id="wt-bm-st" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={hex(p.accent, 0.5)} /><stop offset="1" stopColor={hex(p.accent, 0)} /></linearGradient></defs>
      <g>{stars(41, 50, 280)}</g>
      <path d="M0 540 L0 430 Q 400 380 800 400 Q 1200 380 1600 430 L1600 540 Z" fill="#0a0e18" />
      <g>{crowd}</g>
      {stripes}
      <g stroke={hex('#ffffff', 0.7)} strokeWidth="3" fill="none"><rect x="260" y="610" width="1080" height="250" rx="2" /><ellipse cx="800" cy="735" rx="130" ry="46" /><line x1="800" y1="610" x2="800" y2="860" /></g>
      <g className={animate ? 'wt-beams' : ''}>{[[250, 0.18], [560, 0.14], [1040, 0.14], [1350, 0.18]].map(([x, a], i) => beam(x, 190, 190, 520, p.accent, a, i))}</g>
      {floodlight(250, 540, p)}{floodlight(560, 520, p, 210)}{floodlight(1040, 520, p, 210)}{floodlight(1350, 540, p)}
      <g transform="translate(1180 770)"><circle r="26" fill="#f5f5f5" /><path d="M0 -10 L10 -3 L6 9 L-6 9 L-10 -3 Z" fill="#111" /><ellipse cx="0" cy="30" rx="30" ry="6" fill="#000" opacity="0.35" /></g>
      <g stroke="#fff" strokeWidth="5" fill="none" opacity="0.85"><path d="M370 700 L370 640 L470 640 L470 700" /><path d="M1130 700 L1130 640 L1230 640 L1230 700" /></g>
    </SVG>
  );
}

function Taxi({ p, animate }) {
  const lamps = []; for (let i = 0; i < 6; i += 1) lamps.push(<g key={i}><rect x={120 + i * 270} y="330" width="6" height="330" fill="#0a0a12" /><circle cx={123 + i * 270} cy="326" r="60" fill={hex(p.accent, 0.25)} className="wt-pulse" /><circle cx={123 + i * 270} cy="326" r="9" fill={p.accent} /></g>);
  const dash = []; for (let i = 0; i < 7; i += 1) dash.push(<polygon key={i} points={`${800 - 5 - i * 4},${690 + i * 28} ${800 + 5 + i * 4},${690 + i * 28} ${800 + 9 + i * 5},${704 + i * 30} ${800 - 9 - i * 5},${704 + i * 30}`} fill={hex(p.accent, 0.8)} />);
  return (
    <SVG>
      <g>{stars(5, 40, 200)}</g>
      <g className="wt-layer wt-layer-0">{skyline(12, '#0a0a14', p.primary, 640)}</g>
      <rect x="0" y="640" width="1600" height="260" fill="#0b0b14" />
      <rect x="0" y="640" width="1600" height="16" fill={hex(p.primary, 0.5)} />
      {lamps}
      <g className={animate ? 'wt-shimmer' : ''}>{dash}</g>
      <g transform="translate(1010 650)">
        <path d="M0 150 L0 100 Q 6 78 60 74 L110 30 Q 125 18 170 18 L260 18 Q 300 20 316 60 L350 76 Q 372 84 372 108 L372 150 Z" fill={p.primary} />
        <path d="M120 40 L168 28 L196 28 L196 72 L100 72 Z M214 28 L262 28 Q 290 30 300 70 L214 72 Z" fill="#0b0f1a" opacity="0.88" />
        <rect x="168" y="-6" width="64" height="22" rx="5" fill={p.accent} className="wt-pulse" /><rect x="168" y="-6" width="64" height="22" rx="5" fill={hex(p.accent, 0.35)} transform="translate(0 0) scale(1.15)" style={{ transformOrigin: '200px 5px' }} />
        <g fill="#0b0f1a">{[0, 1, 2, 3, 4, 5, 6, 7].map((i) => <rect key={i} x={20 + i * 40} y="104" width="20" height="14" fill={i % 2 ? '#0b0f1a' : '#fff'} />)}</g>
        <circle cx="82" cy="152" r="32" fill="#06060b" /><circle cx="82" cy="152" r="14" fill="#555" /><circle cx="290" cy="152" r="32" fill="#06060b" /><circle cx="290" cy="152" r="14" fill="#555" />
        <polygon points="372,104 520,150 372,150" fill={hex(p.accent, 0.3)} /><circle cx="368" cy="106" r="8" fill="#fff" />
      </g>
    </SVG>
  );
}

function Ring({ p, animate }) {
  const rope = (c, o) => <g key={c} stroke={c} strokeWidth="9" strokeLinecap="round" fill="none"><path d={`M${360 - o * 10} ${520 + o * 46} L${1240 + o * 10} ${520 + o * 46}`} /><path d={`M${360 - o * 10} ${520 + o * 46} L${190 - o * 24} ${700 + o * 64}`} opacity="0.7" /><path d={`M${1240 + o * 10} ${520 + o * 46} L${1410 + o * 24} ${700 + o * 64}`} opacity="0.7" /></g>;
  return (
    <SVG>
      <g>{stars(19, 30, 200)}</g>
      <g className={animate ? 'wt-beams' : ''}>{[[420, 0.2], [800, 0.26], [1180, 0.2]].map(([x, a], i) => beam(x, 0, 230, 760, p.accent, a, i))}</g>
      <polygon points="330,560 1270,560 1500,830 100,830" fill={hex(p.secondary, 0.95)} />
      <ellipse cx="800" cy="720" rx="340" ry="52" fill="none" stroke={hex(p.primary, 0.6)} strokeWidth="6" />
      <polygon points="330,560 1270,560 1500,830 100,830" fill="none" stroke="#000" strokeOpacity="0.3" strokeWidth="2" />
      {[3, 2, 1].map((o, i) => rope([p.primary, '#f1f1f1', p.accent][i], 3 - o))}
      <rect x="338" y="440" width="26" height="130" rx="6" fill={p.primary} /><rect x="1236" y="440" width="26" height="130" rx="6" fill={p.primary} />
      <rect x="96" y="610" width="40" height="230" rx="8" fill={hex(p.primary, 0.9)} /><rect x="1464" y="610" width="40" height="230" rx="8" fill={hex(p.primary, 0.9)} />
      <circle cx="800" cy="40" r="22" fill="#fff" /><circle cx="800" cy="40" r="90" fill={hex(p.accent, 0.3)} className="wt-pulse" />
    </SVG>
  );
}

function Racing({ p, animate }) {
  const kerbL = []; const kerbR = []; for (let i = 0; i < 12; i += 1) { const y0 = 470 + i * i * 2.6 + i * 6; const y1 = 470 + (i + 1) * (i + 1) * 2.6 + (i + 1) * 6; const k = 0.8 + i * 0.07; const col = i % 2 ? p.primary : '#f4f4f4';
    kerbL.push(<polygon key={`l${i}`} points={`${800 - 90 * k},${y0} ${800 - 120 * k},${y0} ${800 - 120 * (k + 0.07)},${y1} ${800 - 90 * (k + 0.07)},${y1}`} fill={col} />);
    kerbR.push(<polygon key={`r${i}`} points={`${800 + 90 * k},${y0} ${800 + 120 * k},${y0} ${800 + 120 * (k + 0.07)},${y1} ${800 + 90 * (k + 0.07)},${y1}`} fill={col} />); }
  const dash = []; for (let i = 0; i < 8; i += 1) { const y0 = 480 + i * i * 3.2 + i * 10; dash.push(<polygon key={i} points={`${800 - 3 - i},${y0} ${800 + 3 + i},${y0} ${800 + 4 + i * 1.7},${y0 + 14 + i * 3} ${800 - 4 - i * 1.7},${y0 + 14 + i * 3}`} fill="#f4f4f4" opacity="0.9" />); }
  return (
    <SVG>
      <g>{stars(23, 60, 300)}</g>
      <rect x="0" y="440" width="1600" height="460" fill="#08090f" />
      <rect x="0" y="436" width="1600" height="8" fill={hex(p.accent, 0.6)} />
      <polygon points="700,440 900,440 1500,900 100,900" fill="#232637" /><polygon points="700,440 900,440 1500,900 100,900" fill={hex(p.primary, 0.1)} />
      <g className={animate ? 'wt-shimmer' : ''}>{kerbL}{kerbR}{dash}</g>
      <rect x="360" y="170" width="880" height="26" rx="6" fill="#0c0e16" /><rect x="372" y="190" width="14" height="260" fill="#0c0e16" /><rect x="1214" y="190" width="14" height="260" fill="#0c0e16" />
      {[0, 1, 2, 3, 4].map((i) => <g key={i}><circle cx={520 + i * 140} cy="232" r="34" fill="#150808" /><circle cx={520 + i * 140} cy="232" r="22" fill={p.accent} className="wt-pulse" style={{ animationDelay: `${i * 0.5}s` }} /><circle cx={520 + i * 140} cy="232" r="70" fill={hex(p.accent, 0.18)} /></g>)}
    </SVG>
  );
}

function Arcade({ p, animate }) {
  const cols = [p.primary, p.accent, p.secondary, '#ffffff']; const r = rng(77); const blocks = [];
  for (let i = 0; i < 26; i += 1) { const x = f(r() * 1500); const y = f(40 + r() * 760); const s = 28 + Math.floor(r() * 3) * 10; const c = cols[i % 4]; const shape = Math.floor(r() * 3);
    const cells = shape === 0 ? [[0, 0], [1, 0], [2, 0], [1, 1]] : shape === 1 ? [[0, 0], [1, 0], [0, 1], [1, 1]] : [[0, 0], [0, 1], [0, 2], [1, 2]];
    blocks.push(<g key={i} className="wt-float-slow" style={{ animationDelay: `${f(r() * 8)}s`, animationDuration: `${10 + Math.floor(r() * 8)}s` }} opacity={f(0.35 + r() * 0.5)}>{cells.map(([cx, cy], k) => <rect key={k} x={x + cx * s} y={y + cy * s} width={s - 3} height={s - 3} fill={c} />)}</g>); }
  const grid = []; for (let i = 0; i <= 40; i += 1) grid.push(<line key={`v${i}`} x1={i * 40} y1="0" x2={i * 40} y2="900" />); for (let i = 0; i <= 23; i += 1) grid.push(<line key={`h${i}`} x1="0" y1={i * 40} x2="1600" y2={i * 40} />);
  return (
    <SVG>
      <g stroke={hex(p.primary, 0.12)} strokeWidth="1">{grid}</g>
      {blocks}
      <g fill="#000" opacity="0.18">{Array.from({ length: 150 }, (_, i) => <rect key={i} x="0" y={i * 6} width="1600" height="2" />)}</g>
      <rect x="0" y="0" width="1600" height="900" fill="none" stroke={hex(p.accent, 0.3)} strokeWidth="14" rx="30" />
    </SVG>
  );
}

function Court({ p, animate }) {
  return (
    <SVG>
      <g className={animate ? 'wt-beams' : ''}>{[[300, 0.18], [800, 0.22], [1300, 0.18]].map(([x, a], i) => beam(x, 0, 200, 600, p.accent, a, i))}</g>
      <polygon points="260,520 1340,520 1600,900 0,900" fill={hex(p.primary, 0.55)} />
      <g stroke="#fff" strokeOpacity="0.75" strokeWidth="4" fill="none"><polygon points="260,520 1340,520 1600,900 0,900" /><path d="M560 520 L440 900 M1040 520 L1160 900" /><path d="M560 520 L1040 520" /><path d="M470 760 Q 800 560 1130 760" /><ellipse cx="800" cy="840" rx="150" ry="34" /></g>
      <rect x="760" y="170" width="190" height="130" rx="6" fill="#e9eef6" opacity="0.95" /><rect x="808" y="224" width="94" height="62" fill="none" stroke={p.primary} strokeWidth="5" />
      <rect x="772" y="136" width="10" height="150" fill="#242b3a" /><ellipse cx="855" cy="306" rx="46" ry="9" fill="none" stroke={p.accent} strokeWidth="8" />
      <path d="M815 308 L825 372 M855 312 L855 380 M895 308 L885 372" stroke="#fff" strokeOpacity="0.8" strokeWidth="3" />
      <g transform="translate(1210 800)"><circle r="40" fill={p.accent} /><path d="M-40 0 H40 M0 -40 V40 M-28 -28 Q0 0 -28 28 M28 -28 Q0 0 28 28" stroke="#1a0f08" strokeWidth="3" fill="none" /><ellipse cx="0" cy="46" rx="44" ry="8" fill="#000" opacity="0.35" /></g>
    </SVG>
  );
}

function Lofi({ p, animate }) {
  const r = rng(9); const bokeh = []; for (let i = 0; i < 34; i += 1) bokeh.push(<circle key={i} cx={f(180 + r() * 1240)} cy={f(160 + r() * 520)} r={f(10 + r() * 38)} fill={hex([p.primary, p.accent, p.secondary, '#ffffff'][i % 4], 0.22)} className="wt-pulse" style={{ animationDelay: `${f(r() * 6)}s` }} />);
  const drops = []; for (let i = 0; i < 40; i += 1) { const x = f(190 + r() * 1220); const y = f(150 + r() * 520); drops.push(<path key={i} d={`M${x} ${y} q 3 ${f(30 + r() * 80)} 0 ${f(60 + r() * 120)}`} stroke="#fff" strokeOpacity="0.22" strokeWidth="2" fill="none" className={animate ? 'wt-shimmer' : ''} />); }
  return (
    <SVG>
      <rect x="150" y="120" width="1300" height="600" fill={hex(p.secondary, 0.35)} />
      <g>{bokeh}</g><g>{drops}</g>
      <g fill="#07080f"><rect x="120" y="90" width="1360" height="34" /><rect x="120" y="716" width="1360" height="40" /><rect x="120" y="90" width="38" height="666" /><rect x="1442" y="90" width="38" height="666" /><rect x="780" y="90" width="40" height="666" /><rect x="120" y="396" width="1360" height="30" /></g>
      <rect x="0" y="756" width="1600" height="144" fill="#07080f" />
      <g transform="translate(1180 756)"><rect x="-4" y="-150" width="8" height="150" fill="#1a1d2a" /><path d="M-60 -150 L60 -150 L36 -196 L-36 -196 Z" fill={p.accent} /><ellipse cx="0" cy="-146" rx="80" ry="12" fill={hex(p.accent, 0.35)} className="wt-pulse" /><polygon points="-60,-146 60,-146 150,0 -150,0" fill={hex(p.accent, 0.14)} /></g>
      <g transform="translate(330 756)"><rect x="-34" y="-62" width="68" height="62" rx="8" fill="#1a1d2a" /><path d="M34 -46 q 24 4 0 30" stroke="#1a1d2a" strokeWidth="8" fill="none" /><path d="M-12 -86 q 10 -20 0 -34 M10 -86 q 10 -20 0 -34" stroke="#fff" strokeOpacity="0.35" strokeWidth="4" fill="none" className="wt-shimmer" /></g>
    </SVG>
  );
}

function Festival({ p, animate }) {
  const cols = [p.primary, p.accent, p.secondary, '#ffffff']; const fan = [];
  for (let i = 0; i < 9; i += 1) { const x = 220 + i * 145; const dx = (i - 4) * 150; fan.push(<polygon key={i} points={`${x - 5},150 ${x + 5},150 ${x + dx + 90},800 ${x + dx - 90},800`} fill={hex(cols[i % 4], 0.2)} className={animate ? 'wt-sway-slow' : ''} style={{ transformOrigin: `${x}px 150px`, animationDelay: `${i * 0.6}s`, animationDuration: `${5 + (i % 3) * 2}s` }} />); }
  return (
    <SVG>
      <g>{stars(33, 40, 150)}</g>
      <rect x="260" y="320" width="1080" height="300" fill={hex(p.secondary, 0.9)} /><rect x="276" y="336" width="1048" height="268" fill="none" stroke={hex(p.primary, 0.7)} strokeWidth="4" />
      <g fill={hex(p.accent, 0.5)}>{Array.from({ length: 28 }, (_, i) => <rect key={i} x={300 + (i % 14) * 72} y={366 + Math.floor(i / 14) * 112} width="46" height="64" className="wt-window" style={{ animationDelay: `${(i % 7) * 0.7}s` }} />)}</g>
      <g fill="#07070d"><rect x="120" y="120" width="1360" height="30" /><rect x="120" y="120" width="26" height="780" /><rect x="1454" y="120" width="26" height="780" /><rect x="0" y="700" width="1600" height="200" /></g>
      <g fill={p.accent}>{Array.from({ length: 11 }, (_, i) => <circle key={i} cx={190 + i * 122} cy="150" r="11" className="wt-pulse" style={{ animationDelay: `${i * 0.3}s` }} />)}</g>
      {fan}
      <rect x="0" y="700" width="1600" height="6" fill={hex(p.primary, 0.7)} />
    </SVG>
  );
}

function Cyberpunk({ p, animate }) {
  const r = rng(404); const signs = [];
  for (let i = 0; i < 14; i += 1) { const x = f(60 + r() * 1440); const y = f(220 + r() * 360); const w = f(24 + r() * 70); const h = f(40 + r() * 150); const c = [p.primary, p.accent, p.secondary, p.glow][i % 4]; const vert = r() < 0.6;
    signs.push(<g key={i} className="wt-window" style={{ animationDelay: `${f(r() * 5)}s` }}><rect x={x} y={y} width={vert ? w : h} height={vert ? h : w} rx="4" fill="none" stroke={c} strokeWidth="5" /><rect x={x - 6} y={y - 6} width={(vert ? w : h) + 12} height={(vert ? h : w) + 12} rx="8" fill={hex(c, 0.12)} /></g>); }
  return (
    <SVG>
      <g>{stars(61, 30, 160)}</g>
      <g className="wt-layer wt-layer-0" opacity="0.7">{skyline(88, '#0a0a1a', p.primary, 620)}</g>
      <g className="wt-layer wt-layer-1">{skyline(91, '#05050d', p.accent, 700)}</g>
      {signs}
      <g stroke="#05050d" strokeWidth="3" fill="none"><path d="M0 120 Q 400 200 800 120 T 1600 140" /><path d="M0 180 Q 500 260 900 190 T 1600 210" /></g>
      <rect x="0" y="760" width="1600" height="140" fill="#05050d" />
      <rect x="0" y="760" width="1600" height="60" fill={hex(p.primary, 0.25)} className={animate ? 'wt-shimmer' : ''} />
    </SVG>
  );
}

const DRAW = { miami: Miami, synthwave: Synthwave, aurora: Aurora, cosmos: Cosmos, sakura: Sakura, ocean: Ocean, stadium: Stadium, taxi: Taxi, ring: Ring, racing: Racing, arcade: Arcade, court: Court, lofi: Lofi, festival: Festival, cyberpunk: Cyberpunk };

export default function Scene({ scene, palette, lighting, fog = 30, animate = true, backgroundUrl = null }) {
  const Draw = DRAW[scene];
  const rim = lighting?.color || palette.glow;
  const fogA = Math.min(0.5, (fog / 100) * 0.55);
  const art = useMemo(() => (Draw ? <Draw p={palette} animate={animate} /> : null), [Draw, palette, animate]);
  return (
    <div className="wt-scene" aria-hidden="true" data-scene={scene}>
      <div className="wt-scene-sky" style={{ background: (SKY[scene] || SKY.plain)(palette) }} />
      {backgroundUrl ? <div className="wt-scene-photo" style={{ backgroundImage: `url("${backgroundUrl}")` }} /> : null}
      {art}
      {fog > 0 ? <div className={`wt-fog ${animate ? 'wt-drift' : ''}`} style={{ background: `linear-gradient(0deg, ${hex(rim, fogA)}, transparent 55%)` }} /> : null}
    </div>
  );
}

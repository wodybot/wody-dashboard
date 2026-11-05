// Environment Engine: layered scenes built from gradients and generated silhouettes. Procedural and tiny; a real background image,
// when the Owner uploads one, is drawn under these layers. Nothing here is a character: the dragon is a separate asset.
import { useMemo } from 'react';

function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

/** A ridge line across a 1600x900 canvas. `peak` is the roughness, `base` the baseline in px from the top. */
function ridge(seed, base, amp, step, spiky = 0.5) {
  const r = rng(seed); let d = `M0 900 L0 ${base}`;
  for (let x = step; x <= 1600 + step; x += step) { const y = base - r() * amp - (r() < spiky ? amp * 0.6 : 0); d += ` L${x} ${y.toFixed(1)}`; }
  return `${d} L1600 900 Z`;
}
function trunks(seed, count, color) {
  const r = rng(seed); const out = [];
  for (let i = 0; i < count; i += 1) { const x = (i / count) * 1600 + r() * 80; const wd = 26 + r() * 54; const top = -20 - r() * 40; out.push(<path key={i} d={`M${x} 900 L${x + wd * 0.2} 0 L${x + wd * 0.8} 0 L${x + wd} 900 Z`} fill={color} opacity={0.55 + r() * 0.45} transform={`translate(0 ${top})`} />); }
  return out;
}
function ruins(seed, color) {
  const r = rng(seed); const out = [];
  for (let i = 0; i < 9; i += 1) {
    const x = 80 + i * 170 + r() * 40; const h = 220 + r() * 300; const w = 34 + r() * 30;
    out.push(<path key={`c${i}`} d={`M${x} 900 L${x} ${900 - h} L${x + w * 0.2} ${900 - h - 14} L${x + w * 0.8} ${900 - h + 10} L${x + w} ${900 - h - 6} L${x + w} 900 Z`} fill={color} />);
    if (i % 3 === 1) out.push(<path key={`a${i}`} d={`M${x + w} ${900 - h * 0.7} Q${x + w + 70} ${900 - h * 0.7 - 110} ${x + w + 140} ${900 - h * 0.7} L${x + w + 140} ${900 - h * 0.7 + 22} Q${x + w + 70} ${900 - h * 0.7 - 80} ${x + w} ${900 - h * 0.7 + 22} Z`} fill={color} />);
  }
  return out;
}

const SKY = {
  volcano: (p) => `linear-gradient(180deg, #05020a 0%, #2a0a07 55%, ${p.secondary} 118%)`,
  glacier: (p) => `linear-gradient(180deg, #02060f 0%, #0a2038 60%, ${p.primary}44 120%)`,
  storm: (p) => 'linear-gradient(180deg, #03040a 0%, #0c1230 55%, #1b2350 115%)',
  void: (p) => `linear-gradient(180deg, #020104 0%, #0e0720 58%, ${p.secondary}55 125%)`,
  forest: (p) => `linear-gradient(180deg, #020804 0%, #0a2314 55%, ${p.primary}33 120%)`,
  plain: (p) => `linear-gradient(${p.gradient.angle}deg, ${p.gradient.from}, ${p.gradient.to})`,
};

export default function Scene({ scene, palette, lighting, fog = 30, animate = true, backgroundUrl = null }) {
  const layers = useMemo(() => {
    switch (scene) {
      case 'volcano': return [ridge(11, 560, 160, 90, 0.35), ridge(12, 680, 130, 70, 0.3), ridge(13, 780, 90, 60, 0.2)];
      case 'glacier': return [ridge(21, 520, 240, 120, 0.7), ridge(22, 650, 170, 90, 0.6), ridge(23, 770, 110, 70, 0.4)];
      case 'storm': return [ridge(31, 540, 200, 130, 0.5), ridge(32, 680, 140, 90, 0.4), ridge(33, 790, 80, 70, 0.3)];
      default: return [];
    }
  }, [scene]);
  const fillFor = (i) => ['#0b0608', '#07040a', '#040206'][i] || '#040206';
  const rim = lighting?.color || palette.glow; const lum = (lighting?.intensity ?? 40) / 100;
  const fogA = Math.min(0.55, fog / 100 * 0.6);
  const move = animate ? 'wt-drift' : '';
  return (
    <div className="wt-scene" aria-hidden="true" data-scene={scene}>
      <div className="wt-scene-sky" style={{ background: SKY[scene] ? SKY[scene](palette) : SKY.plain(palette) }} />
      {backgroundUrl ? <div className="wt-scene-photo" style={{ backgroundImage: `url("${backgroundUrl}")` }} /> : null}
      {scene === 'volcano' ? <div className="wt-scene-glow" style={{ background: `radial-gradient(60% 45% at 50% 62%, ${palette.glow}${Math.round(lum * 110 + 30).toString(16).padStart(2, '0')}, transparent 70%)` }} /> : null}
      {scene === 'glacier' ? <div className={`wt-aurora ${animate ? 'wt-aurora-on' : ''}`} style={{ background: `linear-gradient(100deg, transparent 10%, ${palette.primary}33 35%, ${palette.accent}22 55%, transparent 85%)` }} /> : null}
      {scene === 'storm' ? <div className={`wt-clouds ${animate ? 'wt-clouds-on' : ''}`} /> : null}
      {scene === 'void' || scene === 'forest' ? <div className="wt-scene-glow" style={{ background: `radial-gradient(70% 50% at ${scene === 'forest' ? '30%' : '50%'} 30%, ${rim}${Math.round(lum * 60 + 10).toString(16).padStart(2, '0')}, transparent 70%)` }} /> : null}
      {scene !== 'plain' ? (
        <svg className="wt-scene-svg" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMax slice" focusable="false">
          {layers.map((d, i) => <path key={i} d={d} fill={fillFor(i)} stroke={i === 0 ? `${rim}55` : 'none'} strokeWidth="1.2" className={`wt-layer wt-layer-${i}`} />)}
          {scene === 'forest' ? <g className="wt-layer wt-layer-0">{trunks(41, 14, '#030a05')}</g> : null}
          {scene === 'void' ? <g className="wt-layer wt-layer-0">{ruins(51, '#050309')}</g> : null}
          {scene === 'volcano' ? <path d="M560 560 L760 330 Q800 300 840 330 L1040 560 Z" fill="#0b0608" opacity="0.0" /> : null}
        </svg>
      ) : null}
      {fog > 0 ? <div className={`wt-fog ${move}`} style={{ background: `linear-gradient(0deg, ${rim}${Math.round(fogA * 80).toString(16).padStart(2, '0')}, transparent 55%)` }} /> : null}
    </div>
  );
}

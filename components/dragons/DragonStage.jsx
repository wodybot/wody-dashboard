'use client';
// The hero of a dragon: layered artwork that moves (wing beats, hovering, tail, head that follows the cursor, jaw), a glow tinted by the fire
// color and a particle layer (fire, smoke, sparks, dust) drawn on a small canvas. The state decides which animation plays. Reduced motion
// shows the still dragon only.
import { useEffect, useRef, useState } from 'react';

const PARTS = ['wing_far', 'tail', 'body', 'head', 'jaw', 'wing_near'];
const BASE_HUE = { fire: 15, ice: 200, storm: 230, shadow: 265, nature: 145 };
const SIZE_SCALE = { small: 0.72, medium: 0.86, large: 1, huge: 1.14 };

function hueOf(hex) {
  const n = parseInt(hex.slice(1), 16); const r = (n >> 16) / 255; const g = ((n >> 8) & 255) / 255; const b = (n & 255) / 255;
  const mx = Math.max(r, g, b); const mn = Math.min(r, g, b); const d = mx - mn; if (!d) return { h: 0, s: 0, l: mx };
  let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h = (h * 60 + 360) % 360;
  return { h, s: d / (1 - Math.abs(mx + mn - 1) || 1), l: (mx + mn) / 2 };
}
const rgb = (hex) => { const n = parseInt(hex.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };

export default function DragonStage({ dragon, state = 'idle', playKey = 0, label = '' }) {
  const wrap = useRef(null); const canvas = useRef(null); const look = useRef({ x: 0, y: 0 });
  const [reduced, setReduced] = useState(false);
  const live = useRef({ state, dragon }); live.current = { state, dragon };

  useEffect(() => {
    try { const m = window.matchMedia('(prefers-reduced-motion: reduce)'); setReduced(m.matches); const f = (e) => setReduced(e.matches); m.addEventListener('change', f); return () => m.removeEventListener('change', f); } catch { return undefined; }
  }, []);

  // the head follows the cursor
  useEffect(() => {
    if (reduced || !dragon.behavior.follow_cursor) { wrap.current?.style.setProperty('--dg-look', '0deg'); return undefined; }
    const move = (e) => { const r = wrap.current?.getBoundingClientRect(); if (!r) return; const dx = (e.clientX - (r.left + r.width * 0.3)) / Math.max(r.width, 1); const dy = (e.clientY - (r.top + r.height * 0.35)) / Math.max(r.height, 1); look.current = { x: dx, y: dy }; wrap.current.style.setProperty('--dg-look', `${Math.max(-8, Math.min(8, dy * 14 - Math.abs(dx) * 2))}deg`); };
    window.addEventListener('pointermove', move, { passive: true }); return () => window.removeEventListener('pointermove', move);
  }, [dragon.behavior.follow_cursor, reduced]);

  // particles
  useEffect(() => {
    const cv = canvas.current; const box = wrap.current; if (!cv || !box || reduced) return undefined;
    const g = cv.getContext('2d'); if (!g) return undefined;
    let raf = 0; let last = performance.now(); let carry = 0; const ps = [];
    const size = () => { cv.width = Math.max(2, box.clientWidth); cv.height = Math.max(2, box.clientHeight); };
    size(); const ro = new ResizeObserver(size); ro.observe(box);
    const loop = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      const { state: st, dragon: d } = live.current; const [fr, fg, fb] = rgb(d.fire_color); const W = cv.width; const H = cv.height;
      const h = H; const sc = SIZE_SCALE[d.size] || 1; const dw = h * 0.75 * sc; const left = W * 0.5 - dw * 0.15; // artwork box
      const mouth = { x: left + dw * 0.1, y: h * (0.9 - 0.9 * sc) + h * sc * 0.33 };
      const rate = (st === 'fire_attack' && d.effects.fire ? 170 : st === 'roar' && d.effects.sparks ? 40 : st === 'idle' && d.effects.fire ? 6 : 0);
      carry += dt * rate; while (carry >= 1 && ps.length < 420) {
        carry -= 1;
        if (st === 'fire_attack') ps.push({ k: 'fire', x: mouth.x, y: mouth.y, vx: -(260 + Math.random() * 220) * sc, vy: (Math.random() - 0.5) * 70, life: 0.9 + Math.random() * 0.5, age: 0, r: 8 + Math.random() * 14 });
        else if (st === 'roar') ps.push({ k: 'spark', x: mouth.x, y: mouth.y, vx: -(80 + Math.random() * 200), vy: -(Math.random() * 160), life: 0.8, age: 0, r: 1.6 });
        else ps.push({ k: 'spark', x: left + dw * (0.3 + Math.random() * 0.5), y: h * 0.8, vx: (Math.random() - 0.5) * 20, vy: -(30 + Math.random() * 40), life: 2.4, age: 0, r: 1.4 });
      }
      if (st === 'fire_attack' && d.effects.smoke && Math.random() < dt * 30) ps.push({ k: 'smoke', x: mouth.x - 80, y: mouth.y - 10, vx: -50, vy: -40 - Math.random() * 30, life: 2.2, age: 0, r: 18 });
      if (st === 'land' && d.effects.dust && Math.random() < dt * 90) ps.push({ k: 'dust', x: W * 0.5 + (Math.random() - 0.5) * dw * 0.8, y: h * 0.93, vx: (Math.random() - 0.5) * 220, vy: -(Math.random() * 40), life: 1.4, age: 0, r: 10 + Math.random() * 12 });
      g.clearRect(0, 0, W, H);
      for (let i = ps.length - 1; i >= 0; i -= 1) {
        const p = ps[i]; p.age += dt; if (p.age >= p.life) { ps.splice(i, 1); continue; }
        const f = p.age / p.life; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.985; p.vy += (p.k === 'fire' ? -40 : p.k === 'dust' ? 20 : 20) * dt;
        if (p.k === 'fire') { g.globalCompositeOperation = 'lighter'; const a = (1 - f) * 0.55; const gr = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * (1 + f * 2)); gr.addColorStop(0, `rgba(255,${Math.round(240 - f * 90)},${Math.round(190 - f * 150)},${a})`); gr.addColorStop(0.5, `rgba(${fr},${fg},${fb},${a * 0.7})`); gr.addColorStop(1, `rgba(${fr},${fg},${fb},0)`); g.fillStyle = gr; g.beginPath(); g.arc(p.x, p.y, p.r * (1 + f * 2), 0, 6.3); g.fill(); }
        else if (p.k === 'spark') { g.globalCompositeOperation = 'lighter'; g.fillStyle = `rgba(255,${Math.round(220 - f * 100)},${Math.round(150 - f * 100)},${1 - f})`; g.beginPath(); g.arc(p.x, p.y, p.r, 0, 6.3); g.fill(); }
        else { g.globalCompositeOperation = 'source-over'; const a = (p.k === 'smoke' ? 0.28 : 0.22) * (1 - f); g.fillStyle = p.k === 'smoke' ? `rgba(40,36,36,${a})` : `rgba(150,130,110,${a})`; g.beginPath(); g.arc(p.x, p.y, p.r * (1 + f * 2.2), 0, 6.3); g.fill(); }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop); return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, [reduced]);

  const hue = hueOf(dragon.scale_color); const shift = Math.round(hue.h - (BASE_HUE[dragon.type] ?? 15));
  const sat = hue.s < 0.12 ? 0.15 : 0.9 + Math.min(0.5, hue.s * 0.5); const bright = 0.45 + hue.l * 1.25;
  const art = { filter: `hue-rotate(${shift}deg) saturate(${sat.toFixed(2)}) brightness(${bright.toFixed(2)})` };
  const sc = SIZE_SCALE[dragon.size] || 1;
  const [fr, fg, fb] = rgb(dragon.fire_color);
  return (
    <div ref={wrap} className="dg-stage" data-state={reduced ? 'idle' : state} data-key={playKey} data-calm={dragon.behavior.look_around ? '1' : '0'} role="img" aria-label={label}
      style={{ ['--dg-fire']: `${fr},${fg},${fb}`, ['--dg-size']: sc }}>
      {dragon.effects.light ? <div className="dg-glow" aria-hidden="true" /> : null}
      <div className="dg-ground" aria-hidden="true" />
      <div className="dg-art">
        <div className={`wt-rig ${reduced ? '' : 'wt-rig-on'} dg-rig`} style={{ height: '100%', aspectRatio: '3 / 4', ...art }}>
          {PARTS.map((p) => {
            const src = `/themes/rig/${dragon.type}/${p}.png`;
            // eslint-disable-next-line @next/next/no-img-element
            return <img key={p} src={src} alt="" decoding="async" draggable={false} className={`wt-rig-part wt-rig-${p.replace('_', '-')}`} />;
          })}
        </div>
      </div>
      <canvas ref={canvas} className="dg-fx" aria-hidden="true" />
    </div>
  );
}

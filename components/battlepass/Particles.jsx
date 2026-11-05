'use client';
// Particle layer of the page: snow, embers, stars, confetti, bubbles, sparks, petals, rain. One canvas, drawn with
// requestAnimationFrame only while the page is visible, and not started at all when the visitor prefers reduced motion.
import { useEffect, useRef } from 'react';

const KINDS = {
  snow: { count: 90, make: (w, h, r) => ({ x: r() * w, y: r() * h, s: 1 + r() * 2.6, vy: 0.4 + r() * 0.9, vx: (r() - 0.5) * 0.4, a: 0.5 + r() * 0.5 }), draw: (c, p, col) => { c.globalAlpha = p.a; c.fillStyle = col; c.beginPath(); c.arc(p.x, p.y, p.s, 0, 7); c.fill(); } },
  embers: { count: 60, make: (w, h, r) => ({ x: r() * w, y: h + r() * h, s: 1 + r() * 2.2, vy: -(0.5 + r() * 1.4), vx: (r() - 0.5) * 0.7, a: 0.4 + r() * 0.6 }), draw: (c, p, col) => { c.globalAlpha = p.a; c.shadowColor = col; c.shadowBlur = 10; c.fillStyle = col; c.beginPath(); c.arc(p.x, p.y, p.s, 0, 7); c.fill(); c.shadowBlur = 0; } },
  stars: { count: 80, make: (w, h, r) => ({ x: r() * w, y: r() * h, s: 0.6 + r() * 1.8, vy: 0.04 + r() * 0.12, vx: 0, a: r(), tw: 0.01 + r() * 0.03 }), draw: (c, p, col) => { c.globalAlpha = 0.25 + Math.abs(Math.sin(p.a)) * 0.75; c.fillStyle = col; c.fillRect(p.x, p.y, p.s, p.s); } },
  confetti: { count: 70, make: (w, h, r) => ({ x: r() * w, y: -r() * h, s: 4 + r() * 5, vy: 0.8 + r() * 1.6, vx: (r() - 0.5) * 1.2, a: 1, rot: r() * 6, vr: (r() - 0.5) * 0.2, hue: Math.floor(r() * 360) }), draw: (c, p) => { c.globalAlpha = 0.9; c.save(); c.translate(p.x, p.y); c.rotate(p.rot); c.fillStyle = `hsl(${p.hue} 85% 62%)`; c.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); c.restore(); } },
  bubbles: { count: 40, make: (w, h, r) => ({ x: r() * w, y: h + r() * h, s: 3 + r() * 9, vy: -(0.3 + r() * 0.9), vx: (r() - 0.5) * 0.3, a: 0.15 + r() * 0.25 }), draw: (c, p, col) => { c.globalAlpha = p.a; c.strokeStyle = col; c.lineWidth = 1.2; c.beginPath(); c.arc(p.x, p.y, p.s, 0, 7); c.stroke(); } },
  sparks: { count: 50, make: (w, h, r) => ({ x: r() * w, y: h + r() * 40, s: 1 + r() * 1.6, vy: -(1.5 + r() * 3), vx: (r() - 0.5) * 1.4, a: 1, life: 0.6 + r() * 0.6 }), draw: (c, p, col) => { c.globalAlpha = Math.max(0, p.a); c.strokeStyle = col; c.lineWidth = p.s; c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x - p.vx * 3, p.y - p.vy * 3); c.stroke(); } },
  petals: { count: 45, make: (w, h, r) => ({ x: r() * w, y: -r() * h, s: 4 + r() * 5, vy: 0.5 + r() * 0.9, vx: 0.3 + r() * 0.8, a: 0.8, rot: r() * 6, vr: (r() - 0.5) * 0.08 }), draw: (c, p, col) => { c.globalAlpha = p.a; c.save(); c.translate(p.x, p.y); c.rotate(p.rot); c.fillStyle = col; c.beginPath(); c.ellipse(0, 0, p.s, p.s / 2, 0, 0, 7); c.fill(); c.restore(); } },
  rain: { count: 110, make: (w, h, r) => ({ x: r() * w, y: r() * h, s: 0.8, vy: 9 + r() * 7, vx: -1.2, a: 0.35 }), draw: (c, p, col) => { c.globalAlpha = p.a; c.strokeStyle = col; c.lineWidth = p.s; c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x + p.vx * 1.6, p.y + 12); c.stroke(); } },
};

export default function Particles({ kind, intensity = 35, speed = 60, color = '#ffffff', fixed = true }) {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    const spec = KINDS[kind];
    if (!canvas || !spec || intensity <= 0) return undefined;
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined;
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;
    let w = 0; let h = 0; let raf = 0; let alive = true;
    const rnd = Math.random;
    const resize = () => {
      const box = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = Math.max(1, box.width); h = Math.max(1, box.height);
      canvas.width = w * dpr; canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const total = Math.max(4, Math.round(spec.count * (intensity / 100) * (w < 640 ? 0.55 : 1)));
    const parts = Array.from({ length: total }, () => spec.make(w, h, rnd));
    const k = speed / 60;
    const frame = () => {
      if (!alive) return;
      ctx.clearRect(0, 0, w, h);
      for (const p of parts) {
        p.x += p.vx * k; p.y += p.vy * k;
        if (p.rot !== undefined) p.rot += p.vr * k;
        if (kind === 'stars') p.a += p.tw * k;
        if (kind === 'sparks') { p.a -= 0.012 * k / p.life; }
        const out = p.y > h + 20 || p.y < -h - 40 || p.x > w + 30 || p.x < -30;
        if (out || (kind === 'sparks' && p.a <= 0)) Object.assign(p, spec.make(w, h, rnd), kind === 'sparks' ? { y: h + 10 } : kind === 'snow' || kind === 'confetti' || kind === 'petals' || kind === 'rain' ? { y: -10 } : {});
        spec.draw(ctx, p, color);
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(frame);
    };
    const onVisibility = () => {
      if (document.hidden) { cancelAnimationFrame(raf); } else { cancelAnimationFrame(raf); raf = requestAnimationFrame(frame); }
    };
    raf = requestAnimationFrame(frame);
    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', onVisibility);
    return () => { alive = false; cancelAnimationFrame(raf); window.removeEventListener('resize', resize); document.removeEventListener('visibilitychange', onVisibility); };
  }, [kind, intensity, speed, color]);
  if (!KINDS[kind] || intensity <= 0) return null;
  return <canvas ref={ref} aria-hidden="true" className="bp-fx bp-particles" style={fixed ? undefined : { position: 'absolute' }} />;
}

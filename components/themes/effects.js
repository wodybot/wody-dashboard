// Effects Engine: atmospheric effects drawn on one 2D canvas. No emoji and no text glyphs: soft light sprites, strokes and shapes only.
// Everything scales with the performance profile (particle budget, frame rate), pauses when the tab is hidden and never needs WebGL.
const TAU = Math.PI * 2;
const rnd = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

function sprite(size, stops) {
  const c = document.createElement('canvas'); c.width = size; c.height = size;
  const g = c.getContext('2d'); const r = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (const [o, col] of stops) r.addColorStop(o, col);
  g.fillStyle = r; g.fillRect(0, 0, size, size);
  return c;
}
const hexRgb = (hex) => { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const rgba = (hex, a) => { const [r, g, b] = hexRgb(hex); return `rgba(${r},${g},${b},${a})`; };

/** palette: the theme palette (hex strings). budget: particle multiplier of the profile. */
export function createEffects(canvas, { effects, palette, lighting, budget = 0.5, fps = 30, allowLightning = true, dpr = 1 }) {
  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) return null;
  let w = 0; let h = 0; let raf = 0; let last = 0; let acc = 0; let running = false; let t = 0;
  const frame = 1000 / fps;
  const glow = palette.glow; const accent = palette.accent; const light = lighting?.color || glow;
  const sprites = {
    ember: sprite(64, [[0, 'rgba(255,240,200,1)'], [0.25, rgba(glow, 0.9)], [1, rgba(glow, 0)]]),
    soft: sprite(96, [[0, 'rgba(255,255,255,0.55)'], [0.5, 'rgba(255,255,255,0.14)'], [1, 'rgba(255,255,255,0)']]),
    smoke: sprite(128, [[0, 'rgba(70,60,60,0.42)'], [0.6, 'rgba(50,44,44,0.16)'], [1, 'rgba(40,34,34,0)']]),
    dark: sprite(96, [[0, 'rgba(8,4,16,0.7)'], [0.6, 'rgba(8,4,16,0.25)'], [1, 'rgba(8,4,16,0)']]),
    tint: sprite(96, [[0, rgba(light, 0.5)], [0.6, rgba(light, 0.15)], [1, rgba(light, 0)]]),
    gold: sprite(48, [[0, 'rgba(255,245,200,0.95)'], [0.3, rgba(accent, 0.55)], [1, rgba(accent, 0)]]),
  };
  const systems = []; let flash = 0; let bolt = null; let nextBolt = rnd(5000, 9000);
  const count = (base, inten) => Math.max(0, Math.round(base * budget * (inten / 100)));

  const make = {
    embers(n, inten) {
      const list = Array.from({ length: count(70, inten) }, () => ({ x: rnd(0, 1), y: rnd(0, 1), s: rnd(0.5, 1.6), v: rnd(0.02, 0.07), ph: rnd(0, TAU), sw: rnd(0.0004, 0.0012) }));
      return { update(dt) { for (const p of list) { p.y -= p.v * dt / 1000; p.x += Math.sin(t * p.sw * 3 + p.ph) * 0.0004; if (p.y < -0.05) { p.y = 1.05; p.x = rnd(0, 1); } } },
        draw() { ctx.globalCompositeOperation = 'lighter'; for (const p of list) { const a = (0.35 + 0.65 * Math.abs(Math.sin(t * 0.003 + p.ph))) * clamp(1.2 - p.y, 0.2, 1); ctx.globalAlpha = a; const s = 10 * p.s * (dpr > 1 ? 1 : 1); ctx.drawImage(sprites.ember, p.x * w - s / 2, p.y * h - s / 2, s, s); } ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; } };
    },
    heat(n, inten) {
      return { update() {}, draw() { const k = inten / 100; const g = ctx.createLinearGradient(0, h, 0, h * 0.45); g.addColorStop(0, rgba(glow, 0.22 * k)); g.addColorStop(1, rgba(glow, 0)); ctx.fillStyle = g; ctx.fillRect(0, h * 0.45, w, h * 0.55);
        ctx.strokeStyle = rgba(light, 0.05 * k); ctx.lineWidth = 1; for (let i = 0; i < 7; i += 1) { const y = h * (0.62 + i * 0.05); ctx.beginPath(); for (let x = 0; x <= w; x += 24) ctx.lineTo(x, y + Math.sin(x * 0.012 + t * 0.0011 + i) * (3 + i)); ctx.stroke(); } } };
    },
    smoke(n, inten) {
      const list = Array.from({ length: Math.max(2, count(8, inten)) }, () => ({ x: rnd(0, 1), y: rnd(0.3, 1), s: rnd(220, 420), v: rnd(0.006, 0.018), a: rnd(0.4, 1) }));
      return { update(dt) { for (const p of list) { p.y -= p.v * dt / 1000; p.x += 0.002 * dt / 1000; if (p.y < -0.3) { p.y = 1.2; p.x = rnd(0, 1); } } },
        draw() { for (const p of list) { ctx.globalAlpha = p.a * (inten / 100); ctx.drawImage(sprites.smoke, p.x * w - p.s / 2, p.y * h - p.s / 2, p.s, p.s); } ctx.globalAlpha = 1; } };
    },
    mist(n, inten) {
      const list = Array.from({ length: Math.max(2, count(7, inten)) }, (_, i) => ({ x: rnd(0, 1), y: 0.5 + (i % 4) * 0.12, s: rnd(360, 640), v: rnd(0.004, 0.012) * (i % 2 ? 1 : -1) }));
      return { update(dt) { for (const p of list) { p.x += p.v * dt / 1000; if (p.x > 1.3) p.x = -0.3; if (p.x < -0.3) p.x = 1.3; } },
        draw() { ctx.globalAlpha = 0.5 * (inten / 100); for (const p of list) ctx.drawImage(sprites.tint, p.x * w - p.s / 2, p.y * h - p.s / 4, p.s, p.s / 2); ctx.globalAlpha = 1; } };
    },
    snow(n, inten) {
      const list = Array.from({ length: count(160, inten) }, () => ({ x: rnd(0, 1), y: rnd(0, 1), z: rnd(0.3, 1), ph: rnd(0, TAU) }));
      return { update(dt) { for (const p of list) { p.y += (0.03 + p.z * 0.07) * dt / 1000; p.x += Math.sin(t * 0.0006 + p.ph) * 0.0003 * p.z + 0.004 * dt / 1000; if (p.y > 1.03) { p.y = -0.03; p.x = rnd(0, 1); } if (p.x > 1.03) p.x = -0.03; } },
        draw() { for (const p of list) { ctx.globalAlpha = 0.25 + p.z * 0.6; const s = 3 + p.z * 7; ctx.drawImage(sprites.soft, p.x * w - s / 2, p.y * h - s / 2, s, s); } ctx.globalAlpha = 1; } };
    },
    frost(n, inten) {
      const spark = Array.from({ length: count(26, inten) }, () => ({ x: rnd(0, 1), y: rnd(0, 1), ph: rnd(0, TAU), s: rnd(6, 14) }));
      return { update() {}, draw() { const k = inten / 100; for (const [cx, cy] of [[0, 0], [w, 0], [0, h], [w, h]]) { const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.min(w, h) * 0.5); g.addColorStop(0, `rgba(220,245,255,${0.22 * k})`); g.addColorStop(1, 'rgba(220,245,255,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h); }
        ctx.globalCompositeOperation = 'lighter'; for (const p of spark) { ctx.globalAlpha = Math.max(0, Math.sin(t * 0.0015 + p.ph)) * 0.9 * k; ctx.drawImage(sprites.gold, p.x * w - p.s / 2, p.y * h - p.s / 2, p.s, p.s); } ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; } };
    },
    shards(n, inten) {
      const list = Array.from({ length: count(16, inten) }, () => ({ x: rnd(0, 1), y: rnd(0, 1), l: rnd(14, 38), a: rnd(-0.5, 0.5), v: rnd(0.01, 0.03), r: rnd(-0.3, 0.3) }));
      return { update(dt) { for (const p of list) { p.y += p.v * dt / 1000; p.a += p.r * dt / 1000; if (p.y > 1.05) { p.y = -0.05; p.x = rnd(0, 1); } } },
        draw() { for (const p of list) { ctx.save(); ctx.translate(p.x * w, p.y * h); ctx.rotate(p.a); const g = ctx.createLinearGradient(0, -p.l, 0, p.l); g.addColorStop(0, 'rgba(235,250,255,0.55)'); g.addColorStop(1, rgba(palette.primary, 0.12)); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, -p.l); ctx.lineTo(p.l * 0.22, 0); ctx.lineTo(0, p.l); ctx.lineTo(-p.l * 0.22, 0); ctx.closePath(); ctx.fill(); ctx.restore(); } } };
    },
    rain(n, inten) {
      const list = Array.from({ length: count(150, inten) }, () => ({ x: rnd(0, 1.2), y: rnd(0, 1), l: rnd(10, 26), v: rnd(0.9, 1.5) }));
      return { update(dt) { for (const p of list) { p.y += p.v * dt / 1000; p.x -= 0.18 * p.v * dt / 1000; if (p.y > 1.05) { p.y = -0.05; p.x = rnd(0, 1.2); } } },
        draw() { ctx.strokeStyle = 'rgba(190,205,235,0.32)'; ctx.lineWidth = 1; ctx.beginPath(); for (const p of list) { const x = p.x * w; const y = p.y * h; ctx.moveTo(x, y); ctx.lineTo(x - p.l * 0.2, y + p.l); } ctx.stroke(); } };
    },
    wind(n, inten) {
      const list = Array.from({ length: Math.max(3, count(14, inten)) }, () => ({ x: rnd(-0.3, 1), y: rnd(0.1, 0.9), l: rnd(120, 340), v: rnd(0.18, 0.4) }));
      return { update(dt) { for (const p of list) { p.x += p.v * dt / 1000; if (p.x > 1.3) { p.x = -0.4; p.y = rnd(0.1, 0.9); } } },
        draw() { ctx.lineWidth = 1; for (const p of list) { const g = ctx.createLinearGradient(p.x * w, 0, p.x * w + p.l, 0); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,0.14)'); g.addColorStop(1, 'rgba(255,255,255,0)'); ctx.strokeStyle = g; ctx.beginPath(); ctx.moveTo(p.x * w, p.y * h); ctx.lineTo(p.x * w + p.l, p.y * h - 6); ctx.stroke(); } } };
    },
    motes(n, inten) {
      const list = Array.from({ length: count(48, inten) }, () => ({ x: rnd(0, 1), y: rnd(0, 1), s: rnd(10, 36), v: rnd(0.004, 0.02), ph: rnd(0, TAU), dark: Math.random() < 0.6 }));
      return { update(dt) { for (const p of list) { p.y -= p.v * dt / 1000; p.x += Math.sin(t * 0.0004 + p.ph) * 0.0004; if (p.y < -0.05) { p.y = 1.05; p.x = rnd(0, 1); } } },
        draw() { for (const p of list) { ctx.globalAlpha = 0.55 * (0.5 + 0.5 * Math.sin(t * 0.0007 + p.ph)); ctx.drawImage(p.dark ? sprites.dark : sprites.tint, p.x * w - p.s / 2, p.y * h - p.s / 2, p.s, p.s); } ctx.globalAlpha = 1; } };
    },
    rays(n, inten) {
      const list = Array.from({ length: 5 }, (_, i) => ({ x: 0.12 + i * 0.19 + rnd(-0.04, 0.04), wd: rnd(0.05, 0.11), ph: rnd(0, TAU) }));
      return { update() {}, draw() { for (const r of list) { const a = (0.05 + 0.05 * Math.sin(t * 0.0004 + r.ph)) * (inten / 100) * (lighting?.intensity ?? 50) / 50; const x0 = r.x * w; const g = ctx.createLinearGradient(x0, 0, x0 + w * 0.2, h); g.addColorStop(0, rgba(light, a * 2.2)); g.addColorStop(1, rgba(light, 0)); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x0, 0); ctx.lineTo(x0 + r.wd * w, 0); ctx.lineTo(x0 + w * 0.2 + r.wd * w * 2, h); ctx.lineTo(x0 + w * 0.2, h); ctx.closePath(); ctx.fill(); } } };
    },
    leaves(n, inten) {
      const list = Array.from({ length: Math.max(3, count(14, inten)) }, () => ({ x: rnd(0, 1), y: rnd(0, 1), s: rnd(8, 15), a: rnd(0, TAU), r: rnd(-0.8, 0.8), v: rnd(0.02, 0.05), ph: rnd(0, TAU) }));
      return { update(dt) { for (const p of list) { p.y += p.v * dt / 1000; p.x += Math.sin(t * 0.0007 + p.ph) * 0.0006 + 0.004 * dt / 1000; p.a += p.r * dt / 1000; if (p.y > 1.05) { p.y = -0.05; p.x = rnd(0, 1); } if (p.x > 1.05) p.x = -0.05; } },
        draw() { for (const p of list) { ctx.save(); ctx.translate(p.x * w, p.y * h); ctx.rotate(p.a); ctx.scale(1, 0.7 + 0.3 * Math.sin(t * 0.002 + p.ph)); ctx.fillStyle = rgba(palette.primary, 0.55); ctx.beginPath(); ctx.moveTo(0, -p.s); ctx.bezierCurveTo(p.s * 0.8, -p.s * 0.4, p.s * 0.6, p.s * 0.6, 0, p.s); ctx.bezierCurveTo(-p.s * 0.6, p.s * 0.6, -p.s * 0.8, -p.s * 0.4, 0, -p.s); ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.beginPath(); ctx.moveTo(0, -p.s); ctx.lineTo(0, p.s); ctx.stroke(); ctx.restore(); } } };
    },
    stars(n, inten) {
      const list = Array.from({ length: count(90, inten) }, () => ({ x: rnd(0, 1), y: rnd(0, 0.85), s: rnd(5, 16), ph: rnd(0, TAU), sp: rnd(0.0008, 0.0022) }));
      return { update() {}, draw() { ctx.globalCompositeOperation = 'lighter'; for (const p of list) { ctx.globalAlpha = 0.2 + 0.8 * Math.max(0, Math.sin(t * p.sp + p.ph)); ctx.drawImage(sprites.gold, p.x * w - p.s / 2, p.y * h - p.s / 2, p.s, p.s); } ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; } };
    },
    petals(n, inten) {
      const list = Array.from({ length: Math.max(4, count(30, inten)) }, () => ({ x: rnd(0, 1), y: rnd(0, 1), s: rnd(7, 13), a: rnd(0, TAU), r: rnd(-1.2, 1.2), v: rnd(0.025, 0.06), ph: rnd(0, TAU) }));
      return { update(dt) { for (const p of list) { p.y += p.v * dt / 1000; p.x += Math.sin(t * 0.0006 + p.ph) * 0.0007 + 0.006 * dt / 1000; p.a += p.r * dt / 1000; if (p.y > 1.05) { p.y = -0.05; p.x = rnd(0, 1); } if (p.x > 1.05) p.x = -0.05; } },
        draw() { for (const p of list) { ctx.save(); ctx.translate(p.x * w, p.y * h); ctx.rotate(p.a); ctx.scale(1, 0.55 + 0.45 * Math.sin(t * 0.002 + p.ph)); ctx.fillStyle = rgba(p.s > 10 ? palette.primary : palette.accent, 0.7); ctx.beginPath(); ctx.ellipse(0, 0, p.s, p.s * 0.55, 0, 0, TAU); ctx.fill(); ctx.restore(); } } };
    },
    bubbles(n, inten) {
      const list = Array.from({ length: count(46, inten) }, () => ({ x: rnd(0, 1), y: rnd(0, 1), s: rnd(4, 16), v: rnd(0.02, 0.08), ph: rnd(0, TAU) }));
      return { update(dt) { for (const p of list) { p.y -= p.v * dt / 1000; p.x += Math.sin(t * 0.0008 + p.ph) * 0.0004; if (p.y < -0.05) { p.y = 1.05; p.x = rnd(0, 1); } } },
        draw() { ctx.lineWidth = 1; for (const p of list) { ctx.globalAlpha = 0.5; ctx.strokeStyle = rgba(light, 0.7); ctx.beginPath(); ctx.arc(p.x * w, p.y * h, p.s / 2, 0, TAU); ctx.stroke(); ctx.globalAlpha = 0.9; ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fillRect(p.x * w - p.s * 0.2, p.y * h - p.s * 0.28, 1.6, 1.6); } ctx.globalAlpha = 1; } };
    },
    fireflies(n, inten) {
      const list = Array.from({ length: count(32, inten) }, () => ({ x: rnd(0, 1), y: rnd(0.2, 1), s: rnd(14, 34), ph: rnd(0, TAU), v: rnd(0.002, 0.01), a: rnd(0, TAU) }));
      return { update(dt) { for (const p of list) { p.a += rnd(-1, 1) * dt * 0.002; p.x += Math.cos(p.a) * p.v * dt / 1000; p.y += Math.sin(p.a) * p.v * dt / 1000; if (p.x < 0 || p.x > 1) p.x = rnd(0, 1); if (p.y < 0.1 || p.y > 1.02) p.y = rnd(0.3, 1); } },
        draw() { ctx.globalCompositeOperation = 'lighter'; for (const p of list) { ctx.globalAlpha = Math.max(0, Math.sin(t * 0.0016 + p.ph)) * 0.95; ctx.drawImage(sprites.gold, p.x * w - p.s / 2, p.y * h - p.s / 2, p.s, p.s); } ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; } };
    },
    neon(n, inten) {
      const list = Array.from({ length: Math.max(3, count(9, inten)) }, (_, i) => ({ x: rnd(-0.2, 1), y: rnd(0.08, 0.9), l: rnd(160, 420), v: rnd(0.12, 0.34), c: i % 2 ? glow : accent }));
      return { update(dt) { for (const p of list) { p.x += p.v * dt / 1000; if (p.x > 1.3) { p.x = -0.4; p.y = rnd(0.08, 0.9); } } },
        draw() { ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round'; for (const p of list) { const x = p.x * w; const g = ctx.createLinearGradient(x, 0, x + p.l, 0); g.addColorStop(0, rgba(p.c, 0)); g.addColorStop(0.7, rgba(p.c, 0.55 * (inten / 100))); g.addColorStop(1, rgba(p.c, 0)); ctx.strokeStyle = g; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x, p.y * h); ctx.lineTo(x + p.l, p.y * h); ctx.stroke(); } ctx.globalCompositeOperation = 'source-over'; } };
    },
    sparks(n, inten) {
      const list = Array.from({ length: count(54, inten) }, () => ({ x: rnd(0, 1), y: rnd(0, 1), s: rnd(8, 22), v: rnd(0.03, 0.12), ph: rnd(0, TAU), up: Math.random() < 0.5 }));
      return { update(dt) { for (const p of list) { p.y += (p.up ? -1 : 1) * p.v * dt / 1000; if (p.y < -0.05) p.y = 1.05; if (p.y > 1.05) p.y = -0.05; } },
        draw() { ctx.globalCompositeOperation = 'lighter'; for (const p of list) { ctx.globalAlpha = 0.25 + 0.75 * Math.abs(Math.sin(t * 0.002 + p.ph)); ctx.drawImage(p.up ? sprites.ember : sprites.gold, p.x * w - p.s / 2, p.y * h - p.s / 2, p.s, p.s); } ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; } };
    },
    confetti(n, inten) {
      const cols = [palette.primary, palette.accent, palette.secondary, '#ffffff'];
      const list = Array.from({ length: Math.max(6, count(70, inten)) }, (_, i) => ({ x: rnd(0, 1), y: rnd(0, 1), w: rnd(5, 10), l: rnd(8, 16), a: rnd(0, TAU), r: rnd(-3, 3), v: rnd(0.05, 0.13), ph: rnd(0, TAU), c: cols[i % 4] }));
      return { update(dt) { for (const p of list) { p.y += p.v * dt / 1000; p.x += Math.sin(t * 0.0008 + p.ph) * 0.0006; p.a += p.r * dt / 1000; if (p.y > 1.05) { p.y = -0.05; p.x = rnd(0, 1); } } },
        draw() { for (const p of list) { ctx.save(); ctx.translate(p.x * w, p.y * h); ctx.rotate(p.a); ctx.scale(1, 0.35 + 0.65 * Math.abs(Math.sin(t * 0.003 + p.ph))); ctx.fillStyle = rgba(p.c, 0.85); ctx.fillRect(-p.w / 2, -p.l / 2, p.w, p.l); ctx.restore(); } } };
    },
    speedlines(n, inten) {
      const list = Array.from({ length: Math.max(4, count(26, inten)) }, () => ({ x: rnd(0, 1), y: rnd(0, 1), l: rnd(0.08, 0.26), v: rnd(0.9, 1.8) }));
      return { update(dt) { for (const p of list) { p.y += p.v * dt / 1000; if (p.y > 1.3) { p.y = -0.3; p.x = rnd(0, 1); } } },
        draw() { ctx.lineWidth = 2; ctx.lineCap = 'round'; for (const p of list) { const x = p.x * w; const y = p.y * h; const g = ctx.createLinearGradient(x, y - p.l * h, x, y); g.addColorStop(0, rgba(glow, 0)); g.addColorStop(1, rgba(light, 0.5)); ctx.strokeStyle = g; ctx.beginPath(); ctx.moveTo(x, y - p.l * h); ctx.lineTo(x, y); ctx.stroke(); } } };
    },
    flashes(n, inten) {
      const list = Array.from({ length: Math.max(4, count(14, inten)) }, () => ({ x: rnd(0, 1), y: rnd(0.35, 0.95), s: rnd(40, 110), at: rnd(0, 6000), gap: rnd(2500, 7000) }));
      return { update() {}, draw() { ctx.globalCompositeOperation = 'lighter'; for (const p of list) { const ph = ((t + p.at) % p.gap) / 260; if (ph < 1) { ctx.globalAlpha = (1 - ph) * 0.55 * (inten / 100); ctx.drawImage(sprites.gold, p.x * w - p.s / 2, p.y * h - p.s / 2, p.s, p.s); } } ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; } };
    },
    pollen(n, inten) {
      const list = Array.from({ length: count(60, inten) }, () => ({ x: rnd(0, 1), y: rnd(0, 1), s: rnd(5, 18), v: rnd(0.004, 0.016), ph: rnd(0, TAU) }));
      return { update(dt) { for (const p of list) { p.y -= p.v * dt / 1000; p.x += Math.sin(t * 0.0005 + p.ph) * 0.0005; if (p.y < -0.05) { p.y = 1.05; p.x = rnd(0, 1); } } },
        draw() { ctx.globalCompositeOperation = 'lighter'; for (const p of list) { ctx.globalAlpha = 0.25 + 0.6 * Math.abs(Math.sin(t * 0.001 + p.ph)); ctx.drawImage(sprites.gold, p.x * w - p.s / 2, p.y * h - p.s / 2, p.s, p.s); } ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; } };
    },
  };

  for (const e of effects) if (make[e.id] && e.id !== 'lightning') systems.push(make[e.id](0, e.intensity));
  const lightningOn = allowLightning && effects.some((e) => e.id === 'lightning');
  const lightningK = (effects.find((e) => e.id === 'lightning')?.intensity ?? 0) / 100;

  function boltPath(x, y, ex, ey, depth = 0) {
    const pts = [[x, y]]; const seg = 9; let cx = x; let cy = y;
    for (let i = 1; i <= seg; i += 1) { cx = x + ((ex - x) * i) / seg + rnd(-34, 34) * (1 - i / seg + 0.2); cy = y + ((ey - y) * i) / seg; pts.push([cx, cy]); }
    const branches = depth < 1 ? pts.filter((_, i) => i > 2 && i < seg - 1 && Math.random() < 0.25).map((p) => boltPath(p[0], p[1], p[0] + rnd(-160, 160), p[1] + rnd(80, 200), depth + 1)) : [];
    return { pts, branches };
  }
  function strike() { const x = rnd(0.15, 0.85) * w; bolt = { path: boltPath(x, 0, x + rnd(-120, 120), h * rnd(0.45, 0.7)), life: 0 }; flash = 1; }

  function resize() {
    const r = canvas.getBoundingClientRect();
    w = Math.max(1, Math.round(r.width)); h = Math.max(1, Math.round(r.height));
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function tick(now) {
    if (!running) return;
    raf = requestAnimationFrame(tick);
    const dt = now - last; if (dt < frame * 0.85) return;
    last = now; t = now; acc = Math.min(dt, 100);
    ctx.clearRect(0, 0, w, h);
    for (const s of systems) { s.update(acc); s.draw(); }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    // lightning: at most one flash every 5 seconds, a short and soft flash (alpha capped), so it never strobes
    if (lightningOn) {
      nextBolt -= acc; if (nextBolt <= 0) { strike(); nextBolt = rnd(6000, 12000) / Math.max(0.4, lightningK * 1.5); }
    }
    if (bolt) {
      bolt.life += acc; const a = clamp(1 - bolt.life / 420, 0, 1);
      const draw = (p, wd) => { ctx.beginPath(); p.pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.lineWidth = wd; ctx.stroke(); p.branches.forEach((b) => draw(b, wd * 0.6)); };
      ctx.lineCap = 'round'; ctx.strokeStyle = rgba(light, 0.35 * a); draw(bolt.path, 7); ctx.strokeStyle = `rgba(245,248,255,${0.9 * a})`; draw(bolt.path, 1.6);
      if (bolt.life > 420) bolt = null;
    }
    if (flash > 0) { ctx.fillStyle = rgba(light, 0.14 * flash); ctx.fillRect(0, 0, w, h); flash = Math.max(0, flash - acc / 160); }
  }
  return {
    start() { if (running) return; running = true; resize(); last = performance.now(); raf = requestAnimationFrame(tick); },
    stop() { running = false; cancelAnimationFrame(raf); },
    resize, clear() { ctx.clearRect(0, 0, w, h); },
    get running() { return running; },
  };
}

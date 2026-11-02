// FILE: confetti.js
// PUNE ÎN: lib/confetti.js
// (fișier nou în proiectul wody-dashboard-main la această cale)

// A small, dependency-free confetti burst. Not a canvas-confetti npm
// package (that would be one more thing to `npm install` before this
// works at all, one more thing that can drift out of package-lock and
// break a deploy); this is ~60 lines of canvas drawing that does exactly
// the one thing this app needs it for: a short celebratory burst on a
// real milestone (see fireConfetti() call sites), nothing configurable
// beyond what's actually used.
//
// Respects prefers-reduced-motion: the celebration is a nice-to-have,
// not information, so anyone who's asked their OS for less motion just
// gets the toast/success message alone, no burst.

const COLORS = ['#e08a4e', '#e6cd8c', '#f2c091', '#a04820', '#ffffff'];

function makeCanvas() {
  const canvas = document.createElement('canvas');
  canvas.style.position = 'fixed';
  canvas.style.inset = '0';
  canvas.style.width = '100vw';
  canvas.style.height = '100vh';
  // Above normal page content so the burst reads on top of whatever
  // triggered it, but below anything that must stay interactive (this
  // canvas has no pointer events, so it never blocks clicks under it).
  canvas.style.zIndex = '9999';
  canvas.style.pointerEvents = 'none';
  document.body.appendChild(canvas);
  const dpr = window.devicePixelRatio || 1;
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  return { canvas, ctx };
}

function makePieces(count, originX, originY) {
  const pieces = [];
  for (let i = 0; i < count; i++) {
    const angle = (Math.random() * Math.PI) - Math.PI / 2 - Math.PI / 4; // upward-ish cone
    const speed = 6 + Math.random() * 8;
    pieces.push({
      x: originX,
      y: originY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: 5 + Math.random() * 5,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      rotation: Math.random() * 360,
      spin: (Math.random() - 0.5) * 18,
      shape: Math.random() < 0.5 ? 'rect' : 'circle',
      life: 1,
    });
  }
  return pieces;
}

// originX/originY: where the burst starts from, in CSS pixels (viewport
// coordinates). Defaults to top-centre, a reasonable spot for a
// page-level celebration that isn't tied to one specific button.
export function fireConfetti({ originX, originY, count = 140 } = {}) {
  if (typeof window === 'undefined') return;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

  const { canvas, ctx } = makeCanvas();
  const ox = originX ?? window.innerWidth / 2;
  const oy = originY ?? window.innerHeight * 0.25;
  let pieces = makePieces(count, ox, oy);
  const gravity = 0.28;
  const drag = 0.992;
  const start = performance.now();
  const maxDuration = 3200;

  function frame(now) {
    const elapsed = now - start;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let anyAlive = false;
    for (const p of pieces) {
      p.vx *= drag;
      p.vy = p.vy * drag + gravity;
      p.x += p.vx;
      p.y += p.vy;
      p.rotation += p.spin;
      // Fades over the back half of its life so pieces disappear
      // instead of abruptly vanishing at the timeout.
      p.life = Math.max(0, 1 - elapsed / maxDuration);
      if (p.life <= 0 || p.y > window.innerHeight + 40) continue;
      anyAlive = true;
      ctx.save();
      ctx.globalAlpha = p.life;
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rotation * Math.PI) / 180);
      ctx.fillStyle = p.color;
      if (p.shape === 'rect') {
        ctx.fillRect(-p.size / 2, -p.size / 3, p.size, p.size * 0.66);
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
    if (anyAlive && elapsed < maxDuration) {
      requestAnimationFrame(frame);
    } else {
      canvas.remove();
    }
  }
  requestAnimationFrame(frame);
}

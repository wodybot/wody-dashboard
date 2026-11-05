

const COLORS = ['#e08a4e', '#e6cd8c', '#f2c091', '#a04820', '#ffffff'];

function makeCanvas() {
  const canvas = document.createElement('canvas');
  canvas.style.position = 'fixed';
  canvas.style.inset = '0';
  canvas.style.width = '100vw';
  canvas.style.height = '100vh';
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
    const angle = (Math.random() * Math.PI) - Math.PI / 2 - Math.PI / 4;
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

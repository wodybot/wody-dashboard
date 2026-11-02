'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight } from 'lucide-react';

// Fallback list, only used if no `images` prop is passed in. In practice the
// homepage passes `images` from lib/screenshots.js, which auto-detects
// whatever files exist in /public/screenshots, any extension (png, jpg,
// jpeg, webp, gif...) works, no code changes needed when you swap images.
// Prefer .webp for new screenshots: much smaller files, same quality, and
// this carousel serves it correctly either way.
export const SCREENSHOTS = [
  '/screenshots/shot-1-v2.webp',
  '/screenshots/shot-2-v2.webp',
  '/screenshots/shot-3-v2.webp',
  '/screenshots/shot-4-v2.webp',
];

// How long a slide stays up before auto-advancing.
const AUTOPLAY_DELAY = 5000;

// Ember/spark palette pulled straight from the site's own accent gradient
// (see .gradient-primary / the color-grade overlay below) so the particles
// read as "part of the brand" instead of generic confetti.
const EMBER_COLORS = ['#e08a4e', '#c46a35', '#f4bd8d', '#ffb877', '#a3481c'];

// Canvas-based ember + firework field behind the screenshots. Pure
// decoration (aria-hidden, pointer-events none). Skips all motion for
// prefers-reduced-motion, still leaving the static aurora glow underneath.
function CarouselFX() {
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return undefined;
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let width = 0;
    let height = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    if (reduceMotion) {
      return () => window.removeEventListener('resize', resize);
    }

    const rand = (min, max) => min + Math.random() * (max - min);
    const pickColor = () => EMBER_COLORS[Math.floor(Math.random() * EMBER_COLORS.length)];

    // Steady stream of small glowing embers drifting upward, like heat
    // rising off the artwork.
    const makeEmber = () => ({
      x: rand(0, width),
      y: height + rand(0, 40),
      r: rand(1, 2.6),
      speed: rand(18, 42),
      drift: rand(-14, 14),
      phase: rand(0, Math.PI * 2),
      life: 0,
      maxLife: rand(3.5, 7),
      color: pickColor(),
    });
    let embers = Array.from({ length: 30 }, makeEmber);

    // Occasional firework-style bursts inside the frame for the "top 2026"
    // showcase moment, kept subtle so it never fights the screenshot.
    let bursts = [];
    let burstTimer = 0;
    let nextBurstAt = rand(1.5, 3.2);

    const makeBurst = () => {
      const cx = rand(width * 0.18, width * 0.82);
      const cy = rand(height * 0.2, height * 0.62);
      const color = pickColor();
      const sparks = Array.from({ length: 18 }, () => {
        const angle = rand(0, Math.PI * 2);
        const speed = rand(30, 95);
        return {
          x: cx,
          y: cy,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          r: rand(1, 2.2),
        };
      });
      return { sparks, life: 0, maxLife: rand(0.7, 1.05), color };
    };

    let last = performance.now();
    let raf;

    const tick = (now) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      ctx.clearRect(0, 0, width, height);

      embers.forEach((e) => {
        e.life += dt;
        e.y -= e.speed * dt;
        e.x += Math.sin(e.life * 1.6 + e.phase) * e.drift * dt;
        if (e.life >= e.maxLife || e.y < -20) {
          Object.assign(e, makeEmber());
          return;
        }
        const lifeRatio = e.life / e.maxLife;
        const fade = lifeRatio < 0.15
          ? lifeRatio / 0.15
          : lifeRatio > 0.75
            ? Math.max(0, 1 - (lifeRatio - 0.75) / 0.25)
            : 1;
        ctx.save();
        ctx.globalAlpha = fade * 0.85;
        ctx.shadowBlur = 8;
        ctx.shadowColor = e.color;
        ctx.fillStyle = e.color;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      burstTimer += dt;
      if (burstTimer >= nextBurstAt) {
        burstTimer = 0;
        nextBurstAt = rand(2.5, 5);
        bursts.push(makeBurst());
      }
      bursts = bursts.filter((b) => b.life < b.maxLife);
      bursts.forEach((b) => {
        b.life += dt;
        const t = b.life / b.maxLife;
        const alpha = Math.max(0, 1 - t);
        b.sparks.forEach((s) => {
          s.x += s.vx * dt;
          s.y += s.vy * dt;
          s.vy += 40 * dt;
          ctx.save();
          ctx.globalAlpha = alpha * 0.9;
          ctx.shadowBlur = 10;
          ctx.shadowColor = b.color;
          ctx.fillStyle = '#fff8ef';
          ctx.beginPath();
          ctx.arc(s.x, s.y, s.r * (1 - t * 0.4), 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        });
      });

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <div
      ref={wrapRef}
      aria-hidden="true"
      className="absolute inset-0 overflow-hidden pointer-events-none -z-10"
    >
      <canvas ref={canvasRef} className="block" />
    </div>
  );
}

export function ScreenshotCarousel({ images = SCREENSHOTS }) {
  const [index, setIndex] = useState(0);
  // If a listed image 404s (wrong filename/extension, deleted file, etc.)
  // hide it instead of showing a broken image forever.
  const [hidden, setHidden] = useState(() => new Set());
  const visible = images.filter((src) => !hidden.has(src));
  const count = visible.length;
  const safeIndex = count > 0 ? index % count : 0;

  const go = useCallback((dir) => {
    setIndex((i) => (i + dir + count) % count);
  }, [count]);

  const goTo = useCallback((i) => setIndex(i), []);

  // Autoplay every 5s. Re-armed every time `safeIndex` changes, including
  // from a manual arrow/dot click, so a click always buys a fresh 5s
  // before the next auto-advance, instead of fighting the user.
  useEffect(() => {
    if (count <= 1) return undefined;
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % count);
    }, AUTOPLAY_DELAY);
    return () => clearInterval(timer);
  }, [count, safeIndex]);

  const handleError = (src) => setHidden((prev) => new Set(prev).add(src));

  if (count === 0) return null;

  return (
    <div className="mt-20 mx-auto max-w-4xl">
      {/* Clean crossfade: only the current screenshot is visible, plain and
          unframed (no border/box/shadow), the neighboring slides sit
          beneath at opacity 0 so the transition is a soft fade, not a
          visible "preview" stack. */}
      <div className="relative w-full h-[260px] sm:h-[340px] md:h-[420px]">
        {/* Slow-rotating conic "aurora" ring, a premium, always-moving sheen
            behind the artwork instead of a static blob. */}
        <div
          aria-hidden="true"
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[140%] h-[140%] sm:w-[125%] sm:h-[125%] blur-3xl pointer-events-none -z-10 opacity-80"
        >
          <div
            className="w-full h-full"
            style={{
              background: 'conic-gradient(from 0deg, rgba(196,106,53,0) 0%, rgba(224,138,78,0.6) 14%, rgba(196,106,53,0) 32%, rgba(163,72,28,0) 52%, rgba(244,189,141,0.5) 68%, rgba(196,106,53,0) 88%, rgba(224,138,78,0.6) 100%)',
              animation: 'carouselAuroraSpin 16s linear infinite',
              // A conic-gradient fills its whole box uniformly at every
              // radius, it never fades out toward the edges the way a
              // radial-gradient does. Without this mask the blurred box
              // still reads as a faint square frame; the radial mask
              // dissolves it into a round halo instead.
              maskImage: 'radial-gradient(circle, black 0%, black 35%, transparent 72%)',
              WebkitMaskImage: 'radial-gradient(circle, black 0%, black 35%, transparent 72%)',
            }}
          />
        </div>

        {/* Ambient glow behind the image, a soft radial blob (no hard
            edges/corners at all, fades to fully transparent well before the
            blur even kicks in), gently pulsing in size/intensity instead of
            spinning. Same treatment as the page's own background glows. */}
        <div
          aria-hidden="true"
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[95%] h-[95%] sm:w-[85%] sm:h-[85%] blur-3xl pointer-events-none -z-10"
          style={{
            background: 'radial-gradient(circle, rgba(196,106,53,0.6) 0%, rgba(163,72,28,0.35) 42%, rgba(111,45,13,0) 72%)',
            animation: 'carouselGlowPulse 4s ease-in-out infinite',
          }}
        />

        {/* Rising embers + occasional firework bursts, all in the site's
            accent palette, sitting behind the screenshots. */}
        <CarouselFX />

        {visible.map((src, i) => (
          <div
            key={src}
            className="absolute inset-0 transition-opacity duration-700 ease-out"
            style={{
              opacity: i === safeIndex ? 1 : 0,
              zIndex: i === safeIndex ? 10 : 0,
              pointerEvents: i === safeIndex ? 'auto' : 'none',
              // Feather the whole slide (photo + color-grade layers below)
              // toward transparent at the edges, this is what actually
              // dissolves the screenshot into the page background instead
              // of cutting off in a hard rectangle, no matter what the
              // screenshot file itself looks like at its own edges.
              maskImage: 'radial-gradient(ellipse 78% 82% at 50% 50%, black 52%, transparent 96%)',
              WebkitMaskImage: 'radial-gradient(ellipse 78% 82% at 50% 50%, black 52%, transparent 96%)',
              maskRepeat: 'no-repeat',
              WebkitMaskRepeat: 'no-repeat',
              maskSize: '100% 100%',
              WebkitMaskSize: '100% 100%',
            }}
          >
            <Image
              src={src}
              alt={`Wody dashboard screenshot ${i + 1}`}
              fill
              sizes="(max-width: 640px) 92vw, (max-width: 1024px) 80vw, 900px"
              className="object-contain"
              priority={i === 0}
              loading={i === 0 ? undefined : 'lazy'}
              onError={() => handleError(src)}
            />
            {/* Color-grade overlay: nudges whatever screenshot gets dropped
                into /public/screenshots toward the site's own brown/orange
                palette (same gradient as .gradient-primary), so every image
                reads as "part of the site" instead of carrying its own
                colors. mix-blend-mode keeps the screenshot's detail/contrast
                intact, it only shifts the color grading, doesn't tint it
                into a flat color. */}
            <div
              aria-hidden="true"
              className="absolute inset-0 pointer-events-none mix-blend-overlay opacity-30"
              style={{ background: 'linear-gradient(135deg, #6f2d0d 0%, #a3481c 55%, #c46a35 100%)' }}
            />
            <div
              aria-hidden="true"
              className="absolute inset-0 pointer-events-none mix-blend-soft-light opacity-40"
              style={{ background: 'linear-gradient(160deg, #2a1608 0%, transparent 55%, #2a1608 100%)' }}
            />
          </div>
        ))}

        {/* Minimalist 2026-style arrows: no box, no border, just a thin
            chevron that brightens to the site's accent color on hover/tap,
            with a tiny nudge for a bit of premium polish. Bigger tap targets
            for mobile, sized down visually to stay unobtrusive. */}
        {count > 1 && (
          <>
            <button
              type="button"
              aria-label="Previous screenshot"
              onClick={() => go(-1)}
              className="group absolute left-0 sm:-left-6 top-1/2 -translate-y-1/2 z-20 w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center text-white/25 hover:text-[#e08a4e] active:text-[#e08a4e] transition-colors duration-300"
            >
              <ChevronLeft
                strokeWidth={1.5}
                className="w-8 h-8 sm:w-10 sm:h-10 transition-transform duration-300 group-hover:-translate-x-0.5"
              />
            </button>
            <button
              type="button"
              aria-label="Next screenshot"
              onClick={() => go(1)}
              className="group absolute right-0 sm:-right-6 top-1/2 -translate-y-1/2 z-20 w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center text-white/25 hover:text-[#e08a4e] active:text-[#e08a4e] transition-colors duration-300"
            >
              <ChevronRight
                strokeWidth={1.5}
                className="w-8 h-8 sm:w-10 sm:h-10 transition-transform duration-300 group-hover:translate-x-0.5"
              />
            </button>
          </>
        )}
      </div>

      {count > 1 && (
        <div className="flex items-center justify-center gap-1.5 mt-6">
          {visible.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Go to screenshot ${i + 1}`}
              onClick={() => goTo(i)}
              className={`h-1 rounded-full transition-all duration-300 ${i === safeIndex ? 'w-6 bg-[#e08a4e]' : 'w-1 bg-white/20 hover:bg-white/40'}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

'use client';
// Everything behind the page content: background, pattern, aurora, grain, vignette, scanlines and particles.
import { useEffect, useRef } from 'react';
import Particles from './Particles';

export default function Backdrop({ model, fixed = true }) {
  const { theme: th, background, pattern } = model;
  const imageRef = useRef(null);

  // Parallax: the background image moves slightly against the pointer and the scroll. Off for reduced motion.
  useEffect(() => {
    const el = imageRef.current;
    if (!el || !th.parallax || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined;
    let raf = 0; let x = 0; let y = 0;
    const apply = () => { raf = 0; el.style.transform = `translate3d(${x}px, ${y}px, 0)`; };
    const move = (e) => { x = (0.5 - e.clientX / window.innerWidth) * 24; y = (0.5 - e.clientY / window.innerHeight) * 24 - window.scrollY * 0.03; if (!raf) raf = requestAnimationFrame(apply); };
    window.addEventListener('pointermove', move, { passive: true });
    window.addEventListener('scroll', move, { passive: true });
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('scroll', move); if (raf) cancelAnimationFrame(raf); };
  }, [th.parallax]);

  const pos = fixed ? undefined : { position: 'absolute' };
  return (
    <>
      <div className="bp-bg" style={{ ...pos, '--bp-bg': 'none' }} aria-hidden="true">
        <div ref={imageRef} className="bp-bg-image" style={{ background }} />
        <div className="bp-bg-dim" />
        {pattern ? <div className="bp-pattern" style={{ backgroundImage: pattern.image, backgroundSize: pattern.size }} /> : null}
        {th.aurora ? <div className="bp-aurora" /> : null}
        <div className="bp-grain" /><div className="bp-vignette" /><div className="bp-scan" />
      </div>
      <Particles kind={th.particles} intensity={th.particle_intensity} speed={th.particle_speed} color={th.particle_color} fixed={fixed} />
    </>
  );
}

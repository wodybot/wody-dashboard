// FILE: halloween-assets.jsx
// PUNE ÎN: components/seasonal/halloween-assets.jsx
// (fișier nou în proiectul wody-dashboard-main la această cale)

'use client';
import { useId } from 'react';

// Same complexity level as components/autumn/leaf-assets.jsx: layered
// gradients for a sense of light/volume, fine internal detail (ribs,
// membrane creases, a carved face) rather than a flat silhouette, and a
// drop-shadow so each piece reads as a physical object. Palette pulled
// toward the site's own orange rather than generic Halloween black/neon
// green, so it reads as "this site, in October".

export function Bat({ className }) {
  const id = useId();
  return (
    <svg viewBox="0 0 100 60" className={className} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`${id}-g`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#332018" />
          <stop offset="55%" stopColor="#1c1109" />
          <stop offset="100%" stopColor="#0c0704" />
        </linearGradient>
        <filter id={`${id}-s`} x="-40%" y="-40%" width="180%" height="180%">
          <feDropShadow dx="0" dy="1.5" stdDeviation="1.4" floodColor="#000000" floodOpacity="0.4" />
        </filter>
      </defs>
      <g filter={`url(#${id}-s)`} fill={`url(#${id}-g)`}>
        <path d="M50 24c-3-11-15-20-29-19 6 5 10 11 12 17-11-5-23-4-32 3 9 2 16 6 21 12-10 0-18 5-24 12 9-1 18 0 25 4-7 4-12 10-13 18 8-6 14-10 21-11 4 7 10 12 19 14 9-2 15-7 19-14 7 1 13 5 21 11-1-8-6-14-13-18 7-4 16-5 25-4-6-7-14-12-24-12 5-6 12-10 21-12-9-7-21-8-32-3 2-6 6-12 12-17-14-1-26 8-29 19z" />
        {/* Membrane creases fanning out from each wingtip toward the
            body, the detail that keeps the wings from reading as flat
            triangles. */}
        <g stroke="#000000" strokeOpacity="0.4" strokeWidth="1" fill="none">
          <path d="M8 27c8 3 14 8 18 15M50 24c-4 7-6 14-6 22M21 45c6-3 11-8 15-15" />
          <path d="M92 27c-8 3-14 8-18 15M50 24c4 7 6 14 6 22M79 45c-6-3-11-8-15-15" />
        </g>
        {/* Small ears, easy to lose in a silhouette-only bat, present
            here so the head reads correctly even at a small size. */}
        <path d="M44 20c-2-4-1-8 1-10 1 3 2 6 4 8zM56 20c2-4 1-8-1-10-1 3-2 6-4 8z" />
      </g>
    </svg>
  );
}

export function Pumpkin({ className }) {
  const id = useId();
  return (
    <svg viewBox="0 0 100 92" className={className} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`${id}-g`} x1="20%" y1="0%" x2="85%" y2="100%">
          <stop offset="0%" stopColor="#f0994a" />
          <stop offset="50%" stopColor="#d16f23" />
          <stop offset="100%" stopColor="#8a3f10" />
        </linearGradient>
        <radialGradient id={`${id}-glow`} cx="50%" cy="55%" r="55%">
          <stop offset="0%" stopColor="#ffd88a" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#ffb347" stopOpacity="0.15" />
        </radialGradient>
        <filter id={`${id}-s`} x="-40%" y="-40%" width="180%" height="180%">
          <feDropShadow dx="0" dy="1.5" stdDeviation="1.6" floodColor="#1a0d05" floodOpacity="0.4" />
        </filter>
      </defs>
      <g filter={`url(#${id}-s)`}>
        <path d="M45 6c0-3 2-5 5-5s5 2 5 5v10h-10z" fill="#5c7a3a" />
        <path d="M55 8c4-2 8-1 9 2-3 1-6 2-8 4z" fill="#4a6530" />
        {/* Body built from four vertical lobes rather than one plain
            ellipse, the ridged-pumpkin silhouette this shape needs to
            read as a pumpkin rather than an orange ball. */}
        <g fill={`url(#${id}-g)`}>
          <ellipse cx="27" cy="56" rx="17" ry="32" />
          <ellipse cx="50" cy="58" rx="19" ry="34" />
          <ellipse cx="73" cy="56" rx="17" ry="32" />
        </g>
        <g stroke="#7a3410" strokeOpacity="0.45" strokeWidth="2" fill="none">
          <path d="M27 26c0 20 0 40 0 60M73 26c0 20 0 40 0 60" />
        </g>
        {/* The carved face: glow behind it first so the eyes/mouth read
            as lit-from-within, then the cut shapes on top in a near-black
            so they read as openings, not paint. */}
        <ellipse cx="50" cy="55" rx="26" ry="24" fill={`url(#${id}-glow)`} opacity="0.5" />
        <g fill="#2a1608">
          <path d="M32 46l9 5-9 5-3-5z" />
          <path d="M68 46l-9 5 9 5 3-5z" />
          <path d="M50 55l6 9h-12z" />
          <path d="M32 72c6 5 12 7 18 7s12-2 18-7c-3 5-9 9-18 9s-15-4-18-9z" />
        </g>
      </g>
    </svg>
  );
}

export function Ghost({ className }) {
  const id = useId();
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`${id}-g`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="70%" stopColor="#f0ebe3" />
          <stop offset="100%" stopColor="#d9cfc3" />
        </linearGradient>
        <filter id={`${id}-s`} x="-40%" y="-40%" width="180%" height="180%">
          <feDropShadow dx="0" dy="1.5" stdDeviation="1.6" floodColor="#1a0d05" floodOpacity="0.28" />
        </filter>
      </defs>
      <g filter={`url(#${id}-s)`}>
        {/* Bottom edge is a genuine wave (cubic curves) instead of sharp
            zigzag points, closer to a sheet drifting than a paper cutout. */}
        <path
          fill={`url(#${id}-g)`}
          d="M50 6C30 6 15 22 15 42v40c3-7 8-10 12-4 3-6 8-6 11 0 3-6 8-6 11 0 3-6 8-6 11 0 3-6 8-6 11 0 4-6 9-3 12 4V42C85 22 70 6 50 6z"
        />
        {/* Faint fold lines down the body, the detail that keeps a big
            plain white shape from looking flat. */}
        <g stroke="#c9beb2" strokeOpacity="0.5" strokeWidth="1.4" fill="none">
          <path d="M32 30c-2 18-2 34 0 50M50 26c-1 20-1 38 0 56M68 30c2 18 2 34 0 50" />
        </g>
        <circle cx="38" cy="40" r="5" fill="#2b2320" />
        <circle cx="62" cy="40" r="5" fill="#2b2320" />
        <path d="M44 54c2 3 4 4 6 4s4-1 6-4" stroke="#2b2320" strokeWidth="2.2" strokeLinecap="round" fill="none" />
      </g>
    </svg>
  );
}

// Witch on a broom, flying right. Drawn already tilted slightly nose-down so
// that falling straight down reads as a glide rather than a drop.
export function Witch({ className }) {
  const id = useId();
  return (
    <svg viewBox="-8 -6 134 104" className={className} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`${id}-dress`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#4a2d63" />
          <stop offset="100%" stopColor="#1d1029" />
        </linearGradient>
        <linearGradient id={`${id}-hat`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#3a2250" />
          <stop offset="100%" stopColor="#140a1c" />
        </linearGradient>
        <filter id={`${id}-s`} x="-40%" y="-40%" width="180%" height="180%">
          <feDropShadow dx="0" dy="1.5" stdDeviation="1.6" floodColor="#1a0d05" floodOpacity="0.4" />
        </filter>
      </defs>
      <g filter={`url(#${id}-s)`}>
        <g transform="rotate(10 60 45)">
          {/* Broom: handle first, bristles flaring out at the tail. */}
          <path d="M24 62L108 40" stroke="#7a4a22" strokeWidth="4.5" strokeLinecap="round" />
          <path d="M26 56L3 44 1 56 6 62 2 74 26 66z" fill="#c98a3c" />
          <path d="M22 58L8 52M22 61L6 61M22 64L8 70" stroke="#8a5a22" strokeWidth="1.2" fill="none" />
          <path d="M26 56c-2 4-2 7 0 10" stroke="#5a3515" strokeWidth="3" fill="none" strokeLinecap="round" />
          {/* Dangling legs and pointed shoes. */}
          <path d="M60 58l-4 15M70 55l-1 15" stroke="#1d1029" strokeWidth="5" strokeLinecap="round" />
          <path d="M52 73l8 1 1 4-10 0zM65 70l8 1 1 4-10 0z" fill="#2a1608" />
          {/* Dress/cape streaming back behind her. */}
          <path d="M54 62C48 48 56 36 68 34c8 0 14 6 14 14l-3 12C72 63 62 65 54 62z" fill={`url(#${id}-dress)`} />
          <path d="M56 56C46 58 38 56 32 60c8 1 14 5 24 4z" fill="#2b1840" />
          {/* Arm reaching the handle. */}
          <path d="M76 42l16 0" stroke="#3a2250" strokeWidth="4.5" strokeLinecap="round" />
          <circle cx="93" cy="42" r="2.6" fill="#a8cf7a" />
          {/* Hair streaming behind, then head. */}
          <path d="M70 22c-8 0-16 3-22 10 8-1 12 0 17 4 0-5 3-10 5-14z" fill="#e3822f" />
          <circle cx="76" cy="27" r="8" fill="#b9d98f" />
          <path d="M80 25l5 2-5 2z" fill="#a8cf7a" />
          <circle cx="79.5" cy="24.5" r="1.3" fill="#2a1608" />
          <path d="M78 31c2 1 4 1 6 0" stroke="#2a1608" strokeWidth="1.2" fill="none" strokeLinecap="round" />
          {/* Hat: wide brim, bent cone, buckle. */}
          <ellipse cx="75" cy="19" rx="15" ry="4" fill="#150b1d" />
          <path d="M65 19C66 10 70 5 78 -4c-1 5 0 8 6 14 3 3 4 6 5 9z" fill={`url(#${id}-hat)`} transform="translate(0 6)" />
          <path d="M66 18c6 2 16 2 22 0v3c-6 2-16 2-22 0z" fill="#e3822f" />
          <rect x="75" y="17.5" width="5" height="4.5" rx="0.8" fill="#f2c14e" />
        </g>
      </g>
    </svg>
  );
}

// Bubbling cauldron with a glowing green brew. The only piece that uses a
// "cold" colour, which is deliberate: it needs to pop against the orange.
export function Cauldron({ className }) {
  const id = useId();
  return (
    <svg viewBox="0 0 100 104" className={className} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`${id}-pot`} x1="10%" y1="0%" x2="90%" y2="100%">
          <stop offset="0%" stopColor="#4a4a52" />
          <stop offset="45%" stopColor="#25252b" />
          <stop offset="100%" stopColor="#0d0d10" />
        </linearGradient>
        <radialGradient id={`${id}-brew`} cx="50%" cy="50%" r="60%">
          <stop offset="0%" stopColor="#d6ff8a" />
          <stop offset="100%" stopColor="#5fbf2a" />
        </radialGradient>
        <filter id={`${id}-s`} x="-40%" y="-40%" width="180%" height="180%">
          <feDropShadow dx="0" dy="1.5" stdDeviation="1.6" floodColor="#1a0d05" floodOpacity="0.4" />
        </filter>
      </defs>
      <g filter={`url(#${id}-s)`}>
        {/* Little flames under the legs. */}
        <path d="M34 98c-4-6 0-9-1-14 5 3 8 8 6 14zM50 98c-5-7 0-11-1-17 6 4 10 10 7 17zM66 98c-4-6 0-9-1-14 5 3 8 8 6 14z" fill="#f2992e" />
        <path d="M50 98c-2-4 0-6 0-9 3 2 5 5 3 9z" fill="#ffd36b" />
        {/* Legs, side handles, body, rim. */}
        <path d="M26 82l-6 12M74 82l6 12" stroke="#1a1a1f" strokeWidth="5" strokeLinecap="round" />
        <path d="M14 46c-9-1-10 11 0 12M86 46c9-1 10 11 0 12" stroke="#25252b" strokeWidth="4" fill="none" strokeLinecap="round" />
        <path d="M14 44C6 66 16 90 50 92c34-2 44-26 36-48z" fill={`url(#${id}-pot)`} />
        <path d="M24 58c-2 10 0 20 6 26" stroke="#ffffff" strokeOpacity="0.18" strokeWidth="3" fill="none" strokeLinecap="round" />
        <ellipse cx="50" cy="44" rx="37" ry="10" fill="#17171b" />
        <ellipse cx="50" cy="44" rx="31" ry="7" fill={`url(#${id}-brew)`} />
        {/* Bubbles rising and a wisp of steam. */}
        <g fill="#c4f57a" stroke="#7fd13a" strokeWidth="1">
          <circle cx="38" cy="36" r="5" />
          <circle cx="60" cy="31" r="3.6" />
          <circle cx="49" cy="22" r="2.6" />
          <circle cx="68" cy="16" r="2" />
        </g>
        <path d="M42 12c-3-3 3-5 0-9" stroke="#d6ff8a" strokeOpacity="0.45" strokeWidth="2" fill="none" strokeLinecap="round" />
      </g>
    </svg>
  );
}

// Hanging spider. The thread is part of the piece, so as it falls it reads
// as a spider dropping on a line.
export function Spider({ className }) {
  const id = useId();
  return (
    <svg viewBox="0 0 100 104" className={className} aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id={`${id}-g`} cx="40%" cy="35%" r="70%">
          <stop offset="0%" stopColor="#4a2d22" />
          <stop offset="100%" stopColor="#0e0704" />
        </radialGradient>
        <filter id={`${id}-s`} x="-40%" y="-40%" width="180%" height="180%">
          <feDropShadow dx="0" dy="1.5" stdDeviation="1.4" floodColor="#000000" floodOpacity="0.4" />
        </filter>
      </defs>
      <g filter={`url(#${id}-s)`}>
        <path d="M50 0V40" stroke="#d9d0c4" strokeOpacity="0.7" strokeWidth="1.2" />
        <g stroke="#5a3a2a" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round">
          <path d="M42 56L22 46 10 60M42 62L18 62 8 78M43 68L22 78 16 94M45 72L34 86 32 98" />
          <path d="M58 56L78 46 90 60M58 62L82 62 92 78M57 68L78 78 84 94M55 72L66 86 68 98" />
        </g>
        <ellipse cx="50" cy="66" rx="15" ry="17" fill={`url(#${id}-g)`} />
        <path d="M50 54l4 6-4 6-4-6z" fill="#e3822f" opacity="0.85" />
        <circle cx="50" cy="46" r="9" fill={`url(#${id}-g)`} />
        <circle cx="46.5" cy="44.5" r="2.4" fill="#ffd36b" />
        <circle cx="53.5" cy="44.5" r="2.4" fill="#ffd36b" />
        <circle cx="46.5" cy="44.5" r="1" fill="#1a0f09" />
        <circle cx="53.5" cy="44.5" r="1" fill="#1a0f09" />
      </g>
    </svg>
  );
}

// Candy corn: three coloured bands clipped to one rounded triangle.
export function CandyCorn({ className }) {
  const id = useId();
  return (
    <svg viewBox="0 0 70 100" className={className} aria-hidden="true" focusable="false">
      <defs>
        <clipPath id={`${id}-c`}>
          <path d="M35 4c4 0 7 5 9 12l20 64c3 9-2 16-11 16H17C8 96 3 89 6 80l20-64C28 9 31 4 35 4z" />
        </clipPath>
        <filter id={`${id}-s`} x="-40%" y="-40%" width="180%" height="180%">
          <feDropShadow dx="0" dy="1.5" stdDeviation="1.5" floodColor="#1a0d05" floodOpacity="0.35" />
        </filter>
      </defs>
      <g filter={`url(#${id}-s)`}>
        <g clipPath={`url(#${id}-c)`}>
          <rect x="0" y="0" width="70" height="38" fill="#fbf3e2" />
          <rect x="0" y="38" width="70" height="30" fill="#f2992e" />
          <rect x="0" y="68" width="70" height="32" fill="#f7cf45" />
          <path d="M0 38q35 6 70 0v3q-35 6-70 0zM0 68q35 6 70 0v3q-35 6-70 0z" fill="#000000" opacity="0.08" />
          <path d="M18 40c-4 18-8 36-9 52" stroke="#ffffff" strokeOpacity="0.35" strokeWidth="4" fill="none" strokeLinecap="round" />
        </g>
      </g>
    </svg>
  );
}

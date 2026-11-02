// FILE: snow-assets.jsx
// PUNE ÎN: components/seasonal/snow-assets.jsx
// (fișier nou în proiectul wody-dashboard-main la această cale)

'use client';
import { useId } from 'react';

// Same visual language and complexity level as components/autumn/leaf-assets.jsx
// (a soft directional gradient for a sense of light, fine internal detail
// so it doesn't read as a flat icon, a subtle drop-shadow so each piece
// feels like a physical object), just a cool white/ice-blue palette. Every
// component takes only `className`, no colors/ids to configure, each
// instance mints its own gradient/filter ids via useId().

// A real dendrite snow crystal: six main arms radiating from the centre,
// each with smaller side branches at a fixed angle, tapering toward the
// tip. This is the main "hero" piece, the one that actually reads as
// "snowflake" rather than "generic sparkle".
export function DendriteSnowflake({ className }) {
  const id = useId();
  const arm = (
    <g>
      <line x1="50" y1="50" x2="50" y2="8" strokeLinecap="round" />
      {/* Side branches, mirrored, getting shorter toward the tip. */}
      <line x1="50" y1="34" x2="38" y2="24" strokeLinecap="round" />
      <line x1="50" y1="34" x2="62" y2="24" strokeLinecap="round" />
      <line x1="50" y1="22" x2="42" y2="15" strokeLinecap="round" />
      <line x1="50" y1="22" x2="58" y2="15" strokeLinecap="round" />
      {/* Tip fans out into three small points rather than a bare line end. */}
      <path d="M50 8 L46 14 M50 8 L54 14" strokeLinecap="round" />
    </g>
  );
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`${id}-g`} x1="15%" y1="0%" x2="85%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="60%" stopColor="#e4f2fb" />
          <stop offset="100%" stopColor="#bcdcf0" />
        </linearGradient>
        <filter id={`${id}-s`} x="-40%" y="-40%" width="180%" height="180%">
          <feDropShadow dx="0" dy="1" stdDeviation="1.3" floodColor="#0a1b2a" floodOpacity="0.28" />
        </filter>
      </defs>
      <g
        filter={`url(#${id}-s)`}
        stroke={`url(#${id}-g)`}
        strokeWidth="3.2"
        fill="none"
      >
        <g transform="rotate(0 50 50)">{arm}</g>
        <g transform="rotate(60 50 50)">{arm}</g>
        <g transform="rotate(120 50 50)">{arm}</g>
        <g transform="rotate(180 50 50)">{arm}</g>
        <g transform="rotate(240 50 50)">{arm}</g>
        <g transform="rotate(300 50 50)">{arm}</g>
      </g>
      <circle cx="50" cy="50" r="4.5" fill={`url(#${id}-g)`} filter={`url(#${id}-s)`} />
    </svg>
  );
}

// A hexagonal "plate" crystal, the other common real snow-crystal shape
// (flat hexagonal plates rather than branching dendrites), with faint
// internal facet lines so it reads as ice rather than a flat sticker.
export function PlateSnowflake({ className }) {
  const id = useId();
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`${id}-g`} x1="10%" y1="0%" x2="90%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#cfe6f7" />
        </linearGradient>
        <filter id={`${id}-s`} x="-40%" y="-40%" width="180%" height="180%">
          <feDropShadow dx="0" dy="1" stdDeviation="1.2" floodColor="#0a1b2a" floodOpacity="0.25" />
        </filter>
      </defs>
      <g filter={`url(#${id}-s)`}>
        <path
          fill={`url(#${id}-g)`}
          fillOpacity="0.9"
          d="M50 6 L84 27 L84 73 L50 94 L16 73 L16 27 Z"
        />
        <g stroke="#8fb9d6" strokeOpacity="0.5" strokeWidth="1.4" fill="none">
          <path d="M50 6 L50 94 M16 27 L84 73 M84 27 L16 73" />
          <path d="M50 6 L84 27 L84 73 L50 94 L16 73 L16 27 Z" strokeOpacity="0.35" />
        </g>
      </g>
    </svg>
  );
}

// Small background "snow dust", for the pieces that are just distant/tiny
// flakes filling out the field rather than a hero crystal, still with a
// faint six-point hint instead of a bare circle so it doesn't read as a
// generic dot at a glance.
export function DustSnowflake({ className }) {
  const id = useId();
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id={`${id}-g`}>
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#dceefb" />
        </radialGradient>
        <filter id={`${id}-s`} x="-40%" y="-40%" width="180%" height="180%">
          <feDropShadow dx="0" dy="0.6" stdDeviation="0.8" floodColor="#0a1b2a" floodOpacity="0.2" />
        </filter>
      </defs>
      <g filter={`url(#${id}-s)`} stroke={`url(#${id}-g)`} strokeWidth="6" strokeLinecap="round">
        <line x1="50" y1="20" x2="50" y2="80" />
        <line x1="24" y1="35" x2="76" y2="65" />
        <line x1="76" y1="35" x2="24" y2="65" />
      </g>
      <circle cx="50" cy="50" r="9" fill={`url(#${id}-g)`} />
    </svg>
  );
}

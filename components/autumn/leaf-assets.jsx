'use client';
import { useId } from 'react';


export function MapleLeaf({ className }) {
  const id = useId();
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`${id}-g`} x1="20%" y1="0%" x2="85%" y2="100%">
          <stop offset="0%" stopColor="#c9702f" />
          <stop offset="45%" stopColor="#a8501f" />
          <stop offset="100%" stopColor="#7a3417" />
        </linearGradient>
        <filter id={`${id}-s`} x="-40%" y="-40%" width="180%" height="180%">
          <feDropShadow dx="0" dy="1.5" stdDeviation="1.6" floodColor="#1a0d05" floodOpacity="0.35" />
        </filter>
      </defs>
      <g filter={`url(#${id}-s)`}>
        <path
          fill={`url(#${id}-g)`}
          d="M50 6c2 8 5 14 10 19 5-3 9-8 11-14 1 7-1 14-5 20 7-1 13-4 18-9-2 8-8 14-15 18 6 2 12 2 18 0-5 7-13 11-21 11 3 6 8 10 14 13-8 2-16 1-23-3 1 7 3 13 7 18-8-2-14-7-18-13-3 6-4 13-3 20-6-6-9-13-10-21-3 7-8 12-15 15 1-8 4-15 9-21-8 2-15 6-20 13-1-8 2-16 8-22-8 1-16-1-22-6 7-3 15-4 22-2-6-5-10-12-11-19 7 3 13 8 17 14 0-8 2-15 7-21 2 8 3 15 1 22 4-6 6-13 6-21z"
        />
        <path
          d="M50 16c0 22 0 44 3 62"
          stroke="#2c1608" strokeOpacity="0.32" strokeWidth="1.1" fill="none" strokeLinecap="round"
        />
      </g>
    </svg>
  );
}

export function OvalLeaf({ className }) {
  const id = useId();
  return (
    <svg viewBox="0 0 60 100" className={className} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`${id}-g`} x1="10%" y1="0%" x2="90%" y2="100%">
          <stop offset="0%" stopColor="#d8a13a" />
          <stop offset="55%" stopColor="#b9822a" />
          <stop offset="100%" stopColor="#8a5a1c" />
        </linearGradient>
        <filter id={`${id}-s`} x="-40%" y="-40%" width="180%" height="180%">
          <feDropShadow dx="0" dy="1.2" stdDeviation="1.3" floodColor="#1a0d05" floodOpacity="0.32" />
        </filter>
      </defs>
      <g filter={`url(#${id}-s)`}>
        <path
          fill={`url(#${id}-g)`}
          d="M30 4c14 10 22 26 22 44 0 20-9 36-22 48C17 84 8 68 8 48 8 30 16 14 30 4z"
        />
        <path d="M30 10c0 28 0 56 0 82" stroke="#2c1608" strokeOpacity="0.3" strokeWidth="1" fill="none" strokeLinecap="round" />
        <path d="M30 30c-6 4-10 9-12 15M30 30c6 4 10 9 12 15M30 55c-5 3-9 8-10 13M30 55c5 3 9 8 10 13"
          stroke="#2c1608" strokeOpacity="0.22" strokeWidth="0.8" fill="none" strokeLinecap="round" />
      </g>
    </svg>
  );
}

export function OakLeaf({ className }) {
  const id = useId();
  return (
    <svg viewBox="0 0 70 100" className={className} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`${id}-g`} x1="15%" y1="0%" x2="85%" y2="100%">
          <stop offset="0%" stopColor="#9c6b28" />
          <stop offset="50%" stopColor="#7d4a1c" />
          <stop offset="100%" stopColor="#5c3413" />
        </linearGradient>
        <filter id={`${id}-s`} x="-40%" y="-40%" width="180%" height="180%">
          <feDropShadow dx="0" dy="1.4" stdDeviation="1.5" floodColor="#150a04" floodOpacity="0.38" />
        </filter>
      </defs>
      <g filter={`url(#${id}-s)`}>
        <path
          fill={`url(#${id}-g)`}
          d="M35 4c3 6 3 11 1 16 4-2 7-6 8-11 2 5 1 11-2 16 4-1 8-4 10-8 0 5-2 10-6 14 4 0 8-2 11-5-1 5-5 9-10 11 4 1 8 1 12-1-3 4-8 7-13 8 3 2 7 3 11 3-4 3-9 4-14 3 2 3 5 5 8 6-5 1-10 0-14-2 1 3 2 6 4 9-5-1-9-4-12-8-1 4-1 8 0 12-4-3-7-7-8-12-2 4-5 8-9 10 0-5 1-10 3-14-4 3-9 4-14 4 2-4 6-8 10-10-5 0-9-1-13-4 4-2 9-3 13-2-4-2-7-6-9-10 4 0 9 1 12 4-2-4-3-9-2-14 3 3 6 7 8 11-1-5 0-11 2-16 3 3 4 8 4 13 1-5 3-10 6-14z"
        />
      </g>
    </svg>
  );
}

export function TwigLeaves({ className }) {
  const id = useId();
  return (
    <svg viewBox="0 0 120 60" className={className} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`${id}-g`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#c9702f" />
          <stop offset="100%" stopColor="#8a4a1c" />
        </linearGradient>
        <filter id={`${id}-s`} x="-40%" y="-40%" width="180%" height="180%">
          <feDropShadow dx="0" dy="1" stdDeviation="1.1" floodColor="#1a0d05" floodOpacity="0.3" />
        </filter>
      </defs>
      <g filter={`url(#${id}-s)`}>
        <path d="M4 54C30 44 58 30 108 8" stroke="#5c3a20" strokeWidth="2" fill="none" strokeLinecap="round" />
        <path d="M40 40c-2-8 1-15 8-19 1 8-1 15-8 19z" fill={`url(#${id}-g)`} />
        <path d="M62 28c-2-8 1-15 8-19 1 8-1 15-8 19z" fill={`url(#${id}-g)`} />
        <path d="M84 17c-2-8 1-15 8-19 1 8-1 15-8 19z" fill={`url(#${id}-g)`} />
      </g>
    </svg>
  );
}

export function Acorn({ className }) {
  const id = useId();
  return (
    <svg viewBox="0 0 60 70" className={className} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`${id}-body`} x1="10%" y1="0%" x2="90%" y2="100%">
          <stop offset="0%" stopColor="#c78a3f" />
          <stop offset="100%" stopColor="#8a5a1c" />
        </linearGradient>
        <linearGradient id={`${id}-cap`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#6b4423" />
          <stop offset="100%" stopColor="#3f280f" />
        </linearGradient>
        <filter id={`${id}-s`} x="-40%" y="-40%" width="180%" height="180%">
          <feDropShadow dx="0" dy="1.4" stdDeviation="1.4" floodColor="#150a04" floodOpacity="0.38" />
        </filter>
      </defs>
      <g filter={`url(#${id}-s)`}>
        <ellipse cx="30" cy="42" rx="17" ry="20" fill={`url(#${id}-body)`} />
        <path d="M12 30c0-9 8-16 18-16s18 7 18 16c-6-4-12-6-18-6s-12 2-18 6z" fill={`url(#${id}-cap)`} />
        <rect x="27" y="6" width="4" height="9" rx="2" fill="#3f280f" />
      </g>
    </svg>
  );
}

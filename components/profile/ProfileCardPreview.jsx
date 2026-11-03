'use client';

import { useEffect, useRef, useState } from 'react';
import { cardFontStyle } from '@/lib/card-fonts';
import { proxiedImageUrl } from '@/lib/utils';
import { SvgScene } from '@/components/scenes';

const W = 934;
const H = 282;
const AV = { small: 120, medium: 170, large: 222 };

const css = (v) => `${(v / W) * 100}cqw`;
const LOOP = '1.92s';

function points(n, seed) {
  let x = seed;
  const next = () => { x = (x * 1664525 + 1013904223) % 4294967296; return x / 4294967296; };
  return Array.from({ length: n }, () => ({ x: next() * 100, y: next() * 100, r: 0.5 + next() * 1.1, d: next() }));
}
const STARS = points(26, 11);
const BUBBLES = points(14, 5);
const FLAKES = points(34, 9);

function Anim({ kind, accent }) {
  const ref = useRef(null);
  const [seen, setSeen] = useState(true);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return undefined;
    const io = new IntersectionObserver(([entry]) => setSeen(entry.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, [kind]);
  if (!kind || kind === 'none') return null;
  const dot = (p, i, extra) => <span key={i} className="absolute rounded-full" style={{ left: `${p.x}%`, width: css(p.r * 7), height: css(p.r * 7), ...extra(p) }} />;
  return (
    <div ref={ref} data-paused={seen ? 'false' : 'true'} className="pc-anim pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true" style={{ borderRadius: 'inherit' }}>
      {kind === 'shimmer' && <div className="absolute inset-y-0 left-0" style={{ width: '14%', background: 'linear-gradient(90deg, transparent, rgba(255,255,255,.3), transparent)', animation: `pcShimmer ${LOOP} linear infinite` }} />}
      {kind === 'stars' && STARS.map((p, i) => <span key={i} className="absolute" style={{ left: `${p.x}%`, top: `${p.y}%`, width: css(p.r * 6), height: css(p.r * 6), background: '#fff', clipPath: 'polygon(50% 0, 62% 38%, 100% 50%, 62% 62%, 50% 100%, 38% 62%, 0 50%, 38% 38%)', animation: `pcTwinkle ${LOOP} ease-in-out ${-p.d * 1.92}s infinite` }} />)}
      {kind === 'aurora' && [[accent, 10, 30], ['#78c8ff', 40, 55], ['#be8cff', 62, 25]].map(([c, x, y], i) => (
        <div key={i} className="absolute rounded-full" style={{ left: `${x}%`, top: `${y}%`, width: '36%', height: '46%', background: c, opacity: 0.4, filter: `blur(${css(30)})`, animation: `pcDrift ${LOOP} ease-in-out ${-i * 0.64}s infinite` }} />
      ))}
      {kind === 'bubbles' && BUBBLES.map((p, i) => dot(p, i, (q) => ({ top: '112%', border: '1px solid rgba(255,255,255,.5)', background: 'rgba(255,255,255,.1)', animation: `pcRise ${i % 3 === 0 ? '0.96s' : LOOP} linear ${-q.d * 1.92}s infinite` })))}
      {kind === 'snow' && FLAKES.map((p, i) => dot({ ...p, r: p.r * 0.45 }, i, (q) => ({ top: '-6%', background: 'rgba(255,255,255,.8)', animation: `pcFall ${i % 3 === 0 ? '0.96s' : LOOP} linear ${-q.d * 1.92}s infinite` })))}
      {kind === 'scan' && (
        <>
          <div className="absolute inset-0" style={{ backgroundImage: 'repeating-linear-gradient(0deg, rgba(0,0,0,.1) 0, rgba(0,0,0,.1) 1px, transparent 1px, transparent 4px)' }} />
          <div className="absolute inset-x-0" style={{ height: css(6), background: accent, opacity: 0.6, filter: `blur(${css(3)})`, animation: `pcScan ${LOOP} linear infinite` }} />
        </>
      )}
      {kind === 'pulse' && <div className="absolute" style={{ inset: css(3), border: `${css(6)} solid ${accent}`, borderRadius: css(22), filter: `blur(${css(4)})`, animation: `pcPulse ${LOOP} ease-in-out infinite` }} />}
    </div>
  );
}

function Deco({ kind, accent }) {
  if (kind === 'none') return null;
  if (kind === 'dots') {
    return <div className="absolute inset-0" style={{ backgroundImage: `radial-gradient(${accent}55 ${css(2)}, transparent ${css(2.4)})`, backgroundSize: `${css(26)} ${css(26)}`, WebkitMaskImage: 'linear-gradient(90deg, transparent 45%, #000 60%)', maskImage: 'linear-gradient(90deg, transparent 45%, #000 60%)' }} />;
  }
  if (kind === 'lines') {
    return <div className="absolute inset-0" style={{ backgroundImage: `repeating-linear-gradient(45deg, ${accent}30 0, ${accent}30 ${css(2)}, transparent ${css(2)}, transparent ${css(34)})` }} />;
  }
  if (kind === 'sparkles') {
    const pts = [[60, 40, 9], [210, 230, 6], [330, 60, 7], [470, 200, 8], [600, 36, 6], [700, 120, 10], [820, 220, 7], [880, 50, 8], [140, 140, 5], [560, 250, 6]];
    return <>{pts.map(([x, y, r], i) => <span key={i} className="absolute" style={{ left: css(x), top: css(y), width: css(r * 2), height: css(r * 2), background: `${accent}99`, clipPath: 'polygon(50% 0, 62% 38%, 100% 50%, 62% 62%, 50% 100%, 38% 62%, 0 50%, 38% 38%)' }} />)}</>;
  }
  return (
    <svg className="absolute inset-x-0 bottom-0 w-full" viewBox="0 0 934 120" preserveAspectRatio="none" style={{ height: css(120) }} aria-hidden="true">
      {[0, 1, 2].map((k) => <path key={k} d={`M0 ${70 + k * 16} ${Array.from({ length: 24 }, (_, n) => `L${n * 40} ${70 + k * 16 + Math.sin(n * 0.7 + k) * 9}`).join(' ')}`} fill="none" stroke={accent} strokeOpacity={0.2 - k * 0.04} strokeWidth="3" />)}
    </svg>
  );
}

export default function ProfileCardPreview({ cfg, name, avatarSrc, level = 12, xp = 429, needed = 1337, rank = 3, levelText, rankText, xpText, tagline = null }) {
  const bare = tagline !== null;
  const compact = cfg.layout === 'compact';
  const pad = compact ? 24 : 30;
  const centered = cfg.layout === 'centered' || cfg.avatar_pos === 'center';
  let av = AV[cfg.avatar_size] || 170;
  if (compact) av = Math.min(av, 120);
  if (centered) av = Math.min(av, 108);
  av = Math.min(av, H - 2 * pad);
  const ratio = needed > 0 ? Math.max(0, Math.min(1, xp / needed)) : 0;
  const gap = 34;
  let ax; let ay; let tx0; let tx1;
  if (centered) { ax = (W - av) / 2; ay = pad - 4; tx0 = pad; tx1 = W - pad; } else {
    ay = (H - av) / 2;
    if (cfg.avatar_pos === 'left') { ax = pad; tx0 = ax + av + gap; tx1 = W - pad; } else { ax = W - pad - av; tx0 = pad; tx1 = ax - gap; }
  }
  const nameStart = compact ? 30 : 42;
  const barH = compact ? 16 : 26;
  const statFont = compact ? 24 : 30;
  const small = compact ? 18 : 22;
  const asideStats = !bare && (cfg.stats_pos === 'right' || cfg.layout === 'split');
  const accent = cfg.accent;
  const shadow = `0 ${css(1.5)} ${css(2)} rgba(0,0,0,.45)`;
  const muted = `${cfg.text_color}c0`;

  const bgImage = cfg.bg_mode === 'image' && (cfg.bg_image ? `/api/profile-card/image/${cfg.bg_image}` : cfg.bg_url || null);
  let bg;
  if (cfg.bg_mode === 'solid') bg = { backgroundColor: cfg.bg_color };
  else if (bgImage) bg = { backgroundColor: cfg.overlay_color };
  else bg = { background: `linear-gradient(${(cfg.gradient_angle + 90) % 360}deg, ${cfg.gradient_from}, ${cfg.gradient_to})` };
  const shape = cfg.avatar_shape === 'circle' ? '50%' : cfg.avatar_shape === 'rounded' ? '20%' : '0';
  const glow = cfg.effect === 'glow';

  const bar = () => {
    const track = cfg.bar_track;
    const fill = cfg.bar_color;
    if (cfg.bar_style === 'segmented') {
      const on = ratio <= 0 ? 0 : Math.max(1, Math.round(ratio * 20));
      return <div className="flex h-full w-full" style={{ gap: css(3) }}>{Array.from({ length: 20 }, (_, i) => <span key={i} className="h-full flex-1" style={{ background: i < on ? fill : track, borderRadius: css(2) }} />)}</div>;
    }
    const r = cfg.bar_style === 'flat' ? css(3) : css(barH / 2);
    return (
      <div className="h-full w-full overflow-visible" style={{ background: track, borderRadius: r }}>
        <div className="h-full" style={{ width: `${Math.max(ratio * 100, ratio > 0 ? (barH / (tx1 - tx0)) * 100 : 0)}%`, background: fill, borderRadius: r, boxShadow: cfg.bar_style === 'glow' ? `0 0 ${css(14)} ${fill}` : undefined }} />
      </div>
    );
  };

  const nameBox = (left, right, top) => ({ position: 'absolute', left: css(left), right: css(W - right), top: css(top), fontSize: css(nameStart), lineHeight: 1.1, fontWeight: 700, color: cfg.text_color, textShadow: shadow, textAlign: cfg.name_align, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' });
  const line = bare ? tagline : [levelText, rankText, xpText].filter(Boolean).join('  ·  ');

  return (
    <div className="relative w-full" style={{ aspectRatio: `${W}/${H}`, containerType: 'inline-size' }}>
    <div
      className="absolute inset-0 select-none overflow-hidden"
      style={{ borderRadius: css(cfg.radius), ...bg, ...cardFontStyle(cfg.font === 'bold' ? undefined : cfg.font), fontWeight: cfg.font === 'bold' ? 700 : undefined }}
    >
      {bgImage && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={proxiedImageUrl(bgImage)} alt="" referrerPolicy="no-referrer" className="absolute inset-0 h-full w-full object-cover" draggable="false" />
          <div className="absolute inset-0" style={{ background: cfg.overlay_color, opacity: cfg.bg_opacity / 100 }} />
        </>
      )}
      {cfg.scene && cfg.scene !== 'none' && cfg.bg_mode !== 'solid' && !bgImage ? <SvgScene kind={cfg.scene} /> : null}
      <Deco kind={cfg.decoration} accent={accent} />
      {cfg.effect === 'vignette' && <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at center, transparent 45%, rgba(0,0,0,.6) 100%)' }} />}
      {cfg.effect === 'noise' && <div className="absolute inset-0 opacity-[0.12] mix-blend-overlay" style={{ backgroundImage: 'repeating-conic-gradient(#fff 0 25%, #000 0 50%)', backgroundSize: '3px 3px' }} />}
      {cfg.effect === 'glass' && <div className="absolute backdrop-blur-md" style={{ inset: css(pad / 2), borderRadius: css(22), background: 'rgba(255,255,255,.14)', border: `${css(1)} solid rgba(255,255,255,.28)` }} />}
      {cfg.layout === 'split' && !centered && <div className="absolute" style={{ top: css(pad / 2), bottom: css(pad / 2), left: css(cfg.avatar_pos === 'left' ? pad / 2 : ax - pad / 2), width: css(av + pad), borderRadius: css(18), background: 'rgba(255,255,255,.1)' }} />}

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={avatarSrc} alt="" draggable="false" className="absolute object-cover"
        style={{ left: css(ax), top: css(ay), width: css(av), height: css(av), borderRadius: shape, boxShadow: `0 0 0 ${css(4)} ${accent}${glow ? `, 0 0 ${css(26)} ${css(6)} ${accent}aa` : ''}` }} />

      {centered ? (
        <>
          <div style={nameBox(tx0, tx1, ay + av + 8)}><span style={{ fontSize: '0.86em' }}>{name}</span></div>
          <div className="absolute whitespace-nowrap text-center" style={{ left: css(tx0), right: css(W - tx1), top: css(ay + av + 8 + 44), fontSize: css(22), color: muted, textShadow: shadow }}>{line}</div>
        </>
      ) : (
        <>
          <div style={nameBox(tx0, asideStats ? tx1 - 190 : tx1, pad + 2)}>{name}</div>
          {asideStats ? (
            <div className="absolute text-right" style={{ right: css(W - tx1), top: css(pad + 4), color: accent, fontSize: css(statFont), fontWeight: 700, lineHeight: 1.15, textShadow: shadow }}>
              {levelText}
              <div style={{ fontSize: css(small), fontWeight: 400, color: muted }}>{xpText}</div>
            </div>
          ) : (bare || cfg.stats_pos === 'under_name') ? (
            <div className="absolute whitespace-nowrap" style={{ left: css(tx0), right: css(W - tx1), top: css(pad + nameStart + 12), fontSize: css(24), color: muted, textShadow: shadow, textAlign: cfg.name_align, overflow: 'hidden', textOverflow: 'ellipsis' }}>{line}</div>
          ) : (
            <div className="absolute flex items-end justify-between whitespace-nowrap" style={{ left: css(tx0), right: css(W - tx1), bottom: css(pad + barH + 10), textShadow: shadow }}>
              <span style={{ color: accent, fontSize: css(statFont), fontWeight: 700, lineHeight: 1 }}>{levelText}</span>
              <span style={{ color: muted, fontSize: css(small), lineHeight: 1 }}>{xpText}</span>
            </div>
          )}
          {!bare && rankText && cfg.stats_pos !== 'under_name' && (
            <div className="absolute whitespace-nowrap" style={{ left: css(tx0), right: css(W - (asideStats ? tx1 - 190 : tx1)), top: css(pad + nameStart + 10), fontSize: css(small), color: asideStats ? accent : muted, textAlign: cfg.name_align, textShadow: shadow }}>{rankText}</div>
          )}
        </>
      )}
      {!bare && <div className="absolute" style={{ left: css(tx0), right: css(W - tx1), bottom: css(pad), height: css(barH) }}>{bar()}</div>}
      <Anim kind={cfg.anim} accent={accent} />

      {cfg.border_width > 0 && <div className="pointer-events-none absolute inset-0" style={{ border: `${css(cfg.border_width)} solid ${cfg.border_color}`, borderRadius: css(cfg.radius) }} />}
    </div>
    </div>
  );
}

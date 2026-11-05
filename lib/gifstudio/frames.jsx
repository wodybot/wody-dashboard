import { ImageResponse } from 'next/og';
import { readFile } from 'fs/promises';
import { readFileSync } from 'fs';
import path from 'path';
import { wodyIconFile } from '@/lib/wody-icons';
import { TIMELINE_PHASES } from './constants';
import sharp from 'sharp';
import { resolveShow, resolvedPreset, loadMessages } from './config';

// Frame renderer. Every picture of a GIF is drawn here from real data. Emoji are the Wody custom emoji (the same PNG artwork the
// site and the bot use), embedded as images. No Unicode emoji is ever written as text and nothing floats around decoratively.
const fonts = (() => {
  let p;
  return () => p || (p = Promise.all([
    readFile(path.join(process.cwd(), 'assets/fonts/Inter-Latin-Regular.otf')),
    readFile(path.join(process.cwd(), 'assets/fonts/Inter-Latin-Bold.otf')),
  ]).then(([r, b]) => [
    { name: 'Inter', data: r, weight: 400, style: 'normal' },
    { name: 'Inter', data: b, weight: 700, style: 'normal' },
  ]));
})();

const iconCache = new Map();
export function iconData(name) {
  const file = wodyIconFile(name);
  if (!file) return null;
  if (iconCache.has(file)) return iconCache.get(file);
  let uri = null;
  try { uri = `data:image/png;base64,${readFileSync(path.join(process.cwd(), 'public/emojis/wody', `${file}.png`)).toString('base64')}`; } catch { uri = null; }
  iconCache.set(file, uri);
  return uri;
}

const ease = (x) => 1 - (1 - Math.min(1, Math.max(0, x))) ** 3;
const seg = (p, a, b) => Math.min(1, Math.max(0, (p - a) / (b - a)));

export function phaseAt(cfg, ms) {
  let acc = 0;
  for (const ph of TIMELINE_PHASES) {
    const t = cfg.timeline[ph];
    if (!t.on) continue;
    if (ms < acc + t.ms || ph === 'final') return { phase: ph, p: Math.min(1, Math.max(0, (ms - acc) / t.ms)), index: ms };
    acc += t.ms;
  }
  return { phase: 'final', p: 1, index: ms };
}

function Icon({ name, size, glow }) {
  const src = iconData(name);
  // Satori draws CSS filters as a box, so the glow is a soft radial layer behind the artwork instead.
  const art = src
    // eslint-disable-next-line @next/next/no-img-element
    ? <img src={src} width={size} height={size} style={{ objectFit: 'contain' }} />
    : <div style={{ display: 'flex', width: size, height: size, borderRadius: size * 0.28, background: 'rgba(255,255,255,0.14)' }} />;
  if (!glow) return art;
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: size * 1.5, height: size * 1.5, borderRadius: size * 1.5, background: `radial-gradient(circle, ${glow}44, transparent 68%)` }}>{art}</div>
  );
}


// ---------------------------------------------------------------------------------------------- the ad layout
// Every GIF is drawn in the same visual language as the three-in-one ad on the homepage: gradient frame, badge, gradient title,
// glass columns with an icon tile, a name, a short line, a mock card and a button. All text comes from the site messages.
const COL = {
  profile: { c: '#ff5e8a', a: '#ff5e8a', b: '#7a5cff', dark: false },
  passport: { c: '#e6b84a', a: '#f6dd9c', b: '#d4af5a', dark: true },
  collab: { c: '#3fd0c9', a: '#3fd0c9', b: '#2d8f8a', dark: false },
  link: { c: '#5aa9ff', a: '#5aa9ff', b: '#3b5bd6', dark: false },
  battlepass: { c: '#e08a4e', a: '#f0b060', b: '#e08a4e', dark: false },
  counting: { c: '#8de06a', a: '#8de06a', b: '#3fae4e', dark: true },
  statistics: { c: '#a78bfa', a: '#a78bfa', b: '#6d4be0', dark: false },
  themes: { c: '#ff7a45', a: '#ff7a45', b: '#7a5cff', dark: false },
};
const ROWS = { trio: ['profile', 'passport', 'collab'], latest: ['link', 'battlepass', 'counting', 'statistics'] };
const ICON = { themes: 'sparkles' };
const SWATCH = { miami_neon: ['#ff4f9a', '#4a0f6b'], synthwave: ['#2ee6ff', '#2a0f5a'], aurora: ['#5dffb0', '#0b2a3a'], cosmos: ['#8f7bff', '#0a0a2a'], sakura: ['#ffb3d1', '#2a0f24'] };

const passportCache = new Map();
async function passportImage(locale, genesis) {
  const key = `${locale}:${genesis}`;
  if (passportCache.has(key)) return passportCache.get(key);
  let uri = null;
  try {
    const file = path.join(process.cwd(), 'public/passport', `passport-${genesis ? 'genesis-' : ''}${locale}-md.webp`);
    const buf = await sharp(file).resize({ width: 520 }).png().toBuffer();
    uri = `data:image/png;base64,${buf.toString('base64')}`;
  } catch { uri = null; }
  passportCache.set(key, uri);
  return uri;
}

// Embedded PNG data of the passport artwork, drawn only by the server-side image renderer.
function PassImg({ src, style }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} style={style} />;
}

function colText(msgs, k) {
  const trio = msgs.landing?.trio || {}; const ad = msgs.gifStudio?.content?.ad?.col || {};
  if (trio[k] && ['profile', 'passport', 'collab'].includes(k)) return { name: trio[k].name, blurb: trio[k].blurb, cta: trio[k].cta };
  return ad[k] || { name: k, blurb: '', cta: '' };
}

function Tile({ name, size, k }) {
  const g = COL[k] || COL.profile;
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: size, height: size, borderRadius: size * 0.32, background: `linear-gradient(135deg, ${g.a}, ${g.b})` }}>
      <Icon name={name} size={Math.round(size * 0.66)} />
    </div>
  );
}

const box = (extra) => ({ display: 'flex', position: 'relative', overflow: 'hidden', borderRadius: 22, ...extra });

function Mock({ k, w, h, t, msgs, assets, s }) {
  const tr = msgs.landing?.trio || {}; const ad = msgs.gifStudio?.content?.ad || {}; const mk = ad.mock || {};
  const tag = (txt) => <div style={{ display: 'flex', position: 'absolute', right: s(8), top: s(6), fontSize: s(10), letterSpacing: s(2), textTransform: 'uppercase', padding: `${s(2)}px ${s(9)}px`, borderRadius: 99, background: 'rgba(0,0,0,0.45)', color: 'rgba(255,255,255,0.85)' }}>{txt}</div>;
  const tight = h < s(150);
  const example = h < s(150) ? null : tag(tr.mock?.example || 'Example');
  if (k === 'profile') {
    const name = tr.mock?.name || 'yourname'; const shown = name.slice(0, Math.max(1, Math.ceil(name.length * Math.min(1, (t % 5) / 2.2))));
    return (
      <div style={box({ width: w, height: h, flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(175deg, #ff5e8a 0%, #7a2a7a 42%, #1a0b3b 100%)' })}>
        <div style={{ display: 'flex', position: 'absolute', top: s(10), left: w / 2 - s(95), width: s(190), height: s(190), borderRadius: s(190), background: 'radial-gradient(circle, rgba(255,217,176,0.9), rgba(255,150,120,0.35) 55%, transparent 72%)' }} />
        <div style={{ display: 'flex', width: s(tight ? 40 : 56), height: s(tight ? 40 : 56), borderRadius: s(56), border: `${s(3)}px solid rgba(255,255,255,0.9)`, background: 'linear-gradient(135deg, #ffd9b0, #ff5e8a 40%, #7a5cff 75%, #3fd0c9)' }} />
        <div style={{ display: 'flex', fontSize: s(24), fontWeight: 700, color: '#fff', marginTop: s(8), minHeight: s(30) }}>{shown}</div>
        {tight ? null : <div style={{ display: 'flex', fontSize: s(12), color: 'rgba(255,255,255,0.85)', marginTop: s(2) }}>{tr.mock?.bio}</div>}
        <div style={{ display: 'flex', marginTop: s(6) }}>{['l1', 'l2', 'l3'].map((x) => <div key={x} style={{ display: 'flex', fontSize: s(11), color: '#fff', padding: `${s(2)}px ${s(10)}px`, marginLeft: s(3), marginRight: s(3), borderRadius: 99, border: '1px solid rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.12)' }}>{tr.mock?.[x]}</div>)}</div>
        {tight ? null : <div style={{ display: 'flex', fontSize: s(11), color: 'rgba(255,255,255,0.85)', marginTop: s(6) }}>{tr.mock?.views}</div>}
        {example}
      </div>
    );
  }
  if (k === 'passport') {
    const bob = Math.sin(t * 1.3) * s(3);
    return (
      <div style={box({ width: w, height: h, background: 'radial-gradient(120% 90% at 50% 0%, #3a2a0e 0%, #1a1208 60%, #0e0a05 100%)' })}>
        {assets.passport ? <PassImg src={assets.passport} style={{ position: 'absolute', left: s(10), top: s(12) + bob, width: w * 0.8, transform: 'rotate(-3deg)' }} /> : null}
        {assets.genesis ? <PassImg src={assets.genesis} style={{ position: 'absolute', right: s(10), bottom: s(12) - bob, width: w * 0.8, transform: 'rotate(3deg)' }} /> : null}
        {tag(tr.passport?.fictional ? (tr.mock?.example || 'Example') : 'Example')}
      </div>
    );
  }
  if (k === 'collab') {
    const rows = h < s(150) ? ['r1', 'r2'] : ['r1', 'r2', 'r3'];
    return (
      <div style={box({ width: w, height: h, flexDirection: 'column', background: 'linear-gradient(160deg, #10302f, #0a1a1d)', padding: `${s(12)}px ${s(14)}px` })}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: s(11), letterSpacing: s(2), color: '#9ff0ea', fontWeight: 700 }}>
          <div style={{ display: 'flex' }}>WODY COLLAB</div>
          <div style={{ display: 'flex', alignItems: 'center', color: '#6ee7b7', opacity: 0.6 + 0.4 * Math.abs(Math.sin(t * 2)) }}><div style={{ display: 'flex', width: s(8), height: s(8), borderRadius: 8, background: '#34d399', marginRight: s(5) }} />{tr.collab?.live}</div>
        </div>
        {rows.map((r, i) => {
          const a = ease(seg(t % 6, i * 0.3, 0.9 + i * 0.3));
          return (
            <div key={r} style={{ display: 'flex', alignItems: 'center', marginTop: s(8), padding: `${s(7)}px ${s(10)}px`, borderRadius: s(14), background: 'rgba(63,208,201,0.09)', border: '1px solid rgba(63,208,201,0.28)', opacity: a, transform: `translateX(${(1 - a) * s(40)}px)` }}>
              <div style={{ display: 'flex', width: s(9), height: s(9), borderRadius: 9, background: '#3fd0c9', marginRight: s(8) }} />
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                <div style={{ display: 'flex', fontSize: s(13), fontWeight: 700, color: '#fff' }}>{tr.collab?.[r]}</div>
                <div style={{ display: 'flex', fontSize: s(10), color: 'rgba(255,255,255,0.6)' }}>{tr.collab?.[`${r}s`]}</div>
              </div>
              <div style={{ display: 'flex', fontSize: s(10), color: '#9ff0ea', padding: `${s(1)}px ${s(8)}px`, borderRadius: 99, border: '1px solid rgba(63,208,201,0.5)' }}>{tr.collab?.[i === 1 ? 'server' : 'global']}</div>
            </div>
          );
        })}
        {example}
      </div>
    );
  }
  if (k === 'link') {
    const slide = (t % 4) / 4;
    const bub = (txt, left, y, on) => <div style={{ display: 'flex', position: 'absolute', top: y, left, fontSize: s(11), color: '#fff', padding: `${s(5)}px ${s(10)}px`, borderRadius: s(14), background: on ? 'rgba(90,169,255,0.55)' : 'rgba(255,255,255,0.14)', opacity: on ? 1 : 0.9 }}>{txt}</div>;
    return (
      <div style={box({ width: w, height: h, background: 'linear-gradient(160deg, #101b3d, #090d22)' })}>
        <div style={{ display: 'flex', position: 'absolute', left: s(14), top: s(16), width: s(54), height: s(54), borderRadius: s(16), background: 'linear-gradient(135deg, #5aa9ff, #3b5bd6)', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: s(18) }}>A</div>
        <div style={{ display: 'flex', position: 'absolute', right: s(14), top: s(16), width: s(54), height: s(54), borderRadius: s(16), background: 'linear-gradient(135deg, #8d7bff, #5a3bd6)', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: s(18) }}>B</div>
        <div style={{ display: 'flex', position: 'absolute', left: s(74), top: s(41), width: w - s(148), height: s(4), borderRadius: 4, background: 'rgba(90,169,255,0.35)' }} />
        <div style={{ display: 'flex', position: 'absolute', left: s(74) + (w - s(160)) * slide, top: s(36), width: s(12), height: s(12), borderRadius: 12, background: '#cfe3ff' }} />
        {slide < 0.5 ? bub(mk.msg1, s(14), s(78), true) : bub(mk.msg2, w - s(14) - s(mk.msg2 ? Math.min(140, 22 + mk.msg2.length * 6.4) : 100), s(78), true)}
        <div style={{ display: 'flex', position: 'absolute', left: s(14), top: s(58), fontSize: s(9), color: 'rgba(255,255,255,0.6)' }}>{mk.serverA}</div>
        <div style={{ display: 'flex', position: 'absolute', right: s(14), top: s(58), fontSize: s(9), color: 'rgba(255,255,255,0.6)' }}>{mk.serverB}</div>
      </div>
    );
  }
  if (k === 'battlepass') {
    const prog = 0.35 + 0.5 * ease(seg(t % 6, 0.2, 4));
    const tile = Math.min(s(54), Math.floor((w - s(28) - 3 * s(8)) / 4));
    return (
      <div style={box({ width: w, height: h, flexDirection: 'column', background: 'linear-gradient(160deg, #3a1d0b, #150a05)', padding: `${s(12)}px ${s(14)}px` })}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', fontSize: s(12), color: '#f0b060', fontWeight: 700 }}>{mk.season}</div>
          <div style={{ display: 'flex', fontSize: s(12), color: '#fff', padding: `${s(1)}px ${s(10)}px`, borderRadius: 99, background: 'rgba(224,138,78,0.35)' }}>{mk.level} {12 + Math.floor(prog * 3)}</div>
        </div>
        <div style={{ display: 'flex', marginTop: s(12), height: s(12), borderRadius: 12, background: 'rgba(255,255,255,0.12)' }}>
          <div style={{ display: 'flex', width: `${Math.round(prog * 100)}%`, height: s(12), borderRadius: 12, background: 'linear-gradient(90deg, #e08a4e, #ffd27a)' }} />
        </div>
        <div style={{ display: 'flex', marginTop: s(tight ? 8 : 14), justifyContent: 'space-between' }}>
          {['gift', 'crown', 'star', 'trophy'].map((n, i) => (
            <div key={n} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: tile, height: tile, borderRadius: s(12), background: i <= Math.floor(prog * 4) ? 'rgba(224,138,78,0.3)' : 'rgba(255,255,255,0.07)', border: `1px solid ${i <= Math.floor(prog * 4) ? '#e08a4e' : 'rgba(255,255,255,0.14)'}` }}><Icon name={n} size={Math.round(tile * 0.62)} /></div>
          ))}
        </div>
        {example}
      </div>
    );
  }
  if (k === 'counting') {
    const n = 1284 + Math.floor(t * 1.2) % 9;
    return (
      <div style={box({ width: w, height: h, flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(160deg, #123320, #07160d)' })}>
        <div style={{ display: 'flex', fontSize: s(12), color: '#a7f3c0', letterSpacing: s(2), textTransform: 'uppercase' }}>{mk.next}</div>
        <div style={{ display: 'flex', fontSize: s(58), fontWeight: 700, color: '#fff', marginTop: s(2) }}>{(n + 1).toLocaleString('en-US')}</div>
        <div style={{ display: 'flex', marginTop: s(8) }}>
          <div style={{ display: 'flex', fontSize: s(12), color: '#0b2013', fontWeight: 700, padding: `${s(2)}px ${s(12)}px`, borderRadius: 99, background: '#8de06a' }}>{mk.streak} {n % 40}</div>
        </div>
        {example}
      </div>
    );
  }
  if (k === 'statistics') {
    const vals = [0.35, 0.5, 0.42, 0.7, 0.6, 0.85, 0.74, 0.95];
    return (
      <div style={box({ width: w, height: h, flexDirection: 'column', background: 'linear-gradient(160deg, #1d1546, #0b0a1f)', padding: `${s(12)}px ${s(14)}px` })}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: s(12), color: '#c9b8ff', fontWeight: 700 }}><div style={{ display: 'flex' }}>{mk.activity}</div><div style={{ display: 'flex', color: '#a7f3c0' }}>+12%</div></div>
        <div style={{ display: 'flex', alignItems: 'flex-end', flex: 1, marginTop: s(8), marginBottom: s(14) }}>
          {vals.map((v, i) => { const g = ease(seg(t % 6, i * 0.1, 0.9 + i * 0.1)); return <div key={i} style={{ display: 'flex', flex: 1, marginLeft: s(4), marginRight: s(4), height: Math.max(s(4), (h - s(70)) * v * g), borderRadius: s(6), background: 'linear-gradient(180deg, #a78bfa, #6d4be0)' }} />; })}
        </div>
        {example}
      </div>
    );
  }
  // themes
  const on = Math.floor(t / 1.5) % 5; const names = ['miami_neon', 'synthwave', 'aurora', 'cosmos', 'sakura'];
  return (
    <div style={box({ width: w, height: h, flexDirection: 'column', background: 'linear-gradient(160deg, #1d1020, #0e0709)', padding: `${s(12)}px ${s(12)}px` })}>
      <div style={{ display: 'flex', flex: 1 }}>
        {names.map((n, i) => (
          <div key={n} style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', flex: 1, marginLeft: s(3), marginRight: s(3), borderRadius: s(12), padding: s(6), background: `linear-gradient(180deg, ${SWATCH[n][0]}, ${SWATCH[n][1]})`, border: `${s(2)}px solid ${i === on ? '#fff' : 'transparent'}`, opacity: i === on ? 1 : 0.7 }}>
            <div style={{ display: 'flex', fontSize: s(9), color: '#fff', fontWeight: 700 }}>{msgs.themes?.official?.[`wody_${n}`]?.name || n}</div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', marginTop: s(8), height: s(10), borderRadius: 10, background: `linear-gradient(90deg, ${SWATCH[names[on]][0]}, ${SWATCH[names[on]][1]})` }} />
    </div>
  );
}

function Scene({ cfg, show, state, W, H, msgs, assets }) {
  const k = W / 1200;
  const s = (n) => Math.round(n * k);
  const C = cfg.colors;
  const { phase, p } = state;
  const t = state.at / 1000;
  const kind = cfg.kind === 'latest' ? 'latest' : cfg.module === 'trio' ? 'trio' : 'single';
  const keys = kind === 'single' ? [cfg.module] : ROWS[kind];
  const n = keys.length;
  const trio = msgs.landing?.trio || {}; const ad = msgs.gifStudio?.content?.ad || {};
  const badge = kind === 'trio' ? trio.badge : kind === 'latest' ? ad.latest?.badge : 'WODY';
  const one = kind === 'single' ? colText(msgs, keys[0]) : null;
  const title = cfg.texts.title || (kind === 'trio' ? trio.title : kind === 'latest' ? ad.latest?.title : (one.name || show.title));
  const text = cfg.texts.subtitle || (kind === 'trio' ? trio.text : kind === 'latest' ? ad.latest?.text : (one.blurb || show.subtitle));
  // reveal: the header comes first, then the columns slide up one after the other
  const lead = TIMELINE_PHASES.filter((x) => x === 'intro' || x === 'reveal').reduce((a, x) => a + (cfg.timeline[x].on ? cfg.timeline[x].ms : 0), 0) || 1;
  const rv = Math.min(1, state.at / lead);
  const head = ease(seg(rv, 0, 0.35));
  const act = phase === 'features' || phase === 'latest' ? Math.min(n - 1, Math.floor(p * n)) : -1;
  const fin = phase === 'final';
  // The Wody palette is exactly the homepage ad. Another palette recolours the frame and the background, the content stays the same.
  const wody = cfg.palette === 'wody';
  const frame = wody ? 'linear-gradient(135deg, #ff5e8a, #e6cd8c, #3fd0c9, #7a5cff)' : `linear-gradient(135deg, ${C.accent}, ${C.soft}, ${C.accent})`;
  const panel = wody ? 'linear-gradient(150deg, #1d1020 0%, #150b12 55%, #0e0709 100%)' : `linear-gradient(150deg, ${C.bg2} 0%, ${C.bg1} 100%)`;
  const innerW = 1200 - 2 * 26 - 6;
  const gap = 22;
  const colW = kind === 'single' ? Math.round(innerW * 0.46) : Math.floor((innerW - 2 * 36 - gap * (n - 1)) / n);
  const prevH = kind === 'single' ? 230 : n > 3 ? 120 : 132;
  const cols = keys.map((key, i) => {
    const g = COL[key] || COL.profile; const tx = colText(msgs, key);
    const a = ease(seg(rv, 0.25 + i * 0.16, 0.6 + i * 0.16));
    const on = i === act || fin;
    const pw = colW - 36;
    return (
      <div key={key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: s(colW), flexShrink: 0, overflow: 'hidden', marginLeft: i ? s(gap) : 0, padding: s(14), borderRadius: s(30), border: `1px solid ${on ? g.c : 'rgba(255,255,255,0.1)'}`, background: on ? `linear-gradient(180deg, ${g.c}26, rgba(255,255,255,0.03))` : 'linear-gradient(180deg, rgba(255,255,255,0.07), rgba(255,255,255,0.02))', opacity: a, transform: `translateY(${(1 - a) * s(46)}px)` }}>
        <Tile name={ICON[key] || key} k={key} size={s(50)} />
        <div style={{ display: 'flex', fontSize: s(26), fontWeight: 700, color: '#fff', marginTop: s(8), width: s(pw), justifyContent: 'center', textAlign: 'center' }}>{tx.name}</div>
        <div style={{ display: 'flex', fontSize: s(16), color: 'rgba(255,255,255,0.65)', marginTop: s(3), textAlign: 'center', justifyContent: 'center', width: s(pw), height: s(n > 3 ? 44 : 44), overflow: 'hidden' }}>{tx.blurb}</div>
        <div style={{ display: 'flex', marginTop: s(10) }}>
          <Mock k={key} w={s(pw)} h={s(prevH)} t={t} msgs={msgs} assets={assets} s={s} />
        </div>
        <div style={{ display: 'flex', marginTop: s(10), fontSize: s(15), fontWeight: 700, color: '#fff', width: s(pw), justifyContent: 'center', height: s(34), alignItems: 'center', overflow: 'hidden', padding: `0 ${s(10)}px`, borderRadius: 99, border: `1px solid ${g.c}`, background: on ? `${g.c}66` : `${g.c}2e` }}>{(kind === 'single' && cfg.texts.cta) || tx.cta}</div>
      </div>
    );
  });
  const header = kind === 'single' ? (
    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', flex: 1, paddingRight: s(30), opacity: head }}>
      <div style={{ display: 'flex', fontSize: s(18), letterSpacing: s(5), color: '#ffd9b0', textTransform: 'uppercase' }}>{badge}</div>
      <div style={{ display: 'flex', fontSize: s(54), fontWeight: 700, lineHeight: 1.05, color: '#fff6dc', marginTop: s(10) }}>{title}</div>
      <div style={{ display: 'flex', fontSize: s(24), color: 'rgba(255,255,255,0.72)', marginTop: s(14), lineHeight: 1.3 }}>{text}</div>
    </div>
  ) : (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', opacity: head, transform: `translateY(${(1 - head) * s(-16)}px)` }}>
      <div style={{ display: 'flex', fontSize: s(17), letterSpacing: s(5), color: '#ffd9b0', textTransform: 'uppercase' }}>{badge}</div>
      <div style={{ display: 'flex', fontSize: s(44), fontWeight: 700, color: '#fff6dc', marginTop: s(4) }}>{title}</div>
      <div style={{ display: 'flex', fontSize: s(17), color: 'rgba(255,255,255,0.72)', marginTop: s(4), textAlign: 'center', maxWidth: s(980), height: s(44), overflow: 'hidden' }}>{text}</div>
    </div>
  );
  return (
    <div style={{ display: 'flex', width: W, height: H, background: '#0b0608', fontFamily: 'Inter', padding: s(26) }}>
      <div style={{ display: 'flex', flex: 1, borderRadius: s(44), padding: Math.max(2, s(3)), background: frame }}>
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, position: 'relative', overflow: 'hidden', borderRadius: s(41), background: panel, padding: `${s(18)}px ${s(36)}px` }}>
          <div style={{ display: 'flex', position: 'absolute', top: -s(150), left: -s(100), width: s(520), height: s(520), borderRadius: s(520), background: 'radial-gradient(circle, rgba(255,94,138,0.42), transparent 68%)' }} />
          <div style={{ display: 'flex', position: 'absolute', bottom: -s(180), right: -s(80), width: s(480), height: s(480), borderRadius: s(480), background: 'radial-gradient(circle, rgba(63,208,201,0.3), transparent 68%)' }} />
          <div style={{ display: 'flex', position: 'absolute', top: s(200), left: s(480), width: s(380), height: s(380), borderRadius: s(380), background: 'radial-gradient(circle, rgba(122,92,255,0.22), transparent 68%)' }} />
          {kind === 'single' ? (
            <div style={{ display: 'flex', flex: 1, alignItems: 'center' }}>{header}{cols}</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, alignItems: 'center' }}>
              {header}
              <div style={{ display: 'flex', flexDirection: 'row', marginTop: s(8) }}>{cols}</div>
            </div>
          )}
          {kind === 'single' ? null : <div style={{ display: 'flex', position: 'absolute', right: s(22), bottom: s(10), fontSize: s(10), letterSpacing: s(2), textTransform: 'uppercase', color: 'rgba(255,255,255,0.55)' }}>{trio.mock?.example}</div>}
          <div style={{ display: 'flex', position: 'absolute', left: 0, bottom: 0, height: s(5), width: `${Math.round(100 * (state.total ? state.at / state.total : 0))}%`, background: '#e6cd8c', opacity: 0.85 }} />
        </div>
      </div>
    </div>
  );
}

// Renders one frame as a PNG buffer. `at` is the time in ms inside the whole timeline.
export async function renderFrame(cfg, at, total, opts = {}) {
  const { width: W, height: H } = opts.size || resolvedPreset(cfg);
  const show = opts.show || resolveShow(cfg);
  const st = phaseAt(cfg, at);
  const msgs = loadMessages(cfg.locale);
  const assets = cfg.module === 'trio' || cfg.module === 'passport' ? { passport: await passportImage(cfg.locale, false), genesis: await passportImage(cfg.locale, true) } : {};
  const res = new ImageResponse(<Scene cfg={cfg} show={show} state={{ ...st, at, total }} W={W} H={H} msgs={msgs} assets={assets} />, { width: W, height: H, fonts: await fonts() });
  return Buffer.from(await res.arrayBuffer());
}

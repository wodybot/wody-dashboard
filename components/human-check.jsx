'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Check, RefreshCw, ShieldCheck } from 'lucide-react';

const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);
const W = new Uint32Array(64);
function sha256(bytes) {
  const h = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
  const len = bytes.length;
  const total = ((len + 9 + 63) >> 6) << 6;
  const m = new Uint8Array(total);
  m.set(bytes);
  m[len] = 0x80;
  const dv = new DataView(m.buffer);
  dv.setUint32(total - 8, Math.floor((len * 8) / 4294967296));
  dv.setUint32(total - 4, (len * 8) >>> 0);
  for (let o = 0; o < total; o += 64) {
    for (let i = 0; i < 16; i += 1) W[i] = dv.getUint32(o + i * 4);
    for (let i = 16; i < 64; i += 1) {
      const a = W[i - 15]; const b = W[i - 2];
      const s0 = ((a >>> 7) | (a << 25)) ^ ((a >>> 18) | (a << 14)) ^ (a >>> 3);
      const s1 = ((b >>> 17) | (b << 15)) ^ ((b >>> 19) | (b << 13)) ^ (b >>> 10);
      W[i] = (W[i - 16] + s0 + W[i - 7] + s1) | 0;
    }
    let [a, b, c, d, e, f, g, hh] = h;
    for (let i = 0; i < 64; i += 1) {
      const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
      const ch = (e & f) ^ (~e & g);
      const t1 = (hh + S1 + ch + K[i] + W[i]) | 0;
      const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
      const mj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + mj) | 0;
      hh = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
    }
    h[0] += a; h[1] += b; h[2] += c; h[3] += d; h[4] += e; h[5] += f; h[6] += g; h[7] += hh;
  }
  return h;
}
function zeroBits(h) {
  let bits = 0;
  for (let i = 0; i < 8; i += 1) {
    const w = h[i] >>> 0;
    if (w === 0) { bits += 32; continue; }
    bits += Math.clz32(w);
    break;
  }
  return bits;
}
function solve(token, bits, isCancelled) {
  const enc = new TextEncoder();
  return new Promise((resolve) => {
    let n = 0;
    const step = () => {
      if (isCancelled()) { resolve(null); return; }
      const end = n + 1500;
      for (; n < end; n += 1) {
        if (zeroBits(sha256(enc.encode(`${token}:${n}`))) >= bits) { resolve(n); return; }
      }
      setTimeout(step, 0);
    };
    step();
  });
}

function softwareRenderer() {
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl') || c.getContext('experimental-webgl');
    if (!gl) return false;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const name = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || '') : '';
    return /swiftshader|llvmpipe|software|softpipe/i.test(name);
  } catch { return false; }
}

const API = '/api/humancheck';

export default function HumanCheck({ purpose, ctx = '', onPass, resetKey = 0, className = '' }) {
  const t = useTranslations('humancheck');
  const [phase, setPhase] = useState('loading');
  const [note, setNote] = useState('');
  const [puzzle, setPuzzle] = useState(null);
  const [picks, setPicks] = useState([]);
  const [busy, setBusy] = useState(false);
  const boxRef = useRef(null);
  const live = useRef({ moves: 0, path: 0, lx: null, ly: null, first: 0, downAt: 0, how: 'none', trusted: true, shownAt: 0, centered: false });
  const chal = useRef(null);
  const proof = useRef(null);
  const gen = useRef(0);
  const passRef = useRef(onPass);
  passRef.current = onPass;

  const load = useCallback(async () => {
    const my = ++gen.current;
    setPhase('loading'); setPuzzle(null); setPicks([]);
    proof.current = null; chal.current = null;
    live.current = { moves: 0, path: 0, lx: null, ly: null, first: 0, downAt: 0, how: 'none', trusted: true, shownAt: Date.now(), centered: false };
    try {
      const r = await fetch(`${API}?purpose=${encodeURIComponent(purpose)}&ctx=${encodeURIComponent(ctx)}`, { cache: 'no-store', credentials: 'same-origin' });
      const c = await r.json();
      if (my !== gen.current) return;
      if (!r.ok || !c.token) { setPhase('error'); setNote(t(r.status === 429 ? 'busy' : 'failed')); return; }
      chal.current = { ...c, at: Date.now() };
      setPhase('idle'); setNote('');
      proof.current = solve(c.token, c.difficulty, () => my !== gen.current);
    } catch {
      if (my === gen.current) { setPhase('error'); setNote(t('network')); }
    }
  }, [purpose, ctx, t]);

  useEffect(() => {
    load();
    passRef.current?.('');
    return () => { gen.current += 1; };
  }, [load, resetKey]);

  useEffect(() => {
    const move = (e) => {
      const L = live.current;
      if (e.pointerType === 'touch') return;
      if (L.lx !== null) L.path += Math.hypot(e.clientX - L.lx, e.clientY - L.ly);
      if (!L.first) L.first = Date.now();
      L.lx = e.clientX; L.ly = e.clientY; L.moves += 1;
    };
    window.addEventListener('pointermove', move, { passive: true });
    return () => window.removeEventListener('pointermove', move);
  }, []);

  useEffect(() => {
    if (phase !== 'done') return undefined;
    const id = setTimeout(() => { passRef.current?.(''); load(); }, 4.5 * 60_000);
    return () => clearTimeout(id);
  }, [phase, load]);

  function noteInput(kind, e) {
    const L = live.current;
    L.how = kind;
    L.trusted = L.trusted && e.isTrusted === true;
    L.downAt = Date.now();
    if (kind === 'pointer' && boxRef.current) {
      const r = boxRef.current.getBoundingClientRect();
      L.centered = Math.abs(e.clientX - (r.left + r.width / 2)) < 0.6 && Math.abs(e.clientY - (r.top + r.height / 2)) < 0.6;
    }
  }

  async function tick(e) {
    if (phase !== 'idle' && phase !== 'error') return;
    const L = live.current;
    if (!L.downAt) { L.how = e?.detail === 0 ? 'key' : 'none'; L.trusted = L.trusted && e?.isTrusted === true; L.downAt = Date.now() - 80; }
    const press = Math.max(0, Date.now() - L.downAt);
    if (!chal.current || Date.now() - chal.current.at > chal.current.ttl - 20_000) { await load(); return; }
    setPhase('working'); setNote('');
    const my = gen.current;
    const nonce = await proof.current;
    if (my !== gen.current || nonce === null || nonce === undefined) return;
    const wait = 1000 - (Date.now() - chal.current.at);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    if (my !== gen.current) return;
    const nav = typeof navigator !== 'undefined' ? navigator : {};
    const signals = {
      how: L.how, trusted: L.trusted && e?.isTrusted === true, press, moves: L.moves, path: Math.round(L.path),
      lead: L.first ? Math.max(0, Date.now() - L.first) : 0, shown: Date.now() - L.shownAt, centered: L.centered,
      webdriver: nav.webdriver === true, focus: typeof document.hasFocus === 'function' ? document.hasFocus() : true,
      visible: document.visibilityState !== 'hidden', langs: (nav.languages || []).length, cores: nav.hardwareConcurrency || 0,
      sw: window.screen?.width || 0, sh: window.screen?.height || 0, soft: softwareRenderer(),
      mobile: (nav.maxTouchPoints || 0) > 0,
    };
    try {
      const r = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ action: 'tick', token: chal.current.token, nonce: String(nonce), signals }) });
      const d = await r.json();
      if (my !== gen.current) return;
      if (d.status === 'pass') { setPhase('done'); passRef.current?.(d.pass); return; }
      if (d.status === 'puzzle') { setPuzzle(d.puzzle); setPicks([]); setPhase('puzzle'); return; }
      const reason = d.reason === 'expired' ? 'expired' : d.reason === 'too_fast' ? 'tooFast' : 'denied';
      await load(); setNote(t(reason)); setPhase('error');
    } catch {
      if (my === gen.current) { setPhase('error'); setNote(t('network')); }
    }
  }

  async function sendPuzzle() {
    if (!puzzle || busy) return;
    setBusy(true);
    const my = gen.current;
    try {
      const r = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ action: 'puzzle', token: puzzle.token, picks }) });
      const d = await r.json();
      if (my !== gen.current) return;
      if (d.status === 'pass') { setPhase('done'); setPuzzle(null); passRef.current?.(d.pass); }
      else if (d.status === 'puzzle') { setPuzzle(d.puzzle); setPicks([]); }
      else { const reason = d.reason === 'wrong' ? 'wrong' : d.reason === 'too_fast' ? 'tooFast' : 'expired'; await load(); setNote(t(reason)); setPhase('error'); }
    } catch {
      if (my === gen.current) { setPhase('error'); setNote(t('network')); }
    } finally { setBusy(false); }
  }

  const done = phase === 'done';
  const working = phase === 'working' || phase === 'loading';

  return (
    <div className={`humancheck w-full sm:max-w-[19rem] touch-manipulation ${className}`}>
      <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-card/80 px-3 py-3 shadow-sm">
        <div className="flex items-center gap-3">
          <button
            ref={boxRef}
            type="button"
            role="checkbox"
            aria-checked={done}
            aria-busy={working}
            aria-label={t('label')}
            disabled={done || phase === 'working' || phase === 'loading' || phase === 'puzzle'}
            onPointerDown={(e) => noteInput(e.pointerType === 'touch' ? 'touch' : 'pointer', e)}
            onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') noteInput('key', e); }}
            onClick={tick}
            className={`relative flex h-8 w-8 sm:h-7 sm:w-7 shrink-0 items-center justify-center rounded-[4px] border-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${done ? 'border-emerald-500 bg-emerald-500/15' : 'border-muted-foreground/60 bg-background hover:border-[#e6cd8c]'}`}
          >
            {working && <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#e6cd8c] border-t-transparent" aria-hidden="true" />}
            {done && <Check className="h-5 w-5 text-emerald-500" strokeWidth={3.2} aria-hidden="true" />}
          </button>
          <span className="select-none text-sm font-medium">{done ? t('done') : t('label')}</span>
        </div>
        <div className="flex flex-col items-center text-center leading-tight text-muted-foreground" aria-hidden="true">
          <ShieldCheck className="h-6 w-6 text-[#e6cd8c]" />
          <span className="mt-0.5 text-[9px] font-semibold uppercase tracking-wide">{t('brand')}</span>
        </div>
      </div>

      <p className="sr-only" role="status" aria-live="polite">{done ? t('done') : note}</p>
      {note && phase === 'error' && <p className="mt-2 text-xs text-destructive">{note}</p>}

      {phase === 'puzzle' && puzzle && (
        <div className="mt-2 rounded-md border border-border bg-card p-3 shadow-md">
          <div className="mb-2 flex items-center gap-3">
            <svg viewBox="0 0 100 100" className="h-14 w-14 shrink-0 rounded border border-border bg-background" aria-hidden="true">
              <path d={puzzle.sample.d} fill={`hsl(${puzzle.sample.hue} 70% 55%)`} />
            </svg>
            <div><p className="text-sm font-medium">{t('puzzleTitle')}</p>{puzzle.total > 1 && <p className="mt-0.5 text-xs text-muted-foreground">{t('round', { n: puzzle.round, total: puzzle.total })}</p>}</div>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:gap-1.5" role="group" aria-label={t('puzzleTitle')}>
            {puzzle.tiles.map((tile, i) => {
              const on = picks.includes(i);
              return (
                <button
                  key={i}
                  type="button"
                  aria-pressed={on}
                  aria-label={`${i + 1}`}
                  onClick={() => setPicks((p) => (p.includes(i) ? p.filter((x) => x !== i) : [...p, i]))}
                  className={`relative aspect-square overflow-hidden rounded border-2 bg-background transition ${on ? 'border-[#e6cd8c] ring-2 ring-[#e6cd8c]/50' : 'border-border hover:border-muted-foreground'}`}
                >
                  <svg viewBox="0 0 100 100" className="h-full w-full" aria-hidden="true">
                    <path d={tile.g} fill={`hsl(${(tile.hue + 40) % 360} 55% 50%)`} fillOpacity="0.28" />
                    <path d={tile.n} stroke="currentColor" strokeOpacity="0.3" strokeWidth="1.4" fill="none" />
                    <path d={tile.d} fill={`hsl(${tile.hue} 70% 55%)`} />
                  </svg>
                  {on && <Check className="absolute right-1 top-1 h-4 w-4 rounded-full bg-[#e6cd8c] p-0.5 text-black" strokeWidth={3.2} aria-hidden="true" />}
                </button>
              );
            })}
          </div>
          <div className="mt-3 flex items-center justify-between gap-2">
            <button type="button" onClick={load} className="inline-flex min-h-[44px] items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />{t('another')}
            </button>
            <button type="button" disabled={busy} onClick={sendPuzzle} className="min-h-[44px] rounded-md bg-[#e6cd8c] px-4 py-1.5 text-sm font-semibold text-black hover:bg-[#d9bd73] disabled:opacity-60">{t('puzzleSubmit')}</button>
          </div>
        </div>
      )}
    </div>
  );
}

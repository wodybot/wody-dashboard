// Dragon sounds made with the Web Audio API: nothing is downloaded. Played only after a click or when the visitor switched sound on.
let ctx = null;
function context() {
  try {
    const Ctor = window.AudioContext || window.webkitAudioContext; if (!Ctor) return null;
    ctx = ctx || new Ctor(); if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx.state === 'closed' ? null : ctx;
  } catch { return null; }
}
function noise(c, secs) {
  const buf = c.createBuffer(1, Math.max(1, Math.floor(c.sampleRate * secs)), c.sampleRate); const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i += 1) d[i] = Math.random() * 2 - 1;
  const s = c.createBufferSource(); s.buffer = buf; return s;
}
function swell(c, out, { kind = 'lowpass', from, to, secs, gain, at = 0 }) {
  const n = noise(c, secs); const f = c.createBiquadFilter(); const g = c.createGain(); const t0 = c.currentTime + at;
  f.type = kind; f.frequency.setValueAtTime(from, t0); f.frequency.exponentialRampToValueAtTime(to, t0 + secs);
  g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(gain, t0 + secs * 0.25); g.gain.exponentialRampToValueAtTime(0.0001, t0 + secs);
  n.connect(f); f.connect(g); g.connect(out); n.start(t0); n.stop(t0 + secs + 0.05);
}
function growl(c, out, { from, to, secs, gain, at = 0 }) {
  const o = c.createOscillator(); const lfo = c.createOscillator(); const lg = c.createGain(); const g = c.createGain(); const f = c.createBiquadFilter(); const t0 = c.currentTime + at;
  o.type = 'sawtooth'; o.frequency.setValueAtTime(from, t0); o.frequency.exponentialRampToValueAtTime(to, t0 + secs);
  lfo.frequency.value = 34; lg.gain.value = from * 0.08; lfo.connect(lg); lg.connect(o.frequency);
  f.type = 'lowpass'; f.frequency.setValueAtTime(700, t0); f.frequency.exponentialRampToValueAtTime(220, t0 + secs);
  g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(gain, t0 + 0.25); g.gain.exponentialRampToValueAtTime(0.0001, t0 + secs);
  o.connect(f); f.connect(g); g.connect(out); o.start(t0); lfo.start(t0); o.stop(t0 + secs + 0.05); lfo.stop(t0 + secs + 0.05);
}
const CUES = {
  roar: (c, o) => { growl(c, o, { from: 150, to: 52, secs: 2.1, gain: 0.3 }); swell(c, o, { from: 1800, to: 260, secs: 1.8, gain: 0.12 }); },
  wings: (c, o) => { for (let i = 0; i < 3; i += 1) swell(c, o, { from: 520, to: 110, secs: 0.5, gain: 0.2, at: i * 0.55 }); },
  breath: (c, o) => { swell(c, o, { from: 900, to: 240, secs: 1.8, gain: 0.26 }); growl(c, o, { from: 74, to: 46, secs: 1.8, gain: 0.1 }); },
};
/** Plays one sound (roar, wings or breath) at a volume of 0 to 100. Returns false when the browser has no audio. */
export function playDragonSound(kind, volume = 60) {
  const c = context(); const cue = CUES[kind]; if (!c || !cue) return false;
  const master = c.createGain(); master.gain.value = Math.max(0, Math.min(1, volume / 100)) * 0.9; master.connect(c.destination);
  try { cue(c, master); } catch { return false; }
  return true;
}

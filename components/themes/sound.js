// A short synthesized sound cue for each intro signature. Nothing is downloaded: the sound is made with the Web Audio API, it is quiet,
// lasts under three seconds, and is only played when the visitor has switched sound on.
let ctx = null;
function context() {
  try {
    const Ctor = window.AudioContext || window.webkitAudioContext; if (!Ctor) return null;
    ctx = ctx || new Ctor();
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx.state === 'closed' ? null : ctx;
  } catch { return null; }
}
function noise(c, secs) {
  const buf = c.createBuffer(1, Math.max(1, Math.floor(c.sampleRate * secs)), c.sampleRate); const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i += 1) d[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource(); src.buffer = buf; return src;
}
function tone(c, out, { type = 'sine', from, to, at = 0, dur = 1, gain = 0.1, attack = 0.03 }) {
  const o = c.createOscillator(); const g = c.createGain(); const t0 = c.currentTime + at;
  o.type = type; o.frequency.setValueAtTime(from, t0); if (to) o.frequency.exponentialRampToValueAtTime(to, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(gain, t0 + attack); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(out); o.start(t0); o.stop(t0 + dur + 0.05);
}
function filtered(c, out, { kind = 'lowpass', freq, q = 1, secs, gain, at = 0, sweepTo }) {
  const n = noise(c, secs); const f = c.createBiquadFilter(); const g = c.createGain(); const t0 = c.currentTime + at;
  f.type = kind; f.frequency.setValueAtTime(freq, t0); f.Q.value = q; if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t0 + secs);
  g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(gain, t0 + 0.08); g.gain.exponentialRampToValueAtTime(0.0001, t0 + secs);
  n.connect(f); f.connect(g); g.connect(out); n.start(t0); n.stop(t0 + secs + 0.05);
}

export const CUES = {
  fire_breath: (c, o) => { filtered(c, o, { freq: 900, sweepTo: 220, secs: 1.8, gain: 0.22 }); tone(c, o, { type: 'sawtooth', from: 70, to: 45, dur: 2, gain: 0.09 }); },
  frost_breath: (c, o) => { for (const [i, f] of [1568, 2093, 2637].entries()) tone(c, o, { from: f, at: i * 0.14, dur: 1.6, gain: 0.05 }); filtered(c, o, { kind: 'highpass', freq: 3000, secs: 1.4, gain: 0.05 }); },
  lightning_strike: (c, o) => { filtered(c, o, { freq: 4000, sweepTo: 300, secs: 0.35, gain: 0.3 }); filtered(c, o, { freq: 160, sweepTo: 50, secs: 2.2, gain: 0.3, at: 0.25 }); },
  shadow_pulse: (c, o) => { tone(c, o, { from: 55, to: 40, dur: 2.4, gain: 0.16, attack: 0.5 }); tone(c, o, { from: 82, to: 60, dur: 2.2, gain: 0.07, attack: 0.5 }); },
  nature_bloom: (c, o) => { for (const [i, f] of [392, 494, 587, 784].entries()) tone(c, o, { from: f, at: i * 0.2, dur: 1.8, gain: 0.05, attack: 0.15 }); },
  none: () => {},
};

/** Plays the cue of a signature. Returns false when the browser has no audio or refuses to start it. */
export function playCue(signature) {
  const c = context(); if (!c) return false;
  const master = c.createGain(); master.gain.value = 0.7; master.connect(c.destination);
  try { (CUES[signature] || CUES.none)(c, master); return true; } catch { return false; }
}

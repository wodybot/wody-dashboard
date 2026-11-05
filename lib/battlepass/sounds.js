// Sounds of the Battle Pass page. They are synthesized with the Web Audio API, so there are no audio files to download,
// nothing to license and no network request. Sound is off until the visitor turns it on, and it only starts after a click
// (browsers require that). `prefers-reduced-motion` does not silence sound, the visitor's own switch does.
const PACKS = {
  soft: { wave: 'sine', gain: 0.5, events: { click: [[660, 0.05]], hover: [[880, 0.025]], unlock: [[523, 0.09], [659, 0.09], [784, 0.16]], claim: [[587, 0.08], [880, 0.2]], level_up: [[523, 0.1], [659, 0.1], [784, 0.1], [1047, 0.3]], open: [[392, 0.08], [523, 0.12]], error: [[220, 0.18]] } },
  arcade: { wave: 'square', gain: 0.22, events: { click: [[880, 0.04]], hover: [[1320, 0.02]], unlock: [[784, 0.06], [988, 0.06], [1175, 0.12]], claim: [[659, 0.06], [988, 0.06], [1319, 0.16]], level_up: [[523, 0.07], [659, 0.07], [784, 0.07], [1047, 0.07], [1319, 0.25]], open: [[440, 0.06], [880, 0.1]], error: [[160, 0.08], [120, 0.16]] } },
  crystal: { wave: 'triangle', gain: 0.45, events: { click: [[1568, 0.05]], hover: [[2093, 0.02]], unlock: [[1319, 0.08], [1760, 0.08], [2349, 0.22]], claim: [[1568, 0.07], [2093, 0.07], [2637, 0.28]], level_up: [[1047, 0.09], [1319, 0.09], [1568, 0.09], [2093, 0.09], [2637, 0.4]], open: [[1175, 0.07], [1760, 0.14]], error: [[330, 0.2]] } },
  orchestral: { wave: 'sawtooth', gain: 0.16, events: { click: [[392, 0.07]], hover: [[523, 0.03]], unlock: [[330, 0.14], [392, 0.14], [494, 0.3]], claim: [[262, 0.12], [392, 0.12], [523, 0.34]], level_up: [[262, 0.14], [330, 0.14], [392, 0.14], [523, 0.14], [659, 0.5]], open: [[196, 0.12], [294, 0.2]], error: [[147, 0.3]] } },
  minimal: { wave: 'sine', gain: 0.35, events: { click: [[740, 0.03]], hover: [], unlock: [[880, 0.08]], claim: [[988, 0.1]], level_up: [[784, 0.08], [1175, 0.2]], open: [], error: [[196, 0.12]] } },
};
export const SOUND_EVENTS = Object.keys(PACKS.soft.events);

let ctx = null;
function context() {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try { ctx = new AC(); } catch { return null; }
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

/** Plays one event of a pack. volume 0..100. Returns false when nothing was played. */
export function playSound(pack, event, volume = 40) {
  const p = PACKS[pack];
  const notes = p?.events?.[event];
  const c = context();
  if (!p || !notes?.length || !c || volume <= 0) return false;
  let t = c.currentTime + 0.005;
  const master = (Math.min(100, volume) / 100) * p.gain;
  for (const [freq, len] of notes) {
    const osc = c.createOscillator(); const gain = c.createGain();
    osc.type = p.wave; osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, master), t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + len + 0.06);
    osc.connect(gain).connect(c.destination);
    osc.start(t); osc.stop(t + len + 0.08);
    t += len;
  }
  return true;
}

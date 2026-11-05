// Dynamic Themes, browser side: the stage renders safely, the effects engine is bounded and soft, the texts exist in 9 languages,
// and the community mapping stays valid. Run with the JSX loader: npm run test:themes
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import React from 'react';
import { renderToString } from 'react-dom/server';

const { OFFICIAL } = await import('../../lib/themes/official.js');
const { buildRenderTheme, themeCssVars } = await import('../../lib/themes/render.js');
const C = await import('../../lib/themes/constants.js');
const { hasPictograph } = await import('../../lib/no-emoji.js');
const { listingThemeFrom } = await import('../../lib/themes/community.js');
const { resolveTheme } = await import('../../components/community/theme.js');
const { default: ThemeStage } = await import('../../components/themes/ThemeStage.jsx');
const { createEffects } = await import('../../components/themes/effects.js');

const CHAR = 'a'.repeat(24);
const snapshot = (withChar = true, url = `/api/site-image/${CHAR}`) => {
  const cfg = JSON.parse(JSON.stringify(OFFICIAL.wody_fire_dragon));
  if (withChar) cfg.character.asset = CHAR;
  return { id: 'wody_fire_dragon', version: 1, config: cfg, assets: withChar ? { [CHAR]: { url, w: 1600, h: 1200 } } : {} };
};
const labels = Object.fromEntries(['controls', 'quality', 'auto', 'low', 'medium', 'high', 'ultra', 'using', 'effects', 'animations', 'introOption', 'replay', 'skipIntro'].map((k) => [k, k]));
const html = (theme) => renderToString(React.createElement(ThemeStage, { theme, labels, mode: 'page' }, React.createElement('p', { id: 'child' }, 'hello')));

test('stage: server render is safe, complete and never blocks the page', () => {
  const out = html(buildRenderTheme(snapshot(), null, { premium: false, locale: 'en' }));
  assert.match(out, /data-wt-theme="wody_fire_dragon"/);
  assert.match(out, /--wt-primary:#/);
  assert.match(out, /id="child"/, 'page content is rendered inside the stage');
  assert.match(out, /wt-scene/);
  assert.match(out, /\/api\/site-image\/a{24}|\/themes\/rig\/fire\/wing_near\.png/, 'the character is a separate image asset (layered rig for the official dragon), not CSS art');
  assert.doesNotMatch(out, /wt-intro/, 'the intro overlay is not part of the server render, so content is never hidden behind it');
  assert.doesNotMatch(out, /wt-controls/, 'controls appear only after mount');
  assert.doesNotMatch(out, /<script|javascript:|onerror|<style/i);
  assert.equal(hasPictograph(out), false);
  // no character asset: nothing broken is drawn, the rest of the theme remains
  const bare = html(buildRenderTheme(snapshot(false), null, { premium: false }));
  assert.doesNotMatch(bare, /wt-char/); assert.match(bare, /wt-scene/);
  // an odd image address is ignored, never loaded
  const odd = html(buildRenderTheme(snapshot(true, 'https://evil.example/x.png'), null, { premium: false }));
  assert.doesNotMatch(odd, /evil\.example/);
});

function fakeCanvas() {
  const calls = { alphas: [], fills: [] };
  const ctx = new Proxy({}, {
    get: (t, k) => {
      if (k === 'createRadialGradient' || k === 'createLinearGradient') return () => ({ addColorStop() {} });
      if (k === 'measureText') return () => ({ width: 1 });
      return k in t ? t[k] : () => {};
    },
    set: (t, k, v) => { t[k] = v; return true; },
  });
  const orig = ctx.fillRect;
  ctx.fillRect = (x, y, w, h) => { calls.fills.push({ w, h, style: ctx.fillStyle, frame: globalThis.__frame }); };
  const canvas = { width: 0, height: 0, getContext: () => ctx, getBoundingClientRect: () => ({ width: 800, height: 600 }) };
  return { canvas, ctx, calls, orig };
}

test('effects engine: every effect and signature runs, stays bounded, and lightning is a soft rare flash', async () => {
  const frames = []; let id = 0;
  globalThis.requestAnimationFrame = (fn) => { frames.push(fn); return ++id; };
  globalThis.cancelAnimationFrame = () => {};
  globalThis.document = { createElement: () => fakeCanvas().canvas };
  globalThis.performance = globalThis.performance || { now: () => Date.now() };
  const f = fakeCanvas();
  const fx = createEffects(f.canvas, {
    effects: C.EFFECTS.map((e) => ({ id: e, intensity: 100 })), palette: OFFICIAL.wody_storm_dragon.palette,
    lighting: { color: '#9bb7ff', intensity: 80 }, budget: 1, fps: 60, allowLightning: true, dpr: 1,
  });
  assert.ok(fx, 'the engine starts on a 2D canvas, no WebGL needed');
  fx.start();
  for (const kind of C.SIGNATURES) fx.burst(kind, 0.5, 0.4, 0);
  let t = 1000;
  for (let i = 0; i < 1500; i += 1) { globalThis.__frame = i; t += 16.7; const batch = frames.splice(0); for (const fn of batch) fn(t); }
  fx.stop(); fx.clear();
  // lightning: any full-screen flash uses a low alpha and they are well separated in time
  const flashes = f.calls.fills.filter((x) => x.w === 800 && x.h === 600 && /rgba\(/.test(String(x.style)));
  for (const fl of flashes) { const a = Number(String(fl.style).match(/,\s*([0-9.]+)\)$/)?.[1]); assert.ok(a <= 0.141, `flash alpha ${a} too strong`); }
  const starts = flashes.filter((x, i) => i === 0 || x.frame - flashes[i - 1].frame > 3).map((x) => x.frame);
  for (let i = 1; i < starts.length; i += 1) assert.ok((starts[i] - starts[i - 1]) * 16.7 >= 2500, `flashes ${starts[i - 1]} and ${starts[i]} are too close`);
  assert.ok(flashes.length < 1500 * 0.4, 'flashes are not continuous');
  // a disabled budget or an unsupported canvas never throws
  assert.equal(createEffects({ getContext: () => null }, { effects: [], palette: OFFICIAL.wody_storm_dragon.palette }), null);
  const light = createEffects(fakeCanvas().canvas, { effects: [{ id: 'lightning', intensity: 100 }], palette: OFFICIAL.wody_storm_dragon.palette, lighting: { color: '#fff', intensity: 10 }, budget: 0.15, fps: 24, allowLightning: false, dpr: 1 });
  light.start(); light.burst('lightning_strike'); light.stop();
});

function flat(o, p = '') { return Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' ? flat(v, `${p}${k}.`) : [`${p}${k}`])); }
const msg = (l) => JSON.parse(readFileSync(`messages/${l}.json`, 'utf8'));

test('translations: all 9 languages have every key the UI uses, with clean text', () => {
  const langs = ['en', 'ro', 'fr', 'it', 'de', 'es', 'nl', 'pt', 'tr'];
  const en = msg('en');
  const files = readdirSync('components/themes').filter((f) => f.endsWith('.jsx')).map((f) => `components/themes/${f}`);
  const keys = new Set();
  for (const f of files) for (const m of readFileSync(f, 'utf8').matchAll(/\bt\('([A-Za-z0-9_.]+)'/g)) keys.add(m[1]);
  assert.ok(keys.size > 150);
  const have = new Set(flat(en.themes));
  for (const k of keys) assert.ok(have.has(k), `missing themes.${k}`);
  // fixed choices shown through a group lookup
  const groups = { cardStyles: C.CARD_STYLES, buttonStyles: C.BUTTON_STYLES, headerStyles: C.HEADER_STYLES, navStyles: C.NAV_STYLES, borderStyles: C.BORDER_STYLES, shadowStyles: C.SHADOW_STYLES,
    scenes: C.SCENES, effects: C.EFFECTS, signatures: C.SIGNATURES, positions: C.CHAR_POSITIONS, layers: C.CHAR_LAYERS, idle: C.CHAR_IDLE, introSteps: C.INTRO_STEPS, introMobile: C.INTRO_MOBILE,
    transitions: C.TRANSITIONS, categories: C.CATEGORIES, status: C.STATUSES, controls: C.PERF_PROFILES, 'assets.kinds': C.ASSET_KINDS, 'assets.licenses': C.LICENSE_TYPES, fonts: C.HEADING_FONTS, movement: C.BG_MOVEMENT };
  for (const [g, list] of Object.entries(groups)) for (const v of list) assert.ok(have.has(`${g}.${v}`), `missing themes.${g}.${v}`);
  for (const id of C.OFFICIAL_IDS) for (const f of ['name', 'description']) assert.ok(have.has(`official.${id}.${f}`));
  const enKeys = flat(en.themes).sort(); const helpKeys = flat(en.themesHelp).sort();
  for (const l of langs) {
    const m = msg(l);
    assert.deepEqual(flat(m.themes).sort(), enKeys, `${l} themes keys`);
    assert.deepEqual(flat(m.themesHelp).sort(), helpKeys, `${l} themesHelp keys`);
    for (const k of ['website_theme', 'theme_studio']) assert.ok(m.modules[k].title && m.modules[k].description, `${l} module ${k}`);
    assert.ok(m.guildSettings.groups.website);
    const text = JSON.stringify([m.themes, m.themesHelp]);
    assert.equal(hasPictograph(text), false, `${l} has emoji`);
    assert.doesNotMatch(text, /[–—]/, `${l} has long dashes`);
    assert.doesNotMatch(text.replace(/\\"/g, ''), /[A-Za-z]'[A-Za-z]/, `${l} has straight apostrophes`);
    if (l !== 'en') { const same = flat(m.themes).filter((k) => k.startsWith('owner.') && flat(m.themes).length && String(k).length && m.themes.owner[k.slice(6)] === en.themes.owner[k.slice(6)]); assert.ok(same.length < 12, `${l} looks untranslated`); }
  }
});

test('community mapping: a server theme becomes a valid listing theme, and the standard look stays untouched', () => {
  assert.equal(listingThemeFrom(null), null);
  for (const id of C.OFFICIAL_IDS) {
    const rt = buildRenderTheme({ id, version: 1, config: OFFICIAL[id], assets: {} }, null, { premium: false });
    const lt = listingThemeFrom(rt);
    const r = resolveTheme(lt);
    for (const k of ['primary', 'accent', 'secondary', 'background']) assert.match(r[k], /^#[0-9a-f]{6}$/i);
    assert.equal(r.primary.toLowerCase(), rt.palette.primary.toLowerCase());
    assert.ok(['solid', 'outline', 'glass', 'glow'].includes(r.card_style));
    assert.ok(['rounded', 'pill', 'square'].includes(r.button_style));
  }
  // the page and the view only apply the stage when a theme resolved
  const page = readFileSync('app/[locale]/[prefix]/[slug]/page.js', 'utf8');
  assert.match(page, /siteTheme \? <ThemeStage/);
  assert.match(readFileSync('components/community/ListingView.jsx', 'utf8'), /transparentBg/);
});

test('sound: every signature has a short synthesized cue, nothing plays without a browser audio engine', async () => {
  const { CUES, playCue } = await import('../../components/themes/sound.js');
  assert.deepEqual(Object.keys(CUES).sort(), [...C.SIGNATURES].sort(), 'one cue per signature');
  assert.equal(playCue('fire_breath'), false, 'no audio engine: it simply stays silent');
  let nodes = 0; let longest = 0;
  const param = () => ({ value: 0, setValueAtTime() {}, exponentialRampToValueAtTime(_v, t) { longest = Math.max(longest, t); } });
  const node = () => { nodes += 1; return { gain: param(), frequency: param(), Q: {}, connect() {}, start() {}, stop() {}, type: '' }; };
  globalThis.window = { AudioContext: class { constructor() { this.currentTime = 0; this.sampleRate = 8000; this.state = 'running'; this.destination = {}; } createGain() { return node(); } createOscillator() { return node(); } createBiquadFilter() { return node(); } createBuffer(_c, n) { return { getChannelData: () => new Float32Array(n) }; } createBufferSource() { return node(); } resume() { return Promise.resolve(); } } };
  for (const s of C.SIGNATURES.filter((x) => x !== 'none')) assert.equal(playCue(s), true, s);
  assert.ok(nodes > 10);
  assert.ok(longest < 3, `the longest cue ends before 3 seconds (${longest})`);
  delete globalThis.window;
  for (const l of C.LOCALES) {
    const m = JSON.parse(readFileSync(`messages/${l}.json`, 'utf8')).themes;
    assert.ok(m.controls.sound && m.editor.introAudio, `${l} sound texts`);
  }
});

test('dashboard theming: the opt-in flag reaches the render theme and every dashboard colour token is a valid HSL triplet', () => {
  const off = buildRenderTheme(snapshot(), null, { premium: false });
  const on = buildRenderTheme(snapshot(), { dashboard: true }, { premium: false });
  assert.equal(off.dashboard, false); assert.equal(on.dashboard, true);
  const vars = Object.entries(themeCssVars(on)).filter(([k]) => k.startsWith('--wt-h-'));
  assert.ok(vars.length >= 9);
  for (const [k, v] of vars) assert.match(String(v), /^\d{1,3} \d{1,3}% \d{1,3}%$/, k);
  const css = readFileSync('app/globals.css', 'utf8');
  assert.match(css, /\.wt-mode-dashboard \{ --background: var\(--wt-h-bg\)/);
});

test('the official dragon renders as a layered rig with every part present', async () => {
  const { OFFICIAL_ELEMENT } = await import('../../lib/themes/official.js');
  const fs = await import('node:fs');
  for (const el of Object.values(OFFICIAL_ELEMENT)) {
    for (const part of ['wing_far', 'tail', 'body', 'head', 'jaw', 'wing_near']) assert.ok(fs.existsSync(new URL(`../../public/themes/rig/${el}/${part}.png`, import.meta.url)), `${el}/${part}`);
  }
});

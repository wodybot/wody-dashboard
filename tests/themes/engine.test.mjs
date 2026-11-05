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

const snapshot = () => ({ id: 'wody_miami_neon', version: 1, config: JSON.parse(JSON.stringify(OFFICIAL.wody_miami_neon)), assets: {} });
const labels = Object.fromEntries(['controls', 'quality', 'auto', 'low', 'medium', 'high', 'ultra', 'using', 'effects', 'animations', 'introOption', 'replay', 'skipIntro'].map((k) => [k, k]));
const html = (theme) => renderToString(React.createElement(ThemeStage, { theme, labels, mode: 'page' }, React.createElement('p', { id: 'child' }, 'hello')));

test('stage: server render is safe, complete and never blocks the page', () => {
  const out = html(buildRenderTheme(snapshot(), null, { premium: false, locale: 'en' }));
  assert.match(out, /data-wt-theme="wody_miami_neon"/);
  assert.match(out, /--wt-primary:#/);
  assert.match(out, /id="child"/, 'page content is rendered inside the stage');
  assert.match(out, /wt-scene/);
  assert.doesNotMatch(out, /wt-intro/, 'there is no intro overlay, so content is never hidden');
  assert.doesNotMatch(out, /wt-char/, 'themes carry no character');
  assert.doesNotMatch(out, /wt-controls/, 'controls appear only after mount');
  assert.doesNotMatch(out, /<script|javascript:|onerror|<style/i);
  assert.equal(hasPictograph(out), false);
  for (const id of C.OFFICIAL_IDS) {
    const o = html(buildRenderTheme({ id, version: 1, config: OFFICIAL[id], assets: {} }, null, { premium: false }));
    assert.match(o, new RegExp(`data-wt-theme="${id}"`));
  }
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
    effects: C.EFFECTS.map((e) => ({ id: e, intensity: 100 })), palette: OFFICIAL.wody_synthwave.palette,
    lighting: { color: '#9bb7ff', intensity: 80 }, budget: 1, fps: 60, allowLightning: true, dpr: 1,
  });
  assert.ok(fx, 'the engine starts on a 2D canvas, no WebGL needed');
  fx.start();
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
  assert.equal(createEffects({ getContext: () => null }, { effects: [], palette: OFFICIAL.wody_synthwave.palette }), null);
  const light = createEffects(fakeCanvas().canvas, { effects: [{ id: 'lightning', intensity: 100 }], palette: OFFICIAL.wody_synthwave.palette, lighting: { color: '#fff', intensity: 10 }, budget: 0.15, fps: 24, allowLightning: false, dpr: 1 });
  light.start(); light.stop();
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
    for (const k of ['theme_studio']) assert.ok(m.modules[k].title && m.modules[k].description, `${l} module ${k}`);
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

test('dashboard theming: the opt-in flag reaches the render theme and every dashboard colour token is a valid HSL triplet', () => {
  const off = buildRenderTheme(snapshot(), { dashboard: false }, { premium: false });
  const on = buildRenderTheme(snapshot(), { dashboard: true }, { premium: false });
  assert.equal(off.dashboard, false); assert.equal(on.dashboard, true);
  assert.equal(buildRenderTheme(snapshot(), null, { premium: false }).dashboard, true, 'a theme applies to the dashboard of its server by default');
  const vars = Object.entries(themeCssVars(on)).filter(([k]) => k.startsWith('--wt-h-'));
  assert.ok(vars.length >= 9);
  for (const [k, v] of vars) assert.match(String(v), /^\d{1,3} \d{1,3}% \d{1,3}%$/, k);
  const css = readFileSync('app/globals.css', 'utf8');
  assert.match(css, /\.wt-mode-dashboard \{ --background: var\(--wt-h-bg\)/);
});

test('every official scene has a drawing and every effect an implementation', async () => {
  const scenes = readFileSync('components/themes/scenes.jsx', 'utf8');
  for (const sc of C.SCENES.filter((x) => x !== 'plain')) assert.match(scenes, new RegExp(`\\b${sc}\\b`), `scene ${sc}`);
  const fx = readFileSync('components/themes/effects.js', 'utf8');
  for (const e of C.EFFECTS) assert.match(fx, new RegExp(`\\b${e}\\b`), `effect ${e}`);
  for (const [id, cfg] of Object.entries(OFFICIAL)) assert.ok(C.SCENES.includes(cfg.environment.scene), id);
});

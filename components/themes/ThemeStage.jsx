'use client';
// Theme Engine, browser side. Draws one render theme (see lib/themes/render.js): environment, character, effects, cinematic intro,
// and the controls that let every visitor turn animations off. It only changes how the page looks; it never touches data, auth or links.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Scene from './scenes';
import { createEffects } from './effects';
import { themeCssVars } from '@/lib/themes/render';
import { PERF, PERF_PROFILES } from '@/lib/themes/constants';
import { playCue } from './sound';
import WodyIcon from '@/components/wody-icon';
import { proxiedImageUrl } from '@/lib/utils';

const ASSET_URL = /^\/api\/site-image\/[a-f0-9]{24}$/;
const PREF_KEY = 'wody-theme-prefs';
const DEFAULT_PREFS = { quality: 'auto', effects: true, motion: true, intro: true, sound: false };
const store = {
  read() { try { return { ...DEFAULT_PREFS, ...JSON.parse(localStorage.getItem(PREF_KEY) || '{}') }; } catch { return DEFAULT_PREFS; } },
  write(p) { try { localStorage.setItem(PREF_KEY, JSON.stringify(p)); } catch { /* private mode: the choice lasts for this visit only */ } },
};

function autoProfile() {
  if (typeof navigator === 'undefined') return 'medium';
  const nav = navigator; const mem = nav.deviceMemory; const cores = nav.hardwareConcurrency || 4;
  if (nav.connection?.saveData || (mem && mem <= 2) || cores <= 2) return 'low';
  if (window.innerWidth < 768) return mem && mem <= 4 ? 'low' : 'medium';
  if (cores >= 12 && mem && mem >= 8) return 'ultra';
  return cores >= 4 ? 'high' : 'medium';
}

function canvasOk() { try { return Boolean(document.createElement('canvas').getContext('2d')); } catch { return false; } }

// The real-time 3D dragon stays off until a finished model is added; the layered 2D dragon is used meanwhile.
const LIVE_3D = false;
const RIG_PARTS = ['wing_far', 'tail', 'body', 'head', 'jaw', 'wing_near'];
// Layered flying dragon: every part is its own image and moves on its own (wing beats, hovering, tail, head, jaw).
function Rig({ element, animate, onFail, rich }) {
  const host = useRef(null);
  const [live, setLive] = useState(false); // true once the real 3D dragon has drawn its first frame
  useEffect(() => {
    if (!rich || !host.current) return undefined;
    let dead = false; let handle = null;
    import('./dragon3d.js').then(({ createDragon }) => {
      if (dead || !host.current) return;
      handle = createDragon(host.current, { element, animate, onReady: () => { if (!dead) setLive(true); }, onFail: () => { if (!dead) setLive(false); } });
    }).catch(() => {});
    return () => { dead = true; if (handle) handle.dispose(); setLive(false); };
  }, [rich, element, animate]);
  return (
    <div className={`wt-rig ${animate && !live ? 'wt-rig-on' : ''}`} style={{ height: '100%', aspectRatio: '3 / 4' }}>
      <div ref={host} className="wt-rig-3d" style={{ position: 'absolute', inset: 0, zIndex: 3, opacity: live ? 1 : 0 }} />
      {RIG_PARTS.map((part) => {
        const src = `/themes/rig/${element}/${part}.png`;
        // eslint-disable-next-line @next/next/no-img-element
        return <img key={part} src={src} alt="" decoding="async" draggable={false} onError={onFail} className={`wt-rig-part wt-rig-${part.replace('_', '-')}`} style={live ? { visibility: 'hidden' } : undefined} />;
      })}
    </div>
  );
}

function Character({ c, animate, mobile, rich }) {
  const src = mobile && c.mobileUrl ? c.mobileUrl : c.url;
  const [broken, setBroken] = useState(false);
  const [rigBroken, setRigBroken] = useState(false);
  const rig = c.rig && !rigBroken ? c.rig : null;
  if (!ASSET_URL.test(src) || broken) return null; // a missing or odd asset is simply not drawn: no broken image, the rest of the theme stays
  const pos = { left: { left: '-4%' }, right: { right: '-4%' }, center: { left: '50%', transform: 'translateX(-50%)' }, hero: { left: '50%', transform: 'translateX(-50%)', top: '4%' }, custom: { left: '50%', transform: 'translateX(-50%)' } }[c.position] || { right: 0 };
  const cls = animate && c.idle !== 'none' ? `wt-char-${c.idle}` : '';
  return (
    <div className={`wt-char ${c.layer === 'foreground' ? 'wt-char-front' : ''}`} style={{ ...pos, marginLeft: `${c.offset_x}%`, marginTop: `${c.offset_y}%`, height: `${c.scale * (mobile ? 0.62 : 0.9)}%`, opacity: mobile ? 0.62 : 1 }}>
      {rig ? (
        <div style={{ height: '100%', transform: `${c.position === 'left' ? 'scaleX(-1) ' : ''}rotate(${c.rotation}deg)`, willChange: 'transform' }}><Rig element={rig} animate={animate} rich={rich} onFail={() => setRigBroken(true)} /></div>
      ) : (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={proxiedImageUrl(src)} alt="" decoding="async" loading="eager" draggable={false} onError={() => setBroken(true)}
        className={cls} style={{ height: '100%', width: 'auto', maxWidth: 'none', transform: `${c.position === 'left' ? 'scaleX(-1) ' : ''}rotate(${c.rotation}deg)`, ['--wt-idle']: `${c.idle_intensity / 100}`, ['--wt-idle-dur']: `${c.idle_duration_ms}ms` }} />
      )}
    </div>
  );
}

// -------------------------------------------------------------------------------------------------------- cinematic intro
function activeSteps(intro, mode, hasCharacter) {
  let steps = intro.steps.filter((s) => s.on && (hasCharacter || !['character', 'eyes', 'breath'].includes(s.id)));
  if (mode === 'short') steps = steps.filter((s) => ['environment', 'character', 'signature', 'reveal'].includes(s.id));
  const cap = mode === 'short' ? 2600 : intro.duration_ms;
  const sum = steps.reduce((n, s) => n + s.ms, 0) || 1;
  const k = Math.min(1, cap / sum);
  return steps.map((s) => ({ id: s.id, ms: Math.max(120, Math.round(s.ms * k)) }));
}

function Intro({ theme, mode, hasCharacter, fx, onDone, labels, sound }) {
  const steps = useMemo(() => activeSteps(theme.intro, mode, hasCharacter), [theme.intro, mode, hasCharacter]);
  const total = steps.reduce((n, s) => n + s.ms, 0);
  const [state, setState] = useState({ i: 0, out: false });
  const fired = useRef(false); const doneRef = useRef(false);
  const finish = useCallback(() => { if (doneRef.current) return; doneRef.current = true; setState((s) => ({ ...s, out: true })); setTimeout(onDone, theme.transitions.duration_ms + 200); }, [onDone, theme.transitions.duration_ms]);
  useEffect(() => {
    let i = 0; let timer;
    const next = () => {
      if (doneRef.current) return;
      if (i >= steps.length) { finish(); return; }
      const s = steps[i]; setState({ i, out: false });
      if (s.id === 'signature' && !fired.current && fx) { fired.current = true; if (sound && theme.intro.audio) playCue(theme.intro.signature); const o = theme.intro.breath_origin; fx.burst(theme.intro.signature, o.x / 100, o.y / 100, o.angle); }
      i += 1; timer = setTimeout(next, s.ms);
    };
    next();
    return () => clearTimeout(timer);
  }, [steps, finish, fx, theme.intro]);
  useEffect(() => {
    const key = (e) => { if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') finish(); };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [finish]);
  const cur = steps[state.i]?.id || 'dark';
  const progress = Math.min(1, steps.slice(0, state.i + 1).reduce((n, s) => n + s.ms, 0) / total);
  return (
    <div className={`wt-intro wt-out-${theme.intro.transition} ${state.out ? 'wt-intro-out' : ''}`} data-step={cur} style={{ ['--wt-out-dur']: `${theme.transitions.duration_ms}ms` }}
      onClick={finish} aria-hidden="true">
      <div className="wt-intro-light" />
      <button type="button" className="wt-skip" onClick={(e) => { e.stopPropagation(); finish(); }} aria-hidden="false" aria-label={labels.skipIntro}>
        <WodyIcon name="skip" size={16} /> <span>{labels.skipIntro}</span>
      </button>
      <div className="wt-intro-bar"><span style={{ width: `${progress * 100}%` }} /></div>
    </div>
  );
}

// -------------------------------------------------------------------------------------------------------- controls
function Controls({ prefs, setPrefs, hasIntro, audible, onReplay, labels, effective }) {
  const [open, setOpen] = useState(false);
  const set = (p) => { const n = { ...prefs, ...p }; setPrefs(n); store.write(n); };
  return (
    <div className="wt-controls">
      <button type="button" className="wt-controls-btn" aria-expanded={open} aria-controls="wt-controls-panel" onClick={() => setOpen(!open)} title={labels.controls}>
        <WodyIcon name="theme" size={18} /><span className="sr-only">{labels.controls}</span>
      </button>
      {open ? (
        <div id="wt-controls-panel" className="wt-controls-panel" role="group" aria-label={labels.controls}>
          <label className="wt-row"><span>{labels.quality}</span>
            <select value={prefs.quality} onChange={(e) => set({ quality: e.target.value })}>
              <option value="auto">{labels.auto}</option>
              {PERF_PROFILES.map((p) => <option key={p} value={p}>{labels[p]}</option>)}
            </select>
          </label>
          <p className="wt-note">{labels.using.replace('{profile}', labels[effective] || effective)}</p>
          <label className="wt-row"><span>{labels.effects}</span><input type="checkbox" checked={prefs.effects} onChange={(e) => set({ effects: e.target.checked })} /></label>
          <label className="wt-row"><span>{labels.animations}</span><input type="checkbox" checked={prefs.motion} onChange={(e) => set({ motion: e.target.checked })} /></label>
          {hasIntro ? <label className="wt-row"><span>{labels.introOption}</span><input type="checkbox" checked={prefs.intro} onChange={(e) => set({ intro: e.target.checked })} /></label> : null}
          {hasIntro && audible ? <label className="wt-row"><span>{labels.sound}</span><input type="checkbox" checked={prefs.sound} onChange={(e) => set({ sound: e.target.checked })} /></label> : null}
          {hasIntro && prefs.intro ? <button type="button" className="wt-replay" onClick={() => { setOpen(false); onReplay(); }}><WodyIcon name="play" size={14} /> {labels.replay}</button> : null}
        </div>
      ) : null}
    </div>
  );
}

// -------------------------------------------------------------------------------------------------------- stage
/**
 * mode: 'page' (full website theme: scene, character, effects, intro, controls), 'dashboard' (colors, scene and soft effects only),
 *       'embedded' (inside a preview frame: no controls, never fixed to the window, no intro unless `autoIntro`).
 */
export default function ThemeStage({ theme, labels, mode = 'page', children, className = '', autoIntro = false, forceProfile = null, forceReduced = false }) {
  const rootRef = useRef(null); const canvasRef = useRef(null); const fxRef = useRef(null);
  const [prefs, setPrefs] = useState(DEFAULT_PREFS);
  const [ready, setReady] = useState(false);
  const [reducedOS, setReducedOS] = useState(false);
  const [profile, setProfile] = useState('medium');
  const [canvasSupported, setCanvasSupported] = useState(true);
  const [introKey, setIntroKey] = useState(0); const [introOn, setIntroOn] = useState(false);
  const [narrow, setNarrow] = useState(false);
  const embedded = mode === 'embedded';

  useEffect(() => {
    setPrefs(store.read()); setCanvasSupported(canvasOk());
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)'); setReducedOS(mq.matches);
    const onMq = () => setReducedOS(mq.matches); mq.addEventListener?.('change', onMq);
    const onResize = () => setNarrow(window.innerWidth < 768); onResize(); window.addEventListener('resize', onResize);
    setProfile(autoProfile()); setReady(true);
    return () => { mq.removeEventListener?.('change', onMq); window.removeEventListener('resize', onResize); };
  }, []);

  const reduced = forceReduced || reducedOS || !prefs.motion;
  const effective = forceProfile || (prefs.quality === 'auto' ? profile : prefs.quality);
  const perf = PERF[effective] || PERF.medium;
  const vars = useMemo(() => themeCssVars(theme), [theme]);
  const bgUrl = theme.environment.backgroundUrl && ASSET_URL.test(theme.environment.backgroundUrl) ? proxiedImageUrl(theme.environment.backgroundUrl) : null;
  const wantsFx = ready && !reduced && prefs.effects && canvasSupported && theme.effects.length > 0 && (mode !== 'dashboard' || effective !== 'low') && effective !== 'low' && !(embedded && forceReduced);
  const hasChar = Boolean(theme.character) && mode !== 'dashboard';

  // Effects canvas
  useEffect(() => {
    if (!wantsFx || !canvasRef.current) return undefined;
    const soft = mode === 'dashboard' ? 0.45 : 1;
    const fx = createEffects(canvasRef.current, {
      effects: theme.effects.map((e) => ({ ...e, intensity: e.intensity * soft })), palette: theme.palette, lighting: theme.environment.lighting,
      budget: perf.particles * (narrow ? 0.6 : 1), fps: perf.fps, allowLightning: perf.lightning && mode !== 'dashboard', dpr: Math.min(window.devicePixelRatio || 1, perf.dpr),
    });
    if (!fx) return undefined;
    fxRef.current = fx; fx.start();
    const ro = new ResizeObserver(() => fx.resize()); ro.observe(canvasRef.current);
    const vis = () => { if (document.hidden) fx.stop(); else fx.start(); }; document.addEventListener('visibilitychange', vis);
    // frame governor: if the device cannot keep up, step down once and finally switch the canvas off (the static scene stays)
    let slow = 0; let frames = 0; let prev = performance.now(); let stopped = false; let guard = 0;
    const watch = (now) => {
      if (stopped) return;
      frames += 1; const dt = now - prev; prev = now; if (dt > 70) slow += 1;
      if (frames >= 90) { if (slow > 30) { stopped = true; fx.stop(); fx.clear(); setPrefs((p) => ({ ...p, effects: false })); return; } frames = 0; slow = 0; }
      guard = requestAnimationFrame(watch);
    };
    guard = requestAnimationFrame(watch);
    return () => { stopped = true; cancelAnimationFrame(guard); fx.stop(); ro.disconnect(); document.removeEventListener('visibilitychange', vis); fxRef.current = null; };
  }, [wantsFx, theme.id, theme.version, theme.effects, theme.palette, theme.environment.lighting, perf, narrow, mode]);

  // Intro: once per browser session and theme version; never for reduced motion, never in the dashboard, shorter on small screens
  const introMode = useMemo(() => {
    if (!theme.intro || reduced || mode === 'dashboard' || !prefs.intro) return 'off';
    const byProfile = perf.intro; const byTheme = narrow ? theme.intro.mobile : 'full';
    if (byProfile === 'off' || byTheme === 'off') return 'off';
    return byProfile === 'short' || byTheme === 'short' || narrow ? 'short' : 'full';
  }, [theme.intro, reduced, mode, prefs.intro, perf.intro, narrow]);
  useEffect(() => {
    if (!ready || introMode === 'off' || (embedded && !autoIntro)) return;
    const key = `wody-intro:${theme.id}:${theme.version}`;
    try { if (sessionStorage.getItem(key)) return; sessionStorage.setItem(key, '1'); } catch { /* storage blocked: play it this once */ }
    setIntroOn(true); setIntroKey((k) => k + 1);
  }, [ready, introMode, theme.id, theme.version, embedded, autoIntro]);
  const replay = useCallback(() => { setIntroOn(true); setIntroKey((k) => k + 1); }, []);

  const parallaxRef = useRef(null);
  useEffect(() => {
    if (!ready || reduced || !theme.environment.parallax || effective === 'low' || embedded || narrow) return undefined;
    const el = parallaxRef.current; if (!el) return undefined;
    let raf = 0; let tx = 0; let ty = 0;
    const move = (e) => { tx = (e.clientX / window.innerWidth - 0.5) * 2; ty = (e.clientY / window.innerHeight - 0.5) * 2; if (!raf) raf = requestAnimationFrame(() => { raf = 0; el.style.setProperty('--wt-px', tx.toFixed(3)); el.style.setProperty('--wt-py', ty.toFixed(3)); }); };
    window.addEventListener('pointermove', move, { passive: true });
    return () => { window.removeEventListener('pointermove', move); cancelAnimationFrame(raf); };
  }, [ready, reduced, theme.environment.parallax, effective, embedded, narrow]);

  const animate = ready && !reduced;
  const L = labels;
  return (
    <div ref={rootRef} className={`wt-root wt-mode-${mode} ${reduced ? 'wt-static' : ''} ${className}`} data-wt-theme={theme.id} data-wt-density={theme.density}
      data-wt-cards={theme.components.card_style} data-wt-nav={theme.components.nav_style} data-wt-header={theme.components.header_style} style={vars}>
      <div className="wt-bg" ref={parallaxRef} aria-hidden="true">
        <Scene scene={theme.environment.scene} palette={theme.palette} lighting={theme.environment.lighting} fog={theme.environment.fog} animate={animate} backgroundUrl={bgUrl} />
        {theme.logo && ASSET_URL.test(theme.logo) ? <img className="wt-logo" src={proxiedImageUrl(theme.logo)} alt="" width="56" height="56" decoding="async" /> : null}
        {theme.banner ? <div className="wt-banner" style={{ backgroundImage: `url("${proxiedImageUrl(theme.banner)}")` }} /> : null}
        {hasChar ? <Character c={theme.character} animate={animate} mobile={narrow} rich={LIVE_3D && (effective === 'ultra' || effective === 'high')} /> : null}
        <canvas ref={canvasRef} className="wt-fx" />
        <div className="wt-scrim" />
        <div className="wt-vignette" />
      </div>
      {introOn && theme.intro && introMode !== 'off' ? <Intro key={introKey} theme={theme} mode={introMode} hasCharacter={hasChar} sound={prefs.sound} fx={fxRef.current} onDone={() => setIntroOn(false)} labels={L} /> : null}
      <div className="wt-content">{children}</div>
      {mode === 'page' && ready ? <Controls prefs={prefs} setPrefs={setPrefs} hasIntro={Boolean(theme.intro) && introMode !== 'off'} audible={Boolean(theme.intro?.audio)} onReplay={replay} labels={L} effective={effective} /> : null}
    </div>
  );
}

export function stageLabels(t) {
  const keys = ['controls', 'quality', 'auto', 'low', 'medium', 'high', 'ultra', 'using', 'effects', 'animations', 'introOption', 'sound', 'replay', 'skipIntro'];
  // `using` keeps its {profile} placeholder: the stage fills it in, so it is read raw
  return Object.fromEntries(keys.map((k) => [k, k === 'using' ? t.raw(`controls.${k}`) : t(`controls.${k}`)]));
}

'use client';
// Theme Engine, browser side. Draws one render theme (see lib/themes/render.js): the scene, the effects
// and the controls that let every visitor turn animations off. It only changes how the page looks; it never touches data, auth or links.
import { useEffect, useMemo, useRef, useState } from 'react';
import Scene from './scenes';
import { createEffects } from './effects';
import { themeCssVars } from '@/lib/themes/render';
import { PERF, PERF_PROFILES } from '@/lib/themes/constants';
import WodyIcon from '@/components/wody-icon';
import { proxiedImageUrl } from '@/lib/utils';

const ASSET_URL = /^\/api\/site-image\/[a-f0-9]{24}$/;
const PREF_KEY = 'wody-theme-prefs';
const DEFAULT_PREFS = { quality: 'auto', effects: true, motion: true };
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

// -------------------------------------------------------------------------------------------------------- controls
function Controls({ prefs, setPrefs, labels, effective }) {
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
        </div>
      ) : null}
    </div>
  );
}

/**
 * mode: 'page' (full website theme: scene, effects, controls), 'dashboard' (colors, scene and soft effects only),
 *       'embedded' (inside a preview frame: no controls, never fixed to the window).
 */
export default function ThemeStage({ theme, labels, mode = 'page', children, className = '', autoIntro = false, forceProfile = null, forceReduced = false }) {
  const rootRef = useRef(null); const canvasRef = useRef(null); const fxRef = useRef(null);
  const [prefs, setPrefs] = useState(DEFAULT_PREFS);
  const [ready, setReady] = useState(false);
  const [reducedOS, setReducedOS] = useState(false);
  const [profile, setProfile] = useState('medium');
  const [canvasSupported, setCanvasSupported] = useState(true);
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
        <canvas ref={canvasRef} className="wt-fx" />
        <div className="wt-scrim" />
        <div className="wt-vignette" />
      </div>
      <div className="wt-content">{children}</div>
      {mode === 'page' && ready ? <Controls prefs={prefs} setPrefs={setPrefs} labels={L} effective={effective} /> : null}
    </div>
  );
}

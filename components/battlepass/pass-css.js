// Styles of the Battle Pass page. Written once and scoped to .bp-root. Everything that can change is a CSS variable
// set from a validated theme (lib/battlepass/theme-style.js); there is no user-provided CSS.
export const PASS_CSS = `
.bp-root{--bp-pad:clamp(14px,3vw,36px);position:relative;min-height:100vh;color:var(--bp-text);font-family:var(--bp-body);font-size:calc(1rem * var(--bp-scale));overflow-x:clip;isolation:isolate}
.bp-root *{box-sizing:border-box}
.bp-root h1,.bp-root h2,.bp-root h3{font-family:var(--bp-heading);font-weight:var(--bp-weight);letter-spacing:var(--bp-letter);margin:0}
.bp-wide h1,.bp-wide h2,.bp-wide h3{font-stretch:125%;letter-spacing:calc(var(--bp-letter) + .06em);text-transform:uppercase}
.bp-condensed h1,.bp-condensed h2,.bp-condensed h3{font-stretch:75%;text-transform:uppercase}
.bp-bg,.bp-fx{position:fixed;inset:0;pointer-events:none}
.bp-bg{z-index:-3;background:var(--bp-bg)}
.bp-bg-image{position:absolute;inset:-4%;filter:blur(var(--bp-blur));will-change:transform}
.bp-bg-dim{position:absolute;inset:0;background:rgba(0,0,0,var(--bp-dim))}
.bp-pattern{position:absolute;inset:0;opacity:.9}
.bp-aurora{position:absolute;inset:-20%;background:radial-gradient(40% 35% at 20% 30%,color-mix(in srgb,var(--bp-accent) 45%,transparent),transparent 70%),radial-gradient(35% 40% at 80% 20%,color-mix(in srgb,var(--bp-accent2) 40%,transparent),transparent 70%),radial-gradient(45% 40% at 60% 85%,color-mix(in srgb,var(--bp-accent) 30%,transparent),transparent 70%);filter:blur(40px);animation:bp-aurora calc(24s * var(--bp-motion)) ease-in-out infinite alternate}
.bp-grain{position:absolute;inset:0;opacity:var(--bp-grain);mix-blend-mode:overlay;background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>")}
.bp-vignette{position:absolute;inset:0;background:radial-gradient(ellipse at center,transparent 45%,rgba(0,0,0,var(--bp-vignette)) 100%)}
.bp-scan{position:absolute;inset:0;opacity:var(--bp-scan);background:repeating-linear-gradient(0deg,rgba(0,0,0,.6) 0 1px,transparent 1px 3px)}
.bp-particles{z-index:-2;width:100%;height:100%}
.bp-wrap{margin:0 auto;width:100%;max-width:var(--bp-max);padding:var(--bp-pad);display:flex;flex-direction:column;gap:calc(var(--bp-gap) * 1.4)}
.bp-topbar{display:flex;align-items:center;justify-content:space-between;gap:10px}
.bp-pill{display:inline-flex;align-items:center;gap:8px;border-radius:999px;border:1px solid color-mix(in srgb,var(--bp-border) 22%,transparent);background:rgba(0,0,0,.4);backdrop-filter:blur(10px);padding:7px 14px;font-size:.78rem;font-weight:600;color:var(--bp-text);text-decoration:none;cursor:pointer;transition:border-color .2s,color .2s}
.bp-pill:hover,.bp-pill:focus-visible{border-color:var(--bp-accent);color:var(--bp-accent);outline:none}
.bp-card{position:relative;border-radius:var(--bp-radius);padding:calc(var(--bp-gap) * 1.2);background:color-mix(in srgb,var(--bp-surface) 70%,transparent);border:1px solid color-mix(in srgb,var(--bp-border) 14%,transparent)}
.bp-card-glass{backdrop-filter:blur(16px) saturate(1.3);box-shadow:0 10px 40px -12px rgba(0,0,0,.6)}
.bp-card-solid{background:var(--bp-surface)}
.bp-card-outline{background:transparent;border:2px solid color-mix(in srgb,var(--bp-accent) 55%,transparent)}
.bp-card-neon{background:color-mix(in srgb,var(--bp-surface) 85%,transparent);border:1px solid var(--bp-accent);box-shadow:0 0 calc(24px * var(--bp-glow)) color-mix(in srgb,var(--bp-accent) 55%,transparent),inset 0 0 calc(18px * var(--bp-glow)) color-mix(in srgb,var(--bp-accent) 18%,transparent)}
.bp-card-flat{border:0;box-shadow:none}
.bp-hero{display:grid;gap:var(--bp-gap);align-items:center;text-align:center;padding:calc(var(--bp-gap) * 2) calc(var(--bp-gap) * 1.2);overflow:hidden}
.bp-hero-banner{position:absolute;inset:0;background-size:cover;background-position:center;opacity:.35;mask-image:linear-gradient(#000 40%,transparent)}
.bp-hero > *{position:relative}
.bp-logo{height:64px;width:auto;margin:0 auto;object-fit:contain}
.bp-h1{font-size:clamp(1.8rem,5vw,3.2rem);line-height:1.08}
.bp-sub{color:var(--bp-muted);max-width:60ch;margin:0 auto}
.bp-meta{display:flex;flex-wrap:wrap;gap:8px;justify-content:center}
.bp-chip{border-radius:999px;border:1px solid color-mix(in srgb,var(--bp-border) 20%,transparent);background:rgba(0,0,0,.25);padding:4px 12px;font-size:.78rem;color:var(--bp-muted)}
.bp-chip b{color:var(--bp-text)}
.bp-title-gradient{background:linear-gradient(90deg,var(--bp-accent),var(--bp-accent2),var(--bp-accent));background-size:200% 100%;-webkit-background-clip:text;background-clip:text;color:transparent;animation:bp-slide calc(6s * var(--bp-motion)) linear infinite}
.bp-title-glow{text-shadow:0 0 calc(24px * var(--bp-glow)) var(--bp-accent),0 0 calc(54px * var(--bp-glow)) var(--bp-accent2)}
.bp-title-neon{color:#fff;text-shadow:0 0 4px #fff,0 0 calc(14px * var(--bp-glow)) var(--bp-accent),0 0 calc(34px * var(--bp-glow)) var(--bp-accent),0 0 calc(60px * var(--bp-glow)) var(--bp-accent2)}
.bp-title-shimmer{background:linear-gradient(110deg,var(--bp-text) 35%,var(--bp-accent) 50%,var(--bp-text) 65%);background-size:250% 100%;-webkit-background-clip:text;background-clip:text;color:transparent;animation:bp-shimmer calc(3.2s * var(--bp-motion)) ease-in-out infinite}
.bp-title-typewriter{display:inline-block;overflow:hidden;white-space:nowrap;border-right:.12em solid var(--bp-accent);animation:bp-type calc(2.4s * var(--bp-motion)) steps(28,end) both,bp-caret .8s step-end infinite;max-width:100%}
.bp-progress{display:grid;gap:10px}
.bp-progress-head{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:baseline;gap:8px}
.bp-level{font-family:var(--bp-heading);font-size:1.6rem;font-weight:var(--bp-weight)}
.bp-bar{height:14px;border-radius:999px;background:rgba(255,255,255,.1);overflow:hidden}
.bp-bar > i{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,var(--bp-accent),var(--bp-accent2));box-shadow:0 0 calc(16px * var(--bp-glow)) var(--bp-accent);transition:width calc(.9s * var(--bp-motion)) cubic-bezier(.2,.8,.2,1)}
.bp-segments{display:grid;grid-auto-flow:column;gap:4px}.bp-segments > i{height:14px;border-radius:4px;background:rgba(255,255,255,.1)}.bp-segments > i.on{background:linear-gradient(90deg,var(--bp-accent),var(--bp-accent2))}
.bp-ring{--p:0;width:132px;height:132px;border-radius:50%;display:grid;place-items:center;background:conic-gradient(var(--bp-accent) calc(var(--p) * 1%),rgba(255,255,255,.1) 0);position:relative}.bp-ring::after{content:"";position:absolute;inset:11px;border-radius:50%;background:var(--bp-surface)}.bp-ring > span{position:relative;z-index:1;font-weight:700}
.bp-orb{--p:0;width:120px;height:120px;border-radius:50%;position:relative;overflow:hidden;border:2px solid var(--bp-accent);background:rgba(0,0,0,.4);box-shadow:0 0 calc(30px * var(--bp-glow)) var(--bp-accent)}.bp-orb::before{content:"";position:absolute;left:-10%;right:-10%;bottom:0;height:calc(var(--p) * 1%);background:linear-gradient(var(--bp-accent2),var(--bp-accent));opacity:.85;transition:height 1s}.bp-orb > span{position:relative;z-index:1;display:grid;place-items:center;height:100%;font-weight:700}
.bp-sticky{position:sticky;top:10px;z-index:5}
.bp-section-title{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:var(--bp-gap)}
.bp-section-title h2{font-size:1.25rem}
.bp-track{display:flex;gap:var(--bp-gap);overflow-x:auto;padding:6px 4px 14px;scroll-snap-type:x proximity}
.bp-track > *{scroll-snap-align:start;flex:0 0 min(210px,70vw)}
.bp-grid{display:grid;gap:var(--bp-gap);grid-template-columns:repeat(auto-fill,minmax(190px,1fr))}
.bp-cards{display:grid;gap:var(--bp-gap);grid-template-columns:repeat(auto-fill,minmax(300px,1fr))}
.bp-timeline{position:relative;display:grid;gap:var(--bp-gap);padding-left:28px}.bp-timeline::before{content:"";position:absolute;left:9px;top:6px;bottom:6px;width:2px;background:linear-gradient(var(--bp-accent),var(--bp-accent2));opacity:.5}
.bp-timeline > *{position:relative}.bp-timeline > *::before{content:"";position:absolute;left:-26px;top:22px;width:12px;height:12px;border-radius:50%;background:var(--bp-accent);box-shadow:0 0 calc(14px * var(--bp-glow)) var(--bp-accent)}
.bp-reward{display:flex;flex-direction:column;gap:8px;text-align:left;border-radius:var(--bp-radius);padding:14px;background:color-mix(in srgb,var(--bp-surface) 78%,transparent);border:1px solid color-mix(in srgb,var(--bp-border) 14%,transparent);transition:transform calc(.25s * var(--bp-motion)),box-shadow .25s,border-color .25s}
.bp-hover-lift .bp-reward:hover{transform:translateY(-5px)}
.bp-hover-glow .bp-reward:hover{box-shadow:0 0 calc(28px * var(--bp-glow)) var(--bp-accent);border-color:var(--bp-accent)}
.bp-hover-tilt .bp-reward:hover{transform:perspective(600px) rotateX(4deg) rotateY(-5deg) translateY(-3px)}
.bp-hover-shine .bp-reward{overflow:hidden}.bp-hover-shine .bp-reward::after{content:"";position:absolute;inset:0;background:linear-gradient(105deg,transparent 40%,rgba(255,255,255,.25) 50%,transparent 60%);transform:translateX(-120%);transition:transform .7s}.bp-hover-shine .bp-reward:hover::after{transform:translateX(120%)}
.bp-reward{position:relative}
.bp-art{aspect-ratio:1;border-radius:calc(var(--bp-radius) * .7);display:grid;place-items:center;background:radial-gradient(circle at 30% 20%,color-mix(in srgb,var(--rc,var(--bp-accent)) 55%,transparent),rgba(0,0,0,.35));overflow:hidden;font-size:2.4rem}
.bp-art img{width:100%;height:100%;object-fit:contain}
.bp-state-locked{opacity:.62;filter:saturate(.55)}
.bp-state-claimed{border-color:var(--bp-good)}
.bp-state-available{border-color:var(--bp-accent);box-shadow:0 0 calc(22px * var(--bp-glow)) color-mix(in srgb,var(--bp-accent) 60%,transparent);animation:bp-pulse calc(2.2s * var(--bp-motion)) ease-in-out infinite}
.bp-rarity-subtle .bp-reward{box-shadow:0 0 calc(12px * var(--bp-glow)) color-mix(in srgb,var(--rc) 40%,transparent)}
.bp-rarity-strong .bp-reward{box-shadow:0 0 calc(26px * var(--bp-glow)) color-mix(in srgb,var(--rc) 70%,transparent);border-color:var(--rc)}
.bp-name{font-weight:700;line-height:1.2}.bp-desc{font-size:.8rem;color:var(--bp-muted)}
.bp-tag{font-size:.68rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--rc,var(--bp-muted))}
.bp-btn{border:0;border-radius:999px;padding:9px 16px;font-weight:700;font-size:.82rem;cursor:pointer;color:#111;background:linear-gradient(90deg,var(--bp-accent),var(--bp-accent2));transition:transform .15s,filter .15s}
.bp-btn:hover:not(:disabled){transform:translateY(-1px);filter:brightness(1.1)}.bp-btn:disabled{opacity:.5;cursor:not-allowed}
.bp-btn:focus-visible,.bp-reward:focus-visible{outline:2px solid var(--bp-accent);outline-offset:2px}
.bp-list{display:grid;gap:10px}
.bp-row{display:grid;gap:6px;border-radius:calc(var(--bp-radius) * .7);padding:12px 14px;background:rgba(0,0,0,.22);border:1px solid color-mix(in srgb,var(--bp-border) 10%,transparent)}
.bp-row-head{display:flex;justify-content:space-between;gap:8px;align-items:center}
.bp-mini{height:8px;border-radius:999px;background:rgba(255,255,255,.1);overflow:hidden}.bp-mini > i{display:block;height:100%;background:linear-gradient(90deg,var(--bp-accent),var(--bp-accent2))}
.bp-done{color:var(--bp-good);font-weight:700;font-size:.8rem}
.bp-muted{color:var(--bp-muted)}
.bp-enter-fade .bp-enter,.bp-enter-slide .bp-enter,.bp-enter-zoom .bp-enter,.bp-enter-stagger .bp-enter{animation:bp-in calc(.6s * var(--bp-motion)) both}
.bp-enter-slide .bp-enter{animation-name:bp-slide-in}.bp-enter-zoom .bp-enter{animation-name:bp-zoom-in}
.bp-enter-stagger .bp-enter{animation-delay:calc(var(--i,0) * 60ms * var(--bp-motion))}
.bp-fx-layer{position:fixed;inset:0;pointer-events:none;z-index:60;overflow:hidden}
.bp-burst{position:absolute;width:10px;height:10px;border-radius:2px;animation:bp-burst calc(1.3s * var(--bp-motion)) cubic-bezier(.1,.7,.3,1) forwards}
.bp-flash{position:absolute;inset:0;background:radial-gradient(circle,color-mix(in srgb,var(--bp-accent) 60%,transparent),transparent 70%);animation:bp-flash calc(.8s * var(--bp-motion)) ease-out forwards}
.bp-shock{position:absolute;left:50%;top:50%;width:20px;height:20px;margin:-10px;border-radius:50%;border:3px solid var(--bp-accent);animation:bp-shock calc(1.1s * var(--bp-motion)) ease-out forwards}
.bp-toast{position:fixed;left:50%;bottom:22px;transform:translateX(-50%);z-index:70;max-width:min(92vw,420px);border-radius:14px;padding:12px 18px;background:rgba(0,0,0,.85);border:1px solid var(--bp-accent);color:#fff;font-weight:600;text-align:center}
@keyframes bp-aurora{to{transform:translate3d(4%,3%,0) rotate(6deg) scale(1.08)}}
@keyframes bp-slide{to{background-position:200% 0}}
@keyframes bp-shimmer{0%{background-position:150% 0}100%{background-position:-50% 0}}
@keyframes bp-type{from{width:0}to{width:100%}}@keyframes bp-caret{50%{border-color:transparent}}
@keyframes bp-pulse{50%{box-shadow:0 0 calc(38px * var(--bp-glow)) color-mix(in srgb,var(--bp-accent) 85%,transparent)}}
@keyframes bp-in{from{opacity:0}to{opacity:1}}
@keyframes bp-slide-in{from{opacity:0;transform:translateY(22px)}to{opacity:1;transform:none}}
@keyframes bp-zoom-in{from{opacity:0;transform:scale(.9)}to{opacity:1;transform:none}}
@keyframes bp-burst{from{transform:translate(0,0) rotate(0);opacity:1}to{transform:translate(var(--dx),var(--dy)) rotate(var(--r));opacity:0}}
@keyframes bp-flash{from{opacity:1}to{opacity:0}}
@keyframes bp-shock{from{transform:scale(1);opacity:.9}to{transform:scale(60);opacity:0}}
@media (prefers-reduced-motion:reduce){.bp-root *,.bp-root *::before,.bp-root *::after{animation:none!important;transition:none!important}.bp-title-typewriter{width:auto;border-right:0}.bp-fx-layer{display:none}}
@media (max-width:640px){.bp-hero{padding:calc(var(--bp-gap) * 1.4) var(--bp-gap)}.bp-track > *{flex-basis:78vw}}
`;

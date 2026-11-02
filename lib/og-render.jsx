// Renders the social link-preview card (Discord, Telegram, X, search) in one of
// several looks. Shared by app/opengraph-image.js (the saved choice, what
// Discord fetches) and app/api/og/route.js (any look on demand, used by the
// Owner Panel to preview and compare them).
//
// satori (next/og) only supports a flexbox subset, so every element that has
// more than one child is display:flex and spacing uses margins.
import { ImageResponse } from 'next/og';
import { readFile } from 'fs/promises';
import path from 'path';

export const OG_VARIANTS = ['passport', 'showcase', 'minimal', 'classic'];
export const OG_DEFAULT_VARIANT = 'passport';
export const OG_SIZE = { width: 1200, height: 630 };

const SITE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://wody.online';
const interRegular = readFile(path.join(process.cwd(), 'assets/fonts/Inter-Regular.ttf'));
const interBold = readFile(path.join(process.cwd(), 'assets/fonts/Inter-Bold.ttf'));

const C = {
  bg1: '#150c07', bg2: '#2a1509', brand: '#a0642e', brandLight: '#e08a4e', tan: '#f2c091',
  text: '#ffffff', soft: '#f1e7db', muted: '#b9a08a', gold: '#e6c36a',
};

const host = () => (SITE_URL || 'wody.online').replace(/^https?:\/\//, '');

function Logo({ size = 72, media }) {
  if (media) {
    // Drawn by the server into the PNG (satori), never loaded by a visitor's browser.
    const src = media;
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} width={size} height={size} style={{ borderRadius: size * 0.26, objectFit: 'cover', border: '1px solid rgba(216,154,92,0.6)' }} />;
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: size, height: size, borderRadius: size * 0.26, background: 'linear-gradient(160deg, #8a3c14 0%, #6B2E10 100%)', border: '1px solid rgba(216,154,92,0.6)' }}>
      <span style={{ display: 'flex', color: '#fff', fontSize: size * 0.56, fontWeight: 900 }}>W</span>
    </div>
  );
}

function Glows() {
  return (
    <>
      <div style={{ display: 'flex', position: 'absolute', top: -140, left: -100, width: 520, height: 520, borderRadius: 520, background: 'radial-gradient(circle, rgba(160,100,46,0.34) 0%, rgba(160,100,46,0) 70%)' }} />
      <div style={{ display: 'flex', position: 'absolute', bottom: -160, right: -120, width: 480, height: 480, borderRadius: 480, background: 'radial-gradient(circle, rgba(224,138,78,0.22) 0%, rgba(224,138,78,0) 70%)' }} />
    </>
  );
}

// ---- layout maths -------------------------------------------------------------------------
// satori cannot measure text, so every block is sized from an estimate of its width. The estimate is
// deliberately a little wide (0.6 em per character), so text always ends up smaller than its box and
// can never run into the next block. Each look gives every block a fixed height budget.
const CHAR_W = 0.55;
const textW = (text, size, k = CHAR_W) => String(text).length * size * k;

// Largest size (between min and max) at which the text fits in `lines` lines of `width`.
function fitText(text, width, { max, min, lines = 1, k = CHAR_W }) {
  for (let size = max; size >= min; size -= 2) {
    const need = Math.ceil(textW(text, size, k) / (width * 0.94));
    if (need <= lines) return { size, lines: Math.max(1, need) };
  }
  return { size: min, lines };
}

// Every module as a chip. Picks the largest chip size at which ALL chips fit the box; only when even the
// smallest size does not fit are the last ones replaced by a "+N more" chip.
function planChips(modules, width, height, { max = 24, min = 13 } = {}) {
  const geo = (fs) => {
    const padX = Math.round(fs * 0.72);
    const padY = Math.round(fs * 0.3);
    const gap = Math.max(6, Math.round(fs * 0.42));
    return { fs, padX, padY, gap, rowH: Math.ceil(fs * 1.2) + padY * 2 + 3 + gap };
  };
  const rowsFor = (list, g) => {
    let rows = 1; let x = 0;
    for (const m of list) {
      const w = textW(m, g.fs, 0.58) + g.padX * 2 + 3 + g.gap;
      if (x + w > width && x > 0) { rows += 1; x = 0; }
      x += w;
    }
    return rows;
  };
  for (let fs = max; fs >= min; fs -= 1) {
    const g = geo(fs);
    if (rowsFor(modules, g) * g.rowH - g.gap <= height) return { ...g, list: modules, hidden: 0 };
  }
  const g = geo(min);
  let keep = modules.length;
  while (keep > 1 && rowsFor([...modules.slice(0, keep), `+${modules.length - keep + 1} more`], g) * g.rowH - g.gap > height) keep -= 1;
  return { ...g, list: modules.slice(0, keep), hidden: modules.length - keep };
}

function Chips({ plan, justify = 'flex-start' }) {
  const { fs, padX, padY, gap, list, hidden } = plan;
  const chip = { display: 'flex', fontSize: fs, fontWeight: 700, borderRadius: 999, padding: `${padY}px ${padX}px`, marginRight: gap, marginBottom: gap };
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: justify, width: '100%', overflow: 'hidden' }}>
      {list.map((m) => (
        <div key={m} style={{ ...chip, color: C.tan, background: 'linear-gradient(180deg, rgba(176,110,52,0.36) 0%, rgba(160,100,46,0.18) 100%)', border: '1.5px solid rgba(230,170,110,0.55)' }}>{m}</div>
      ))}
      {hidden > 0 && <div style={{ ...chip, color: C.soft, background: 'rgba(255,255,255,0.06)', border: '1.5px dashed rgba(241,231,219,0.5)' }}>{`+${hidden} more`}</div>}
    </div>
  );
}

function NewPill({ size = 18 }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', background: 'linear-gradient(90deg, #e6c36a 0%, #c9a24a 100%)', color: '#1a1206', fontSize: size, fontWeight: 800, letterSpacing: 1.2, borderRadius: 999, padding: `${size * 0.22}px ${size * 0.7}px` }}>
      NEW
    </div>
  );
}

// A small fictional passport card, drawn with plain shapes.
function PassportCard() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: 400, height: 262, borderRadius: 22, padding: 16, background: 'linear-gradient(145deg, #0b1d3a 0%, #102a52 55%, #0b1d3a 100%)', border: '3px solid #c9a24a', boxShadow: '0 30px 70px rgba(0,0,0,0.55)', transform: 'rotate(-4deg)', position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, borderRadius: 8, background: '#6B2E10', border: '1px solid #c9a24a' }}>
            <span style={{ display: 'flex', color: '#fff', fontSize: 18, fontWeight: 900 }}>W</span>
          </div>
          <span style={{ display: 'flex', color: '#fff', fontSize: 17, fontWeight: 800, letterSpacing: 2, marginLeft: 9 }}>WODY</span>
          <span style={{ display: 'flex', color: C.gold, fontSize: 17, fontWeight: 800, letterSpacing: 2, marginLeft: 8 }}>PASSPORT</span>
        </div>
        <span style={{ display: 'flex', color: '#9fb2d4', fontSize: 10, fontWeight: 700, letterSpacing: 1.5 }}>GLOBAL IDENTITY</span>
      </div>
      <div style={{ display: 'flex', marginTop: 14 }}>
        {/* Photo: a simple head and shoulders silhouette. */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', width: 96, height: 120, borderRadius: 10, background: 'linear-gradient(180deg, #1c3a6e 0%, #16315f 100%)', border: '2px solid #c9a24a', overflow: 'hidden' }}>
          <div style={{ display: 'flex', width: 38, height: 38, borderRadius: 38, background: 'linear-gradient(160deg, #8ea6dc 0%, #6a85c4 100%)', border: '2px solid rgba(201,162,74,0.55)', marginBottom: 5 }} />
          <div style={{ display: 'flex', width: 74, height: 74, borderRadius: 74, background: 'linear-gradient(180deg, #6a85c4 0%, #5d78b8 100%)', marginBottom: -36 }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', marginLeft: 16 }}>
          <span style={{ display: 'flex', color: '#8fa3c8', fontSize: 9, fontWeight: 700, letterSpacing: 1.5 }}>HOLDER</span>
          <span style={{ display: 'flex', color: '#fff', fontSize: 26, fontWeight: 800, marginBottom: 8 }}>Alex Example</span>
          <span style={{ display: 'flex', color: '#8fa3c8', fontSize: 9, fontWeight: 700, letterSpacing: 1.5 }}>PASSPORT NO.</span>
          <span style={{ display: 'flex', color: C.gold, fontSize: 16, fontWeight: 800, marginBottom: 8 }}>WP-7K3M-Q9XD-4HTA</span>
          <div style={{ display: 'flex' }}>
            <div style={{ display: 'flex', flexDirection: 'column', marginRight: 18 }}>
              <span style={{ display: 'flex', color: '#8fa3c8', fontSize: 9, fontWeight: 700, letterSpacing: 1 }}>TIME WITH WODY</span>
              <span style={{ display: 'flex', color: '#fff', fontSize: 18, fontWeight: 800 }}>137 days</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ display: 'flex', color: '#8fa3c8', fontSize: 9, fontWeight: 700, letterSpacing: 1 }}>SERVER BANS</span>
              <span style={{ display: 'flex', color: '#fff', fontSize: 18, fontWeight: 800 }}>2</span>
            </div>
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', marginTop: 'auto', color: '#6f86ad', fontSize: 9, letterSpacing: 1 }}>P&lt;WODYALEX&lt;EXAMPLE&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;</div>
    </div>
  );
}

// The inner area of Frame is 1112 x 542 (1200 x 630 minus 44 px of padding on every side).
function Frame({ children }) {
  return (
    <div style={{ display: 'flex', width: '100%', height: '100%', flexDirection: 'column', padding: 44, background: `linear-gradient(135deg, ${C.bg1} 0%, ${C.bg2} 55%, ${C.bg1} 100%)`, fontFamily: 'sans-serif', position: 'relative' }}>
      <Glows />
      <div style={{ display: 'flex', position: 'absolute', top: 16, left: 16, right: 16, bottom: 16, borderRadius: 30, border: '1px solid rgba(230,195,106,0.26)' }} />
      <div style={{ display: 'flex', position: 'absolute', top: 16, left: 120, width: 220, height: 3, borderRadius: 3, background: 'linear-gradient(90deg, rgba(230,195,106,0) 0%, rgba(230,195,106,0.9) 50%, rgba(230,195,106,0) 100%)' }} />
      {children}
    </div>
  );
}

// One line (or two for a very long text) in a pill. Uppercase text is wider, so it is measured wider.
function SubtitlePill({ text, size = 22, width = 600, align = 'flex-start' }) {
  const fit = fitText(text, width - 30, { max: size, min: 12, lines: 2, k: 0.74 });
  const h = Math.ceil(fit.lines * fit.size * 1.25) + 12;
  return {
    height: h,
    node: (
      <div style={{ display: 'flex', alignSelf: align, maxWidth: width, background: 'rgba(224,138,78,0.14)', border: '1px solid rgba(224,138,78,0.4)', borderRadius: fit.lines > 1 ? 18 : 999, padding: '5px 15px' }}>
        <span style={{ display: 'flex', color: C.tan, fontSize: fit.size, fontWeight: 700, letterSpacing: 0.5, lineHeight: 1.25, textTransform: 'uppercase' }}>{text}</span>
      </div>
    ),
  };
}

function Host({ size = 26 }) {
  return <span style={{ display: 'flex', color: '#c9955f', fontSize: size, fontWeight: 800 }}>{host()}</span>;
}

// A compact "new feature" tile for the right column of the Passport look.
function NewTile({ label, icon }) {
  return (
    <div style={{ display: 'flex', position: 'relative', alignItems: 'center', width: 198, height: 62, borderRadius: 16, padding: '0 12px', background: 'linear-gradient(145deg, rgba(230,195,106,0.16) 0%, rgba(160,100,46,0.12) 100%)', border: '1.5px solid rgba(230,195,106,0.55)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #f3e1b0 0%, #e6c36a 100%)' }}>{icon}</div>
      <span style={{ display: 'flex', color: C.text, fontSize: 16, fontWeight: 800, lineHeight: 1.15, marginLeft: 10, maxWidth: 120 }}>{label}</span>
      <div style={{ display: 'flex', position: 'absolute', top: -11, right: -6 }}><NewPill size={12} /></div>
    </div>
  );
}

const ICON_COLLAB = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2a1d0a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="7" width="20" height="14" rx="2" />
    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
  </svg>
);
const ICON_DISCOVERY = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2a1d0a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <path d="m16.24 7.76-2.12 6.36-6.36 2.12 2.12-6.36 6.36-2.12z" />
  </svg>
);

// 1. Wody and every module on the left, the Passport on the right.
function PassportLook({ cfg }) {
  const W = 680; const FOOT = 40; const H = 542 - FOOT;
  const title = fitText(cfg.title, W - 78 - 20, { max: 62, min: 32, lines: 2 });
  const headH = Math.max(78, Math.ceil(title.lines * title.size * 1.1));
  const sub = SubtitlePill({ text: cfg.subtitle, size: 20, width: W });
  const tag = fitText(cfg.tagline, W, { max: 26, min: 18, lines: 3, k: 0.5 });
  const tagH = Math.ceil(tag.lines * tag.size * 1.3);
  const chipsH = H - headH - 14 - sub.height - 18 - tagH - 18;
  const plan = planChips(cfg.modules, W, chipsH, { max: 22, min: 13 });
  return (
    <Frame>
      <div style={{ display: 'flex', height: H }}>
        <div style={{ display: 'flex', flexDirection: 'column', width: W, height: H }}>
          <div style={{ display: 'flex', alignItems: 'center', height: headH }}>
            <Logo size={78} media={cfg.media_url} />
            <span style={{ display: 'flex', color: C.text, fontSize: title.size, fontWeight: 800, letterSpacing: -1.5, lineHeight: 1.08, marginLeft: 20, maxWidth: W - 98 }}>{cfg.title}</span>
          </div>
          <div style={{ display: 'flex', marginTop: 14 }}>{sub.node}</div>
          <span style={{ display: 'flex', color: C.soft, fontSize: tag.size, marginTop: 18, lineHeight: 1.3, maxWidth: W, height: tagH, overflow: 'hidden' }}>{cfg.tagline}</span>
          <div style={{ display: 'flex', marginTop: 18, height: chipsH, overflow: 'hidden' }}>
            <Chips plan={plan} />
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, paddingLeft: 12 }}>
          <div style={{ display: 'flex', position: 'relative' }}>
            <PassportCard />
            <div style={{ display: 'flex', position: 'absolute', bottom: -16, right: -8 }}><NewPill size={22} /></div>
          </div>
          <span style={{ display: 'flex', color: C.soft, fontSize: 24, fontWeight: 700, marginTop: 30 }}>/claimpassport</span>
          <div style={{ display: 'flex', marginTop: 26 }}>
            <NewTile label="WODY Collab" icon={ICON_COLLAB} />
            <div style={{ display: 'flex', marginLeft: 16 }}><NewTile label="Community Discovery" icon={ICON_DISCOVERY} /></div>
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'flex-end', height: FOOT }}><Host /></div>
    </Frame>
  );
}

// 2. Centered, every module as a tidy cloud of chips.
function ShowcaseLook({ cfg }) {
  const FOOT = 32;
  const title = fitText(cfg.title, 1112 - 84 - 24, { max: 80, min: 38, lines: 1 });
  const headH = Math.max(84, Math.ceil(title.size * 1.1));
  const sub = fitText(cfg.subtitle, 1000, { max: 24, min: 13, lines: 1, k: 0.9 });
  const subH = Math.ceil(sub.size * 1.3);
  const tag = fitText(cfg.tagline, 900, { max: 28, min: 18, lines: 2, k: 0.5 });
  const tagH = Math.ceil(tag.lines * tag.size * 1.3);
  const chipsH = 542 - headH - 16 - subH - 14 - tagH - 24 - 18 - FOOT;
  const plan = planChips(cfg.modules, 1040, chipsH, { max: 24, min: 13 });
  return (
    <Frame>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', height: 542 }}>
        <div style={{ display: 'flex', alignItems: 'center', height: headH }}>
          <Logo size={84} media={cfg.media_url} />
          <span style={{ display: 'flex', color: C.text, fontSize: title.size, fontWeight: 800, letterSpacing: -2, marginLeft: 22 }}>{cfg.title}</span>
        </div>
        <span style={{ display: 'flex', color: C.tan, fontSize: sub.size, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', marginTop: 16, height: subH }}>{cfg.subtitle}</span>
        <span style={{ display: 'flex', color: C.soft, fontSize: tag.size, marginTop: 14, textAlign: 'center', justifyContent: 'center', lineHeight: 1.3, maxWidth: 900, height: tagH, overflow: 'hidden' }}>{cfg.tagline}</span>
        <div style={{ display: 'flex', marginTop: 24, width: 1040, height: chipsH, overflow: 'hidden' }}>
          <Chips plan={plan} justify="center" />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', marginTop: 18, height: FOOT }}>
          <NewPill size={16} />
          <span style={{ display: 'flex', color: C.soft, fontSize: 20, fontWeight: 700, marginLeft: 12 }}>WODY Passport</span>
          <div style={{ display: 'flex', marginLeft: 26 }}><NewPill size={16} /></div>
          <span style={{ display: 'flex', color: C.soft, fontSize: 20, fontWeight: 700, marginLeft: 12 }}>WODY Collab</span>
          <span style={{ display: 'flex', color: C.muted, fontSize: 20, marginLeft: 26 }}>{host()}</span>
        </div>
      </div>
    </Frame>
  );
}

// 3. Quiet and typographic.
function MinimalLook({ cfg }) {
  const W = 1056; const FOOT = 40;
  // One big line when it fits; otherwise two smaller lines, so the module names keep their room.
  let title = fitText(cfg.title, W, { max: 128, min: 84, lines: 1 });
  if (textW(cfg.title, title.size) > W * 0.94) title = fitText(cfg.title, W, { max: 80, min: 40, lines: 2 });
  const titleH = Math.ceil(title.lines * title.size * 1.02);
  const subFit = fitText(cfg.subtitle, 900, { max: 22, min: 11, lines: 1, k: 0.95 });
  const tag = fitText(cfg.tagline, 900, { max: 32, min: 19, lines: 2, k: 0.5 });
  const tagH = Math.ceil(tag.lines * tag.size * 1.3);
  const avail = 502 - 56 - 26 - titleH - 12 - tagH - 24 - 3 - 16 - FOOT;
  // All module names on one dotted text; the size shrinks until it fits, and only if it never does the end becomes "+N more".
  const sep = '   ·   ';
  let fs = 22; let list = cfg.modules; let hidden = 0;
  const linesOf = (items, size) => Math.ceil(textW(items.join(sep) + (hidden ? `${sep}+${hidden} more` : ''), size, 0.47) / W);
  while (fs > 14 && linesOf(list, fs) * fs * 1.7 > avail) fs -= 1;
  while (list.length > 1 && linesOf(list, fs) * fs * 1.7 > avail) { list = list.slice(0, -1); hidden = cfg.modules.length - list.length; }
  const line = list.join(sep) + (hidden ? `${sep}+${hidden} more` : '');
  return (
    <div style={{ display: 'flex', width: '100%', height: '100%', flexDirection: 'column', padding: '64px 72px', background: 'linear-gradient(160deg, #0f0905 0%, #24130a 100%)', fontFamily: 'sans-serif', position: 'relative' }}>
      <div style={{ display: 'flex', position: 'absolute', top: -200, right: -160, width: 640, height: 640, borderRadius: 640, background: 'radial-gradient(circle, rgba(224,138,78,0.20) 0%, rgba(224,138,78,0) 70%)' }} />
      <div style={{ display: 'flex', alignItems: 'center', height: 56 }}>
        <Logo size={56} media={cfg.media_url} />
        <span style={{ display: 'flex', color: C.muted, fontSize: subFit.size, fontWeight: 700, letterSpacing: 4, textTransform: 'uppercase', marginLeft: 18, maxWidth: 900 }}>{cfg.subtitle}</span>
      </div>
      <span style={{ display: 'flex', color: C.text, fontSize: title.size, fontWeight: 800, letterSpacing: -title.size * 0.035, marginTop: 26, lineHeight: 1.02, height: titleH, maxWidth: W, overflow: 'hidden' }}>{cfg.title}</span>
      <span style={{ display: 'flex', color: C.soft, fontSize: tag.size, marginTop: 12, lineHeight: 1.3, maxWidth: 900, height: tagH, overflow: 'hidden' }}>{cfg.tagline}</span>
      <div style={{ display: 'flex', width: 90, height: 3, background: C.brandLight, marginTop: 24, marginBottom: 16 }} />
      <span style={{ display: 'flex', color: C.muted, fontSize: fs, lineHeight: 1.7, height: avail, overflow: 'hidden' }}>{line}</span>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: FOOT }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <NewPill size={15} />
          <span style={{ display: 'flex', color: C.soft, fontSize: 19, fontWeight: 700, marginLeft: 12 }}>WODY Passport</span>
          <div style={{ display: 'flex', marginLeft: 24 }}><NewPill size={15} /></div>
          <span style={{ display: 'flex', color: C.soft, fontSize: 19, fontWeight: 700, marginLeft: 12 }}>WODY Collab</span>
        </div>
        <Host size={24} />
      </div>
    </div>
  );
}

// 4. The original framed card, now with every module and text that always fits.
function ClassicLook({ cfg }) {
  const W = 1010; const FOOT = 38;
  const title = fitText(cfg.title, W - 102, { max: 68, min: 34, lines: 1 });
  const sub = SubtitlePill({ text: cfg.subtitle, size: 24, width: W - 102 });
  const headH = Math.max(80, Math.ceil(title.size * 1.1) + 9 + sub.height);
  const tag = fitText(cfg.tagline, 1000, { max: 30, min: 19, lines: 2, k: 0.5 });
  const tagH = Math.ceil(tag.lines * tag.size * 1.3);
  const chipsH = 462 - headH - 24 - tagH - 24 - FOOT;
  const plan = planChips(cfg.modules, W, chipsH, { max: 26, min: 13 });
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', padding: 40, background: 'linear-gradient(135deg, #1a0e08 0%, #2d1608 55%, #1a0e08 100%)', fontFamily: 'sans-serif', position: 'relative' }}>
      <Glows />
      <div style={{ display: 'flex', width: '100%', height: '100%', border: '1px solid rgba(216,154,92,0.35)', borderRadius: 26, padding: 6, position: 'relative' }}>
        <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', border: '2px solid #a0642e', borderRadius: 20, padding: '36px 42px', position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', height: headH }}>
            <div style={{ display: 'flex', marginRight: 22 }}><Logo size={80} media={cfg.media_url} /></div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ display: 'flex', color: '#ffffff', fontSize: title.size, fontWeight: 800, letterSpacing: -1.6 }}>{cfg.title}</span>
              <div style={{ display: 'flex', marginTop: 9 }}>{sub.node}</div>
            </div>
          </div>
          <span style={{ display: 'flex', color: '#f1e7db', fontSize: tag.size, marginTop: 24, lineHeight: 1.3, maxWidth: 1000, height: tagH, overflow: 'hidden' }}>{cfg.tagline}</span>
          <div style={{ display: 'flex', marginTop: 24, height: chipsH, overflow: 'hidden' }}>
            <Chips plan={plan} />
          </div>
          <div style={{ display: 'flex', alignSelf: 'flex-end', alignItems: 'flex-end', marginTop: 'auto', height: FOOT }}><Host size={28} /></div>
        </div>
      </div>
    </div>
  );
}

const LOOKS = { passport: PassportLook, showcase: ShowcaseLook, minimal: MinimalLook, classic: ClassicLook };

export function normalizeVariant(v) {
  return OG_VARIANTS.includes(v) ? v : OG_DEFAULT_VARIANT;
}

export async function renderOgImage(config, variant) {
  const [fontRegular, fontBold] = await Promise.all([interRegular, interBold]);
  const Look = LOOKS[normalizeVariant(variant)];
  return new ImageResponse(<Look cfg={config} />, {
    ...OG_SIZE,
    fonts: [
      { name: 'sans-serif', data: fontRegular, weight: 400, style: 'normal' },
      { name: 'sans-serif', data: fontBold, weight: 700, style: 'normal' },
      { name: 'sans-serif', data: fontBold, weight: 800, style: 'normal' },
      { name: 'sans-serif', data: fontBold, weight: 900, style: 'normal' },
    ],
  });
}

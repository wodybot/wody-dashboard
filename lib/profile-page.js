export const PAGE_PRESETS = {
  ember: { from: '#6b2f12', to: '#120b08', accent: '#e6cd8c' },
  midnight: { from: '#2a1b5e', to: '#07060f', accent: '#b9a4ff' },
  forest: { from: '#14532d', to: '#06110a', accent: '#86efac' },
  ocean: { from: '#0c4a6e', to: '#040d14', accent: '#7dd3fc' },
  rose: { from: '#831843', to: '#12060c', accent: '#f9a8d4' },
  sunset: { from: '#9a3412', to: '#2e0a2c', accent: '#fdba74' },
  aurora: { from: '#0f766e', to: '#1e1145', accent: '#5eead4' },
  coast: { from: '#ff5e8a', to: '#1a0b3b', accent: '#ffb36b' },
  dusk: { from: '#e8744f', to: '#0b1f2e', accent: '#5ff0d0' },
  mono: { from: '#3f3f46', to: '#09090b', accent: '#e4e4e7' },
};

export const PAGE_CHOICES = {
  mode: ['none', 'preset', 'gradient', 'image'],
  preset: Object.keys(PAGE_PRESETS),
  pattern: ['none', 'dots', 'grid', 'stars', 'coast', 'dusk', 'skyline', 'miami'],
  card_place: ['top', 'bottom'],
  name_fx: ['none', 'typewriter', 'glow', 'gradient', 'neon'],
};
export const PAGE_SECTIONS = ['card', 'passport', 'achievements', 'battlepass', 'bio', 'skills', 'portfolio', 'links'];
export const PAGE_HIDEABLE = ['card', 'passport', 'achievements', 'battlepass', 'bio', 'skills', 'portfolio', 'links', 'socials', 'stats'];
export const PAGE_LIMITS = { bio: 280, skills: 12, skill: 24, links: 8, label: 30, portfolio: 12, title: 60, desc: 200 };
export const PAGE_COLOR_KEYS = ['from', 'to', 'accent'];
export const PAGE_RANGES = { angle: [0, 360], dim: [0, 90], blur: [0, 24] };

export const PAGE_DEFAULT = { mode: 'none', preset: 'ember', from: '#6b2f12', to: '#120b08', angle: 160, accent: '#e6cd8c', image: null, dim: 55, blur: 0, pattern: 'none', card_place: 'bottom', name_fx: 'none', music: null, music_title: '', bio: '', skills: [], links: [], portfolio: [], order: ['card', 'passport', 'achievements', 'battlepass', 'bio', 'skills', 'portfolio', 'links'], hide: [] };

const COLOR = /^#[0-9a-fA-F]{6}$/;
const URL_BAD = /[\s\x00-\x1f\x7f<>"'\\`]/;
const URL_OK = /^https:\/\/[A-Za-z0-9.-]+(:\d{2,5})?(\/[^\s]*)?$/;

export function cleanPageImage(value) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  if (!text) return null;
  if (text.length > 500 || URL_BAD.test(text) || !URL_OK.test(text)) throw new Error('image');
  const host = text.match(/^https:\/\/([^/:]+)/)[1].toLowerCase();
  if (host === 'localhost' || /\.(local|internal|localhost)$/.test(host) || /^[\d.]+$/.test(host) || !host.includes('.')) throw new Error('image');
  return text;
}

const AUDIO_PATH = /\.(mp3|ogg|oga|opus|m4a|aac|wav|flac)$/i;

export const MUSIC_PATH_RE = /^\/api\/profile-page\/music\/[a-f0-9]{24}$/;

export function cleanMusicUrl(value) {
  if (typeof value === 'string' && MUSIC_PATH_RE.test(value.trim())) return value.trim();
  const text = cleanPageImage(value);
  if (text === null) return null;
  let u;
  try { u = new URL(text); } catch { throw new Error('music'); }
  if (!AUDIO_PATH.test(u.pathname)) throw new Error('music');
  return text;
}

export const SHORT_RESERVED = new Set(['api', 'blog', 'careers', 'collab', 'commands', 'contact', 'cookies', 'createcollab', 'dashboard', 'help', 'invite', 'leaderboard', 'marketplace', 'modules', 'partners', 'premium', 'privacy', 'profile', 'servers', 'team', 'terms', 'tiktok', 'updates', 'verify', 'en', 'ro', 'fr', 'it', 'de', 'es', 'pt', 'nl', 'tr', 'websub', 'icon', 'opengraph-image', 'policies', 'miami-style-discord-bot', 'passport', 'scenes', 'presets', 'robots', 'sitemap', 'llms']);

const plain = (v, max, key) => {
  if (typeof v !== 'string') throw new Error(key);
  const text = v.replace(/[\p{Cc}\p{Cf}<>]/gu, '').trim();
  if ([...text].length > max) throw new Error(key);
  return text;
};

function cleanList(key, value) {
  if (!Array.isArray(value)) throw new Error(key);
  const L = PAGE_LIMITS;
  const u = (x) => { try { return cleanPageImage(x); } catch { throw new Error(key); } };
  if (key === 'skills') {
    if (value.length > L.skills) throw new Error(key);
    return value.map((v) => plain(v, L.skill, key)).filter(Boolean);
  }
  if (key === 'links') {
    if (value.length > L.links) throw new Error(key);
    return value.map((v) => {
      if (!v || typeof v !== 'object') throw new Error(key);
      const url = u(v.url);
      if (!url) throw new Error(key);
      return { label: plain(String(v.label ?? ''), L.label, key), url };
    });
  }
  if (key === 'portfolio') {
    if (value.length > L.portfolio) throw new Error(key);
    return value.map((v) => {
      if (!v || typeof v !== 'object') throw new Error(key);
      const title = plain(String(v.title ?? ''), L.title, key);
      if (!title) throw new Error(key);
      return { title, desc: plain(String(v.desc ?? ''), L.desc, key), url: u(v.url ?? null), image: u(v.image ?? null) };
    });
  }
  const allowed = key === 'order' ? PAGE_SECTIONS : PAGE_HIDEABLE;
  if (value.some((v) => !allowed.includes(v)) || new Set(value).size !== value.length) throw new Error(key);
  if (key === 'order') return [...value, ...PAGE_SECTIONS.filter((s) => !value.includes(s))];
  return value;
}

export function validatePagePatch(patch) {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) throw new Error('body');
  const out = {};
  for (const [key, value] of Object.entries(patch)) {
    if (Object.prototype.hasOwnProperty.call(PAGE_CHOICES, key)) {
      if (!PAGE_CHOICES[key].includes(value)) throw new Error(key);
      out[key] = value;
    } else if (PAGE_COLOR_KEYS.includes(key)) {
      if (typeof value !== 'string' || !COLOR.test(value)) throw new Error(key);
      out[key] = value.toLowerCase();
    } else if (Object.prototype.hasOwnProperty.call(PAGE_RANGES, key)) {
      const [lo, hi] = PAGE_RANGES[key];
      if (typeof value !== 'number' || !Number.isInteger(value) || value < lo || value > hi) throw new Error(key);
      out[key] = value;
    } else if (key === 'image') {
      out[key] = cleanPageImage(value);
    } else if (key === 'music') {
      out[key] = cleanMusicUrl(value);
    } else if (key === 'bio') {
      out[key] = plain(value, PAGE_LIMITS.bio, key);
    } else if (['skills', 'links', 'portfolio', 'order', 'hide'].includes(key)) {
      out[key] = cleanList(key, value);
    } else if (key === 'music_title') {
      if (typeof value !== 'string') throw new Error(key);
      const title = value.replace(/[\p{Cc}\p{Cf}<>]/gu, '').trim();
      if (title.length > 60) throw new Error(key);
      out[key] = title;
    } else {
      throw new Error(key);
    }
  }
  return out;
}

export function normalizePage(stored) {
  const cfg = { ...PAGE_DEFAULT };
  if (stored && typeof stored === 'object') {
    for (const [key, value] of Object.entries(stored)) {
      try { Object.assign(cfg, validatePagePatch({ [key]: value })); } catch { }
    }
    if (!stored.order && stored.card_place === 'bottom') cfg.order = [...PAGE_SECTIONS.filter((x) => x !== 'card'), 'card'];
  }
  return cfg;
}

export function pageColors(cfg) {
  if (cfg.mode === 'preset') return PAGE_PRESETS[cfg.preset] || PAGE_PRESETS.ember;
  if (cfg.mode === 'gradient') return { from: cfg.from, to: cfg.to, accent: cfg.accent };
  if (cfg.mode === 'image') return { from: '#120b08', to: '#120b08', accent: cfg.accent };
  return null;
}

export function pageAccent(cfg) {
  const c = pageColors(cfg);
  return c ? (cfg.mode === 'preset' ? c.accent : cfg.accent) : null;
}

export function pageGradient(cfg) {
  const c = pageColors(cfg);
  if (!c) return null;
  return `linear-gradient(${cfg.mode === 'preset' ? 160 : cfg.angle}deg, ${c.from}, ${c.to})`;
}

export const PAGE_PATTERNS = {
  dots: { image: 'radial-gradient(rgba(255,255,255,0.16) 1px, transparent 1.4px)', size: '22px 22px' },
  grid: { image: 'linear-gradient(rgba(255,255,255,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.07) 1px, transparent 1px)', size: '34px 34px' },
  stars: { image: 'radial-gradient(1.6px 1.6px at 20px 30px, rgba(255,255,255,0.9), transparent), radial-gradient(1.2px 1.2px at 90px 70px, rgba(255,255,255,0.7), transparent), radial-gradient(1px 1px at 150px 20px, rgba(255,255,255,0.6), transparent), radial-gradient(1.4px 1.4px at 60px 130px, rgba(255,255,255,0.8), transparent)', size: '180px 160px' },
};

export function publicPageView(page) {
  const hide = new Set(page.hide || []);
  const out = { ...page };
  for (const k of ['bio', 'skills', 'links', 'portfolio']) if (hide.has(k)) out[k] = Array.isArray(page[k]) ? [] : '';
  return out;
}

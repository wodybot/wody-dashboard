import registry from '@/lib/feeds-sources.json';

export const SOURCES = Object.fromEntries(registry.sources.map((s) => [s.key, s]));
export const INTERVALS = registry.intervals;
export const GROUPS = registry.groups;
export const MAX_FEEDS = registry.maxFeeds;
export const DEFAULT_INTERVAL = 30;

export class FeedInputError extends Error {
  constructor(code, params) { super(code); this.code = code; this.params = params || {}; }
}

const NAME = /^[A-Za-z0-9_.\-]{1,64}$/;
const DIGITS = /^\d{1,12}$/;

function hostPath(text) {
  let t = text.trim();
  if (!t.includes('://')) t = `https://${t}`;
  try {
    const u = new URL(t);
    return [u.hostname.toLowerCase().replace(/^www\./, ''), u.pathname.replace(/^\/+|\/+$/g, '')];
  } catch { return ['', '']; }
}

function lastSegment(text, kind, hosts) {
  if (!text.includes('/') && !text.split('?')[0].includes('.')) return null;
  const [host, path] = hostPath(text);
  if (!hosts.includes(host)) return null;
  const parts = path.split('/').filter(Boolean);
  for (let i = 0; i < parts.length; i += 1) if (parts[i] === kind && i + 1 < parts.length) return parts[i + 1];
  return null;
}


export function cleanTarget(source, rawTarget, rawOptions) {
  const s = SOURCES[source];
  if (!s) throw new FeedInputError('source');
  let target = String(rawTarget ?? '').trim().replace(/\s+/g, ' ').slice(0, 300);
  const options = { ...(rawOptions || {}) };
  const opts = {};
  for (const [name, allowed] of Object.entries(s.options)) {
    const value = String(options[name] || allowed[0]).toLowerCase();
    if (!allowed.includes(value)) throw new FeedInputError('option', { option: name });
    opts[name] = value;
  }
  if (!target && !s.targetOptional) throw new FeedInputError('target_required');
  const bad = () => new FeedInputError('target_invalid');
  let m;

  if (source === 'apple_artist') {
    m = target.match(/music\.apple\.com\/(?:[^?#\s]*\/)?artist\/(?:[^/?#\s]+\/)?(\d{4,12})(?:[/?#]|$)/);
    if (m) target = m[1];
    if (!DIGITS.test(target)) throw bad();
  } else if (source === 'apple_podcast') {
    m = target.match(/id(\d{4,14})/) || target.match(/^(\d{4,14})$/);
    if (!m) throw bad();
    target = m[1];
  } else if (source === 'apple_chart' || source === 'epic') {
    target = target.toLowerCase();
    if (target && !/^[a-z]{2}$/.test(target)) throw bad();
    target = target || 'us';
  } else if (source === 'tumblr') {
    m = target.match(/^(?:https?:\/\/)?([A-Za-z0-9\-]{1,64})(?:\.tumblr\.com)?\/?$/);
    if (!m) throw bad();
    target = m[1].toLowerCase();
  } else if (source === 'pinterest') {
    const t = target.replace(/^https?:\/\/([a-z]+\.)?pinterest\.[a-z.]+\//i, '').replace(/^\/+|\/+$/g, '');
    if (!/^[A-Za-z0-9_\-]{1,60}(\/[A-Za-z0-9_\-%.]{1,100})?$/.test(t)) throw bad();
    target = t;
  } else if (source === 'rss') {
    if (!target.includes('://')) target = `https://${target}`;
    let u;
    try { u = new URL(target); } catch { throw bad(); }
    if (!['http:', 'https:'].includes(u.protocol) || !u.hostname || u.username || u.password || target.length > 300) throw bad();
    if (u.protocol === 'http:') target = `https${target.slice(4)}`;
  } else if (source === 'github') {
    let t = target.replace(/^https?:\/\/github\.com\//i, '').replace(/^\/+|\/+$/g, '').replace(/\.git$/, '');
    const parts = t.split('/');
    if (parts.length < 2 || !NAME.test(parts[0]) || !NAME.test(parts[1])) throw bad();
    target = `${parts[0]}/${parts[1]}`;
  } else if (source === 'steam') {
    m = target.match(/\/app\/(\d{1,9})/) || target.match(/^(\d{1,9})$/);
    if (m) target = m[1];
    else if (!/^[\p{L}\p{N}_ :'.!&\-]{2,80}$/u.test(target)) throw bad();
  } else if (source === 'random_song') {
    const provider = opts.provider;
    if (provider === 'deezer') {
      if (target) {
        target = lastSegment(target, 'playlist', ['deezer.com']) || target;
        if (!DIGITS.test(target)) throw bad();
      }
    } else {
      target = target.toLowerCase() || 'us';
      if (!/^[a-z]{2}$/.test(target)) throw bad();
    }
  }
  return [target, opts];
}

export function cleanInterval(value) {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n) || !INTERVALS.includes(n) || String(n) !== String(value).trim()) throw new FeedInputError('interval');
  return n;
}

export const HINT_KIND = {
  apple_artist: 'artist', apple_chart: 'country', apple_podcast: 'show',
  tumblr: 'blog', pinterest: 'pinterest', rss: 'link',
  github: 'repo', steam: 'game', epic: 'country',
  random_song: 'songPlaylist',
};
export const EXAMPLE = Object.fromEntries(Object.values(SOURCES).map((s) => [s.key, s.example || '']));
export const OPTION_DEFAULT_SOURCES = Object.keys(SOURCES).filter((k) => Object.keys(SOURCES[k].options).length);

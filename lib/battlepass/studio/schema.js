// Validation and normalization of a page configuration. Everything is data from fixed lists: ids, enums, bounded numbers, https
// links. Anything else is refused, so a page can restyle and rearrange the season but can never carry HTML, CSS or script.
import { hasPictograph, stripPictographs } from '@/lib/no-emoji';
import { validateThemePatch, normalizeTheme } from '../page-theme.js';
import { SECTION_TYPES, BLOCK_TYPES, LAYOUT_WIDTH, SPACING, LIMITS, SLUG_RE, RESERVED_SLUGS } from './constants.js';
import { WODY_ICON_FILES } from '@/lib/wody-icons';
import { SITE_IMAGE_PATH_RE } from '@/lib/site-image-path';

const ID_RE = /^[a-z0-9][a-z0-9_-]{0,39}$/;
const fail = (error, field) => ({ ok: false, error, field });

function https(v) {
  const s = String(v ?? '').trim();
  if (!s) return '';
  try { const u = new URL(s); return u.protocol === 'https:' && !u.username && !u.password ? u.toString().slice(0, 500) : null; } catch { return null; }
}
// Images: an upload made through the owner image field (/api/site-image/<id>) or an https link. Returns null when unusable.
function img(v) {
  const s = String(v ?? '').trim();
  if (SITE_IMAGE_PATH_RE.test(s)) return s;
  return https(s);
}
function text(v, max, field) {
  const raw = String(v ?? '');
  if (hasPictograph(raw)) return { err: fail('emoji_not_allowed', field) };
  const t = raw.replace(/[\p{Cc}\p{Cf}<>]/gu, ' ').replace(/\s+/g, ' ').trim();
  if ([...t].length > max) return { err: fail('too_long', field) };
  return { v: t };
}

export const defaultSections = () => SECTION_TYPES.map((type) => ({ id: type, type, on: !['overview', 'faq', 'statistics'].includes(type), title: '' }));

export function defaultConfig() {
  return {
    sections: defaultSections(),
    theme: {},
    layout: { width: 'normal', spacing: 'cozy' },
    hero: { eyebrow: '', title: '', subtitle: '', cta_label: '', cta_url: '' },
    overview: { text: '', highlights: [] },
    faq: [], footer: { text: '', links: [] },
    seo: { title: '', description: '', og_image: '', noindex: false },
    discord: { title: '', description: '', image: '' },
  };
}

/** `raw` is the full or partial configuration sent by the editor; `base` the stored one. Returns { ok, config } or { ok:false, error, field }. */
export function normalizeConfig(raw, base = null) {
  const src = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const prev = base || defaultConfig();
  const out = JSON.parse(JSON.stringify(prev));

  if ('sections' in src) {
    if (!Array.isArray(src.sections) || src.sections.length > LIMITS.sections) return fail('invalid_sections', 'sections');
    const seen = new Set(); const secs = []; let blocks = 0;
    for (const s of src.sections) {
      if (!s || typeof s !== 'object') return fail('invalid_sections', 'sections');
      const type = String(s.type || '');
      const id = String(s.id || type);
      if (!ID_RE.test(id) || seen.has(id)) return fail('invalid_section_id', 'sections');
      seen.add(id);
      const entry = { id, type, on: s.on !== false, title: '' };
      if (SECTION_TYPES.includes(type)) {
        if (secs.some((x) => x.type === type)) return fail('duplicate_section', 'sections');
        const t = text(s.title, 60, 'sections'); if (t.err) return t.err; entry.title = t.v;
      } else if (BLOCK_TYPES.includes(type)) {
        blocks += 1; if (blocks > LIMITS.blocks) return fail('too_many_blocks', 'sections');
        const t = text(s.title, 60, 'sections'); if (t.err) return t.err; entry.title = t.v;
        if (type === 'text') { const b = text(s.text, LIMITS.text, 'sections'); if (b.err) return b.err; entry.text = b.v; }
        if (type === 'image') {
          const u = img(s.url); if (u === null || !u) return fail('invalid_url', 'sections');
          const a = text(s.alt, LIMITS.alt, 'sections'); if (a.err) return a.err; entry.url = u; entry.alt = a.v;
        }
        if (type === 'button') {
          const u = https(s.url); if (u === null || !u) return fail('invalid_url', 'sections');
          const l = text(s.label, LIMITS.label, 'sections'); if (l.err) return l.err; if (!l.v) return fail('invalid_label', 'sections');
          entry.url = u; entry.label = l.v;
        }
      } else return fail('invalid_section_type', 'sections');
      secs.push(entry);
    }
    // The hero always exists: a page without it would have no title.
    if (!secs.some((s) => s.type === 'hero')) return fail('hero_required', 'sections');
    out.sections = secs;
  }

  if ('theme' in src) {
    try { out.theme = validateThemePatch(src.theme); } catch (e) { return fail('invalid_theme', String(e.message || 'theme')); }
    const th = normalizeTheme(out.theme);
    if (contrast(th.text, th.from) < 3.5 && th.mode !== 'image' && th.mode !== 'preset') return fail('low_contrast', 'text');
  }
  if ('layout' in src) {
    const l = src.layout || {};
    if (l.width !== undefined && !Object.hasOwn(LAYOUT_WIDTH, l.width)) return fail('invalid_layout', 'width');
    if (l.spacing !== undefined && !SPACING.includes(l.spacing)) return fail('invalid_layout', 'spacing');
    out.layout = { width: l.width ?? out.layout.width, spacing: l.spacing ?? out.layout.spacing };
  }
  if ('hero' in src) {
    const h = src.hero || {};
    const o = {};
    for (const [k, max] of [['eyebrow', 40], ['title', 80], ['subtitle', 160], ['cta_label', LIMITS.label]]) { const t = text(h[k], max, `hero.${k}`); if (t.err) return t.err; o[k] = t.v; }
    const u = https(h.cta_url); if (u === null) return fail('invalid_url', 'hero.cta_url');
    o.cta_url = u;
    if (o.cta_label && !o.cta_url) return fail('invalid_url', 'hero.cta_url');
    out.hero = o;
  }
  if ('overview' in src) {
    const o = src.overview || {};
    const t = text(o.text, 600, 'overview.text'); if (t.err) return t.err;
    const hl = Array.isArray(o.highlights) ? o.highlights : [];
    if (hl.length > LIMITS.highlights) return fail('too_many', 'overview.highlights');
    const hs = [];
    for (const h of hl) { const x = text(h?.text, 80, 'overview.highlights'); if (x.err) return x.err; if (x.v) hs.push({ icon: Object.hasOwn(WODY_ICON_FILES, h?.icon) ? h.icon : '', text: x.v }); }
    out.overview = { text: t.v, highlights: hs };
  }
  if ('faq' in src) {
    if (!Array.isArray(src.faq) || src.faq.length > LIMITS.faq) return fail('too_many', 'faq');
    const f = [];
    for (const it of src.faq) { const q = text(it?.q, LIMITS.q, 'faq'); const a = text(it?.a, LIMITS.a, 'faq'); if (q.err) return q.err; if (a.err) return a.err; if (q.v && a.v) f.push({ q: q.v, a: a.v }); }
    out.faq = f;
  }
  if ('footer' in src) {
    const fo = src.footer || {};
    const t = text(fo.text, 200, 'footer.text'); if (t.err) return t.err;
    const links = Array.isArray(fo.links) ? fo.links : [];
    if (links.length > LIMITS.links) return fail('too_many', 'footer.links');
    const ls = [];
    for (const l of links) { const lb = text(l?.label, LIMITS.label, 'footer.links'); if (lb.err) return lb.err; const u = https(l?.url); if (!lb.v || !u) return fail('invalid_url', 'footer.links'); ls.push({ label: lb.v, url: u }); }
    out.footer = { text: t.v, links: ls };
  }
  if ('seo' in src) {
    const s = src.seo || {};
    const t = text(s.title, LIMITS.title, 'seo.title'); if (t.err) return t.err;
    const d = text(s.description, LIMITS.description, 'seo.description'); if (d.err) return d.err;
    const i = img(s.og_image); if (i === null) return fail('invalid_url', 'seo.og_image');
    out.seo = { title: t.v, description: d.v, og_image: i, noindex: s.noindex === true };
  }
  if ('discord' in src) {
    const s = src.discord || {};
    const t = text(s.title, 100, 'discord.title'); if (t.err) return t.err;
    const d = text(s.description, 300, 'discord.description'); if (d.err) return d.err;
    const i = img(s.image); if (i === null) return fail('invalid_url', 'discord.image');
    out.discord = { title: t.v, description: d.v, image: i };
  }
  return { ok: true, config: out };
}

export function cleanSlug(raw) {
  const s = String(raw ?? '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
  if (!SLUG_RE.test(s)) return { ok: false, error: 'invalid_slug' };
  if (RESERVED_SLUGS.includes(s)) return { ok: false, error: 'reserved_slug' };
  return { ok: true, slug: s };
}

function lum(hex) {
  const n = parseInt(String(hex).slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
export function contrast(a, b) { const x = lum(a); const y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
export { stripPictographs };

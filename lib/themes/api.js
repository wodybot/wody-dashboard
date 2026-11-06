// Dynamic Themes API.  /api/themes/<path>
//
//   GET    resolve/:gid                       what visitors of a server see (published only; the standard look when nothing applies)
//   GET    catalog                            themes servers can pick right now (signed in)
//   GET    guild/:gid                         this server's draft, published copy, chosen theme and plan      (server managers)
//   PUT    guild/:gid        {config}         saves the draft: only allowed fields, Premium fields only on Premium servers
//   POST   guild/:gid/{publish|reset}
//   GET    owner/themes | owner/themes/:id | owner/assets | owner/audit                                       (Owner; delegates read)
//   POST   owner/themes {id,name?,from?}      new draft theme (blank, or a copy)
//   PATCH  owner/themes/:id {config}          edits the DRAFT only
//   POST   owner/themes/:id/{preview|draft|publish|schedule|disable|enable|archive|unarchive|duplicate|restore|validate}
//   POST   owner/assets (multipart)           validated upload with a license record     DELETE owner/assets/:id
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { OWNER_ID, getDelegate, trustedOrigin } from '@/lib/owner-access';
import { isAccountBlocked } from '@/lib/account-moderation';
import { getUserGuilds, canManage } from '@/lib/discord';
import { audit as ownerAudit } from '@/lib/owner-audit';
import { sniffImage } from '@/lib/community/images';
import { storeSiteImage } from '@/lib/site-images';
import { hasPictograph } from '@/lib/no-emoji';
import {
  THEME_COLL, ASSET_COLL, GUILD_COLL, AUDIT_COLL, LIMITS, ID_RE, ASSET_KINDS, ASSET_MIN, LICENSE_TYPES, STATUSES,
} from './constants.js';
import { blankConfig } from './official.js';
import { normalizeThemeConfig, normalizeServerConfig, usesPremium, SERVER_DEFAULT, text, https, publishIssues } from './schema.js';
import {
  ensureIndexes, seedOfficial, getTheme, availability, issuesFor, snapshotOf, themeView, saveDraft, audit, isGuildPremium, getGuildTheme,
  forgetGuild, forgetAll, resolveGuildTheme, refsOf, assetMap,
} from './store.js';

const SNOWFLAKE = /^\d{15,25}$/;
export const json = (data, init = {}) => NextResponse.json(data, { ...init, headers: { 'Cache-Control': 'no-store, private', ...(init.headers || {}) } });
export const err = (code, status = 400, extra = {}) => json({ error: code, ...extra }, { status });
const clone = (v) => JSON.parse(JSON.stringify(v));

async function readJson(request, max = 96 * 1024) {
  try {
    const t = await request.text();
    if (t.length > max) return null;
    const b = t ? JSON.parse(t) : {};
    return b && typeof b === 'object' && !Array.isArray(b) ? b : null;
  } catch { return null; }
}

async function rateLimited(db, key, max, windowSec = 60) {
  const ms = windowSec * 1000; const start = Date.now() - (Date.now() % ms);
  try {
    const r = await db.collection('rate_limit_buckets').findOneAndUpdate({ _id: `theme:${key}:${start}` }, { $inc: { count: 1 }, $setOnInsert: { expires_at: new Date(start + ms * 2) } }, { upsert: true, returnDocument: 'after' });
    return (r?.count ?? r?.value?.count ?? 0) > max;
  } catch { return false; }
}

async function guildManager(db, session, gid) {
  if (!SNOWFLAKE.test(String(gid))) return { response: err('invalid_id', 400) };
  const banned = await db.collection('guild_bans').findOne({ guild_id: String(gid), active: true });
  if (banned) return { response: err('guild_banned', 403) };
  let guilds;
  try { guilds = await getUserGuilds(session.accessToken); } catch { return { response: err('temporarily_unavailable', 503) }; }
  const g = guilds.find((x) => String(x.id) === String(gid));
  if (!g || !canManage(g.permissions, g.owner)) return { response: err('forbidden', 403) };
  return { guild: g };
}

// ---------------------------------------------------------------------------------------------- assets
async function inspectImage(buf, kind) {
  const info = sniffImage(buf);
  if (!info || !['image/png', 'image/jpeg', 'image/webp'].includes(info.mime)) return { error: 'asset_format' };
  const rule = ASSET_MIN[kind];
  if (info.w < rule.w || info.h < rule.h) return { error: 'asset_too_small', min: `${rule.w}x${rule.h}` };
  let hasAlpha = false; let decoded = true;
  try {
    const sharp = (await import('sharp')).default;
    const img = sharp(buf);
    const meta = await img.metadata();
    hasAlpha = Boolean(meta.hasAlpha);
    if (hasAlpha) { const st = await img.stats(); hasAlpha = st.channels.length >= 4 && st.channels[3].min < 250; }
  } catch { decoded = false; }
  if (!decoded) return { error: 'asset_corrupt' };
  if (rule.alpha && !hasAlpha) return { error: 'asset_needs_transparency' };
  return { info, hasAlpha };
}

async function uploadAsset(request, db, actor) {
  let form;
  try { form = await request.formData(); } catch { return err('invalid_body', 400); }
  const file = form.get('file');
  if (!file || typeof file.arrayBuffer !== 'function') return err('invalid_body', 400);
  if (file.size > LIMITS.assetBytes) return err('asset_too_large', 413);
  const kind = String(form.get('kind') || ''); if (!ASSET_KINDS.includes(kind)) return err('invalid_choice', 400, { field: 'kind' });
  const name = text(form.get('name'), LIMITS.name, 'name'); if (name.err || !name.v) return err(name.err?.error || 'name_required', 400, { field: 'name' });
  const ltype = String(form.get('license_type') || ''); if (!LICENSE_TYPES.includes(ltype)) return err('license_required', 400, { field: 'license_type' });
  const lsrc = text(form.get('license_source'), LIMITS.license, 'license_source'); if (lsrc.err || !lsrc.v) return err('license_required', 400, { field: 'license_source' });
  if (String(form.get('license_confirmed')) !== 'true') return err('license_required', 400, { field: 'license_confirmed' });
  const buf = Buffer.from(await file.arrayBuffer());
  const r = await inspectImage(buf, kind);
  if (r.error) return err(r.error, 400, r.min ? { min: r.min } : {});
  const url = await storeSiteImage(buf, r.info, actor.id);
  const now = new Date();
  const doc = {
    kind, name: name.v, site_image: url, mime: r.info.mime, bytes: buf.length, width: r.info.w, height: r.info.h, has_alpha: r.hasAlpha,
    license: { type: ltype, source: lsrc.v, confirmed: true }, status: 'valid', warnings: buf.length > 2.5 * 1024 * 1024 ? ['heavy'] : [], created_by: actor.id, created_at: now,
  };
  const ins = await db.collection(ASSET_COLL).insertOne(doc);
  return { asset: { id: String(ins.insertedId), ...assetView(doc) } };
}
const assetView = (a) => ({ kind: a.kind, name: a.name, url: a.site_image, mime: a.mime, bytes: a.bytes, width: a.width, height: a.height, has_alpha: a.has_alpha, license: a.license, status: a.status, warnings: a.warnings || [], created_at: a.created_at ? new Date(a.created_at).toISOString() : null });

// ---------------------------------------------------------------------------------------------- owner
async function ownerRoutes({ db, request, method, rest, actor, writer, readJsonBody }) {
  const [area, id, sub] = rest;
  const log = (action, theme, result = 'ok', detail = '') => {
    audit(db, actor, action, theme, result, detail);
    ownerAudit(db, { actor: { id: actor.id, name: actor.name }, role: writer ? 'owner' : 'delegate', action: `theme.${action}`, outcome: result === 'ok' ? 'ok' : 'denied', target: theme, detail, request }).catch(() => {});
  };

  if (area === 'audit') {
    if (method !== 'GET') return err('method_not_allowed', 405);
    const rows = await db.collection(AUDIT_COLL).find({}).sort({ at: -1 }).limit(100).toArray();
    return json({ entries: rows.map((r) => ({ at: new Date(r.at).toISOString(), actor: r.actor_name, action: r.action, theme: r.theme, result: r.result, detail: r.detail })) });
  }

  if (area === 'assets') {
    if (method === 'GET' && !id) {
      const rows = await db.collection(ASSET_COLL).find({}).sort({ created_at: -1 }).limit(300).toArray();
      const themes = await db.collection(THEME_COLL).find({}).limit(200).toArray();
      const used = new Map();
      for (const t of themes) for (const ref of [...refsOf(t.draft), ...(t.published ? refsOf(t.published.config) : [])]) used.set(ref, [...(used.get(ref) || []), t.id]);
      return json({ assets: rows.map((a) => ({ id: String(a._id), ...assetView(a), used_by: [...new Set(used.get(String(a._id)) || [])] })) });
    }
    if (!writer) return err('forbidden', 403);
    if (method === 'POST' && !id) {
      if (await rateLimited(db, `upload:${actor.id}`, 20)) return err('rate_limited', 429);
      const r = await uploadAsset(request, db, actor);
      if (r.status) { log('asset.upload', '-', 'denied'); return r; }
      log('asset.upload', r.asset.name, 'ok', `${r.asset.kind} ${r.asset.width}x${r.asset.height}`);
      return json(r, { status: 201 });
    }
    if (method === 'DELETE' && id) {
      if (!/^[a-f0-9]{24}$/.test(id)) return err('not_found', 404);
      const themes = await db.collection(THEME_COLL).find({}).limit(200).toArray();
      if (themes.some((t) => refsOf(t.draft).includes(id) || (t.published && refsOf(t.published.config).includes(id)))) return err('asset_in_use', 409);
      const { ObjectId } = await import('mongodb');
      await db.collection(ASSET_COLL).deleteOne({ _id: new ObjectId(id) });
      log('asset.delete', id);
      return json({ ok: true });
    }
    return err('method_not_allowed', 405);
  }

  if (area !== 'themes') return err('not_found', 404);
  await seedOfficial(db);

  if (!id) {
    if (method === 'GET') {
      const rows = await db.collection(THEME_COLL).find({}).limit(300).toArray();
      const amap = await assetMap(db, rows.flatMap((t) => (t.status === 'archived' ? [] : refsOf(t.draft))));   // one read of the assets for the whole list
      const out = rows.map((t) => themeView(t, { issues: t.status === 'archived' ? [] : publishIssues(t.draft, amap) }));
      return json({ themes: out.sort((a, b) => Number(b.official) - Number(a.official) || a.name.localeCompare(b.name)) });
    }
    if (method === 'POST') {
      if (!writer) return err('forbidden', 403);
      const body = await readJsonBody(request); if (!body) return err('invalid_body', 400);
      const nid = String(body.id || '');
      if (!ID_RE.test(nid)) return err('invalid_id', 400, { field: 'id' });
      if (await getTheme(db, nid)) return err('theme_exists', 409, { field: 'id' });
      let cfg = blankConfig();
      if (body.from) { const src = await getTheme(db, body.from); if (!src) return err('theme_not_found', 404); cfg = clone(src.draft); cfg.meta.official = false; cfg.meta.name = `${cfg.meta.name} copy`.slice(0, LIMITS.name); }
      else if (body.name) { const n = text(body.name, LIMITS.name, 'name'); if (n.err || !n.v) return err(n.err?.error || 'name_required', 400, { field: 'name' }); cfg.meta.name = n.v; }
      const now = new Date();
      await db.collection(THEME_COLL).insertOne({ id: nid, official: false, status: 'draft', draft: cfg, published: null, version: 0, versions: [], schedule: null, created_at: now, updated_at: now, history: [{ at: now, by: actor.name, action: 'create', detail: body.from || '' }] });
      log('create', nid, 'ok', body.from ? `copy of ${body.from}` : '');
      return json({ theme: themeView(await getTheme(db, nid), { full: true, issues: await issuesFor(db, cfg) }) }, { status: 201 });
    }
    return err('method_not_allowed', 405);
  }

  let doc = await getTheme(db, id);
  if (!doc) return err('theme_not_found', 404);
  const full = async () => themeView(doc, { full: true, issues: doc.status === 'archived' ? [] : await issuesFor(db, doc.draft) });

  if (!sub) {
    if (method === 'GET') return json({ theme: await full() });
    if (method !== 'PATCH') return err('method_not_allowed', 405);
    if (!writer) return err('forbidden', 403);
    if (doc.status === 'archived') return err('theme_archived', 409);
    const body = await readJsonBody(request); if (!body || !body.config) return err('invalid_body', 400);
    const n = normalizeThemeConfig(body.config, doc.draft);
    if (!n.ok) return err(n.error, 400, { field: n.field, ...(n.against ? { against: n.against } : {}) });
    n.config.meta.official = doc.official;
    doc = await saveDraft(db, id, n.config, actor, 'edit');
    log('edit', id);
    return json({ theme: await full() });
  }

  if (method !== 'POST') return err('method_not_allowed', 405);
  if (!writer) return err('forbidden', 403);
  const body = (await readJsonBody(request)) || {};
  const set = async (patch, action, detail = '') => {
    const r = await db.collection(THEME_COLL).findOneAndUpdate({ id }, { $set: { ...patch, updated_at: new Date() }, $push: { history: { $each: [{ at: new Date(), by: actor.name, action, detail }], $slice: -LIMITS.history } } }, { returnDocument: 'after' });
    doc = r?.value ?? r; forgetAll(); log(action, id, 'ok', detail); return json({ theme: await full() });
  };
  const publishing = async (status, schedule) => {
    if (doc.status === 'archived') return err('theme_archived', 409);
    const issues = await issuesFor(db, doc.draft);
    if (issues.length) { log(status === 'published' ? 'publish' : 'schedule', id, 'denied', issues.join(',')); return err('publish_blocked', 409, { issues }); }
    const snap = await snapshotOf(db, doc);
    const entry = { v: snap.version, config: snap.config, at: new Date(), by_name: actor.name, note: String(body.note || '').slice(0, 120) };
    const r = await db.collection(THEME_COLL).findOneAndUpdate({ id }, {
      $set: { status, published: snap, version: snap.version, schedule, updated_at: new Date() },
      $push: { versions: { $each: [entry], $slice: -LIMITS.versions }, history: { $each: [{ at: new Date(), by: actor.name, action: status === 'published' ? 'publish' : 'schedule', detail: `v${snap.version}` }], $slice: -LIMITS.history } },
    }, { returnDocument: 'after' });
    doc = r?.value ?? r; forgetAll(); log(status === 'published' ? 'publish' : 'schedule', id, 'ok', `v${snap.version}`);
    return json({ theme: await full() });
  };

  switch (sub) {
    case 'validate': return json({ issues: await issuesFor(db, doc.draft) });
    case 'preview':
      if (doc.status === 'archived' || doc.status === 'disabled') return err('theme_archived', 409);
      return set({ status: doc.published && doc.status !== 'draft' ? doc.status : 'preview' }, 'preview');
    case 'draft': return set({ status: doc.published ? doc.status : 'draft' }, 'draft');
    case 'publish': return publishing('published', null);
    case 'schedule': {
      const start = body.start ? new Date(body.start) : null; const end = body.end ? new Date(body.end) : null;
      if (!start || Number.isNaN(start.getTime()) || (end && (Number.isNaN(end.getTime()) || end <= start))) return err('invalid_schedule', 400);
      if (end && end.getTime() < Date.now()) return err('invalid_schedule', 400);
      if (start.getTime() > Date.now() + 2 * 366 * 86400000) return err('invalid_schedule', 400);
      return publishing('scheduled', { start, end });
    }
    case 'disable': return set({ status: 'disabled' }, 'disable');
    case 'enable':
      if (doc.status !== 'disabled') return err('invalid_state', 409);
      return set({ status: doc.published ? (doc.schedule ? 'scheduled' : 'published') : 'draft' }, 'enable');
    case 'archive': return set({ status: 'archived' }, 'archive');
    case 'unarchive':
      if (doc.status !== 'archived') return err('invalid_state', 409);
      return set({ status: 'draft', published: null, schedule: null }, 'unarchive');
    case 'duplicate': {
      let nid = String(body.id || `${id}_copy`).slice(0, 40);
      if (!ID_RE.test(nid)) return err('invalid_id', 400, { field: 'id' });
      for (let i = 2; await getTheme(db, nid) && i < 50; i += 1) nid = `${String(body.id || `${id}_copy`).slice(0, 36)}_${i}`;
      if (await getTheme(db, nid)) return err('theme_exists', 409);
      const cfg = clone(doc.draft); cfg.meta.official = false; cfg.meta.name = `${cfg.meta.name} copy`.slice(0, LIMITS.name);
      const now = new Date();
      await db.collection(THEME_COLL).insertOne({ id: nid, official: false, status: 'draft', draft: cfg, published: null, version: 0, versions: [], schedule: null, created_at: now, updated_at: now, history: [{ at: now, by: actor.name, action: 'create', detail: `copy of ${id}` }] });
      log('duplicate', id, 'ok', nid);
      return json({ theme: themeView(await getTheme(db, nid), { full: true, issues: await issuesFor(db, cfg) }) }, { status: 201 });
    }
    case 'restore': {
      const ver = (doc.versions || []).find((v) => v.v === Number(body.version));
      if (!ver) return err('version_not_found', 404);
      return set({ draft: ver.config }, 'restore', `v${ver.v}`);
    }
    default: return err('not_found', 404);
  }
}

// ---------------------------------------------------------------------------------------------- servers
const serverView = (g) => ({ draft: g?.draft || clone(SERVER_DEFAULT), published: g?.published || null, updated_at: g?.updated_at ? new Date(g.updated_at).toISOString() : null, published_at: g?.published_at ? new Date(g.published_at).toISOString() : null });

async function catalog(db, now = new Date()) {
  await seedOfficial(db);
  const rows = await db.collection(THEME_COLL).find({ status: { $in: ['published', 'scheduled'] } }).limit(300).toArray();
  return rows.filter((t) => availability(t, now) === 'available').map((t) => {
    const c = t.published.config; const cover = c.meta.cover ? t.published.assets?.[c.meta.cover] : null;
    return {
      id: t.id, official: t.official, name: c.meta.name, description: c.meta.description, i18n: c.i18n || {}, category: c.meta.category, cover: cover ? cover.url : null,
      presets: (c.presets || []).map((p) => p.id), effects: c.effects.map((e) => e.id), scene: c.environment.scene, palette: c.palette, has_character: Boolean(c.character.asset),
      intro: c.intro.enabled, version: t.published.version, config: c, assets: t.published.assets || {},
    };
  });
}

async function guildRoutes({ db, request, method, rest, session, userId }) {
  const [gid, sub] = rest;
  const gm = await guildManager(db, session, gid);
  if (gm.response) return gm.response;
  const [premium, g0] = await Promise.all([isGuildPremium(db, gid), getGuildTheme(db, gid)]);
  let g = g0;
  const themeFor = async (cfg) => {
    if (!cfg.theme_id) return null;
    const t = await getTheme(db, cfg.theme_id);
    return t && availability(t) === 'available' ? t : null;
  };
  const respond = async () => {
    const cur = await themeFor(g?.draft || SERVER_DEFAULT);
    const pub = g?.published ? await themeFor(g.published) : null;
    return json({ premium, server: serverView(g), theme: cur ? { id: cur.id, config: cur.published.config, assets: cur.published.assets, version: cur.published.version } : null, published_theme: pub ? { id: pub.id, version: pub.published.version } : null });
  };

  if (!sub) {
    if (method === 'GET') return respond();
    if (method !== 'PUT') return err('method_not_allowed', 405);
    if (!premium) return err('premium_required', 402, { field: 'premium' });
    const body = await readJson(request); if (!body || !body.config) return err('invalid_body', 400);
    const base = g?.draft || clone(SERVER_DEFAULT);
    const wantId = 'theme_id' in body.config ? body.config.theme_id : base.theme_id;
    let theme = null;
    if (wantId) {
      const t = await getTheme(db, wantId);
      // a server may keep its current theme even if it is no longer on offer; choosing a new one needs it to be available now
      if (!t || (wantId !== base.theme_id && availability(t) !== 'available') || !t.published) return err('theme_unavailable', 409, { field: 'theme_id' });
      theme = t.published.config;
    }
    const n = normalizeServerConfig(body.config, base, { theme });
    if (!n.ok) return err(n.error, 400, { field: n.field, ...(n.against ? { against: n.against } : {}) });
    if (!premium && usesPremium(n.config) && !usesPremium(base)) return err('premium_required', 402, { field: n.field || 'premium' });
    if (!premium) {
      // free servers cannot add new Premium settings; whatever was there before (a lapsed Premium) is kept untouched
      const keep = base.premium || SERVER_DEFAULT.premium; const nextP = n.config.premium;
      if (JSON.stringify(nextP) !== JSON.stringify(keep)) return err('premium_required', 402, { field: 'premium' });
      for (const k of Object.keys(n.config.palette)) if (['bg', 'surface', 'card', 'text', 'muted'].includes(k) && base.palette?.[k] !== n.config.palette[k]) return err('premium_required', 402, { field: `palette.${k}` });
    }
    const now = new Date();
    await db.collection(GUILD_COLL).updateOne({ guild_id: String(gid) }, {
      $set: { draft: n.config, updated_at: now, updated_by: String(userId) },
      $setOnInsert: { guild_id: String(gid), published: null, created_at: now },
    }, { upsert: true });
    g = await getGuildTheme(db, gid);
    audit(db, { id: userId, name: 'server manager' }, 'server.save', n.config.theme_id || '-', 'ok', `guild ${gid}`);
    return respond();
  }

  if (method !== 'POST') return err('method_not_allowed', 405);
  if (sub === 'logo') {
    // Premium: the server's own logo. The file is checked, resized and re-encoded, so no metadata or odd format ever reaches visitors.
    if (!premium) return err('premium_required', 402, { field: 'premium.logo' });
    let form; try { form = await request.formData(); } catch { return err('invalid_body', 400); }
    const file = form.get('file');
    if (!file || typeof file.arrayBuffer !== 'function') return err('invalid_body', 400);
    if (file.size > LIMITS.logoBytes) return err('asset_too_large', 413);
    const buf = Buffer.from(await file.arrayBuffer());
    const info = sniffImage(buf);
    if (!info || !['image/png', 'image/jpeg', 'image/webp'].includes(info.mime)) return err('asset_format', 400);
    if (info.w < 64 || info.h < 64) return err('asset_too_small', 400, { min: '64x64' });
    let out;
    try {
      const sharp = (await import('sharp')).default;
      out = await sharp(buf).rotate().resize({ width: 512, height: 512, fit: 'inside', withoutEnlargement: true }).webp({ quality: 88 }).toBuffer({ resolveWithObject: true });
    } catch { return err('asset_corrupt', 400); }
    const ins = await db.collection('site_images').insertOne({ mime: 'image/webp', w: out.info.width, h: out.info.height, size: out.data.length, data: out.data, by: String(userId), created_at: new Date() });
    const url = `/api/site-image/${ins.insertedId}`;
    const base = g?.draft || clone(SERVER_DEFAULT);
    const now = new Date();
    await db.collection(GUILD_COLL).updateOne({ guild_id: String(gid) }, {
      $set: { draft: { ...base, premium: { ...(base.premium || SERVER_DEFAULT.premium), logo: url } }, updated_at: now, updated_by: String(userId) },
      $setOnInsert: { guild_id: String(gid), published: null, created_at: now },
    }, { upsert: true });
    g = await getGuildTheme(db, gid);
    audit(db, { id: userId, name: 'server manager' }, 'server.logo', '-', 'ok', `guild ${gid}`);
    return respond();
  }
  if (sub === 'publish') {
    if (!premium) return err('premium_required', 402, { field: 'premium' });
    if (!g) return err('nothing_to_publish', 409);
    const draft = g.draft;
    if (draft.theme_id) {
      const t = await themeFor(draft);
      if (!t) return err('theme_unavailable', 409);
      const re = normalizeServerConfig(draft, draft, { theme: t.published.config });
      if (!re.ok) return err(re.error, 400, { field: re.field });
    }
    await db.collection(GUILD_COLL).updateOne({ guild_id: String(gid) }, { $set: { published: draft, published_at: new Date(), updated_at: new Date() } });
    g = await getGuildTheme(db, gid); forgetGuild(gid);
    audit(db, { id: userId, name: 'server manager' }, 'server.publish', draft.theme_id || '-', 'ok', `guild ${gid}`);
    return respond();
  }
  if (sub === 'reset') {
    await db.collection(GUILD_COLL).deleteOne({ guild_id: String(gid) });
    g = null; forgetGuild(gid);
    audit(db, { id: userId, name: 'server manager' }, 'server.reset', '-', 'ok', `guild ${gid}`);
    return respond();
  }
  return err('not_found', 404);
}

// ---------------------------------------------------------------------------------------------- entry point
export async function handle({ request, db, parts, method }) {
  await ensureIndexes(db);
  const [area, ...rest] = parts;
  if (method !== 'GET' && !trustedOrigin(request)) return err('forbidden_origin', 403);

  // public: the look of one server's pages. Only published choices, never drafts.
  if (area === 'resolve' && method === 'GET') {
    const gid = rest[0];
    if (!SNOWFLAKE.test(String(gid || ''))) return err('invalid_id', 400);
    const theme = await resolveGuildTheme(db, gid, { locale: new URL(request.url).searchParams.get('locale') || 'en' });
    return json({ theme }, { headers: { 'Cache-Control': 'public, max-age=30, s-maxage=30' } });
  }

  const session = await getSession();
  const userId = session?.user?.id ? String(session.user.id) : null;
  if (!userId) return err('unauthenticated', 401);
  if (await isAccountBlocked(db, userId)) return err('account_blocked', 403);

  if (area === 'catalog' && method === 'GET') return json({ themes: await catalog(db) });
  if (area === 'guild') return guildRoutes({ db, request, method, rest, session, userId });
  if (area === 'owner') {
    const isOwner = userId === String(OWNER_ID);
    if (!isOwner && !(method === 'GET' && (await getDelegate(db, userId)))) return err('forbidden', 403);
    if (await rateLimited(db, `owner:${userId}`, 240)) return err('rate_limited', 429);
    return ownerRoutes({ db, request, method, rest, actor: { id: userId, name: String(session.user.username || session.user.global_name || 'owner').slice(0, 60) }, writer: isOwner, readJsonBody: readJson });
  }
  return err('not_found', 404);
}
export { STATUSES };

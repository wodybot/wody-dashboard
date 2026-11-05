// GIF Preview Studio API (mounted at /api/gifstudio/*). Owner only, checked here on the server for every call.
//
//   GET    meta                     presets, palettes, modules, allowed icon names
//   GET    items                    the library
//   POST   items                    {name, kind, module?, config?}
//   GET    items/:id                one item (status, versions, history, readiness)
//   PATCH  items/:id                {name?, config?}
//   DELETE items/:id                {confirm:true}
//   POST   items/:id/generate | cancel | publish | unpublish | archive | unarchive | duplicate | restore | verify
//   GET    items/:id/file?v=&kind=  the file of any version (owner preview)
//   POST   frame                    {config, at}  one PNG frame for the live editor preview
import { NextResponse } from 'next/server';
import { trustedOrigin } from '@/lib/owner-access';
import { audit } from '@/lib/owner-audit';
import { WODY_ICON_KEYS } from '@/lib/wody-icons';
import { requireOwner } from './permissions';
import { GIF_KINDS, GIF_MODULES, PALETTES, PRESETS, TIMELINE_PHASES, LIMITS } from './constants';
import { normalizeConfig, defaultConfig, configHash, totalMs, resolvedPreset, resolveShow, stripPictographs, hasPictograph } from './config';
import { listItems, getItem, createItem, updateItem, deleteItem, view, loadBlob, blobBytes, oid } from './store';
import { startGeneration, requestCancel } from './generate';
import { publishItem, unpublishItem, promoteDue, restoreVersion } from './publish';
import { readiness, liveCheck } from './discord';
import { renderFrame } from './frames';

export const json = (data, init = {}) => NextResponse.json(data, { ...init, headers: { 'Cache-Control': 'no-store, private', ...(init.headers || {}) } });
export const err = (code, status = 400, extra = {}) => json({ error: code, ...extra }, { status });

async function readJson(request) {
  try {
    const text = await request.text();
    if (text.length > 64 * 1024) return null;
    const b = text ? JSON.parse(text) : {};
    return b && typeof b === 'object' && !Array.isArray(b) ? b : null;
  } catch { return null; }
}

async function limited(db, key, max, windowSec = 60) {
  const ms = windowSec * 1000; const start = Date.now() - (Date.now() % ms);
  try {
    const r = await db.collection('rate_limit_buckets').findOneAndUpdate({ _id: `gs:${key}:${start}` }, { $inc: { count: 1 }, $setOnInsert: { expires_at: new Date(start + ms * 2) } }, { upsert: true, returnDocument: 'after' });
    return (r?.count ?? r?.value?.count ?? 0) > max;
  } catch { return false; }
}

const withReady = (doc) => {
  const v = view(doc);
  const cur = (doc.versions || []).find((x) => x.v === doc.current_version);
  return { ...v, readiness: cur ? readiness(doc, cur) : null };
};

export async function handle({ request, db, parts, method }) {
  const who = await requireOwner();
  if (who.error) return err(who.error, who.status);
  const { actor } = who;
  if (method !== 'GET' && !trustedOrigin(request)) return err('forbidden_origin', 403);
  const log = (action, target, detail, outcome = 'ok') => audit(db, { actor, role: 'owner', action: `gifstudio.${action}`, outcome, target, detail, request }).catch(() => {});

  const [a, id, sub] = parts;
  if (a === 'meta' && method === 'GET') {
    return json({
      presets: Object.fromEntries(Object.entries(PRESETS).map(([k, p]) => [k, { width: p.width, height: p.height, fps: p.fps, colors: p.colors, max_mb: Math.round(p.maxBytes / 1048576) }])),
      palettes: PALETTES, kinds: GIF_KINDS, modules: GIF_MODULES, phases: TIMELINE_PHASES, limits: LIMITS, icons: WODY_ICON_KEYS,
    });
  }

  if (a === 'frame' && method === 'POST') {
    if (await limited(db, `frame:${actor.id}`, 60)) return err('rate_limited', 429);
    const body = await readJson(request); if (!body) return err('invalid_body');
    const n = normalizeConfig(body.config, defaultConfig(body.config?.kind || 'module', body.config?.module || 'profile'));
    if (!n.ok) return err(n.error, 400, { field: n.field });
    const total = totalMs(n.config);
    const at = Math.min(total - 1, Math.max(0, Number(body.at) || 0));
    const png = await renderFrame(n.config, at, total, { size: { width: Math.min(600, resolvedPreset(n.config).width), height: Math.min(315, resolvedPreset(n.config).height) } });
    return new NextResponse(png, { headers: { 'Content-Type': 'image/png', 'Cache-Control': 'no-store, private', 'X-Content-Type-Options': 'nosniff' } });
  }
  if (a !== 'items') return err('not_found', 404);

  if (!id) {
    if (method === 'GET') { await promoteDue(db); return json({ items: await listItems(db) }); }
    if (method === 'POST') {
      const body = await readJson(request); if (!body) return err('invalid_body');
      const kind = GIF_KINDS.includes(body.kind) ? body.kind : 'module';
      const module = kind === 'module' ? (GIF_MODULES.includes(body.module) ? body.module : null) : null;
      if (kind === 'module' && !module) return err('invalid_module', 400, { field: 'module' });
      const name = String(body.name ?? '');
      if (hasPictograph(name)) return err('emoji_not_allowed', 400, { field: 'name' });
      const clean = stripPictographs(name).slice(0, LIMITS.name);
      if (!clean) return err('invalid_name', 400, { field: 'name' });
      const base = defaultConfig(kind, module || 'trio');
      const n = normalizeConfig({ ...(body.config || {}), kind, module }, base);
      if (!n.ok) return err(n.error, 400, { field: n.field });
      const item = await createItem(db, { name: clean, config: n.config, kind, module, hash: configHash(n.config) }, actor);
      log('create', clean, `${kind}${module ? `:${module}` : ''}`);
      return json({ item: withReady(item) }, { status: 201 });
    }
    return err('method_not_allowed', 405);
  }

  if (id === 'seed' && method === 'POST') {
    // The standard set: the homepage ad, one GIF per module and one for the latest features, all in the same look.
    const have = new Set((await listItems(db)).filter((i) => i.status !== 'archived').map((i) => (i.module ? `module:${i.module}` : i.kind)));
    const plan = [['module', 'trio', 'Homepage ad (3 in 1)'], ['module', 'profile', 'Profile page'], ['module', 'passport', 'Passport'], ['module', 'collab', 'Collab'], ['module', 'link', 'Wody Link'], ['module', 'battlepass', 'Battle Pass'], ['module', 'counting', 'Counting'], ['module', 'statistics', 'Statistics'], ['module', 'themes', 'Themes'], ['latest', null, 'Latest features']];
    const made = [];
    for (const [kind, module, name] of plan) {
      if (have.has(module ? `module:${module}` : kind)) continue;
      const n = normalizeConfig({ kind, module }, defaultConfig(kind, module || 'trio'));
      made.push(view(await createItem(db, { name, config: n.config, kind, module, hash: configHash(n.config) }, actor)));
    }
    log('seed', 'standard set', `${made.length} created`);
    return json({ items: made }, { status: 201 });
  }

  const item = await getItem(db, id);
  if (!item) return err('not_found', 404);

  if (!sub) {
    if (method === 'GET') return json({ item: withReady(item) });
    if (method === 'PATCH') {
      if (item.status === 'generating') return err('already_generating', 409);
      const body = await readJson(request); if (!body) return err('invalid_body');
      const set = {};
      if ('name' in body) {
        if (hasPictograph(body.name)) return err('emoji_not_allowed', 400, { field: 'name' });
        const nm = stripPictographs(body.name).slice(0, LIMITS.name);
        if (!nm) return err('invalid_name', 400, { field: 'name' });
        set.name = nm;
      }
      if ('config' in body) {
        const n = normalizeConfig({ ...body.config, kind: item.kind, module: item.module }, item.config);
        if (!n.ok) return err(n.error, 400, { field: n.field });
        set.config = n.config; set.config_hash = configHash(n.config);
        // Editing a published item keeps the public address on the published version until the new one is published.
        if (item.status === 'failed' || item.status === 'ready') set.status = item.published_version ? 'published' : 'draft';
      }
      if (!Object.keys(set).length) return err('empty_patch');
      const upd = await updateItem(db, id, set, actor, 'edit', Object.keys(set).join(','));
      log('edit', item.name, Object.keys(set).join(','));
      return json({ item: withReady(upd) });
    }
    if (method === 'DELETE') {
      const body = await readJson(request);
      if (!body || body.confirm !== true) return err('confirmation_required', 400);
      await deleteItem(db, id);
      log('delete', item.name, item.slug);
      return json({ ok: true });
    }
    return err('method_not_allowed', 405);
  }

  if (sub === 'file' && method === 'GET') {
    const url = new URL(request.url);
    const v = Number(url.searchParams.get('v')) || item.current_version;
    const ver = (item.versions || []).find((x) => x.v === v);
    if (!ver) return err('not_found', 404);
    const blob = await loadBlob(db, url.searchParams.get('kind') === 'png' ? ver.png_id : ver.blob_id);
    const data = blobBytes(blob);
    if (!data) return err('not_found', 404);
    return new NextResponse(data, { headers: { 'Content-Type': blob.kind === 'png' ? 'image/png' : 'image/gif', 'Cache-Control': 'private, max-age=60', 'X-Content-Type-Options': 'nosniff', 'Content-Length': String(data.length) } });
  }
  if (sub === 'status' && method === 'GET') return json({ item: view(item) });
  if (method !== 'POST') return err('method_not_allowed', 405);

  if (sub === 'generate') {
    if (await limited(db, `gen:${actor.id}`, 8)) return err('rate_limited', 429);
    const r = await startGeneration(db, id, actor);
    if (!r.ok) return err(r.error, r.status);
    return json({ item: withReady(await getItem(db, id)), cached: !!r.cached }, { status: r.cached ? 200 : 202 });
  }
  if (sub === 'cancel') {
    const r = await requestCancel(db, id, actor);
    if (!r.ok) return err(r.error, r.status);
    log('cancel', item.name, '');
    return json({ ok: true });
  }
  if (sub === 'publish') {
    const body = (await readJson(request)) || {};
    const r = await publishItem(db, id, actor, { scheduleAt: body.schedule_at || null });
    if (!r.ok) return err(r.error, r.status, r.checks ? { checks: r.checks } : {});
    log(r.scheduled ? 'schedule' : 'publish', item.name, item.slug);
    return json({ item: withReady(r.item) });
  }
  if (sub === 'unpublish') {
    const r = await unpublishItem(db, id, actor);
    log('unpublish', item.name, item.slug);
    return json({ item: withReady(r.item) });
  }
  if (sub === 'archive') {
    if (item.status === 'generating') return err('already_generating', 409);
    const upd = await updateItem(db, id, { status: 'archived', published_version: 0, schedule_at: null }, actor, 'archive');
    log('archive', item.name, '');
    return json({ item: withReady(upd) });
  }
  if (sub === 'unarchive') {
    const upd = await updateItem(db, id, { status: item.current_version ? 'ready' : 'draft' }, actor, 'unarchive');
    return json({ item: withReady(upd) });
  }
  if (sub === 'duplicate') {
    const copy = await createItem(db, { name: `${item.name} copy`.slice(0, LIMITS.name), config: item.config, kind: item.kind, module: item.module, hash: item.config_hash }, actor);
    log('duplicate', item.name, copy.slug);
    return json({ item: withReady(copy) }, { status: 201 });
  }
  if (sub === 'restore') {
    const body = await readJson(request); if (!body) return err('invalid_body');
    const r = await restoreVersion(db, id, body.version, actor);
    if (!r.ok) return err(r.error, r.status);
    log('restore', item.name, `v${body.version}`);
    return json({ item: withReady(r.item) });
  }
  if (sub === 'verify') {
    if (await limited(db, `verify:${actor.id}`, 10)) return err('rate_limited', 429);
    if (!item.published_version) return err('not_published', 409);
    return json({ result: await liveCheck(item) });
  }
  return err('not_found', 404);
}
export { oid, resolveShow };

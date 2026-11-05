import { PRESETS } from './constants';
import { resolvedPreset, totalMs, configHash, resolveShow } from './config';
import { renderFrame } from './frames';
import { encodeGif, optimizationSteps, validateGif, staticFallback } from './media';
import { getItem, updateItem, saveBlob, pruneVersions, hist, ITEMS } from './store';

const MAX_FRAMES = 360;
let running = 0;
export const RUNNING_LIMIT = 1;

// Generation pipeline: draw frames -> encode one GIF -> optimize if above the target -> validate -> store a new version.
// It runs in the background; progress, step and cancel live on the item so the panel can poll them.
export async function startGeneration(db, id, actor) {
  const item = await getItem(db, id);
  if (!item) return { ok: false, error: 'not_found', status: 404 };
  const stale = item.status === 'generating' && Date.now() - new Date(item.job?.updated_at || 0).getTime() > 6 * 60 * 1000;
  if (item.status === 'generating' && !stale) return { ok: false, error: 'already_generating', status: 409 };
  if (running >= RUNNING_LIMIT) return { ok: false, error: 'busy', status: 429 };
  const cfg = item.config;
  const hash = configHash(cfg);
  const cached = (item.versions || []).find((v) => v.hash === hash);
  if (cached) {
    const status = item.published_version ? 'published' : 'ready';
    const upd = await updateItem(db, id, { current_version: cached.v, config_hash: hash, status: item.status === 'scheduled' ? 'scheduled' : status, job: null }, actor, 'cache_hit', `v${cached.v}`);
    return { ok: true, cached: true, item: upd };
  }
  const prevStatus = item.status === 'generating' || item.status === 'failed' ? (item.published_version ? 'published' : 'draft') : item.status;
  await updateItem(db, id, { status: 'generating', job: { state: 'running', progress: 0, step: 'frames', cancel: false, prev_status: prevStatus, started_at: new Date(), updated_at: new Date(), error: null } }, actor, 'generate', cfg.preset);
  running += 1;
  runJob(db, id, actor).finally(() => { running -= 1; });
  return { ok: true, cached: false };
}

async function progress(db, id, p, step) {
  await db.collection(ITEMS).updateOne({ _id: (await getItem(db, id))._id }, { $set: { 'job.progress': Math.min(0.99, p), 'job.step': step, 'job.updated_at': new Date() } });
}

async function runJob(db, id, actor) {
  const cancelled = async () => Boolean((await getItem(db, id))?.job?.cancel);
  try {
    const item = await getItem(db, id);
    const cfg = item.config;
    const preset = resolvedPreset(cfg);
    const total = totalMs(cfg);
    const frames = Math.min(MAX_FRAMES, Math.max(2, Math.round((total / 1000) * preset.fps)));
    const show = resolveShow(cfg);
    const pngs = [];
    for (let i = 0; i < frames; i += 1) {
      if (i % 3 === 0 && await cancelled()) return await finishCancelled(db, id, actor);
      pngs.push(await renderFrame(cfg, (i / frames) * total, total, { size: { width: preset.width, height: preset.height }, show }));
      if (i % 3 === 0) await progress(db, id, 0.7 * (i / frames), 'frames');
    }
    await progress(db, id, 0.72, 'encode');
    let enc = await encodeGif(pngs, preset, { shouldCancel: cancelled });
    if (enc.cancelled) return await finishCancelled(db, id, actor);
    let optimized = 0;
    if (enc.bytes > preset.maxBytes) {
      for (const step of optimizationSteps(preset)) {
        if (await cancelled()) return await finishCancelled(db, id, actor);
        optimized += 1;
        await progress(db, id, 0.8 + optimized * 0.04, 'optimize');
        // fewer frames per second means keeping every n-th frame; the PNGs are reused, nothing is drawn again
        const keep = Math.max(1, Math.round(preset.fps / step.fps));
        const subset = pngs.filter((_, i) => i % keep === 0);
        enc = await encodeGif(subset, { width: step.width, height: step.height, fps: Math.round(preset.fps / keep), colors: step.colors }, { shouldCancel: cancelled });
        if (enc.cancelled) return await finishCancelled(db, id, actor);
        if (enc.bytes <= preset.maxBytes) break;
      }
    }
    if (enc.bytes > preset.maxBytes) throw Object.assign(new Error('too_large'), { code: 'gif_too_large' });
    const check = await validateGif(enc.buffer, { maxBytes: preset.maxBytes });
    if (!check.ok) throw Object.assign(new Error(check.error), { code: check.error });
    await progress(db, id, 0.95, 'store');
    const mid = pngs[Math.floor(pngs.length * 0.55)];
    const png = await staticFallback(mid);
    const fresh = await getItem(db, id);
    const v = Math.max(0, ...(fresh.versions || []).map((x) => x.v)) + 1;
    const gifId = await saveBlob(db, id, 'gif', enc.buffer, { v });
    const pngId = await saveBlob(db, id, 'png', png, { v });
    const version = {
      v, hash: configHash(cfg), blob_id: gifId, png_id: pngId, config: cfg, bytes: enc.bytes, width: enc.width, height: enc.height,
      frames: check.frames, fps: enc.fps, colors: enc.colors, duration_ms: check.duration_ms, preset: cfg.preset, optimized: optimized > 0,
      at: new Date(), by: actor?.id || null, by_name: actor?.name || null,
    };
    const status = fresh.job?.prev_status === 'scheduled' ? 'scheduled' : (fresh.published_version ? 'published' : 'ready');
    const after = await db.collection(ITEMS).findOneAndUpdate({ _id: fresh._id }, {
      $push: { versions: version, history: { $each: [hist(actor, 'generated', `v${v} ${(enc.bytes / 1024) | 0} KB`)], $slice: -100 } },
      $set: { current_version: v, config_hash: version.hash, status, job: { state: 'done', progress: 1, step: 'done', optimized, updated_at: new Date() }, updated_at: new Date() },
    }, { returnDocument: 'after' });
    await pruneVersions(db, after?.value ?? after);
  } catch (e) {
    console.error('[gifstudio] generation failed', e?.message || e);
    const code = e?.code && String(e.code).startsWith('gif_') ? e.code : 'generation_failed';
    await db.collection(ITEMS).updateOne({ _id: (await getItem(db, id))._id }, {
      $set: { status: 'failed', job: { state: 'failed', progress: 0, step: 'failed', error: code, updated_at: new Date() }, updated_at: new Date() },
      $push: { history: { $each: [hist(actor, 'failed', code)], $slice: -100 } },
    }).catch(() => {});
  }
}

async function finishCancelled(db, id, actor) {
  const item = await getItem(db, id);
  const back = item?.job?.prev_status && item.job.prev_status !== 'generating' ? item.job.prev_status : 'draft';
  await db.collection(ITEMS).updateOne({ _id: item._id }, {
    $set: { status: back, job: { state: 'cancelled', progress: 0, step: 'cancelled', updated_at: new Date() }, updated_at: new Date() },
    $push: { history: { $each: [hist(actor, 'cancelled')], $slice: -100 } },
  });
}

export async function requestCancel(db, id, actor) {
  const item = await getItem(db, id);
  if (!item) return { ok: false, error: 'not_found', status: 404 };
  if (item.status !== 'generating') return { ok: false, error: 'not_generating', status: 409 };
  await db.collection(ITEMS).updateOne({ _id: item._id }, { $set: { 'job.cancel': true } });
  return { ok: true };
}
export { PRESETS };

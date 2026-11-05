import { getItem, updateItem, loadBlob, blobBytes, getItemBySlug, ITEMS } from './store';
import { validateGif } from './media';
import { readiness } from './discord';

// Publishing makes one version the public address of the item. Nothing is published unless it is a valid GIF, below the size
// limit and checked again at this moment.
export async function publishItem(db, id, actor, { scheduleAt = null } = {}) {
  const item = await getItem(db, id);
  if (!item) return { ok: false, error: 'not_found', status: 404 };
  if (item.status === 'generating') return { ok: false, error: 'already_generating', status: 409 };
  const ver = (item.versions || []).find((v) => v.v === item.current_version);
  if (!ver) return { ok: false, error: 'not_generated', status: 409 };
  const blob = await loadBlob(db, ver.blob_id);
  const data = blobBytes(blob);
  const check = data ? await validateGif(data) : { ok: false, error: 'gif_missing' };
  if (!check.ok) return { ok: false, error: check.error, status: 422 };
  const ready = readiness(item, ver);
  if (!ready.ok) return { ok: false, error: 'discord_not_ready', status: 422, checks: ready.checks };
  if (scheduleAt) {
    const when = new Date(scheduleAt);
    if (Number.isNaN(when.getTime()) || when.getTime() < Date.now() + 30_000 || when.getTime() > Date.now() + 366 * 86400_000) return { ok: false, error: 'invalid_schedule', status: 400 };
    const upd = await updateItem(db, id, { status: 'scheduled', schedule_at: when }, actor, 'schedule', when.toISOString());
    return { ok: true, scheduled: true, item: upd };
  }
  const upd = await updateItem(db, id, { status: 'published', published_version: ver.v, published_at: new Date(), schedule_at: null }, actor, 'publish', `v${ver.v}`);
  return { ok: true, item: upd };
}

export async function unpublishItem(db, id, actor) {
  const item = await getItem(db, id);
  if (!item) return { ok: false, error: 'not_found', status: 404 };
  const upd = await updateItem(db, id, { status: item.current_version ? 'ready' : 'draft', published_version: 0, schedule_at: null }, actor, 'unpublish');
  return { ok: true, item: upd };
}

// Scheduled items go live by themselves. Called lazily from the list and the public address, so no extra process is needed.
export async function promoteDue(db) {
  const due = await db.collection(ITEMS).find({ status: 'scheduled', schedule_at: { $lte: new Date() } }).limit(20).toArray();
  for (const it of due) {
    await db.collection(ITEMS).updateOne({ _id: it._id, status: 'scheduled' }, {
      $set: { status: 'published', published_version: it.current_version, published_at: new Date(), schedule_at: null, updated_at: new Date() },
      $push: { history: { at: new Date(), by: null, by_name: 'scheduler', action: 'publish', detail: `v${it.current_version} scheduled` } },
    });
  }
  return due.length;
}

export async function restoreVersion(db, id, v, actor) {
  const item = await getItem(db, id);
  if (!item) return { ok: false, error: 'not_found', status: 404 };
  const ver = (item.versions || []).find((x) => x.v === Number(v));
  if (!ver) return { ok: false, error: 'version_not_found', status: 404 };
  if (item.status === 'generating') return { ok: false, error: 'already_generating', status: 409 };
  const status = item.status === 'archived' ? 'archived' : (item.published_version ? 'published' : 'ready');
  const upd = await updateItem(db, id, { config: ver.config, config_hash: ver.hash, current_version: ver.v, status }, actor, 'restore', `v${ver.v}`);
  return { ok: true, item: upd };
}

// Resolves a stored selection (a slug) to a published item, or null so the caller falls back to the static image.
export async function publishedBySlug(db, slug) {
  const it = await getItemBySlug(db, slug);
  if (!it || it.status === 'archived' || !it.published_version) return null;
  return it;
}

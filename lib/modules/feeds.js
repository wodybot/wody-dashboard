import { ObjectId } from 'mongodb';
import { requestBot } from '@/lib/bridge';
import { json, validationError, notFound } from '@/lib/modules/http';
import { fail } from '@/lib/modules/validate';
import { DEFAULT_INTERVAL, FeedInputError, MAX_FEEDS, SOURCES, cleanInterval, cleanTarget } from '@/lib/feeds-core';

const ID = /^\d{15,25}$/;
const OID = /^[a-f0-9]{24}$/;

export function publicFeed(doc, h) {
  const d = h.serializeDoc(doc);
  return {
    id: String(doc._id), source: d.source, target: d.target || '', options: d.options || {}, channel_id: d.channel_id ? String(d.channel_id) : null,
    role_id: d.role_id ? String(d.role_id) : null, interval: d.interval || DEFAULT_INTERVAL, enabled: d.enabled !== false,
    created_at: d.created_at || null, last_run: d.last_run || null, last_post: d.last_post || null, next_run: d.next_run || null,
    last_status: d.last_status || null, last_error: d.last_error || null, fails: d.fails || 0, posts: d.posts || 0,
  };
}

function inputErrors(errors, field, ex) {
  if (ex instanceof FeedInputError) { fail(errors, field, ex.code, ex.params); return true; }
  throw ex;
}

async function checkTargets(errors, h, guildId, body, needChannel) {
  if (body.channel_id !== undefined || needChannel) {
    if (!ID.test(String(body.channel_id || ''))) fail(errors, 'channel_id', 'required');
    else if (!(await h.assertTextChannelInGuild(guildId, String(body.channel_id)))) fail(errors, 'channel_id', 'invalid_channel');
  }
  if (body.role_id) {
    if (!ID.test(String(body.role_id)) || !(await h.assertRoleInGuild(guildId, String(body.role_id)))) fail(errors, 'role_id', 'invalid_role');
  }
}

export async function feedsGet(ctx) {
  const { sub, db, gidLong, h } = ctx;
  if (sub === 'feeds') {
    const rows = await db.collection('feeds').find({ guild_id: gidLong }).sort({ created_at: 1 }).limit(MAX_FEEDS + 5).toArray();
    return json({ max: MAX_FEEDS, feeds: rows.map((r) => publicFeed(r, h)) });
  }
  return null;
}

export async function feedsMutate(ctx) {
  const { sub, method, body, db, gidLong, guildId, h, session } = ctx;
  const col = db.collection('feeds');
  const audit = (action, feed) => db.collection('settings_audit').insertOne({
    guild_id: gidLong, collection: 'feeds', user_id: h.toLong(session?.user?.id), diff: { [action]: { from: null, to: `${feed.source} ${feed.target}`.trim() } }, created_at: new Date(),
  }).catch(() => {});

  if (sub === 'feeds/check' && method === 'POST') {
    const errors = [];
    try { cleanTarget(body?.source, body?.target, body?.options); } catch (ex) { inputErrors(errors, 'target', ex); }
    if (errors.length) return validationError(errors);
    const result = await requestBot({ kind: 'feed_check', guildId, userId: session.user.id, payload: { source: body.source, target: body.target || '', options: body.options || {} } });
    return json(result, { status: result.error ? (result.error === 'rate_limited' ? 429 : 502) : 200 });
  }

  if (sub === 'feeds/test' && method === 'POST') {
    const errors = [];
    try { cleanTarget(body?.source, body?.target, body?.options); } catch (ex) { inputErrors(errors, 'target', ex); }
    await checkTargets(errors, h, guildId, { channel_id: body?.channel_id }, true);
    if (errors.length) return validationError(errors);
    const result = await requestBot({ kind: 'feed_test', guildId, userId: session.user.id,
      payload: { source: body.source, target: body.target || '', options: body.options || {}, channel_id: String(body.channel_id), interval: DEFAULT_INTERVAL } });
    return json(result, { status: result.error ? (result.error === 'rate_limited' ? 429 : 502) : 200 });
  }

  if (sub === 'feeds' && method === 'POST') {
    const errors = [];
    let target = '';
    let options = {};
    let interval = DEFAULT_INTERVAL;
    try { [target, options] = cleanTarget(body?.source, body?.target, body?.options); } catch (ex) { inputErrors(errors, 'target', ex); }
    try { interval = cleanInterval(body?.interval ?? DEFAULT_INTERVAL); } catch (ex) { inputErrors(errors, 'interval', ex); }
    await checkTargets(errors, h, guildId, body || {}, true);
    if (errors.length) return validationError(errors);
    if (await col.countDocuments({ guild_id: gidLong }) >= MAX_FEEDS) return json({ error: 'limit_reached', max: MAX_FEEDS }, { status: 409 });
    const now = new Date();
    const doc = {
      guild_id: gidLong, source: body.source, target, options, channel_id: h.toLong(String(body.channel_id)), role_id: body.role_id ? h.toLong(String(body.role_id)) : null,
      interval, enabled: true, created_at: now, created_by: h.toLong(session?.user?.id), next_run: now, last_run: null, last_post: null, last_status: null,
      last_error: null, fails: 0, seen: [], posts: 0, primed: false,
    };
    const res = await col.insertOne(doc);
    await audit('added', doc);
    return json({ ok: true, feed: publicFeed({ ...doc, _id: res.insertedId }, h) });
  }

  const m = sub.match(/^feeds\/([a-f0-9]{24})(?:\/(test|toggle|run))?$/);
  if (!m) return null;
  const [, id, action] = m;
  const filter = { _id: new ObjectId(id), guild_id: gidLong };
  const doc = await col.findOne(filter);
  if (!doc) return notFound();

  if (!action && method === 'DELETE') {
    await col.deleteOne(filter);
    await audit('removed', doc);
    return json({ ok: true });
  }

  if (!action && (method === 'PUT' || method === 'PATCH')) {
    const errors = [];
    const patch = {};
    const sourceChanged = body.source !== undefined && body.source !== doc.source;
    const source = body.source !== undefined ? body.source : doc.source;
    if (!SOURCES[source]) fail(errors, 'source', 'source');
    if (body.target !== undefined || body.options !== undefined || sourceChanged) {
      try {
        const [target, options] = cleanTarget(source, body.target !== undefined ? body.target : doc.target, body.options !== undefined ? body.options : doc.options);
        if (sourceChanged || target !== doc.target || JSON.stringify(options) !== JSON.stringify(doc.options || {})) {
          Object.assign(patch, { source, target, options, seen: [], primed: false, fails: 0, last_error: null, last_status: null, next_run: new Date(), enabled: doc.enabled !== false });
        }
      } catch (ex) { inputErrors(errors, 'target', ex); }
    }
    if (body.interval !== undefined) { try { patch.interval = cleanInterval(body.interval); } catch (ex) { inputErrors(errors, 'interval', ex); } }
    await checkTargets(errors, h, guildId, { channel_id: body.channel_id, role_id: body.role_id }, false);
    if (errors.length) return validationError(errors);
    if (body.channel_id !== undefined) patch.channel_id = h.toLong(String(body.channel_id));
    if (body.role_id !== undefined) patch.role_id = body.role_id ? h.toLong(String(body.role_id)) : null;
    if (body.enabled !== undefined) {
      patch.enabled = Boolean(body.enabled);
      if (patch.enabled) Object.assign(patch, { fails: 0, last_error: null, next_run: new Date() });
    }
    if (Object.keys(patch).length) await col.updateOne(filter, { $set: patch });
    await audit('updated', { ...doc, ...patch });
    return json({ ok: true, feed: publicFeed({ ...doc, ...patch }, h) });
  }

  if (action === 'toggle' && method === 'POST') {
    const enabled = !(doc.enabled !== false);
    await col.updateOne(filter, { $set: { enabled, ...(enabled ? { fails: 0, last_error: null, next_run: new Date() } : {}) } });
    return json({ ok: true, enabled });
  }

  if (action === 'test' && method === 'POST') {
    const result = await requestBot({ kind: 'feed_test', guildId, userId: session.user.id, payload: { feed_id: id } });
    return json(result, { status: result.error ? (result.error === 'rate_limited' ? 429 : 502) : 200 });
  }

  if (action === 'run' && method === 'POST') {
    await col.updateOne(filter, { $set: { next_run: new Date(), enabled: true } });
    return json({ ok: true });
  }
  return null;
}

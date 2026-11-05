// Battle Pass Page Studio API (mounted inside the Battle Pass API as owner/pages/*). The Owner only: delegates cannot use it.
//
//   GET   owner/pages                         every season with the status of its page (draft pages are created on first sight)
//   GET   owner/pages/:sid                    the page, its versions and history, and whether the season is complete enough
//   PATCH owner/pages/:sid                    {config?, slug?}        edits the DRAFT only; the public page does not change
//   POST  owner/pages/:sid/{publish|schedule|unpublish|disable|enable|archive|unarchive|regenerate|restore|announce}
import { askBot } from '../store.js';
import { OWNER_ID } from '@/lib/owner-access';
import { audit as ownerAudit } from '@/lib/owner-audit';
import { COLL } from '../constants.js';
import { PAGE_COLL, LIMITS, RESERVED_SLUGS } from './constants.js';
import { normalizeConfig, cleanSlug, defaultConfig } from './schema.js';
import { ensurePage, getPage, getSeason, updatePage, pageView, seasonReadiness, ensureIndexes } from './store.js';
import { SNOWFLAKE } from '../validate.js';
import { absoluteImage } from '@/lib/site-image-path';

const SITE = () => (process.env.NEXT_PUBLIC_BASE_URL || 'https://wody.online').replace(/\/$/, '');

export async function studioRoutes({ db, rest, method, request, userId, readJson, json, err }) {
  if (String(userId) !== String(OWNER_ID)) return err('forbidden', 403);
  await ensureIndexes(db);
  const actor = { id: String(userId), name: 'owner' };
  const log = (action, target, detail) => ownerAudit(db, { actor, role: 'owner', action: `bp.page.${action}`, outcome: 'ok', target, detail, request }).catch(() => {});
  const [sid, sub] = rest;

  if (!sid) {
    if (method !== 'GET') return err('method_not_allowed', 405);
    const seasons = await db.collection(COLL.seasons).find({}).sort({ created_at: -1 }).limit(200).toArray();
    const rows = [];
    for (const s of seasons) {
      const ready = seasonReadiness(s);
      let page = await getPage(db, String(s._id));
      if (!page && ready.ok) page = await ensurePage(db, s, actor);
      rows.push({ ...(page ? pageView(page, s) : { season_id: String(s._id), status: null, slug: null, path: null, season: pageView({ season_id: String(s._id) }, s).season }), eligible: ready.ok, checks: ready.checks });
    }
    return json({ pages: rows });
  }

  const season = await getSeason(db, sid);
  if (!season) return err('season_not_found', 404);
  const ready = seasonReadiness(season);
  let page = await getPage(db, sid);
  if (!page) {
    if (!ready.ok) return err('season_incomplete', 409, { checks: ready.checks });
    page = await ensurePage(db, season, actor);
  }
  const view = () => ({ page: pageView(page, season), readiness: ready });

  if (!sub) {
    if (method === 'GET') return json(view());
    if (method !== 'PATCH') return err('method_not_allowed', 405);
    const body = await readJson(request, 64 * 1024);
    if (!body) return err('invalid_body', 400);
    const set = {}; const changed = [];
    if ('config' in body) {
      const n = normalizeConfig(body.config, page.draft);
      if (!n.ok) return err(n.error, 400, { field: n.field });
      set.draft = n.config; changed.push('config');
      if (['ready', 'failed'].includes(page.status)) set.status = page.published ? 'published' : 'draft';
    }
    if ('slug' in body) {
      const c = cleanSlug(body.slug);
      if (!c.ok) return err(c.error, 400, { field: 'slug' });
      if (page.status === 'published' && c.slug !== page.slug) return err('slug_locked', 409, { field: 'slug' });
      if (c.slug !== page.slug && (await db.collection(PAGE_COLL).findOne({ slug: c.slug }))) return err('slug_taken', 409, { field: 'slug' });
      set.slug = c.slug; changed.push('slug');
    }
    if (!changed.length) return err('empty_patch', 400);
    try { page = await updatePage(db, sid, set, actor, 'edit', changed.join(',')); } catch (e) { if (e?.code === 11000) return err('slug_taken', 409); throw e; }
    log('edit', season.name, changed.join(','));
    return json(view());
  }

  if (method !== 'POST') return err('method_not_allowed', 405);
  const body = (await readJson(request, 16 * 1024)) || {};
  const done = async (set, action, detail) => { page = await updatePage(db, sid, set, actor, action, detail); log(action, season.name, detail || page.slug); return json(view()); };

  if (sub === 'publish') {
    if (!ready.ok) return err('season_incomplete', 409, { checks: ready.checks });
    if (page.status === 'disabled' || page.status === 'archived') return err('page_not_active', 409);
    const v = Math.max(0, ...(page.versions || []).map((x) => x.v)) + 1;
    const entry = { v, config: page.draft, at: new Date(), by: actor.id, by_name: actor.name, note: String(body.note || '').slice(0, 120) };
    const r = await db.collection(PAGE_COLL).findOneAndUpdate({ season_id: sid }, {
      $set: { status: 'published', published: page.draft, published_version: v, published_at: new Date(), schedule_at: null, error: null, updated_at: new Date() },
      $push: { versions: { $each: [entry], $slice: -LIMITS.versions }, history: { $each: [{ at: new Date(), by: actor.id, by_name: actor.name, action: 'publish', detail: `v${v}` }], $slice: -LIMITS.history } },
    }, { returnDocument: 'after' });
    page = r?.value ?? r; log('publish', season.name, `v${v} ${page.slug}`);
    return json(view());
  }
  if (sub === 'schedule') {
    if (!ready.ok) return err('season_incomplete', 409, { checks: ready.checks });
    const when = new Date(body.schedule_at);
    if (Number.isNaN(when.getTime()) || when.getTime() < Date.now() + 30000 || when.getTime() > Date.now() + 366 * 86400000) return err('invalid_schedule', 400);
    return done({ status: 'scheduled', schedule_at: when }, 'schedule', when.toISOString());
  }
  if (sub === 'unpublish') return done({ status: page.published ? 'ready' : 'draft', published: null, published_version: 0, schedule_at: null }, 'unpublish');
  if (sub === 'disable') return done({ status: 'disabled' }, 'disable');
  if (sub === 'enable') return done({ status: page.published ? 'published' : 'draft' }, 'enable');
  if (sub === 'archive') return done({ status: 'archived', published: null, published_version: 0, schedule_at: null }, 'archive');
  if (sub === 'unarchive') return done({ status: 'draft' }, 'unarchive');
  if (sub === 'regenerate') {
    // Rebuilds the draft from the season (defaults, season theme). The published page is not touched.
    const base = defaultConfig();
    const n = normalizeConfig({ theme: season.page && typeof season.page === 'object' ? season.page : {} }, base);
    return done({ draft: n.ok ? n.config : base, status: page.published ? 'published' : (ready.ok ? 'ready' : 'failed'), error: ready.ok ? null : 'season_incomplete' }, 'regenerate');
  }
  if (sub === 'restore') {
    const ver = (page.versions || []).find((x) => x.v === Number(body.version));
    if (!ver) return err('version_not_found', 404);
    return done({ draft: ver.config }, 'restore', `v${ver.v}`);
  }
  if (sub === 'announce') {
    if (page.status !== 'published') return err('not_published', 409);
    const channel = String(body.channel_id || '');
    if (!SNOWFLAKE.test(channel)) return err('invalid_channel', 400);
    const cfg = page.published || page.draft;
    const payload = {
      season_id: sid, channel_id: channel, url: `${SITE()}/battlepass/${page.slug}`,
      title: cfg.discord.title || cfg.seo.title || season.name, description: cfg.discord.description || cfg.seo.description || season.description || '',
      image: absoluteImage(cfg.discord.image || cfg.seo.og_image || '', SITE()),
    };
    const r = await askBot(db, { kind: 'bp_page_announce', guildId: season.guild_id || 0, userId, payload, waitMs: 12000 });
    if (r.error) return err(r.error === 'bot_unreachable' ? 'bot_unreachable' : r.error, r.error === 'bot_unreachable' ? 503 : 400);
    log('announce', season.name, channel);
    return json({ ok: true, ...view() });
  }
  return err('not_found', 404);
}
export { RESERVED_SLUGS };

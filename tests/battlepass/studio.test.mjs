// Battle Pass Page Studio: config validation, Owner-only API, publishing rules, versions, isolation and the public loader,
// on the real lib/battlepass code with an in-memory database.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const { state } = await import('./stubs/state.mjs');
const { makeDb } = await import('./fake-db.mjs');
const { handle } = await import('../../lib/battlepass/api.js');
const { OWNER_ID } = await import('./stubs/owner-access.mjs');
const schema = await import('../../lib/battlepass/studio/schema.js');
const { loadStudioPage, promoteDuePages } = await import('../../lib/battlepass/studio/public.js');
const { PAGE_COLL } = await import('../../lib/battlepass/studio/constants.js');

const OWNER = OWNER_ID; const DELEGATE = '1000000000000000002'; const MEMBER = '3000000000000000001';

function fresh() { state.db = makeDb(); state.session = null; state.delegates = new Set([DELEGATE]); state.blocked = new Set(); state.guilds = []; return state.db; }
async function call(method, path, { body, user, origin = 'https://wody.test' } = {}) {
  state.session = user ? { user: { id: user }, accessToken: 'token' } : null;
  const url = new URL(`https://wody.test/api/battlepass/${path}`);
  const request = new Request(url, { method, headers: { origin, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const res = await handle({ request, db: state.db, parts: path.split('?')[0].split('/').filter(Boolean), method, url });
  return { status: res.status, body: await res.json() };
}
const season = (over = {}) => ({
  name: 'Dragon Autumn', level_count: 5, curve: { type: 'fixed', base: 100 },
  rewards: [{ id: 'r1', name: 'Badge', type: 'badge', level: 1 }, { id: 'r2', name: 'Frame', type: 'frame', level: 3, rarity: 'legendary' }], ...over,
});
async function makeSeason(over, activate = true) {
  const r = await call('POST', 'owner/seasons', { user: OWNER, body: season(over) });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  const id = r.body.season.id;
  if (activate) assert.equal((await call('POST', `owner/seasons/${id}/activate`, { user: OWNER })).status, 200);
  return id;
}
const P = (sid, sub = '') => `owner/pages/${sid}${sub ? `/${sub}` : ''}`;

test('config: unsafe values are refused, safe ones are normalized, nothing carries markup or script', () => {
  const base = schema.defaultConfig();
  const bad = (patch) => schema.normalizeConfig(patch, base);
  assert.equal(bad({ hero: { title: 'Hi \u{1F525}' } }).error, 'emoji_not_allowed');
  assert.equal(bad({ hero: { cta_label: 'Go', cta_url: 'javascript:alert(1)' } }).error, 'invalid_url');
  assert.equal(bad({ hero: { cta_label: 'Go', cta_url: 'http://example.com' } }).error, 'invalid_url');
  assert.equal(bad({ footer: { text: '', links: [{ label: 'x', url: 'data:text/html,hi' }] } }).error, 'invalid_url');
  assert.equal(bad({ seo: { og_image: 'ftp://x/y.png' } }).error, 'invalid_url');
  assert.equal(bad({ sections: [{ id: 'evil', type: 'script' }, { id: 'hero', type: 'hero' }] }).error, 'invalid_section_type');
  assert.equal(bad({ sections: [{ id: 'hero', type: 'hero' }, { id: 'hero', type: 'hero' }] }).error, 'invalid_section_id');
  assert.equal(bad({ sections: [{ id: 'track', type: 'track' }] }).error, 'hero_required');
  assert.equal(bad({ sections: [{ id: 'hero', type: 'hero' }, { id: 'hero2', type: 'hero' }] }).error, 'duplicate_section');
  assert.equal(bad({ layout: { width: 'huge' } }).error, 'invalid_layout');
  assert.equal(bad({ theme: { css: 'body{display:none}' } }).error, 'invalid_theme');
  assert.equal(bad({ theme: { mode: 'solid', from: '#101010', text: '#151515' } }).error, 'low_contrast');
  const tooMany = Array.from({ length: 13 }, (_, i) => ({ id: `t${i}`, type: 'text', text: 'x' }));
  assert.equal(bad({ sections: [{ id: 'hero', type: 'hero' }, ...tooMany] }).error, 'too_many_blocks');
  // angle brackets are stripped, so no tag can survive in a text
  const ok = bad({ hero: { title: '<b>Season</b> <script>x</script>' }, faq: [{ q: 'Why?', a: 'Because <img src=x onerror=1>' }] });
  assert.equal(ok.ok, true);
  assert.ok(!/[<>]/.test(JSON.stringify(ok.config)), 'no angle bracket is kept');
  // an uploaded image path is accepted, a lookalike path is not
  assert.equal(bad({ seo: { og_image: '/api/site-image/0123456789abcdef01234567' } }).ok, true);
  assert.equal(bad({ seo: { og_image: '/api/site-image/../../etc/passwd' } }).error, 'invalid_url');
});

test('slug rules: format, reserved words', () => {
  assert.equal(schema.cleanSlug('Dragon Season 2026!').slug, 'dragon-season-2026');
  assert.equal(schema.cleanSlug('ab').error, 'invalid_slug');
  assert.equal(schema.cleanSlug('preview').error, 'reserved_slug');
  assert.equal(schema.cleanSlug('help').error, 'reserved_slug');
});

test('access: only the Owner reaches the Studio; delegates, members and cross-site calls are refused', async () => {
  fresh();
  const sid = await makeSeason();
  for (const user of [DELEGATE, MEMBER]) {
    assert.equal((await call('GET', P(sid), { user })).status, 403);
    assert.equal((await call('POST', P(sid, 'publish'), { user })).status, 403);
  }
  assert.equal((await call('GET', P(sid))).status, 401);
  assert.equal((await call('POST', P(sid, 'publish'), { user: OWNER, origin: 'https://evil.test' })).status, 403);
  assert.equal((await call('GET', P(sid), { user: OWNER })).status, 200);
});

test('one page per season, never duplicated, even when opened many times at once', async () => {
  const db = fresh();
  const sid = await makeSeason();
  await Promise.all(Array.from({ length: 6 }, () => call('GET', P(sid), { user: OWNER })));
  await call('GET', 'owner/pages', { user: OWNER });
  assert.equal(await db.collection(PAGE_COLL).countDocuments({ season_id: sid }), 1);
});

test('an incomplete season cannot get a published page', async () => {
  fresh();
  const draftId = await makeSeason({ name: 'Still a draft' }, false);
  const r = await call('GET', P(draftId), { user: OWNER });
  assert.equal(r.status, 409); assert.equal(r.body.error, 'season_incomplete');
  const pub = await call('POST', P(draftId, 'publish'), { user: OWNER });
  assert.equal(pub.status, 409);
});

test('draft edits never change the public page; publish, versions, restore and unpublish work', async () => {
  const db = fresh();
  const sid = await makeSeason();
  const first = await call('GET', P(sid), { user: OWNER });
  const slug = first.body.page.slug;
  assert.equal(first.body.page.status, 'draft');
  assert.equal(await loadStudioPage({ slug }), null, 'a draft has no public page');

  const edit = await call('PATCH', P(sid), { user: OWNER, body: { config: { hero: { title: 'Version one' } } } });
  assert.equal(edit.status, 200);
  assert.equal((await call('POST', P(sid, 'publish'), { user: OWNER, body: { note: 'first' } })).body.page.status, 'published');
  let pub = await loadStudioPage({ slug });
  assert.equal(pub.config.hero.title, 'Version one');

  await call('PATCH', P(sid), { user: OWNER, body: { config: { hero: { title: 'Version two' } } } });
  pub = await loadStudioPage({ slug });
  assert.equal(pub.config.hero.title, 'Version one', 'saving a draft does not touch the public page');

  await call('POST', P(sid, 'publish'), { user: OWNER });
  assert.equal((await loadStudioPage({ slug })).config.hero.title, 'Version two');
  const view = (await call('GET', P(sid), { user: OWNER })).body.page;
  assert.deepEqual(view.versions.map((v) => v.v), [2, 1]);

  const restore = await call('POST', P(sid, 'restore'), { user: OWNER, body: { version: 1 } });
  assert.equal(restore.body.page.draft.hero.title, 'Version one');
  assert.equal((await loadStudioPage({ slug })).config.hero.title, 'Version two', 'restore only fills the draft');
  assert.equal((await call('POST', P(sid, 'restore'), { user: OWNER, body: { version: 99 } })).body.error, 'version_not_found');

  assert.equal((await call('PATCH', P(sid), { user: OWNER, body: { slug: 'other-address' } })).body.error, 'slug_locked');
  await call('POST', P(sid, 'unpublish'), { user: OWNER });
  assert.equal(await loadStudioPage({ slug }), null);
  assert.equal(await db.collection(PAGE_COLL).countDocuments({ season_id: sid }), 1);
});

test('disabled and archived pages are offline and cannot be published until restored', async () => {
  fresh();
  const sid = await makeSeason();
  const slug = (await call('GET', P(sid), { user: OWNER })).body.page.slug;
  await call('POST', P(sid, 'publish'), { user: OWNER });
  await call('POST', P(sid, 'disable'), { user: OWNER });
  assert.equal(await loadStudioPage({ slug }), null);
  assert.equal((await call('POST', P(sid, 'publish'), { user: OWNER })).body.error, 'page_not_active');
  await call('POST', P(sid, 'enable'), { user: OWNER });
  assert.ok(await loadStudioPage({ slug }), 'enabling brings back the published version');
  await call('POST', P(sid, 'archive'), { user: OWNER });
  assert.equal(await loadStudioPage({ slug }), null);
  assert.equal((await call('POST', P(sid, 'unarchive'), { user: OWNER })).body.page.status, 'draft');
});

test('slugs are unique and a taken or reserved address is refused', async () => {
  fresh();
  const a = await makeSeason({ name: 'Alpha Pass' });
  const b = await makeSeason({ name: 'Beta Pass' }, false);
  await call('POST', `owner/seasons/${b}/activate`, { user: OWNER }).catch(() => {});
  const pa = (await call('GET', P(a), { user: OWNER })).body.page;
  const pb = await call('GET', P(b), { user: OWNER });
  if (pb.status === 200) {
    assert.equal((await call('PATCH', P(b), { user: OWNER, body: { slug: pa.slug } })).body.error, 'slug_taken');
    assert.equal((await call('PATCH', P(b), { user: OWNER, body: { slug: 'preview' } })).body.error, 'reserved_slug');
  }
  assert.equal((await call('PATCH', P(a), { user: OWNER, body: { slug: 'x' } })).body.error, 'invalid_slug');
  assert.equal((await call('PATCH', P(a), { user: OWNER, body: { config: { hero: { title: 'Fire \u{1F525}' } } } })).body.error, 'emoji_not_allowed');
});

test('scheduled pages go public only when due, and an invalid time is refused', async () => {
  const db = fresh();
  const sid = await makeSeason();
  const slug = (await call('GET', P(sid), { user: OWNER })).body.page.slug;
  assert.equal((await call('POST', P(sid, 'schedule'), { user: OWNER, body: { schedule_at: new Date(Date.now() - 1000).toISOString() } })).body.error, 'invalid_schedule');
  const ok = await call('POST', P(sid, 'schedule'), { user: OWNER, body: { schedule_at: new Date(Date.now() + 3600000).toISOString() } });
  assert.equal(ok.body.page.status, 'scheduled');
  assert.equal(await loadStudioPage({ slug }), null, 'not public before the time');
  await db.collection(PAGE_COLL).updateOne({ season_id: sid }, { $set: { schedule_at: new Date(Date.now() - 1000) } });
  await promoteDuePages(db);
  assert.ok(await loadStudioPage({ slug }), 'public after the time');
});

test('the Owner preview is Owner only and shows the draft; the public loader shows only the published config', async () => {
  fresh();
  const sid = await makeSeason();
  await call('GET', P(sid), { user: OWNER });
  await call('PATCH', P(sid), { user: OWNER, body: { config: { hero: { title: 'Draft only' } } } });
  state.session = { user: { id: MEMBER } };
  assert.equal(await loadStudioPage({ sid, preview: true }), null, 'a member cannot preview');
  state.session = { user: { id: OWNER } };
  const pv = await loadStudioPage({ sid, preview: true });
  assert.equal(pv.config.hero.title, 'Draft only');
});

test('the announcement needs a published page and a valid channel, and goes to the bot with the public link', async () => {
  const db = fresh();
  const sid = await makeSeason();
  await call('GET', P(sid), { user: OWNER });
  assert.equal((await call('POST', P(sid, 'announce'), { user: OWNER, body: { channel_id: '123456789012345678' } })).body.error, 'not_published');
  await call('POST', P(sid, 'publish'), { user: OWNER });
  assert.equal((await call('POST', P(sid, 'announce'), { user: OWNER, body: { channel_id: 'abc' } })).body.error, 'invalid_channel');
  const timer = setInterval(async () => {
    const col = db.collection('module_requests');
    for (const doc of await col.find({ status: 'pending', kind: 'bp_page_announce' }).toArray()) await col.updateOne({ _id: doc._id }, { $set: { status: 'done', result: { ok: true } } });
  }, 20);
  const r = await call('POST', P(sid, 'announce'), { user: OWNER, body: { channel_id: '123456789012345678' } });
  clearInterval(timer);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const sent = await db.collection('module_requests').findOne({ kind: 'bp_page_announce' });
  assert.match(sent.payload.url, /\/battlepass\/[a-z0-9-]+$/);
  assert.equal(sent.payload.channel_id, '123456789012345678');
});

test('new Studio files and messages contain no Unicode emoji, no straight apostrophes and no dashes', () => {
  const files = ['components/battlepass/studio/PageStudio.jsx', 'components/battlepass/studio/EditorTabs.jsx', 'components/battlepass/studio/PreviewFrame.jsx',
    'lib/battlepass/studio/schema.js', 'lib/battlepass/studio/api.js', 'lib/battlepass/studio/store.js', 'lib/battlepass/studio/public.js', 'lib/battlepass/studio/seo.js'];
  const pict = /[←-⇿☀-➿⬀-⯿\u{1F000}-\u{1FAFF}]/u;
  for (const f of files) assert.ok(!pict.test(readFileSync(new URL(`../../${f}`, import.meta.url), 'utf8')), `${f} has a Unicode pictograph`);
  const langs = ['en', 'ro', 'fr', 'it', 'de', 'es', 'nl', 'pt', 'tr'];
  const flat = (o, p = '') => Object.entries(o).flatMap(([k, v]) => (typeof v === 'object' ? flat(v, `${p}${k}.`) : [[`${p}${k}`, v]]));
  const en = flat(JSON.parse(readFileSync(new URL('../../messages/en.json', import.meta.url), 'utf8')).bpStudio);
  assert.ok(en.length > 250);
  for (const l of langs) {
    const m = flat(JSON.parse(readFileSync(new URL(`../../messages/${l}.json`, import.meta.url), 'utf8')).bpStudio);
    assert.deepEqual(m.map(([k]) => k), en.map(([k]) => k), `${l} has the same keys as en`);
    for (const [k, v] of m) { assert.ok(!/['–—]/.test(v) && !pict.test(v), `${l}.${k}`); }
  }
});

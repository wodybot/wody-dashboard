// GIF Preview Studio: the real config, renderer, encoder, job pipeline, publishing and API code on an in-memory database.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';

const { state } = await import('../battlepass/stubs/state.mjs');
const { makeDb } = await import('../battlepass/fake-db.mjs');
const cfgLib = await import('../../lib/gifstudio/config.js');
const media = await import('../../lib/gifstudio/media.js');
const { startGeneration, requestCancel } = await import('../../lib/gifstudio/generate.js');
const { publishItem, promoteDue, publishedBySlug } = await import('../../lib/gifstudio/publish.js');
const { handle } = await import('../../lib/gifstudio/api.js');
const { readiness, liveCheck } = await import('../../lib/gifstudio/discord.js');
const icons = await import('../../lib/wody-icons.js');
const OWNER = '1000000000000000001';

function fresh() { state.db = makeDb(); state.session = { user: { id: OWNER, username: 'owner' } }; state.delegates = new Set(); return state.db; }
async function call(method, path, { body, user = OWNER, origin = 'https://wody.test' } = {}) {
  state.session = user ? { user: { id: user, username: 'u' } } : null;
  const request = new Request(`https://wody.test/api/gifstudio/${path}`, { method, headers: { origin, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const res = await handle({ request, db: state.db, parts: path.split('?')[0].split('/').filter(Boolean), method });
  const type = res.headers.get('content-type') || '';
  return { status: res.status, type, body: type.includes('json') ? await res.json() : Buffer.from(await res.arrayBuffer()) };
}
async function waitDone(id, ms = 120000) {
  const t0 = Date.now();
  for (;;) {
    const r = await call('GET', `items/${id}`);
    if (r.body.item.status !== 'generating') return r.body.item;
    if (Date.now() - t0 > ms) throw new Error('generation timed out');
    await new Promise((ok) => setTimeout(ok, 300));
  }
}
const SMALL = { preset: 'custom', custom: { width: 320, height: 168, fps: 5, colors: 64, maxMb: 3 }, timeline: { intro: { on: true, ms: 800 }, reveal: { on: true, ms: 800 }, features: { on: true, ms: 1000 }, final: { on: true, ms: 800 } } };

test('config: only Wody emoji are allowed, colors and timeline are validated, the cache key is stable', () => {
  const base = cfgLib.defaultConfig('module', 'passport');
  assert.equal(cfgLib.normalizeConfig({ texts: { title: 'Hi \u{1F525}' } }, base).error, 'emoji_not_allowed');
  assert.equal(cfgLib.normalizeConfig({ texts: { features: [{ icon: 'fire', text: 'ok ❤️' }] } }, base).error, 'emoji_not_allowed');
  assert.equal(cfgLib.normalizeConfig({ palette: 'custom', colors: { bg1: 'red', bg2: '#000000', accent: '#ffffff' } }, base).error, 'invalid_color');
  assert.equal(cfgLib.normalizeConfig({ palette: 'custom', colors: { bg1: '#101010', bg2: '#202020', accent: '#181818' } }, base).error, 'low_contrast');
  assert.equal(cfgLib.normalizeConfig({ timeline: { intro: { on: false }, reveal: { on: false }, features: { on: false }, final: { on: true, ms: 1000 } } }, base).error, 'timeline_too_short');
  const ok = cfgLib.normalizeConfig({ texts: { features: [{ icon: 'not_a_real_icon', text: 'One' }] } }, base);
  assert.equal(ok.ok, true);
  assert.equal(ok.config.texts.features[0].icon, '', 'an unknown icon never becomes a Unicode emoji');
  assert.equal(cfgLib.configHash(ok.config), cfgLib.configHash(JSON.parse(JSON.stringify(ok.config))));
  const other = cfgLib.normalizeConfig({ texts: { title: 'Other' } }, ok.config).config;
  assert.notEqual(cfgLib.configHash(other), cfgLib.configHash(ok.config));
});

test('the localized GIF copy exists in all 9 languages for the modules, the ad and the latest features', () => {
  for (const l of cfgLib.LOCALES) {
    const c = JSON.parse(readFileSync(`messages/${l}.json`, 'utf8')).gifStudio.content;
    for (const k of ['profile', 'passport', 'collab']) {
      assert.ok(c[k].title && c[k].subtitle && c[k].cta, `${l}.${k}`);
      assert.equal(c[k].features.length, 4);
      for (const f of c[k].features) { assert.ok(f.text); assert.ok(icons.WODY_ICON_FILES[f.icon], `${l}.${k} icon ${f.icon}`); }
    }
    assert.equal(c.latest.items.length, 4);
    for (const k of ['link', 'battlepass', 'counting', 'statistics', 'themes']) assert.ok(c.ad.col[k].name && c.ad.col[k].blurb && c.ad.col[k].cta, `${l}.ad.${k}`);
    assert.ok(c.ad.latest.title && c.ad.mock.msg1 && c.ad.mock.level, `${l}.ad`);
    const ui = JSON.parse(readFileSync(`messages/${l}.json`, 'utf8')).gifStudio.ui.module;
    for (const k of ['trio', 'link', 'battlepass', 'counting', 'statistics', 'themes']) assert.ok(ui[k], `${l}.ui.module.${k}`);
    const all = JSON.stringify(c);
    assert.ok(!/[—–]/.test(all), `${l} has a dash`);
    assert.ok(!new RegExp('[\\p{Extended_Pictographic}]', 'u').test(all), `${l} has a Unicode emoji`);
  }
});

test('every Wody emoji of the registry is a real file and every copy in the UI uses only registry names', () => {
  for (const [key, file] of Object.entries(icons.WODY_ICON_FILES)) assert.ok(existsSync(`public/emojis/wody/${file}.png`), `${key} -> ${file}.png`);
  assert.ok(readdirSync('public/emojis/wody').length >= 90);
  assert.equal(icons.wodyIconUrl('nope'), null);
});

test('real pipeline: a valid animated GIF is made, cached, versioned, published and served', { timeout: 180000 }, async () => {
  const db = fresh();
  const made = await call('POST', 'items', { body: { name: 'Passport showcase', kind: 'module', module: 'passport', config: SMALL } });
  assert.equal(made.status, 201);
  const id = made.body.item.id;
  const slug = made.body.item.slug;
  assert.match(slug, /^passport-showcase-[a-f0-9]{6}$/);
  assert.equal((await call('POST', `items/${id}/publish`, { body: {} })).body.error, 'not_generated');

  const gen = await call('POST', `items/${id}/generate`, { body: {} });
  assert.equal(gen.status, 202);
  assert.equal((await call('POST', `items/${id}/generate`, { body: {} })).body.error, 'already_generating');
  const done = await waitDone(id);
  assert.equal(done.status, 'ready', done.job?.error);
  assert.equal(done.version, 1);
  assert.ok(done.current.frames >= 10 && done.current.bytes < 3 * 1048576);

  const file = await call('GET', `items/${id}/file?v=1`);
  assert.equal(file.type, 'image/gif');
  const check = await media.validateGif(file.body);
  assert.equal(check.ok, true);
  assert.equal(check.animated, true);
  assert.equal(check.width, 320);
  assert.ok(check.duration_ms >= 3000);
  assert.equal(check.loop, 0, 'loops forever');
  const png = await call('GET', `items/${id}/file?v=1&kind=png`);
  assert.equal(png.type, 'image/png');

  // same config again: served from the cache, no new version
  const again = await call('POST', `items/${id}/generate`, { body: {} });
  assert.equal(again.status, 200);
  assert.equal(again.body.cached, true);
  assert.equal(again.body.item.versions.length, 1);

  const pub = await call('POST', `items/${id}/publish`, { body: {} });
  assert.equal(pub.body.item.status, 'published');
  assert.equal(pub.body.item.public_path, `/api/gif-preview/${slug}.gif`);
  const live = await publishedBySlug(db, slug);
  assert.equal(live.published_version, 1);
  const r = readiness(live, live.versions[0]);
  assert.equal(r.ok, true, JSON.stringify(r.checks.filter((c) => !c.ok)));
  assert.match(r.url, /^https:\/\/.+\/api\/gif-preview\/passport-showcase-[a-f0-9]{6}\.gif$/);
  assert.equal(r.url.includes('?'), false, 'the public address carries no expiring token');

  // the stored selection falls back when the GIF is archived
  await call('POST', `items/${id}/archive`, { body: {} });
  assert.equal(await publishedBySlug(db, slug), null);
});

test('auto optimization: a GIF above the target is reduced and a hopeless target fails with a clear error', { timeout: 180000 }, async () => {
  fresh();
  const cfg = { ...SMALL, custom: { ...SMALL.custom, width: 480, height: 252, colors: 256, maxMb: 1 } };
  const big = (await call('POST', 'items', { body: { name: 'Big', kind: 'module', module: 'collab', config: cfg } })).body.item;
  assert.ok(media.optimizationSteps({ colors: 256, fps: 10, width: 600, height: 315 }).every((s, i, a) => i === 0 || s.colors <= a[i - 1].colors));
  await call('POST', `items/${big.id}/generate`, { body: {} });
  const done = await waitDone(big.id);
  assert.ok(['ready', 'failed'].includes(done.status));
  if (done.status === 'ready') assert.ok(done.current.bytes <= 1048576);
  else assert.equal(done.job.error, 'gif_too_large');
});

test('cancel stops a running generation and the item goes back to its previous status', { timeout: 120000 }, async () => {
  fresh();
  const it = (await call('POST', 'items', { body: { name: 'Cancel me', kind: 'latest', config: { ...SMALL, kind: 'latest', timeline: { intro: { on: true, ms: 1500 }, latest: { on: true, ms: 4000 }, final: { on: true, ms: 1500 } } } } })).body.item;
  await call('POST', `items/${it.id}/generate`, { body: {} });
  assert.equal((await call('POST', `items/${it.id}/cancel`, { body: {} })).status, 200);
  const done = await waitDone(it.id);
  assert.equal(done.status, 'draft');
  assert.equal(done.versions.length, 0);
});

test('the API is owner only, checks the origin, refuses bad input and asks for confirmation before deleting', async () => {
  fresh();
  assert.equal((await call('GET', 'items', { user: null })).status, 401);
  assert.equal((await call('GET', 'items', { user: '999' })).status, 403);
  assert.equal((await call('POST', 'items', { body: { name: 'x', kind: 'module', module: 'profile' }, origin: 'https://evil.test' })).status, 403);
  assert.equal((await call('POST', 'items', { body: { name: 'Fire \u{1F525}', kind: 'module', module: 'profile' } })).body.error, 'emoji_not_allowed');
  assert.equal((await call('POST', 'items', { body: { name: 'x', kind: 'module', module: 'invented' } })).body.error, 'invalid_module');
  const it = (await call('POST', 'items', { body: { name: 'Profile', kind: 'module', module: 'profile' } })).body.item;
  const dup = await call('POST', `items/${it.id}/duplicate`, { body: {} });
  assert.equal(dup.status, 201);
  assert.notEqual(dup.body.item.slug, it.slug);
  assert.equal((await call('PATCH', `items/${it.id}`, { body: { config: { palette: 'custom', colors: { bg1: 'nope' } } } })).body.error, 'invalid_color');
  assert.equal((await call('POST', `items/${it.id}/publish`, { body: { schedule_at: '2020-01-01' } })).body.error, 'not_generated');
  assert.equal((await call('DELETE', `items/${it.id}`, { body: {} })).body.error, 'confirmation_required');
  assert.equal((await call('DELETE', `items/${it.id}`, { body: { confirm: true } })).status, 200);
  assert.equal((await call('GET', `items/${it.id}`)).status, 404);
  const meta = (await call('GET', 'meta')).body;
  assert.deepEqual(meta.modules, ['trio', 'profile', 'passport', 'collab', 'link', 'battlepass', 'counting', 'statistics', 'themes'], 'the ad and every real module exist');
  const frame = await call('POST', 'frame', { body: { config: { kind: 'module', module: 'collab', ...SMALL }, at: 900 } });
  assert.equal(frame.type, 'image/png');
});

test('the standard set is the homepage ad, every module and the latest features, created once', async () => {
  fresh();
  const a = await call('POST', 'items/seed', { body: {} });
  assert.equal(a.status, 201);
  assert.deepEqual(a.body.items.map((i) => i.module || i.kind), ['trio', 'profile', 'passport', 'collab', 'link', 'battlepass', 'counting', 'statistics', 'themes', 'latest']);
  assert.equal((await call('POST', 'items/seed', { body: {} })).body.items.length, 0, 'no duplicates');
  assert.equal((await call('POST', 'items/seed', { body: {}, user: '999' })).status, 403);
});

test('the public pages of the new modules point their link preview to the animated GIF address of that module', async () => {
  const seo = await import('../../lib/seo-social.js');
  assert.match(seo.moduleGifUrl('counting', 'ro'), /\/api\/gif-preview\/for\/counting\.ro\.gif$/);
  assert.equal(seo.moduleOgImages('themes', 'de')[0].type, 'image/gif');
  assert.ok(seo.moduleOgImages('themes', 'de').length > 1, 'the static image stays as a second candidate');
  for (const [file, mod] of [['lib/battlepass/seo.js', 'battlepass'], ['lib/battlepass/studio/seo.js', 'battlepass'], ['lib/counting/seo.js', 'counting'], ['lib/statistics/seo.js', 'statistics'], ['app/[locale]/themes/help/page.js', 'themes']]) {
    assert.ok(readFileSync(file, 'utf8').includes(`moduleOgImages('${mod}'`), `${file} uses the ${mod} GIF`);
  }
});

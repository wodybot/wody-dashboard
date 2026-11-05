// Dynamic Themes: validation, Owner lifecycle, asset rules, server isolation, Premium limits and fallbacks.
// The real lib/themes code runs on an in-memory database with stand-in session, Discord and Owner access.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import sharp from 'sharp';

const { state } = await import('../battlepass/stubs/state.mjs');
const { makeDb } = await import('../battlepass/fake-db.mjs');
const { OWNER_ID } = await import('../battlepass/stubs/owner-access.mjs');
const { handle } = await import('../../lib/themes/api.js');
const schema = await import('../../lib/themes/schema.js');
const { OFFICIAL, blankConfig } = await import('../../lib/themes/official.js');
const { buildRenderTheme, themeCssVars } = await import('../../lib/themes/render.js');
const store = await import('../../lib/themes/store.js');
const C = await import('../../lib/themes/constants.js');

const OWNER = OWNER_ID; const DELEGATE = '1000000000000000002'; const MANAGER1 = '2000000000000000001'; const MANAGER2 = '2000000000000000002';
const G1 = '4000000000000000001'; const G2 = '4000000000000000002';

function fresh() {
  state.db = makeDb(); state.session = null; state.delegates = new Set([DELEGATE]); state.blocked = new Set();
  state.guilds = [{ id: G1, owner: false, permissions: '32' }];
  store.resetIndexCache();
  return state.db;
}
async function call(method, path, { body, user, origin = 'https://wody.test', form } = {}) {
  state.session = user ? { user: { id: user, username: 'u' }, accessToken: 'token' } : null;
  if (user === MANAGER2) state.guilds = [{ id: G2, owner: false, permissions: '32' }]; else if (user === MANAGER1) state.guilds = [{ id: G1, owner: false, permissions: '32' }];
  const url = `https://wody.test/api/themes/${path}`;
  const request = new Request(url, { method, headers: form ? { origin } : { origin, 'content-type': 'application/json' }, body: form || (body ? JSON.stringify(body) : undefined) });
  const res = await handle({ request, db: state.db, parts: path.split('?')[0].split('/').filter(Boolean), method });
  return { status: res.status, body: await res.json() };
}
test('config: the official themes are valid, readable and effect-only; unsafe values are refused', () => {
  for (const [id, cfg] of Object.entries(OFFICIAL)) {
    const r = schema.normalizeThemeConfig(cfg, JSON.parse(JSON.stringify(cfg)));
    assert.equal(r.ok, true, `${id}: ${r.error} ${r.field}`);
    for (const p of cfg.presets) assert.equal(schema.paletteIssue({ ...cfg.palette, ...p }), null, `${id} preset ${p.id} contrast`);
    assert.ok(cfg.effects.every((e) => C.EFFECTS.includes(e.id)));
    assert.ok(C.SCENES.includes(cfg.environment.scene), `${id} scene`);
    assert.equal(cfg.character.asset, null, 'no characters, only effects');
  }
  assert.deepEqual(C.OFFICIAL_IDS, Object.keys(OFFICIAL));
  const base = blankConfig();
  const bad = (patch) => schema.normalizeThemeConfig(patch, base);
  assert.equal(bad({ palette: { text: 'red' } }).error, 'invalid_color');
  assert.equal(bad({ palette: { text: '#101010', bg: '#111111' } }).error, 'low_contrast');
  assert.equal(bad({ meta: { name: 'Fire \u{1F525}' } }).error, 'emoji_not_allowed');
  assert.equal(bad({ effects: [{ id: 'confetti_emoji', intensity: 10 }] }).error, 'invalid_choice');
  assert.equal(bad({ environment: { scene: 'miami', fog: 10, lighting: { color: 'url(javascript:1)', intensity: 5 } } }).error, 'invalid_color');
  const name = bad({ meta: { name: '<style>body{display:none}</style> Style', category: 'custom' } });
  assert.ok(!/[<>]/.test(name.config.meta.name), 'markup characters never survive in a name');
});

test('render: CSS variables carry only validated values, free servers get no Premium styling', () => {
  const snap = { id: 'wody_miami_neon', version: 1, config: OFFICIAL.wody_miami_neon, assets: {} };
  const server = { theme_id: 'wody_miami_neon', palette: { primary: '#22cc88', bg: '#101820' }, effects: { enabled: true, intensity: 50, items: { neon: 50 } }, premium: { banner: 'https://x.test/b.png', animation: 20, blocks: [{ type: 'text', title: 'Hi', text: 'Hello' }] } };
  const free = buildRenderTheme(snap, server, { premium: false });
  const prem = buildRenderTheme(snap, server, { premium: true });
  assert.equal(free.palette.primary, '#22cc88', 'basic colors apply to free servers');
  assert.equal(free.palette.bg, OFFICIAL.wody_miami_neon.palette.bg, 'premium colors do not');
  assert.equal(free.banner, null); assert.deepEqual(free.blocks, []);
  assert.equal(prem.palette.bg, '#101820'); assert.equal(prem.banner, 'https://x.test/b.png'); assert.equal(prem.blocks.length, 1);
  assert.equal(free.effects.find((e) => e.id === 'neon').intensity, Math.round(60 * 0.5 * 0.5));
  for (const t of [free, prem]) for (const [k, v] of Object.entries(themeCssVars(t))) {
    assert.ok(k.startsWith('--wt-'), k);
    assert.ok(!/[;<>{}]|url\(|expression|javascript/i.test(String(v)) || k === '--wt-font-heading' || k === '--wt-font-body', `${k}=${v}`);
  }
});

test('owner: only the Owner writes; delegates read; the official themes ship published and effect-only', async () => {
  const db = fresh();
  assert.equal((await call('GET', 'owner/themes')).status, 401);
  assert.equal((await call('POST', 'owner/themes', { user: MANAGER1, body: { id: 'my_theme', name: 'X' } })).status, 403);
  assert.equal((await call('POST', 'owner/themes', { user: DELEGATE, body: { id: 'my_theme', name: 'X' } })).status, 403);
  assert.equal((await call('POST', 'owner/themes', { user: OWNER, origin: 'https://evil.test', body: { id: 'my_theme', name: 'X' } })).status, 403);
  const list = await call('GET', 'owner/themes', { user: DELEGATE });
  assert.equal(list.status, 200);
  assert.equal(list.body.themes.filter((t) => t.official).length, C.OFFICIAL_IDS.length);
  assert.ok(list.body.themes.every((t) => t.status === 'published' && t.issues.length === 0), 'the official themes are complete and published');
  const full = (await call('GET', 'owner/themes/wody_miami_neon', { user: OWNER })).body.theme;
  assert.equal(full.draft.character.asset, null); assert.equal(full.draft.environment.scene, 'miami');
  const cat = (await call('GET', 'catalog', { user: MANAGER1 })).body.themes;
  assert.deepEqual(cat.map((t) => t.id).sort(), [...C.OFFICIAL_IDS].sort());
  assert.equal(await db.collection(C.THEME_COLL).countDocuments({}), C.OFFICIAL_IDS.length, 'seeding twice never duplicates');
});

test('legacy: servers that used a retired character theme move to the matching effect theme once', async () => {
  const db = fresh();
  await db.collection(C.THEME_COLL).insertOne({ id: 'wody_fire_dragon', official: true, status: 'published' });
  await db.collection(C.GUILD_COLL).insertOne({ guild_id: G1, draft: { theme_id: 'wody_fire_dragon', preset: 'crimson', effects: { items: { embers: 40 } } }, published: { theme_id: 'wody_fire_dragon', preset: 'crimson', effects: { items: { embers: 40 } } } });
  await store.seedOfficial(db);
  assert.equal(await db.collection(C.THEME_COLL).findOne({ id: 'wody_fire_dragon' }), null, 'the retired theme is gone');
  const g = await db.collection(C.GUILD_COLL).findOne({ guild_id: G1 });
  assert.equal(g.draft.theme_id, 'wody_miami_neon'); assert.equal(g.published.theme_id, 'wody_miami_neon');
  assert.deepEqual(g.draft.effects.items, {}, 'old effect choices no longer apply to the new theme');
});

test('owner: the publish lifecycle (edit, publish, duplicate, disable, schedule, archive) is audited', async () => {
  fresh();
  await call('GET', 'owner/themes', { user: OWNER });
  const ed = await call('PATCH', 'owner/themes/wody_miami_neon', { user: OWNER, body: { config: { palette: { primary: '#00aa55' } } } });
  assert.equal(ed.status, 200, JSON.stringify(ed.body));
  assert.deepEqual(ed.body.theme.issues, []);
  // editing the draft does not change what servers get
  assert.equal((await call('GET', 'catalog', { user: MANAGER1 })).body.themes.find((t) => t.id === 'wody_miami_neon').palette.primary, OFFICIAL.wody_miami_neon.palette.primary);
  const pub = await call('POST', 'owner/themes/wody_miami_neon/publish', { user: OWNER, body: { note: 'recolor' } });
  assert.equal(pub.body.theme.status, 'published'); assert.equal(pub.body.theme.version, 2, 'the official release was v1');
  assert.equal((await call('GET', 'catalog', { user: MANAGER1 })).body.themes.find((t) => t.id === 'wody_miami_neon').palette.primary, '#00aa55');

  const copy = await call('POST', 'owner/themes/wody_miami_neon/duplicate', { user: OWNER, body: { id: 'neon_winter' } });
  assert.equal(copy.status, 201); assert.equal(copy.body.theme.status, 'draft'); assert.equal(copy.body.theme.official, false);
  assert.equal((await call('POST', 'owner/themes/wody_miami_neon/disable', { user: OWNER })).body.theme.status, 'disabled');
  assert.equal((await call('GET', 'catalog', { user: MANAGER1 })).body.themes.length, C.OFFICIAL_IDS.length - 1);
  assert.equal((await call('POST', 'owner/themes/wody_miami_neon/enable', { user: OWNER })).body.theme.status, 'published');
  assert.equal((await call('POST', 'owner/themes/wody_miami_neon/restore', { user: OWNER, body: { version: 7 } })).body.error, 'version_not_found');
  assert.equal((await call('POST', 'owner/themes/wody_miami_neon/restore', { user: OWNER, body: { version: 1 } })).status, 200);

  const soon = new Date(Date.now() + 3600000).toISOString(); const later = new Date(Date.now() + 7200000).toISOString();
  const sch = await call('POST', 'owner/themes/wody_miami_neon/schedule', { user: OWNER, body: { start: soon, end: later } });
  assert.equal(sch.body.theme.status, 'scheduled'); assert.equal(sch.body.theme.availability, 'upcoming');
  assert.equal((await call('POST', 'owner/themes/wody_miami_neon/schedule', { user: OWNER, body: { start: later, end: soon } })).body.error, 'invalid_schedule');
  const doc = await store.getTheme(state.db, 'wody_miami_neon');
  assert.equal(store.availability(doc, new Date(Date.now() + 5400000)), 'available');
  assert.equal(store.availability(doc, new Date(Date.now() + 9000000)), 'ended');

  assert.equal((await call('POST', 'owner/themes/neon_winter/archive', { user: OWNER })).body.theme.status, 'archived');
  assert.equal((await call('PATCH', 'owner/themes/neon_winter', { user: OWNER, body: { config: { meta: { name: 'x' } } } })).body.error, 'theme_archived');
  const actions = (await call('GET', 'owner/audit', { user: OWNER })).body.entries.map((a) => a.action);
  for (const a of ['edit', 'publish', 'duplicate', 'disable', 'schedule', 'archive']) assert.ok(actions.includes(a), `audit has ${a}`);
});

test('servers: isolation, Premium limits, drafts vs published, fallback and lapsed Premium', async () => {
  const db = fresh();
  await call('GET', 'owner/themes', { user: OWNER });
  state.guilds = [{ id: G1, owner: false, permissions: '32' }];
  assert.equal((await call('GET', `guild/${G2}`, { user: MANAGER1 })).status, 403, 'a manager of one server cannot open another');
  assert.equal((await call('PUT', `guild/${G2}`, { user: MANAGER1, body: { config: { theme_id: 'wody_miami_neon' } } })).status, 403);
  assert.equal((await call('GET', `guild/${G1}`)).status, 401);

  // themes are a Premium feature: a free server can neither save nor publish, and its pages keep the standard look
  const save = (user, gid, config) => call('PUT', `guild/${gid}`, { user, body: { config } });
  assert.equal((await save(MANAGER1, G1, { theme_id: 'wody_miami_neon' })).body.error, 'premium_required');
  assert.equal((await call('POST', `guild/${G1}/publish`, { user: MANAGER1 })).body.error, 'premium_required');
  assert.equal((await call('GET', `resolve/${G1}`)).body.theme, null);
  await db.collection('premium_servers').insertOne({ guild_id: BigInt(G1), active: true });
  assert.equal((await save(MANAGER1, G1, { theme_id: 'nope_theme' })).body.error, 'theme_unavailable');
  await call('POST', 'owner/themes/wody_cosmos/disable', { user: OWNER });
  assert.equal((await save(MANAGER1, G1, { theme_id: 'wody_cosmos' })).body.error, 'theme_unavailable', 'disabled themes cannot be chosen');
  const ok = await save(MANAGER1, G1, { theme_id: 'wody_miami_neon', preset: 'teal_wave', palette: { accent: '#ffd36b' }, effects: { enabled: true, intensity: 60, items: { neon: 40 } } });
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  assert.equal((await save(MANAGER1, G1, { effects: { enabled: true, intensity: 100, items: { rain: 10 } } })).body.error, 'invalid_choice', 'only the effects of the chosen theme');
  assert.equal((await save(MANAGER1, G1, { palette: { primary: '#101010', accent: '#111111' } })).body.error, 'low_contrast');
  assert.equal((await save(MANAGER1, G1, { components: { card_style: 'script' } })).body.error, 'invalid_choice');

  // the visitor sees nothing until the draft is published
  assert.equal((await call('GET', `resolve/${G1}`)).body.theme, null);
  const pub = await call('POST', `guild/${G1}/publish`, { user: MANAGER1 });
  assert.equal(pub.status, 200);
  const seen = (await call('GET', `resolve/${G1}`)).body.theme;
  assert.equal(seen.id, 'wody_miami_neon'); assert.equal(seen.palette.accent, '#ffd36b'); assert.equal(seen.environment.scene, 'miami');
  assert.equal((await call('GET', `resolve/${G2}`)).body.theme, null, 'another server is unaffected');
  assert.equal((await call('GET', 'resolve/abc')).status, 400);

  // Premium server: advanced fields allowed, and kept when Premium lapses but not applied
  state.guilds = [{ id: G2, owner: false, permissions: '32' }];
  await db.collection('premium_servers').insertOne({ guild_id: BigInt(G2), active: true });
  const adv = await save(MANAGER2, G2, { theme_id: 'wody_aurora', palette: { bg: '#06101c' }, premium: { banner: 'https://x.test/banner.png', glass: 70, blur: 16, particle_density: 40, movement: 'slow', blocks: [{ type: 'text', title: 'Rules', text: 'Be kind.' }], character: { enabled: true, position: 'left', scale: 110 } } });
  assert.equal(adv.status, 200, JSON.stringify(adv.body));
  assert.equal((await save(MANAGER2, G2, { premium: { blocks: [{ type: 'button', title: 'x', label: 'Go', url: 'javascript:alert(1)' }] } })).body.error, 'invalid_url');
  assert.equal((await save(MANAGER2, G2, { premium: { blocks: Array(4).fill({ type: 'text', title: 't', text: 'x' }) } })).body.error, 'too_many');
  assert.equal((await save(MANAGER2, G2, { palette: { text: '#0a1220' } })).body.error, 'low_contrast');
  await call('POST', `guild/${G2}/publish`, { user: MANAGER2 });
  store.forgetGuild(G2);
  let t2 = (await call('GET', `resolve/${G2}`)).body.theme;
  assert.equal(t2.banner, 'https://x.test/banner.png'); assert.equal(t2.blocks.length, 1); assert.equal(t2.palette.bg, '#06101c');
  await db.collection('premium_servers').updateOne({ guild_id: BigInt(G2) }, { $set: { active: false } });
  store.forgetGuild(G2);
  t2 = (await call('GET', `resolve/${G2}`)).body.theme;
  assert.equal(t2, null, 'a lapsed Premium shows the standard look');
  const kept = (await call('GET', `guild/${G2}`, { user: MANAGER2 })).body.server.draft;
  assert.equal(kept.premium.banner, 'https://x.test/banner.png', 'the Premium settings are kept, not reset');

  // the Owner disables the theme: the server falls back to the standard look and keeps its configuration
  await call('POST', 'owner/themes/wody_miami_neon/disable', { user: OWNER });
  store.forgetGuild(G1);
  assert.equal((await call('GET', `resolve/${G1}`)).body.theme, null);
  assert.equal((await call('GET', `guild/${G1}`, { user: MANAGER1 })).body.server.draft.theme_id, 'wody_miami_neon');
  await call('POST', 'owner/themes/wody_miami_neon/enable', { user: OWNER });
  store.forgetGuild(G1);
  assert.equal((await call('GET', `resolve/${G1}`)).body.theme.id, 'wody_miami_neon');

  // reset removes the server's own configuration only
  assert.equal((await call('POST', `guild/${G1}/reset`, { user: MANAGER1 })).status, 200);
  store.forgetGuild(G1);
  assert.equal((await call('GET', `resolve/${G1}`)).body.theme, null);
  assert.ok(await db.collection(C.GUILD_COLL).findOne({ guild_id: G2 }), 'resetting one server leaves the others');
});

test('new theme files contain no Unicode emoji, no dashes, and the official themes carry no particle emoji', () => {
  const files = ['lib/themes/constants.js', 'lib/themes/official.js', 'lib/themes/schema.js', 'lib/themes/render.js', 'lib/themes/store.js', 'lib/themes/api.js'];
  const pict = /[←-⇿☀-➿⬀-⯿\u{1F000}-\u{1FAFF}]/u;
  for (const f of files) assert.ok(!pict.test(readFileSync(new URL(`../../${f}`, import.meta.url), 'utf8')), `${f} has a Unicode pictograph`);
});

test('premium logo: checked, resized, cleaned, only for Premium servers, shown after publishing and hidden when Premium lapses', async () => {
  const db = fresh();
  await call('GET', 'owner/themes', { user: OWNER });
  state.guilds = [{ id: G1, owner: false, permissions: '32' }, { id: G2, owner: false, permissions: '32' }];
  const logo = (buf, name = 'logo.png', type = 'image/png') => { const f = new FormData(); f.set('file', new File([buf], name, { type })); return f; };
  const big = await sharp({ create: { width: 900, height: 600, channels: 4, background: { r: 20, g: 120, b: 200, alpha: 1 } } }).png().toBuffer();
  assert.equal((await call('POST', `guild/${G1}/logo`, { user: MANAGER1, form: logo(big) })).status, 402, 'a free server cannot upload a logo');
  await db.collection('premium_servers').insertOne({ guild_id: BigInt(G2), active: true });
  assert.equal((await call('POST', `guild/${G2}/logo`, { user: MANAGER2, form: logo(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>1</script></svg>'), 'x.svg', 'image/svg+xml') })).body.error, 'asset_format');
  assert.equal((await call('POST', `guild/${G2}/logo`, { user: MANAGER2, form: logo(await sharp({ create: { width: 32, height: 32, channels: 3, background: '#fff' } }).png().toBuffer()) })).body.error, 'asset_too_small');
  assert.equal((await call('POST', `guild/${G1}/logo`, { user: MANAGER2, form: logo(big) })).status, 403, 'a manager of another server cannot use it');
  const up = await call('POST', `guild/${G2}/logo`, { user: MANAGER2, form: logo(big) });
  assert.equal(up.status, 200, JSON.stringify(up.body));
  const url = up.body.server.draft.premium.logo;
  assert.match(url, /^\/api\/site-image\/[a-f0-9]{24}$/);
  const stored = await db.collection('site_images').findOne({ mime: 'image/webp' });
  assert.ok(stored && stored.w === 512 && stored.h === 341, 'resized to fit 512 and re-encoded');
  await call('PUT', `guild/${G2}`, { user: MANAGER2, body: { config: { theme_id: 'wody_miami_neon' } } });
  assert.equal((await call('POST', `guild/${G2}/publish`, { user: MANAGER2 })).status, 200);
  store.forgetGuild(G2);
  assert.equal((await call('GET', `resolve/${G2}`)).body.theme.logo, url);
  assert.equal((await call('PUT', `guild/${G2}`, { user: MANAGER2, body: { config: { premium: { logo: 'https://evil.test/x.png' } } } })).body.error, 'invalid_url');
  await db.collection('premium_servers').updateOne({ guild_id: BigInt(G2) }, { $set: { active: false } });
  store.forgetGuild(G2);
  assert.equal((await call('GET', `resolve/${G2}`)).body.theme, null, 'a lapsed Premium keeps the file but shows the standard look');
});

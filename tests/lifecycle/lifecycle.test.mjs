// Expiry and renewal rules for Collab (30 days) and server listings (6 months), plus the alert sent to the bot owner.
import test from 'node:test';
import { ObjectId as OID } from 'mongodb';
import assert from 'node:assert/strict';

const { state } = await import('../battlepass/stubs/state.mjs');
const { makeDb } = await import('../battlepass/fake-db.mjs');
const { OWNER_ID } = await import('../battlepass/stubs/owner-access.mjs');
const community = await import('../../lib/community/lifecycle.js');
const { C } = await import('../../lib/community/db.js');
const collab = await import('../../lib/collab/lifecycle.js');
const collabNotify = await import('../../lib/collab/notify.js');
const { M } = await import('../../lib/collab/db.js');
const { STATUS, LIFETIME_DAYS, RENEW_WINDOW_DAYS } = await import('../../lib/collab/constants.js');

const DAY = 86_400_000;
const sent = [];
community.setDmSender(async (to, payload) => { sent.push({ to, payload }); });
collabNotify.setDmSender(async (to, payload) => { sent.push({ to, payload }); });

function listing(over = {}) {
  return { _id: new OID(), guild_id: 1n, slug: 'demo', status: 'published', owner_id: 5n, content: { name: 'Demo' }, live: { name: 'Demo', description: 'x'.repeat(30), category: 'gaming' }, version: 1, ...over };
}

test('addMonths keeps the day and stops at the end of short months', () => {
  assert.equal(community.addMonths(new Date('2026-01-31T10:00:00Z'), 6).toISOString(), '2026-07-31T10:00:00.000Z');
  assert.equal(community.addMonths(new Date('2026-08-31T10:00:00Z'), 6).toISOString(), '2027-02-28T10:00:00.000Z');
});

test('renewState: only the last 7 days of a live listing, or an expired one, can be renewed', () => {
  const now = new Date('2026-06-01T00:00:00Z');
  const at = (days) => new Date(now.getTime() + days * DAY);
  assert.equal(community.renewState({ status: 'published', expires_at: at(30) }, now).can_renew, false);
  assert.equal(community.renewState({ status: 'published', expires_at: at(6.9) }, now).can_renew, true);
  assert.equal(community.renewState({ status: 'unpublished', expired_at: now }, now).can_renew, true);
  assert.equal(community.renewState({ status: 'unpublished' }, now).can_renew, false);   // taken off by the team
  assert.equal(community.renewState({ status: 'suspended', expired_at: now }, now).can_renew, false);
});

test('server sweep: warns 7 days before once, expires on time, and a renewal puts it back online', async () => {
  const db = state.db = makeDb(); sent.length = 0;
  const now = new Date();
  const soon = listing({ expires_at: new Date(now.getTime() + 5 * DAY) });
  const later = listing({ slug: 'later', expires_at: new Date(now.getTime() + 60 * DAY) });
  const old = listing({ slug: 'old', expires_at: new Date(now.getTime() - DAY) });
  const legacy = listing({ slug: 'legacy' });                                       // published before expiry existed
  await db.collection(C.listings).insertMany([soon, later, old, legacy]);
  const first = await community.sweepListings(db, { force: true, now });
  assert.deepEqual(first, { expired: 1, warned: 1 });
  const again = await community.sweepListings(db, { force: true, now });
  assert.deepEqual(again, { expired: 0, warned: 0 });                                // no second warning
  const dms = sent.map((m) => JSON.stringify(m.payload));
  assert.equal(sent.length, 2);
  assert.ok(dms.some((d) => d.includes('expires soon')));
  assert.ok(dms.some((d) => d.includes('expired')));
  const gone = await db.collection(C.listings).findOne({ slug: 'old' });
  assert.equal(gone.status, 'unpublished');
  assert.ok(gone.expired_at);
  assert.ok((await db.collection(C.listings).findOne({ slug: 'legacy' })).expires_at > now);
  assert.equal((await db.collection(C.listings).findOne({ slug: 'later' })).status, 'published');
  const owners = await db.collection(C.notifications).find({ to: '5', type: { $in: ['expiring', 'expired'] } }).toArray();
  assert.equal(owners.length, 2);

  const back = await community.renewListing(db, gone, 5n);
  assert.equal(back.status, 'published');
  assert.equal(back.expired_at, undefined);
  assert.ok(back.expires_at.getTime() > Date.now() + 150 * DAY);
  const stillLive = await db.collection(C.listings).findOne({ slug: 'later' });
  await assert.rejects(() => community.renewListing(db, stillLive, 5n), { code: 'renew_too_early' });
});

test('a listing taken off by the team cannot be renewed back online', async () => {
  const db = state.db = makeDb();
  const l = listing({ status: 'unpublished' });
  await db.collection(C.listings).insertOne(l);
  await assert.rejects(() => community.renewListing(db, l, 5n), { code: 'invalid_state' });
});

test('bot owner is told about a server sent for review, on the bell and by DM', async () => {
  const db = state.db = makeDb(); sent.length = 0;
  const l = listing({ status: 'pending_review', stats: { member_count: 1234 } });
  await community.notifyBotOwner(db, l, 'new_submission');
  const bell = await db.collection('user_notifications').find({ to: String(OWNER_ID) }).toArray();
  assert.equal(bell.length, 1);
  assert.equal(bell[0].type, 'server_submitted');
  assert.equal(bell[0].dedupe, `server_submitted:${String(l._id)}:1`);   // one entry per submitted version
  assert.equal(bell[0].params.name, 'Demo');
  assert.ok(sent.every((m) => m.to === String(OWNER_ID)));
  assert.match(JSON.stringify(sent[0].payload), /New server waiting for review/);
});

test('a failing DM never breaks the submission', async () => {
  const db = state.db = makeDb();
  community.setDmSender(async () => { throw new Error('closed dm'); });
  await community.notifyBotOwner(db, listing(), 'new_submission');
  community.setDmSender(async (to, payload) => { sent.push({ to, payload }); });
});

test('collab: 30 day lifetime, warning 7 days before, renewal only in that window', async () => {
  assert.equal(LIFETIME_DAYS, 30);
  assert.equal(RENEW_WINDOW_DAYS, 7);
  const db = state.db = makeDb(); sent.length = 0;
  const now = Date.now();
  const mk = (title, over) => ({ _id: new OID(), author_id: '77', status: STATUS.PUBLISHED, content: { title }, live: { title }, card: { title }, ...over });
  const soon = mk('Soon', { expires_at: new Date(now + 5 * DAY) });
  const far = mk('Far', { expires_at: new Date(now + 20 * DAY) });
  await db.collection(M.requests).insertMany([soon, far]);
  await collab.sweepExpired(db, { force: true });
  const warned = await db.collection(M.notifications).find({ to: '77', type: 'expiring_soon' }).toArray();
  assert.equal(warned.length, 1);
  assert.equal(warned[0].params.title, 'Soon');
  assert.ok(sent.some((m) => JSON.stringify(m.payload).includes('expires in 5 days')));
  await collab.sweepExpired(db, { force: true });
  assert.equal((await db.collection(M.notifications).find({ type: 'expiring_soon' }).toArray()).length, 1);

  await assert.rejects(() => collab.renewRequest(db, { id: '77' }, String(far._id)), { code: 'renew_too_early' });
  await collab.renewRequest(db, { id: '77' }, String(soon._id));
  const renewed = await db.collection(M.requests).findOne({ _id: soon._id });
  assert.ok(renewed.expires_at.getTime() > now + 29 * DAY);
});

test('collab: expired requests are hidden, then deleted with their data once the grace days pass', async () => {
  const db = state.db = makeDb(); sent.length = 0;
  const now = Date.now();
  const mk = (title, over) => ({ _id: new OID(), author_id: '88', status: STATUS.PUBLISHED, content: { title, description: 'private text' }, live: { title }, card: { title, summary: 'private text' }, ...over });
  const fresh = mk('Fresh', { expires_at: new Date(now - DAY) });
  const stale = mk('Stale', { status: STATUS.EXPIRED, expired_at: new Date(now - 8 * DAY), expires_at: new Date(now - 9 * DAY) });
  await db.collection(M.requests).insertMany([fresh, stale]);
  for (const r of [fresh, stale]) {
    await db.collection(M.files).insertOne({ request_id: r._id, name: 'a.png' });
    await db.collection(M.versions).insertOne({ request_id: r._id, n: 1 });
    await db.collection(M.checks).insertOne({ request_id: r._id });
    await db.collection(M.reports).insertOne({ request_id: r._id, status: 'open' });
    await db.collection(M.applications).insertOne({ request_id: r._id, status: 'sent' });
  }
  await collab.sweepExpired(db, { force: true });
  const a = await db.collection(M.requests).findOne({ _id: fresh._id });
  assert.equal(a.status, STATUS.EXPIRED);                                              // hidden, still renewable
  assert.equal(await db.collection(M.files).findOne({ request_id: fresh._id }) !== null, true);
  const b = await db.collection(M.requests).findOne({ _id: stale._id });
  assert.equal(b.status, STATUS.DELETED);
  assert.deepEqual(b.content, { title: 'Stale' });
  assert.equal(b.live, null);
  for (const col of [M.files, M.versions, M.checks, M.reports]) assert.equal(await db.collection(col).findOne({ request_id: stale._id }), null, col);
  assert.equal((await db.collection(M.applications).findOne({ request_id: stale._id })).status, 'declined');
  assert.ok(sent.some((m) => JSON.stringify(m.payload).includes('deleted automatically')));
  assert.ok(sent.some((m) => JSON.stringify(m.payload).includes('has expired')));
});

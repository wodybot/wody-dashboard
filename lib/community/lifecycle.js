import { ObjectId } from 'mongodb';
import { toLong } from '@/lib/mongo';
import { C, currentPrefix, loadPrefix } from './db.js';
import { clearDiscoveryCache } from './query.js';
import { SUBMITTABLE, CHANGE_AREAS, REJECT_REASONS, CHECKLIST_ITEMS, LIMITS } from './constants.js';
import { emptyContent, completion, diffContent, validSlug, slugify } from './validation.js';
import { RESERVED_SLUGS, TERMS_VERSION, LISTING_LIFETIME_MONTHS, RENEW_WINDOW_DAYS } from './constants.js';
import { OWNER_ID } from '@/lib/owner-access';
import { pushNotification } from '@/lib/notifications/index.js';

export function nameKey(name) {
  return String(name || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

export class CommunityError extends Error {
  constructor(code, status = 400, extra = {}) { super(code); this.code = code; this.status = status; this.extra = extra; }
}

let dmSender = async (userId, payload) => {
  const { sendDirectMessage } = await import('@/lib/discord');
  return sendDirectMessage(userId, payload);
};
export function setDmSender(fn) { dmSender = fn; }

let channelSender = async (channelId, payload) => {
  const { sendGuildMessage } = await import('@/lib/discord');
  return sendGuildMessage(channelId, payload);
};
export function setChannelSender(fn) { channelSender = fn; }
const REVIEW_LOG_CHANNEL = () => {
  const v = String(process.env.COMMUNITY_REVIEW_LOG_CHANNEL_ID ?? '').trim();
  return /^\d{17,20}$/.test(v) ? v : null;
};
const WODY_EMOJI = () => '{wy:wody}';
// Only Wody application emoji: the {wy:name} tokens are turned into them when the message is sent.
const BTN_HOME_EMOJI = () => ({ name: '{wy:home}' });
const BTN_JOIN_EMOJI = () => ({ name: '{wy:join}' });
const BTN_DASH_EMOJI = () => ({ name: '{wy:dashboard_globe}' });

const SITE = () => (process.env.NEXT_PUBLIC_BASE_URL || 'https://wody.online').replace(/\/+$/, '');

const DAY_MS = 86_400_000;
export function addMonths(date, n) {
  const d = new Date(date);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + n);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return d;
}
export const nextExpiry = (from = new Date()) => addMonths(from, LISTING_LIFETIME_MONTHS);

export function oid(id) {
  if (id instanceof ObjectId) return id;
  if (!/^[a-f0-9]{24}$/.test(String(id || ''))) return null;
  return new ObjectId(String(id));
}

export function computeScore(listing) {
  const live = listing.live || {};
  const members = listing.stats?.member_count || 0;
  const rating = listing.counters?.reviews ? (listing.counters.rating_sum / listing.counters.reviews) : 0;
  const weight = Math.min(listing.counters?.reviews || 0, 10) / 10;
  const badges = listing.badges || [];
  const uniques = listing.counters?.uniques_30d || 0;
  return Math.round((
    (badges.includes('verified') ? 100 : 0) + (badges.includes('established') ? 30 : 0) + (badges.includes('partner') ? 40 : 0)
    + 15 * Math.log10(members + 1) + 8 * rating * weight + 5 * Math.log10(uniques + 1) + 5 * Math.log10((listing.counters?.favorites || 0) + 1)
    + (live.banner_id ? 2 : 0)
  ) * 100) / 100;
}

export function derivePub(listing) {
  const c = listing.live;
  if (!c) return null;
  const text = [c.name, c.short_description, c.description.slice(0, 600), c.category, c.subcategory, ...(c.tags || []), ...(c.languages || []), c.server_type]
    .filter(Boolean).join(' ').toLowerCase();
  return {
    category: c.category, subcategory: c.subcategory || '', tags: c.tags || [], languages: c.languages || [], server_type: c.server_type,
    features: c.features || [], search_text: text, name_lower: c.name.toLowerCase(), score: computeScore(listing),
  };
}

export async function addTimeline(db, listing, type, { actor = null, kind = 'system', reason = null, message = null, meta = null, ownerVisible = true } = {}) {
  const doc = {
    listing_id: listing._id, at: new Date(), type, actor_id: actor ? toLong(actor) : null, actor_kind: kind,
    reason, message, meta, owner_visible: ownerVisible, version: listing.version || 0,
  };
  await db.collection(C.timeline).insertOne(doc);
  return doc;
}

export async function addAudit(db, { admin, action, listing = null, target = null, reason = null, old = null, next = null }) {
  await db.collection(C.audit).insertOne({
    at: new Date(), admin_id: admin ? toLong(admin) : null, action, target: target || (listing ? String(listing._id) : null),
    target_slug: listing?.slug || null, target_name: listing?.content?.name || null, reason, old, new: next,
  });
}

async function managerRecipients(db, listing, perm) {
  const ids = new Set([String(listing.owner_id)]);
  const rows = await db.collection(C.managers).find({ listing_id: listing._id }).toArray();
  for (const r of rows) if (!perm || (r.permissions || []).includes(perm)) ids.add(String(r.user_id));
  return [...ids];
}

export async function notifyOwners(db, listing, type, params = {}, { dm = false } = {}) {
  const ids = await managerRecipients(db, listing, 'submit');
  const now = new Date();
  await db.collection(C.notifications).insertMany(
    ids.map((id) => ({ to: String(id), type, listing_id: listing._id, slug: listing.slug, name: listing.content?.name || '', params, created_at: now, read: false })),
  );
  if (dm) {
    try {
      await loadPrefix(db).catch(() => {});
      await dmSender(String(listing.owner_id), dmPayload(type, listing, params));
    } catch { }
  }
}

const LOG_COPY = {
  approved_live: { icon: '{wy:success}', title: 'Server approved', color: 0x57F287, line: (n) => `**${n}** was approved and is now live on Wody Community Discovery.` },
  update_approved: { icon: '{wy:edit}', title: 'Listing update approved', color: 0x57F287, line: (n) => `The changes to **${n}** were approved and are now live.` },
  approved: { icon: '{wy:success}', title: 'Server approved', color: 0x57F287, line: (n) => `**${n}** was approved and is ready to be published.` },
  published: { icon: '{wy:language}', title: 'Server published', color: 0x57F287, line: (n) => `**${n}** is now public on Wody Community Discovery.` },
  changes_requested: { icon: '{wy:edit}', title: 'Changes requested', color: 0xFEE75C, line: (n) => `The Wody team asked the owner of **${n}** for a few changes before approval.` },
  rejected: { icon: '{wy:ban}', title: 'Server rejected', color: 0xED4245, line: (n) => `**${n}** was not approved for Wody Community Discovery.` },
  update_rejected: { icon: '{wy:ban}', title: 'Listing update rejected', color: 0xED4245, line: (n) => `The changes to **${n}** were not approved. The current public version stays online.` },
  suspended: { icon: '{wy:ban}', title: 'Server suspended', color: 0xED4245, line: (n) => `**${n}** was suspended and is hidden from Wody Community Discovery.` },
  unpublished: { icon: '{wy:offline}', title: 'Server unpublished', color: 0xC46A2D, line: (n) => `**${n}** was taken off Wody Community Discovery.` },
  expired: { icon: '{wy:offline}', title: 'Listing expired', color: 0xC46A2D, line: (n) => `**${n}** was not renewed after 6 months and was taken off Wody Community Discovery.` },
};

export function reviewLogPayload(type, listing, params = {}, { admin = null, categoryName = '' } = {}) {
  const copy = LOG_COPY[type];
  if (!copy) return null;
  const content = listing.live || listing.content || {};
  const name = clip(content.name || listing.slug || 'Server', 100);
  const isPublic = listing.status === 'published' && listing.slug;
  const now = Math.floor(Date.now() / 1000);
  const children = [];
  const T = (text) => children.push({ type: 10, content: text });
  const sep = (big = false) => children.push({ type: 14, divider: true, spacing: big ? 2 : 1 });

  const header = `-# ${WODY_EMOJI()} Wody Community Discovery\n## ${copy.icon} ${copy.title}\n${copy.line(name)}`;
  const iconHash = listing.stats?.icon_hash;
  const icon = iconHash ? `https://cdn.discordapp.com/icons/${String(listing.guild_id)}/${iconHash}.${String(iconHash).startsWith('a_') ? 'gif' : 'png'}?size=256` : null;
  children.push(icon
    ? { type: 9, components: [{ type: 10, content: header }], accessory: { type: 11, media: { url: icon }, description: name } }
    : { type: 10, content: header });
  if (isPublic && content.banner_id) {
    children.push({ type: 12, items: [{ media: { url: `${SITE()}/api/community/img/${String(content.banner_id)}` }, description: `${name} banner` }] });
  }
  sep();
  const members = typeof listing.stats?.member_count === 'number' ? new Intl.NumberFormat('en').format(listing.stats.member_count) : null;
  const factLines = [
    `**Server** ${name} · \`${String(listing.guild_id)}\``,
    [categoryName ? `**Category** ${clip(categoryName, 60)}` : null, members ? `**Members** ${members}` : null].filter(Boolean).join(' · '),
    [admin ? `**Reviewed by** <@${String(admin)}>` : null, `**When** <t:${now}:f>`].filter(Boolean).join(' · '),
  ].filter(Boolean);
  T(factLines.join('\n'));
  const details = [];
  if ((type === 'rejected' || type === 'update_rejected') && params.reason) details.push(`**Reason**\n${REJECT_LABELS[params.reason] || params.reason}`);
  if (type === 'changes_requested' && Array.isArray(params.fields) && params.fields.length) {
    details.push(`**What to change**\n${params.fields.map((f) => `• ${AREA_LABELS[f] || f}`).join('\n')}`);
  }
  if (params.message) {
    const label = ['suspended', 'unpublished', 'changes_requested'].includes(type) ? 'Reason' : (type.includes('rejected') ? 'Reviewer note' : 'Note from the reviewer');
    details.push(`**${label}**\n${quote(params.message)}`);
  }
  if (details.length) { sep(); T(details.join('\n')); }
  sep(true);
  const buttons = [];
  if (isPublic) {
    buttons.push({ type: 2, style: 5, label: 'View community page', emoji: BTN_HOME_EMOJI(), url: `${SITE()}/${currentPrefix() || 'server'}/${listing.slug}` });
    if (listing.live?.invite_code && listing.invite_status !== 'invalid') buttons.push({ type: 2, style: 5, label: 'Join server', emoji: BTN_JOIN_EMOJI(), url: `${SITE()}/api/community/join/${listing.slug}` });
  }
  buttons.push({ type: 2, style: 5, label: 'Open in review panel', emoji: BTN_DASH_EMOJI(), url: `${SITE()}/dashboard/panel` });
  if (!isPublic) buttons.push({ type: 2, style: 5, label: 'Community Guidelines', emoji: { name: '{wy:docs}' }, url: `${SITE()}/servers/guidelines` });
  children.push({ type: 1, components: buttons.slice(0, 5) });
  T(`-# Wody Community Discovery · <t:${now}:R>`);
  return {
    flags: (1 << 15) | (1 << 2),
    allowed_mentions: { parse: [] },
    components: [{ type: 17, accent_color: copy.color, components: children }],
  };
}

export async function announceDecision(db, listing, type, params = {}, admin = null) {
  clearDiscoveryCache();
  const channel = REVIEW_LOG_CHANNEL();
  if (!channel) return;
  try {
    await loadPrefix(db).catch(() => {});
    const slug = (listing.live || listing.content || {}).category;
    const cat = slug ? await db.collection(C.categories).findOne({ slug }, { projection: { names: 1, slug: 1 } }).catch(() => null) : null;
    const categoryName = cat?.names?.en || (slug ? String(slug).split('.').pop().replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase()) : '');
    const payload = reviewLogPayload(type, listing, params, { admin, categoryName });
    if (payload) await channelSender(channel, payload);
  } catch (e) {
    console.error('Community review log post failed', e?.message || e);
  }
}

const DM_COLORS = { success: 0x57F287, warn: 0xFEE75C, error: 0xED4245, info: 0xC46A2D };
const DM_COPY = {
  approved: { emoji: '{wy:success}', title: 'Your listing was approved', color: 'success',
    text: (n) => `Good news! The Wody team approved **${n}** for Community Discovery.` },
  approved_live: { emoji: '{wy:giveaway}', title: 'Your listing is approved and live', color: 'success',
    text: (n) => `Good news! The Wody team approved **${n}** and it is now public on Community Discovery.` },
  published: { emoji: '{wy:language}', title: 'Your listing is now public', color: 'success',
    text: (n) => `**${n}** is now visible to everyone on Community Discovery.` },
  changes_requested: { emoji: '{wy:edit}', title: 'Changes requested', color: 'warn',
    text: (n) => `The Wody team reviewed **${n}** and needs a few changes before it can be approved. Edit your listing and submit it again.` },
  rejected: { emoji: '{wy:ban}', title: 'Your listing was rejected', color: 'error',
    text: (n) => `The Wody team reviewed **${n}** and could not approve it for Community Discovery.` },
  suspended: { emoji: '{wy:ban}', title: 'Your listing was suspended', color: 'error',
    text: (n) => `**${n}** was suspended and is hidden from Community Discovery. Your data has not been deleted.` },
  unpublished: { emoji: '{wy:offline}', title: 'Your listing was unpublished', color: 'info',
    text: (n) => `**${n}** was taken off Community Discovery and is no longer public. Your data has not been deleted.` },
  expiring: { emoji: '{wy:time}', title: 'Your listing expires soon', color: 'warn',
    text: (n) => `**${n}** will leave Community Discovery in 7 days unless you renew it. Open your server dashboard and press Renew to keep it public for another 6 months.` },
  expired: { emoji: '{wy:offline}', title: 'Your listing expired', color: 'info',
    text: (n) => `**${n}** was not renewed in time and is no longer public. Your data has not been deleted. Open your server dashboard and press Renew to put it back online.` },
  renewed: { emoji: '{wy:success}', title: 'Your listing was renewed', color: 'success',
    text: (n) => `**${n}** stays on Community Discovery for another 6 months.` },
};
const REJECT_LABELS = {
  incomplete: 'Incomplete listing', invalid_information: 'Invalid information', invalid_invite: 'Invalid invite',
  duplicate: 'Duplicate listing', guidelines: 'Does not meet the Community Guidelines', prohibited: 'Prohibited content', other: 'Other',
};
const AREA_LABELS = { profile: 'Profile', description: 'Description', banner: 'Banner', category: 'Category', tags: 'Tags', social_links: 'Social links', other: 'Other' };

function clip(text, max) { const t = String(text || '').trim(); return t.length > max ? `${t.slice(0, max - 1)}…` : t; }
function quote(text) { return clip(text, 1500).split('\n').map((l) => `> ${l}`).join('\n'); }

export function dmPayload(type, listing, params = {}) {
  const copy = DM_COPY[type] || { emoji: '{wy:info}', title: 'Listing update', color: 'info', text: (n) => `There is an update about **${n}**.` };
  const name = clip(listing.content?.name || listing.live?.name || listing.slug || 'your server', 100);
  const children = [];
  const T = (content) => children.push({ type: 10, content });
  const sep = () => children.push({ type: 14, divider: true, spacing: 1 });
  T(`# {wy:home} ${name}`.slice(0, 190));
  T(`## ${copy.emoji} ${copy.title}\n\n${copy.text(name)}`);
  const details = [];
  if (type === 'rejected' && params.reason) details.push(`**Reason**\n${REJECT_LABELS[params.reason] || params.reason}`);
  if (type === 'changes_requested' && Array.isArray(params.fields) && params.fields.length) {
    details.push(`**What to change**\n${params.fields.map((f) => `• ${AREA_LABELS[f] || f}`).join('\n')}`);
  }
  if (params.message) {
    const label = ['suspended', 'unpublished', 'changes_requested'].includes(type) ? 'Reason' : 'Message from the Wody team';
    details.push(`**${label}**\n${quote(params.message)}`);
  }
  if (details.length) { sep(); T(details.join('\n')); }
  sep();
  const isPublic = listing.status === 'published' && listing.slug;
  const buttons = isPublic
    ? [{ type: 2, style: 5, label: 'View community page', emoji: { name: '{wy:language}' }, url: `${SITE()}/${currentPrefix() || 'server'}/${listing.slug}` }]
    : [{ type: 2, style: 5, label: 'Edit listing', emoji: { name: '{wy:edit}' }, url: `${SITE()}/dashboard/${String(listing.guild_id)}` }];
  if (['rejected', 'suspended', 'changes_requested'].includes(type)) {
    buttons.push({ type: 2, style: 5, label: 'Community Guidelines', emoji: { name: '{wy:docs}' }, url: `${SITE()}/servers/guidelines` });
  }
  children.push({ type: 1, components: buttons });
  T(`-# Wody Community Discovery · <t:${Math.floor(Date.now() / 1000)}:f>`);
  return { flags: (1 << 15) | (1 << 2), components: [{ type: 17, accent_color: DM_COLORS[copy.color], components: children }] };
}

export async function notifyAdmins(db, type, listing, params = {}) {
  await db.collection(C.notifications).insertOne({
    to: 'admin', type, listing_id: listing._id, slug: listing.slug, name: listing.content?.name || '', params, created_at: new Date(), read: false,
  });
}

export async function uniqueSlug(db, wanted, exceptId = null) {
  let base = slugify(wanted);
  if (!validSlug(base)) base = RESERVED_SLUGS.includes(base) || base.length < LIMITS.slug[0] ? `${base}-community`.slice(0, LIMITS.slug[1]) : base;
  let slug = base;
  for (let i = 2; i < 200; i += 1) {
    const taken = await db.collection(C.listings).findOne({ $or: [{ slug }, { slug_history: slug }], ...(exceptId ? { _id: { $ne: exceptId } } : {}) }, { projection: { _id: 1 } });
    if (!taken && validSlug(slug)) return slug;
    slug = `${base}-${i}`.slice(0, LIMITS.slug[1]);
  }
  throw new CommunityError('slug_unavailable', 409);
}

export async function createListing(db, { guildId, userId, name, stats = null, settings }) {
  const gid = toLong(guildId);
  if (await db.collection(C.listings).findOne({ guild_id: gid }, { projection: { _id: 1 } })) throw new CommunityError('listing_exists', 409);
  const owned = await db.collection(C.listings).countDocuments({ owner_id: toLong(userId) });
  if (owned >= (settings?.max_listings_per_user ?? 10)) throw new CommunityError('listing_limit', 409);
  const now = new Date();
  const content = emptyContent(name);
  content.slug = await uniqueSlug(db, name);
  const doc = {
    guild_id: gid, slug: content.slug, name_key: nameKey(name), slug_history: [], status: 'draft', owner_id: toLong(userId), content, live: null, pub: null, version: 0,
    update_state: null, created_at: now, updated_at: now, submitted_at: null, published_at: null, last_review: null,
    internal_notes: [], checklist: {}, badges: [], featured: null, stats, invite_status: 'unknown', invite_checked_at: null, unavailable: false,
    counters: { favorites: 0, reviews: 0, rating_sum: 0, views_total: 0, invite_clicks_total: 0, uniques_30d: 0 },
  };
  try { await db.collection(C.listings).insertOne(doc); } catch (e) { if (e?.code === 11000) throw new CommunityError('listing_exists', 409); throw e; }
  const listing = await db.collection(C.listings).findOne({ guild_id: gid });
  await addTimeline(db, listing, 'created', { actor: userId, kind: 'owner' });
  return listing;
}

export function isLocked(listing) {
  return listing.status === 'pending_review' || (listing.status === 'published' && listing.update_state === 'pending');
}

export async function updateContent(db, listing, patch, userId) {
  if (isLocked(listing)) throw new CommunityError('locked_pending', 409);
  if (listing.status === 'suspended') throw new CommunityError('suspended_locked', 409);
  const set = { updated_at: new Date() };
  for (const [k, v] of Object.entries(patch)) set[`content.${k}`] = v;
  if (typeof patch.name === 'string') set.name_key = nameKey(patch.name);
  const update = { $set: set };
  if (patch.slug && patch.slug !== listing.slug) {
    const clash = await db.collection(C.listings).findOne({ $or: [{ slug: patch.slug }, { slug_history: patch.slug }], _id: { $ne: listing._id } }, { projection: { _id: 1 } });
    if (clash) throw new CommunityError('slug_taken', 409);
    set.slug = patch.slug;
    update.$addToSet = { slug_history: listing.slug };
  }
  try { await db.collection(C.listings).updateOne({ _id: listing._id }, update); } catch (e) { if (e?.code === 11000) throw new CommunityError('slug_taken', 409); throw e; }
  return db.collection(C.listings).findOne({ _id: listing._id });
}

export async function submitListing(db, listing, userId, { settings, inviteOk = true, hasImage = () => true, termsAccepted = false }) {
  const canSubmit = SUBMITTABLE.includes(listing.status)
    || (listing.status === 'published' && [null, undefined, 'changes_requested'].includes(listing.update_state));
  if (!canSubmit) throw new CommunityError('invalid_state', 409, { status: listing.status });
  const done = completion(listing.content, settings);
  if (!done.ok) throw new CommunityError('incomplete', 400, { missing: done.missing.filter((m) => m.required).map((m) => m.key) });
  if (!termsAccepted) throw new CommunityError('terms_required', 400);
  if (listing.unavailable) throw new CommunityError('server_unavailable', 409);
  const key = nameKey(listing.content.name);
  const dup = await db.collection(C.listings).findOne({ name_key: key, guild_id: { $ne: listing.guild_id }, status: { $in: ['pending_review', 'approved', 'published'] } }, { projection: { _id: 1 } });
  if (dup) throw new CommunityError('name_taken', 409);
  if (settings.require_invite !== false && !inviteOk) throw new CommunityError('invalid_invite', 400);
  if (listing.content.banner_id && !(await hasImage(listing.content.banner_id))) throw new CommunityError('incomplete', 400, { missing: ['banner'] });
  const members = listing.stats?.member_count;
  if (settings.min_members && (members == null || members < settings.min_members)) throw new CommunityError('not_enough_members', 400, { min: settings.min_members });

  const version = (listing.version || 0) + 1;
  const prev = await db.collection(C.versions).find({ listing_id: listing._id }).sort({ version: -1 }).limit(1).next();
  const changes = diffContent(prev?.content || listing.live || {}, listing.content);
  const wasResubmit = Boolean(prev);
  const now = new Date();
  await db.collection(C.versions).insertOne({
    listing_id: listing._id, version, content: structuredClone(listing.content), by: toLong(userId), at: now, changes, kind: wasResubmit ? 'resubmit' : 'submit', terms_version: TERMS_VERSION,
  });
  const set = { version, submitted_at: now, updated_at: now, name_key: key, terms_accepted_at: now, terms_version: TERMS_VERSION };
  if (listing.status === 'published') set.update_state = 'pending'; else set.status = 'pending_review';
  await db.collection(C.listings).updateOne({ _id: listing._id }, { $set: set });
  const next = await db.collection(C.listings).findOne({ _id: listing._id });
  await addTimeline(db, next, wasResubmit ? 'resubmitted' : 'submitted', { actor: userId, kind: 'owner' });
  await notifyOwners(db, next, 'submitted');
  await notifyAdmins(db, wasResubmit ? 'resubmission' : 'new_submission', next);
  await notifyBotOwner(db, next, wasResubmit ? 'resubmission' : 'new_submission');
  // Manual reviews switched off in the owner panel: the submission goes live right away and the normal approval flow
  // (timeline, notifications, review log post, owner DM) runs exactly as for a manual approval.
  if (settings.auto_approve_submissions === true) {
    try {
      return await approveListing(db, next, null, { checklist: {}, note: '' }, { ...settings, require_checklist: false });
    } catch (e) {
      console.error('Community auto approval failed, the listing stays in the review queue', e?.message || e);
    }
  }
  return next;
}

function requireAdminReason(reason, message) {
  const text = String(message || '').trim();
  if (!text) throw new CommunityError('message_required', 400);
  if (text.length > LIMITS.message) throw new CommunityError('message_too_long', 400);
  return text;
}

function pendingKind(listing) {
  if (listing.status === 'pending_review') return 'new';
  if (listing.status === 'published' && listing.update_state === 'pending') return 'update';
  return null;
}

export async function approveListing(db, listing, admin, { checklist = {}, note = '' } = {}, settings) {
  const kind = pendingKind(listing);
  if (!kind) throw new CommunityError('invalid_state', 409, { status: listing.status });
  if (settings.require_checklist !== false && !CHECKLIST_ITEMS.every((k) => checklist[k] === true)) throw new CommunityError('checklist_incomplete', 400);
  const now = new Date();
  const auto = settings.auto_publish_on_approve !== false;
  const live = structuredClone(listing.content);
  const draft = { ...listing, live };
  const status = kind === 'update' ? 'published' : (auto ? 'published' : 'approved');
  const set = {
    live, pub: derivePub({ ...draft, status }), status, update_state: null, updated_at: now, approved_at: now, checklist,
    last_review: { type: 'approved', message: note || null, fields: [], reason: null, by: toLong(admin), at: now },
  };
  if (status === 'published' && !listing.published_at) set.published_at = now;
  if (status === 'published' && (kind === 'new' || !listing.expires_at)) { set.expires_at = nextExpiry(now); set.expiry_warned_for = null; }
  await db.collection(C.listings).updateOne({ _id: listing._id }, { $set: set, $unset: { expired_at: '' } });
  const next = await db.collection(C.listings).findOne({ _id: listing._id });
  await addTimeline(db, next, 'approved', { actor: admin, kind: 'admin', message: note || null });
  if (status === 'published' && kind === 'new') await addTimeline(db, next, 'published', { actor: admin, kind: 'admin' });
  await addAudit(db, { admin, action: 'listing_approved', listing: next, old: listing.status, next: status });
  const goesLive = status === 'published' && kind === 'new';
  await announceDecision(db, next, kind === 'update' ? 'update_approved' : (goesLive ? 'approved_live' : 'approved'), { message: note || null }, admin);
  await notifyOwners(db, next, 'approved', { message: note || null }, { dm: !goesLive });
  if (goesLive) {
    await notifyOwners(db, next, 'published', {}, { dm: false });
    try { await loadPrefix(db).catch(() => {}); await dmSender(String(next.owner_id), dmPayload('approved_live', next, { message: note || null })); } catch { }
  }
  return next;
}

export async function requestChanges(db, listing, admin, { areas = [], message = '' }) {
  const text = requireAdminReason(null, message);
  const fields = (Array.isArray(areas) ? areas : []).filter((a) => CHANGE_AREAS.includes(a));
  const kind = pendingKind(listing);
  if (!kind && listing.status !== 'published') throw new CommunityError('invalid_state', 409, { status: listing.status });
  const now = new Date();
  const set = { updated_at: now, last_review: { type: 'changes_requested', message: text, fields, reason: null, by: toLong(admin), at: now } };
  if (listing.status === 'published') set.update_state = 'changes_requested'; else set.status = 'changes_requested';
  await db.collection(C.listings).updateOne({ _id: listing._id }, { $set: set });
  const next = await db.collection(C.listings).findOne({ _id: listing._id });
  await addTimeline(db, next, 'changes_requested', { actor: admin, kind: 'admin', message: text, meta: { fields } });
  await addAudit(db, { admin, action: 'changes_requested', listing: next, reason: text, old: listing.status, next: set.status || 'published' });
  await notifyOwners(db, next, 'changes_requested', { message: text, fields }, { dm: true });
  await announceDecision(db, next, 'changes_requested', { message: text, fields }, admin);
  return next;
}

export async function rejectListing(db, listing, admin, { reason = '', message = '' }) {
  if (!REJECT_REASONS.includes(reason)) throw new CommunityError('invalid_reason', 400);
  const text = String(message || '').trim().slice(0, LIMITS.message);
  if (reason === 'other' && !text) throw new CommunityError('message_required', 400);
  const kind = pendingKind(listing);
  if (!kind) throw new CommunityError('invalid_state', 409, { status: listing.status });
  const now = new Date();
  const set = { updated_at: now, last_review: { type: 'rejected', message: text || null, fields: [], reason, by: toLong(admin), at: now } };
  if (kind === 'update') set.update_state = null; else set.status = 'rejected';
  await db.collection(C.listings).updateOne({ _id: listing._id }, { $set: set });
  const next = await db.collection(C.listings).findOne({ _id: listing._id });
  await addTimeline(db, next, 'rejected', { actor: admin, kind: 'admin', reason, message: text || null });
  await addAudit(db, { admin, action: 'listing_rejected', listing: next, reason: `${reason}${text ? `: ${text}` : ''}`, old: listing.status, next: set.status || 'published' });
  await notifyOwners(db, next, 'rejected', { reason, message: text || null }, { dm: true });
  await announceDecision(db, next, kind === 'update' ? 'update_rejected' : 'rejected', { reason, message: text || null }, admin);
  return next;
}

export async function suspendListing(db, listing, admin, { reason = '' }) {
  const text = requireAdminReason(null, reason);
  if (!['published', 'approved'].includes(listing.status)) throw new CommunityError('invalid_state', 409, { status: listing.status });
  const now = new Date();
  await db.collection(C.listings).updateOne({ _id: listing._id }, { $set: { status: 'suspended', updated_at: now, suspended_at: now, last_review: { type: 'suspended', message: text, fields: [], reason: null, by: toLong(admin), at: now } } });
  const next = await db.collection(C.listings).findOne({ _id: listing._id });
  await addTimeline(db, next, 'suspended', { actor: admin, kind: 'admin', message: text });
  await addAudit(db, { admin, action: 'listing_suspended', listing: next, reason: text, old: listing.status, next: 'suspended' });
  await notifyOwners(db, next, 'suspended', { message: text }, { dm: true });
  await announceDecision(db, next, 'suspended', { message: text }, admin);
  return next;
}

export async function unpublishListing(db, listing, admin, { reason = '' }) {
  if (!['published', 'approved', 'suspended'].includes(listing.status)) throw new CommunityError('invalid_state', 409, { status: listing.status });
  const text = String(reason || '').trim().slice(0, LIMITS.message) || null;
  const now = new Date();
  await db.collection(C.listings).updateOne({ _id: listing._id }, { $set: { status: 'unpublished', updated_at: now, last_review: { type: 'unpublished', message: text, fields: [], reason: null, by: toLong(admin), at: now } }, $unset: { expired_at: '' } });
  const next = await db.collection(C.listings).findOne({ _id: listing._id });
  await addTimeline(db, next, 'unpublished', { actor: admin, kind: 'admin', message: text });
  await addAudit(db, { admin, action: 'listing_unpublished', listing: next, reason: text, old: listing.status, next: 'unpublished' });
  await notifyOwners(db, next, 'unpublished', { message: text }, { dm: true });
  await announceDecision(db, next, 'unpublished', { message: text }, admin);
  return next;
}

export async function publishListing(db, listing, admin) {
  if (!['approved', 'unpublished', 'suspended'].includes(listing.status)) throw new CommunityError('invalid_state', 409, { status: listing.status });
  if (!listing.live) throw new CommunityError('no_live_version', 409);
  const now = new Date();
  await db.collection(C.listings).updateOne({ _id: listing._id }, { $set: { status: 'published', pub: derivePub({ ...listing, status: 'published' }), updated_at: now, published_at: listing.published_at || now, expires_at: nextExpiry(now), expiry_warned_for: null }, $unset: { expired_at: '' } });
  const next = await db.collection(C.listings).findOne({ _id: listing._id });
  await addTimeline(db, next, 'published', { actor: admin, kind: 'admin' });
  await addAudit(db, { admin, action: 'listing_published', listing: next, old: listing.status, next: 'published' });
  await notifyOwners(db, next, 'published', {}, { dm: true });
  await announceDecision(db, next, 'published', {}, admin);
  return next;
}

export async function addInternalNote(db, listing, admin, text) {
  const body = String(text || '').trim().slice(0, LIMITS.note);
  if (!body) throw new CommunityError('message_required', 400);
  const note = { id: new ObjectId().toHexString(), by: toLong(admin), text: body, at: new Date() };
  await db.collection(C.listings).updateOne({ _id: listing._id }, { $push: { internal_notes: { $each: [note], $slice: -100 } } });
  await addAudit(db, { admin, action: 'note_added', listing, reason: body.slice(0, 200) });
  return note;
}

export async function setChecklist(db, listing, admin, checklist) {
  const clean = {};
  for (const k of CHECKLIST_ITEMS) clean[k] = checklist?.[k] === true;
  await db.collection(C.listings).updateOne({ _id: listing._id }, { $set: { checklist: clean } });
  return clean;
}

export async function setBadges(db, listing, admin, badgeKeys, validKeys) {
  const keys = [...new Set((badgeKeys || []).map(String))];
  if (keys.some((k) => !validKeys.has(k))) throw new CommunityError('invalid_badge', 400);
  const before = listing.badges || [];
  await db.collection(C.listings).updateOne({ _id: listing._id }, { $set: { badges: keys, updated_at: new Date() } });
  const next = await db.collection(C.listings).findOne({ _id: listing._id });
  if (next.live) await db.collection(C.listings).updateOne({ _id: next._id }, { $set: { 'pub.score': computeScore(next) } });
  for (const k of keys.filter((x) => !before.includes(x))) await addAudit(db, { admin, action: 'badge_added', listing: next, reason: k });
  for (const k of before.filter((x) => !keys.includes(x))) await addAudit(db, { admin, action: 'badge_removed', listing: next, reason: k });
  return next;
}

export async function setFeatured(db, listing, admin, featured, settings) {
  if (featured === null) {
    await db.collection(C.listings).updateOne({ _id: listing._id }, { $set: { featured: null } });
    await addAudit(db, { admin, action: 'listing_unfeatured', listing, old: listing.featured, next: null });
    return db.collection(C.listings).findOne({ _id: listing._id });
  }
  const start = new Date(featured.start); const end = new Date(featured.end);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) throw new CommunityError('invalid_dates', 400);
  const placement = ['home', 'category', 'sidebar'].includes(featured.placement) ? featured.placement : 'home';
  const priority = Math.max(0, Math.min(100, Number.parseInt(featured.priority, 10) || 0));
  const active = await db.collection(C.listings).countDocuments({ 'featured.end': { $gt: new Date() }, _id: { $ne: listing._id } });
  if (active >= (settings.featured_slots ?? 12)) throw new CommunityError('featured_full', 409);
  const value = { placement, priority, start, end, by: toLong(admin) };
  await db.collection(C.listings).updateOne({ _id: listing._id }, { $set: { featured: value } });
  await addAudit(db, { admin, action: 'listing_featured', listing, old: listing.featured, next: value });
  return db.collection(C.listings).findOne({ _id: listing._id });
}

export async function deleteListing(db, listing, { actor, kind = 'owner' } = {}) {
  const id = listing._id;
  await addAudit(db, { admin: kind === 'admin' ? actor : null, action: 'listing_deleted', listing, old: listing.status, next: { by: kind, actor: actor ? String(actor) : null } });
  await Promise.all([
    db.collection(C.versions).deleteMany({ listing_id: id }),
    db.collection(C.timeline).deleteMany({ listing_id: id }),
    db.collection(C.reviews).deleteMany({ listing_id: id }),
    db.collection(C.reports).deleteMany({ listing_id: id }),
    db.collection(C.favorites).deleteMany({ listing_id: id }),
    db.collection(C.managers).deleteMany({ listing_id: id }),
    db.collection(C.images).deleteMany({ listing_id: id }),
    db.collection(C.notifications).deleteMany({ listing_id: id }),
  ]);
  await db.collection(C.listings).deleteOne({ _id: id });
}


// ---------------------------------------------------------------------------------------------- bot owner alert
const OWNER_COPY = {
  new_submission: { title: 'New server waiting for review', text: (n) => `**${n}** was sent for verification and is waiting in the review panel.` },
  resubmission: { title: 'Server sent for review again', text: (n) => `**${n}** was sent for verification again and is waiting in the review panel.` },
};

export function ownerAlertPayload(kind, listing) {
  const copy = OWNER_COPY[kind] || OWNER_COPY.new_submission;
  const name = clip(listing.content?.name || listing.slug || 'Server', 100);
  const members = typeof listing.stats?.member_count === 'number' ? new Intl.NumberFormat('en').format(listing.stats.member_count) : null;
  const facts = [`**Server** ${name} · \`${String(listing.guild_id)}\``, members ? `**Members** ${members}` : null, `**Sent** <t:${Math.floor(Date.now() / 1000)}:f>`].filter(Boolean).join('\n');
  return {
    flags: (1 << 15) | (1 << 2),
    allowed_mentions: { parse: [] },
    components: [{ type: 17, accent_color: 0xC46A2D, components: [
      { type: 10, content: `-# Wody Community Discovery\n## {wy:notification} ${copy.title}\n${copy.text(name)}` },
      { type: 14, divider: true, spacing: 1 },
      { type: 10, content: facts },
      { type: 1, components: [{ type: 2, style: 5, label: 'Open review panel', emoji: { name: '{wy:dashboard}' }, url: `${SITE()}/dashboard/panel` }] },
    ] }],
  };
}

/** Tells the bot owner on the website bell and by Discord DM that a server is waiting for verification. */
export async function notifyBotOwner(db, listing, kind = 'new_submission') {
  const name = clip(listing.content?.name || listing.slug || '', 100);
  try {
    await pushNotification(db, OWNER_ID, 'server_submitted', { name, kind }, { url: '/dashboard/panel', dedupe: `server_submitted:${String(listing._id)}:${listing.version || 0}` });
  } catch (e) { console.error('owner bell', e?.message); }
  try {
    await dmSender(String(OWNER_ID), ownerAlertPayload(kind, listing));
  } catch (e) { console.error('owner dm', e?.message); }
}

// ---------------------------------------------------------------------------------------------- 6 month lifetime
export function renewState(listing, now = new Date()) {
  const exp = listing.expires_at ? new Date(listing.expires_at) : null;
  const expiredBySystem = listing.status === 'unpublished' && Boolean(listing.expired_at);
  const inWindow = listing.status === 'published' && exp && exp.getTime() - now.getTime() <= RENEW_WINDOW_DAYS * DAY_MS;
  return { expires_at: exp ? exp.toISOString() : null, expired: expiredBySystem, can_renew: Boolean(inWindow || expiredBySystem) };
}

export async function renewListing(db, listing, userId) {
  const now = new Date();
  const st = renewState(listing, now);
  if (!st.can_renew) throw new CommunityError(listing.status === 'published' ? 'renew_too_early' : 'invalid_state', 409, { status: listing.status });
  if (st.expired && !listing.live) throw new CommunityError('no_live_version', 409);
  const set = { expires_at: nextExpiry(now), expiry_warned_for: null, updated_at: now };
  if (st.expired) { set.status = 'published'; set.pub = derivePub({ ...listing, status: 'published' }); }
  await db.collection(C.listings).updateOne({ _id: listing._id }, { $set: set, $unset: { expired_at: '' } });
  const next = await db.collection(C.listings).findOne({ _id: listing._id });
  await addTimeline(db, next, 'renewed', { actor: userId, kind: 'owner' });
  await notifyOwners(db, next, 'renewed', {}, { dm: false });
  clearDiscoveryCache();
  return next;
}

let lastListingSweep = 0;
export async function sweepListings(db, { force = false, now = new Date() } = {}) {
  if (!force && Date.now() - lastListingSweep < 60_000) return { expired: 0, warned: 0 };
  lastListingSweep = Date.now();
  const col = db.collection(C.listings);
  let expired = 0; let warned = 0;
  await col.updateMany({ status: 'published', expires_at: { $exists: false } }, { $set: { expires_at: nextExpiry(now) } });
  const due = await col.find({ status: 'published', expires_at: { $lte: now } }).limit(100).toArray();
  for (const l of due) {
    const res = await col.updateOne({ _id: l._id, status: 'published', expires_at: l.expires_at }, { $set: { status: 'unpublished', expired_at: now, updated_at: now, last_review: { type: 'expired', message: null, fields: [], reason: null, by: null, at: now } } });
    if (!res.modifiedCount) continue;
    expired += 1;
    const next = await col.findOne({ _id: l._id });
    await addTimeline(db, next, 'expired', { kind: 'system' });
    await notifyOwners(db, next, 'expired', {}, { dm: true });
    await announceDecision(db, next, 'expired', {});
  }
  const soon = await col.find({ status: 'published', expires_at: { $gt: now, $lte: new Date(now.getTime() + RENEW_WINDOW_DAYS * DAY_MS) } }).limit(100).toArray();
  for (const l of soon) {
    if (l.expiry_warned_for && new Date(l.expiry_warned_for).getTime() === new Date(l.expires_at).getTime()) continue;
    const res = await col.updateOne({ _id: l._id, status: 'published', expires_at: l.expires_at }, { $set: { expiry_warned_for: l.expires_at } });
    if (!res.modifiedCount) continue;
    warned += 1;
    await notifyOwners(db, l, 'expiring', { until: new Date(l.expires_at).toISOString() }, { dm: true });
  }
  if (expired) clearDiscoveryCache();
  return { expired, warned };
}

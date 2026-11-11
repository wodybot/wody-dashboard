import { accountState } from '../account-moderation.js';
import { Long } from 'mongodb';
import { M } from './db.js';
import { STATUS } from './constants.js';
import { cleanUsername, publicAway, publicSocials } from './profile.js';
import { normalizeConfig } from '../profile-card.js';
import { normalizePage } from '../profile-page.js';
import { loadProfilePass } from '../battlepass/profile.js';

export async function loadPassport(db, userId) {
  try {
    const id = Long.fromString(String(userId));
    const doc = await db.collection('wody_passports').findOne({ user_id: id }, { projection: { number: 1, created_at: 1, genesis: 1 } });
    if (!doc || !doc.created_at) return null;
    const bans = await db.collection('wody_passport_bans').countDocuments({ user_id: id }).catch(() => 0);
    const since = new Date(doc.created_at);
    return { number: String(doc.number || ''), genesis: Number.isFinite(doc.genesis) ? doc.genesis : null, since: since.toISOString(), days: Math.max(0, Math.floor((Date.now() - since.getTime()) / 86400000)), bans };
  } catch { return null; }
}

/** The highest level this member has reached on any server, with their rank there. */
export async function loadTopLevel(db, userId) {
  try {
    const top = await db.collection('levels').find({ user_id: userId }).sort({ level: -1, xp: -1 }).limit(1).next();
    const lv = Number(top?.level) || 0;
    const xp = Math.max(0, Number(top?.xp) || 0);
    if (!top || (lv <= 0 && xp <= 0)) return null;
    const ahead = top.guild_id == null ? 0 : await db.collection('levels').countDocuments({ guild_id: top.guild_id, $or: [{ level: { $gt: lv } }, { level: lv, xp: { $gt: xp } }] }).catch(() => 0);
    return { level: lv, xp, needed: 5 * lv * lv + 50 * lv + 100, rank: top.guild_id == null ? null : ahead + 1 };
  } catch { return null; }
}

export async function loadPublicProfile(db, rawUsername) {
  const username_lc = cleanUsername(rawUsername);
  if (!username_lc) return null;
  const p = await db.collection(M.profiles).findOne({ username_lc });
  if (!p) return null;
  const [cardDoc, link, live, passport] = await Promise.all([
    db.collection('profile_cards').findOne({ _id: String(p.user_id) }, { projection: { cfg: 1, public: 1, page: 1, moderation: 1, share_public: 1 } }).catch(() => null),
    db.collection('user_tiktok_links').findOne({ user_id: p.user_id }, { projection: { username: 1 } }).catch(() => null),
    db.collection(M.requests).countDocuments({ author_id: p.user_id, status: STATUS.PUBLISHED }).catch(() => 0),
    loadPassport(db, p.user_id),
  ]);
  const pass = await loadProfilePass(db, String(p.user_id)).catch(() => null);
  const level = await loadTopLevel(db, p.user_id);
  if (accountState(cardDoc?.moderation).blocked) return null;
  const share = p.share_socials === true;
  return {
    id: String(p.user_id),
    shared: cardDoc?.share_public === true,
    name: p.display_name || username_lc,
    username: username_lc,
    avatar: p.avatar_hash || null,
    member_since: p.created_at ? new Date(p.created_at).toISOString() : null,
    away: publicAway(p.away),
    socials: share ? publicSocials(p, link) : {},
    live,
    passport,
    pass,
    level,
    views: Number.isFinite(p.views) ? p.views : 0,
    page: normalizePage(cardDoc?.page),
    card: cardDoc && cardDoc.public === false ? null : { config: normalizeConfig(cardDoc?.cfg), customized: Boolean(cardDoc?.cfg && Object.keys(cardDoc.cfg).length) },
  };
}

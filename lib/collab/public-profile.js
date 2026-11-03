import { accountState } from '../account-moderation.js';
import { M } from './db.js';
import { STATUS } from './constants.js';
import { cleanUsername, publicAway, publicSocials } from './profile.js';
import { normalizeConfig } from '../profile-card.js';
import { normalizePage } from '../profile-page.js';

export async function loadPublicProfile(db, rawUsername) {
  const username_lc = cleanUsername(rawUsername);
  if (!username_lc) return null;
  const p = await db.collection(M.profiles).findOne({ username_lc });
  if (!p) return null;
  const [cardDoc, link, live] = await Promise.all([
    db.collection('profile_cards').findOne({ _id: String(p.user_id) }, { projection: { cfg: 1, public: 1, page: 1, moderation: 1 } }).catch(() => null),
    db.collection('user_tiktok_links').findOne({ user_id: p.user_id }, { projection: { username: 1 } }).catch(() => null),
    db.collection(M.requests).countDocuments({ author_id: p.user_id, status: STATUS.PUBLISHED }).catch(() => 0),
  ]);
  if (accountState(cardDoc?.moderation).blocked) return null;
  const share = p.share_socials === true;
  return {
    id: String(p.user_id),
    name: p.display_name || username_lc,
    username: username_lc,
    avatar: p.avatar_hash || null,
    member_since: p.created_at ? new Date(p.created_at).toISOString() : null,
    away: publicAway(p.away),
    socials: share ? publicSocials(p, link) : {},
    live,
    views: Number.isFinite(p.views) ? p.views : 0,
    page: normalizePage(cardDoc?.page),
    card: cardDoc && cardDoc.public === false ? null : { config: normalizeConfig(cardDoc?.cfg), customized: Boolean(cardDoc?.cfg && Object.keys(cardDoc.cfg).length) },
  };
}

// Public profile of a WODY member, found by Discord username. Only a signed in visitor can see it (the page
// checks the session before calling this). Name, username and picture come from Discord and are never edited
// here. Social links are shown only when the owner left sharing on, and the linked TikTok only when it is not hidden.
import { M } from './db.js';
import { STATUS } from './constants.js';
import { cleanUsername, publicAway, publicSocials } from './profile.js';

export async function loadPublicProfile(db, rawUsername) {
  const username_lc = cleanUsername(rawUsername);
  if (!username_lc) return null;
  const p = await db.collection(M.profiles).findOne({ username_lc });
  if (!p) return null;
  const [link, live] = await Promise.all([
    db.collection('user_tiktok_links').findOne({ user_id: p.user_id }, { projection: { username: 1 } }).catch(() => null),
    db.collection(M.requests).countDocuments({ author_id: p.user_id, status: STATUS.PUBLISHED }).catch(() => 0),
  ]);
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
  };
}

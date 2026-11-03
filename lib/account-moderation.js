export const POLICY_VERSION = '1.0-draft';

const IMAGE_KEYS = ['image_url', 'dm_image_url', 'card_background_url', 'level_card_background_url', 'level_image_url'];

export function accountState(m) {
  if (!m || typeof m !== 'object') return { blocked: false, permanent: false, until: null };
  if (m.account_blocked === true) return { blocked: true, permanent: true, until: null };
  const until = m.account_suspended_until ? new Date(m.account_suspended_until) : null;
  if (until && until > new Date()) return { blocked: true, permanent: false, until };
  return { blocked: false, permanent: false, until: null };
}

export async function isAccountBlocked(db, userId) {
  const doc = await db.collection('profile_cards').findOne({ _id: String(userId) }, { projection: { moderation: 1 } });
  return accountState(doc?.moderation).blocked;
}

function isSiteAsset(value, siteHost) {
  try {
    const u = new URL(String(value));
    return Boolean(siteHost) && u.host === siteHost && /^\/(presets|scenes)\//.test(u.pathname);
  } catch {
    return false;
  }
}

export function hasUserImage(obj, siteHost) {
  if (!obj || typeof obj !== 'object') return false;
  return IMAGE_KEYS.some((k) => typeof obj[k] === 'string' && obj[k].trim() && !isSiteAsset(obj[k].trim(), siteHost));
}

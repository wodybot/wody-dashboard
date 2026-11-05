// Reward states and the claim rule. Evaluated on the server from stored progress; same rule and vectors as rewards.py.
import { DRAFT, SCHEDULED, ARCHIVED, COMPLETED, PAUSED, LOCKED, UNLOCKED, AVAILABLE, CLAIMED, EXPIRED } from './constants.js';
import { aware } from './priority.js';

export const CODES = {
  not_unlocked: 'not_unlocked', already_claimed: 'already_claimed', season_closed: 'season_closed', expired: 'expired',
  season_not_started: 'season_not_started', unknown_reward: 'unknown_reward',
};

export function isUnlocked(reward, level, xp) {
  return level >= Number(reward.level ?? 1) && xp >= Number(reward.required_xp || 0);
}

export function rewardState(reward, { seasonStatus, level, xp, claimed, protection, now }) {
  if (claimed) return CLAIMED;
  if (seasonStatus === DRAFT || seasonStatus === SCHEDULED) return LOCKED;
  if (!isUnlocked(reward, level, xp)) return LOCKED;
  const until = aware(reward.availability?.until);
  if (until && now >= until) return EXPIRED;
  if (seasonStatus === ARCHIVED) return EXPIRED;
  if (seasonStatus === COMPLETED) return (protection?.claim_after_end ?? true) ? AVAILABLE : EXPIRED;
  if (seasonStatus === PAUSED) return (protection?.claim_while_paused ?? true) ? AVAILABLE : UNLOCKED;
  return AVAILABLE;
}

/** [ok, code] */
export function claimDecision(reward, { seasonStatus, level, xp, claimed, protection, now }) {
  if (!reward) return [false, CODES.unknown_reward];
  if (claimed) return [false, CODES.already_claimed];
  const state = rewardState(reward, { seasonStatus, level, xp, claimed: false, protection, now });
  if (state === AVAILABLE) return [true, null];
  if (state === EXPIRED) return [false, CODES.expired];
  if (seasonStatus === DRAFT || seasonStatus === SCHEDULED) return [false, CODES.season_not_started];
  if (state === UNLOCKED) return [false, CODES.season_closed];
  return [false, CODES.not_unlocked];
}

export function periodKey(period, now) {
  if (period === 'day') return now.toISOString().slice(0, 10).replaceAll('-', '');
  if (period === 'week') {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const day = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - day);
    const year = d.getUTCFullYear();
    const week = Math.ceil((((d - new Date(Date.UTC(year, 0, 1))) / 86400000) + 1) / 7);
    return `${year}W${String(week).padStart(2, '0')}`;
  }
  return 'season';
}

export function collectionProgress(collection, claimedIds) {
  const items = (collection.reward_ids || []).map(String);
  return [items.filter((x) => claimedIds.has(x)).length, items.length];
}

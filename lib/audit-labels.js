// Plain, readable names for the security audit trail. Used by the Discord
// message (lib/owner-audit.js) and by the "Recent activity" list in the Owner
// Panel, so both always say the same thing. The audit trail is English only on
// purpose: it is for the owner and the staff of Wody, not for the public.
const ACTIONS = {
  'login': { title: 'Signed in', icon: '🔑' },
  'logout': { title: 'Signed out', icon: '🚪' },
  'panel.open': { title: 'Opened the Owner Panel', icon: '🧭' },
  'access.verify': { title: 'Looked up a person for panel access', icon: '🔍' },
  'access.grant': { title: 'Granted panel access', icon: '🛡️' },
  'access.revoke': { title: 'Revoked panel access', icon: '🚫' },
  'community.admin.denied': { title: 'Community admin request refused', icon: '⛔' },
  'community.admin.blocked': { title: 'Community admin request blocked', icon: '⛔' },
};

const ROLES = { owner: 'Owner', delegate: 'Delegate', user: 'Member', unknown: 'Unknown' };
const OUTCOMES = { ok: 'Success', denied: 'Denied', warn: 'Failed', info: 'Info' };

function sentence(text) {
  const s = String(text || '').trim();
  return s ? s[0].toUpperCase() + s.slice(1) : '';
}

function fromCode(code) {
  return sentence(String(code || 'Activity').replace(/[._]+/g, ' ').replace(/\s+/g, ' '));
}

export function auditTitle(action) {
  const hit = ACTIONS[String(action || '').toLowerCase()];
  if (hit) return hit.title;
  const raw = String(action || '').trim();
  // Entries written as readable text ("Server banned") are kept as they are.
  return /\s/.test(raw) ? sentence(raw) : fromCode(raw);
}

export function auditIcon(action, outcome) {
  const hit = ACTIONS[String(action || '').toLowerCase()];
  if (hit) return outcome === 'denied' && hit.icon === '🔑' ? '⛔' : hit.icon;
  const a = String(action || '').toLowerCase();
  if (/(ban|delete|remove)/.test(a)) return '🗑️';
  if (/(premium|key)/.test(a)) return '💎';
  if (/(message)/.test(a)) return '✉️';
  return { ok: '✅', denied: '⛔', warn: '⚠️', info: 'ℹ️' }[outcome] || 'ℹ️';
}

export const auditRole = (role) => ROLES[String(role || '').toLowerCase()] || sentence(role);
export const auditOutcome = (outcome) => OUTCOMES[String(outcome || '').toLowerCase()] || sentence(outcome);
export const auditDetail = (text) => sentence(text);

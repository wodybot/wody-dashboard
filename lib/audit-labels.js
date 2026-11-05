const ACTIONS = {
  'login': { title: 'Signed in', icon: '{wy:permissions}' },
  'logout': { title: 'Signed out', icon: '{wy:leave}' },
  'panel.open': { title: 'Opened the Owner Panel', icon: '{wy:explore}' },
  'access.verify': { title: 'Looked up a person for panel access', icon: '{wy:search}' },
  'access.grant': { title: 'Granted panel access', icon: '{wy:moderation}' },
  'access.revoke': { title: 'Revoked panel access', icon: '{wy:ban}' },
  'community.admin.denied': { title: 'Community admin request refused', icon: '{wy:ban}' },
  'community.admin.blocked': { title: 'Community admin request blocked', icon: '{wy:ban}' },
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
  return /\s/.test(raw) ? sentence(raw) : fromCode(raw);
}

export function auditIcon(action, outcome) {
  const hit = ACTIONS[String(action || '').toLowerCase()];
  if (hit) return outcome === 'denied' && hit.icon === '{wy:permissions}' ? '{wy:ban}' : hit.icon;
  const a = String(action || '').toLowerCase();
  if (/(ban|delete|remove)/.test(a)) return '{wy:delete}';
  if (/(premium|key)/.test(a)) return '{wy:gem}';
  if (/(message)/.test(a)) return '{wy:contact}';
  return { ok: '{wy:success}', denied: '{wy:ban}', warn: '{wy:warning}', info: '{wy:info}' }[outcome] || '{wy:info}';
}

export const auditRole = (role) => ROLES[String(role || '').toLowerCase()] || sentence(role);
export const auditOutcome = (outcome) => OUTCOMES[String(outcome || '').toLowerCase()] || sentence(outcome);
export const auditDetail = (text) => sentence(text);

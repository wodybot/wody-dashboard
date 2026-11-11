import crypto from 'crypto';
import { sendGuildMessage } from '@/lib/discord';
import { auditTitle, auditIcon, auditRole, auditOutcome, auditDetail } from '@/lib/audit-labels';

export const AUDIT_CHANNEL_ID = process.env.OWNER_AUDIT_CHANNEL_ID || '';

const COLORS = { ok: 0x57f287, denied: 0xed4245, info: 0x5865f2, warn: 0xfee75c };
const OUTCOME_ICON = { ok: '{wy:success}', denied: '{wy:ban}', info: '{wy:info}', warn: '{wy:warning}' };
const SITE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://wody.online';

export function auditPayload(doc, at = new Date()) {
  const icon = auditIcon(doc.action, doc.outcome);
  const title = auditTitle(doc.action);
  const lines = [
    `**Account**  ${doc.actor_name || 'Unknown'} \u00b7 ${auditRole(doc.role)}`,
    `**Result**  ${OUTCOME_ICON[doc.outcome] || ''} ${auditOutcome(doc.outcome)}`,
  ];
  if (doc.target) lines.push(`**Target**  ${doc.target}`);
  if (doc.detail) lines.push(`**Details**  ${auditDetail(doc.detail)}`);
  const unix = Math.floor(at.getTime() / 1000);
  return {
    flags: 1 << 15,
    components: [{
      type: 17,
      accent_color: COLORS[doc.outcome] || COLORS.info,
      components: [
        { type: 10, content: `## ${icon} ${title}`.slice(0, 200) },
        { type: 14, divider: true, spacing: 1 },
        { type: 10, content: lines.join('\n').slice(0, 3500) },
        { type: 10, content: `-# Wody security audit \u00b7 ID \`${doc.actor_id || '?'}\` \u00b7 Client \`${doc.ip}\` \u00b7 <t:${unix}:F>` },
        { type: 14, divider: true, spacing: 1 },
        { type: 1, components: [{ type: 2, style: 5, label: 'Open Owner Panel', url: `${SITE_URL}/dashboard/panel` }] },
      ],
    }],
    allowed_mentions: { parse: [] },
  };
}

function clean(value, max = 300) {
  return String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/[`@]/g, "'").slice(0, max);
}

export function ipTag(request) {
  try {
    const raw = (request?.headers?.get?.('x-forwarded-for') || '').split(',')[0].trim() || 'unknown';
    const key = process.env.SESSION_SECRET || 'wody';
    return crypto.createHmac('sha256', key).update(raw).digest('hex').slice(0, 10);
  } catch { return 'unknown'; }
}

export async function ensureAuditIndexes(db) {
  try {
    await Promise.all([
      db.collection('owner_audit').createIndex({ at: -1 }),
      db.collection('owner_audit').createIndex({ at: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 365 }),
      db.collection('owner_access').createIndex({ active: 1, expires_at: 1 }),
      db.collection('owner_access_challenges').createIndex({ expires_at: 1 }, { expireAfterSeconds: 0 }),
    ]);
  } catch (e) { console.error('audit indexes failed', e?.message || e); }
}

export async function audit(db, entry) {
  const at = new Date();
  const doc = {
    at,
    actor_id: clean(entry.actor?.id, 30),
    actor_name: clean(entry.actor?.name, 80),
    role: clean(entry.role || 'unknown', 20),
    action: clean(entry.action, 80),
    outcome: clean(entry.outcome || 'info', 10),
    target: clean(entry.target, 120),
    detail: clean(entry.detail, 500),
    ip: ipTag(entry.request),
  };
  try { await db.collection('owner_audit').insertOne(doc); } catch (e) { console.error('audit store failed', e?.message || e); }
  if (!AUDIT_CHANNEL_ID) return;
  try {
    await sendGuildMessage(AUDIT_CHANNEL_ID, auditPayload(doc, at));
  } catch (e) { console.error('audit post failed', e?.message || e); }
}

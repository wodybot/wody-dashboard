// Reading settings and the request to the bot. The website never writes Statistics data itself.
import { toLong } from '@/lib/mongo';
import { COLL, THRESHOLD_DEFAULTS, RETENTION } from './constants.js';

export const str = (v) => (v === null || v === undefined ? null : String(v));

/** A request to the bot (kind stats_query for reads, stats_action for changes). Returns { ok, result } or { error }. */
export async function askBot(db, { kind, guildId, userId, payload, waitMs = 12000, burst = 12 }) {
  const gid = toLong(guildId);
  const recent = await db.collection('module_requests').countDocuments({ kind, guild_id: gid, created_at: { $gt: new Date(Date.now() - 15000) } });
  if (recent >= burst) return { error: 'rate_limited' };
  const res = await db.collection('module_requests').insertOne({
    kind, guild_id: gid, requested_by: toLong(userId), payload, status: 'pending', created_at: new Date(),
  });
  const deadline = Date.now() + waitMs;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 300));
    const doc = await db.collection('module_requests').findOne({ _id: res.insertedId });
    if (doc?.status === 'done') return { ok: true, result: doc.result || {} };
    if (doc?.status === 'failed') return { error: doc.error_code || 'failed' };
  }
  await db.collection('module_requests').deleteOne({ _id: res.insertedId, status: 'pending' });
  return { error: 'bot_unreachable' };
}

/** Settings as the page needs them. The salt used by the sketch never leaves the database. */
export function settingsView(doc) {
  const d = doc || {};
  const coverage = Array.isArray(d.coverage) ? d.coverage.filter((s) => Array.isArray(s) && s.length === 2) : [];
  return {
    enabled: Boolean(d.enabled),
    retention_days: Number.isFinite(d.retention_days) ? d.retention_days : RETENTION.default,
    access: d.access === 'everyone' ? 'everyone' : 'staff',
    excluded_channels: (d.excluded_channels || []).map(String),
    excluded_categories: (d.excluded_categories || []).map(String),
    thresholds: { ...THRESHOLD_DEFAULTS, ...(d.thresholds || {}) },
    tz_offset: Number.isFinite(d.tz_offset) ? d.tz_offset : 0,
    coverage,
    collecting_since: coverage.length ? coverage[0][0] : null,
    configured: Boolean(doc),
  };
}

export async function loadSettings(db, guildId) {
  const doc = await db.collection(COLL.settings).findOne({ _id: toLong(guildId) });
  return settingsView(doc);
}

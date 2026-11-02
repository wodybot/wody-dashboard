// Wody Blackjack, dashboard side. Mirrors blackjack/service.py DEFAULTS.
import DEFAULTS from '@/lib/economy-defaults.json';
import { json, validationError, premiumRequired } from '@/lib/modules/http';
import { pickBool, pickInt, pickEnum } from '@/lib/modules/validate';
import { auditLog } from '@/lib/modules/economy';

const B = DEFAULTS.blackjack.settings;
const GAME_LIMIT_KEYS = ['slots', 'coinflip', 'dice'];
const PAYOUTS = ['3:2', '6:5', '2:1', '1:1'];
const KEYS = [...Object.keys(B), 'setup_completed'];

export function sanitizeBlackjack(body, existing) {
  const errors = [];
  const patch = {};
  const has = (k) => body[k] !== undefined;
  const int = (k, min, max) => { if (has(k)) patch[k] = pickInt(errors, k, body[k], min, max, existing[k]); };
  int('min_bet', 1, 1e9); int('max_bet', 1, 1e12);
  for (const g of GAME_LIMIT_KEYS) { int(`${g}_min_bet`, 1, 1e9); int(`${g}_max_bet`, 1, 1e12); } int('decks', 1, 8); int('max_hands', 1, 4);
  int('starter_chips', 0, 1e9); int('daily_chips', 0, 1e9); int('daily_streak_bonus', 0, 100);
  int('convert_min_chips', 1, 1e12); int('convert_rate', 1, 1e6); int('convert_daily_limit', 0, 1e12);
  if (has('setup_completed')) patch.setup_completed = pickBool(body.setup_completed, false);
  if (has('blackjack_payout')) patch.blackjack_payout = pickEnum(errors, 'blackjack_payout', body.blackjack_payout, PAYOUTS, existing.blackjack_payout);
  for (const k of ['dealer_hits_soft_17', 'insurance', 'double_after_split', 'convert_enabled']) if (has(k)) patch[k] = pickBool(body[k], existing[k]);
  const merged = { ...existing, ...patch };
  if (Number(merged.max_bet) < Number(merged.min_bet)) errors.push({ field: 'max_bet', code: 'max_below_min' });
  for (const g of GAME_LIMIT_KEYS) if (Number(merged[`${g}_max_bet`]) < Number(merged[`${g}_min_bet`])) errors.push({ field: `${g}_max_bet`, code: 'max_below_min' });
  if (Number(merged.convert_min_chips) < Number(merged.convert_rate)) errors.push({ field: 'convert_min_chips', code: 'min_below_rate' });
  return { patch, errors };
}

export async function blackjackGet(ctx) {
  const { sub, db, gidLong, h, premium } = ctx;
  if (!premium) return json({ premium: false });
  if (sub === 'blackjack') {
    const doc = await db.collection('blackjack_settings').findOne({ guild_id: gidLong }) || {};
    const settings = { ...B, setup_completed: false };
    for (const k of KEYS) if (doc[k] !== undefined) settings[k] = doc[k];
    const [players, agg] = await Promise.all([
      db.collection('blackjack_wallets').countDocuments({ guild_id: gidLong }),
      db.collection('blackjack_stats').aggregate([{ $match: { guild_id: gidLong } }, { $group: { _id: null, games: { $sum: '$games' }, net: { $sum: '$net' }, wagered: { $sum: '$wagered' } } }]).toArray(),
    ]);
    const chips = await db.collection('blackjack_wallets').aggregate([{ $match: { guild_id: gidLong } }, { $group: { _id: null, chips: { $sum: '$chips' }, converted: { $sum: '$total_converted' } } }]).toArray();
    return json({ premium: true, settings, defaults: B, payouts: PAYOUTS, summary: {
      players, games: agg[0]?.games || 0, wagered: agg[0]?.wagered || 0, chips: chips[0]?.chips || 0, converted: chips[0]?.converted || 0 } });
  }
  return null;
}

export async function blackjackMutate(ctx) {
  const { sub, method, body, db, gidLong, h, session, premium } = ctx;
  if (!premium) return premiumRequired();
  if (sub === 'blackjack' && (method === 'PUT' || method === 'PATCH')) {
    const doc = await db.collection('blackjack_settings').findOne({ guild_id: gidLong }) || {};
    const existing = { ...B, setup_completed: false };
    for (const k of KEYS) if (doc[k] !== undefined) existing[k] = doc[k];
    const { patch, errors } = sanitizeBlackjack(body, existing);
    if (errors.length) return validationError(errors);
    await db.collection('blackjack_settings').updateOne(
      { guild_id: gidLong }, { $set: { ...patch, updated_at: new Date() }, $setOnInsert: { guild_id: gidLong, created_at: new Date() } }, { upsert: true },
    );
    await auditLog(db, gidLong, 'admin_modification', session?.user?.id, { detail: `Games settings changed: ${Object.keys(patch).join(', ')}`, toLong: h.toLong });
    return json({ ok: true, settings: { ...existing, ...patch } });
  }
  if (sub === 'blackjack/reset' && method === 'POST') {
    const scope = String(body.scope || '');
    if (!['stats', 'chips'].includes(scope)) return validationError([{ field: 'scope', code: 'invalid_choice' }]);
    if (body.confirm !== `blackjack-${scope}`) return validationError([{ field: 'confirm', code: 'confirm_mismatch' }]);
    if (scope === 'stats') { await db.collection('blackjack_stats').deleteMany({ guild_id: gidLong }); await db.collection('blackjack_history').deleteMany({ guild_id: gidLong }); }
    else await db.collection('blackjack_wallets').deleteMany({ guild_id: gidLong });
    await auditLog(db, gidLong, 'economy_reset', session?.user?.id, { detail: `Blackjack reset: ${scope}`, toLong: h.toLong });
    return json({ ok: true });
  }
  return null;
}

// FILE: route.js
// PUNE ÎN: app/api/leaderboard/[guildId]/route.js
//
// Public, read-only, no login required, same "just a display page" spirit
// as app/api/verify/[guildId]/route.js's GET: no session is read here at
// all, and nothing here can write to anything. Powers the public
// /leaderboard/[guildId] page and the Leaderboard button the bot attaches
// to every level-up message (cogs/levels.py, _leaderboard_button()).
//
// Deliberately does NOT gate on level_enabled/module_states.levels: the
// Levels panel's own hint already promises "existing ranks/leaderboard
// stay visible" when the master switch is off (app/[locale]/dashboard/
// [guildId]/page.js, levelingSystemHint), turning XP gain off is not the
// same as erasing a server's history.
//
// Paginated rather than a hard Top 100 cutoff: PAGE_SIZE per page, with
// `page` (1-indexed) as a query param, so a server with more than 100
// active members still has every one of them reachable, just a page at a
// time, like any other paginated listing.
import { NextResponse } from 'next/server';
import { getDb, toLong } from '@/lib/mongo';
import { getBotGuild, getGuildMembersProfileMap, guildIconUrl } from '@/lib/discord';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const PAGE_SIZE = 25;

function json(data, init = {}) {
  return NextResponse.json(data, { ...init, headers: { 'Cache-Control': 'no-store, private', ...(init.headers || {}) } });
}

function validGuildId(guildId) {
  return /^\d{5,25}$/.test(String(guildId || ''));
}

// Same formula as the bot's cogs/levels.py xp_for_level(), kept in sync by
// hand since the two run in different languages, XP required to go from
// `level` to `level + 1`.
function xpForLevel(level) {
  return 5 * (level ** 2) + 50 * level + 100;
}

// Only members who have actually earned XP are counted here, same filter
// and same reasoning as the bot's HAS_XP_FILTER (cogs/levels.py): a
// levels document can exist at level 0 / xp 0 (e.g. after /setxp resets
// someone), and without this that member would still take up a leaderboard
// slot at 0/0.
const HAS_XP_FILTER = { $or: [{ xp: { $gt: 0 } }, { level: { $gt: 0 } }] };

export async function GET(request, { params }) {
  const { guildId } = await params;
  if (!validGuildId(guildId)) return json({ error: 'invalid_guild_id' }, { status: 400 });

  const { searchParams } = new URL(request.url);
  const requestedPage = parseInt(searchParams.get('page'), 10);
  const page = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;

  // Wrapped: same gap as the public leaderboard page had, a database blip
  // here used to crash with an uncaught MongoServerSelectionError (a hard
  // 500) instead of a clean, small JSON error response.
  try {
    const db = await getDb();
    const gidLong = toLong(guildId);
    const filter = { guild_id: gidLong, ...HAS_XP_FILTER };

    const [guild, total, rows] = await Promise.all([
      getBotGuild(guildId, { withCounts: true }).catch(() => null),
      db.collection('levels').countDocuments(filter),
      db.collection('levels').find(filter).sort({ level: -1, xp: -1 })
        .skip((page - 1) * PAGE_SIZE).limit(PAGE_SIZE).toArray(),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    // A guild Wody isn't in (left, kicked, bad id) has no name/icon to show,
    // but its historical XP data, if any survives, is still just data, not
    // something tied to the bot's current membership, so it's still served
    // rather than turned into a 404.
    const profiles = await getGuildMembersProfileMap(guildId, rows.map((r) => r.user_id));

    const members = rows.map((r, idx) => {
      const level = r.level || 0;
      const xp = r.xp || 0;
      const needed = xpForLevel(level);
      const profile = profiles.get(String(r.user_id)) || { state: 'unknown', name: null, avatar_url: null };
      return {
        rank: (page - 1) * PAGE_SIZE + idx + 1,
        user_id: String(r.user_id),
        name: profile.name || null,
        avatar_url: profile.avatar_url || null,
        // Only a Discord-confirmed "Unknown Member" counts as left; a failed
        // or rate-limited lookup ('unknown') must never be shown as left.
        left_server: profile.state === 'left',
        level,
        xp,
        needed,
        progress: needed > 0 ? Math.max(0, Math.min(1, xp / needed)) : 0,
      };
    });

    return json({
      guild: guild ? { name: guild.name, icon_url: guildIconUrl(guild), member_count: guild.approximate_member_count ?? null } : null,
      members,
      page,
      total_pages: totalPages,
      total_members: total,
    });
  } catch (error) {
    console.error('leaderboard API failed', error);
    return json({ error: 'unavailable' }, { status: 503 });
  }
}


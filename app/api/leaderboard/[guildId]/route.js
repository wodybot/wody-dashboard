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

function xpForLevel(level) {
  return 5 * (level ** 2) + 50 * level + 100;
}

const HAS_XP_FILTER = { $or: [{ xp: { $gt: 0 } }, { level: { $gt: 0 } }] };

export async function GET(request, { params }) {
  const { guildId } = await params;
  if (!validGuildId(guildId)) return json({ error: 'invalid_guild_id' }, { status: 400 });

  const { searchParams } = new URL(request.url);
  const requestedPage = parseInt(searchParams.get('page'), 10);
  const page = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;

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


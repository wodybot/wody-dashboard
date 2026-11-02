import { getDiscordComponentEmbed } from '@/lib/discord-component-embed';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  const payload = await getDiscordComponentEmbed();
  return Response.json(payload, {
    headers: {
      'Cache-Control': 'public, max-age=0, s-maxage=60, stale-while-revalidate=300',
    },
  });
}

import { getOgEmbedConfig } from '@/lib/og-embed';
import { renderOgImage, normalizeVariant } from '@/lib/og-render';

// Any look on demand: /api/og?variant=passport|showcase|minimal|classic.
// Public and read-only (it only draws the saved texts), used by the Owner
// Panel to preview and compare the looks next to each other. No cookies.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request) {
  const url = new URL(request.url);
  const config = await getOgEmbedConfig();
  const variant = normalizeVariant(url.searchParams.get('variant') || config.variant);
  return renderOgImage(config, variant);
}

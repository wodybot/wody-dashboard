import { getOgEmbedConfig } from '@/lib/og-embed';
import { renderOgImage, normalizeVariant } from '@/lib/og-render';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request) {
  const url = new URL(request.url);
  const config = await getOgEmbedConfig();
  const variant = normalizeVariant(url.searchParams.get('variant') || config.variant);
  return renderOgImage(config, variant);
}

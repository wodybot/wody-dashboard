import { getOgEmbedConfig } from '@/lib/og-embed';
import { renderOgImage, OG_SIZE } from '@/lib/og-render';

export const size = OG_SIZE;
export const contentType = 'image/png';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function OGImage() {
  const config = await getOgEmbedConfig();
  return renderOgImage(config, config.variant);
}

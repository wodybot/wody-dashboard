import { getOgEmbedConfig } from '@/lib/og-embed';
import { renderOgImage, OG_SIZE } from '@/lib/og-render';

// The card Discord and other sites show when wody.online is pasted in a chat.
// The look (passport, showcase, minimal or classic) is the one picked in the
// Owner Panel, see lib/og-render.jsx. Rendered on every request (the config
// read is cached for a minute and refreshed instantly on save), so a change
// in the panel shows up without a redeploy.
export const size = OG_SIZE;
export const contentType = 'image/png';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function OGImage() {
  const config = await getOgEmbedConfig();
  return renderOgImage(config, config.variant);
}

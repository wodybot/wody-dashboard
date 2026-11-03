import { getOgEmbedConfig, OG_EMBED_DEFAULT_BUTTONS } from '@/lib/og-embed';
import { refreshDiscordAttachmentUrl } from '@/lib/discord';

const BUTTONS = OG_EMBED_DEFAULT_BUTTONS;

function httpsUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' ? parsed.toString() : null;
  } catch {
    return null;
  }
}

const SITE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://wody.online';

export async function getDiscordComponentEmbed() {
  const config = await getOgEmbedConfig();
  const generatedMedia = `${SITE_URL}/opengraph-image${config.updated_at ? `?v=${config.updated_at}` : ''}`;
  const media = await refreshDiscordAttachmentUrl(httpsUrl(config.media_url)) || generatedMedia;
  const buttons = config.buttons;
  const buttonsHeading = String(config.buttons_heading || '').trim();

  return {
    component: {
      type: 17,
      components: [
        {
          type: 10,
          content: `# ${config.title}`,
        },
        {
          type: 10,
          content: `**${config.subtitle}**\n${config.tagline}`,
        },
        {
          type: 12,
          items: [
            {
              media: { url: media },
              description: `${config.title} Discord bot preview`,
            },
          ],
        },
        ...(buttonsHeading ? [{ type: 10, content: buttonsHeading }] : []),
        {
          type: 1,
          components: buttons.map((button) => ({
            type: 2,
            style: 5,
            label: button.label,
            url: button.url,
          })),
        },
      ],
    },
  };
}

export { BUTTONS };

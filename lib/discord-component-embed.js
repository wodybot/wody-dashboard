import { getOgEmbedConfig, OG_EMBED_DEFAULT_BUTTONS } from '@/lib/og-embed';
import { refreshDiscordAttachmentUrl } from '@/lib/discord';

// Kept as a named export for backward compat (nothing else in this repo
// imports it anymore, everything now goes through config.buttons below,
// which og-embed.js already falls back to this exact same default list
// for), but some other script or a future admin tool may still reach
// for the old constant.
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
  // Cache-bust ONLY the auto-generated card (config.media_url unset): a
  // custom media_url is the owner's own external image, its caching is
  // their own URL's business, not something to second-guess here. The
  // generated /opengraph-image route always renders fresh server-side
  // (see the dynamic export there), but Discord (and any CDN in front of
  // this site) caches image BYTES by exact URL, separately from how
  // often it re-fetches this very JSON's text. Without ?v= changing on
  // every save, editing the title/tagline updates the text Discord shows
  // but the picture next to it keeps showing whatever got cached under
  // the old, unchanged URL.
  const generatedMedia = `${SITE_URL}/opengraph-image${config.updated_at ? `?v=${config.updated_at}` : ''}`;
  // A custom media_url is refreshed here if (and only if) it's a Discord
  // attachment CDN link, see refreshDiscordAttachmentUrl(): that's what
  // was going stale after a few days, the auto-generated image never hits
  // this path since generatedMedia is this site's own URL, not Discord's.
  const media = await refreshDiscordAttachmentUrl(httpsUrl(config.media_url)) || generatedMedia;
  // config.buttons always comes back as a non-empty, pre-validated array
  // (see normalizeButtons in lib/og-embed.js, it falls back to
  // OG_EMBED_DEFAULT_BUTTONS itself if the stored value is ever missing
  // or corrupt), so no extra fallback is needed here.
  const buttons = config.buttons;
  const buttonsHeading = String(config.buttons_heading || '').trim();

  // Keep this intentionally small: Discord fetches the JSON while unfurling
  // the URL, and component-embed payloads are expected to stay compact.
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
        // Optional line above the button row, owner-editable from the
        // panel (Appearance -> Discord Link Preview -> "Text above
        // buttons"). Discord renders this exactly like every other
        // type-10 text component above, so **bold**/*italic*/links all
        // work here the same as in the title/subtitle block.
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

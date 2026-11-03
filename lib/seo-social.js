const SITE = (process.env.NEXT_PUBLIC_BASE_URL || 'https://wody.online').replace(/\/+$/, '');
export const OG_IMAGES = [
  { url: `${SITE}/opengraph-image`, width: 1200, height: 630, alt: 'Wody Discord bot' },
];
export const TWITTER_CARD = { card: 'summary_large_image', images: [`${SITE}/opengraph-image`] };

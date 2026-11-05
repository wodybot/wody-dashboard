const SITE = (process.env.NEXT_PUBLIC_BASE_URL || 'https://wody.online').replace(/\/+$/, '');
export const OG_IMAGES = [
  { url: `${SITE}/opengraph-image`, width: 1200, height: 630, alt: 'Wody Discord bot' },
];
export const TWITTER_CARD = { card: 'summary_large_image', images: [`${SITE}/opengraph-image`] };

// Animated link preview of a module, drawn in the look of the homepage ad. The address always answers: when no GIF is published
// for the module yet it forwards to the static image, so a shared link never shows a broken picture.
export const moduleGifUrl = (module, locale = 'en') => `${SITE}/api/gif-preview/for/${module}.${locale}.gif`;
export const moduleOgImages = (module, locale = 'en') => [
  { url: moduleGifUrl(module, locale), width: 1200, height: 630, type: 'image/gif', alt: 'Wody' },
  ...OG_IMAGES,
];
export const moduleTwitter = (module, locale = 'en') => ({ card: 'summary_large_image', images: [moduleGifUrl(module, locale)] });

const SITE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://wody.online';

export default function robots() {
  return {
    rules: [
      {
        userAgent: '*',
        // /dashboard is disallowed under every locale prefix (e.g.
        // /fr/dashboard, /ro/dashboard) since it requires login regardless
        // of language, plus the unprefixed default-locale path.
        // Public community banners and icons live under /api/community, they are allowed so
        // they can appear in search results and social previews. The preview frame is internal.
        allow: ['/', '/api/community/img/', '/api/community/icon/', '/api/collab/file/'],
        disallow: ['/dashboard', '/*/dashboard', '/profile', '/*/profile', '/api', '/servers/preview-frame', '/*/servers/preview-frame', '/invite', '/*/invite', '/verify', '/*/verify', '/servers/favorites', '/*/servers/favorites'],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}

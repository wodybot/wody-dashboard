const SITE_URL = (process.env.NEXT_PUBLIC_BASE_URL || 'https://wody.online').replace(/\/+$/, '');

export default function robots() {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/api/community/img/', '/api/community/icon/', '/api/collab/file/'],
        disallow: ['/dashboard', '/*/dashboard', '/profile', '/*/profile', '/api', '/servers/preview-frame', '/*/servers/preview-frame', '/invite', '/*/invite', '/verify', '/*/verify', '/servers/favorites', '/*/servers/favorites'],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}

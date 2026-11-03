const createNextIntlPlugin = require('next-intl/plugin');
const withNextIntl = createNextIntlPlugin('./i18n/request.js');

const OWN_ORIGINS = [...new Set(['https://wody.online', (() => {
  try { return process.env.NEXT_PUBLIC_BASE_URL ? new URL(process.env.NEXT_PUBLIC_BASE_URL).origin : ''; } catch { return ''; }
})()].filter(Boolean))].join(' ');

const nextConfig = {
  output: 'standalone',
  outputFileTracingIncludes: {
    '/**': ['./assets/fonts/**/*'],
  },
  images: {
    minimumCacheTTL: 604800,
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
    ],
  },
  serverExternalPackages: ['mongodb'],
  webpack(config, { dev }) {
    if (dev) {
      config.watchOptions = {
        poll: 2000,
        aggregateTimeout: 300,
        ignored: ['**/node_modules'],
      };
    }
    return config;
  },
  onDemandEntries: {
    maxInactiveAge: 10000,
    pagesBufferLength: 2,
  },
  async redirects() {
    return [
      { source: '/:locale(en|ro|fr|it|de|es|pt|nl|tr)/dashboard/market' + 'place', destination: '/:locale/profile', permanent: true },
      { source: '/:locale(en|ro|fr|it|de|es|pt|nl|tr)/dashboard/collab', destination: '/:locale/profile', permanent: true },
      { source: '/dashboard/collab', destination: '/profile', permanent: true },
      { source: '/:locale(en|ro|fr|it|de|es|pt|nl|tr)/market' + 'place/:path*', destination: '/:locale/collab/:path*', permanent: true },
      { source: '/dashboard/market' + 'place', destination: '/profile', permanent: true },
      { source: '/market' + 'place/:path*', destination: '/collab/:path*', permanent: true },
      { source: '/api/market' + 'place/:path*', destination: '/api/collab/:path*', permanent: true },
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'www.wody.online' }],
        destination: 'https://wody.online/:path*',
        permanent: true,
      },
    ];
  },
  async headers() {
    const corsOrigin = process.env.CORS_ORIGINS;
    const headers = [
      { key: "X-Frame-Options", value: "SAMEORIGIN" },
      {
        key: "Content-Security-Policy",
        value: [
          "frame-ancestors 'self'",
          `img-src 'self' data: blob: ${OWN_ORIGINS}`,
          "media-src 'self' data: blob:",
          "font-src 'self' data:",
          "connect-src 'self'",
          "frame-src 'self'",
          "object-src 'none'",
        ].join('; ') + ';',
      },
      { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    ];
    if (corsOrigin && corsOrigin !== '*') {
      headers.push(
        { key: "Access-Control-Allow-Origin", value: corsOrigin },
        { key: "Access-Control-Allow-Methods", value: "GET, POST, PUT, DELETE, OPTIONS" },
        { key: "Access-Control-Allow-Headers", value: "*" },
      );
    }
    return [
      {
        source: "/(.*)",
        headers,
      },
    ];
  },
};

module.exports = withNextIntl(nextConfig);

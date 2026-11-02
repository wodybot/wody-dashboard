const createNextIntlPlugin = require('next-intl/plugin');
const withNextIntl = createNextIntlPlugin('./i18n/request.js');

// Our own origins (the canonical domain and NEXT_PUBLIC_BASE_URL). Preset
// pictures are saved as absolute https://wody.online/presets/... links, so a
// preview deployment on another host still shows them. Never a third party.
const OWN_ORIGINS = [...new Set(['https://wody.online', (() => {
  try { return process.env.NEXT_PUBLIC_BASE_URL ? new URL(process.env.NEXT_PUBLIC_BASE_URL).origin : ''; } catch { return ''; }
})()].filter(Boolean))].join(' ');

const nextConfig = {
  output: 'standalone',
  // Without this, `output: 'standalone'` only bundles files Next.js can
  // trace through static imports. app/opengraph-image.js reads
  // assets/fonts/*.ttf at runtime via fs.readFile (see that file for why
  // it needs a font pinned explicitly), which isn't a static import, so
  // those font files would silently be missing from the production
  // build without this, turning into an ENOENT at request time. The
  // broad '/**' key (every route, not just /opengraph-image) costs
  // nothing meaningful here, the two font files together are well under
  // 200kB, and it's one less exact-path assumption to keep in sync if
  // this file ever moves.
  outputFileTracingIncludes: {
    '/**': ['./assets/fonts/**/*'],
  },
  images: {
    // Was `unoptimized: true` everywhere, which makes next/image behave
    // like a plain <img>: the exact same file is served no matter the
    // viewport or device pixel ratio. Blog cover images used a raw <img>
    // for the same reason (see app/[locale]/blog). That's why a cover
    // photo looked fine on a phone (small CSS box, high-PPI screen hides
    // any softness) and soft/blurry on a desktop monitor (same file
    // stretched across a much wider box at a lower PPI, so any shortfall
    // in the source resolution becomes visible). Turning optimization
    // back on lets Next.js generate a properly-sized, sharp variant per
    // breakpoint/DPR via the <Image> component instead.
    // Optimized copies are kept for a day before Next.js checks the source
    // again (the default is 60 s), so repeat visitors and every other
    // visitor get the already resized banner instead of a fresh resize.
    minimumCacheTTL: 604800,
    remotePatterns: [
      // Cover images are plain URLs an owner pastes into the blog editor
      // (lib/blog.js), not uploads to a fixed host, so every https host is
      // allowed here; this route is owner-only (see the blog admin API
      // guard), never public input.
      { protocol: 'https', hostname: '**' },
    ],
  },
  // Renamed from experimental.serverComponentsExternalPackages in Next 15
  serverExternalPackages: ['mongodb'],
  webpack(config, { dev }) {
    if (dev) {
      // Reduce CPU/memory from file watching
      config.watchOptions = {
        poll: 2000, // check every 2 seconds
        aggregateTimeout: 300, // wait before rebuilding
        ignored: ['**/node_modules'],
      };
    }
    return config;
  },
  onDemandEntries: {
    maxInactiveAge: 10000,
    pagesBufferLength: 2,
  },
  // Canonical domain is wody.online (no www). Anyone hitting www.wody.online
  // gets bounced there permanently, so there's only ever one origin the
  // session cookie, OAuth redirect, and NEXT_PUBLIC_BASE_URL need to agree
  // on. This is a defense-in-depth alongside the Vercel domain redirect,
  // see the deployment notes for the Vercel-side setting.
  async redirects() {
    return [
      // The service was renamed to Collab. Links and bookmarks that use the old address keep working.
      { source: '/:locale(en|ro|fr|it|de|es|pt|nl|tr)/dashboard/market' + 'place', destination: '/:locale/profile', permanent: true },
      // The Collab hub moved into the profile (one place for collabs, applications, messages and settings).
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
  // Previously this set X-Frame-Options: ALLOWALL + CSP frame-ancestors: *,
  // which let ANY site iframe the dashboard (clickjacking exposure on
  // authenticated pages like /dashboard/[guildId]), plus a blanket
  // Access-Control-Allow-Origin: * on every route including the API.
  // SameSite=Lax on wody_session already stops the cookie from following
  // into a cross-site iframe/fetch, which is why this was never actually
  // exploited, but it shouldn't rely on that as the only line of defense.
  // Now: framing is same-origin only, and CORS headers are only sent at all
  // if CORS_ORIGINS is explicitly set to a real origin (never "*", if you
  // need a specific external site to call the API, put that site's exact
  // origin in CORS_ORIGINS, e.g. "https://partner-site.com").
  async headers() {
    const corsOrigin = process.env.CORS_ORIGINS;
    const headers = [
      { key: "X-Frame-Options", value: "SAMEORIGIN" },
      // frame-ancestors: framing is same-origin only (see above).
      // The other directives are the browser-side guarantee of the Cookie
      // Policy: pictures, media, fonts, background requests and frames may
      // ONLY come from our own origin (plus inline data:/blob: previews).
      // Third-party image hosts (imgur, giphy, Discord's CDN, Twitch,
      // TikTok, ...) set their own cookies on any direct request, so the
      // browser refuses such a request outright even if a future change
      // forgets to route a picture through /api/img-proxy, /api/discord-cdn
      // or /_next/image. Scripts and styles are deliberately not restricted
      // here (Next.js needs its inline bootstrap scripts), and the site
      // loads no third-party scripts at all (scripts/check-privacy.js).
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
      // Forces the browser to only ever talk to this origin over HTTPS,
      // even if someone types/links http:// or an old bookmark points at
      // it, belt-and-suspenders alongside the www redirect above, since
      // that redirect itself still requires one plaintext HTTP round trip
      // the first time. 2 years, applies to subdomains, eligible for the
      // browser HSTS preload list.
      { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
      // Stops the browser from guessing content types and executing a file
      // as something other than what it was actually served as (e.g. a
      // user-controlled upload being sniffed as HTML/JS).
      { key: "X-Content-Type-Options", value: "nosniff" },
      // Full URL (including path/query) is sent as the referrer on
      // same-origin navigation, but only the origin (no path/query) leaks
      // to other sites when someone clicks an outbound link, avoids
      // leaking things like session-adjacent URLs to third parties.
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

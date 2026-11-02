// FILE: promo-banner.jsx
// PUNE ÎN: components/promo-banner.jsx
// (fișier nou în proiectul wody-dashboard-main la această cale)

import { proxiedImageUrl } from '@/lib/utils';

// Promotional banner shown at the top of a server's dashboard Overview
// tab (see DashboardPromoBanner in app/[locale]/dashboard/[guildId]/page.js,
// which fetches the config and renders this). One global banner, the
// same for every server, set from the owner panel (see
// lib/promo-banner.js), there is no hardcoded heading here on purpose:
// the image itself IS the banner's message, whatever the owner uploads,
// this component only adds the one button on top of it.
//
// The button is optional: a banner is often just an image with nowhere
// obvious to click, not every promo needs a labeled call-to-action, so
// buttonText can be left blank. When it is, no button is drawn at all
// and the whole image becomes the link instead (wrapped in a single <a>),
// so the banner is always clickable one way or the other as long as
// buttonUrl is set (enforced by getPromoBanner()/parsePromoBannerPatch in
// lib/promo-banner.js, buttonUrl is required, buttonText never is).
//
// No dark overlay is drawn behind the button: the owner-uploaded image is
// shown exactly as-is, contrast for the button (and for any text already
// baked into the image) is the owner's own design call when they make the
// banner image, not something this component should darken on top of.
//
// No 'use client' here: this has no state or interactivity beyond plain
// <a> links, so it works the same whether the page rendering it is a
// server or a client component. Plain <img>, not next/image, matching
// how every other owner-supplied image URL in this app is rendered (e.g.
// welcome/goodbye card backgrounds), rather than needing the image's
// host added to next.config just for this one field.
export function PromoBanner({ banner, className = '' }) {
  if (!banner) return null;
  const hasButton = !!banner.buttonText;
  const image = (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={proxiedImageUrl(banner.imageUrl)}
        alt=""
        className="block w-full h-auto"
        loading="eager"
      />
      {hasButton && (
        // Padding/font/offset are smaller on phones on purpose: at h-44
        // (the mobile banner height), the previous px-5 py-2.5 text-sm
        // button, sitting 20px from each edge, covered a large chunk of
        // a fairly short image. sm: and up (tablet/desktop, where the
        // banner is also taller) keeps the original, larger sizing.
        <div className="absolute right-3 bottom-3 sm:right-8 sm:bottom-8 max-w-[calc(100%-1.5rem)] sm:max-w-[calc(100%-4rem)]">
          <a href={banner.buttonUrl} target="_blank" rel="noopener noreferrer">
            <button className="gradient-primary max-w-full truncate whitespace-nowrap rounded-md sm:rounded-lg px-3 py-1.5 sm:px-5 sm:py-2.5 text-xs sm:text-sm font-semibold text-white shadow-lg transition-transform hover:scale-[1.03]">
              {banner.buttonText}
            </button>
          </a>
        </div>
      )}
    </>
  );

  if (hasButton) {
    return (
      <div className={`relative overflow-hidden rounded-2xl border border-border/50 shadow-lg ${className}`}>
        {image}
      </div>
    );
  }

  // No button text: the entire image is the link, no separate button
  // drawn on top of it. A single <a> wraps the image directly rather
  // than nesting a link inside another link (the button branch above
  // never reaches this path, so there's no risk of a link-in-a-link).
  return (
    <a
      href={banner.buttonUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={`relative overflow-hidden rounded-2xl border border-border/50 shadow-lg block transition-opacity hover:opacity-90 ${className}`}
    >
      {image}
    </a>
  );
}

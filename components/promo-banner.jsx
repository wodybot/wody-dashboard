
import { proxiedImageUrl } from '@/lib/utils';

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

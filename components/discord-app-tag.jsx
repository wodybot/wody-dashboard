// The official Discord "APP" tag of a verified app: blurple chip, white check mark, the word APP.
// One inline SVG (no emoji, so it looks the same on every device) used everywhere the site shows the bot name.
export default function DiscordAppTag({ className = '', size = 'md' }) {
  const s = size === 'xs'
    ? { h: 'h-[10px] px-[3px] gap-[1px] text-[6px] rounded-[2px]', i: 'h-[6px] w-[6px]' }
    : size === 'lg'
      ? { h: 'h-[18px] px-1.5 gap-[3px] text-[11px] rounded-[4px]', i: 'h-[11px] w-[11px]' }
      : { h: 'h-[15px] px-1 gap-[2px] text-[10px] rounded-[3px]', i: 'h-[10px] w-[10px]' };
  return (
    <span className={`inline-flex shrink-0 items-center bg-[#5865f2] font-semibold uppercase leading-none text-white align-middle ${s.h} ${className}`}>
      <svg viewBox="0 0 16 16" className={s.i} fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d="M3 8.6 6.4 12 13 4.6" /></svg>
      APP
    </span>
  );
}

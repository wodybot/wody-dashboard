import { SimpleMarkdown } from '@/components/simple-markdown';
import { proxiedImageUrl } from '@/lib/utils';

const TAG_STYLES = {
  Feature: 'border-[#c46a2d]/50 bg-[#c46a2d]/10 text-[#f2c091]',
  Fix: 'border-sky-500/40 bg-sky-500/10 text-sky-300',
  Announcement: 'border-violet-500/40 bg-violet-500/10 text-violet-300',
  Update: 'border-border/70 bg-card/60 text-muted-foreground',
};
const TAG_ACCENT = { Feature: '#e08a4e', Fix: '#38bdf8', Announcement: '#a78bfa', Update: '#d4c5b0' };

export function Credits({ credits, label }) {
  if (!credits?.length) return null;
  return (
    <div className="mt-6 border-t border-border/50 pt-4 text-center">
      <div className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">{label}:</div>
      <ul className="flex flex-wrap justify-center gap-x-6 gap-y-1.5">
        {credits.map((c, i) => (
          <li key={`${c.name}-${i}`} className="text-sm">
            <span className="font-semibold text-foreground">{c.name}</span>
            {c.role ? <span className="text-muted-foreground"> · {c.role}</span> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** One update, shared by the public Updates page and the owner panel preview. */
export function UpdateEntry({ u, tagLabel, dateText, dateTime, creditsLabel }) {
  const accent = TAG_ACCENT[u.tag] || TAG_ACCENT.Update;
  const poster = u.layout === 'poster';
  const cover = u.image_url ? proxiedImageUrl(u.image_url) : '';
  const meta = (
    <div className="mb-3 flex flex-wrap items-center gap-3">
      <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${TAG_STYLES[u.tag] || TAG_STYLES.Update}`}>{tagLabel}</span>
      {dateText ? <time className="text-xs text-muted-foreground" dateTime={dateTime}>{dateText}</time> : null}
    </div>
  );
  return (
    <article className="overflow-hidden rounded-3xl border border-border/70 bg-card/55 backdrop-blur-sm">
      {poster ? (
        <div className="relative isolate aspect-[16/9] min-h-[220px] w-full overflow-hidden bg-gradient-to-br from-[#2a1509] to-[#120a06] sm:aspect-[1200/630]">
          {cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={proxiedImageUrl(cover)} alt="" className="absolute inset-0 -z-10 h-full w-full object-cover" />
          ) : (
            <div className="absolute -right-24 -top-24 -z-10 h-80 w-80 rounded-full bg-[#e08a4e]/25 blur-3xl" aria-hidden="true" />
          )}
          <div className="absolute inset-0 -z-10 bg-gradient-to-b from-black/35 via-black/35 to-black/90" aria-hidden="true" />
          <div className="flex h-full flex-col justify-between p-5 sm:p-8">
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#d89a5c]/60 bg-gradient-to-br from-[#8a3c14] to-[#6b2e10] text-sm font-bold text-white">W</span>
              <span className="text-xs font-bold tracking-[0.3em] text-white">WODY</span>
              <span className="rounded-full border px-3 py-0.5 text-[11px] font-bold uppercase tracking-wider" style={{ borderColor: accent, color: accent }}>{tagLabel}</span>
            </div>
            <div>
              <h2 className="max-w-[28ch] text-2xl font-bold leading-tight tracking-tight text-white sm:text-4xl">{u.title}</h2>
              <div className="my-3 h-1 w-14 rounded-full" style={{ background: accent }} />
              <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 text-xs text-white/80 sm:text-sm">
                {dateText ? <time dateTime={dateTime}>{dateText}</time> : <span />}
                {u.credits?.length ? <span><b className="mr-2 text-[10px] tracking-[0.2em]" style={{ color: accent }}>{creditsLabel?.toUpperCase()}:</b>{u.credits.slice(0, 4).map((c) => c.name).join('  ·  ')}</span> : null}
              </div>
            </div>
          </div>
        </div>
      ) : cover ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={proxiedImageUrl(cover)} alt="" loading="lazy" className="aspect-[1200/500] w-full object-cover" />
      ) : null}
      <div className="p-6 sm:p-8">
        {poster ? null : (
          <>
            {meta}
            <h2 className="mb-3 text-xl font-semibold sm:text-2xl">{u.title}</h2>
          </>
        )}
        <SimpleMarkdown text={u.body} className="text-sm text-muted-foreground sm:text-base" />
        {u.gallery?.length ? (
          <>
            <div className="my-6 h-px bg-border/50" role="separator" />
            <div className={`grid gap-3 ${u.gallery.length === 1 ? '' : 'sm:grid-cols-2'}`}>
              {u.gallery.map((g, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={`${g}-${i}`} src={proxiedImageUrl(g)} alt="" loading="lazy" className="w-full rounded-xl border border-border/60 object-cover" />
              ))}
            </div>
          </>
        ) : null}
        <Credits credits={u.credits} label={creditsLabel} />
      </div>
    </article>
  );
}

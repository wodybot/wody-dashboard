// The shape of a server dashboard (sidebar, header and module cards) shown the moment a server is opened, before its data arrives.
// Used by the route loading state and by the dashboard itself, so the page never jumps from an empty screen to the real layout.
export default function GuildSkeleton({ label }) {
  return (
    <div className="min-h-screen flex" role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">{label}</span>
      <aside className="hidden lg:flex w-80 shrink-0 flex-col border-r border-sidebar-border bg-sidebar" aria-hidden="true">
        <div className="flex items-center gap-3 border-b border-sidebar-border/80 px-4 pt-5 pb-4">
          <div className="h-11 w-11 rounded-xl bg-secondary animate-pulse" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-36 rounded bg-secondary animate-pulse" />
            <div className="h-3 w-24 rounded bg-secondary/70 animate-pulse" />
          </div>
        </div>
        <div className="space-y-2 px-3 pt-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="h-9 rounded-lg bg-secondary/40 animate-pulse" style={{ animationDelay: `${i * 40}ms` }} />
          ))}
        </div>
      </aside>
      <div className="flex-1 min-w-0" aria-hidden="true">
        <div className="border-b border-border/50 px-4 sm:px-6 py-4">
          <div className="h-5 w-48 rounded bg-secondary animate-pulse" />
        </div>
        <div className="p-4 sm:p-6 pt-5 sm:pt-7 max-w-6xl">
          <div className="mb-6 space-y-2">
            <div className="h-6 w-56 rounded bg-secondary animate-pulse" />
            <div className="h-4 w-80 max-w-full rounded bg-secondary/60 animate-pulse" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-[220px] sm:h-[240px] rounded-xl border border-border/60 bg-card/40 animate-pulse" style={{ animationDelay: `${i * 60}ms` }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

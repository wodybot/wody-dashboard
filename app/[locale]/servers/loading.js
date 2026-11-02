// Shown instantly while /servers loads, so navigating to Discovery never feels stuck.
export default function Loading() {
  const card = (i) => (
    <div key={i} className="overflow-hidden rounded-2xl border border-border/60 bg-card/40">
      <div className="h-28 animate-pulse bg-secondary/40" />
      <div className="space-y-2 p-4">
        <div className="h-4 w-2/3 animate-pulse rounded bg-secondary/50" />
        <div className="h-3 w-full animate-pulse rounded bg-secondary/30" />
        <div className="h-3 w-4/5 animate-pulse rounded bg-secondary/30" />
      </div>
    </div>
  );
  return (
    <div className="min-h-screen" role="status" aria-busy="true">
      <div className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6">
        <div className="mx-auto mb-10 flex max-w-xl flex-col items-center gap-3">
          <div className="h-6 w-40 animate-pulse rounded-full bg-secondary/40" />
          <div className="h-10 w-full animate-pulse rounded-xl bg-secondary/40" />
          <div className="h-10 w-full animate-pulse rounded-xl bg-secondary/30" />
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{[0, 1, 2, 3, 4, 5, 6, 7].map(card)}</div>
      </div>
    </div>
  );
}

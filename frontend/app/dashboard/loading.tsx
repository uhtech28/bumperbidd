/**
 * Dashboard skeleton shown by Next while the initial render of
 * `app/dashboard/page.tsx` (and its data) is in flight. The skeleton
 * mimics the actual layout — top chrome, greeting block, two horizontal
 * rails — so the page doesn't visually shift when content fills in.
 */
export default function DashboardLoading() {
  return (
    <main className="relative min-h-screen bg-ink text-bone">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 h-80 bg-[radial-gradient(60%_100%_at_50%_0%,rgba(212,160,23,0.12),transparent_70%)]"
      />

      {/* Top chrome */}
      <div className="flex items-center justify-between px-5 pt-5">
        <div className="h-7 w-32 animate-pulse rounded-md bg-white/10" />
        <div className="flex items-center gap-3">
          <div className="h-7 w-20 animate-pulse rounded-full bg-white/10" />
          <div className="h-7 w-7 animate-pulse rounded-full bg-white/10" />
          <div className="h-8 w-8 animate-pulse rounded-full bg-white/10" />
        </div>
      </div>

      {/* Greeting */}
      <div className="px-5 pt-8">
        <div className="h-3 w-32 animate-pulse rounded bg-white/10" />
        <div className="mt-3 h-8 w-72 animate-pulse rounded bg-white/10" />
        <div className="mt-2 h-3 w-40 animate-pulse rounded bg-white/10" />
      </div>

      {/* Live auctions rail */}
      <div className="mt-8 px-5">
        <div className="h-4 w-40 animate-pulse rounded bg-white/10" />
      </div>
      <div className="mt-3 flex gap-3 overflow-hidden px-5">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-44 w-[260px] shrink-0 animate-pulse rounded-2xl bg-graphite/60"
          />
        ))}
      </div>

      {/* Featured grid */}
      <div className="mt-8 px-5">
        <div className="h-4 w-48 animate-pulse rounded bg-white/10" />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 px-5">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-36 animate-pulse rounded-xl bg-graphite/60"
          />
        ))}
      </div>
    </main>
  );
}

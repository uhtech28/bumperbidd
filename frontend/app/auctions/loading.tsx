/**
 * Auctions list skeleton shown while the `/auctions` page is fetching.
 * Five card-shaped placeholders match the typical render so the layout
 * doesn't jump.
 */
export default function AuctionsLoading() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6 h-8 w-56 animate-pulse rounded bg-neutral-200" />
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <li
            key={i}
            className="overflow-hidden rounded-lg border border-neutral-200 bg-white"
          >
            <div className="h-40 w-full animate-pulse bg-neutral-100" />
            <div className="space-y-2 p-3">
              <div className="h-4 w-3/4 animate-pulse rounded bg-neutral-100" />
              <div className="h-3 w-1/2 animate-pulse rounded bg-neutral-100" />
              <div className="h-5 w-24 animate-pulse rounded bg-neutral-100" />
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}

'use client';

/**
 * Watchlist page - user's saved auctions.
 * Uses the 2-query pattern on the server so no N+1. We just render the result.
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { watchlistApi, ApiError, type Auction } from '../../lib/api';
import { formatINR } from '../../lib/format';

export default function WatchlistPage() {
  const [items, setItems] = useState<Auction[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    watchlistApi
      .list()
      .then((r) => setItems(r.items))
      .catch((e: ApiError) => setErr(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function remove(id: string) {
    const prev = items;
    setItems(items.filter((a) => a.id !== id));
    try {
      await watchlistApi.remove(id);
    } catch (e) {
      setItems(prev);
      setErr((e as ApiError).message);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="mb-6 text-3xl font-bold">Your watchlist</h1>

      {err && (
        <div className="mb-4 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {err}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-neutral-500">Loading...</p>
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-neutral-300 p-10 text-center">
          <p className="text-neutral-600">You have no saved auctions yet.</p>
          <Link
            href="/auctions"
            className="mt-4 inline-block rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Browse live auctions
          </Link>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((a) => (
            <li key={a.id} className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
              {a.vehicle.imageUrls[0] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={a.vehicle.imageUrls[0]} alt={a.title} className="h-40 w-full object-cover" />
              ) : (
                <div className="h-40 w-full bg-neutral-100" />
              )}
              <div className="p-3">
                <Link href={`/auctions/${a.id}`} className="block font-medium hover:underline">
                  {a.title}
                </Link>
                <p className="text-xs text-neutral-500">
                  {a.vehicle.year} . {a.vehicle.fuelType} . {a.vehicle.city}
                </p>
                <p className="mt-2 font-semibold">
                  {formatINR(Math.round((a.live.currentHighBid ?? a.pricing.startingPrice) / 100))}
                </p>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-xs text-neutral-500">{a.status}</span>
                  <button
                    onClick={() => remove(a.id)}
                    className="text-xs text-red-600 hover:underline"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

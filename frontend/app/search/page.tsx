'use client';

/**
 * Search page — filters + trigram suggest.
 * Keeps filter state in URL so results are shareable.
 * Uses server-side Postgres FTS + pg_trgm (see backend/search module).
 */
import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { searchApi, ApiError, type Auction, type SearchFilters } from '../../lib/api';
import { formatINR } from '../../lib/format';

const FUELS: SearchFilters['fuelType'][] = ['petrol', 'diesel', 'ev', 'cng', 'hybrid'];

/**
 * Next.js 14 requires components that read URL search params to be wrapped
 * in a <Suspense> boundary so they can defer rendering during static export.
 * The inner component does the actual work; the default export is just the
 * boundary wrapper.
 */
export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-7xl px-4 py-8 text-sm text-neutral-500">
          Loading search…
        </div>
      }
    >
      <SearchPageInner />
    </Suspense>
  );
}

function SearchPageInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const [items, setItems] = useState<Auction[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<
    { id: string; title: string; make: string; modelName: string }[]
  >([]);

  const filters = useMemo<SearchFilters>(() => {
    const get = (k: string) => sp.get(k) || undefined;
    const num = (k: string) => {
      const v = sp.get(k);
      return v ? Number(v) : undefined;
    };
    return {
      q: get('q'),
      status: get('status') as SearchFilters['status'],
      fuelType: get('fuelType') as SearchFilters['fuelType'],
      minPrice: num('minPrice'),
      maxPrice: num('maxPrice'),
      yearFrom: num('yearFrom'),
      yearTo: num('yearTo'),
      city: get('city'),
      sort: (get('sort') as SearchFilters['sort']) || 'ending_soon',
      limit: 20,
    };
  }, [sp]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setErr(null);
    searchApi
      .search(filters)
      .then((r) => {
        if (cancelled) return;
        setItems(r.items);
        setNextCursor(r.nextCursor);
      })
      .catch((e: ApiError) => !cancelled && setErr(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [filters]);

  useEffect(() => {
    if (!filters.q || filters.q.length < 2) {
      setSuggestions([]);
      return;
    }
    const h = setTimeout(() => {
      searchApi
        .suggest(filters.q!)
        .then((r) => setSuggestions(r.items))
        .catch(() => setSuggestions([]));
    }, 200);
    return () => clearTimeout(h);
  }, [filters.q]);

  function updateFilter(key: keyof SearchFilters, value: string | number | undefined) {
    const params = new URLSearchParams(sp.toString());
    if (value === undefined || value === '' || value === null) params.delete(key);
    else params.set(key, String(value));
    router.replace(`/search?${params.toString()}`);
  }

  async function loadMore() {
    if (!nextCursor) return;
    setLoading(true);
    try {
      const r = await searchApi.search({ ...filters, cursor: nextCursor });
      setItems((prev) => [...prev, ...r.items]);
      setNextCursor(r.nextCursor);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="mb-6 text-3xl font-bold">Search auctions</h1>

      <div className="grid gap-6 md:grid-cols-[260px_1fr]">
        <aside className="space-y-4 rounded-lg border border-neutral-200 bg-white p-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Keyword</label>
            <input
              className="w-full rounded border border-neutral-300 px-3 py-2 text-sm"
              placeholder="Make, model, title..."
              defaultValue={filters.q ?? ''}
              onBlur={(e) => updateFilter('q', e.currentTarget.value.trim() || undefined)}
            />
            {suggestions.length > 0 && (
              <ul className="mt-2 space-y-1 text-xs">
                {suggestions.map((s) => (
                  <li key={s.id}>
                    <Link href={`/auctions/${s.id}`} className="text-blue-600 hover:underline">
                      {s.make} {s.modelName} - {s.title}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Status</label>
            <select
              className="w-full rounded border border-neutral-300 px-2 py-2 text-sm"
              value={filters.status ?? ''}
              onChange={(e) => updateFilter('status', e.target.value || undefined)}
            >
              <option value="">Any</option>
              <option value="live">Live now</option>
              <option value="scheduled">Upcoming</option>
              <option value="ended">Ended</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Fuel</label>
            <div className="flex flex-wrap gap-1">
              {FUELS.map((f) => (
                <button
                  key={f}
                  onClick={() => updateFilter('fuelType', filters.fuelType === f ? undefined : f)}
                  className={`rounded-full border px-3 py-1 text-xs capitalize ${
                    filters.fuelType === f
                      ? 'border-blue-600 bg-blue-600 text-white'
                      : 'border-neutral-300 bg-white'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-xs font-medium">Min price</label>
              <input
                type="number"
                min={0}
                className="w-full rounded border border-neutral-300 px-2 py-2 text-sm"
                defaultValue={filters.minPrice ?? ''}
                onBlur={(e) =>
                  updateFilter('minPrice', e.currentTarget.value ? Number(e.currentTarget.value) : undefined)
                }
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Max price</label>
              <input
                type="number"
                min={0}
                className="w-full rounded border border-neutral-300 px-2 py-2 text-sm"
                defaultValue={filters.maxPrice ?? ''}
                onBlur={(e) =>
                  updateFilter('maxPrice', e.currentTarget.value ? Number(e.currentTarget.value) : undefined)
                }
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-xs font-medium">Year from</label>
              <input
                type="number"
                min={1990}
                max={2030}
                className="w-full rounded border border-neutral-300 px-2 py-2 text-sm"
                defaultValue={filters.yearFrom ?? ''}
                onBlur={(e) =>
                  updateFilter('yearFrom', e.currentTarget.value ? Number(e.currentTarget.value) : undefined)
                }
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Year to</label>
              <input
                type="number"
                min={1990}
                max={2030}
                className="w-full rounded border border-neutral-300 px-2 py-2 text-sm"
                defaultValue={filters.yearTo ?? ''}
                onBlur={(e) =>
                  updateFilter('yearTo', e.currentTarget.value ? Number(e.currentTarget.value) : undefined)
                }
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">City</label>
            <input
              className="w-full rounded border border-neutral-300 px-3 py-2 text-sm"
              placeholder="e.g. Mumbai"
              defaultValue={filters.city ?? ''}
              onBlur={(e) => updateFilter('city', e.currentTarget.value.trim() || undefined)}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Sort</label>
            <select
              className="w-full rounded border border-neutral-300 px-2 py-2 text-sm"
              value={filters.sort ?? 'ending_soon'}
              onChange={(e) => updateFilter('sort', e.target.value)}
            >
              <option value="ending_soon">Ending soon</option>
              <option value="newest">Newest</option>
              <option value="price_asc">Price: low to high</option>
              <option value="price_desc">Price: high to low</option>
            </select>
          </div>

          <button
            onClick={() => router.replace('/search')}
            className="mt-2 w-full rounded border border-neutral-300 bg-white px-3 py-2 text-sm font-medium hover:bg-neutral-50"
          >
            Clear filters
          </button>
        </aside>

        <section>
          {err && (
            <div className="mb-4 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">
              {err}
            </div>
          )}
          {loading && items.length === 0 ? (
            <p className="text-sm text-neutral-500">Searching...</p>
          ) : items.length === 0 ? (
            <p className="text-sm text-neutral-500">No auctions match your filters.</p>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {items.map((a) => (
                <li key={a.id} className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
                  <Link href={`/auctions/${a.id}`}>
                    {a.vehicle.imageUrls[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={a.vehicle.imageUrls[0]}
                        alt={a.title}
                        className="h-40 w-full object-cover"
                      />
                    ) : (
                      <div className="h-40 w-full bg-neutral-100" />
                    )}
                    <div className="p-3">
                      <h3 className="line-clamp-1 font-medium">{a.title}</h3>
                      <p className="text-xs text-neutral-500">
                        {a.vehicle.year} . {a.vehicle.fuelType} . {a.vehicle.city}
                      </p>
                      <p className="mt-2 font-semibold">
                        {formatINR(Math.round((a.live.currentHighBid ?? a.pricing.startingPrice) / 100))}
                      </p>
                      <p className="text-xs text-neutral-500">
                        {a.live.bidCount} bids . {a.status}
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}

          {nextCursor && (
            <div className="mt-6 flex justify-center">
              <button
                disabled={loading}
                onClick={loadMore}
                className="rounded border border-neutral-300 bg-white px-4 py-2 text-sm font-medium hover:bg-neutral-50 disabled:opacity-50"
              >
                {loading ? 'Loading...' : 'Load more'}
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

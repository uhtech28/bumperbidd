'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { auctionsApi, ApiError, Auction } from '../../lib/api';
import { formatINR } from '../../lib/format';

/**
 * /auctions — list page. Splits into "Live now" and "Upcoming" rails,
 * with "Recently ended" below for transparency. Pulls from GET /auctions
 * on mount. No auth required to browse.
 */
export default function AuctionsListPage() {
  const [live, setLive] = useState<Auction[]>([]);
  const [scheduled, setScheduled] = useState<Auction[]>([]);
  const [ended, setEnded] = useState<Auction[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [l, s, e] = await Promise.all([
          auctionsApi.list({ status: 'live', limit: 20 }),
          auctionsApi.list({ status: 'scheduled', limit: 20 }),
          auctionsApi.list({ status: 'ended', limit: 10 }),
        ]);
        if (cancelled) return;
        setLive(l.items);
        setScheduled(s.items);
        setEnded(e.items);
      } catch (e) {
        const msg =
          e instanceof ApiError ? e.message : (e as Error).message;
        if (!cancelled) setErr(msg);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="min-h-dvh px-4 sm:px-8 py-8 max-w-[1240px] mx-auto">
      <header className="flex items-baseline justify-between mb-8">
        <div>
          <h1 className="text-3xl sm:text-4xl font-display tracking-tight">
            Auctions
          </h1>
          <p className="text-sm text-white/60 mt-1">
            Curated, live vehicle auctions. Bids settle instantly.
          </p>
        </div>
        <Link
          href="/dashboard"
          className="text-sm text-white/60 hover:text-white underline-offset-4 hover:underline"
        >
          Dashboard
        </Link>
      </header>

      {err && (
        <div className="mb-6 rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {err}
        </div>
      )}

      {loading ? (
        <p className="text-white/50">Loading auctions…</p>
      ) : (
        <>
          <Section
            title="Live now"
            subtitle="Bids accepted for the next few minutes"
            items={live}
            emptyLabel="No live auctions right now. Check back soon."
            highlight
          />
          <Section
            title="Upcoming"
            subtitle="Starting soon"
            items={scheduled}
            emptyLabel="No auctions scheduled."
          />
          <Section
            title="Recently ended"
            subtitle="Past auctions, for reference"
            items={ended}
            emptyLabel="No recently ended auctions."
          />
        </>
      )}
    </main>
  );
}

function Section({
  title,
  subtitle,
  items,
  emptyLabel,
  highlight,
}: {
  title: string;
  subtitle: string;
  items: Auction[];
  emptyLabel: string;
  highlight?: boolean;
}) {
  return (
    <section className="mb-10">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-xl font-semibold">{title}</h2>
        <span className="text-xs text-white/50">{subtitle}</span>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-white/40 py-8 border border-white/10 rounded-md text-center">
          {emptyLabel}
        </p>
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((a) => (
            <AuctionCard key={a.id} a={a} highlight={highlight} />
          ))}
        </ul>
      )}
    </section>
  );
}

function AuctionCard({ a, highlight }: { a: Auction; highlight?: boolean }) {
  const img = a.vehicle.imageUrls[0] ?? null;
  const price = a.live.currentHighBid ?? a.pricing.startingPrice;
  return (
    <li>
      <Link
        href={`/auctions/${a.id}`}
        className={`block rounded-lg overflow-hidden border transition ${
          highlight
            ? 'border-[#D4A017]/30 hover:border-[#D4A017]/80 hover:shadow-[0_0_0_1px_rgba(212,160,23,0.4)]'
            : 'border-white/10 hover:border-white/30'
        }`}
      >
        <div
          className="aspect-[16/10] bg-neutral-900 bg-cover bg-center"
          style={img ? { backgroundImage: `url(${img})` } : undefined}
        />
        <div className="p-3">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-sm font-medium line-clamp-1">{a.title}</h3>
            {a.status === 'live' && (
              <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-red-500/20 text-red-300 border border-red-500/30 shrink-0">
                Live
              </span>
            )}
            {a.status === 'scheduled' && (
              <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-200 border border-amber-500/30 shrink-0">
                Soon
              </span>
            )}
            {a.status === 'ended' && (
              <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-white/10 text-white/60 shrink-0">
                Ended
              </span>
            )}
          </div>
          <p className="text-xs text-white/50 mt-1">
            {a.vehicle.year} · {a.vehicle.kmDriven.toLocaleString('en-IN')} km ·{' '}
            {a.vehicle.fuelType.toUpperCase()} · {a.vehicle.city}
          </p>
          <p className="mt-3 text-base font-semibold">
            {formatINR(price / 100)}
          </p>
        </div>
      </Link>
    </li>
  );
}

'use client';

/**
 * Seller dashboard - shows revenue/listing stats and links to the
 * seller's auctions. Gated by backend RolesGuard('seller'|'admin').
 * A user becomes a seller only after KYC approval.
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { sellerApi, ApiError, type Auction, type SellerStats } from '../../lib/api';
import { formatINR } from '../../lib/format';

export default function SellerDashboardPage() {
  const [stats, setStats] = useState<SellerStats | null>(null);
  const [items, setItems] = useState<Auction[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    setLoading(true);
    Promise.all([sellerApi.stats(), sellerApi.myListings({ status: statusFilter || undefined, limit: 50 })])
      .then(([s, l]) => {
        setStats(s);
        setItems(l.items);
      })
      .catch((e: ApiError) => {
        if (e.status === 403 || e.code === 'NOT_SELLER') {
          setErr('You are not a verified seller yet. Please complete KYC to list vehicles.');
        } else {
          setErr(e.message);
        }
      })
      .finally(() => setLoading(false));
  }, [statusFilter]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold">Seller dashboard</h1>
        <Link
          href="/seller/new"
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          + New auction
        </Link>
      </div>

      {err && (
        <div className="mb-4 rounded border border-red-300 bg-red-50 p-4 text-sm text-red-700">
          <p>{err}</p>
          {err.includes('KYC') && (
            <Link href="/kyc" className="mt-2 inline-block font-medium underline">
              Complete KYC now
            </Link>
          )}
        </div>
      )}

      {stats && (
        <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
          <Stat label="Total listings" value={String(stats.totalListings)} />
          <Stat label="Active auctions" value={String(stats.activeAuctions)} />
          <Stat label="Sold" value={String(stats.soldCount)} />
          <Stat label="Revenue" value={formatINR(Math.round(stats.totalRevenuePaisa / 100))} />
        </div>
      )}

      <div className="mb-4 flex items-center gap-2">
        <label className="text-sm font-medium">Filter:</label>
        <select
          className="rounded border border-neutral-300 px-2 py-1 text-sm"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All</option>
          <option value="scheduled">Scheduled</option>
          <option value="live">Live</option>
          <option value="ended">Ended</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {loading ? (
        <p className="text-sm text-neutral-500">Loading...</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-neutral-500">No listings yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-neutral-50 text-left text-xs uppercase text-neutral-500">
              <tr>
                <th className="px-4 py-2">Title</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Current bid</th>
                <th className="px-4 py-2">Bids</th>
                <th className="px-4 py-2">Ends</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((a) => (
                <tr key={a.id} className="border-t border-neutral-100">
                  <td className="px-4 py-2">
                    <Link href={`/auctions/${a.id}`} className="font-medium hover:underline">
                      {a.title}
                    </Link>
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        a.status === 'live'
                          ? 'bg-green-100 text-green-700'
                          : a.status === 'ended'
                          ? 'bg-neutral-100 text-neutral-600'
                          : a.status === 'cancelled'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-blue-100 text-blue-700'
                      }`}
                    >
                      {a.status}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    {formatINR(Math.round((a.live.currentHighBid ?? a.pricing.startingPrice) / 100))}
                  </td>
                  <td className="px-4 py-2">{a.live.bidCount}</td>
                  <td className="px-4 py-2 text-xs text-neutral-500">
                    {new Date(a.endsAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-2">
                    <Link href={`/auctions/${a.id}`} className="text-xs text-blue-600 hover:underline">
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4">
      <p className="text-xs uppercase tracking-wide text-neutral-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}

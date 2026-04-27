'use client';

/**
 * /account/wins - auctions the current user won.
 *
 * Each row shows the vehicle, final price, payment status,
 * delivery status. Disputes can be filed from the order detail
 * (linked from each row).
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ordersApi, ApiError, type OrderRow } from '@/lib/api';
import { UserShell } from '@/components/shell/UserShell';

const formatINR = (paisa: number) =>
  `\u20b9${(paisa / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

const PAY_PILL: Record<string, string> = {
  pending: 'bg-amber-500/15 text-amber-300 ring-amber-500/30',
  paid: 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30',
  failed: 'bg-red-500/15 text-red-300 ring-red-500/30',
  refunded: 'bg-violet-500/15 text-violet-300 ring-violet-500/30',
};

const DEL_PILL: Record<string, string> = {
  scheduled: 'bg-sky-500/15 text-sky-300 ring-sky-500/30',
  in_transit: 'bg-amber-500/15 text-amber-300 ring-amber-500/30',
  delivered: 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30',
  disputed: 'bg-red-500/15 text-red-300 ring-red-500/30',
  cancelled: 'bg-slate-500/15 text-slate-300 ring-slate-500/30',
};

export default function WinsPage() {
  const [items, setItems] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    ordersApi
      .wins({ limit: 30 })
      .then((r) => !cancelled && setItems(r.items))
      .catch((e: ApiError) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <UserShell>
      <div className="mx-auto max-w-5xl px-6 py-8 pb-24 md:px-8">
        <header className="mb-6">
          <p className="text-[12px] uppercase tracking-[0.22em] text-bone/45">
            Account
          </p>
          <h1 className="mt-1 text-[26px] font-semibold tracking-tight text-bone">
            Wins
          </h1>
          <p className="mt-1 text-[13px] text-bone/55">
            Auctions you won. Pay, track delivery, and raise disputes from here.
          </p>
        </header>

        {error && (
          <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
            {error}
          </div>
        )}

        {loading ? (
          <div className="rounded-xl border border-white/8 bg-graphite/40 p-10 text-center text-bone/55">
            Loading…
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/10 bg-graphite/40 p-10 text-center">
            <p className="text-bone/65">You haven’t won an auction yet.</p>
            <Link
              href="/dashboard"
              className="mt-3 inline-block rounded-lg bg-brand-500 px-4 py-2 text-[13px] font-semibold text-ink hover:bg-brand-400"
            >
              Browse live auctions
            </Link>
          </div>
        ) : (
          <ul className="grid gap-3">
            {items.map((o) => (
              <li
                key={o.id}
                className="flex items-center gap-4 rounded-xl border border-white/8 bg-graphite/40 p-3"
              >
                <div className="h-20 w-28 shrink-0 overflow-hidden rounded-lg bg-white/5">
                  {o.auction.imageUrls[0] && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={o.auction.imageUrls[0]}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/auctions/${o.auction.id}`}
                    className="block truncate font-medium text-bone hover:text-brand-300"
                  >
                    {o.auction.title}
                  </Link>
                  <p className="mt-0.5 text-[12px] text-bone/55">
                    {o.auction.year} · {o.auction.city}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Pill className={PAY_PILL[o.paymentStatus]}>
                      Payment: {o.paymentStatus}
                    </Pill>
                    <Pill className={DEL_PILL[o.deliveryStatus]}>
                      Delivery: {o.deliveryStatus.replace('_', ' ')}
                    </Pill>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-display text-[18px] font-semibold tabular-nums text-brand-300">
                    {formatINR(o.finalPrice)}
                  </p>
                  <p className="mt-0.5 text-[11px] text-bone/45">
                    Won {new Date(o.createdAt).toLocaleDateString('en-IN')}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </UserShell>
  );
}

function Pill({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ring-1 ${
        className ?? 'bg-white/5 text-bone/70 ring-white/10'
      }`}
    >
      {children}
    </span>
  );
}

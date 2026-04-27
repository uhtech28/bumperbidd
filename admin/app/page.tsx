'use client';

/**
 * Admin home dashboard.
 *
 * Shows live platform stats (auto-refreshed every 5s) plus quick links to
 * the surfaces an operator usually needs first thing on each shift:
 *   - Pending KYC submissions
 *   - Pending payment proofs
 *   - Live auctions
 *   - Audit log
 *
 * Money values come back from the backend as paisa; rendered as rupees.
 */
import Link from 'next/link';
import useSWR from 'swr';
import { adminApi } from '@/lib/api';

interface Stats {
  users: number;
  auctions: number;
  liveAuctions: number;
  totalBids: number;
  holdsLocked: number; // paisa
}

const inr = (paisa: number) =>
  `₹${(paisa / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

export default function Dashboard() {
  const { data, error, isLoading } = useSWR<Stats>(
    'admin:stats',
    () => adminApi.stats(),
    { refreshInterval: 5000 },
  );

  // Pending counts power the "you have N to review" badges.
  const { data: pendingPayments } = useSWR(
    'admin:payments:pending',
    () => adminApi.pendingPayments({ limit: 1 }),
    { refreshInterval: 15_000 },
  );

  if (error) {
    return (
      <div className="rounded-xl border border-red-300 bg-red-50 p-6 text-sm text-red-700">
        <p className="font-medium">Failed to load stats.</p>
        <p className="mt-1 text-xs">
          The backend may be unreachable, or your session expired.{' '}
          <Link href="/login" className="underline">
            Sign in
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-slate-600">
            Live platform stats. Auto-refreshes every 5 seconds.
          </p>
        </div>
        <Link
          href="/auctions/new"
          className="rounded-lg bg-ink px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          + New auction
        </Link>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat
          label="Users"
          value={data?.users ?? '—'}
          loading={isLoading}
          accent="indigo"
        />
        <Stat
          label="Live auctions"
          value={data?.liveAuctions ?? '—'}
          loading={isLoading}
          accent="emerald"
        />
        <Stat
          label="Total auctions"
          value={data?.auctions ?? '—'}
          loading={isLoading}
        />
        <Stat
          label="Total bids"
          value={data?.totalBids ?? '—'}
          loading={isLoading}
        />
        <Stat
          label="Holds locked"
          value={data ? inr(data.holdsLocked) : '—'}
          loading={isLoading}
          accent="amber"
        />
      </div>

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-600">
        Operator shortcuts
      </h2>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <ActionCard
          href="/payments"
          title="Review payments"
          description="Approve or reject UPI top-up proofs."
          badge={
            (pendingPayments as any)?.items?.length
              ? `${(pendingPayments as any).items.length}+ pending`
              : undefined
          }
        />
        <ActionCard
          href="/kyc"
          title="Review KYC"
          description="Verify seller submissions before they can list."
        />
        <ActionCard
          href="/auctions"
          title="Manage auctions"
          description="Cancel listings, inspect bid history, flag suspicious activity."
        />
        <ActionCard
          href="/transactions"
          title="Wallet ledger"
          description="Cross-user credit / debit / hold history."
        />
        <ActionCard
          href="/users"
          title="Users"
          description="Search, ban, refund, audit any account."
        />
        <ActionCard
          href="/audit"
          title="Audit log"
          description="Every privileged action, with diffs."
        />
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  loading,
  accent,
}: {
  label: string;
  value: number | string;
  loading?: boolean;
  accent?: 'indigo' | 'emerald' | 'amber';
}) {
  const ring =
    accent === 'indigo'
      ? 'ring-indigo-200'
      : accent === 'emerald'
        ? 'ring-emerald-200'
        : accent === 'amber'
          ? 'ring-amber-200'
          : 'ring-slate-200';
  return (
    <div className={`rounded-xl border border-slate-200 bg-white p-5 ring-1 ${ring}`}>
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div
        className={`mt-1 text-2xl font-bold tabular-nums ${
          loading ? 'animate-pulse text-slate-300' : 'text-slate-900'
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function ActionCard({
  href,
  title,
  description,
  badge,
}: {
  href: string;
  title: string;
  description: string;
  badge?: string;
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 transition-colors hover:border-slate-300 hover:bg-slate-50"
    >
      <div>
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-900">{title}</h3>
          {badge && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700">
              {badge}
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-slate-600">{description}</p>
      </div>
      <span className="mt-4 text-xs font-medium text-slate-400 group-hover:text-slate-600">
        Open →
      </span>
    </Link>
  );
}

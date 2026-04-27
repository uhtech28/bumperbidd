'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ApiError,
  walletApi,
  WalletBalance,
  WalletEntry,
} from '../../lib/api';
import { formatINR } from '../../lib/format';

/**
 * /wallet — balance, held funds, and full transaction history.
 *
 * Dev-only top-up lives at the top. In production this button would
 * integrate with Razorpay / Stripe; the backend /wallet/topup/dev
 * endpoint is gated on NODE_ENV so it's disabled outside dev.
 */
export default function WalletPage() {
  const [balance, setBalance] = useState<WalletBalance | null>(null);
  const [entries, setEntries] = useState<WalletEntry[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [topupAmount, setTopupAmount] = useState(5000);
  const [toppingUp, setToppingUp] = useState(false);

  async function loadInitial() {
    setLoading(true);
    try {
      const [b, e] = await Promise.all([
        walletApi.balance(),
        walletApi.entries({ limit: 30 }),
      ]);
      setBalance(b);
      setEntries(e.items);
      setNextCursor(e.nextCursor);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : (e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadInitial();
  }, []);

  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const e = await walletApi.entries({ limit: 30, cursor: nextCursor });
      setEntries((prev) => [...prev, ...e.items]);
      setNextCursor(e.nextCursor);
    } finally {
      setLoadingMore(false);
    }
  }

  async function onTopup() {
    setErr(null);
    setToppingUp(true);
    try {
      await walletApi.devTopup(topupAmount * 100);
      await loadInitial();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : (e as Error).message);
    } finally {
      setToppingUp(false);
    }
  }

  return (
    <main className="min-h-dvh px-4 sm:px-8 py-8 max-w-[960px] mx-auto">
      <header className="flex items-baseline justify-between mb-6">
        <div>
          <h1 className="text-3xl font-display tracking-tight">Wallet</h1>
          <p className="text-sm text-white/60 mt-1">
            Balance, holds, and transaction history.
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

      {loading || !balance ? (
        <p className="text-white/50">Loading wallet…</p>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
            <Stat
              label="Available"
              value={balance.balance}
              tone="gold"
              hint="Spendable funds"
            />
            <Stat
              label="Held for active bids"
              value={balance.heldBalance}
              tone="amber"
              hint="Reserved — released if outbid"
            />
            <Stat
              label="Total"
              value={balance.total}
              tone="plain"
              hint="Available + held"
            />
          </div>

          <section className="mb-8 rounded-lg border border-white/10 p-5 bg-white/[0.02]">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-white/70">
              Top up (dev)
            </h2>
            <p className="text-xs text-white/40 mt-1">
              Simulated top-up for local development. In production this
              integrates with Razorpay / Stripe.
            </p>
            <div className="mt-4 flex gap-2">
              {[1000, 5000, 10000, 50000].map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setTopupAmount(amt)}
                  className={`text-xs px-3 py-1.5 rounded border ${
                    topupAmount === amt
                      ? 'border-[#D4A017] bg-[#D4A017]/10 text-white'
                      : 'border-white/15 text-white/70 hover:border-white/40'
                  }`}
                >
                  ₹{amt.toLocaleString('en-IN')}
                </button>
              ))}
            </div>
            <div className="mt-4 flex items-center gap-3">
              <input
                type="number"
                value={topupAmount}
                onChange={(e) =>
                  setTopupAmount(
                    Math.max(100, parseInt(e.target.value, 10) || 0),
                  )
                }
                className="h-10 w-32 rounded border border-white/20 bg-transparent px-3 tabular-nums text-right"
              />
              <button
                type="button"
                disabled={toppingUp}
                onClick={onTopup}
                className="h-10 px-5 rounded font-medium bg-[#D4A017] text-black hover:bg-[#E8B626] disabled:opacity-50"
              >
                {toppingUp ? 'Topping up…' : 'Add funds'}
              </button>
            </div>
          </section>

          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-white/70 mb-3">
              Transactions
            </h2>
            {entries.length === 0 ? (
              <p className="text-sm text-white/40 py-8 border border-white/10 rounded-md text-center">
                No transactions yet.
              </p>
            ) : (
              <ul className="divide-y divide-white/10 border border-white/10 rounded-md overflow-hidden">
                {entries.map((e) => (
                  <EntryRow key={e.id} e={e} />
                ))}
              </ul>
            )}
            {nextCursor && (
              <button
                type="button"
                disabled={loadingMore}
                onClick={loadMore}
                className="mt-4 w-full h-10 rounded border border-white/20 text-sm text-white/70 hover:border-white/40"
              >
                {loadingMore ? 'Loading…' : 'Load more'}
              </button>
            )}
          </section>
        </>
      )}
    </main>
  );
}

function Stat({
  label,
  value,
  tone,
  hint,
}: {
  label: string;
  value: number;
  tone: 'gold' | 'amber' | 'plain';
  hint?: string;
}) {
  const colour =
    tone === 'gold'
      ? 'text-[#E8B626]'
      : tone === 'amber'
        ? 'text-amber-300'
        : 'text-white';
  return (
    <div className="rounded-lg border border-white/10 p-4 bg-white/[0.02]">
      <p className="text-[11px] uppercase tracking-wider text-white/50">
        {label}
      </p>
      <p className={`text-2xl font-semibold tabular-nums mt-1 ${colour}`}>
        {formatINR(value / 100)}
      </p>
      {hint && <p className="text-[11px] text-white/40 mt-1">{hint}</p>}
    </div>
  );
}

function EntryRow({ e }: { e: WalletEntry }) {
  const isCredit =
    e.type === 'credit' || e.type === 'release' || e.type === 'refund';
  const sign = isCredit ? '+' : '-';
  const colour = isCredit ? 'text-emerald-300' : 'text-rose-300';
  const label =
    e.type === 'credit'
      ? 'Wallet top-up'
      : e.type === 'hold'
        ? 'Hold placed (active bid)'
        : e.type === 'release'
          ? 'Hold released (outbid)'
          : e.type === 'debit'
            ? 'Hold captured (won auction)'
            : e.type;
  return (
    <li className="flex items-center justify-between px-4 py-3">
      <div>
        <p className="text-sm">{label}</p>
        {e.note && (
          <p className="text-xs text-white/40 mt-0.5">{e.note}</p>
        )}
        <p className="text-[10px] text-white/30 mt-0.5">
          {new Date(e.createdAt).toLocaleString('en-IN', {
            dateStyle: 'medium',
            timeStyle: 'short',
          })}
        </p>
      </div>
      <div className="text-right">
        <p className={`text-sm font-medium tabular-nums ${colour}`}>
          {sign} {formatINR(e.amount / 100)}
        </p>
        <p className="text-[10px] text-white/30 tabular-nums mt-0.5">
          bal: {formatINR(e.balanceAfter / 100)}
        </p>
      </div>
    </li>
  );
}

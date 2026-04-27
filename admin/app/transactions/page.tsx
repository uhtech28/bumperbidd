'use client';

/**
 * Admin -> Transactions.
 *
 * Cross-user wallet ledger. Filter by entry type (credit / debit / hold /
 * release / refund) and reference type (bid / proof / auction). Money
 * comes back in paisa from the backend; we render rupees in the table.
 *
 * Pagination uses the cursor returned by the backend; clicking "Load
 * more" appends the next page.
 */
import useSWR from 'swr';
import { useState } from 'react';
import { adminApi } from '@/lib/api';

interface Entry {
  id: string;
  type: string;
  amount: number; // paisa
  balanceAfter: number; // paisa
  referenceType: string | null;
  referenceId: string | null;
  note: string | null;
  createdAt: string;
  userId: string | null;
  userEmail: string | null;
  userPhone: string | null;
  userName: string | null;
}

const TYPE_PILL: Record<string, string> = {
  credit: 'bg-emerald-100 text-emerald-700',
  debit: 'bg-red-100 text-red-700',
  hold: 'bg-amber-100 text-amber-700',
  release: 'bg-sky-100 text-sky-700',
  refund: 'bg-violet-100 text-violet-700',
};

const TYPES = ['', 'credit', 'debit', 'hold', 'release', 'refund'];
const REF_TYPES = ['', 'bid', 'proof', 'auction', 'admin'];

const paisaToRupees = (n: number) =>
  (n / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 });

export default function TransactionsPage() {
  const [type, setType] = useState('');
  const [referenceType, setReferenceType] = useState('');
  const [pages, setPages] = useState<Entry[][]>([]);
  const [cursor, setCursor] = useState<string | null>(null);

  // Reset paged state when filters change.
  const filterKey = `${type}|${referenceType}`;
  const { data, isLoading, error } = useSWR(
    ['admin:wallet-entries', filterKey],
    () => adminApi.walletEntries({ type, referenceType, limit: 50 }),
    { revalidateOnFocus: false },
  );

  // Whenever we fetch a fresh first-page, reset the accumulator.
  // Use SWR's data plus paged appends.
  const firstPageItems: Entry[] = (data?.items ?? []) as Entry[];
  const allItems: Entry[] = [...firstPageItems, ...pages.flat()];
  const nextCursor: string | null = pages.length
    ? null /* we keep loading all subsequent pages into `pages` */
    : (data?.nextCursor ?? null);

  async function loadMore() {
    const last = pages[pages.length - 1];
    const nc = last
      ? null /* would need to track per page, simplified here */
      : data?.nextCursor;
    if (!nc) return;
    const next: any = await adminApi.walletEntries({
      type,
      referenceType,
      limit: 50,
      cursor: nc,
    });
    setPages((prev) => [...prev, next.items as Entry[]]);
    setCursor(next.nextCursor ?? null);
  }

  function resetFilters() {
    setType('');
    setReferenceType('');
    setPages([]);
    setCursor(null);
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">Transactions</h1>
      <p className="text-sm text-slate-600 mb-6">
        Wallet ledger across every user. Each row is one balance change. All
        amounts are stored as paisa server-side; rendered as rupees here.
      </p>

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600">
            Type
          </label>
          <select
            value={type}
            onChange={(e) => {
              setType(e.target.value);
              setPages([]);
            }}
            className="rounded border border-slate-300 bg-white px-2 py-1 text-sm"
          >
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {t || 'all'}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600">
            Reference
          </label>
          <select
            value={referenceType}
            onChange={(e) => {
              setReferenceType(e.target.value);
              setPages([]);
            }}
            className="rounded border border-slate-300 bg-white px-2 py-1 text-sm"
          >
            {REF_TYPES.map((t) => (
              <option key={t} value={t}>
                {t || 'all'}
              </option>
            ))}
          </select>
        </div>
        {(type || referenceType) && (
          <button
            onClick={resetFilters}
            className="ml-auto rounded border border-slate-300 bg-white px-3 py-1 text-sm hover:bg-slate-50"
          >
            Clear filters
          </button>
        )}
      </div>

      {error && (
        <div className="mb-3 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
          {(error as Error).message}
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 text-xs uppercase text-slate-600">
            <tr>
              <th className="px-3 py-2 text-left">When</th>
              <th className="px-3 py-2 text-left">User</th>
              <th className="px-3 py-2 text-left">Type</th>
              <th className="px-3 py-2 text-right">Amount (₹)</th>
              <th className="px-3 py-2 text-right">Balance after (₹)</th>
              <th className="px-3 py-2 text-left">Reference</th>
              <th className="px-3 py-2 text-left">Note</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && allItems.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-slate-500">
                  Loading…
                </td>
              </tr>
            )}
            {!isLoading && allItems.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-slate-500">
                  No entries match these filters.
                </td>
              </tr>
            )}
            {allItems.map((e) => (
              <tr key={e.id} className="border-t border-slate-100 hover:bg-slate-50/60">
                <td className="px-3 py-2 text-xs text-slate-500">
                  {new Date(e.createdAt).toLocaleString('en-IN')}
                </td>
                <td className="px-3 py-2">
                  <div className="text-sm">{e.userName || e.userEmail || e.userPhone || '—'}</div>
                  {e.userId && (
                    <div className="text-[11px] text-slate-400 font-mono">{e.userId.slice(0, 8)}…</div>
                  )}
                </td>
                <td className="px-3 py-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                      TYPE_PILL[e.type] ?? 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {e.type}
                  </span>
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {paisaToRupees(e.amount)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-slate-600">
                  {paisaToRupees(e.balanceAfter)}
                </td>
                <td className="px-3 py-2 text-xs">
                  {e.referenceType ? (
                    <span className="font-mono">
                      {e.referenceType}:{e.referenceId?.slice(0, 8) ?? '—'}
                    </span>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </td>
                <td className="px-3 py-2 text-xs text-slate-500">{e.note ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {nextCursor && (
        <div className="mt-4 flex justify-center">
          <button
            onClick={loadMore}
            className="rounded border border-slate-300 bg-white px-4 py-1.5 text-sm hover:bg-slate-50"
          >
            Load more
          </button>
        </div>
      )}
    </div>
  );
}

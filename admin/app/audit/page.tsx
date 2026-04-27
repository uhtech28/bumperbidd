'use client';

/**
 * Admin -> Audit Log.
 *
 * Every privileged action lives here: bans, refunds, payment decisions,
 * KYC decisions, auction cancels. Each row is one immutable entry from
 * the audit table. Rows are clickable - clicking expands a JSON diff
 * panel showing what changed.
 *
 * Filters are applied server-side so we don't paginate through 10k rows
 * client-side just to find one ban.
 */
import { useState } from 'react';
import useSWR from 'swr';
import { adminApi } from '@/lib/api';

interface AuditRow {
  id: string;
  adminId: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  diff: any;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
}

const ACTION_PILL: Record<string, string> = {
  'user.ban': 'bg-red-100 text-red-700',
  'user.unban': 'bg-emerald-100 text-emerald-700',
  'auction.cancel': 'bg-amber-100 text-amber-700',
  'wallet.refund': 'bg-violet-100 text-violet-700',
  'payment.approve': 'bg-emerald-100 text-emerald-700',
  'payment.reject': 'bg-red-100 text-red-700',
  'kyc.approve': 'bg-emerald-100 text-emerald-700',
  'kyc.reject': 'bg-red-100 text-red-700',
};

const ACTIONS = [
  '',
  'user.ban',
  'user.unban',
  'auction.cancel',
  'wallet.refund',
  'payment.approve',
  'payment.reject',
  'kyc.approve',
  'kyc.reject',
];

const TARGET_TYPES = ['', 'user', 'auction', 'payment', 'kyc'];

export default function AuditPage() {
  const [action, setAction] = useState('');
  const [targetType, setTargetType] = useState('');
  const [pages, setPages] = useState<AuditRow[][]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);

  const filterKey = `${action}|${targetType}`;
  const { data, isLoading, error } = useSWR(
    ['admin:audit', filterKey],
    () =>
      adminApi.audit({
        ...(action ? { action } : {}),
        ...(targetType ? { targetType } : {}),
        limit: 50,
      }) as Promise<{ items: AuditRow[]; nextCursor: string | null }>,
    { revalidateOnFocus: false },
  );

  const firstPage: AuditRow[] = (data?.items ?? []) as AuditRow[];
  const allRows: AuditRow[] = [...firstPage, ...pages.flat()];
  const nextCursor: string | null = pages.length
    ? null
    : (data?.nextCursor ?? null);

  async function loadMore() {
    if (!data?.nextCursor) return;
    const next: any = await adminApi.audit({
      ...(action ? { action } : {}),
      ...(targetType ? { targetType } : {}),
      limit: 50,
      cursor: data.nextCursor,
    });
    setPages((prev) => [...prev, next.items as AuditRow[]]);
  }

  function reset() {
    setAction('');
    setTargetType('');
    setPages([]);
    setExpanded(null);
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">Audit log</h1>
      <p className="text-sm text-slate-600 mb-6">
        Every privileged action, append-only. Click a row to inspect the
        diff payload.
      </p>

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600">
            Action
          </label>
          <select
            value={action}
            onChange={(e) => {
              setAction(e.target.value);
              setPages([]);
            }}
            className="rounded border border-slate-300 bg-white px-2 py-1 text-sm"
          >
            {ACTIONS.map((a) => (
              <option key={a} value={a}>
                {a || 'all'}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600">
            Target
          </label>
          <select
            value={targetType}
            onChange={(e) => {
              setTargetType(e.target.value);
              setPages([]);
            }}
            className="rounded border border-slate-300 bg-white px-2 py-1 text-sm"
          >
            {TARGET_TYPES.map((t) => (
              <option key={t} value={t}>
                {t || 'all'}
              </option>
            ))}
          </select>
        </div>
        {(action || targetType) && (
          <button
            onClick={reset}
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
              <th className="px-3 py-2 text-left">Admin</th>
              <th className="px-3 py-2 text-left">Action</th>
              <th className="px-3 py-2 text-left">Target</th>
              <th className="px-3 py-2 text-left">IP</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading && allRows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-slate-500">
                  Loading…
                </td>
              </tr>
            )}
            {!isLoading && allRows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-slate-500">
                  No entries match these filters.
                </td>
              </tr>
            )}
            {allRows.map((r) => {
              const open = expanded === r.id;
              const hasDiff = r.diff && Object.keys(r.diff).length > 0;
              return (
                <Row
                  key={r.id}
                  row={r}
                  open={open}
                  hasDiff={hasDiff}
                  onToggle={() => setExpanded(open ? null : r.id)}
                />
              );
            })}
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

function Row({
  row,
  open,
  hasDiff,
  onToggle,
}: {
  row: AuditRow;
  open: boolean;
  hasDiff: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <tr
        onClick={onToggle}
        className={`border-t border-slate-100 ${
          hasDiff ? 'cursor-pointer hover:bg-slate-50/60' : ''
        }`}
      >
        <td className="px-3 py-2 text-xs text-slate-500">
          {new Date(row.createdAt).toLocaleString('en-IN')}
        </td>
        <td className="px-3 py-2 font-mono text-[11px] text-slate-600">
          {row.adminId.slice(0, 8)}…
        </td>
        <td className="px-3 py-2">
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
              ACTION_PILL[row.action] ?? 'bg-slate-100 text-slate-700'
            }`}
          >
            {row.action}
          </span>
        </td>
        <td className="px-3 py-2 text-xs">
          {row.targetType ? (
            <span className="font-mono">
              {row.targetType}:{row.targetId?.slice(0, 8) ?? '—'}
            </span>
          ) : (
            <span className="text-slate-400">—</span>
          )}
        </td>
        <td className="px-3 py-2 font-mono text-[11px] text-slate-500">
          {row.ip ?? '—'}
        </td>
        <td className="px-3 py-2 text-right text-xs text-slate-400">
          {hasDiff ? (open ? '▾' : '▸') : ''}
        </td>
      </tr>
      {open && hasDiff && (
        <tr className="border-t border-slate-100 bg-slate-50">
          <td colSpan={6} className="px-3 py-3">
            <pre className="overflow-x-auto whitespace-pre-wrap break-all rounded border border-slate-200 bg-white p-3 font-mono text-[11px] text-slate-700">
              {JSON.stringify(row.diff, null, 2)}
            </pre>
            {row.userAgent && (
              <p className="mt-2 text-[11px] text-slate-500">
                <span className="font-semibold uppercase tracking-wide">UA:</span>{' '}
                {row.userAgent}
              </p>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

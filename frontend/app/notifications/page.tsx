'use client';

/**
 * Notifications inbox.
 *
 * The TopBar bell on /dashboard routes here. We fetch /notifications
 * with a 30-item page, render each item with its type-specific colour,
 * mark a single one read on click (PATCH /notifications/:id/read), and
 * expose a "mark all read" button (PATCH /notifications/read-all).
 *
 * Items that reference an auctionId are linkified so the user can jump
 * straight back into the relevant auction room.
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  notificationsApi,
  ApiError,
  type NotificationItem,
} from '../../lib/api';

const TYPE_TINT: Record<string, { bg: string; ring: string; label: string }> = {
  bid_outbid: { bg: 'bg-amber-50', ring: 'ring-amber-200', label: 'Outbid' },
  bid_winning: { bg: 'bg-emerald-50', ring: 'ring-emerald-200', label: 'Winning' },
  bid_placed: { bg: 'bg-sky-50', ring: 'ring-sky-200', label: 'Bid placed' },
  auction_won: { bg: 'bg-violet-50', ring: 'ring-violet-200', label: 'Won' },
  auction_ending: { bg: 'bg-orange-50', ring: 'ring-orange-200', label: 'Ending soon' },
  payment_approved: { bg: 'bg-emerald-50', ring: 'ring-emerald-200', label: 'Payment OK' },
  payment_rejected: { bg: 'bg-red-50', ring: 'ring-red-200', label: 'Payment rejected' },
  kyc_approved: { bg: 'bg-emerald-50', ring: 'ring-emerald-200', label: 'KYC approved' },
  kyc_rejected: { bg: 'bg-red-50', ring: 'ring-red-200', label: 'KYC rejected' },
};

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.round(ms / 60_000);
  if (m < 1) return 'Just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hr ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d} day${d === 1 ? '' : 's'} ago`;
  return new Date(iso).toLocaleDateString('en-IN');
}

export default function NotificationsPage() {
  const router = useRouter();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    try {
      const r = await notificationsApi.list({ limit: 30 });
      setItems(r.items);
    } catch (e) {
      setErr((e as ApiError).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleClick(n: NotificationItem) {
    // Optimistically mark as read so the UI doesn't lag behind the click.
    if (!n.isRead) {
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)));
      void notificationsApi.markRead(n.id).catch(() => undefined);
    }
    if (n.auctionId) {
      router.push(`/auctions/${n.auctionId}`);
    }
  }

  async function handleMarkAll() {
    if (busy) return;
    setBusy(true);
    try {
      await notificationsApi.markAllRead();
      setItems((prev) => prev.map((x) => ({ ...x, isRead: true })));
    } catch (e) {
      setErr((e as ApiError).message);
    } finally {
      setBusy(false);
    }
  }

  const unreadCount = items.filter((n) => !n.isRead).length;

  return (
    <main className="mx-auto min-h-screen max-w-3xl bg-ink px-5 py-8 text-bone">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Link
            href="/dashboard"
            className="text-[12px] uppercase tracking-[0.22em] text-bone/50 hover:text-bone"
          >
            &larr; Dashboard
          </Link>
          <h1 className="mt-2 text-[26px] font-semibold tracking-tight">Notifications</h1>
          <p className="mt-1 text-[13px] text-bone/55">
            {loading
              ? 'Loading\u2026'
              : items.length === 0
                ? 'No notifications yet.'
                : `${unreadCount} unread of ${items.length}`}
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAll}
            disabled={busy}
            className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-[12px] font-medium text-bone hover:bg-white/10 disabled:opacity-50"
          >
            Mark all read
          </button>
        )}
      </div>

      {err && (
        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
          {err}
        </div>
      )}

      {!loading && items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/10 bg-graphite/40 p-10 text-center">
          <p className="text-bone/65">You're all caught up.</p>
          <p className="mt-2 text-[12px] text-bone/45">
            Bid activity, wins, and payment updates will show up here.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((n) => {
            const tint =
              TYPE_TINT[n.type] ?? { bg: 'bg-white/5', ring: 'ring-white/10', label: n.type };
            const clickable = Boolean(n.auctionId);
            return (
              <li key={n.id}>
                <button
                  onClick={() => handleClick(n)}
                  disabled={!clickable && n.isRead}
                  className={`group flex w-full items-start gap-3 rounded-xl px-4 py-3 text-left transition-colors ${
                    n.isRead
                      ? 'bg-white/[0.02] hover:bg-white/[0.04]'
                      : 'bg-white/[0.04] hover:bg-white/[0.06] ring-1 ring-brand-500/20'
                  } ${clickable ? 'cursor-pointer' : 'cursor-default'}`}
                >
                  <span
                    className={`mt-0.5 inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-ink ring-1 ${tint.bg} ${tint.ring}`}
                  >
                    {tint.label}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-3">
                      <p
                        className={`truncate text-[14px] ${
                          n.isRead ? 'text-bone/80' : 'text-bone font-medium'
                        }`}
                      >
                        {n.title}
                      </p>
                      <span className="shrink-0 text-[11px] text-bone/45">
                        {relativeTime(n.createdAt)}
                      </span>
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-[12px] text-bone/55">{n.body}</p>
                  </div>
                  {!n.isRead && (
                    <span className="mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full bg-brand-400" aria-hidden />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}

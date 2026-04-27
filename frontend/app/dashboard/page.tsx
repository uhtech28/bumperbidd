'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { session } from '@/lib/session';
import {
  auctionsApi,
  watchlistApi,
  notificationsApi,
  type Auction as ApiAuction,
  type NotificationItem,
} from '@/lib/api';
import { UserShell } from '@/components/shell/UserShell';
import { SectionHeader } from '@/components/dashboard/SectionHeader';
import { LiveAuctionsRail } from '@/components/dashboard/LiveAuctionsRail';
import { CategoryRail } from '@/components/dashboard/CategoryRail';
import { FeaturedGrid } from '@/components/dashboard/FeaturedGrid';
import { MyActivityPanel } from '@/components/dashboard/MyActivityPanel';
import {
  toUiAuctions,
  computeCategoryCounts,
} from '@/components/dashboard/dashboard-adapter';
import type {
  Auction as UiAuction,
  ActivitySnapshot,
  RecentBid,
} from '@/components/dashboard/mock-data';

/**
 * Dashboard - the home surface for authed users. Wrapped by UserShell
 * which provides the persistent left sidebar, brand lockup, and session
 * gate. This page just renders the content rails.
 */
export default function DashboardPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>('all');

  const [liveAuctions, setLiveAuctions] = useState<ApiAuction[]>([]);
  const [allAuctions, setAllAuctions] = useState<ApiAuction[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [watchCount, setWatchCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  // Pull userId from session - UserShell handles the auth round-trip,
  // but this page needs the id for "my activity" derivations.
  useEffect(() => {
    const s = session.get();
    if (s) setUserId(s.userId);
  }, []);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      const [live, all, watch, notifs] = await Promise.allSettled([
        auctionsApi.list({ status: 'live', limit: 20 }),
        auctionsApi.list({ limit: 50 }),
        watchlistApi.list(),
        notificationsApi.list({ limit: 10 }),
      ]);
      if (cancelled) return;
      if (live.status === 'fulfilled') setLiveAuctions(live.value.items);
      if (all.status === 'fulfilled') setAllAuctions(all.value.items);
      if (watch.status === 'fulfilled') setWatchCount(watch.value.items.length);
      if (notifs.status === 'fulfilled') setNotifications(notifs.value.items);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [userId]);

  const liveUi = useMemo(() => toUiAuctions(liveAuctions), [liveAuctions]);
  const allUi = useMemo(() => toUiAuctions(allAuctions), [allAuctions]);
  const counts = useMemo(() => computeCategoryCounts(allAuctions), [allAuctions]);

  const categories = useMemo(
    () => [
      { id: 'all', label: 'All', count: counts.all },
      { id: 'car', label: 'Cars', count: counts.car },
      { id: 'bike', label: 'Bikes', count: counts.bike },
      { id: 'premium', label: 'Premium', count: counts.premium },
      { id: 'budget', label: 'Budget Deals', count: counts.budget },
    ],
    [counts],
  );

  const featured = useMemo(() => {
    const pool = activeCategory === 'all' ? allUi : allUi.filter((a) => a.category === activeCategory);
    return [...pool]
      .sort((a, b) => b.bidders - a.bidders || a.endsAt - b.endsAt)
      .slice(0, 8);
  }, [allUi, activeCategory]);

  const activity: ActivitySnapshot = useMemo(() => {
    const ended = allAuctions.filter((a) => a.status === 'ended' && a.outcome.winnerId === userId);
    const winningLive = liveAuctions.filter((a) => a.live.currentHighBidderId === userId);
    const wonLifetimeValue = ended.reduce(
      (sum, a) => sum + Math.round((a.outcome.finalPrice ?? 0) / 100),
      0,
    );
    const bidNotifs = notifications.filter((n) =>
      ['bid_placed', 'bid_winning', 'bid_outbid', 'auction_won'].includes(n.type),
    );
    const recent: RecentBid[] = bidNotifs.slice(0, 5).map((n) => {
      const minsAgo = Math.max(0, Math.round((Date.now() - new Date(n.createdAt).getTime()) / 60_000));
      const state: RecentBid['state'] =
        n.type === 'bid_outbid' ? 'outbid' : n.type === 'auction_won' ? 'won' : 'winning';
      const amtMatch = n.body.match(/\u20b9\s?([\d,]+)/);
      const amount = amtMatch ? Number(amtMatch[1].replace(/,/g, '')) : 0;
      return {
        id: n.id,
        auctionTitle: n.title.replace(/^(You're winning|Outbid|Won)\s*[\u2014-]\s*/i, ''),
        amount,
        placedAtMinutesAgo: minsAgo,
        state,
      };
    });
    return {
      auctionsJoined: watchCount,
      bidsPlaced: bidNotifs.length,
      winning: winningLive.length,
      wonLifetimeValue,
      recent,
    };
  }, [allAuctions, liveAuctions, notifications, watchCount, userId]);

  function open(auction: UiAuction) {
    router.push(`/auctions/${auction.id}`);
  }

  return (
    <UserShell>
      <div className="flex flex-col gap-8 px-6 py-8 pb-24 md:px-8">
        {/* Greeting */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        >
          <p className="text-[12px] uppercase tracking-[0.22em] text-bone/45">
            Welcome back
          </p>
          <h1 className="mt-1 text-[28px] font-semibold leading-tight tracking-tight text-bone">
            Ready to bid?
          </h1>
          <p className="mt-1 text-[13px] text-bone/55">
            {loading
              ? 'Loading live auctions\u2026'
              : liveAuctions.length === 0
                ? 'No auctions live right now.'
                : `${liveAuctions.length} ${liveAuctions.length === 1 ? 'auction' : 'auctions'} live right now.`}
          </p>
        </motion.div>

        {/* Live auctions */}
        <section className="flex flex-col gap-3">
          <SectionHeader
            title="Live Auctions"
            subtitle="Bid now - timers don't pause"
            action={{ label: 'See all' }}
          />
          {liveUi.length > 0 ? (
            <LiveAuctionsRail auctions={liveUi} onJoin={open} onOpen={open} />
          ) : (
            <EmptyHint
              title={loading ? 'Loading\u2026' : 'No live auctions yet'}
              body={
                loading
                  ? 'Fetching the latest listings.'
                  : 'Be the first to list - click "Sell a Vehicle" in the sidebar.'
              }
            />
          )}
        </section>

        {/* Categories */}
        <section className="flex flex-col gap-3">
          <SectionHeader title="Browse" subtitle="Filter by category" />
          <CategoryRail
            categories={categories}
            activeId={activeCategory}
            onChange={setActiveCategory}
          />
        </section>

        {/* Featured / trending */}
        <section className="flex flex-col gap-3">
          <SectionHeader
            title="Featured & Trending"
            subtitle={
              activeCategory === 'all'
                ? 'Hand-picked by our team'
                : `${featured.length} in this category`
            }
            action={{ label: 'View more' }}
          />
          {featured.length > 0 ? (
            <FeaturedGrid auctions={featured} onOpen={open} />
          ) : (
            <EmptyHint
              title={loading ? 'Loading\u2026' : 'No auctions in this category yet'}
              body="Try a different category or post your own listing."
            />
          )}
        </section>

        {/* My activity */}
        <section className="flex flex-col gap-3">
          <SectionHeader title="My Activity" subtitle="Your bids, your wins" />
          <MyActivityPanel data={activity} />
        </section>
      </div>
    </UserShell>
  );
}

function EmptyHint({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-dashed border-white/10 bg-graphite/40 p-8 text-center">
      <p className="text-[14px] font-medium text-bone">{title}</p>
      <p className="mt-1 text-[12px] text-bone/55">{body}</p>
    </div>
  );
}

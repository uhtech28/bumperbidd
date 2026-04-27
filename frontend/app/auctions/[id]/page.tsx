'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ApiError,
  Auction,
  auctionsApi,
  walletApi,
  WalletBalance,
} from '../../../lib/api';
import { formatINR } from '../../../lib/format';
import { useAuctionSocket } from '../../../hooks/useAuctionSocket';
import ProxyBidWidget from '../../../components/bidding/ProxyBidWidget';

/**
 * /auctions/[id] — the live auction room.
 *
 * Reads snapshot via REST, then subscribes to /ws for live updates.
 * Anti-sniping: whenever a bid arrives, endsAt may get extended by 30s
 * — the useAuctionSocket hook surfaces the new endsAt so the countdown
 * reflects the fresh end time.
 *
 * Bid UX:
 *   - Default amount is currentHighBid + minIncrement
 *   - "+" button bumps by minIncrement
 *   - Place Bid submits to REST; Redis Lua serializes the write
 *   - Error codes map to readable messages (BID_TOO_LOW, INSUFFICIENT_FUNDS,
 *     ALREADY_HIGHEST_BIDDER, AUCTION_ENDED)
 */
export default function AuctionRoomPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [auction, setAuction] = useState<Auction | null>(null);
  const [wallet, setWallet] = useState<WalletBalance | null>(null);
  const [loading, setLoading] = useState(true);
  const [placing, setPlacing] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [currentBid, setCurrentBid] = useState<number>(0);
  const [bidAmount, setBidAmount] = useState<number>(0);
  const [bidCount, setBidCount] = useState<number>(0);
  const [endsAt, setEndsAt] = useState<number>(0);
  const [now, setNow] = useState(Date.now());

  const { connected, latestBid, ended, endsAt: wsEndsAt } =
    useAuctionSocket(id);

  // initial load
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    async function load() {
      try {
        const [a, w] = await Promise.all([
          auctionsApi.get(id),
          walletApi.balance().catch(() => null),
        ]);
        if (cancelled) return;
        setAuction(a);
        setWallet(w);
        const cur = a.live.currentHighBid ?? a.pricing.startingPrice;
        setCurrentBid(cur);
        setBidCount(a.live.bidCount);
        setEndsAt(new Date(a.endsAt).getTime());
        setBidAmount(cur + a.pricing.minIncrement);
      } catch (e) {
        const msg = e instanceof ApiError ? e.message : (e as Error).message;
        if (!cancelled) setErr(msg);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  // WS bid events
  useEffect(() => {
    if (!latestBid || !auction) return;
    setCurrentBid(latestBid.amount);
    setBidCount((c) => c + 1);
    setBidAmount((prev) => {
      const floor = latestBid.amount + auction.pricing.minIncrement;
      return prev < floor ? floor : prev;
    });
  }, [latestBid, auction]);

  useEffect(() => {
    if (wsEndsAt) setEndsAt(wsEndsAt);
  }, [wsEndsAt]);

  // 1Hz countdown tick
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(t);
  }, []);

  const remainingMs = Math.max(0, endsAt - now);
  const remaining = useMemo(() => {
    const total = Math.floor(remainingMs / 1000);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    return { h, m, s };
  }, [remainingMs]);

  async function onPlaceBid() {
    if (!auction) return;
    setErr(null);
    setPlacing(true);
    try {
      const res = await auctionsApi.placeBid(auction.id, bidAmount);
      setCurrentBid(res.newHighBid);
      setEndsAt(res.endsAt);
      // refresh wallet balance — funds just moved to held
      walletApi.balance().then(setWallet).catch(() => void 0);
    } catch (e) {
      if (e instanceof ApiError) {
        setErr(`${e.code}: ${e.message}`);
      } else {
        setErr((e as Error).message);
      }
    } finally {
      setPlacing(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-dvh flex items-center justify-center">
        <p className="text-white/50">Loading auction…</p>
      </main>
    );
  }
  if (!auction) {
    return (
      <main className="min-h-dvh px-6 py-10">
        <p className="text-white/60">Auction not found.</p>
        <Link href="/auctions" className="text-white/70 underline mt-4 inline-block">
          ← Back to auctions
        </Link>
      </main>
    );
  }

  const img = auction.vehicle.imageUrls[0];
  const isLive = auction.status === 'live' && remainingMs > 0 && !ended;
  const isEnded = auction.status === 'ended' || ended || remainingMs <= 0;

  return (
    <main className="min-h-dvh px-4 sm:px-8 py-6 max-w-[1240px] mx-auto">
      <Link
        href="/auctions"
        className="text-sm text-white/60 hover:text-white inline-block mb-4"
      >
        ← All auctions
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-[1.3fr_1fr] gap-8">
        {/* === LEFT: vehicle === */}
        <div>
          <div
            className="aspect-[16/10] rounded-lg bg-neutral-900 bg-cover bg-center border border-white/10"
            style={img ? { backgroundImage: `url(${img})` } : undefined}
          />
          <h1 className="text-2xl sm:text-3xl font-display tracking-tight mt-6">
            {auction.title}
          </h1>
          <div className="mt-2 flex flex-wrap gap-2 text-xs text-white/60">
            <Chip>{auction.vehicle.year}</Chip>
            <Chip>{auction.vehicle.kmDriven.toLocaleString('en-IN')} km</Chip>
            <Chip>{auction.vehicle.fuelType.toUpperCase()}</Chip>
            <Chip>{auction.vehicle.city}</Chip>
            <Chip>{auction.vehicle.ownerCount} owner</Chip>
          </div>
          <p className="mt-6 text-sm leading-relaxed text-white/70 whitespace-pre-line">
            {auction.description}
          </p>
        </div>

        {/* === RIGHT: bid panel === */}
        <aside className="lg:sticky lg:top-6 self-start">
          <div className="rounded-lg border border-white/10 p-5 bg-white/[0.02]">
            <div className="flex items-center justify-between mb-4">
              <span
                className={`text-[11px] uppercase tracking-wider px-2 py-0.5 rounded ${
                  isLive
                    ? 'bg-red-500/20 text-red-200 border border-red-500/30'
                    : isEnded
                      ? 'bg-white/10 text-white/60 border border-white/10'
                      : 'bg-amber-500/20 text-amber-200 border border-amber-500/30'
                }`}
              >
                {isLive ? '● Live' : isEnded ? 'Ended' : 'Scheduled'}
              </span>
              <span className="text-[10px] text-white/40">
                {connected ? '● realtime' : '○ offline'}
              </span>
            </div>

            <p className="text-xs text-white/50">Current high bid</p>
            <p className="text-3xl font-semibold mt-1 tabular-nums">
              {formatINR(currentBid / 100)}
            </p>
            <p className="text-xs text-white/40 mt-1">
              {bidCount} bid{bidCount === 1 ? '' : 's'} · min next{' '}
              {formatINR(
                (currentBid + auction.pricing.minIncrement) / 100,
              )}
            </p>

            {isLive && (
              <div className="mt-4 font-mono tabular-nums text-xl text-amber-200">
                {String(remaining.h).padStart(2, '0')}:
                {String(remaining.m).padStart(2, '0')}:
                {String(remaining.s).padStart(2, '0')}
              </div>
            )}
            {isEnded && (
              <div className="mt-4 text-sm text-white/70">
                Final price: {formatINR((auction.outcome.finalPrice ?? currentBid) / 100)}
              </div>
            )}

            {isLive && (
              <div className="mt-5 border-t border-white/10 pt-5">
                <label className="text-xs text-white/50 uppercase tracking-wide">
                  Your bid (INR)
                </label>
                <div className="mt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setBidAmount((v) =>
                        Math.max(
                          currentBid + auction.pricing.minIncrement,
                          v - auction.pricing.minIncrement,
                        ),
                      )
                    }
                    className="h-10 w-10 rounded border border-white/20 hover:border-white/50 text-lg"
                  >
                    –
                  </button>
                  <input
                    type="number"
                    value={Math.floor(bidAmount / 100)}
                    onChange={(e) => {
                      const rupees = parseInt(e.target.value, 10);
                      if (!Number.isNaN(rupees)) setBidAmount(rupees * 100);
                    }}
                    className="flex-1 h-10 rounded border border-white/20 bg-transparent px-3 tabular-nums text-right"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setBidAmount((v) => v + auction.pricing.minIncrement)
                    }
                    className="h-10 w-10 rounded border border-white/20 hover:border-white/50 text-lg"
                  >
                    +
                  </button>
                </div>
                <button
                  type="button"
                  disabled={placing}
                  onClick={onPlaceBid}
                  className="mt-3 w-full h-11 rounded font-medium bg-[#D4A017] text-black hover:bg-[#E8B626] disabled:opacity-50"
                >
                  {placing ? 'Placing bid…' : 'Place bid'}
                </button>
                {err && (
                  <p className="mt-3 text-xs text-red-300">{err}</p>
                )}
                <p className="mt-3 text-[11px] text-white/40">
                  Placing a bid reserves funds from your wallet. If someone
                  outbids you the funds are immediately released.
                </p>
              </div>
            )}

            {wallet && (
              <div className="mt-5 border-t border-white/10 pt-4 text-xs">
                <div className="flex justify-between">
                  <span className="text-white/50">Wallet balance</span>
                  <span className="tabular-nums">
                    {formatINR(wallet.balance / 100)}
                  </span>
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-white/50">Held for bids</span>
                  <span className="tabular-nums">
                    {formatINR(wallet.heldBalance / 100)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => router.push('/wallet')}
                  className="mt-3 text-[11px] text-white/60 hover:text-white underline-offset-4 hover:underline"
                >
                  Top up wallet →
                </button>
              </div>
            )}
            {auction.status === 'live' && wallet && (
              <div className="mt-5 border-t border-white/10 pt-4">
                <ProxyBidWidget
                  auctionId={auction.id}
                  currentHigh={auction.live.currentHighBid ?? auction.pricing.startingPrice}
                  minIncrement={auction.pricing.minIncrement}
                />
              </div>
            )}
          </div>
        </aside>
      </div>
    </main>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="px-2 py-0.5 rounded-full border border-white/15">
      {children}
    </span>
  );
}

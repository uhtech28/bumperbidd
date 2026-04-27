'use client';
import { useRef } from 'react';
import { AuctionCard } from './AuctionCard';
import type { Auction } from './mock-data';

interface Props {
  auctions: Auction[];
  onJoin?: (auction: Auction) => void;
  onOpen?: (auction: Auction) => void;
}

/**
 * Horizontal, snap-locked rail of live auctions. Hides the native
 * scrollbar (iOS behaviour by default, Android/desktop via inline style)
 * and uses scroll-snap-type: x mandatory so each flick locks a card to
 * the left edge. Left padding matches the page gutter; right padding is
 * applied via an invisible end-spacer to avoid an awkward trailing gap
 * on snap containers.
 */
export function LiveAuctionsRail({ auctions, onJoin, onOpen }: Props) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  return (
    <div className="relative">
      <div
        ref={scrollerRef}
        className="flex snap-x snap-mandatory gap-3 overflow-x-auto overflow-y-hidden scroll-smooth pb-1 [scrollbar-width:none] [-ms-overflow-style:none]"
        style={{
          WebkitOverflowScrolling: 'touch',
          paddingLeft: '20px',
          paddingRight: '20px',
        }}
      >
        {/* Hide webkit scrollbar */}
        <style>{`div[data-live-rail]::-webkit-scrollbar{display:none}`}</style>
        {auctions.map((a) => (
          <AuctionCard
            key={a.id}
            auction={a}
            onJoin={onJoin}
            onOpen={onOpen}
          />
        ))}
        {/* End spacer so the last card can snap without hugging the edge */}
        <div aria-hidden className="shrink-0" style={{ width: 4 }} />
      </div>
    </div>
  );
}

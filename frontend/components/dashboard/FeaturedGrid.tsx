'use client';
import clsx from 'clsx';
import { motion } from 'framer-motion';
import { VehicleThumb } from './VehicleThumb';
import { CountdownTimer } from './CountdownTimer';
import { formatINRCompact } from '@/lib/format';
import type { Auction } from './mock-data';

interface Props {
  auctions: Auction[];
  onOpen?: (auction: Auction) => void;
}

/**
 * Two-column grid of trending auctions. Cards are denser than the live
 * rail — compact bid + timer stacked under a 4:3 media block. Kept as
 * full tap targets so the whole tile feels touch-native on mobile.
 */
export function FeaturedGrid({ auctions, onOpen }: Props) {
  return (
    <div className="grid grid-cols-2 gap-3 px-5">
      {auctions.map((a) => (
        <FeaturedCard key={a.id} auction={a} onOpen={onOpen} />
      ))}
    </div>
  );
}

interface CardProps {
  auction: Auction;
  onOpen?: (auction: Auction) => void;
}

function FeaturedCard({ auction, onOpen }: CardProps) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.975 }}
      transition={{ type: 'spring', stiffness: 400, damping: 26 }}
      onClick={() => onOpen?.(auction)}
      className={clsx(
        'group flex flex-col overflow-hidden rounded-xl text-left',
        'border border-white/8 bg-graphite/70 shadow-card',
        'transition-colors hover:border-brand-500/25',
      )}
      aria-label={`Open auction ${auction.title}`}
    >
      <VehicleThumb auction={auction} variant="grid" />
      <div className="flex flex-col gap-1.5 p-3">
        <p className="truncate font-display text-[12px] font-medium tracking-wide text-bone">
          {auction.title}
        </p>
        <p className="truncate text-[10px] text-bone/45">
          {auction.subtitle}
        </p>
        <div className="mt-1 flex items-center justify-between">
          <span className="font-display text-[14px] font-semibold tabular-nums text-brand-300">
            {formatINRCompact(auction.currentBid)}
          </span>
          <CountdownTimer endsAt={auction.endsAt} size="sm" showIcon={false} />
        </div>
      </div>
    </motion.button>
  );
}

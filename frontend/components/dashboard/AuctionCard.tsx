'use client';
import clsx from 'clsx';
import { motion } from 'framer-motion';
import { VehicleThumb } from './VehicleThumb';
import { CountdownTimer } from './CountdownTimer';
import { formatINR } from '@/lib/format';
import type { Auction } from './mock-data';

interface Props {
  auction: Auction;
  onJoin?: (auction: Auction) => void;
  onOpen?: (auction: Auction) => void;
  className?: string;
}

/**
 * Primary auction card used inside LiveAuctionsRail. Built as a two-region
 * surface: a 16:10 image block on top (VehicleThumb) and a dense info
 * stack below with current bid, bidders, timer, and the Join Auction CTA.
 *
 * The outer wrapper is a motion.article so tapping the card surface feels
 * live — scale drops 2% on press with a spring settle. The CTA has its
 * own whileTap so the two feedbacks don't fight. Size is fixed at 280px
 * wide so the next card peeks through on 360-412px mobile viewports; the
 * parent rail uses snap-x to lock each card to the left edge on flick.
 */
export function AuctionCard({ auction, onJoin, onOpen, className }: Props) {
  return (
    <motion.article
      whileTap={{ scale: 0.985 }}
      transition={{ type: 'spring', stiffness: 380, damping: 28 }}
      onClick={() => onOpen?.(auction)}
      className={clsx(
        'group relative flex w-[280px] shrink-0 snap-start flex-col overflow-hidden rounded-2xl',
        'border border-white/8 bg-graphite/70 shadow-card',
        'transition-colors hover:border-brand-500/25',
        className,
      )}
    >
      {/* Media */}
      <div className="relative">
        <VehicleThumb auction={auction} variant="rail" />

        {/* Live pill */}
        <div className="absolute left-3 bottom-3 flex items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 backdrop-blur">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inset-0 animate-ping rounded-full bg-red-500/70" />
            <span className="relative h-1.5 w-1.5 rounded-full bg-red-500" />
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-bone/90">
            Live
          </span>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="min-w-0">
          <h3 className="truncate font-display text-[15px] font-medium tracking-wide text-bone">
            {auction.title}
          </h3>
          <p className="mt-0.5 truncate text-[11px] text-bone/50">
            {auction.subtitle}
          </p>
        </div>

        {/* Bid + meta row */}
        <div className="flex items-end justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.18em] text-bone/40">
              Current bid
            </p>
            <p
              className="mt-0.5 font-display text-[20px] font-semibold tabular-nums leading-none text-brand-300"
              style={{
                textShadow: '0 0 24px rgba(212,160,23,0.25)',
              }}
            >
              {formatINR(auction.currentBid)}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <CountdownTimer endsAt={auction.endsAt} size="sm" />
            <span className="inline-flex items-center gap-1 text-[10px] text-bone/50">
              <BiddersGlyph />
              <span className="tabular-nums">{auction.bidders}</span>
            </span>
          </div>
        </div>

        {/* CTA */}
        <motion.button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onJoin?.(auction);
          }}
          whileTap={{ scale: 0.97 }}
          transition={{ type: 'spring', stiffness: 400, damping: 24 }}
          className={clsx(
            'relative mt-1 h-10 w-full overflow-hidden rounded-xl',
            'bg-gradient-to-br from-brand-300 via-brand-500 to-brand-700',
            'text-[13px] font-semibold tracking-wide text-black',
            'shadow-[0_8px_24px_-8px_rgba(212,160,23,0.55)]',
            'transition-shadow hover:shadow-[0_12px_32px_-8px_rgba(212,160,23,0.7)]',
          )}
          aria-label={`Join auction for ${auction.title}`}
        >
          <span className="relative z-10">Join Auction</span>
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/35 to-transparent group-hover:translate-x-full group-hover:transition-transform group-hover:duration-[900ms]"
          />
        </motion.button>
      </div>
    </motion.article>
  );
}

function BiddersGlyph() {
  return (
    <svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden>
      <circle cx="4" cy="4" r="2" stroke="currentColor" strokeWidth="1.1" />
      <path
        d="M1.5 10.5c0-1.5 1.5-2.5 2.5-2.5s2.5 1 2.5 2.5"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
      />
      <circle cx="9" cy="5" r="1.6" stroke="currentColor" strokeWidth="1" />
      <path
        d="M7.5 10.5c0-1 .8-2 2-2s2 1 2 2"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
      />
    </svg>
  );
}

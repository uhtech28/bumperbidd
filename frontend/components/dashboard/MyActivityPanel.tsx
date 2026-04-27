'use client';
import clsx from 'clsx';
import { motion } from 'framer-motion';
import { formatINRCompact } from '@/lib/format';
import { formatRelativeMinutes } from '@/lib/format';
import type { ActivitySnapshot, RecentBid } from './mock-data';

interface Props {
  data: ActivitySnapshot;
  onViewAll?: () => void;
}

/**
 * Summary + recent-bids panel. Laid out as a single tactile surface:
 * three stat tiles up top (joined / bids placed / winning), a thin
 * divider, then a scrollable list of recent bids with status pills.
 *
 * The winning stat gets the gold treatment so it reads as an achievement
 * metric rather than just a number; bids placed and joined stay in bone
 * so the eye lands on winning first.
 */
export function MyActivityPanel({ data, onViewAll }: Props) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="mx-5 overflow-hidden rounded-2xl border border-white/8 bg-graphite/60 shadow-card backdrop-blur"
    >
      {/* Stats row */}
      <div className="grid grid-cols-3 divide-x divide-white/5">
        <Stat
          label="Joined"
          value={data.auctionsJoined.toString()}
        />
        <Stat
          label="Bids placed"
          value={data.bidsPlaced.toString()}
        />
        <Stat
          label="Winning"
          value={data.winning.toString()}
          tone="gold"
        />
      </div>

      {/* Lifetime banner */}
      <div className="relative flex items-center justify-between border-t border-white/5 px-4 py-2.5">
        <div className="flex items-center gap-2 text-[11px] text-bone/55">
          <TrophyGlyph />
          <span>Lifetime won value</span>
        </div>
        <span className="font-display text-[13px] font-semibold tabular-nums text-brand-300">
          {formatINRCompact(data.wonLifetimeValue)}
        </span>
      </div>

      {/* Recent bids list */}
      <div className="border-t border-white/5">
        <div className="flex items-center justify-between px-4 pt-3">
          <h3 className="text-[12px] font-medium uppercase tracking-[0.18em] text-bone/50">
            Recent bids
          </h3>
          {onViewAll && (
            <button
              type="button"
              onClick={onViewAll}
              className="text-[11px] font-medium text-brand-400 hover:text-brand-300"
            >
              View all
            </button>
          )}
        </div>
        <ul className="flex flex-col">
          {data.recent.map((bid, i) => (
            <RecentBidRow key={bid.id} bid={bid} last={i === data.recent.length - 1} />
          ))}
        </ul>
      </div>
    </motion.section>
  );
}

function Stat({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: string;
  tone?: 'default' | 'gold';
}) {
  return (
    <div className="flex flex-col items-start px-4 py-3">
      <span className="text-[10px] uppercase tracking-[0.18em] text-bone/45">
        {label}
      </span>
      <span
        className={clsx(
          'mt-1 font-display text-[22px] font-semibold leading-none tabular-nums',
          tone === 'gold' ? 'text-brand-300' : 'text-bone',
        )}
        style={
          tone === 'gold'
            ? { textShadow: '0 0 20px rgba(212,160,23,0.35)' }
            : undefined
        }
      >
        {value}
      </span>
    </div>
  );
}

function RecentBidRow({ bid, last }: { bid: RecentBid; last: boolean }) {
  const toneClass =
    bid.state === 'winning'
      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-400/25'
      : bid.state === 'outbid'
        ? 'bg-red-500/15 text-red-300 border-red-400/25'
        : 'bg-brand-500/15 text-brand-200 border-brand-400/25';

  const label =
    bid.state === 'winning'
      ? 'Winning'
      : bid.state === 'outbid'
        ? 'Outbid'
        : 'Won';

  return (
    <li
      className={clsx(
        'flex items-center justify-between gap-3 px-4 py-3',
        !last && 'border-b border-white/5',
      )}
    >
      <div className="min-w-0">
        <p className="truncate text-[13px] font-medium text-bone">
          {bid.auctionTitle}
        </p>
        <p className="mt-0.5 text-[11px] text-bone/45">
          {formatRelativeMinutes(bid.placedAtMinutesAgo)}
        </p>
      </div>
      <div className="flex flex-col items-end gap-1">
        <span className="font-display text-[13px] font-semibold tabular-nums text-bone">
          {formatINRCompact(bid.amount)}
        </span>
        <span
          className={clsx(
            'rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider',
            toneClass,
          )}
        >
          {label}
        </span>
      </div>
    </li>
  );
}

function TrophyGlyph() {
  return (
    <svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path
        d="M4 2h6v3a3 3 0 0 1-6 0V2z"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinejoin="round"
      />
      <path
        d="M4 3.5H2.5v1A2.5 2.5 0 0 0 5 7M10 3.5h1.5v1A2.5 2.5 0 0 1 9 7"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
      />
      <path
        d="M6 8.5v2M8 8.5v2M4.5 12h5"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
      />
    </svg>
  );
}

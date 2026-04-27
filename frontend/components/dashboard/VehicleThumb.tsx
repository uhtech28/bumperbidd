import clsx from 'clsx';
import type { Auction } from './mock-data';

interface Props {
  auction: Auction;
  variant?: 'rail' | 'grid';
  className?: string;
}

/**
 * Auction photo block for dashboard cards.
 *
 * Behavior:
 *   - Real photo present (auction.imageUrls[0]) → render the image and
 *     show NOTHING else inside (Category/Tag badges and the parent's
 *     "Live" pill float on top of the photo).
 *   - No photo → render the premium gradient placeholder WITH the model
 *     name overlay so the card still reads.
 *
 * Why this conditional layout matters: when both an image AND a bottom-
 * positioned title overlay are stacked, the AuctionCard's "Live" pill
 * (also bottom-left) overlaps the title text and looks broken. Drop
 * the overlay whenever a real image carries the brand cue.
 */
export function VehicleThumb({ auction, variant = 'rail', className }: Props) {
  const [from, to] = auction.gradient;
  const short = auction.title.replace(/\s+/g, ' ').trim();
  const hero = auction.imageUrls?.find((u) => !!u);

  return (
    <div
      className={clsx(
        'relative w-full overflow-hidden bg-graphite/80',
        variant === 'rail' ? 'aspect-[16/10]' : 'aspect-[4/3]',
        className,
      )}
    >
      {hero ? (
        // Real photo path
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={hero}
            alt={short}
            className="absolute inset-0 h-full w-full object-cover"
            loading="lazy"
          />
          {/* Soft bottom gradient so the parent's "Live" pill stays
              readable on light photos. */}
          <div
            aria-hidden
            className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/55 to-transparent"
          />
        </>
      ) : (
        // Gradient placeholder path
        <>
          <div
            className="absolute inset-0"
            style={{
              background: `linear-gradient(135deg, ${from} 0%, ${to} 100%)`,
            }}
          />
          {/* Subtle gold sheen */}
          <div
            aria-hidden
            className="absolute inset-0 opacity-[0.14]"
            style={{
              background:
                'radial-gradient(120% 80% at 20% 0%, rgba(212,160,23,0.9), transparent 45%), radial-gradient(80% 60% at 90% 100%, rgba(212,160,23,0.35), transparent 55%)',
            }}
          />
          {/* Diagonal speed lines */}
          <div
            aria-hidden
            className="absolute inset-0 opacity-[0.08]"
            style={{
              backgroundImage:
                'repeating-linear-gradient(115deg, rgba(255,255,255,0.6) 0, rgba(255,255,255,0.6) 1px, transparent 1px, transparent 14px)',
            }}
          />
          {/* Model name overlay — only when no real photo exists. We
              inset from the BOTTOM-LEFT enough to clear the parent's
              Live pill (left-3 bottom-3 + ~22px tall pill). */}
          <div className="absolute inset-x-4 bottom-12">
            <span
              className={clsx(
                'font-display uppercase tracking-[0.16em] text-bone/90',
                variant === 'rail' ? 'text-[15px]' : 'text-[11px]',
              )}
              style={{ textShadow: '0 2px 8px rgba(0,0,0,0.55)' }}
            >
              {short}
            </span>
          </div>
        </>
      )}

      {/* Category badge top-left (always shown) */}
      <div className="absolute left-3 top-3 z-10">
        <span
          className={clsx(
            'rounded-full bg-black/45 px-2 py-0.5 text-[10px] uppercase tracking-wider text-bone/75 backdrop-blur',
            'border border-white/10',
          )}
        >
          {auction.category}
        </span>
      </div>

      {/* Tag top-right (if any, always shown) */}
      {auction.tag && (
        <div className="absolute right-3 top-3 z-10">
          <span
            className={clsx(
              'rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider backdrop-blur',
              auction.tag === 'Hot'
                ? 'bg-red-500/20 text-red-300 border border-red-400/30'
                : auction.tag === 'Ending soon'
                  ? 'bg-amber-500/20 text-amber-200 border border-amber-400/30'
                  : auction.tag === 'Featured'
                    ? 'bg-brand-500/20 text-brand-200 border border-brand-400/30'
                    : 'bg-emerald-500/20 text-emerald-200 border border-emerald-400/30',
            )}
          >
            {auction.tag}
          </span>
        </div>
      )}
    </div>
  );
}

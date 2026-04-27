'use client';
import clsx from 'clsx';
import { motion } from 'framer-motion';

export interface Category {
  id: string;
  label: string;
  count?: number;
}

interface Props {
  categories: Category[];
  activeId: string;
  onChange?: (id: string) => void;
}

/**
 * Horizontal chip row for filtering the feed by auction category. The
 * active chip flips to the gold lock-up (filled + black text) so it
 * reads as the "selected" state against the dark background without
 * needing an underline or border tell. Inactive chips sit on a faint
 * hairline so the rail has rhythm even when empty of selection.
 *
 * Uses layoutId on the background pill so switching categories animates
 * a sliding highlight across the rail — a tiny detail that sells the
 * premium feel.
 */
export function CategoryRail({ categories, activeId, onChange }: Props) {
  return (
    <div
      className="flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [-ms-overflow-style:none]"
      style={{ WebkitOverflowScrolling: 'touch' }}
    >
      <style>{`.bb-chip-rail::-webkit-scrollbar{display:none}`}</style>
      {categories.map((cat) => {
        const active = cat.id === activeId;
        return (
          <motion.button
            key={cat.id}
            type="button"
            onClick={() => onChange?.(cat.id)}
            whileTap={{ scale: 0.94 }}
            transition={{ type: 'spring', stiffness: 400, damping: 22 }}
            className={clsx(
              'relative flex shrink-0 items-center gap-1.5 rounded-full px-4 h-9',
              'text-[12px] font-medium tracking-wide transition-colors',
              active
                ? 'text-black'
                : 'text-bone/70 hover:text-bone border border-white/10 bg-white/[0.03] hover:bg-white/[0.06]',
            )}
            aria-pressed={active}
          >
            {active && (
              <motion.span
                layoutId="chip-active-bg"
                transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                className="absolute inset-0 rounded-full bg-gradient-to-br from-brand-300 to-brand-600 shadow-[0_6px_20px_-6px_rgba(212,160,23,0.6)]"
              />
            )}
            <span className="relative z-10">{cat.label}</span>
            {typeof cat.count === 'number' && (
              <span
                className={clsx(
                  'relative z-10 tabular-nums text-[10px]',
                  active ? 'text-black/55' : 'text-bone/40',
                )}
              >
                {cat.count}
              </span>
            )}
          </motion.button>
        );
      })}
    </div>
  );
}

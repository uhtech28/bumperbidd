'use client';
import { useEffect, useState } from 'react';
import clsx from 'clsx';
import { motion } from 'framer-motion';
import { formatINRCompact } from '@/lib/format';

interface Props {
  walletBalance: number;
  notificationCount?: number;
  identity: string;
  onWalletClick?: () => void;
  onNotificationsClick?: () => void;
  onAvatarClick?: () => void;
}

/**
 * Sticky top chrome. Becomes a backdrop-blur frosted bar once the user
 * scrolls past ~8px so the rail cards read cleanly underneath. Built
 * with motion.div to get a subtle entry animation on first mount.
 */
export function TopBar({
  walletBalance,
  notificationCount = 0,
  identity,
  onWalletClick,
  onNotificationsClick,
  onAvatarClick,
}: Props) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const initials = identity
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(0, 2)
    .toUpperCase() || 'BB';

  return (
    <motion.header
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className={clsx(
        'sticky top-0 z-30 flex h-14 items-center justify-between px-5 transition-colors duration-200',
        scrolled
          ? 'bg-ink/75 backdrop-blur-xl border-b border-white/5'
          : 'bg-transparent',
      )}
      style={{
        paddingTop: 'max(env(safe-area-inset-top), 0px)',
      }}
    >
      {/* Left: wordmark */}
      <div className="flex items-center gap-2">
        <LogoGlyph />
        <span className="font-display text-[13px] font-semibold uppercase tracking-[0.28em] text-bone">
          Bumper<span className="text-brand-400">bid</span>
        </span>
      </div>

      {/* Right: wallet + bell + avatar */}
      <div className="flex items-center gap-2">
        <motion.button
          type="button"
          onClick={onWalletClick}
          whileTap={{ scale: 0.96 }}
          className={clsx(
            'flex items-center gap-1.5 rounded-full border border-brand-400/25 bg-brand-500/10 px-3 h-8',
            'text-[12px] font-medium text-brand-300 transition-colors hover:bg-brand-500/15',
          )}
          aria-label={`Wallet balance ${formatINRCompact(walletBalance)}`}
        >
          <WalletGlyph />
          <span className="tabular-nums">
            {formatINRCompact(walletBalance)}
          </span>
        </motion.button>

        <motion.button
          type="button"
          onClick={onNotificationsClick}
          whileTap={{ scale: 0.92 }}
          className="relative flex h-9 w-9 items-center justify-center rounded-full border border-white/8 bg-white/[0.03] text-bone/80 transition-colors hover:bg-white/[0.06]"
          aria-label={`${notificationCount} new notifications`}
        >
          <BellGlyph />
          {notificationCount > 0 && (
            <span className="absolute right-1 top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
              {notificationCount > 9 ? '9+' : notificationCount}
            </span>
          )}
        </motion.button>

        <motion.button
          type="button"
          onClick={onAvatarClick}
          whileTap={{ scale: 0.92 }}
          className="relative flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-brand-700 text-[11px] font-bold text-black ring-1 ring-brand-400/40 transition-transform"
          aria-label="Profile"
        >
          {initials}
        </motion.button>
      </div>
    </motion.header>
  );
}

function LogoGlyph() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 18V6a2 2 0 0 1 2-2h7a5 5 0 0 1 3.5 8.5A5 5 0 0 1 13 20H6a2 2 0 0 1-2-2z"
        stroke="url(#bbg)"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <defs>
        <linearGradient id="bbg" x1="0" x2="24" y1="0" y2="24">
          <stop offset="0%" stopColor="#F5CC4E" />
          <stop offset="100%" stopColor="#B8870E" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function WalletGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect x="2" y="4" width="12" height="9" rx="2" stroke="currentColor" strokeWidth="1.3" />
      <path d="M11 8.5h1.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M2 6h10" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}

function BellGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M3.5 11.5V8a4.5 4.5 0 0 1 9 0v3.5l1 1.5h-11l1-1.5z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <path d="M6.5 13.5a1.5 1.5 0 0 0 3 0" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}

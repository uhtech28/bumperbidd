'use client';

/**
 * UserShell - the persistent layout chrome for every authed user page.
 *
 * Left sidebar (fixed, 240px on desktop, collapsing to a top bar on
 * narrow viewports) holds the brand lockup at top, primary navigation in
 * the middle, and the user identity + wallet at the bottom.
 *
 * Right side is a scrollable main column rendering the page's content.
 *
 * Auth gate: on mount we read the local session and validate via
 * authApi.me(). If the cookie is dead we bounce to /auth so users
 * can't sit on a stale screen.
 *
 * Pages opt-in by wrapping themselves with <UserShell>{children}</UserShell>
 * rather than rendering the bare <main>. The dashboard is the canonical
 * example.
 */
import { ReactNode, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { session, type Session } from '@/lib/session';
import { authApi, walletApi, notificationsApi, type WalletBalance } from '@/lib/api';
import { maskPhone } from '@/lib/phone';
import { Brand } from './Brand';

interface NavItem {
  href: string;
  label: string;
  icon: ReactNode;
}

const HomeIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 11.5 12 4l9 7.5" /><path d="M5 10v10h14V10" />
  </svg>
);
const GavelIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
    <path d="m14 14-7.07 7.07a1.5 1.5 0 0 1-2.12-2.12L11.88 11.9" />
    <path d="m9 8 6-6 6 6-6 6z" /><path d="M3 21h12" />
  </svg>
);
const SearchIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
  </svg>
);
const HeartIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
  </svg>
);
const WalletIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 7h15a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3z" />
    <path d="M16 13h.01" /><path d="M3 7V5a2 2 0 0 1 2-2h11" />
  </svg>
);
const PlusIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 5v14M5 12h14" />
  </svg>
);
const BellIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
  </svg>
);
const ShieldIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

const NAV: NavItem[] = [
  { href: '/dashboard', label: 'Home', icon: <HomeIcon /> },
  { href: '/auctions', label: 'Live Auctions', icon: <GavelIcon /> },
  { href: '/search', label: 'Search', icon: <SearchIcon /> },
  { href: '/watchlist', label: 'Watchlist', icon: <HeartIcon /> },
  { href: '/seller/new', label: 'Sell a Vehicle', icon: <PlusIcon /> },
  { href: '/wallet', label: 'Wallet', icon: <WalletIcon /> },
  { href: '/notifications', label: 'Notifications', icon: <BellIcon /> },
  { href: '/account/wins', label: 'My Wins', icon: <TrophyIcon /> },
  { href: '/account/sales', label: 'My Sales', icon: <BoxIcon /> },
  { href: '/kyc', label: 'KYC', icon: <ShieldIcon /> },
  { href: '/account/profile', label: 'Account', icon: <AccountIcon /> },
];

function TrophyIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9V4h12v5a6 6 0 0 1-12 0z" />
      <path d="M4 5h2v3a3 3 0 0 1-3-3" /><path d="M20 5h-2v3a3 3 0 0 0 3-3" />
      <path d="M10 18h4M9 22h6M12 14v4" />
    </svg>
  );
}

function BoxIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 16V8l-9-5-9 5v8l9 5 9-5z" />
      <path d="M3.3 7 12 12l8.7-5M12 22V12" />
    </svg>
  );
}

function AccountIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </svg>
  );
}

const formatINR = (n: number) =>
  `\u20b9${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

export function UserShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [sess, setSess] = useState<Session | null>(null);
  const [wallet, setWallet] = useState<WalletBalance | null>(null);
  const [unread, setUnread] = useState<number>(0);
  const [signingOut, setSigningOut] = useState(false);

  // Session guard.
  useEffect(() => {
    const s = session.get();
    if (!s) {
      router.replace('/auth');
      return;
    }
    setSess(s);

    let cancelled = false;
    authApi.me()
      .then((res) => {
        if (cancelled) return;
        if (!res?.user) {
          session.clear();
          router.replace('/auth');
        }
      })
      .catch(() => {
        if (cancelled) return;
        session.clear();
        router.replace('/auth');
      });
    return () => { cancelled = true; };
  }, [router]);

  // Wallet + unread count for sidebar footer / nav badge.
  useEffect(() => {
    if (!sess) return;
    walletApi.balance().then(setWallet).catch(() => undefined);
    notificationsApi.list({ limit: 30 })
      .then((r) => setUnread(r.items.filter((n) => !n.isRead).length))
      .catch(() => undefined);
  }, [sess]);

  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await authApi.logout().catch(() => undefined);
    } finally {
      session.clear();
      router.replace('/auth');
    }
  }

  if (!sess) return null;

  const identity = sess.phone ? maskPhone(sess.phone) : (sess.email ?? 'your account');
  const walletRupees = Math.round((wallet?.balance ?? 0) / 100);

  return (
    <div className="min-h-screen bg-ink text-bone">
      {/* Ambient gold glow at the very top, behind the sidebar header */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 h-72 bg-[radial-gradient(60%_100%_at_15%_0%,rgba(212,160,23,0.12),transparent_70%)]"
      />

      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[244px] flex-col border-r border-white/8 bg-graphite/80 backdrop-blur-xl md:flex">
        <div className="flex flex-col items-center px-5 pt-6 pb-4">
          <Brand size="sidebar" />
        </div>

        <nav className="flex flex-1 flex-col gap-0.5 px-3 py-2">
          {NAV.map((item) => {
            const isActive =
              item.href === '/dashboard'
                ? pathname === '/dashboard'
                : pathname === item.href || pathname.startsWith(`${item.href}/`);
            const isBell = item.href === '/notifications';
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`group flex items-center gap-3 rounded-lg px-3 py-2 text-[13.5px] transition-colors ${
                  isActive
                    ? 'bg-brand-500/10 text-brand-300 ring-1 ring-brand-500/25'
                    : 'text-bone/70 hover:bg-white/5 hover:text-bone'
                }`}
              >
                <span className={`h-4 w-4 shrink-0 ${isActive ? 'text-brand-300' : 'text-bone/55'}`}>
                  {item.icon}
                </span>
                <span className="flex-1 truncate">{item.label}</span>
                {isBell && unread > 0 && (
                  <span className="rounded-full bg-brand-500 px-1.5 py-0.5 text-[10px] font-semibold text-ink">
                    {unread > 9 ? '9+' : unread}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Footer: wallet + identity + sign out */}
        <div className="border-t border-white/8 px-3 py-3">
          <Link
            href="/wallet"
            className="mb-2 flex items-center justify-between rounded-lg bg-white/[0.03] px-3 py-2 ring-1 ring-white/5 hover:bg-white/[0.06]"
          >
            <span className="text-[11px] uppercase tracking-wider text-bone/45">
              Wallet
            </span>
            <span className="font-display text-[14px] font-semibold tabular-nums text-brand-300">
              {formatINR(walletRupees)}
            </span>
          </Link>
          <div className="flex items-center gap-2 rounded-lg px-2 py-1.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-500/15 text-[11px] font-semibold text-brand-300 ring-1 ring-brand-500/30">
              {identity.slice(0, 2).toUpperCase()}
            </div>
            <span className="flex-1 truncate text-[12px] text-bone/75">{identity}</span>
            <button
              onClick={handleSignOut}
              disabled={signingOut}
              title="Sign out"
              className="rounded-md p-1 text-bone/45 hover:bg-white/5 hover:text-bone"
            >
              <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <path d="m16 17 5-5-5-5" /><path d="M21 12H9" />
              </svg>
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile top bar (visible <md) */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-white/8 bg-graphite/85 px-4 py-2.5 backdrop-blur md:hidden">
        <Brand size="topbar" />
        <Link
          href="/notifications"
          className="relative rounded-full p-2 text-bone/70 hover:bg-white/5"
        >
          <BellIcon />
          {unread > 0 && (
            <span className="absolute right-1 top-1 inline-block h-2 w-2 rounded-full bg-brand-500" />
          )}
        </Link>
      </div>

      {/* Main column */}
      <main className="md:pl-[244px]">
        <motion.div
          key={pathname}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
        >
          {children}
        </motion.div>
      </main>

      {/* Mobile bottom nav (visible <md) */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-around border-t border-white/8 bg-graphite/90 px-2 py-1.5 backdrop-blur md:hidden">
        {NAV.slice(0, 5).map((item) => {
          const isActive =
            item.href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-0.5 px-2 py-1 text-[10px] ${
                isActive ? 'text-brand-300' : 'text-bone/55'
              }`}
            >
              <span className="h-5 w-5">{item.icon}</span>
              <span>{item.label.split(' ')[0]}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAdminUser } from './AuthGate';

/**
 * Sidebar navigation. Hidden on the login route (because AuthGate
 * short-circuits the layout). Highlights the active section based on
 * pathname and exposes a logout button at the bottom.
 */
const NAV = [
  { href: '/', label: 'Dashboard' },
  { href: '/users', label: 'Users' },
  { href: '/auctions', label: 'Auctions' },
  { href: '/auctions/new', label: 'Create Auction' },
  { href: '/bids', label: 'Bids' },
  { href: '/payments', label: 'Payments' },
  { href: '/transactions', label: 'Transactions' },
  { href: '/kyc', label: 'KYC' },
  { href: '/audit', label: 'Audit Log' },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAdminUser();

  if (pathname === '/login') return null;

  return (
    <aside className="bg-ink text-slate-100 p-5 flex flex-col">
      <div className="text-xl font-bold mb-6">BumperBid Admin</div>
      <nav className="flex flex-col gap-1 text-sm">
        {NAV.map((item) => {
          const isActive =
            item.href === '/'
              ? pathname === '/'
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded px-2 py-1.5 transition-colors ${
                isActive
                  ? 'bg-white/10 text-white'
                  : 'text-slate-300 hover:bg-white/5 hover:text-white'
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto pt-6 text-xs text-slate-400">
        {user?.email && <div className="mb-2 truncate">{user.email}</div>}
        <button
          onClick={logout}
          className="w-full rounded border border-white/15 px-2 py-1.5 text-slate-200 hover:bg-white/10"
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}

'use client';

/**
 * Brand - the canonical BumperBid lockup.
 *
 * Three layout variants:
 *   - 'sidebar'  (default): stacked monogram + wordmark + "AUCTIONS" tag
 *                + small "A unit of Zidan Auto Pvt Ltd." footnote.
 *                Used in the desktop UserShell sidebar header.
 *   - 'topbar': horizontal compact lockup for mobile top bars.
 *   - 'splash':  oversize stacked variant for auth/splash surfaces.
 *
 * Logo source of truth is /brand/bb-logo.png. Drop the master PNG there
 * to override; LogoMark falls back to a vector double-B if it's missing.
 */
import Link from 'next/link';
import { LogoMark } from '../brand/LogoMark';

interface Props {
  size?: 'sidebar' | 'topbar' | 'splash';
  href?: string;
}

const SIZES = {
  sidebar: { logo: 56, word: 'text-[18px]', sub: 'text-[9px]' },
  topbar: { logo: 32, word: 'text-[15px]', sub: 'text-[8px]' },
  splash: { logo: 132, word: 'text-[34px]', sub: 'text-[12px]' },
} as const;

export function Brand({ size = 'sidebar', href = '/dashboard' }: Props) {
  const s = SIZES[size];
  const stacked = size !== 'topbar';

  const lockup = (
    <div
      className={`flex select-none ${
        stacked ? 'flex-col items-center text-center' : 'flex-row items-center gap-2 text-left'
      }`}
    >
      <LogoMark size={s.logo} animate={size === 'splash'} />
      <div className={stacked ? 'mt-3' : ''}>
        <div
          className={`font-wordmark font-normal tracking-[0.18em] text-bone ${s.word}`}
          style={{ lineHeight: 1 }}
        >
          BUMPERBID
        </div>
        <div
          className={`mt-1 font-display font-medium uppercase tracking-[0.32em] text-brand-400 ${s.sub}`}
        >
          Auctions
        </div>
        {size === 'sidebar' && (
          <div className="mt-2 text-[10px] italic text-bone/45">
            A unit of Zidan Auto Pvt Ltd.
          </div>
        )}
        {size === 'splash' && (
          <div className="mt-3 text-[12px] italic text-bone/55">
            A unit of Zidan Auto Pvt Ltd.
          </div>
        )}
      </div>
    </div>
  );

  return (
    <Link href={href} className="block focus:outline-none">
      {lockup}
    </Link>
  );
}

'use client';

import type { CountryCode } from 'libphonenumber-js';

/**
 * FlagIcon — crisp inline-SVG flags.
 *
 * We deliberately avoid Unicode regional-indicator emoji flags: Chrome /
 * Edge on Windows render them as letter pairs (e.g. "IN") because
 * `Segoe UI Emoji` doesn't ship country-flag glyphs. A real brand can't
 * afford that inconsistency, so each flag is hand-drawn from primitives.
 */
interface Props {
  code: CountryCode | string;
  className?: string;
}

export function FlagIcon({ code, className }: Props) {
  const cls =
    'block overflow-hidden rounded-[3px] ring-1 ring-white/15 ' +
    (className ?? '');

  switch (code) {
    case 'IN':
      return (
        <svg viewBox="0 0 24 16" className={cls} width="22" height="14">
          <rect width="24" height="5.33" fill="#FF9933" />
          <rect y="5.33" width="24" height="5.34" fill="#fff" />
          <rect y="10.67" width="24" height="5.33" fill="#138808" />
          <circle cx="12" cy="8" r="1.55" fill="none" stroke="#000080" strokeWidth="0.45" />
          <circle cx="12" cy="8" r="0.45" fill="#000080" />
        </svg>
      );
    case 'US':
      return (
        <svg viewBox="0 0 24 16" className={cls} width="22" height="14">
          {Array.from({ length: 7 }).map((_, i) => (
            <rect
              key={i}
              y={i * 2.3}
              width="24"
              height="1.15"
              fill={i % 2 === 0 ? '#B22234' : '#fff'}
            />
          ))}
          <rect width="24" height="16" fill="none" stroke="#B22234" strokeWidth="0.5" opacity="0" />
          <rect x="0" y="0" width="9.6" height="8.6" fill="#3C3B6E" />
          <g fill="#fff">
            {[...Array(5)].flatMap((_, r) =>
              [...Array(6)].map((__, c) => (
                <circle
                  key={`${r}-${c}`}
                  cx={1 + c * 1.6}
                  cy={1 + r * 1.7}
                  r="0.42"
                />
              ))
            )}
          </g>
        </svg>
      );
    case 'GB':
      return (
        <svg viewBox="0 0 24 16" className={cls} width="22" height="14">
          <rect width="24" height="16" fill="#012169" />
          <path d="M0 0l24 16M24 0L0 16" stroke="#fff" strokeWidth="2" />
          <path d="M0 0l24 16M24 0L0 16" stroke="#C8102E" strokeWidth="1" />
          <path d="M12 0v16M0 8h24" stroke="#fff" strokeWidth="3" />
          <path d="M12 0v16M0 8h24" stroke="#C8102E" strokeWidth="1.6" />
        </svg>
      );
    case 'AE':
      return (
        <svg viewBox="0 0 24 16" className={cls} width="22" height="14">
          <rect width="24" height="16" fill="#fff" />
          <rect width="24" height="5.33" fill="#00732F" />
          <rect y="10.67" width="24" height="5.33" fill="#000" />
          <rect width="6" height="16" fill="#FF0000" />
        </svg>
      );
    case 'SG':
      return (
        <svg viewBox="0 0 24 16" className={cls} width="22" height="14">
          <rect width="24" height="8" fill="#EF3340" />
          <rect y="8" width="24" height="8" fill="#fff" />
          <circle cx="6.5" cy="4" r="2.3" fill="#fff" />
          <circle cx="7.6" cy="4" r="2.3" fill="#EF3340" />
        </svg>
      );
    case 'AU':
      return (
        <svg viewBox="0 0 24 16" className={cls} width="22" height="14">
          <rect width="24" height="16" fill="#012169" />
          <rect width="12" height="8" fill="#012169" />
          <path d="M0 0l12 8M12 0L0 8" stroke="#fff" strokeWidth="1.2" />
          <path d="M6 0v8M0 4h12" stroke="#fff" strokeWidth="1.6" />
          <path d="M6 0v8M0 4h12" stroke="#C8102E" strokeWidth="0.8" />
          <circle cx="18" cy="4.5" r="0.5" fill="#fff" />
          <circle cx="16" cy="10" r="0.5" fill="#fff" />
          <circle cx="20" cy="11" r="0.4" fill="#fff" />
          <circle cx="21" cy="6" r="0.4" fill="#fff" />
        </svg>
      );
    case 'CA':
      return (
        <svg viewBox="0 0 24 16" className={cls} width="22" height="14">
          <rect width="24" height="16" fill="#fff" />
          <rect width="6" height="16" fill="#FF0000" />
          <rect x="18" width="6" height="16" fill="#FF0000" />
          <path
            d="M12 3.2l.7 1.8 2-.5-1 1.8 1.5 1-1.5.7.6 1.7-2-.6-.3 2-.3-2-2 .6.6-1.7-1.5-.7 1.5-1-1-1.8 2 .5z"
            fill="#FF0000"
          />
        </svg>
      );
    default:
      return (
        <span
          aria-hidden
          className={cls + ' inline-block w-[22px] h-[14px] bg-white/20'}
        />
      );
  }
}

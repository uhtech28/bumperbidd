'use client';
import { useEffect, useState } from 'react';
import clsx from 'clsx';

interface Props {
  endsAt: number;
  className?: string;
  /**
   * Small = pill form inside a card. Large = standalone readout.
   */
  size?: 'sm' | 'md';
  showIcon?: boolean;
}

/**
 * Renders a live countdown to `endsAt`. Ticks once a second; pauses when
 * the tab is hidden to avoid waking the CPU on background tabs (material
 * difference on mobile battery at scale). Colour shifts to red-brand on
 * the last 60s so the UI communicates urgency without extra logic in
 * the parent card.
 */
export function CountdownTimer({
  endsAt,
  className,
  size = 'sm',
  showIcon = true,
}: Props) {
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    let id: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (id) return;
      id = setInterval(() => setNow(Date.now()), 1000);
    };
    const stop = () => {
      if (id) {
        clearInterval(id);
        id = null;
      }
    };
    start();
    const onVisibility = () => {
      if (document.hidden) stop();
      else {
        setNow(Date.now());
        start();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  const remaining = Math.max(0, endsAt - now);
  const totalSec = Math.floor(remaining / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;

  const ended = remaining <= 0;
  const urgent = !ended && remaining <= 60_000;

  const label = ended
    ? 'Ended'
    : h > 0
      ? `${h}h ${String(m).padStart(2, '0')}m`
      : m > 0
        ? `${m}:${String(s).padStart(2, '0')}`
        : `0:${String(s).padStart(2, '0')}`;

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 font-medium tabular-nums',
        size === 'sm' ? 'text-[11px]' : 'text-sm',
        ended
          ? 'text-bone/40'
          : urgent
            ? 'text-red-400'
            : 'text-bone/80',
        className,
      )}
      aria-live="polite"
      aria-label={ended ? 'Auction ended' : `Time remaining ${label}`}
    >
      {showIcon && !ended && (
        <svg
          width={size === 'sm' ? 10 : 12}
          height={size === 'sm' ? 10 : 12}
          viewBox="0 0 12 12"
          aria-hidden
          className={clsx(urgent && 'animate-pulse')}
        >
          <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.2" fill="none" />
          <path d="M6 3.2V6l2 1.2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" fill="none" />
        </svg>
      )}
      {label}
    </span>
  );
}

'use client';
import { useEffect, useRef, useState } from 'react';

/**
 * Ticks down from `seconds` → 0 once per second. Restart by calling `reset()`
 * with a new seconds value. Cleans up its own interval on unmount.
 */
export function useCountdown(initialSeconds: number) {
  const [remaining, setRemaining] = useState(initialSeconds);
  const intRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (remaining <= 0) {
      if (intRef.current) {
        clearInterval(intRef.current);
        intRef.current = null;
      }
      return;
    }
    if (!intRef.current) {
      intRef.current = setInterval(() => {
        setRemaining((r) => (r > 0 ? r - 1 : 0));
      }, 1000);
    }
    return () => {
      if (intRef.current) {
        clearInterval(intRef.current);
        intRef.current = null;
      }
    };
  }, [remaining]);

  return {
    remaining,
    isRunning: remaining > 0,
    reset: (s: number) => setRemaining(s),
  };
}

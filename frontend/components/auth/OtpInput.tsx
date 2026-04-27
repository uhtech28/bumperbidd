'use client';

/**
 * OTPInput — 6-digit one-time-code entry with countdown + resend.
 *
 * Interaction model:
 *   - Auto-focus first box on mount.
 *   - Type → auto-advance; backspace → jump back.
 *   - Arrow keys move between boxes; paste distributes digits.
 *   - `onComplete(code)` fires the instant the 6th digit lands.
 *
 * Owns the resend + expiry countdowns (parent just passes seconds).
 */

import {
  ClipboardEvent,
  KeyboardEvent,
  useEffect,
  useRef,
  useState,
} from 'react';
import clsx from 'clsx';
import { motion } from 'framer-motion';
import { useCountdown } from '@/hooks/useCountdown';

const EASE = [0.22, 1, 0.36, 1] as const;

interface Props {
  length?: number;
  value: string;
  onChange: (v: string) => void;
  onComplete?: (v: string) => void;
  hasError?: boolean;
  disabled?: boolean;
  resendInSec: number;
  expiresInSec: number;
  onResend: () => void;
  resending?: boolean;
}

function formatMMSS(s: number) {
  const m = Math.floor(s / 60).toString().padStart(2, '0');
  const sec = (s % 60).toString().padStart(2, '0');
  return `${m}:${sec}`;
}

export function OtpInput({
  length = 6,
  value,
  onChange,
  onComplete,
  hasError,
  disabled,
  resendInSec,
  expiresInSec,
  onResend,
  resending,
}: Props) {
  const [active, setActive] = useState(0);
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const digits = value.padEnd(length, ' ').slice(0, length).split('');

  const resend = useCountdown(resendInSec);
  const expiry = useCountdown(expiresInSec);

  useEffect(() => {
    refs.current[0]?.focus();
  }, []);

  useEffect(() => {
    resend.reset(resendInSec);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resendInSec]);

  useEffect(() => {
    expiry.reset(expiresInSec);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expiresInSec]);

  function setDigit(i: number, raw: string) {
    const d = raw.replace(/\D/g, '').slice(-1);
    const arr = digits.slice();
    arr[i] = d || ' ';
    const next = arr.join('').replace(/ /g, '');
    onChange(next);
    if (d && i < length - 1) {
      refs.current[i + 1]?.focus();
      setActive(i + 1);
    }
    if (next.length === length) onComplete?.(next);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>, i: number) {
    if (e.key === 'Backspace') {
      if (!digits[i].trim() && i > 0) {
        e.preventDefault();
        const arr = digits.slice();
        arr[i - 1] = ' ';
        onChange(arr.join('').replace(/ /g, ''));
        refs.current[i - 1]?.focus();
        setActive(i - 1);
      }
    } else if (e.key === 'ArrowLeft' && i > 0) {
      e.preventDefault();
      refs.current[i - 1]?.focus();
      setActive(i - 1);
    } else if (e.key === 'ArrowRight' && i < length - 1) {
      e.preventDefault();
      refs.current[i + 1]?.focus();
      setActive(i + 1);
    }
  }

  function handlePaste(e: ClipboardEvent<HTMLInputElement>) {
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
    if (!text) return;
    e.preventDefault();
    onChange(text);
    const focusIndex = Math.min(text.length, length - 1);
    refs.current[focusIndex]?.focus();
    setActive(focusIndex);
    if (text.length === length) onComplete?.(text);
  }

  const canResend = !resend.isRunning && !resending;

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        {Array.from({ length }).map((_, i) => {
          const char = digits[i]?.trim();
          const filled = Boolean(char);
          const isActive = active === i;
          return (
            <div key={i} className="relative w-full">
              <input
                ref={(el) => {
                  refs.current[i] = el;
                }}
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]*"
                maxLength={1}
                disabled={disabled}
                value={char ?? ''}
                onChange={(e) => setDigit(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, i)}
                onPaste={handlePaste}
                onFocus={() => setActive(i)}
                className={clsx(
                  'h-14 w-full rounded-xl border bg-black/40 text-center text-xl font-medium text-bone',
                  'focus:outline-none transition-colors',
                  hasError
                    ? 'border-red-500/60 focus:border-red-400'
                    : isActive
                      ? 'border-brand-400 focus:border-brand-300'
                      : filled
                        ? 'border-white/20'
                        : 'border-white/10 focus:border-brand-400',
                )}
              />
              <motion.span
                aria-hidden
                className={clsx(
                  'pointer-events-none absolute inset-x-2 bottom-1 h-[2px] rounded-full',
                  hasError ? 'bg-red-400' : 'bg-brand-500',
                )}
                initial={false}
                animate={{ opacity: isActive ? 1 : 0.3, scaleX: isActive ? 1 : 0.7 }}
                transition={{ duration: 0.2, ease: EASE }}
              />
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex items-center justify-between text-[12px] text-bone/55">
        <span>
          {expiry.isRunning
            ? `Expires in ${formatMMSS(expiry.remaining)}`
            : 'Code expired'}
        </span>
        <button
          type="button"
          onClick={onResend}
          disabled={!canResend}
          className={clsx(
            'font-medium transition-colors',
            canResend
              ? 'text-brand-400 hover:text-brand-300'
              : 'text-bone/30 cursor-not-allowed',
          )}
        >
          {resending
            ? 'Resending…'
            : canResend
              ? 'Resend code'
              : `Resend in ${resend.remaining}s`}
        </button>
      </div>
    </div>
  );
}

export const OTPInput = OtpInput;

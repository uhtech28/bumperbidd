'use client';

/**
 * PhoneInput — self-contained mobile-number field with an integrated
 * country selector.
 *
 * Design goals (Zerodha / CRED bar):
 *   - Dark "glass" surface: 6% white on black, 1px inner highlight, 10% border.
 *   - The whole field is one continuous shell (country pill + digits).
 *   - Animated focus glow — gold ring travels in from 50% opacity on focus.
 *   - Motion: the field eases in from below (8px) on mount.
 *   - The dropdown is a portal-free popover using a small frosted surface;
 *     it is keyboard-accessible and closes on outside click or Escape.
 *
 * The parent owns the state; we surface {country, phone, valid} so the
 * page can gate the submit button and know when to send the OTP.
 */

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  KeyboardEvent,
} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { COUNTRIES, CountryOption, formatAsYouType, isValidPhone } from '@/lib/phone';
import { FlagIcon } from './FlagIcon';

interface Props {
  country: CountryOption;
  onCountryChange: (c: CountryOption) => void;
  value: string;
  onValueChange: (raw: string) => void;
  autoFocus?: boolean;
  disabled?: boolean;
  errored?: boolean;
}

const EASE = [0.22, 1, 0.36, 1] as const;

export function PhoneInput({
  country,
  onCountryChange,
  value,
  onValueChange,
  autoFocus,
  disabled,
  errored,
}: Props) {
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const formatted = useMemo(
    () => (value ? formatAsYouType(value, country.code) : ''),
    [value, country.code],
  );

  const valid = value.length > 0 && isValidPhone(value, country.code);

  // Close popover on outside click or Escape
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: globalThis.KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  function handleButtonKeydown(e: KeyboardEvent<HTMLButtonElement>) {
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setOpen(true);
    }
  }

  return (
    <motion.div
      ref={rootRef}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: EASE }}
      className="relative w-full"
    >
      <label className="mb-2 block text-[0.72rem] font-medium uppercase tracking-[0.25em] text-bone/55">
        Mobile number
      </label>

      {/* Glass shell — the border & glow live here so focus moves the whole field together */}
      <div
        className={[
          'relative flex w-full items-stretch rounded-2xl transition-all duration-300',
          'bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))]',
          'ring-1',
          errored
            ? 'ring-red-500/60'
            : focused
              ? 'ring-brand-500/70 shadow-[0_0_0_4px_rgba(212,160,23,0.10),0_10px_30px_-10px_rgba(212,160,23,0.35)]'
              : 'ring-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]',
          disabled ? 'opacity-60 pointer-events-none' : '',
        ].join(' ')}
      >
        {/* Country pill */}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          onKeyDown={handleButtonKeydown}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label={`Country code, currently ${country.name} ${country.dial}`}
          className={[
            'group relative flex items-center gap-2 pl-4 pr-3 rounded-l-2xl',
            'text-[0.95rem] text-bone/90 tabular-nums',
            'before:absolute before:right-0 before:top-3 before:bottom-3 before:w-px before:bg-white/10',
            'hover:bg-white/[0.04] transition-colors',
          ].join(' ')}
        >
          <FlagIcon code={country.code} />
          <span className="font-medium">{country.dial}</span>
          <svg
            width="10"
            height="10"
            viewBox="0 0 12 12"
            className={`transition-transform duration-200 text-bone/60 ${open ? 'rotate-180' : ''}`}
            aria-hidden
          >
            <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" />
          </svg>
        </button>

        {/* Digits */}
        <input
          ref={inputRef}
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          value={formatted}
          onChange={(e) => onValueChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="98765 43210"
          aria-label="Mobile number"
          aria-invalid={!!errored}
          className={[
            'flex-1 min-w-0 bg-transparent px-4 py-[14px] pr-12',
            'text-[1.05rem] tabular-nums tracking-[0.02em] text-bone placeholder:text-bone/30',
            'outline-none rounded-r-2xl',
          ].join(' ')}
        />

        {/* Valid checkmark — crossfades in as soon as the number parses */}
        <AnimatePresence>
          {valid && (
            <motion.span
              key="ok"
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.6 }}
              transition={{ duration: 0.2, ease: EASE }}
              className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-brand-400"
              aria-hidden
            >
              <svg width="18" height="18" viewBox="0 0 20 20">
                <circle cx="10" cy="10" r="9" fill="currentColor" opacity="0.14" />
                <path
                  d="M5.5 10.5l3 3 6-6.5"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
              </svg>
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {/* Country list popover */}
      <AnimatePresence>
        {open && (
          <motion.ul
            role="listbox"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18, ease: EASE }}
            className="absolute left-0 right-0 top-[calc(100%+10px)] z-20 max-h-72 overflow-auto rounded-xl border border-white/10 bg-graphite/95 p-1 shadow-card backdrop-blur-xl"
          >
            {COUNTRIES.map((c) => {
              const active = c.code === country.code;
              return (
                <li
                  key={c.code}
                  role="option"
                  aria-selected={active}
                  tabIndex={0}
                  onClick={() => {
                    onCountryChange(c);
                    setOpen(false);
                    inputRef.current?.focus();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onCountryChange(c);
                      setOpen(false);
                      inputRef.current?.focus();
                    }
                  }}
                  className={[
                    'flex cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-sm outline-none transition-colors',
                    active
                      ? 'bg-brand-500/10 text-brand-300'
                      : 'text-bone/85 hover:bg-white/[0.04] focus:bg-white/[0.04]',
                  ].join(' ')}
                >
                  <span className="flex items-center gap-2.5">
                    <FlagIcon code={c.code} />
                    <span>{c.name}</span>
                  </span>
                  <span className="text-bone/55 tabular-nums">{c.dial}</span>
                </li>
              );
            })}
          </motion.ul>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

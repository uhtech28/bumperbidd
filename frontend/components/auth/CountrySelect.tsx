'use client';
import { useState, useRef, useEffect } from 'react';
import { COUNTRIES, CountryOption } from '@/lib/phone';
import clsx from 'clsx';

interface Props {
  value: CountryOption;
  onChange: (c: CountryOption) => void;
}

export function CountrySelect({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-12 items-center gap-2 rounded-l-xl border border-white/10 bg-white/5 px-3 text-sm text-bone transition hover:bg-white/10"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="text-base leading-none">{value.flag}</span>
        <span className="tabular-nums">{value.dial}</span>
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
          <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" />
        </svg>
      </button>
      {open && (
        <ul
          role="listbox"
          className="absolute left-0 top-14 z-20 max-h-64 w-60 overflow-auto rounded-xl border border-white/10 bg-graphite shadow-card backdrop-blur"
        >
          {COUNTRIES.map((c) => (
            <li
              key={c.code}
              role="option"
              aria-selected={c.code === value.code}
              onClick={() => {
                onChange(c);
                setOpen(false);
              }}
              className={clsx(
                'flex cursor-pointer items-center justify-between gap-3 px-3 py-2 text-sm hover:bg-white/5',
                c.code === value.code && 'bg-white/5 text-brand-400',
              )}
            >
              <span className="flex items-center gap-2">
                <span className="text-base leading-none">{c.flag}</span>
                <span>{c.name}</span>
              </span>
              <span className="text-bone/60 tabular-nums">{c.dial}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

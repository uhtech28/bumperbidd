'use client';
import { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Brandmark } from '@/components/brand/Brandmark';

/**
 * Consistent chrome for the phone + OTP screens.
 * Left: brand lockup on a black field with a subtle gold spotlight.
 * Right: card containing the step-specific form.
 */
export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <main className="relative min-h-screen bg-ink text-bone">
      {/* Soft radial gold spotlight */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_-10%,rgba(212,160,23,0.18),transparent_60%)]"
      />

      <div className="relative mx-auto grid min-h-screen max-w-6xl grid-cols-1 items-center gap-10 px-6 py-10 lg:grid-cols-2">
        <section className="hidden lg:flex lg:justify-center">
          <Brandmark size="lg" taglineExits={false} />
        </section>

        <section className="flex justify-center">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            className="w-full max-w-md rounded-2xl border border-white/8 bg-graphite/80 p-7 shadow-card backdrop-blur"
          >
            {/* Mobile-only brand, small size */}
            <div className="mb-6 flex flex-col items-center lg:hidden">
              <Brandmark size="sm" taglineExits={false} />
            </div>

            <header className="mb-6">
              <h2 className="font-display text-xl sm:text-2xl font-light tracking-wide">
                {title}
              </h2>
              {subtitle && (
                <p className="mt-1 text-sm text-bone/70">{subtitle}</p>
              )}
            </header>

            {children}

            <footer className="mt-7 text-center text-[11px] text-bone/50">
              By continuing, you agree to BumperBid&apos;s{' '}
              <a className="text-brand-400 hover:underline" href="#">
                Terms
              </a>{' '}
              &amp;{' '}
              <a className="text-brand-400 hover:underline" href="#">
                Privacy Policy
              </a>
              .
            </footer>
          </motion.div>
        </section>
      </div>
    </main>
  );
}

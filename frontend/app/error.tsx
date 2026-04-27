'use client';

/**
 * Global error boundary for the user app. Next.js calls this whenever a
 * route component throws during render. We log to the console for dev
 * and offer a retry button that calls `reset()`.
 *
 * Uncaught network errors in fetches are surfaced as ApiError messages
 * inside the affected component instead of bubbling here, but anything
 * else (programmer errors, render-time exceptions) lands here.
 */
import { useEffect } from 'react';
import Link from 'next/link';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface to console in dev; in prod this would be wired to Sentry etc.
    // eslint-disable-next-line no-console
    console.error('[app error]', error);
  }, [error]);

  return (
    <main className="grid min-h-screen place-items-center bg-ink px-5 text-bone">
      <div className="max-w-md text-center">
        <p className="text-[12px] uppercase tracking-[0.22em] text-bone/50">
          Something went wrong
        </p>
        <h1 className="mt-2 text-[24px] font-semibold tracking-tight">
          The page hit a snag
        </h1>
        <p className="mt-3 text-[14px] text-bone/65">
          {error.message || 'Unexpected error.'}
        </p>
        {error.digest && (
          <p className="mt-1 font-mono text-[11px] text-bone/40">
            {error.digest}
          </p>
        )}
        <div className="mt-6 flex justify-center gap-3">
          <button
            onClick={reset}
            className="rounded-lg bg-brand-500 px-4 py-2 text-[13px] font-medium text-ink hover:bg-brand-400"
          >
            Try again
          </button>
          <Link
            href="/dashboard"
            className="rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-[13px] font-medium text-bone hover:bg-white/10"
          >
            Back to dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}

'use client';

/**
 * Admin app error boundary. Same shape as the user app boundary but
 * styled for the light-mode admin shell. The "Sign in" link covers the
 * common case where the cookie expired mid-session.
 */
import { useEffect } from 'react';
import Link from 'next/link';

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error('[admin error]', error);
  }, [error]);

  return (
    <div className="grid min-h-screen place-items-center bg-slate-50 px-5">
      <div className="max-w-md text-center">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Something went wrong
        </p>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">
          Couldn&rsquo;t render that page
        </h1>
        <p className="mt-3 text-sm text-slate-600">
          {error.message || 'Unexpected error.'}
        </p>
        {error.digest && (
          <p className="mt-1 font-mono text-[11px] text-slate-400">
            {error.digest}
          </p>
        )}
        <div className="mt-6 flex justify-center gap-3">
          <button
            onClick={reset}
            className="rounded-lg bg-ink px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            Try again
          </button>
          <Link
            href="/login"
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}

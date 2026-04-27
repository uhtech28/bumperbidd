/**
 * /search route entry — Server Component.
 *
 * The `dynamic = 'force-dynamic'` route segment config skips static
 * prerender for this page. The actual UI is a Client Component
 * (SearchClient) which uses `useSearchParams()`. Wrapping it in a
 * <Suspense> boundary satisfies Next.js 14's CSR-bailout requirement.
 *
 * NOTE: This file MUST stay a Server Component (no 'use client'),
 * otherwise the `dynamic` export is silently ignored and the build
 * fails on prerender.
 */
import { Suspense } from 'react';
import SearchClient from './SearchClient';

export const dynamic = 'force-dynamic';

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-7xl px-4 py-8 text-sm text-neutral-500">
          Loading search…
        </div>
      }
    >
      <SearchClient />
    </Suspense>
  );
}

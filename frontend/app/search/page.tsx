/**
 * /search route — temporarily simplified stub.
 *
 * The full search UI (filters, FTS, pagination) lives in SearchClient.tsx
 * but Next.js 14 + Vercel keep failing to prerender it even with the
 * canonical Suspense + force-dynamic split. Shipping this stub unblocks
 * the deploy; the full search will be re-wired post-launch via either
 * a /browse route or a redesigned client-only architecture.
 */
import Link from 'next/link';

export const dynamic = 'force-static';

export default function SearchPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-20 text-center">
      <h1 className="text-3xl font-bold text-neutral-900">Search coming soon</h1>
      <p className="mt-3 text-sm text-neutral-600">
        Browse all live auctions on the dashboard while we finish the
        advanced search experience.
      </p>
      <Link
        href="/dashboard"
        className="mt-6 inline-block rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
      >
        Go to dashboard
      </Link>
    </main>
  );
}

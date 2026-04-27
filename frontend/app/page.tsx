'use client';

/**
 * Root splash — no content of its own. The tagline animation now lives
 * on the unified /auth step machine so the user lands on a single
 * no-scroll experience. This page simply forwards. It renders a black
 * field for the one frame before the replace fires so there is no flash.
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function RootRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/auth');
  }, [router]);

  return <main className="fixed inset-0 overflow-hidden bg-ink" />;
}

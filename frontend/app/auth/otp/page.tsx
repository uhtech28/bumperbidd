'use client';

/**
 * Legacy redirect. The previous multi-page auth flow had a dedicated
 * /auth/otp step; it has been merged into the unified /auth step
 * machine. This file stays only to preserve any cached bookmarks —
 * it immediately forwards to /auth.
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function LegacyOtpRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/auth');
  }, [router]);
  return <main className="fixed inset-0 overflow-hidden bg-ink" />;
}

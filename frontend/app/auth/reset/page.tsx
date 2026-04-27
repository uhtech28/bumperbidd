'use client';

/**
 * /auth/reset?token=<hex64> - consume a one-time password-reset token.
 *
 * The token comes from the email link. We require it to match the
 * 64-char hex shape backend expects; anything else short-circuits with
 * a friendly error before we hit the server.
 *
 * On success we show a confirmation and route to /auth so the user
 * signs in with the new password (the backend revokes existing
 * sessions, so there's nothing to "log them in" with here).
 */
import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { authApi, ApiError } from '@/lib/api';
import { AuthShell } from '@/components/auth/AuthShell';

const HEX64 = /^[a-f0-9]{64}$/i;

function ResetPasswordInner() {
  const router = useRouter();
  const params = useSearchParams();
  const token = (params.get('token') ?? '').trim();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const tokenLooksValid = HEX64.test(token);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password.length > 128) {
      setError('Password must be 128 characters or fewer.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setSubmitting(true);
    try {
      await authApi.resetPassword(token, password);
      setDone(true);
      // Bounce to sign-in after a brief beat so the success state reads.
      setTimeout(() => router.replace('/auth'), 1800);
    } catch (err) {
      const e = err as ApiError;
      if (e.code === 'INVALID_OR_EXPIRED' || e.code === 'INVALID_TOKEN') {
        setError(
          'This reset link is invalid or has expired. Request a new one from the forgot-password page.',
        );
      } else if (e.code === 'WEAK_PASSWORD') {
        setError('Password must be 8 to 128 characters.');
      } else {
        setError(e.message ?? 'Could not reset password.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (!tokenLooksValid) {
    return (
      <AuthShell title="Reset link broken" subtitle="The link in the email looks malformed.">
        <div className="space-y-4">
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
            Make sure you opened the most recent email and copied the full URL,
            or request a new link below.
          </div>
          <Link
            href="/auth/forgot"
            className="block w-full rounded-lg bg-brand-500 px-4 py-2.5 text-center text-[14px] font-semibold text-ink hover:bg-brand-400"
          >
            Request a new link
          </Link>
        </div>
      </AuthShell>
    );
  }

  if (done) {
    return (
      <AuthShell title="Password updated" subtitle="You can now sign in with your new password.">
        <div className="space-y-4">
          <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/10 p-3 text-sm text-emerald-200">
            All other devices have been signed out for your security.
          </div>
          <Link
            href="/auth"
            className="block w-full rounded-lg bg-brand-500 px-4 py-2.5 text-center text-[14px] font-semibold text-ink hover:bg-brand-400"
          >
            Sign in
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Set a new password"
      subtitle="Choose something strong. 8 to 128 characters."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block">
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-bone/55">
            New password
          </span>
          <div className="relative">
            <input
              type={show ? 'text' : 'password'}
              autoFocus
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              maxLength={128}
              className="w-full rounded-lg border border-white/15 bg-white/[0.04] px-3 py-2 pr-16 text-[14px] text-bone placeholder-bone/35 focus:border-brand-500/60 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
            />
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              className="absolute inset-y-0 right-2 my-auto rounded px-2 text-[11px] font-semibold uppercase tracking-wide text-bone/55 hover:text-bone"
            >
              {show ? 'Hide' : 'Show'}
            </button>
          </div>
        </label>

        <label className="block">
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-bone/55">
            Confirm password
          </span>
          <input
            type={show ? 'text' : 'password'}
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            minLength={8}
            maxLength={128}
            className="w-full rounded-lg border border-white/15 bg-white/[0.04] px-3 py-2 text-[14px] text-bone placeholder-bone/35 focus:border-brand-500/60 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
          />
        </label>

        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-brand-500 px-4 py-2.5 text-[14px] font-semibold text-ink hover:bg-brand-400 disabled:opacity-60"
        >
          {submitting ? 'Saving\u2026' : 'Update password'}
        </button>

        <div className="text-center text-[12px] text-bone/55">
          <Link href="/auth" className="text-brand-400 hover:underline">
            Back to sign in
          </Link>
        </div>
      </form>
    </AuthShell>
  );
}

export default function ResetPasswordPage() {
  // Wrapping in Suspense is required because useSearchParams() reads
  // from the URL on the client and Next would otherwise complain at
  // build time.
  return (
    <Suspense
      fallback={
        <AuthShell title="Loading\u2026" subtitle="Verifying reset link.">
          <div className="h-12" />
        </AuthShell>
      }
    >
      <ResetPasswordInner />
    </Suspense>
  );
}

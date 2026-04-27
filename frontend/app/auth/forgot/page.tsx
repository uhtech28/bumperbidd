'use client';

/**
 * /auth/forgot - request a password reset email.
 *
 * Always shows the same success message after submit, whether the email
 * exists or not. The backend's response is intentionally generic for the
 * same reason - we never disclose account existence here.
 */
import { useState } from 'react';
import Link from 'next/link';
import { authApi, ApiError } from '@/lib/api';
import { AuthShell } from '@/components/auth/AuthShell';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [serverMessage, setServerMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !email.includes('@')) {
      setError('Enter a valid email address.');
      return;
    }
    setSubmitting(true);
    try {
      const r = await authApi.forgotPassword(email.trim().toLowerCase());
      setServerMessage(r.message);
      setSubmitted(true);
    } catch (err) {
      const e = err as ApiError;
      // Forgot-password is throttled at 5/min/IP; surface that politely.
      if (e.status === 429) {
        setError('Too many attempts. Try again in a minute.');
      } else {
        setError(e.message ?? 'Could not send reset link.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      title="Reset your password"
      subtitle="Enter the email tied to your account and we'll send a one-time reset link."
    >
      {submitted ? (
        <div className="space-y-4">
          <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/10 p-3 text-sm text-emerald-200">
            {serverMessage ??
              "If that email is registered, we've sent a reset link."}
          </div>
          <p className="text-[12px] leading-relaxed text-bone/60">
            The link expires in 60 minutes and can be used once. Check your
            spam folder if you don&rsquo;t see it within a few minutes.
          </p>
          <div className="flex justify-between text-[12px]">
            <button
              onClick={() => {
                setSubmitted(false);
                setServerMessage(null);
                setError(null);
              }}
              className="text-brand-400 hover:underline"
            >
              Resend to a different address
            </button>
            <Link href="/auth" className="text-bone/60 hover:text-bone">
              Back to sign in
            </Link>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-bone/55">
              Email
            </span>
            <input
              type="email"
              autoFocus
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
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
            {submitting ? 'Sending\u2026' : 'Send reset link'}
          </button>

          <div className="text-center text-[12px] text-bone/55">
            Remembered it?{' '}
            <Link href="/auth" className="text-brand-400 hover:underline">
              Back to sign in
            </Link>
          </div>
        </form>
      )}
    </AuthShell>
  );
}

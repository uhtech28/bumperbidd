'use client';

/**
 * /auth — Step-based progressive-disclosure sign-in.
 *
 * Four steps rendered in a single shared shell, with Framer Motion
 * AnimatePresence mode="wait" providing slide+fade transitions:
 *
 *   entry  → brand lockup, "Sign in", two options (Mobile / Email)
 *   mobile → phone input + "Send OTP"
 *   otp    → 6-digit boxes + "Verify & continue"
 *   email  → email + password + "Log in" / "Create account" (toggle)
 *
 * Layout is the same 3-zone, 100dvh, no-scroll chrome used elsewhere.
 * Brand lockup is shared across steps so it does not re-mount during
 * transitions.
 */

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { LogoMark } from '@/components/brand/LogoMark';
import { PhoneInput } from '@/components/auth/PhoneInput';
import { OtpInput } from '@/components/auth/OtpInput';
import { Tagline } from '@/components/motion/Tagline';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { COUNTRIES, CountryOption, isValidPhone, maskPhone } from '@/lib/phone';
import { authApi, ApiError } from '@/lib/api';
import { session } from '@/lib/session';

type Step = 'entry' | 'mobile' | 'otp' | 'email';

const EASE = [0.22, 1, 0.36, 1] as const;

export default function AuthPage() {
  const router = useRouter();
  const reduceMotion = useReducedMotion();

  // step machine
  const [step, setStep] = useState<Step>('entry');

  // mobile state
  const [country, setCountry] = useState<CountryOption>(COUNTRIES[0]);
  const [raw, setRaw] = useState('');
  const [fullPhone, setFullPhone] = useState('');
  const [resendInSec, setResendInSec] = useState(30);
  const [expiresInSec, setExpiresInSec] = useState(300);

  // otp state
  const [code, setCode] = useState('');

  // email state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [emailMode, setEmailMode] = useState<'login' | 'signup'>('login');

  // shared
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // brand tagline reveal — the Tagline component fires onDone after exit.
  const [taglineDone, setTaglineDone] = useState(false);

  const phoneValid = useMemo(
    () => raw.length > 0 && isValidPhone(raw, country.code),
    [raw, country.code],
  );
  // Login requires any non-empty password (server rejects invalid creds).
  // Signup enforces the full policy: 8+ chars, at least one letter and one digit.
  const emailValid = useMemo(() => {
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!emailOk) return false;
    if (emailMode === 'signup') {
      return (
        password.length >= 8 &&
        /[A-Za-z]/.test(password) &&
        /\d/.test(password) &&
        password.length <= 128
      );
    }
    return password.length >= 1;
  }, [email, password, emailMode]);

  function go(next: Step) {
    setError(null);
    setStep(next);
  }

  async function sendOtp() {
    if (!phoneValid || loading) return;
    setLoading(true);
    setError(null);
    try {
      const digitsOnly = raw.replace(/\D/g, '');
      const composed = `${country.dial}${digitsOnly}`;
      const res = await authApi.sendOtp(composed, country.code);
      setFullPhone(res.phone);
      setResendInSec(res.resendAvailableInSec);
      setExpiresInSec(res.expiresInSec);
      setCode('');
      go('otp');
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.code === 'OTP_COOLDOWN'
            ? `Please wait ${err.details?.retryAfterSec ?? 30}s before retrying.`
            : err.message
          : 'Network error. Please try again.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  async function verifyOtp(c: string) {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await authApi.verifyOtp(fullPhone, c, country.code);
      session.set({
        userId: res.user.id,
        phone: res.user.phone,
        email: res.user.email,
        provider: res.user.provider,
      });
      router.replace('/dashboard');
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.code === 'OTP_INVALID'
            ? `Invalid OTP. ${
                err.details?.attemptsRemaining !== undefined
                  ? `${err.details.attemptsRemaining} attempt(s) left.`
                  : ''
              }`.trim()
            : err.code === 'OTP_ATTEMPTS_EXCEEDED'
              ? 'Too many attempts. Please request a new code.'
              : err.code === 'OTP_NOT_FOUND'
                ? 'Your code expired. Please request a new one.'
                : err.message
          : 'Network error. Please try again.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  async function resendOtp() {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await authApi.sendOtp(fullPhone, country.code);
      setResendInSec(res.resendAvailableInSec);
      setExpiresInSec(res.expiresInSec);
      setCode('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not resend.');
    } finally {
      setLoading(false);
    }
  }

  async function submitEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!emailValid || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res =
        emailMode === 'signup'
          ? await authApi.emailSignup(email.trim().toLowerCase(), password)
          : await authApi.emailLogin(email.trim().toLowerCase(), password);
      session.set({
        userId: res.user.id,
        phone: res.user.phone,
        email: res.user.email,
        provider: res.user.provider,
      });
      router.replace('/dashboard');
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.code === 'EMAIL_ALREADY_EXISTS'
            ? 'An account with this email already exists. Please log in.'
            : err.code === 'INVALID_CREDENTIALS'
              ? 'Email or password is incorrect.'
              : err.message
          : 'Network error. Please try again.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  function toggleEmailMode() {
    setError(null);
    setEmailMode((m) => (m === 'login' ? 'signup' : 'login'));
  }

  // step-level transition
  const stepMotion = reduceMotion
    ? { initial: false, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0.2 } }
    : {
        initial: { opacity: 0, x: 24 },
        animate: { opacity: 1, x: 0 },
        exit: { opacity: 0, x: -24 },
        transition: { duration: 0.35, ease: EASE },
      };

  return (
    <main className="fixed inset-0 overflow-hidden bg-ink text-bone">
      {/* ambient field · static gold spotlight */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(70% 45% at 50% -10%, rgba(212,160,23,0.22), transparent 65%), radial-gradient(95% 65% at 50% 115%, rgba(212,160,23,0.10), transparent 75%)',
        }}
      />
      {/* ambient field · slow drifting light (10–16s loop) */}
      <AmbientLight reduced={Boolean(reduceMotion)} />

      <div
        className="relative mx-auto flex h-[100dvh] w-full max-w-[440px] flex-col px-6"
        style={{
          paddingTop: 'max(env(safe-area-inset-top), 1.25rem)',
          paddingBottom: 'max(env(safe-area-inset-bottom), 1.25rem)',
        }}
      >
        {/* ZONE 1 · BRAND — centered in its flex region; shifts up slightly after tagline exits.
            Being a flex sibling of the login section guarantees the two never overlap.
            `min-h-0` lets the flex child shrink so the logo never pushes past the safe padding. */}
        <motion.section
          className="flex min-h-0 flex-1 flex-col items-center justify-center space-y-3"
          animate={{ y: reduceMotion ? 0 : taglineDone ? -6 : 0 }}
          transition={{ duration: 0.6, ease: [0.65, 0, 0.35, 1] }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.55, ease: EASE }}
            className="relative"
          >
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 -z-10 blur-2xl"
              style={{
                background:
                  'radial-gradient(50% 50% at 50% 50%, rgba(212,160,23,0.38), transparent 72%)',
                transform: 'scale(1.7)',
              }}
            />
            <LogoMark size={128} animate={false} />
          </motion.div>

          <motion.img
            src="/brand/bb-wordmark.png"
            alt="BUMPERBID Auctions"
            draggable={false}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.1, ease: EASE }}
            className="h-auto w-[min(78%,300px)] object-contain"
          />

          {/* reserved tagline slot — premium onboarding transition */}
          <div className="relative h-[18px] w-full">
            {step === 'entry' && !taglineDone && (
              <Tagline
                holdMs={1000}
                onDone={() => setTaglineDone(true)}
                className="absolute inset-x-0 text-center text-[11px] italic tracking-wide text-bone/60"
              >
                A unit of Zidan Auto Pvt Ltd.
              </Tagline>
            )}
          </div>
        </motion.section>

        {/* LOGIN UI — natural-flow sibling pinned just above the safe area.
            Reveals as one unit after the tagline finishes its exit. */}
        <motion.section
          className="w-full pt-2"
          initial={reduceMotion ? false : { opacity: 0, y: 40 }}
          animate={
            taglineDone
              ? { opacity: 1, y: 0 }
              : { opacity: 0, y: 40 }
          }
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1], delay: 0.12 }}
        >
          <AnimatePresence mode="wait">
            {step === 'entry' && taglineDone && (
              <motion.div
                key="entry"
                initial={false}
                animate={{ opacity: 1, y: 0, x: 0 }}
                exit={
                  reduceMotion
                    ? { opacity: 0 }
                    : { opacity: 0, x: -24, transition: { duration: 0.35, ease: EASE } }
                }
                transition={{ duration: 0.35, ease: EASE }}
                className="space-y-5"
              >
                <header className="text-center">
                  <h2 className="font-display text-[1.5rem] font-light tracking-[0.02em] text-bone">
                    Sign in
                  </h2>
                </header>

                <div className="space-y-3">
                  <PrimaryButton
                    type="button"
                    fullWidth
                    onClick={() => go('mobile')}
                    className="h-14 text-[15px]"
                  >
                    Continue with Mobile
                  </PrimaryButton>

                  <Divider>or</Divider>

                  <SecondaryButton
                    type="button"
                    onClick={() => go('email')}
                  >
                    Continue with Email
                  </SecondaryButton>
                </div>

                <TermsLine />
              </motion.div>
            )}

            {step === 'mobile' && (
              <motion.div key="mobile" {...stepMotion} className="space-y-5">
                <StepHeader
                  title="Enter your mobile"
                  subtitle="We'll send a one-time code to verify."
                  onBack={() => go('entry')}
                />
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    sendOtp();
                  }}
                  className="space-y-4"
                >
                  <PhoneInput
                    country={country}
                    onCountryChange={setCountry}
                    value={raw}
                    onValueChange={setRaw}
                    disabled={loading}
                    errored={Boolean(error)}
                  />
                  <ErrorBanner message={error} />
                  <PrimaryButton
                    type="submit"
                    fullWidth
                    loading={loading}
                    disabled={!phoneValid || loading}
                    className="h-14 text-[15px]"
                  >
                    {loading ? 'Sending code…' : 'Send OTP'}
                  </PrimaryButton>
                </form>

                <TermsLine />
              </motion.div>
            )}

            {step === 'otp' && (
              <motion.div key="otp" {...stepMotion} className="space-y-5">
                <StepHeader
                  title="Verify your number"
                  subtitle={
                    <>
                      Code sent to{' '}
                      <span className="text-bone/90">{maskPhone(fullPhone)}</span>
                    </>
                  }
                  onBack={() => go('mobile')}
                />
                <div className="space-y-4">
                  <OtpInput
                    value={code}
                    onChange={setCode}
                    onComplete={verifyOtp}
                    hasError={Boolean(error)}
                    disabled={loading}
                    resendInSec={resendInSec}
                    expiresInSec={expiresInSec}
                    onResend={resendOtp}
                    resending={loading}
                  />
                  <ErrorBanner message={error} />
                  <PrimaryButton
                    type="button"
                    fullWidth
                    loading={loading}
                    disabled={code.length < 6 || loading}
                    onClick={() => verifyOtp(code)}
                    className="h-14 text-[15px]"
                  >
                    {loading ? 'Verifying…' : 'Verify & continue'}
                  </PrimaryButton>
                </div>

                <TermsLine />
              </motion.div>
            )}

            {step === 'email' && (
              <motion.div key="email" {...stepMotion} className="space-y-5">
                <StepHeader
                  title={emailMode === 'login' ? 'Sign in with email' : 'Create your account'}
                  subtitle={
                    emailMode === 'login'
                      ? 'Enter your email and password.'
                      : 'Use at least 8 characters with a letter and a number.'
                  }
                  onBack={() => go('entry')}
                />
                <form onSubmit={submitEmail} className="space-y-3">
                  <TextField
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading}
                  />
                  <div className="relative">
                    <TextField
                      type={showPwd ? 'text' : 'password'}
                      autoComplete={emailMode === 'login' ? 'current-password' : 'new-password'}
                      placeholder="Password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={loading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPwd((s) => !s)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] uppercase tracking-wider text-bone/55 hover:text-bone/85"
                    >
                      {showPwd ? 'Hide' : 'Show'}
                    </button>
                  </div>
                  {emailMode === 'login' && (
                    <div className="-mt-2 flex justify-end">
                      <Link
                        href="/auth/forgot"
                        className="text-[12px] text-bone/55 hover:text-brand-300"
                      >
                        Forgot password?
                      </Link>
                    </div>
                  )}
                  <ErrorBanner message={error} />
                  <PrimaryButton
                    type="submit"
                    fullWidth
                    loading={loading}
                    disabled={!emailValid || loading}
                    className="h-14 text-[15px]"
                  >
                    {loading
                      ? emailMode === 'login'
                        ? 'Signing in…'
                        : 'Creating account…'
                      : emailMode === 'login'
                        ? 'Log in'
                        : 'Create account'}
                  </PrimaryButton>
                  <p className="pt-1 text-center text-[12.5px] text-bone/55">
                    {emailMode === 'login' ? (
                      <>
                        New to BumperBid?{' '}
                        <button
                          type="button"
                          onClick={toggleEmailMode}
                          className="font-medium text-brand-400 hover:text-brand-300 hover:underline"
                        >
                          Create an account
                        </button>
                      </>
                    ) : (
                      <>
                        Already have an account?{' '}
                        <button
                          type="button"
                          onClick={toggleEmailMode}
                          className="font-medium text-brand-400 hover:text-brand-300 hover:underline"
                        >
                          Log in
                        </button>
                      </>
                    )}
                  </p>
                </form>

                <TermsLine />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.section>
      </div>
    </main>
  );
}

/* ---------- subcomponents ---------- */

function Divider({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex items-center py-0.5">
      <span className="h-px flex-1 bg-gradient-to-r from-transparent via-bone/15 to-transparent" />
      <span className="mx-3 text-[10.5px] uppercase tracking-[0.22em] text-bone/40">
        {children}
      </span>
      <span className="h-px flex-1 bg-gradient-to-l from-transparent via-bone/15 to-transparent" />
    </div>
  );
}

function SecondaryButton({
  onClick,
  children,
  type = 'button',
}: {
  onClick: () => void;
  children: React.ReactNode;
  type?: 'button' | 'submit';
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      className="relative h-14 w-full rounded-xl border border-bone/15 bg-white/[0.03] text-[15px] font-medium tracking-wide text-bone/90 transition-all hover:border-brand-400/50 hover:bg-white/[0.06] hover:text-bone focus:outline-none focus:ring-2 focus:ring-brand-400/50 focus:ring-offset-2 focus:ring-offset-black active:scale-[0.985]"
    >
      {children}
    </button>
  );
}

function StepHeader({
  title,
  subtitle,
  onBack,
}: {
  title: string;
  subtitle?: React.ReactNode;
  onBack?: () => void;
}) {
  return (
    <header className="space-y-2">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 text-[12px] text-bone/55 transition-colors hover:text-bone/90"
          aria-label="Back"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
          Back
        </button>
      )}
      <div className="space-y-1 text-center">
        <h2 className="font-display text-[1.3rem] font-light tracking-[0.02em] text-bone">
          {title}
        </h2>
        {subtitle && (
          <p className="text-[12.5px] leading-relaxed text-bone/55">{subtitle}</p>
        )}
      </div>
    </header>
  );
}

function TextField(
  props: React.InputHTMLAttributes<HTMLInputElement>,
) {
  return (
    <input
      {...props}
      className="h-14 w-full rounded-xl border border-bone/10 bg-white/[0.04] px-4 text-[15px] text-bone placeholder:text-bone/35 transition-colors focus:border-brand-400/60 focus:bg-white/[0.06] focus:outline-none focus:ring-2 focus:ring-brand-400/30 disabled:opacity-50"
    />
  );
}

function AmbientLight({ reduced }: { reduced: boolean }) {
  if (reduced) return null;
  // One soft layer, two radials (gold + white), slow position drift.
  // Intentionally low opacity — this should read as lighting, not motion.
  return (
    <motion.div
      aria-hidden
      className="pointer-events-none absolute inset-0"
      style={{
        background:
          'radial-gradient(42% 32% at 28% 22%, rgba(255,240,210,0.06), transparent 72%), radial-gradient(52% 38% at 72% 78%, rgba(212,160,23,0.07), transparent 78%)',
        mixBlendMode: 'screen',
        willChange: 'transform',
      }}
      animate={{
        x: [0, 10, -6, 4, 0],
        y: [0, -5, 7, -3, 0],
      }}
      transition={{
        duration: 18,
        ease: 'easeInOut',
        repeat: Infinity,
      }}
    />
  );
}

function TermsLine() {
  // Animates together with the login UI as its final beat —
  // 0.2s after the step mounts, so users sense the line settling
  // into place just after the buttons.
  return (
    <motion.p
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
      className="pt-3 text-center text-xs leading-relaxed text-bone/50"
    >
      By continuing, you agree to BumperBid&apos;s{' '}
      <Link
        className="font-medium text-brand-400 hover:text-brand-300 hover:underline"
        href="/terms"
      >
        Terms
      </Link>{' '}
      &amp;{' '}
      <Link
        className="font-medium text-brand-400 hover:text-brand-300 hover:underline"
        href="/privacy"
      >
        Privacy Policy
      </Link>
      .
    </motion.p>
  );
}

import Link from 'next/link';

interface LegalShellProps {
  title: string;
  eyebrow?: string;
  children: React.ReactNode;
}

/**
 * Shared chrome for /terms and /privacy — dark premium theme consistent
 * with /auth. Scroll-friendly (not 100dvh locked) because these pages
 * hold long-form reading content. Typography is unified: the whole page
 * uses the same body font family so headings and paragraphs read as one.
 */
export function LegalShell({ title, eyebrow, children }: LegalShellProps) {
  return (
    <main className="relative min-h-screen bg-ink text-bone">
      {/* ambient field · soft gold spotlight, calmer than the auth screen */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            'radial-gradient(65% 40% at 50% -10%, rgba(212,160,23,0.14), transparent 70%), radial-gradient(95% 60% at 50% 120%, rgba(212,160,23,0.06), transparent 75%)',
        }}
      />

      <div className="relative mx-auto max-w-[720px] px-6 pb-24 pt-8">
        <Link
          href="/auth"
          className="inline-flex items-center gap-1.5 text-[12px] text-bone/55 transition-colors hover:text-bone/90"
          aria-label="Back to sign in"
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
        </Link>

        <header className="mt-10 border-b border-bone/10 pb-8">
          {eyebrow && (
            <p className="mb-3 text-[10.5px] font-medium uppercase tracking-[0.22em] text-brand-400">
              {eyebrow}
            </p>
          )}
          <h1 className="text-[1.9rem] font-semibold leading-tight tracking-[0.01em] text-bone sm:text-[2.1rem]">
            {title}
          </h1>
        </header>

        <article className="mt-10 space-y-10 text-[14px] leading-[1.7] text-bone/75">
          {children}
        </article>

        <footer className="mt-16 border-t border-bone/10 pt-6 text-[11.5px] leading-relaxed text-bone/40">
          BumperBid &middot; A unit of Zidan Auto Pvt Ltd.
        </footer>
      </div>
    </main>
  );
}

interface LegalSectionProps {
  index?: number | string;
  title: string;
  children: React.ReactNode;
}

export function LegalSection({ index, title, children }: LegalSectionProps) {
  return (
    <section className="space-y-3">
      <h2 className="flex items-baseline gap-3 text-[1.05rem] font-semibold tracking-wide text-bone">
        {index !== undefined && (
          <span className="text-[0.85em] font-medium text-brand-400/80">{index}.</span>
        )}
        <span>{title}</span>
      </h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

export function LegalList({ children, ordered = false }: { children: React.ReactNode; ordered?: boolean }) {
  const Tag = ordered ? 'ol' : 'ul';
  return (
    <Tag
      className={`space-y-2 pl-5 ${
        ordered
          ? 'list-decimal marker:text-brand-400/80 marker:font-medium'
          : 'list-disc marker:text-brand-400/70'
      }`}
    >
      {children}
    </Tag>
  );
}

export function LegalNote({ children }: { children: React.ReactNode }) {
  return (
    <aside className="rounded-xl border border-brand-400/25 bg-brand-400/[0.05] px-5 py-4 text-[13.5px] leading-relaxed text-bone/80">
      <p className="mb-1 text-[10.5px] font-medium uppercase tracking-[0.2em] text-brand-400">
        Please note
      </p>
      {children}
    </aside>
  );
}

'use client';

/**
 * /account/security - active sessions across devices.
 *
 * Lists every non-revoked, non-expired session and lets the user
 * revoke any session that isn't the one they're currently using
 * (the current session is killed via the dedicated logout flow).
 */
import { useEffect, useState } from 'react';
import { authApi, ApiError } from '@/lib/api';
import { UserShell } from '@/components/shell/UserShell';

interface Session {
  id: string;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
  ip: string | null;
  userAgent: string | null;
  device: string | null;
  isCurrent: boolean;
}

function deviceLabel(s: Session): string {
  if (s.device) return s.device;
  if (!s.userAgent) return 'Unknown device';
  const ua = s.userAgent;
  if (/iPhone/i.test(ua)) return 'iPhone';
  if (/Android/i.test(ua)) return 'Android';
  if (/Mac OS X/i.test(ua)) return 'Mac';
  if (/Windows/i.test(ua)) return 'Windows';
  return 'Browser';
}

function relTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.round(ms / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hr ago`;
  const d = Math.round(h / 24);
  return `${d} day${d === 1 ? '' : 's'} ago`;
}

export default function SecurityPage() {
  const [items, setItems] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);

  async function refresh() {
    try {
      const r = await authApi.listSessions();
      setItems(r.items);
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function revoke(id: string) {
    setRevoking(id);
    setError(null);
    try {
      await authApi.revokeSession(id);
      setItems((prev) => prev.filter((s) => s.id !== id));
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setRevoking(null);
    }
  }

  return (
    <UserShell>
      <div className="mx-auto max-w-3xl px-6 py-8 pb-24 md:px-8">
        <header className="mb-6">
          <p className="text-[12px] uppercase tracking-[0.22em] text-bone/45">
            Account
          </p>
          <h1 className="mt-1 text-[26px] font-semibold tracking-tight text-bone">
            Security & sessions
          </h1>
          <p className="mt-1 text-[13px] text-bone/55">
            Active devices signed into your account. Sign out anywhere you
            don&rsquo;t recognise.
          </p>
        </header>

        {error && (
          <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
            {error}
          </div>
        )}

        <div className="rounded-xl border border-white/8 bg-graphite/40">
          {loading ? (
            <div className="p-8 text-center text-bone/55">Loading…</div>
          ) : items.length === 0 ? (
            <div className="p-8 text-center text-bone/55">
              No other active sessions.
            </div>
          ) : (
            <ul className="divide-y divide-white/8">
              {items.map((s) => (
                <li key={s.id} className="flex items-start gap-4 p-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-bone">
                        {deviceLabel(s)}
                      </span>
                      {s.isCurrent && (
                        <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-300 ring-1 ring-emerald-500/30">
                          This device
                        </span>
                      )}
                    </div>
                    <div className="mt-1 text-[12px] text-bone/55">
                      Signed in {relTime(s.createdAt)}
                      {s.ip && <> · {s.ip}</>}
                    </div>
                    {s.userAgent && (
                      <p className="mt-1 truncate text-[11px] text-bone/40">
                        {s.userAgent}
                      </p>
                    )}
                  </div>
                  {s.isCurrent ? (
                    <span className="text-[12px] text-bone/45">
                      Current
                    </span>
                  ) : (
                    <button
                      onClick={() => revoke(s.id)}
                      disabled={revoking === s.id}
                      className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-[12px] font-semibold text-red-200 hover:bg-red-500/20 disabled:opacity-60"
                    >
                      {revoking === s.id ? 'Signing out\u2026' : 'Sign out'}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <p className="mt-6 text-[11px] text-bone/40">
          Sessions are automatically revoked when you sign out, change your
          password, or after 30 days of inactivity.
        </p>
      </div>
    </UserShell>
  );
}

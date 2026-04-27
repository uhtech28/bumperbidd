'use client';

/**
 * AuthGate wraps every admin page (except /login) with a session check.
 *
 *   - On mount, calls /auth/me. If the cookie is gone or 401s, bounces
 *     to /login. While the call is in flight we render nothing — better
 *     than briefly flashing protected UI.
 *   - On /login itself we skip the check entirely; the login page does
 *     its own redirect on success.
 *   - Surfaces a logout button that POST /auth/logout and bounces back
 *     to /login.
 *
 * The session itself is server-side (HttpOnly cookies) — we never store
 * tokens in JS, so this component just gates rendering.
 */
import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { authApi } from '@/lib/api';

interface AdminUser {
  id: string;
  email?: string;
  phone?: string;
  role?: string;
}

export function AuthGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<AdminUser | null>(null);
  const [checked, setChecked] = useState(false);

  const isLogin = pathname === '/login';

  useEffect(() => {
    if (isLogin) {
      setChecked(true);
      return;
    }
    let cancelled = false;
    authApi
      .me()
      .then((res) => {
        if (cancelled) return;
        if (!res?.user) {
          router.replace('/login');
          return;
        }
        setUser(res.user);
        setChecked(true);
      })
      .catch(() => {
        if (cancelled) return;
        router.replace('/login');
      });
    return () => {
      cancelled = true;
    };
  }, [isLogin, router]);

  async function handleLogout() {
    try {
      await authApi.logout();
    } catch {
      // ignore network errors - we still want to bounce
    }
    router.replace('/login');
  }

  if (isLogin) {
    // Login screen owns its own full-page layout.
    return <>{children}</>;
  }
  if (!checked) {
    return (
      <div className="grid min-h-screen place-items-center text-sm text-slate-500">
        Checking session\u2026
      </div>
    );
  }

  // Authenticated: render the gridded admin shell with sidebar + content.
  return (
    <UserContext.Provider value={{ user, logout: handleLogout }}>
      <div className="grid grid-cols-[220px_1fr] min-h-screen">
        <Sidebar />
        <main className="p-8">{children}</main>
      </div>
    </UserContext.Provider>
  );
}

interface UserCtx {
  user: AdminUser | null;
  logout: () => Promise<void>;
}
const UserContext = createContext<UserCtx>({ user: null, logout: async () => {} });

export function useAdminUser(): UserCtx {
  return useContext(UserContext);
}

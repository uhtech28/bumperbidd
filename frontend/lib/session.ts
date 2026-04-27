/**
 * Client-side session cache.
 *
 * Auth tokens are NOT kept here — they live in HttpOnly cookies set by
 * the backend and are inaccessible to JS. This store only caches the
 * non-sensitive identity (userId + phone/email + provider) so the UI
 * can render "signed in as ..." without a round-trip on every nav.
 *
 * Source of truth remains the server: call `authApi.me()` on first load
 * to validate the cookie is still alive; if it returns null, clear this.
 */
const KEY = 'bumperbid.session.v1';

export interface Session {
  userId: string;
  phone?: string;
  email?: string;
  provider: 'phone' | 'email' | 'both';
}

export const session = {
  set(s: Session): void {
    if (typeof window === 'undefined') return;
    window.sessionStorage.setItem(KEY, JSON.stringify(s));
  },
  get(): Session | null {
    if (typeof window === 'undefined') return null;
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as Session;
    } catch {
      return null;
    }
  },
  clear(): void {
    if (typeof window === 'undefined') return;
    window.sessionStorage.removeItem(KEY);
  },
};

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

/**
 * Backend wraps every successful response as
 *   { success: true, data: <payload>, timestamp }
 * and every error as
 *   { success: false, error: { code, message }, timestamp }
 * Unwrap on the way out so callers always get the inner payload (or
 * throw with a useful message).
 */
export async function api<T = any>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
    ...init,
  });
  if (res.status === 204) return undefined as any;

  const body = await res.json().catch(() => null);
  if (!res.ok || (body && body.success === false)) {
    const msg =
      body?.error?.message ?? body?.message ?? `${res.status} ${res.statusText}`;
    throw new Error(msg);
  }
  if (body && typeof body === 'object' && 'success' in body && body.success && 'data' in body) {
    return body.data as T;
  }
  return body as T;
}

export const adminApi = {
  stats: () => api('/admin/stats'),
  users: (params: Record<string, any> = {}) => api(`/admin/users?${new URLSearchParams(params as any)}`),
  banUser: (id: string, reason: string) => api(`/admin/users/${id}/ban`, { method: 'POST', body: JSON.stringify({ reason }) }),
  unbanUser: (id: string) => api(`/admin/users/${id}/unban`, { method: 'POST' }),
  userWallet: (id: string) => api(`/admin/users/${id}/wallet`),
  refund: (id: string, amount: number, note: string) => api(`/admin/users/${id}/refund`, { method: 'POST', body: JSON.stringify({ amount, note }) }),
  auctions: (params: Record<string, any> = {}) => api(`/admin/auctions?${new URLSearchParams(params as any)}`),
  cancelAuction: (id: string, reason: string) => api(`/admin/auctions/${id}/cancel`, { method: 'POST', body: JSON.stringify({ reason }) }),
  suspicious: (auctionId: string) => api(`/admin/auctions/${auctionId}/suspicious`),
  bids: (params: Record<string, any> = {}) => api(`/admin/bids?${new URLSearchParams(params as any)}`),
  walletEntries: (params: Record<string, any> = {}) =>
    api(`/admin/wallet-entries?${new URLSearchParams(params as any)}`),
  pendingPayments: (params: Record<string, any> = {}) => api(`/admin/payments/pending?${new URLSearchParams(params as any)}`),
  approvePayment: (id: string) => api(`/admin/payments/${id}/approve`, { method: 'POST' }),
  rejectPayment: (id: string, note: string) => api(`/admin/payments/${id}/reject`, { method: 'POST', body: JSON.stringify({ note }) }),
  approveKyc: (id: string) => api(`/admin/kyc/${id}/approve`, { method: 'POST' }),
  rejectKyc: (id: string, note: string) => api(`/admin/kyc/${id}/reject`, { method: 'POST', body: JSON.stringify({ note }) }),
  audit: (params: Record<string, any> = {}) => api(`/admin/audit?${new URLSearchParams(params as any)}`),
};

/**
 * Auth surface for the admin app. Re-uses the same /auth/me + /auth/logout
 * the user-side frontend uses; cookies are shared with the backend on
 * the same origin (just different ports in dev).
 */
export const authApi = {
  me: () => api<{ user: { id: string; email?: string; phone?: string; role?: string } | null }>('/auth/me'),
  logout: () => api('/auth/logout', { method: 'POST' }),
};

/**
 * Public auctions API. Posting an auction goes through the regular
 * /auctions endpoint (admin acts as the seller). All money fields are
 * paisa (integer) per backend DTO.
 */
export interface CreateAuctionPayload {
  title: string;
  description: string;
  make: string;
  modelName: string;
  year: number;
  kmDriven: number;
  fuelType: 'petrol' | 'diesel' | 'ev' | 'cng' | 'hybrid';
  ownerCount?: number;
  city: string;
  imageUrls: string[];
  startingPrice: number; // paisa
  minIncrement?: number; // paisa
  reservePrice?: number; // paisa
  startsAt: string; // ISO8601
  endsAt: string; // ISO8601
}

export const auctionsApi = {
  create: (payload: CreateAuctionPayload) =>
    api('/auctions', { method: 'POST', body: JSON.stringify(payload) }),
};


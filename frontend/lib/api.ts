/**
 * Thin fetch wrapper that understands the backend's uniform envelope.
 * Throws `ApiError` with the server's `code`/`details` so UI components
 * can render precise error messages (e.g. countdown for OTP_COOLDOWN,
 * EMAIL_ALREADY_EXISTS on signup, INVALID_CREDENTIALS on login).
 *
 * Auth tokens live in HttpOnly cookies set by the backend — never in
 * JS-accessible storage. Every request sends `credentials: 'include'`
 * so the browser attaches the auth cookies automatically.
 */
const BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:4000/api/v1';

export class ApiError extends Error {
  code: string;
  status: number;
  details?: Record<string, unknown>;
  constructor(
    message: string,
    code: string,
    status: number,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

type Envelope<T> =
  | { success: true; data: T; timestamp: string }
  | { success: false; error: { code: string; message: string; details?: Record<string, unknown> }; timestamp: string };

// CSRF token cache. Backend issues one when CSRF_SECRET is set; if not,
// the GET fails silently and we just send requests without the header
// (server-side middleware is also a no-op in that mode).
let csrfToken: string | null = null;
let csrfFetchInFlight: Promise<string | null> | null = null;

async function fetchCsrfToken(): Promise<string | null> {
  if (csrfToken) return csrfToken;
  if (csrfFetchInFlight) return csrfFetchInFlight;
  csrfFetchInFlight = (async () => {
    try {
      const res = await fetch(`${BASE}/auth/csrf-token`, {
        credentials: 'include',
        cache: 'no-store',
      });
      if (!res.ok) return null;
      const body = await res.json().catch(() => null);
      const token = body?.data?.csrfToken ?? null;
      csrfToken = token;
      return token;
    } catch {
      return null;
    } finally {
      csrfFetchInFlight = null;
    }
  })();
  return csrfFetchInFlight;
}

async function request<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  // Mutating verbs need a CSRF token when the backend has CSRF enabled.
  // We fetch once and cache; on a 403 with code CSRF_INVALID we'll bust
  // and retry below.
  const method = (init.method ?? 'GET').toUpperCase();
  const isMutating = method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS';
  let csrfHeaders: Record<string, string> = {};
  if (isMutating) {
    const token = await fetchCsrfToken();
    if (token) csrfHeaders['X-CSRF-Token'] = token;
  }

  const doFetch = async () =>
    fetch(`${BASE}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...csrfHeaders,
        ...(init.headers ?? {}),
      },
      credentials: 'include',
      cache: 'no-store',
    });

  let res = await doFetch();

  // CSRF token expired / rotated mid-session: bust and retry once.
  if (res.status === 403 && isMutating) {
    csrfToken = null;
    const token = await fetchCsrfToken();
    if (token) {
      csrfHeaders = { 'X-CSRF-Token': token };
      res = await doFetch();
    }
  }

  const body = (await res.json().catch(() => ({}))) as Envelope<T>;

  if (!res.ok || ('success' in body && body.success === false)) {
    const err = 'error' in body ? body.error : undefined;
    throw new ApiError(
      err?.message ?? `Request failed (${res.status})`,
      err?.code ?? 'NETWORK_ERROR',
      res.status,
      err?.details,
    );
  }

  if ('success' in body && body.success) return body.data as T;
  return body as unknown as T;
}

export interface SendOtpResponse {
  message: string;
  phone: string;
  requestId: string;
  expiresInSec: number;
  resendAvailableInSec: number;
  provider: string;
}

export interface AuthUser {
  id: string;
  phone?: string;
  email?: string;
  provider: 'phone' | 'email' | 'both';
  isNew: boolean;
}

export interface AuthResponse {
  message: string;
  user: AuthUser;
}

export const authApi = {
  sendOtp: (phone: string, countryCode = 'IN') =>
    request<SendOtpResponse>('/auth/send-otp', {
      method: 'POST',
      body: JSON.stringify({ phone, countryCode }),
    }),

  verifyOtp: (phone: string, otp: string, countryCode = 'IN') =>
    request<AuthResponse>('/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ phone, countryCode, otp }),
    }),

  emailSignup: (email: string, password: string) =>
    request<AuthResponse>('/auth/email-signup', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  emailLogin: (email: string, password: string) =>
    request<AuthResponse>('/auth/email-login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  me: () => request<{ user: AuthUser | null }>('/auth/me', { method: 'GET' }),
  refresh: () => request<AuthResponse>('/auth/refresh', { method: 'POST' }),
  logout: () => request<{ message: string }>('/auth/logout', { method: 'POST' }),

  forgotPassword: (email: string) =>
    request<{ message: string }>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  resetPassword: (token: string, newPassword: string) =>
    request<{ message: string }>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, newPassword }),
    }),

  listSessions: () =>
    request<{
      items: {
        id: string;
        createdAt: string;
        lastSeenAt: string;
        expiresAt: string;
        ip: string | null;
        userAgent: string | null;
        device: string | null;
        isCurrent: boolean;
      }[];
    }>('/auth/sessions'),

  revokeSession: (id: string) =>
    request<{ ok: boolean }>(`/auth/sessions/${id}/revoke`, { method: 'POST' }),
};

export interface UserProfile {
  id: string;
  phone: string | null;
  email: string | null;
  provider: 'phone' | 'email' | 'both';
  displayName: string | null;
  profilePhotoUrl: string | null;
  bio: string | null;
  emailVerified: boolean;
  phoneVerified: boolean;
  role: string;
  createdAt: string;
}

export const usersApi = {
  me: () => request<UserProfile>('/users/me'),
  update: (patch: {
    displayName?: string | null;
    bio?: string | null;
    profilePhotoUrl?: string | null;
  }) =>
    request<UserProfile>('/users/me', {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  exportData: () => request<unknown>('/users/me/export-data'),
  deleteSelf: () =>
    request<{ ok: boolean }>('/users/me/delete', { method: 'POST' }),
};

export interface OrderRow {
  id: string;
  auctionId: string;
  buyerId: string;
  sellerId: string;
  finalPrice: number;
  paymentStatus: 'pending' | 'paid' | 'failed' | 'refunded';
  deliveryStatus: 'scheduled' | 'in_transit' | 'delivered' | 'disputed' | 'cancelled';
  scheduledFor: string | null;
  deliveredAt: string | null;
  escrowReleasedAt: string | null;
  createdAt: string;
  auction: {
    id: string;
    title: string;
    imageUrls: string[];
    make: string;
    modelName: string;
    year: number;
    city: string;
    endedAt: string | null;
  };
}

export const ordersApi = {
  wins: (opts: { limit?: number; cursor?: string } = {}) =>
    request<{ items: OrderRow[]; nextCursor: string | null }>(
      `/orders/me/wins${qs(opts as Record<string, string | number | undefined>)}`,
    ),
  sales: (opts: { limit?: number; cursor?: string } = {}) =>
    request<{ items: OrderRow[]; nextCursor: string | null }>(
      `/orders/me/sales${qs(opts as Record<string, string | number | undefined>)}`,
    ),
  get: (id: string) => request<OrderRow>(`/orders/${id}`),
  fileDispute: (
    id: string,
    payload: { reason: string; details: string; evidenceUrls?: string[] },
  ) =>
    request<{ id: string }>(`/orders/${id}/dispute`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};

// =====================================================================
// Auction / Bidding / Wallet / Notifications APIs
// =====================================================================

export interface Auction {
  id: string;
  title: string;
  description: string;
  vehicle: {
    make: string;
    model: string;
    year: number;
    kmDriven: number;
    fuelType: string;
    ownerCount: number;
    city: string;
    imageUrls: string[];
  };
  pricing: {
    startingPrice: number;
    minIncrement: number;
    reservePrice: number | null;
  };
  status: 'scheduled' | 'live' | 'ended' | 'cancelled';
  startsAt: string;
  endsAt: string;
  live: {
    currentHighBid: number | null;
    currentHighBidderId: string | null;
    bidCount: number;
  };
  outcome: {
    winnerId: string | null;
    finalPrice: number | null;
    endedAt: string | null;
  };
  sellerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface LiveState {
  status: string;
  highBid: number;
  highBidderId: string | null;
  endsAt: number;
  version: number;
  minIncrement: number;
  startingPrice: number;
}

export interface WalletBalance {
  balance: number;
  heldBalance: number;
  total: number;
}

export interface WalletEntry {
  id: string;
  walletId: string;
  type: string;
  amount: number;
  balanceAfter: number;
  referenceType: string | null;
  referenceId: string | null;
  note: string | null;
  createdAt: string;
}

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string;
  auctionId: string | null;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
}

function qs(params: Record<string, string | number | undefined>): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue;
    parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  }
  return parts.length ? `?${parts.join('&')}` : '';
}

export const auctionsApi = {
  list: (opts: {
    status?: string;
    city?: string;
    make?: string;
    limit?: number;
    cursor?: string;
  } = {}) =>
    request<{ items: Auction[]; nextCursor: string | null }>(
      `/auctions${qs(opts as Record<string, string | number | undefined>)}`,
    ),

  get: (id: string) => request<Auction>(`/auctions/${id}`),

  liveState: (id: string) => request<LiveState>(`/auctions/${id}/live`),

  placeBid: (id: string, amount: number) =>
    request<{
      bidId: string;
      newHighBid: number;
      endsAt: number;
      extended: boolean;
    }>(`/auctions/${id}/bids`, {
      method: 'POST',
      body: JSON.stringify({ amount }),
    }),

  create: (body: {
    title: string;
    description: string;
    make: string;
    modelName: string;
    year: number;
    kmDriven: number;
    fuelType: string;
    city: string;
    imageUrls: string[];
    startingPrice: number;
    minIncrement?: number;
    reservePrice?: number;
    startsAt: string;
    endsAt: string;
  }) =>
    request<Auction>('/auctions', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  cancel: (id: string) =>
    request<{ ok: boolean }>(`/auctions/${id}`, { method: 'DELETE' }),
};

export const walletApi = {
  balance: () => request<WalletBalance>('/wallet/balance'),
  entries: (opts: { limit?: number; cursor?: string } = {}) =>
    request<{ items: WalletEntry[]; nextCursor: string | null }>(
      `/wallet/entries${qs(opts as Record<string, string | number | undefined>)}`,
    ),
  devTopup: (amount: number) =>
    request<{ entry: unknown; balance: WalletBalance }>('/wallet/topup/dev', {
      method: 'POST',
      body: JSON.stringify({ amount }),
    }),
};

export const notificationsApi = {
  list: (opts: { limit?: number; cursor?: string; unread?: boolean } = {}) =>
    request<{
      items: NotificationItem[];
      nextCursor: string | null;
    }>(
      `/notifications${qs({
        limit: opts.limit,
        cursor: opts.cursor,
        unread: opts.unread ? '1' : undefined,
      })}`,
    ),
  unreadCount: () => request<{ count: number }>('/notifications/unread-count'),
  markRead: (id: string) =>
    request<{ ok: boolean }>(`/notifications/${id}/read`, { method: 'PATCH' }),
  markAllRead: () =>
    request<{ count: number }>('/notifications/read-all', { method: 'PATCH' }),
};

// =====================================================================
// Search, Watchlist, Proxy-bid, Uploads, Payments, Seller APIs
// =====================================================================

export interface SearchFilters {
  q?: string;
  status?: 'live' | 'scheduled' | 'ended';
  fuelType?: 'petrol' | 'diesel' | 'ev' | 'cng' | 'hybrid';
  minPrice?: number;
  maxPrice?: number;
  yearFrom?: number;
  yearTo?: number;
  city?: string;
  sort?: 'ending_soon' | 'newest' | 'price_asc' | 'price_desc';
  limit?: number;
  cursor?: string;
}

export const searchApi = {
  search: (f: SearchFilters) =>
    request<{ items: Auction[]; nextCursor: string | null }>(
      `/search/auctions${qs(f as Record<string, string | number | undefined>)}`,
    ),
  suggest: (q: string) =>
    request<{ items: { id: string; title: string; make: string; modelName: string }[] }>(
      `/search/suggest${qs({ q, limit: 8 })}`,
    ),
};

export const watchlistApi = {
  add: (auctionId: string) =>
    request<{ ok: boolean }>(`/watchlist/${auctionId}`, { method: 'POST' }),
  remove: (auctionId: string) =>
    request<{ ok: boolean }>(`/watchlist/${auctionId}`, { method: 'DELETE' }),
  list: () =>
    request<{ items: Auction[] }>(`/watchlist`),
};

export const proxyBidApi = {
  set: (auctionId: string, maxAmount: number) =>
    request<{ ok: boolean; maxAmount: number }>(`/proxybid/${auctionId}`, {
      method: 'POST',
      body: JSON.stringify({ maxAmount }),
    }),
  get: (auctionId: string) =>
    request<{ maxAmount: number | null; active: boolean }>(`/proxybid/${auctionId}`),
  cancel: (auctionId: string) =>
    request<{ ok: boolean }>(`/proxybid/${auctionId}`, { method: 'DELETE' }),
};

// Backend `PresignDto` only accepts the short purpose tags. Keep the
// long names in the UI for clarity and translate at the boundary.
type UploadPurpose = 'auction_image' | 'kyc_doc' | 'payment_proof';
const PURPOSE_TO_BACKEND: Record<UploadPurpose, 'auction' | 'kyc' | 'payment'> = {
  auction_image: 'auction',
  kyc_doc: 'kyc',
  payment_proof: 'payment',
};

export const uploadsApi = {
  presign: (mimeType: string, sizeBytes: number, purpose: UploadPurpose) =>
    request<{ uploadUrl: string; key: string; publicUrl: string }>('/uploads/presign', {
      method: 'POST',
      body: JSON.stringify({
        mimeType,
        sizeBytes,
        purpose: PURPOSE_TO_BACKEND[purpose],
      }),
    }),
  confirm: (
    key: string,
    mimeType: string,
    sizeBytes: number,
    opts: { auctionId?: string; sortOrder?: number } = {},
  ) =>
    request<{ ok: boolean; imageId?: string }>('/uploads/confirm', {
      method: 'POST',
      body: JSON.stringify({ key, mimeType, sizeBytes, ...opts }),
    }),
};

export interface PaymentInstructions {
  upiId: string;
  payeeName: string;
  qrImageUrl: string;
  minAmount: number;
  steps: string[];
}

export interface PaymentProof {
  id: string;
  amount: number;
  utr: string;
  screenshotUrl: string;
  status: 'pending' | 'approved' | 'rejected';
  reason: string | null;
  createdAt: string;
  decidedAt: string | null;
}

export const paymentsApi = {
  instructions: () => request<PaymentInstructions>('/payments/instructions'),
  /**
   * Backend `CreateProofDto` requires `{ amount, utrReference?, fileKey }`.
   * Anything else trips ValidationPipe (forbidNonWhitelisted=true).
   */
  createProof: (body: { amount: number; utrReference?: string; fileKey: string }) =>
    request<PaymentProof>('/payments/proofs', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  myProofs: () => request<{ items: PaymentProof[] }>('/payments/proofs'),
};

export interface SellerStats {
  totalListings: number;
  activeAuctions: number;
  soldCount: number;
  totalRevenuePaisa: number;
}

export const sellerApi = {
  stats: () => request<SellerStats>('/seller/stats'),
  myListings: (opts: { status?: string; limit?: number; cursor?: string } = {}) =>
    request<{ items: Auction[]; nextCursor: string | null }>(
      `/seller/listings${qs(opts as Record<string, string | number | undefined>)}`,
    ),
};

export interface KycDocKey {
  docType: 'pan' | 'aadhaar' | 'driving_license' | 'passport';
  fileKey: string;
  mimeType: string;
  sizeBytes: number;
}

export const kycApi = {
  status: () => request<{ status: string; rejectionReason: string | null } | null>('/kyc/status'),
  /**
   * Backend SubmitKycDto expects an array of nested document descriptors
   * under documentKeys[], NOT flat panDocKey/aadhaarDocKey strings.
   */
  submit: (body: {
    fullName: string;
    dob?: string;
    panNumber?: string;
    aadhaarLast4?: string;
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    state?: string;
    pincode?: string;
    documentKeys?: KycDocKey[];
  }) =>
    request<{ ok: boolean }>('/kyc/submit', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
};

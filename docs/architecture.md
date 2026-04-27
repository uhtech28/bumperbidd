# BumperBid Auth — System Architecture (detail)

## High-level flow

```
┌────────────┐   1. POST /auth/send-otp       ┌────────────────────┐
│  Client    │ ─────────────────────────────▶ │  AuthController    │
│  (Next.js) │                                └─────────┬──────────┘
└────────────┘                                          │
      ▲                                                 ▼
      │                                         ┌────────────────┐
      │                                         │  AuthService   │
      │                                         └───────┬────────┘
      │                                                 ▼
      │                                         ┌────────────────┐
      │                                         │  OtpService    │ ─┐
      │                                         └───────┬────────┘  │
      │                                                 ▼           │
      │               ┌─────────────────────────────────────────┐   │
      │               │  Redis                                  │   │
      │               │  - otp:phone:<e164>     (hash + meta)   │   │
      │               │  - otp:cooldown:send:<e164>             │   │
      │               │  - otp:rl:send:phone:<e164>             │   │
      │               │  - otp:rl:send:ip:<ip>                  │   │
      │               └─────────────────────────────────────────┘   │
      │                                                 │           │
      │                                                 ▼           │
      │                                   ┌──────────────────────┐  │
      │                                   │  SMS Provider Chain  │  │
      │                                   │  MSG91 → Twilio →    │  │
      │                                   │  DevLog (local only) │  │
      │                                   └──────────────────────┘  │
      │                                                 │           │
      └─────── 2xx + { requestId, expiresIn, resend }   │           │
                                                        ▼           │
                                               ┌──────────────┐     │
                                     ┌────────▶│  End user    │     │
                                     │  SMS    │  (real phone)│     │
                                     └─────────┴──────────────┘     │
                                                                    │
                     (verify path)   3. POST /auth/verify-otp       │
              ┌──────────────────────────────────────────────────┐  │
              │  OtpService                                      │  │
              │   - load record                                  │  │
              │   - check attempts (< MAX)                       │  │
              │   - HMAC(candidate) == stored (timing-safe)      │  │
              │   - on success: DEL record, issue JWT            │  │
              └──────────────────────────────────────────────────┘──┘
```

## Data in Redis

All TTL values are driven by `OTP_TTL_SECONDS` and `OTP_*_WINDOW_SECONDS`
in `backend/.env`. Keys expire automatically, so the store is self-cleaning.

| Key                              | Type   | TTL                  | Purpose                                                       |
| -------------------------------- | ------ | -------------------- | ------------------------------------------------------------- |
| `otp:phone:<e164>`               | JSON   | `OTP_TTL_SECONDS`    | `{hash, attempts, createdAt, requestId}` — the OTP record     |
| `otp:cooldown:send:<e164>`       | string | `OTP_RESEND_COOLDOWN`| Prevents send-spam to the same phone                          |
| `otp:rl:send:phone:<e164>`       | int    | `OTP_HOURLY_WINDOW`  | Sliding counter: max `OTP_HOURLY_REQUEST_LIMIT` per window    |
| `otp:rl:send:ip:<ip>`            | int    | `OTP_HOURLY_WINDOW`  | Sliding counter: max `OTP_IP_HOURLY_LIMIT` per window         |
| `user:phone:<e164>`              | JSON   | ∞                    | User record (temporary — moves to Postgres later)             |
| `auth:refresh:<userId>:<jti>`    | string | `JWT_REFRESH_TTL`    | Refresh token allow-list for rotation/revoke                  |

## Why HMAC + phone pepper?

Storing hash-only OTPs prevents a Redis snapshot leak from yielding usable
codes. Including the phone number in the HMAC input means an attacker with a
leaked hash still can't pair it with a *different* phone — the hash
pre-images are bound to the recipient.

```
hash = HMAC_SHA256(key = JWT_SECRET, data = `${phone}:${otp}`)
```

## Why Lua-scripted INCR+EXPIRE?

`INCR` + `EXPIRE` done as two round-trips has a classic race where the TTL
can be "lost" if the client dies between calls. The Lua script in
`rate-limit.service.ts` makes the (INCR, conditional-EXPIRE, TTL-read) a
single atomic step.

## Rate limiting matrix

| Layer                           | Limit                                       | Scope         |
| ------------------------------- | ------------------------------------------- | ------------- |
| Nest `ThrottlerGuard` (global)  | 120 / 60s                                   | per IP        |
| Nest `ThrottlerGuard` (route)   | send: 5 / 60s · verify: 10 / 60s            | per IP + path |
| `OtpService` cooldown           | 30s between sends                           | per phone     |
| `OtpService` hourly cap         | 3 sends / 10 min                            | per phone     |
| `OtpService` IP cap             | 20 sends / 10 min                           | per IP        |
| `OtpService` verify attempts    | 5 wrong OTPs before record is invalidated   | per phone     |

Every limit returns a distinct `error.code` so the UI can render the
right message / countdown without string-matching.

## Provider chain

```ts
chain = [msg91, twilio, devLog].filter(p => p.enabled);
for (const p of chain) {
  try { if ((await p.send(...)).accepted) return p.name; }
  catch (e) { /* logged, fall through */ }
}
throw ServiceUnavailable('SMS_DISPATCH_FAILED');
```

The dev-log provider is only included when `OTP_DEV_LOG=true`. Production
deployments set `OTP_DEV_LOG=false` and configure MSG91 + Twilio credentials
so fallback is real.

## Front-end state model

The OTP page is fully resumable: `resendAvailableInSec` and `expiresInSec`
are mirrored into the URL query string when navigating from the phone
screen. A browser refresh preserves the countdowns. Two independent
`useCountdown` timers drive the UI:

- `resendTimer` — controls the "Resend OTP" button's disabled state.
- `expiryTimer` — shows "Expires in mm:ss" to the user.

On successful verify we persist `{ accessToken, refreshToken, userId, phone }`
in `sessionStorage` via `lib/session.ts`. The facade is designed to be
swapped for an HttpOnly-cookie implementation without changing callers.

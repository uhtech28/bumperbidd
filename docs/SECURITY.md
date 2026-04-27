# BumperBid Security Posture

## Threat model

1. **External attackers**
   - Credential stuffing on auth endpoints -> mitigated by rate-limit
     + bcrypt rounds 12 + HIBP password check at signup.
   - CSRF on state-changing requests -> double-submit cookie
     (`csrf-csrf`).
   - XSS via user-supplied content (auction titles, descriptions) ->
     validator sanitizes, no raw HTML rendered, CSP.
   - IDOR on `/wallet/entries/:id`, `/kyc/*` -> ownership checked
     via userId from JWT, never from URL alone.
   - Image upload abuse -> R2 presigned PUT enforces Content-Type,
     size cap 5MB; Rekognition scans for NSFW/violence.

2. **Insider/admin abuse**
   - Every admin action audit-logged with IP + UA + diff snapshot.
   - Wallet credit/debit requires idempotency key to prevent replay.
   - Admin refunds above Rs 50,000 require 2-person approval (TODO).

3. **Financial manipulation**
   - Bid races solved by Redis Lua (atomic).
   - Wallet concurrency handled by Postgres `SELECT ... FOR UPDATE`.
   - Proxy-bid cascade recomputed server-side only, never trusted
     from client.
   - Suspicious-bid detector flags dominant-bidder and sub-second
     bursts (see `AdminService.detectSuspicious`).

## Authentication

- OTP: 6-digit, 5-min expiry, 3-attempt lockout, 60s resend cooldown.
- Email/password: bcrypt cost 12, Argon2id planned for next rotation.
- JWT access: 15m TTL, HS256; refresh: 7d rolling with jti rotation.
- Cookies: `__Host-` prefix, `SameSite=Strict`, `Secure`, `HttpOnly`.

## Transport & headers

- HSTS `max-age=63072000; includeSubDomains; preload`
- CSP: `default-src 'self'; img-src 'self' https:; connect-src 'self' wss: https:`
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: geolocation=(), microphone=(), camera=()`

All applied via `helmet()` in `src/common/middleware/security.middleware.ts`.

## Secret management

- Dev: `.env` (gitignored)
- Prod: Railway env vars (encrypted at rest); never committed
- CI: GitHub repository secrets; `secrets.*` in workflows
- Rotation cadence: JWT 90d, AWS 90d, DB creds 180d, Firebase yearly

## Vulnerability management

- `npm audit --omit=dev --audit-level=high` runs in CI
- Dependabot enabled for weekly PRs
- Production patches within:
  - Critical: 24h
  - High: 7 days
  - Medium: 30 days
  - Low: next sprint

## Incident response

See `docs/RUNBOOK.md#8-escalation`. Post-mortems blameless,
published in `/postmortems/`.

## Pen test cadence

Annual third-party pen test; next due 2026-06.

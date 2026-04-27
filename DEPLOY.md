# BumperBid — Deployment guide

This document walks through deploying the backend to Railway / Fly / Render, the frontend to Vercel, with Supabase Postgres + Upstash Redis as managed data stores. The target capacity is ~10 lakh (1M) DAU with room to scale horizontally.

## Architecture at a glance

```
┌──────────────┐     HTTPS      ┌─────────────────┐     TLS      ┌─────────────┐
│   Browser    │ ──────────────▶│ Vercel (Next)   │ ─────────────▶│   Backend   │
│ (cookie auth)│◀────────────── │  bumperbid.com  │◀──────────── │  Railway /  │
└──────────────┘   Set-Cookie   └─────────────────┘   JSON API   │  Fly / Render│
                                                                  └──────┬──────┘
                                                                         │
                                              ┌──────────────────────────┼──────────────────────────┐
                                              ▼                          ▼                          ▼
                                       ┌─────────────┐          ┌─────────────────┐       ┌──────────────┐
                                       │  Supabase   │          │  Upstash Redis  │       │    MSG91     │
                                       │   Postgres  │          │ (OTP + rate +   │       │ (SMS OTP IN) │
                                       │ + pgBouncer │          │   JWT jti)      │       │              │
                                       └─────────────┘          └─────────────────┘       └──────────────┘
```

## Provisioning

### 1. Supabase Postgres
1. Create a project. Region: choose closest to your backend deploy region.
2. In **Project Settings → Database** copy both URIs:
   - `Connection pooling` → `DATABASE_URL` (port 6543, `?pgbouncer=true&connection_limit=1`)
   - `Connection string` → `DIRECT_URL` (port 5432)
3. Raise the pool size in **Database → Pooler Configuration** to `50–100` for 1M DAU.

### 2. Upstash Redis
1. Create a Global database (multi-region replicated, active-active writes).
2. Copy host / port / password into `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`. Set `REDIS_TLS=1`.

### 3. SMS provider
- MSG91 for India — grab auth key + approved template ID. Set `MSG91_ENABLED=1`.
- Twilio for international fallback.

## Backend

### Option A — Railway

1. `railway init` → connect this repo.
2. Set env vars from `backend/.env.example`. Key production overrides:
   ```
   NODE_ENV=production
   TRUST_PROXY=1
   COOKIE_SECURE=1
   COOKIE_DOMAIN=.bumperbid.com
   COOKIE_SAMESITE=lax
   CORS_ORIGIN=https://bumperbid.com,https://www.bumperbid.com
   ```
3. Build command: `npm ci && npx prisma generate && npm run build`
4. Start command: `npx prisma migrate deploy && node dist/main.js`
5. Health check path: `/health` — Railway will pull the pod out of rotation if this fails.
6. Scale: start with 2 replicas (HA). Autoscale on p99 latency > 300 ms.

### Option B — Fly.io

1. `fly launch` in `backend/` (it will detect the Dockerfile).
2. `fly secrets set JWT_SECRET=... DATABASE_URL=... …` — every variable from `.env.example` that is not an inert default.
3. `fly scale count 2 --region bom` (closest to India; adjust per user base).
4. Fly's internal load balancer already sets `X-Forwarded-For` correctly — `TRUST_PROXY=1`.

### Option C — Render

1. New **Web Service** → Docker runtime → point at `backend/Dockerfile`.
2. Health check path: `/health`.
3. Autoscaling: `min=2 max=10`, target CPU `70%`.

## Frontend (Vercel)

1. Import the repo, set project root to `frontend/`.
2. Env var: `NEXT_PUBLIC_API_BASE=https://api.bumperbid.com/api/v1`.
3. Attach custom domain `bumperbid.com` + `www.bumperbid.com`.

### CORS + cookies — important

For cookies to flow between `bumperbid.com` → `api.bumperbid.com`:
- Backend `COOKIE_DOMAIN=.bumperbid.com` (leading dot, shared across subdomains)
- Backend `CORS_ORIGIN` includes the full frontend origin
- Backend `COOKIE_SECURE=1` and `COOKIE_SAMESITE=lax` (Lax is fine because our auth flow is first-party)
- Frontend `fetch` calls include `credentials: 'include'` — already wired in `lib/api.ts`

## Database migrations

```bash
cd backend
# Create a new migration from a schema change:
npx prisma migrate dev --name add_something

# Apply pending migrations in production (Dockerfile does this automatically
# on container start):
npx prisma migrate deploy
```

Never run `prisma db push` in production — it skips the migration history and cannot be rolled back.

## Capacity sizing (target: ~10 lakh DAU)

| Component | Start size | Notes |
|-----------|-----------|-------|
| Backend pods | 2 × (0.5 vCPU / 512 MB) | Autoscale on latency; Node event-loop tops out well before CPU |
| Postgres | Supabase Small (2 vCPU / 4 GB) | pgBouncer multiplexes up to ~10k client sockets onto 20 DB conns |
| Redis | Upstash Pay-as-you-go | OTP + throttler keys TTL-evict automatically |
| SMS | MSG91 transactional tier | Pre-purchase credits; ~1 OTP / user / day |

Bottleneck order (based on our design): SMS provider rate limits > DB write throughput on `users` table > Redis IOPS. All three scale horizontally at the provider level.

## Operational runbooks

- **Rotate JWT secret**: deploy with new `JWT_SECRET`. All existing sessions invalidate on next request — users re-login. Plan for a small spike on /auth/email-login or /auth/send-otp.
- **Kill a session**: delete the Redis key `auth:refresh:<userId>:<jti>`. Next refresh call will fail with `REFRESH_REVOKED`.
- **Logout-everywhere for a user**: `KEYS auth:refresh:<userId>:*` then `DEL` each (or use SCAN in prod — Upstash rejects KEYS above ~1M keys).
- **Throttler false positive**: check the Redis key `throttler:*` for the offending IP; TTL shows time until unblock.

# BumperBid v3 — Production-grade vehicle auction platform

Real-time vehicle auctions for India with anti-sniping, wallet holds,
KYC-gated selling, admin reviewed QR-UPI topups, search, proxy bidding,
watchlist, push + email notifications, admin panel, and full
observability.

```
backend/    NestJS 10 + Prisma + Postgres + Redis + Socket.IO + BullMQ
frontend/   Next.js 14 (user app)
admin/      Next.js 14 (admin app, separate port/domain)
docs/       Architecture, runbook, compliance, security, go-live
.github/    CI + deploy workflows
```

## Start (dev)

```bash
# 1. services
docker compose up -d postgres redis

# 2. backend
cd backend
cp .env.example .env
npm install
npm run prisma:migrate:dev
npm run prisma:seed
npm run start:dev        # api :4000
# in a second terminal:
npm run start:worker     # bid-persistence worker

# 3. frontend (user)
cd ../frontend
cp .env.local.example .env.local
npm install
npm run dev              # :3000

# 4. admin
cd ../admin
npm install
npm run dev              # :3001
```

## What's in the box

**Auth & identity**
- Phone OTP (dev console / prod Twilio, with DLT template IDs)
- Email + password (bcrypt 12)
- JWT in HttpOnly cookies with refresh rotation
- RBAC: `user | seller | admin | support`, with KYC-gated promotion
- Session revocation via `UserSession` table

**Bidding engine**
- Redis Lua script for atomic bid placement
- Anti-sniping: 30s extension when bids arrive in final 25s
- Proxy bidding cascade (server-side)
- Wallet holds with idempotency
- Socket.IO + Redis adapter for horizontal scale
- BullMQ worker for bid persistence (hot path stays in Redis)

**Payments (no Razorpay)**
- QR + UPI manual topup: user pays externally, submits UTR + screenshot
- Admin approves/rejects in `/admin/payments`
- Approval credits wallet with idempotency key `proof-{id}`

**Compliance**
- KYC (PAN + Aadhaar last-4 + docs via R2 + Rekognition scan)
- Email events table (DPDP consent tracked)
- Admin audit log with diff snapshots
- DLT-compliant transactional SMS templates

**Search**
- Postgres FTS (`tsvector` generated column, GIN index)
- `pg_trgm` fuzzy suggest
- Cursor pagination

**Notifications**
- Resend transactional email (outbid, winner, ending-soon, seller-new-bid)
- FCM push + Web Push (VAPID), auto-unregister on 410/404
- In-app notifications table

**Observability**
- Sentry with profiling, PII scrubbed
- Prometheus `/metrics` (bids, latency, WS connections, holds)
- nestjs-pino structured logs with redaction

**Ops**
- helmet + compression + CSRF (double-submit cookie)
- Graceful shutdown (SIGTERM, 30s)
- `.github/workflows/ci.yml` — typecheck, lint, tests, build, audit
- `.github/workflows/deploy.yml` — Railway + Vercel + Sentry release
- Runbook, compliance, security, go-live checklist in `docs/`

**Tests**
- Jest unit tests (wallet/bidding 80%+ coverage gate)
- Supertest integration tests
- k6 load test (1000 concurrent bidders)
- Redis EVAL tests of the Lua script

See:
- [`docs/architecture.md`](docs/architecture.md)
- [`docs/RUNBOOK.md`](docs/RUNBOOK.md)
- [`docs/COMPLIANCE.md`](docs/COMPLIANCE.md)
- [`docs/SECURITY.md`](docs/SECURITY.md)
- [`docs/GO-LIVE-CHECKLIST.md`](docs/GO-LIVE-CHECKLIST.md)

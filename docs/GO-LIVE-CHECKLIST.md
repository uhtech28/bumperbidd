# Go-live checklist

Check every item before flipping production traffic.

## Infrastructure

- [ ] Postgres provisioned (Neon Pro, AZ=ap-south-1, PITR 7d)
- [ ] Redis provisioned (Upstash Mumbai, AOF on, TLS on)
- [ ] R2 bucket created (versioning on, lifecycle: KYC docs -> 7 years,
      payment proofs -> 2 years, auction images -> permanent)
- [ ] Railway: API (2 replicas, 1GB), Worker (1 replica, 512MB)
- [ ] Vercel: frontend on bumperbid.in, admin on admin.bumperbid.in
- [ ] Cloudflare: WAF on, rate-limit 100 req/min per IP on /api/v1/auth
- [ ] Domain + SSL + DKIM/SPF/DMARC for @bumperbid.in

## Secrets

- [ ] `JWT_ACCESS_SECRET` (>= 32 random bytes)
- [ ] `JWT_REFRESH_SECRET` (>= 32 random bytes, distinct)
- [ ] `COOKIE_SECRET` (>= 32 random bytes)
- [ ] `CSRF_SECRET` (>= 32 random bytes)
- [ ] `DATABASE_URL` (pooler URL for Neon)
- [ ] `REDIS_URL`
- [ ] `S3_ENDPOINT`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET`
- [ ] `AWS_REGION`, `AWS_REKOGNITION_KEY`, `AWS_REKOGNITION_SECRET`
- [ ] `RESEND_API_KEY`
- [ ] `FCM_SERVICE_ACCOUNT_JSON`
- [ ] `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`
- [ ] `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM` (or MSG91)
- [ ] `SENTRY_DSN`, `SENTRY_AUTH_TOKEN`
- [ ] `UPI_PAYEE_ID`, `UPI_PAYEE_NAME`, `UPI_QR_IMAGE_URL`

## Database

- [ ] `CREATE EXTENSION pg_trgm;` applied
- [ ] `prisma migrate deploy` successful
- [ ] Seed data (if any) loaded
- [ ] Indexes reviewed via `EXPLAIN ANALYZE` on:
  - auction listing by status+endsAt
  - bid history by auctionId
  - wallet entries by walletId DESC

## Compliance & legal

- [ ] Terms of Service live, version-stamped
- [ ] Privacy policy live, version-stamped
- [ ] Refund policy live
- [ ] Grievance officer name, email, address in footer
- [ ] DLT templates approved (OTP, outbid, winner)
- [ ] GST registration complete (TCS @ 1%)
- [ ] KYC workflow tested end-to-end with real PAN

## Observability

- [ ] Sentry project live, source maps uploaded
- [ ] Prometheus scraping `/metrics`
- [ ] Grafana dashboards imported (link in RUNBOOK)
- [ ] Alerts wired to Slack #bumperbid-alerts
- [ ] Uptime monitor (BetterStack) on `/health`

## Load test

- [ ] k6 scenario `test/load/place-bid.k6.js` passes:
  - 1000 concurrent bidders, p99 < 300ms, error rate < 5%
- [ ] BullMQ queue drains under sustained load
- [ ] Redis memory stays below 60% of limit

## Security

- [ ] Admin accounts use 2FA (TOTP)
- [ ] Sessions table cleaned of stale rows (>30d idle)
- [ ] `X-Robots-Tag: noindex` on `/admin`, `/api`
- [ ] CORS limited to production origins only
- [ ] CSP verified in staging (no inline scripts)

## Rollback plan

- [ ] Previous Railway deployment noted as "known good"
- [ ] Neon restore point bookmarked
- [ ] Feature flags ready to disable paid features if needed

## Day-one traffic

- [ ] Soft launch to 100 users first
- [ ] Monitor for 48h before public launch
- [ ] Support team Slack channel with SLAs agreed
- [ ] FAQ covers top 20 expected questions

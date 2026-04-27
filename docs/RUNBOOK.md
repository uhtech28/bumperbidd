# BumperBid Runbook

Operational playbook for on-call engineers. Covers deploy, rollback, common
incidents, and escalation paths.

## 1. Service inventory

| Component | Tech | Host | Port | Health |
|---|---|---|---|---|
| API | NestJS 10 | Railway | 4000 | `GET /health` |
| Worker (bid persistence, email, push) | Node + BullMQ | Railway | n/a | `GET /health` via api/worker-health |
| Frontend | Next.js 14 | Vercel | 443 | `/` 200 |
| Admin | Next.js 14 | Vercel | 443 | `/login` 200 |
| Postgres 15 | Neon/Railway | managed | 5432 | `SELECT 1` |
| Redis 7 | Upstash | managed | 6379 | `PING` |
| Object storage | Cloudflare R2 | - | - | HEAD bucket |

## 2. Dashboards & Alerts

- Metrics: Prometheus scrape `GET /metrics` (see `src/modules/metrics`).
- Alerts (Grafana -> Slack #bumperbid-alerts):
  - `p99(http_request_duration_seconds) > 0.5s` for 5m
  - `rate(bids_rejected_total{code="INSUFFICIENT_FUNDS"}[5m]) / rate(bids_placed_total[5m]) > 0.3`
  - `wallet_holds_locked > 0` AND stale > 10 minutes (suggests orphan holds)
  - `redis_connected_clients > 500` (connection leak)
  - `pg_up == 0` for 30s
- Sentry: severity=error alerts on any 5xx; daily digest for warnings.

## 3. Deploy

Standard push-to-main deploy is automated via `.github/workflows/deploy.yml`.
For manual/emergency deploys:

```bash
# Backend (Railway)
cd backend && railway up --service bumperbid-api
railway run --service bumperbid-api npx prisma migrate deploy

# Frontend / admin (Vercel)
cd frontend && vercel --prod
cd admin    && vercel --prod
```

## 4. Rollback

```bash
# Backend: use previous Railway deployment
railway rollback --service bumperbid-api

# If a migration was the cause, Prisma does not auto-rollback.
# For additive migrations: deploy previous code — old code tolerates
# new columns/tables. For destructive migrations: restore a point-in-time
# snapshot from Neon (Settings -> Restore).

# Frontend
vercel rollback <deployment-id>
```

## 5. Common incidents

### A. Bid latency spike

1. Inspect `bid_latency_seconds` histogram — which bucket grew?
2. If tail (p99) only: likely Redis contention. Check Redis slowlog.
3. If median too: likely DB queue drain. Check BullMQ queue `bid-persistence`
   for backlog (`redis-cli LLEN bull:bid-persistence:wait`).
4. Temporarily scale worker replicas: `railway up --service bumperbid-worker --replicas 3`.

### B. Orphan wallet holds (HOLD left after bid lost)

Cause: race between hold release on outbid and redis crash.

```sql
-- Find holds older than 15 min on auctions that ended > 15 min ago
SELECT w.* FROM "WalletTransaction" w
JOIN "Auction" a ON a.id = w."auctionId"
WHERE w.type = 'hold'
  AND a."endsAt" < now() - interval '15 minutes'
  AND NOT EXISTS (
    SELECT 1 FROM "WalletTransaction" r
    WHERE r."referenceId" = w.id::text AND r.type = 'release'
  );
```

Run the reconciliation job: `npm run script:reconcile-holds` (idempotent,
issues release entries with idempotency key `reconcile-{walletTxId}`).

### C. Payment proof backlog

1. Check pending count in admin `/admin/payments`.
2. SLA is 60 minutes — escalate to finance team on Slack if > 100 pending.
3. Bulk-approve flow not permitted; every proof must be reviewed.

### D. FCM / Web Push failures

- Check Firebase console for project quota.
- 410/404 responses auto-unregister tokens (`PushService.sendToUser`).
- If all tokens return 500 -> check `FCM_SERVICE_ACCOUNT_JSON` env var.

### E. Auction stuck in "live" past endsAt

The scheduler worker finalizes auctions by polling `endsAt <= now()`.
If the scheduler pod is down, a safety cron (see `queues/scheduler.ts`)
will pick up within 60s. Manual recovery:

```sql
UPDATE "Auction" SET status = 'ended', "endedAt" = now()
WHERE status = 'live' AND "endsAt" < now() - interval '2 minutes';
```

Then POST `/admin/auctions/:id/finalize` so winners/holds/wallet settle.

## 6. Secrets rotation

- JWT secrets: rotate every 90 days. Deploy new `JWT_ACCESS_SECRET_NEXT`,
  wait for refresh-cycle TTL (7d), then promote.
- AWS keys: rotate via IAM console; update Railway env; restart pods.
- Firebase service account JSON: regenerate in Firebase Console ->
  Project settings -> Service accounts.
- Resend API key: regenerate; update env; verify via `npm run scripts:send-test-email`.

## 7. Disaster recovery

- Postgres: Neon PITR enabled (7 days). RTO 30m, RPO 5m.
- Redis: Upstash AOF + daily snapshot; ephemeral live state, full
  rebuild from Postgres possible via `npm run scripts:warm-redis`.
- R2: versioning enabled; accidental deletes recoverable within 30 days.

## 8. Escalation

| Severity | Response | Notify |
|---|---|---|
| Sev1 (full outage) | Acknowledge in 5 min | @oncall + CEO + CTO |
| Sev2 (major feature down) | Acknowledge in 15 min | @oncall |
| Sev3 (minor, workaround exists) | Acknowledge in 2h | async |

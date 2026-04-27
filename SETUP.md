# Setup guide — real services

This file is the hands-on checklist to wire every third-party dependency
used by BumperBid, with where-to-sign-up links and cost estimates for
Indian production usage.

## 1. Database — Postgres 15

**Provider:** Neon (https://neon.tech) — free tier for dev; Pro ($19/mo)
for prod with PITR.

```bash
# local dev
docker run -d --name bb-pg -e POSTGRES_USER=bumperbid \
  -e POSTGRES_PASSWORD=bumperbid -e POSTGRES_DB=bumperbid \
  -p 5432:5432 postgres:15
psql postgres://bumperbid:bumperbid@localhost:5432/bumperbid \
  -c 'CREATE EXTENSION pg_trgm;'
```

## 2. Redis 7

**Provider:** Upstash (https://upstash.com) — free 10k commands/day;
Pay-as-you-go ~$0.2/100k commands for prod.

Keys used:
- `otp:phone:{+E164}` — OTP cache
- `auction:{id}:state` — hot state (highBid, endsAt, version)
- `bid:place:{auctionId}` — Lua lock
- `bull:bid-persistence:*` — BullMQ queue

## 3. Object storage — Cloudflare R2

**Provider:** Cloudflare R2 (https://developers.cloudflare.com/r2/)

- Create bucket `bumperbid-uploads`
- Enable versioning (Settings -> Object versioning)
- Create an R2 API token with "Object Read & Write"
- Lifecycle:
  - `prefix: kyc/` -> retain 7 years
  - `prefix: payments/` -> retain 2 years
  - `prefix: auctions/` -> permanent

Cost: ~$0.015/GB storage, zero egress (big win vs AWS S3).

## 4. Image moderation — AWS Rekognition

**Provider:** AWS (https://aws.amazon.com/rekognition/)

- ap-south-1 region (Mumbai)
- IAM user with `rekognition:DetectModerationLabels` only
- Cost: $1.00 / 1000 images (first 1M). Free tier 5k/month.

## 5. Email — Resend

**Provider:** Resend (https://resend.com)

- Domain verification: add SPF, DKIM, DMARC records to Route53/Cloudflare
- Free: 3k emails/month (100/day)
- Pro: $20/month for 50k emails

Test: `curl -X POST https://api.resend.com/emails -H "Authorization: Bearer $RESEND_API_KEY" ...`

## 6. Push — FCM + Web Push

**FCM:** Firebase console (https://console.firebase.google.com)
- Create project -> Cloud Messaging -> Generate service account JSON
- Paste the JSON string into `FCM_SERVICE_ACCOUNT_JSON` (single line)

**Web Push (VAPID):**
```bash
npx web-push generate-vapid-keys
# copy publicKey -> VAPID_PUBLIC_KEY
# copy privateKey -> VAPID_PRIVATE_KEY
```

## 7. OTP SMS

### Option A: Twilio Verify (easiest, $0.01/OTP)
- twilio.com -> Verify API -> Service SID
- DLT not required for international numbers; required for Indian numbers
  via TrueCaller/Infobip path. See DLT docs.

### Option B (India-cheap): MSG91 (~Rs 0.15/SMS)
- msg91.com -> Sender ID -> DLT template approval (3-5 business days)
- Header must be 6 chars: `BUMPRB`
- Templates (all must be registered):
  ```
  Your BumperBid OTP is {#var#}. Valid for 5 minutes. Do not share. -BUMPRB
  You have been outbid on {#var#}. Current high bid: Rs {#var#}. -BUMPRB
  Congratulations! You won the auction for {#var#}. Amount: Rs {#var#}. -BUMPRB
  ```

## 8. Sentry

**Provider:** Sentry.io
- Create project "bumperbid-backend" (platform: Node.js)
- Create project "bumperbid-frontend" (platform: Next.js)
- Copy DSN values to env

Free tier: 5k errors/month + 10k performance events.

## 9. Hosting

### Backend — Railway (https://railway.app)
- Two services: `bumperbid-api`, `bumperbid-worker`
- Auto-deploys on push (via deploy workflow)
- ~Rs 2k/month for 2x 1GB instances + worker

### Frontend + Admin — Vercel (https://vercel.com)
- Free hobby tier OK for launch; Pro $20/month if you need SSO/audit

## 10. Domain + CDN

- Domain: bumperbid.in (from BigRock or GoDaddy, ~Rs 900/year)
- DNS + WAF + DDoS: Cloudflare free plan
- SSL: automatic via Vercel / Railway (Let's Encrypt)

## Cost snapshot (500 MAU, 20 concurrent at peak)

| Service | Monthly |
|---|---|
| Neon Pro | $19 |
| Upstash | $5 |
| R2 (20 GB, 10M reads) | $1 |
| Rekognition (2k images) | $2 |
| Resend | $0 (free tier) |
| Firebase FCM | $0 |
| Twilio/MSG91 (5k OTP) | Rs 750 (~$9) |
| Railway | $15 |
| Vercel | $0 (hobby) |
| Sentry | $0 |
| Cloudflare | $0 |
| **Total** | **~$51/month** |

Per MAU ~ $0.10 at this scale. Bids/day capacity: 100k+ easily.

## Production hardening before launch

See [`docs/GO-LIVE-CHECKLIST.md`](docs/GO-LIVE-CHECKLIST.md) — tick every
item.

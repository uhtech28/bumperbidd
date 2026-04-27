# BumperBid — End-to-End Test Runbook

Step through this top to bottom. Stop at the first failure and report back the error.

All commands assume PowerShell on Windows. Project root is `C:\Users\utkar\OneDrive\Desktop\bb bid`.

---

## Stage 0 — Prerequisites (one-time)

### 0.1 Tools installed

```powershell
node --version    # need >= 18.17
npm --version
psql --version    # Postgres 14+
redis-cli --version
```

If anything is missing, install:
- Node: https://nodejs.org (LTS)
- Postgres 15: https://www.postgresql.org/download/windows/  (default user `postgres`, password `pg` — matches `.env`)
- Redis: easiest is Docker `docker run -d -p 6379:6379 --name bumperbid-redis redis:7`

### 0.2 Confirm Postgres + Redis are running

```powershell
# Postgres should accept the seed connection string
psql "postgresql://postgres:pg@localhost:5432/postgres" -c "select 1;"

# Redis ping
redis-cli ping
# Expect: PONG
```

If Postgres connection fails, start the service:
- Windows Services → "postgresql-x64-15" → Start
- Or `pg_ctl start -D "C:\Program Files\PostgreSQL\15\data"`

---

## Stage 1 — Backend setup

### 1.1 Install + generate Prisma client

```powershell
cd "C:\Users\utkar\OneDrive\Desktop\bb bid\backend"
npm install
npx prisma generate
```

Expected: no errors. `node_modules` populated, Prisma Client generated.

### 1.2 Apply migrations

```powershell
npx prisma migrate deploy
```

Expected output: `All migrations have been successfully applied.` (or `No pending migrations` if you've run before).

### 1.3 Seed the database

```powershell
npx prisma db seed
```

Expected output:
```
== BumperBid seed starting ==
  users: 10
  auctions: 10
Test credentials:
  email:    admin@bumperbid.test
  password: bumperbid123
== seed complete ==
```

If you see `prisma.seed property in your package.json` — that's the bug we already fixed; pull latest.

### 1.4 Confirm the admin user has role='admin'

```powershell
npx prisma studio
```

Browser opens at http://localhost:5555. Click **User** table. Find `admin@bumperbid.test`. Confirm `role` column shows `admin`. If not, click the cell and edit it, then Save.

Close Prisma Studio when done (Ctrl+C in the terminal).

### 1.5 Build sanity check

```powershell
npx tsc --noEmit
```

Expected: no output, exit code 0.

---

## Stage 2 — Start all three servers

Each goes in its own terminal. Leave them running.

### Terminal A — Backend

```powershell
cd "C:\Users\utkar\OneDrive\Desktop\bb bid\backend"
npm run start:dev
```

Expected: log lines including `[boot] BumperBid backend listening on :4000`. Watch for any red error — if you see one, send me that exact line.

### Terminal B — Frontend (user app)

```powershell
cd "C:\Users\utkar\OneDrive\Desktop\bb bid\frontend"
npm install   # first time only
npm run dev
```

Expected: `Ready in Xs` and `Local: http://localhost:3000`.

### Terminal C — Admin app

```powershell
cd "C:\Users\utkar\OneDrive\Desktop\bb bid\admin"
npm install   # first time only
npm run dev
```

Expected: `Ready in Xs` and `Local: http://localhost:3001`.

---

## Stage 3 — Browser tests

Open Chrome (or any modern browser). Open DevTools (F12) → Network and Console tabs.

### Test 3.1 — User signup + dashboard

Open **incognito** window. Go to `http://localhost:3000/auth`.

Sign in with email: `rohit@bumperbid.test` / password: `bumperbid123`.

**Expected**:
- Redirects to `/dashboard`
- TopBar shows wallet `₹5,00,000`
- Greeting reads "X auctions live right now" (5 if seed is fresh)
- Live Auctions rail shows 5 cards, each with realistic prices like ₹10,80,000 (NOT ₹10,80,00,000)
- Featured grid shows up to 8 cards
- Category chip counts: All=10, sum of others should also = 10

**If it fails**:
- Stuck on `/auth`: Network tab → look at the `/auth/email-login` request status + response body. Send me both.
- Dashboard loads but rail is empty: backend lifecycle scheduler may have ended the auctions. Re-run `npx prisma db seed`.
- Prices look 100x too big: send a screenshot.

### Test 3.2 — Open auction + place bid

Click any card in the Live Auctions rail.

**Expected**:
- Lands on `/auctions/{uuid}`
- Photo, title, current high in rupees, countdown
- Bid input + ProxyBidWidget below

In the bid input, enter `currentHigh + 5000` (a value 5,000 rupees above the displayed high). Click bid.

**Expected**:
- Toast/success message
- High bid number ticks up
- Bidder count increments by 1
- Notifications bell shows a `1` badge

**If it fails**: send the Network tab response from `POST /auctions/:id/bids` and any console errors.

### Test 3.3 — WebSocket two-tab realtime test

Keep the auction page open. Open a **second** incognito window, sign in as `priya@bumperbid.test` / `bumperbid123`. Open the same auction.

In window 2, place a bid above your current high.

**Expected** (in window 1):
- Within ~200ms the high bid number updates without a page reload
- Your "Winning" pill flips to "Outbid"
- A new notification arrives

**If realtime doesn't work**:
- Console in window 1 → look for Socket.IO connection logs
- Network → WS tab → confirm a websocket to `localhost:4000/ws` is active
- Send the console output

### Test 3.4 — Notifications inbox

In window 1, click the bell icon in TopBar.

**Expected**:
- Lands on `/notifications`
- Shows recent bid notifications with type pills
- Clicking an item routes to that auction
- "Mark all read" button clears the unread count

### Test 3.5 — Wallet + topup

Click the wallet chip in TopBar.

**Expected**: `/wallet` shows balance `₹5,00,000`, hold for any active bid, recent ledger entries.

Click "Top up". On `/wallet/topup`:
- Enter `1000` rupees
- Enter UTR: `TEST123456789`
- Pick any image file under 5MB
- Click "Submit for review"

**Expected**: 
- If S3/R2 keys are filled in `.env` — submission succeeds, shows up in your history table.
- If S3/R2 keys are empty (default dev) — fails at the presigned PUT step with `Upload to storage failed`. That's expected without real R2 keys; skip this test or set up MinIO locally.

### Test 3.6 — Admin login

In a **third** incognito window, go to `http://localhost:3001/login`. Use `admin@bumperbid.test` / `bumperbid123`.

**Expected**:
- Redirects to `/`
- Sidebar shows: Dashboard, Users, Auctions, Create Auction, Bids, Payments, Transactions, KYC, Audit Log
- Stat cards populate: Users=10, Live auctions, Total auctions=10, Total bids (matches your bid count), Holds locked in ₹
- Six operator-shortcut cards below

**If "Failed to load stats"**: the admin user doesn't have `role='admin'`. Repeat Stage 1.4.

### Test 3.7 — Admin pages walkthrough

Click each sidebar item in turn:

- **Users** → list of 10 users. Click a row. Try ban → enter reason → submit. Try unban. Try refund.
- **Auctions** → 10 rows. Click "Cancel" on a scheduled one. Confirm it disappears from active filter.
- **Bids** → list of bids you've placed.
- **Payments** → if you submitted a topup proof in 3.5, it shows here. Approve it. Confirm wallet gets credited.
- **Transactions** → wallet ledger across users. Filter by `type=hold` to see all the active bid holds.
- **KYC** → empty unless someone submitted KYC. Test 3.9 will populate this.
- **Audit Log** → click an entry to expand the JSON diff.

### Test 3.8 — Admin auction-create

Click **"+ New auction"** top-right of admin home (or sidebar Create Auction).

Fill the form:
- Title: `Test Auction Honda City`
- Description: `Test listing from admin runbook`
- Make: `Honda`, Model: `City`
- Year: `2022`, KM: `25000`, Owners: `1`
- Fuel: `petrol`, City: `Bengaluru`
- Image URLs: `https://images.unsplash.com/photo-1580273916550-e323be2ae537?w=1200, https://images.unsplash.com/photo-1605559424843-9e4c228bf1c2?w=1200`
- Starting price: `500000`
- Min increment: `1000`
- Reserve: `550000`
- Starts at: pick **2 minutes from now**
- Ends at: pick **1 hour from now**

Click "Create auction".

**Expected**:
- Bounces to `/auctions`
- New row appears with status `scheduled`
- After 2 minutes, status flips to `live` (refresh the page)
- The auction shows up on the user dashboard's Live Auctions rail

### Test 3.9 — Seller path with KYC

In a **new** incognito window, sign in as `arjun@bumperbid.test`. Go to `http://localhost:3000/seller`.

**Expected**: 403 / "not a verified seller" message with link to `/kyc`.

Click "Complete KYC". Fill form:
- Full name: `Arjun Kapoor`
- PAN: `AAAAA9999A` (matches the regex)
- Aadhaar last 4: `1234`
- Address line 1, City, State, Pincode `560001`
- Upload any two images for PAN + Aadhaar docs (under 5MB each)
- Submit

**Expected**: status flips to `pending`.

In the admin window → `/kyc` → approve Arjun's submission.

Back in Arjun's window → refresh `/seller`. **Expected**: dashboard now loads (no 403).

Click "+ New auction" → land on `/seller/new`. Fill the form, upload at least one image, submit.

**Expected**: redirects to the new auction page. The auction is visible on `/dashboard` once `startsAt` is reached.

---

## Stage 4 — What to send if something breaks

Format your bug report like this:

```
TEST: 3.2 — Place bid
ENV: backend logs say [boot] BumperBid listening on :4000, frontend on :3000
WHAT I DID: clicked bid with amount=1085000 on Hyundai Creta auction
EXPECTED: bid accepted, high bid ticks up
ACTUAL: 400 error
NETWORK RESPONSE BODY: { "success": false, "error": { "code": "BELOW_MIN_INCREMENT", ... } }
CONSOLE ERRORS: (paste any)
BACKEND LOGS: (paste any red lines around the failed request)
```

That makes it 10x faster for me to patch.

---

## Stage 5 — Common gotchas (read first if stuck)

| Symptom | Likely cause | Fix |
|---|---|---|
| Sign-in succeeds then dashboard redirects back to /auth | JWT TTL parsed wrong | Confirm `.env` has `JWT_ACCESS_TTL=15m` not `=900` |
| All POSTs return 403 invalid csrf token | CSRF middleware active | Confirm `CSRF_SECRET=` is commented out in `.env` for dev |
| Live rail empty | Seeded `endsAt` already passed | `npx prisma db seed` again |
| Admin "Failed to load stats" | User role not `admin` | Prisma Studio, set `role='admin'` for admin user |
| Wallet topup PUT fails | S3/R2 keys empty | Skip, or run MinIO locally and update `S3_*` env vars |
| WebSocket doesn't connect | CORS_ORIGIN missing your frontend port | `.env` should have `CORS_ORIGIN=http://localhost:3000,http://localhost:3001` |
| Bid succeeds but UI doesn't update | WebSocket adapter not bound to Redis | Backend logs should show `Socket.IO Redis adapter ready`; if missing, check Redis is up |

---

## Test credentials

All seeded users share password: `bumperbid123`

| Email | Role | Use for |
|---|---|---|
| `admin@bumperbid.test` | admin | Admin app login |
| `rohit@bumperbid.test` | user | Bidding |
| `priya@bumperbid.test` | user | Two-tab realtime test |
| `arjun@bumperbid.test` | user | Seller KYC flow |

Phone numbers: `+919000000001` through `+919000000010` (admin = 001).

OTP in dev: provider is `console`, so the OTP code prints in the **backend terminal logs** when you click "Send OTP". Look for a log line like `[OTP] phone=+91... code=123456`.

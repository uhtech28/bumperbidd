# BumperBid — How to Run (Windows / PowerShell)

Everything in this repo is already wired up. What you saw in the browser
(`localhost:3000/dashboard` → `ERR_CONNECTION_REFUSED`) simply means the
**frontend dev server wasn't running** at the time. Backend + frontend are
two separate processes — you need both up.

---

## 1. Prerequisites (one-time)

- **Node.js ≥ 18** — `node -v` to check
- **Docker Desktop** — running (for Postgres + Redis containers)
- **Project installed** — `npm install` already done in both `backend/`
  and `frontend/` (if not, do that once in each folder)

---

## 2. Start Postgres + Redis

Open PowerShell:

```powershell
cd C:\Users\utkar\OneDrive\Desktop\BumperBid\bumperbid
docker compose up -d postgres redis
```

Verify both are healthy:

```powershell
docker ps
```

You should see two containers (`bumperbid-postgres`, `bumperbid-redis`)
both in `Up` status.

---

## 3. Start the backend (terminal 1)

```powershell
cd C:\Users\utkar\OneDrive\Desktop\BumperBid\bumperbid\backend
npx prisma generate
npx prisma migrate deploy
npm run start:dev
```

Wait until you see:

```
[Nest] BumperBid API ready on :4000/api/v1 [env=development]
```

Leave this terminal running.

---

## 4. Start the frontend (terminal 2 — new PowerShell window)

```powershell
cd C:\Users\utkar\OneDrive\Desktop\BumperBid\bumperbid\frontend
npm run dev
```

Wait until you see:

```
▲ Next.js 14.1.0
- Local:        http://localhost:3000
✓ Ready in ...
```

Leave this terminal running too.

---

## 5. Test the flow

1. Open **http://localhost:3000/auth** in your browser
2. Tap the mobile option → enter any Indian mobile number
3. Click **Send OTP**
4. **Look at the backend terminal** — you'll see a line like:
   ```
   [OtpService] DEV OTP for +91XXXXXXXXXX = 123456
   ```
5. Type that 6-digit code on the OTP screen → **Verify & continue**
6. You land on `/dashboard` with the session live

That same flow works for email/password — switch to email mode on the
auth page, sign up with any new email + password (≥ 8 chars, 1 letter,
1 digit), or log in if the account already exists.

---

## Troubleshooting

**`localhost refused to connect` on port 3000**
 → Frontend dev server isn't running. Do step 4.

**`localhost refused to connect` on port 4000**
 → Backend dev server isn't running. Do step 3.

**Backend fails to start with Redis connection error**
 → Docker isn't running, or Redis container crashed. Do step 2.

**Backend starts but `/auth/send-otp` returns 500**
 → Postgres migrations not applied. Run `npx prisma migrate deploy`
   inside `backend/`.

**OTP verify says `OTP_NOT_FOUND` every time**
 → This used to happen when Redis lost the record between set and get.
   It's now fixed — `OtpStoreService` mirrors the OTP in-memory in dev
   so verification still works even if Redis hiccups. If you still see
   it: restart backend, try again, and check the console for
   `OTP saved key=...` logs.

**Port conflict (`EADDRINUSE`)**
 → Another process is on :3000 or :4000. Kill it:
   ```powershell
   Get-Process -Id (Get-NetTCPConnection -LocalPort 4000).OwningProcess | Stop-Process
   ```

---

## What's inside the zip

`bumperbid-platform.zip` at the root of this folder contains:
- Full `backend/` (NestJS + Prisma + Redis + JWT + cookies)
- Full `frontend/` (Next.js 14 App Router + Tailwind + Framer Motion)
- `docker-compose.yml` for Postgres + Redis
- `README.md`, `DEPLOY.md`, `HOW-TO-RUN.md`

**Excluded** (you'll rebuild these on first run):
- `node_modules/` (run `npm install`)
- `.next/`, `dist/` (built on dev start)
- `.env` files (use `.env.example` as a starting point)

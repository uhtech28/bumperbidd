# BumperBid Compliance

India-specific compliance obligations for an online vehicle auction
platform. This is operational documentation for engineers and founders —
**it is not legal advice**. Engage qualified counsel before production
launch.

## 1. Digital Personal Data Protection Act, 2023 (DPDP)

### 1.1 What we collect

- Identity: phone, email, name
- KYC: PAN number (hashed), Aadhaar last-4 (hashed), PAN + Aadhaar
  document images (encrypted at rest via R2 SSE-S3)
- Financial: wallet balance, transaction history, UPI UTR references
- Device/usage: IP, user-agent (redacted in logs), bid history

### 1.2 Lawful basis

- Contract (account + bidding): `User`, `Bid`, `WalletTransaction`
- Legal obligation (KYC): `KycProfile`, `KycDocument`
- Consent (marketing email): tracked in `EmailEvent.consent` - double
  opt-in via `/preferences/email`

### 1.3 Rights implementation

- **Access / export**: `GET /me/export` generates a zipfile + signed URL
  (24h expiry). Implemented by `UsersService.exportMyData()`.
- **Correction**: `PATCH /me/profile` for non-KYC fields; KYC corrections
  require re-verification.
- **Erasure**: `DELETE /me` schedules deletion after 30-day cooling off.
  Financial records retained 7 years per SEBI/RBI guidance; tombstoned
  via `User.deletedAt`.
- **Consent withdrawal**: `PATCH /preferences/email { marketing: false }`
  takes effect on next send (idempotent).

### 1.4 Breach notification

72-hour notification to the Data Protection Board. Playbook lives in
`docs/RUNBOOK.md#security-incident`.

### 1.5 Data Protection Officer

Contact: dpo@bumperbid.in. Posted publicly in privacy policy and in
footer of every page.

## 2. KYC (RBI Master Direction on KYC, 2016 — as amended)

Vehicle auctions with money flowing through a wallet require CKYC for
sellers. Buyers under Rs 2 lakh per year may qualify for Simplified
Measures but we apply full KYC uniformly to reduce risk.

- PAN validated via regex; future: integrate Income Tax e-PAN API
  (`https://eportal.incometax.gov.in`) for authenticity check.
- Aadhaar: only last-4 stored; full number never collected. For offline
  Aadhaar e-KYC use DigiLocker XML (Signify/IDfy vendor). TODO.
- Re-KYC triggers: every 24 months for "low risk" users; 12 months
  for sellers.

## 3. Goods and Services Tax (GST)

- Platform is an **e-commerce operator** under CGST section 2(45).
- TCS @ 1% on "net value of taxable supplies" per section 52 — withheld
  at payout. See `PayoutService.calculateTcs()`.
- Monthly GSTR-8 filing: sellers' GSTINs pulled from KYC; platform
  files on 10th of following month.
- Platform fee (our take rate) is itself taxable supply — IGST 18%.

## 4. Prize Competitions & Lotteries

Vehicle auctions are **not** lotteries if:
- skill determines outcome (highest bidder wins, no chance)
- no payment-for-chance required (wallet topup buys bids only for
  items user has chosen to bid on)

We do not run sweepstakes, giveaways, or bonus credit schemes that
would trigger the Prize Competitions Act, 1955.

## 5. DLT / SMS Compliance (TRAI TCCCPR 2018)

All transactional SMS (OTP, bid outbid, winner notification) must be
sent through a registered DLT header + approved template.

- Header: `BUMPRB` (Principal Entity ID: PE-xxxx, registered with Jio)
- Template IDs stored in env:
  - `DLT_TEMPLATE_OTP=1001...`
  - `DLT_TEMPLATE_OUTBID=1002...`
  - `DLT_TEMPLATE_WINNER=1003...`
- Any copy change to a template requires re-approval (3-5 business
  days). Plan for this in marketing calendars.
- Promotional SMS blocked entirely in our product — marketing goes
  via email only.

## 6. Consumer protection

- Terms of Service: `/terms` — covers bid binding, winner obligations,
  seller warranties, arbitration (seat: Mumbai, exclusive jurisdiction).
- Refund policy: `/refund-policy` — automatic refund of held funds on
  outbid/auction-cancel; manual review for disputes.
- Grievance officer details in footer (Consumer Protection
  (E-Commerce) Rules, 2020).
- Return/replacement not applicable (used vehicles sold as-is), but
  "significant undisclosed defect" triggers 7-day dispute window.

## 7. IT Rules 2021 (intermediary guidelines)

- Grievance mechanism: complaints resolved within 15 days; acknowledged
  within 24 hours.
- User-generated content (vehicle listings, images) moderated:
  - Pre-publish: AWS Rekognition `DetectModerationLabels`
  - Post-publish: manual review queue for reports
- Preserve user records for 180 days after account termination.

## 8. Payment regulation

- We are **not** a Payment Aggregator (we do not intermediate money
  between parties in real time).
- Wallet balances are pre-paid credit tokens; not Prepaid Payment
  Instruments (PPI) because:
  - Not loadable > Rs 10k without KYC
  - Cannot be used to pay any third-party merchant
  - Redeemable only against bids on our platform
- Payout to winning seller via bank transfer after settlement is a
  P2P bank transfer — not a payment service.

Talk to counsel if you plan to add: UPI collect, payouts to buyers
who didn't win (would trigger PA rules), or a public wallet-to-wallet
transfer feature.

## 9. Audit log retention

All admin actions logged to `AdminAuditLog` with:
- `adminId`, `action`, `targetType`, `targetId`
- `diff` JSONB snapshot of before/after
- `ip`, `userAgent`
- Retained 7 years (financial records standard)

Tamper-evident: future - append-only MongoDB/DynamoDB with periodic
Merkle root commits to Postgres.

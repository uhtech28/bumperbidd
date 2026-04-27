'use client';

/**
 * Wallet top-up via QR + UTR.
 *
 * Flow:
 *  1. Fetch /payments/instructions -> shows platform UPI ID + static QR image.
 *  2. User pays externally via any UPI app; they receive a UTR reference.
 *  3. User uploads the payment screenshot to R2 via presigned PUT URL
 *     (also runs Rekognition moderation on confirm).
 *  4. User enters amount + UTR + submits -> backend creates PaymentProof (pending).
 *  5. Admin reviews in /admin/payments and approves/rejects.
 *  6. On approve, wallet is credited with idempotency key proof-${proofId}.
 *
 * No Razorpay / no auto-capture - this is a manual review pipeline by design.
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  paymentsApi,
  uploadsApi,
  ApiError,
  type PaymentInstructions,
  type PaymentProof,
} from '../../../lib/api';
import { formatINR } from '../../../lib/format';

export default function TopupPage() {
  const [instr, setInstr] = useState<PaymentInstructions | null>(null);
  const [amount, setAmount] = useState<string>('500');
  const [utr, setUtr] = useState<string>('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [proofs, setProofs] = useState<PaymentProof[]>([]);
  const [success, setSuccess] = useState<string | null>(null);

  async function refresh() {
    try {
      const [inst, mine] = await Promise.all([paymentsApi.instructions(), paymentsApi.myProofs()]);
      setInstr(inst);
      setProofs(mine.items);
    } catch (e) {
      setErr((e as ApiError).message);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function submit() {
    setErr(null);
    setSuccess(null);
    // The input is in rupees; the backend wants paisa.
    const amtRupees = Number(amount);
    const minRupees = Math.round((instr?.minAmount ?? 10_000) / 100);
    if (!Number.isFinite(amtRupees) || amtRupees < minRupees) {
      setErr(`Minimum top-up is ${formatINR(minRupees)}.`);
      return;
    }
    const amtPaisa = Math.round(amtRupees * 100);
    if (!/^[A-Za-z0-9]{6,30}$/.test(utr.trim())) {
      setErr('UTR must be 6-30 alphanumeric characters.');
      return;
    }
    if (!file) {
      setErr('Please attach the payment screenshot.');
      return;
    }
    if (!/^image\/(png|jpe?g|webp)$/.test(file.type)) {
      setErr('Screenshot must be PNG, JPEG or WebP.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setErr('Screenshot must be under 5MB.');
      return;
    }

    setBusy(true);
    try {
      const p = await uploadsApi.presign(file.type, file.size, 'payment_proof');
      const putRes = await fetch(p.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      });
      if (!putRes.ok) throw new Error('Upload to storage failed.');
      await uploadsApi.confirm(p.key, file.type, file.size);

      const proof = await paymentsApi.createProof({
        amount: amtPaisa,
        utrReference: utr.trim().toUpperCase(),
        fileKey: p.key,
      });
      setProofs((prev) => [proof, ...prev]);
      setAmount('500');
      setUtr('');
      setFile(null);
      setSuccess('Submitted. Our team will review it shortly (usually within 1 business hour).');
    } catch (e) {
      setErr((e as ApiError).message ?? 'Submission failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6">
        <Link href="/wallet" className="text-sm text-blue-600 hover:underline">
          &larr; Back to wallet
        </Link>
        <h1 className="mt-2 text-3xl font-bold">Top up via UPI / QR</h1>
        <p className="text-sm text-neutral-500">
          Pay via any UPI app, then submit the UTR and screenshot. We credit your wallet after
          verification.
        </p>
      </div>

      {err && (
        <div className="mb-4 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">{err}</div>
      )}
      {success && (
        <div className="mb-4 rounded border border-green-300 bg-green-50 p-3 text-sm text-green-700">
          {success}
        </div>
      )}

      {!instr ? (
        <p className="text-sm text-neutral-500">Loading instructions...</p>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          <div className="rounded-lg border border-neutral-200 bg-white p-5">
            <h2 className="text-lg font-semibold">Step 1 - Pay</h2>
            <div className="mt-4 flex flex-col items-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={instr.qrImageUrl}
                alt="Payment QR"
                className="h-56 w-56 rounded border border-neutral-200 object-contain"
              />
              <p className="mt-3 text-sm font-medium">{instr.payeeName}</p>
              <p className="select-all rounded bg-neutral-100 px-3 py-1 text-sm font-mono">
                {instr.upiId}
              </p>
              <p className="mt-2 text-xs text-neutral-500">
                Minimum top-up: {formatINR(Math.round(instr.minAmount / 100))}
              </p>
            </div>
            <ol className="mt-5 list-inside list-decimal space-y-1 text-xs text-neutral-600">
              {instr.steps.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ol>
          </div>

          <div className="rounded-lg border border-neutral-200 bg-white p-5">
            <h2 className="text-lg font-semibold">Step 2 - Submit proof</h2>
            <div className="mt-4 space-y-3">
              <div>
                <label className="mb-1 block text-sm font-medium">
                  Amount paid (rupees)
                </label>
                <input
                  type="number"
                  min={Math.round(instr.minAmount / 100)}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full rounded border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 placeholder-neutral-400"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">UTR reference</label>
                <input
                  type="text"
                  value={utr}
                  onChange={(e) => setUtr(e.target.value)}
                  placeholder="e.g. 412209876543"
                  className="w-full rounded border border-neutral-300 bg-white px-3 py-2 font-mono text-sm uppercase text-neutral-900 placeholder-neutral-400"
                />
                <p className="mt-1 text-xs text-neutral-500">
                  Find this in your UPI app transaction details. 6-30 characters.
                </p>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Payment screenshot</label>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  className="w-full text-sm"
                />
                <p className="mt-1 text-xs text-neutral-500">
                  PNG / JPEG / WebP, under 5MB. We scan for inappropriate content.
                </p>
              </div>

              <button
                onClick={submit}
                disabled={busy}
                className="w-full rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {busy ? 'Submitting...' : 'Submit for review'}
              </button>
              <p className="text-center text-[11px] text-neutral-500">
                Funds are credited after verification (usually 15-60 minutes during business hours).
              </p>
            </div>
          </div>
        </div>
      )}

      {/* History */}
      <div className="mt-10">
        <h2 className="mb-3 text-xl font-semibold">Your submissions</h2>
        {proofs.length === 0 ? (
          <p className="text-sm text-neutral-500">No submissions yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
            <table className="min-w-full text-sm">
              <thead className="bg-neutral-50 text-xs uppercase text-neutral-500">
                <tr>
                  <th className="px-4 py-2 text-left">Date</th>
                  <th className="px-4 py-2 text-left">Amount</th>
                  <th className="px-4 py-2 text-left">UTR</th>
                  <th className="px-4 py-2 text-left">Status</th>
                  <th className="px-4 py-2 text-left">Note</th>
                </tr>
              </thead>
              <tbody>
                {proofs.map((p) => (
                  <tr key={p.id} className="border-t border-neutral-100">
                    <td className="px-4 py-2 text-xs text-neutral-500">
                      {new Date(p.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-2">{formatINR(Math.round(p.amount / 100))}</td>
                    <td className="px-4 py-2 font-mono text-xs">{p.utr}</td>
                    <td className="px-4 py-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${
                          p.status === 'approved'
                            ? 'bg-green-100 text-green-700'
                            : p.status === 'rejected'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-yellow-100 text-yellow-700'
                        }`}
                      >
                        {p.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-xs text-neutral-500">{p.reason ?? '-'}</td>
                  </tr>
                ))}
                 </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

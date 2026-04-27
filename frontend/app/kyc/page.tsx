'use client';

/**
 * KYC page - PAN + Aadhaar last-4 + address + document uploads.
 * Backend enforces PAN regex + pincode regex server-side; client mirrors it
 * to give fast feedback. After submission, state goes pending -> approved/rejected.
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { kycApi, uploadsApi, ApiError } from '../../lib/api';

const PAN_RE = /^[A-Z]{5}\d{4}[A-Z]$/;
const PIN_RE = /^\d{6}$/;
const AAD4_RE = /^\d{4}$/;

export default function KycPage() {
  const [status, setStatus] = useState<{ status: string; rejectionReason: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [form, setForm] = useState({
    fullName: '',
    panNumber: '',
    aadhaarLast4: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    pincode: '',
  });
  const [panFile, setPanFile] = useState<File | null>(null);
  const [aadhaarFile, setAadhaarFile] = useState<File | null>(null);

  useEffect(() => {
    kycApi
      .status()
      .then((s) => setStatus(s))
      .catch((e: ApiError) => setErr(e.message))
      .finally(() => setLoading(false));
  }, []);

  function setField<K extends keyof typeof form>(k: K, v: string) {
    setForm({ ...form, [k]: v });
  }

  // Returns the bits the SubmitKycDto needs for one document.
  async function uploadOne(
    file: File,
  ): Promise<{ fileKey: string; mimeType: string; sizeBytes: number }> {
    if (!/^image\/(png|jpe?g|webp)$|^application\/pdf$/.test(file.type)) {
      throw new Error('Document must be PNG, JPEG, WebP or PDF.');
    }
    if (file.size > 5 * 1024 * 1024) throw new Error('Document must be under 5MB.');
    const p = await uploadsApi.presign(file.type, file.size, 'kyc_doc');
    const r = await fetch(p.uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': file.type },
      body: file,
    });
    if (!r.ok) throw new Error('Upload failed.');
    await uploadsApi.confirm(p.key, file.type, file.size);
    return { fileKey: p.key, mimeType: file.type, sizeBytes: file.size };
  }

  async function submit() {
    setErr(null);
    setSuccess(null);

    if (!form.fullName.trim()) return setErr('Enter full name.');
    if (!PAN_RE.test(form.panNumber)) return setErr('PAN must match format AAAAA9999A.');
    if (!AAD4_RE.test(form.aadhaarLast4)) return setErr('Enter last 4 digits of Aadhaar.');
    if (!PIN_RE.test(form.pincode)) return setErr('Pincode must be 6 digits.');
    if (!panFile) return setErr('Upload PAN document.');
    if (!aadhaarFile) return setErr('Upload Aadhaar document.');

    setBusy(true);
    try {
      const [pan, aadhaar] = await Promise.all([
        uploadOne(panFile),
        uploadOne(aadhaarFile),
      ]);
      await kycApi.submit({
        fullName: form.fullName.trim(),
        panNumber: form.panNumber.toUpperCase(),
        aadhaarLast4: form.aadhaarLast4,
        addressLine1: form.addressLine1.trim(),
        addressLine2: form.addressLine2.trim() || undefined,
        city: form.city.trim(),
        state: form.state.trim(),
        pincode: form.pincode,
        documentKeys: [
          { docType: 'pan', ...pan },
          { docType: 'aadhaar', ...aadhaar },
        ],
      });
      setStatus({ status: 'pending', rejectionReason: null });
      setSuccess('KYC submitted. We will review it within 24 hours.');
    } catch (e) {
      setErr((e as ApiError).message ?? 'Submission failed.');
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p className="p-8 text-sm text-neutral-500">Loading...</p>;

  const isApproved = status?.status === 'approved';
  const isPending = status?.status === 'pending';
  const isRejected = status?.status === 'rejected';

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-1 text-3xl font-bold">KYC verification</h1>
      <p className="mb-6 text-sm text-neutral-500">
        Required to list vehicles. Your data is encrypted at rest and only used for verification.
      </p>

      {isApproved && (
        <div className="mb-6 rounded border border-green-300 bg-green-50 p-4 text-sm text-green-700">
          You are verified. You can now list vehicles at{' '}
          <Link href="/seller" className="font-medium underline">
            Seller dashboard
          </Link>
          .
        </div>
      )}
      {isPending && (
        <div className="mb-6 rounded border border-yellow-300 bg-yellow-50 p-4 text-sm text-yellow-800">
          Your KYC is under review. You will be notified by email when it is approved.
        </div>
      )}
      {isRejected && (
        <div className="mb-6 rounded border border-red-300 bg-red-50 p-4 text-sm text-red-700">
          Your previous submission was rejected. Reason: {status?.rejectionReason ?? 'Not specified'}.
          Please resubmit below.
        </div>
      )}
      {err && (
        <div className="mb-4 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">{err}</div>
      )}
      {success && (
        <div className="mb-4 rounded border border-green-300 bg-green-50 p-3 text-sm text-green-700">
          {success}
        </div>
      )}

      {!isApproved && !isPending && (
        <div className="space-y-4 rounded-lg border border-neutral-200 bg-white p-6">
          <Input label="Full name (as on PAN)" value={form.fullName} onChange={(v) => setField('fullName', v)} />
          <Input
            label="PAN number"
            value={form.panNumber}
            onChange={(v) => setField('panNumber', v.toUpperCase())}
            placeholder="AAAAA9999A"
            mono
          />
          <Input
            label="Aadhaar last 4 digits"
            value={form.aadhaarLast4}
            onChange={(v) => setField('aadhaarLast4', v.replace(/\D/g, '').slice(0, 4))}
            placeholder="1234"
            mono
          />
          <Input label="Address line 1" value={form.addressLine1} onChange={(v) => setField('addressLine1', v)} />
          <Input label="Address line 2" value={form.addressLine2} onChange={(v) => setField('addressLine2', v)} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="City" value={form.city} onChange={(v) => setField('city', v)} />
            <Input label="State" value={form.state} onChange={(v) => setField('state', v)} />
          </div>
          <Input
            label="Pincode"
            value={form.pincode}
            onChange={(v) => setField('pincode', v.replace(/\D/g, '').slice(0, 6))}
            mono
          />

          <div>
            <label className="mb-1 block text-sm font-medium">PAN document (image/PDF)</label>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,application/pdf"
              onChange={(e) => setPanFile(e.target.files?.[0] ?? null)}
              className="text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Aadhaar document (image/PDF)</label>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,application/pdf"
              onChange={(e) => setAadhaarFile(e.target.files?.[0] ?? null)}
              className="text-sm"
            />
          </div>

          <button
            onClick={submit}
            disabled={busy}
            className="mt-2 w-full rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {busy ? 'Submitting...' : 'Submit KYC'}
          </button>
        </div>
      )}
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  placeholder,
  mono,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  mono?: boolean;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-neutral-700">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full rounded border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 placeholder-neutral-400 ${
                mono ? 'font-mono' : ''
        }`}
      />
    </div>
  );
}

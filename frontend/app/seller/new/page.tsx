'use client';

/**
 * Seller -> New auction.
 *
 * Posts to POST /auctions, the same endpoint the admin form hits — but
 * seller-side we run the actual image upload (presigned PUT + confirm)
 * since sellers don't have S3/R2 keys to paste.
 *
 * Uploaded image keys are turned into public URLs the backend then keeps
 * on the auction record. KYC is enforced by the backend RolesGuard, so
 * a non-seller submitting here gets a 403 we surface inline.
 */
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  auctionsApi,
  uploadsApi,
  ApiError,
} from '../../../lib/api';

type FuelType = 'petrol' | 'diesel' | 'ev' | 'cng' | 'hybrid';
const FUELS: FuelType[] = ['petrol', 'diesel', 'ev', 'cng', 'hybrid'];

interface UploadedImage {
  key: string;
  publicUrl: string;
  previewUrl: string;
  uploading: boolean;
  error?: string;
}

const isoLocalNow = (offsetMinutes = 0): string => {
  const d = new Date(Date.now() + offsetMinutes * 60_000);
  d.setSeconds(0, 0);
  const tz = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 16);
};

export default function SellerNewAuctionPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [make, setMake] = useState('');
  const [modelName, setModelName] = useState('');
  const [year, setYear] = useState<string>(String(new Date().getFullYear() - 2));
  const [kmDriven, setKmDriven] = useState<string>('');
  const [fuelType, setFuelType] = useState<FuelType>('petrol');
  const [city, setCity] = useState('');

  // Prices in rupees in the UI; converted to paisa on submit.
  const [startingRs, setStartingRs] = useState<string>('');
  const [minIncRs, setMinIncRs] = useState<string>('500');
  const [reserveRs, setReserveRs] = useState<string>('');
  const [startsAt, setStartsAt] = useState(isoLocalNow(15));
  const [endsAt, setEndsAt] = useState(isoLocalNow(60 * 24 + 15));

  const [images, setImages] = useState<UploadedImage[]>([]);

  async function handleFiles(files: FileList | null) {
    if (!files) return;
    const slots = Math.min(files.length, 10 - images.length);
    if (slots <= 0) return;

    const fresh: UploadedImage[] = [];
    for (let i = 0; i < slots; i++) {
      const f = files[i];
      if (!/^image\/(png|jpe?g|webp)$/.test(f.type)) continue;
      if (f.size > 5 * 1024 * 1024) continue;
      fresh.push({
        key: '',
        publicUrl: '',
        previewUrl: URL.createObjectURL(f),
        uploading: true,
      });
    }
    setImages((prev) => [...prev, ...fresh]);

    // Upload each in parallel; update slot-by-slot as they complete.
    await Promise.all(
      fresh.map(async (placeholder, idx) => {
        const file = files[idx];
        try {
          const p = await uploadsApi.presign(file.type, file.size, 'auction_image');
          const put = await fetch(p.uploadUrl, {
            method: 'PUT',
            headers: { 'Content-Type': file.type },
            body: file,
          });
          if (!put.ok) throw new Error('Upload failed.');
          await uploadsApi.confirm(p.key, file.type, file.size);
          setImages((prev) =>
            prev.map((x) =>
              x.previewUrl === placeholder.previewUrl
                ? { ...x, key: p.key, publicUrl: p.publicUrl, uploading: false }
                : x,
            ),
          );
        } catch (e) {
          setImages((prev) =>
            prev.map((x) =>
              x.previewUrl === placeholder.previewUrl
                ? { ...x, uploading: false, error: (e as Error).message }
                : x,
            ),
          );
        }
      }),
    );
  }

  function removeImage(previewUrl: string) {
    setImages((prev) => prev.filter((x) => x.previewUrl !== previewUrl));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const ready = images.filter((i) => !i.uploading && !i.error && i.publicUrl);
    if (ready.length === 0) {
      setError('Add at least one image and wait for it to finish uploading.');
      return;
    }
    const startingPaisa = Math.round(Number(startingRs) * 100);
    if (!startingPaisa || startingPaisa < 10_000) {
      setError('Starting price must be at least ₹100.');
      return;
    }

    setSubmitting(true);
    try {
      const created = await auctionsApi.create({
        title: title.trim(),
        description: description.trim(),
        make: make.trim(),
        modelName: modelName.trim(),
        year: Number(year),
        kmDriven: Number(kmDriven),
        fuelType,
        city: city.trim(),
        imageUrls: ready.map((i) => i.publicUrl),
        startingPrice: startingPaisa,
        minIncrement: minIncRs ? Math.round(Number(minIncRs) * 100) : undefined,
        reservePrice: reserveRs ? Math.round(Number(reserveRs) * 100) : undefined,
        startsAt: new Date(startsAt).toISOString(),
        endsAt: new Date(endsAt).toISOString(),
      });
      router.push(`/auctions/${created.id}`);
    } catch (err) {
      const e = err as ApiError;
      if (e.status === 403 || e.code === 'NOT_SELLER') {
        setError(
          'Your account is not a verified seller yet. Please complete KYC before listing.',
        );
      } else {
        setError(e.message ?? 'Failed to create auction.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6">
        <Link href="/seller" className="text-sm text-blue-600 hover:underline">
          &larr; Back to seller dashboard
        </Link>
        <h1 className="mt-2 text-3xl font-bold">List a vehicle</h1>
        <p className="text-sm text-neutral-500">
          Bidders see the title, photos, and details exactly as you enter them.
          You can&rsquo;t edit a live auction once it starts.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-5 rounded-xl border border-neutral-200 bg-white p-6"
      >
        <Field label="Title">
          <input
            required
            minLength={4}
            maxLength={120}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="2022 Honda City ZX iVTEC"
            className={inputCls}
          />
        </Field>

        <Field label="Description" hint="At least 10 characters. Tell buyers what they need to know.">
          <textarea
            required
            minLength={10}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            placeholder="Single-owner, full service history, all paperwork clear, accident-free."
            className={inputCls}
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Make">
            <input
              required
              value={make}
              onChange={(e) => setMake(e.target.value)}
              placeholder="Honda"
              className={inputCls}
            />
          </Field>
          <Field label="Model">
            <input
              required
              value={modelName}
              onChange={(e) => setModelName(e.target.value)}
              placeholder="City"
              className={inputCls}
            />
          </Field>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <Field label="Year">
            <input
              required
              type="number"
              min={1950}
              max={2100}
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="KM driven">
            <input
              required
              type="number"
              min={0}
              value={kmDriven}
              onChange={(e) => setKmDriven(e.target.value)}
              placeholder="32000"
              className={inputCls}
            />
          </Field>
          <Field label="City">
            <input
              required
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Bengaluru"
              className={inputCls}
            />
          </Field>
        </div>

        <Field label="Fuel">
          <select
            value={fuelType}
            onChange={(e) => setFuelType(e.target.value as FuelType)}
            className={inputCls}
          >
            {FUELS.map((f) => (
              <option key={f} value={f}>
                {f.toUpperCase()}
              </option>
            ))}
          </select>
        </Field>

        <Field
          label="Photos"
          hint={`PNG / JPEG / WebP, up to 5MB each. Maximum 10 photos. ${10 - images.length} slot${10 - images.length === 1 ? '' : 's'} left.`}
        >
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            multiple
            onChange={(e) => handleFiles(e.target.files)}
            className="text-sm text-neutral-700"
            disabled={images.length >= 10}
          />
          {images.length > 0 && (
            <div className="mt-3 grid grid-cols-4 gap-3">
              {images.map((img) => (
                <div
                  key={img.previewUrl}
                  className="relative overflow-hidden rounded-lg border border-neutral-200 bg-neutral-50"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.previewUrl} alt="" className="h-24 w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removeImage(img.previewUrl)}
                    className="absolute right-1 top-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] text-white"
                  >
                    Remove
                  </button>
                  {img.uploading && (
                    <div className="absolute inset-0 grid place-items-center bg-black/40 text-[11px] text-white">
                      Uploading…
                    </div>
                  )}
                  {img.error && (
                    <div className="absolute inset-0 grid place-items-center bg-red-700/70 text-[10px] text-white">
                      Failed
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Field>

        <div className="grid grid-cols-3 gap-4">
          <Field label="Starting price (₹)">
            <input
              required
              type="number"
              min={100}
              step={1}
              value={startingRs}
              onChange={(e) => setStartingRs(e.target.value)}
              placeholder="850000"
              className={inputCls}
            />
          </Field>
          <Field label="Min increment (₹)">
            <input
              type="number"
              min={1}
              step={1}
              value={minIncRs}
              onChange={(e) => setMinIncRs(e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="Reserve (₹)" hint="Optional. Hidden from bidders.">
            <input
              type="number"
              min={0}
              step={1}
              value={reserveRs}
              onChange={(e) => setReserveRs(e.target.value)}
              className={inputCls}
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Starts at">
            <input
              required
              type="datetime-local"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="Ends at">
            <input
              required
              type="datetime-local"
              value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
              className={inputCls}
            />
          </Field>
        </div>

        {error && (
          <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
            {error.includes('KYC') && (
              <>
                {' '}
                <Link href="/kyc" className="font-medium underline">
                  Complete KYC
                </Link>
                .
              </>
            )}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={() => router.push('/seller')}
            className="rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting || images.some((i) => i.uploading)}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? 'Creating...' : 'Create auction'}
          </button>
        </div>
      </form>
    </main>
  );
}

const inputCls =
  'w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-400/60';

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-neutral-700">
        {label}
      </span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-neutral-500">{hint}</span>}
    </label>
  );
}

'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { auctionsApi, type CreateAuctionPayload } from '@/lib/api';

/**
 * Admin -> Create Auction.
 *
 * The form takes rupees in the price inputs (more humane) and converts
 * to paisa on submit because the backend stores money as integer paisa.
 *
 * Image URLs are entered as a comma-separated list - we don't run an
 * uploader here; admins paste S3/R2 URLs they already have.
 */
type FuelType = CreateAuctionPayload['fuelType'];

const FUEL_TYPES: FuelType[] = ['petrol', 'diesel', 'ev', 'cng', 'hybrid'];

const isoLocalNow = (offsetMinutes = 0): string => {
  const d = new Date(Date.now() + offsetMinutes * 60_000);
  // Strip seconds/ms so the value is parseable by datetime-local input.
  d.setSeconds(0, 0);
  const tz = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 16);
};

export default function NewAuctionPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state. Strings for inputs; converted at submit time.
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [make, setMake] = useState('');
  const [modelName, setModelName] = useState('');
  const [year, setYear] = useState<string>(String(new Date().getFullYear() - 2));
  const [kmDriven, setKmDriven] = useState<string>('');
  const [fuelType, setFuelType] = useState<FuelType>('petrol');
  const [ownerCount, setOwnerCount] = useState<string>('1');
  const [city, setCity] = useState('');
  const [imageUrls, setImageUrls] = useState('');
  // Prices entered as rupees in the UI; converted to paisa on submit.
  const [startingPriceRs, setStartingPriceRs] = useState<string>('');
  const [minIncrementRs, setMinIncrementRs] = useState<string>('500');
  const [reservePriceRs, setReservePriceRs] = useState<string>('');
  const [startsAt, setStartsAt] = useState(isoLocalNow(15));
  const [endsAt, setEndsAt] = useState(isoLocalNow(60 * 24 + 15));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const urls = imageUrls
      .split(',')
      .map((u) => u.trim())
      .filter(Boolean);

    if (urls.length === 0) {
      setError('Add at least one image URL.');
      return;
    }

    const startingPaisa = Math.round(Number(startingPriceRs) * 100);
    if (!startingPaisa || startingPaisa < 10_000) {
      setError('Starting price must be at least Rs 100.');
      return;
    }

    const payload: CreateAuctionPayload = {
      title: title.trim(),
      description: description.trim(),
      make: make.trim(),
      modelName: modelName.trim(),
      year: Number(year),
      kmDriven: Number(kmDriven),
      fuelType,
      ownerCount: ownerCount ? Number(ownerCount) : undefined,
      city: city.trim(),
      imageUrls: urls,
      startingPrice: startingPaisa,
      minIncrement: minIncrementRs
        ? Math.round(Number(minIncrementRs) * 100)
        : undefined,
      reservePrice: reservePriceRs
        ? Math.round(Number(reservePriceRs) * 100)
        : undefined,
      startsAt: new Date(startsAt).toISOString(),
      endsAt: new Date(endsAt).toISOString(),
    };

    setSubmitting(true);
    try {
      const res: any = await auctionsApi.create(payload);
      const id = res?.data?.id ?? res?.id;
      router.push(id ? `/auctions` : '/auctions');
    } catch (err: any) {
      setError(err?.message ?? 'Failed to create auction.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold mb-1">Create Auction</h1>
      <p className="text-sm text-slate-600 mb-6">
        Posts a new auction as the signed-in admin. Money fields use rupees;
        we convert to paisa for the backend.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4 bg-white border border-slate-200 rounded-xl p-6">
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

        <Field label="Description">
          <textarea
            required
            minLength={10}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="Single-owner, full service history, all paperwork clear."
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
          <Field label="Owners">
            <input
              type="number"
              min={1}
              max={10}
              value={ownerCount}
              onChange={(e) => setOwnerCount(e.target.value)}
              className={inputCls}
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Fuel">
            <select
              value={fuelType}
              onChange={(e) => setFuelType(e.target.value as FuelType)}
              className={inputCls}
            >
              {FUEL_TYPES.map((f) => (
                <option key={f} value={f}>
                  {f.toUpperCase()}
                </option>
              ))}
            </select>
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

        <Field
          label="Image URLs"
          hint="Comma-separated. Up to 10. Use already-hosted URLs (S3/R2/CDN)."
        >
          <textarea
            required
            value={imageUrls}
            onChange={(e) => setImageUrls(e.target.value)}
            rows={2}
            placeholder="https://uploads.bumperbid.in/foo-1.jpg, https://uploads.bumperbid.in/foo-2.jpg"
            className={inputCls}
          />
        </Field>

        <div className="grid grid-cols-3 gap-4">
          <Field label="Starting price (Rs)">
            <input
              required
              type="number"
              min={100}
              step={1}
              value={startingPriceRs}
              onChange={(e) => setStartingPriceRs(e.target.value)}
              placeholder="850000"
              className={inputCls}
            />
          </Field>
          <Field label="Min increment (Rs)">
            <input
              type="number"
              min={1}
              step={1}
              value={minIncrementRs}
              onChange={(e) => setMinIncrementRs(e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="Reserve (Rs)" hint="Optional. Hidden from bidders.">
            <input
              type="number"
              min={0}
              step={1}
              value={reservePriceRs}
              onChange={(e) => setReservePriceRs(e.target.value)}
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
          <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={() => router.push('/auctions')}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-ink px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {submitting ? 'Creating\u2026' : 'Create auction'}
          </button>
        </div>
      </form>
    </div>
  );
}

const inputCls =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/60';

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
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600">
        {label}
      </span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-slate-500">{hint}</span>}
    </label>
  );
}

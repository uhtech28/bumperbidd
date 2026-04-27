'use client';

/**
 * ProxyBidWidget - lets a user set an automatic bidding ceiling.
 * Backend cascade logic lives in proxybid.service.nextProxyForAuction() and
 * is triggered by the bidding engine whenever the high-bid advances.
 *
 * Rules surfaced to the user:
 *  - maxAmount must be >= current high + minIncrement
 *  - canceling sets active=false; future cascades will ignore this row
 */
import { useEffect, useState } from 'react';
import { proxyBidApi, ApiError } from '../../lib/api';
import { formatINR } from '../../lib/format';

interface Props {
  auctionId: string;
  /** paisa */
  currentHigh: number;
  /** paisa */
  minIncrement: number;
  disabled?: boolean;
}

// Backend stores everything as integer paisa; the widget speaks rupees
// to the user and converts at every boundary.
const paisaToRupees = (n: number) => Math.round(n / 100);
const rupeesToPaisa = (n: number) => Math.round(n * 100);

export default function ProxyBidWidget({ auctionId, currentHigh, minIncrement, disabled }: Props) {
  const [maxAmount, setMaxAmount] = useState<string>('');
  const [current, setCurrent] = useState<{ maxAmount: number | null; active: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function refresh() {
    try {
      const c = await proxyBidApi.get(auctionId);
      setCurrent(c);
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auctionId]);

  const currentHighRs = paisaToRupees(currentHigh);
  const minIncrementRs = paisaToRupees(minIncrement);
  const minMaxRs = currentHighRs + minIncrementRs;

  async function save() {
    setErr(null);
    setMsg(null);
    const rupees = Number(maxAmount);
    if (!Number.isFinite(rupees) || rupees <= 0) return setErr('Enter a valid amount.');
    if (rupees < minMaxRs)
      return setErr(`Your ceiling must be at least ${formatINR(minMaxRs)} (current high + increment).`);

    setBusy(true);
    try {
      // Backend wants paisa.
      await proxyBidApi.set(auctionId, rupeesToPaisa(rupees));
      setMsg(`Proxy ceiling set to ${formatINR(rupees)}. We will auto-bid for you up to this amount.`);
      setMaxAmount('');
      refresh();
    } catch (e) {
      setErr((e as ApiError).message);
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    setBusy(true);
    try {
      await proxyBidApi.cancel(auctionId);
      setMsg('Proxy cancelled.');
      refresh();
    } catch (e) {
      setErr((e as ApiError).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
      <h3 className="text-sm font-semibold text-neutral-800">Auto-bid (proxy)</h3>
      <p className="mt-1 text-xs text-neutral-500">
        Set the highest you are willing to pay. We will raise your bid by the minimum increment
        whenever you are outbid, up to your ceiling.
      </p>

      {current && current.maxAmount && current.active && (
        <div className="mt-3 rounded border border-blue-200 bg-blue-50 p-2 text-xs text-blue-800">
          Your ceiling: {formatINR(paisaToRupees(current.maxAmount))}.{' '}
          <button onClick={cancel} disabled={busy} className="underline hover:no-underline">
            Cancel
          </button>
        </div>
      )}

      <div className="mt-3 flex gap-2">
        <input
          type="number"
          min={minMaxRs}
          value={maxAmount}
          onChange={(e) => setMaxAmount(e.target.value)}
          placeholder={`Min ${formatINR(minMaxRs)}`}
          disabled={disabled || busy}
          className="flex-1 rounded border border-neutral-300 px-3 py-2 text-sm"
        />
        <button
          onClick={save}
          disabled={disabled || busy}
          className="rounded bg-neutral-800 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-900 disabled:opacity-50"
        >
          {busy ? '...' : 'Set'}
        </button>
      </div>

      {err && <p className="mt-2 text-xs text-red-600">{err}</p>}
      {msg && <p className="mt-2 text-xs text-green-700">{msg}</p>}
    </div>
  );
}

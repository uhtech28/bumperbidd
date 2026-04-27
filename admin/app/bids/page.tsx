'use client';
import useSWR from 'swr';
import { useState } from 'react';
import { adminApi } from '@/lib/api';
export default function BidsPage() {
  const [auctionId, setAuctionId] = useState('');
  const { data } = useSWR(['admin:bids', auctionId], () => adminApi.bids(auctionId ? { auctionId } : {}));
  const { data: sus } = useSWR(auctionId ? ['admin:sus', auctionId] : null, () => adminApi.suspicious(auctionId));
  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Bids</h1>
      <input value={auctionId} onChange={(e) => setAuctionId(e.target.value)} placeholder="Filter by auction ID" className="border px-3 py-2 rounded w-96 mb-4" />
      {sus && (
        <div className="bg-amber-50 border border-amber-300 rounded p-3 mb-4 text-sm">
          <div className="font-semibold">Suspicious patterns: {(sus as any).flags?.length ?? 0}</div>
          <pre className="text-xs">{JSON.stringify((sus as any).flags, null, 2)}</pre>
        </div>
      )}
      <table className="w-full bg-white rounded-xl border border-slate-200 text-sm">
        <thead className="text-xs uppercase bg-slate-100"><tr><th className="px-3 py-2 text-left">Placed</th><th>User</th><th>Auction</th><th>Amount (₹)</th></tr></thead>
        <tbody>
          {(data?.items ?? []).map((b: any) => (
            <tr key={b.id} className="border-t">
              <td className="px-3 py-2">{new Date(b.placedAt).toLocaleString('en-IN')}</td>
              <td>{b.userId.slice(0,8)}</td>
              <td>{b.auctionId.slice(0,8)}</td>
              <td>{(b.amount/100).toLocaleString('en-IN')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

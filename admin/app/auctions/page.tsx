'use client';
import useSWR, { mutate } from 'swr';
import { useState } from 'react';
import { adminApi } from '@/lib/api';

export default function AuctionsPage() {
  const [status, setStatus] = useState<string>('');
  const { data } = useSWR(['admin:auctions', status], () => adminApi.auctions(status ? { status } : {}));
  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Auctions</h1>
      <div className="mb-4 flex gap-2">
        {['', 'live', 'scheduled', 'ended', 'cancelled'].map(s => (
          <button key={s} onClick={() => setStatus(s)} className={`px-3 py-1 rounded ${status===s?'bg-ink text-white':'bg-white border'}`}>{s || 'all'}</button>
        ))}
      </div>
      <table className="w-full bg-white rounded-xl border border-slate-200">
        <thead className="text-xs uppercase bg-slate-100"><tr><th className="px-3 py-2 text-left">Title</th><th className="text-left">Status</th><th className="text-left">Current High (₹)</th><th className="text-left">Ends</th><th></th></tr></thead>
        <tbody>
          {(data?.items ?? []).map((a: any) => (
            <tr key={a.id} className="border-t">
              <td className="px-3 py-2">{a.title}</td>
              <td>{a.status}</td>
              <td>{((a.currentHighBid ?? a.startingPrice) / 100).toLocaleString('en-IN')}</td>
              <td>{new Date(a.endsAt).toLocaleString('en-IN')}</td>
              <td>{a.status !== 'ended' && (
                <button onClick={async () => {
                  const r = prompt('Cancel reason?');
                  if (r) { await adminApi.cancelAuction(a.id, r); mutate(['admin:auctions', status]); }
                }} className="text-red-700">Cancel</button>
              )}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

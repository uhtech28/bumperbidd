'use client';
import useSWR, { mutate } from 'swr';
import { adminApi } from '@/lib/api';

export default function PaymentsPage() {
  const { data } = useSWR('admin:payments:pending', () => adminApi.pendingPayments({}));
  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Payment proofs (pending review)</h1>
      <table className="w-full bg-white rounded-xl border border-slate-200">
        <thead className="text-xs uppercase bg-slate-100"><tr><th className="px-3 py-2 text-left">User</th><th>Amount (₹)</th><th>UTR</th><th>Submitted</th><th></th></tr></thead>
        <tbody>
          {(data?.items ?? []).map((p: any) => (
            <tr key={p.id} className="border-t">
              <td className="px-3 py-2">{p.userId}</td>
              <td>{(p.amount / 100).toLocaleString('en-IN')}</td>
              <td>{p.utrReference ?? '—'}</td>
              <td>{new Date(p.createdAt).toLocaleString('en-IN')}</td>
              <td className="text-right pr-3 space-x-2">
                <button onClick={async () => { await adminApi.approvePayment(p.id); mutate('admin:payments:pending'); }} className="text-green-700">Approve</button>
                <button onClick={async () => {
                  const n = prompt('Rejection reason?');
                  if (n) { await adminApi.rejectPayment(p.id, n); mutate('admin:payments:pending'); }
                }} className="text-red-700">Reject</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

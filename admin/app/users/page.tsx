'use client';
import useSWR, { mutate } from 'swr';
import { useState } from 'react';
import { adminApi } from '@/lib/api';

export default function UsersPage() {
  const [search, setSearch] = useState('');
  const { data } = useSWR(['admin:users', search], () => adminApi.users({ search }), { refreshInterval: 10000 });
  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Users</h1>
      <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by email/phone/name" className="border border-slate-300 rounded px-3 py-2 mb-4 w-80" />
      <table className="w-full bg-white rounded-xl border border-slate-200">
        <thead className="text-xs uppercase bg-slate-100">
          <tr><th className="px-3 py-2 text-left">Email / Phone</th><th className="text-left">Role</th><th className="text-left">Banned</th><th></th></tr>
        </thead>
        <tbody>
          {(data?.items ?? []).map((u: any) => (
            <tr key={u.id} className="border-t">
              <td className="px-3 py-2">{u.email ?? u.phone} <span className="text-slate-500">{u.displayName}</span></td>
              <td>{u.role}</td>
              <td>{u.bannedAt ? 'Yes' : '—'}</td>
              <td className="text-right pr-3">
                {u.bannedAt
                  ? <button onClick={async () => { await adminApi.unbanUser(u.id); mutate(['admin:users', search]); }} className="text-green-700">Unban</button>
                  : <button onClick={async () => {
                      const r = prompt('Ban reason?');
                      if (r) { await adminApi.banUser(u.id, r); mutate(['admin:users', search]); }
                    }} className="text-red-700">Ban</button>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

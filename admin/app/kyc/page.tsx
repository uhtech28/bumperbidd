'use client';
import { adminApi } from '@/lib/api';
export default function KycPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">KYC Review</h1>
      <p className="text-slate-600">KYC submissions appear here. Call GET /admin/kyc (endpoint to be wired to list pending — currently use user filter).</p>
      <p className="text-xs text-slate-500 mt-2">Tip: approve via POST /admin/kyc/:id/approve, reject via POST /admin/kyc/:id/reject with {'{ note }'}.</p>
    </div>
  );
}

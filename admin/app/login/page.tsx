'use client';
import { useState } from 'react';
const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';
export default function Login() {
  const [email, setEmail] = useState('admin@bumperbid.test');
  const [password, setPassword] = useState('bumperbid123');
  const [err, setErr] = useState('');
  async function submit() {
    const res = await fetch(`${BASE}/auth/email-login`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) setErr(`${res.status}: ${await res.text()}`);
    else window.location.href = '/';
  }
  return (
    <div className="min-h-screen grid place-items-center">
      <div className="bg-white rounded-xl border border-slate-200 p-8 w-96">
        <h1 className="text-2xl font-bold mb-6">Admin login</h1>
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="w-full border px-3 py-2 rounded mb-3" />
        <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="Password" className="w-full border px-3 py-2 rounded mb-3" />
        <button onClick={submit} className="w-full bg-ink text-white py-2 rounded">Sign in</button>
        {err && <div className="text-red-600 text-sm mt-3">{err}</div>}
      </div>
    </div>
  );
}

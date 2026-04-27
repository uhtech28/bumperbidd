import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';

/**
 * Password hashing with Node's built-in scrypt.
 *
 * Why scrypt and not bcrypt/argon2?
 *  - Zero external deps (no native bindings on Windows / macOS).
 *  - Memory-hard and parameterizable (N, r, p) — OWASP-approved.
 *  - First-party, audited in Node core.
 *
 * Stored format: `scrypt$<N>$<r>$<p>$<salt_b64>$<hash_b64>`
 * The parameters are embedded in the hash so we can rotate them later
 * without breaking existing accounts.
 */

// Tuned for ~100ms on a modern CPU. Bump N to 32768 if hardware improves.
const N = 16384;
const R = 8;
const P = 1;
const KEY_LEN = 64;
const SALT_LEN = 16;
const MAX_MEM = 64 * 1024 * 1024; // 64 MiB cap to avoid surprises on small VMs

export function hashPassword(password: string): string {
  if (typeof password !== 'string' || password.length === 0) {
    throw new Error('Password must be a non-empty string.');
  }
  const salt = randomBytes(SALT_LEN);
  const hash = scryptSync(password, salt, KEY_LEN, {
    N,
    r: R,
    p: P,
    maxmem: MAX_MEM,
  });
  return `scrypt$${N}$${R}$${P}$${salt.toString('base64')}$${hash.toString('base64')}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  try {
    const parts = stored.split('$');
    if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
    const n = Number(parts[1]);
    const r = Number(parts[2]);
    const p = Number(parts[3]);
    const salt = Buffer.from(parts[4], 'base64');
    const expected = Buffer.from(parts[5], 'base64');
    if (!salt.length || !expected.length) return false;
    const derived = scryptSync(password, salt, expected.length, {
      N: n,
      r,
      p,
      maxmem: MAX_MEM,
    });
    if (derived.length !== expected.length) return false;
    return timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';
import { createHmac } from 'crypto';

/**
 * Email + password accounts stored in MongoDB (users collection),
 * replacing Firebase Auth / Google sign-in.
 *
 * Sessions are stateless JWTs (HS256, signed with AUTH_SECRET) stored in
 * an httpOnly cookie — no session documents in the DB. The user's
 * normalized email doubles as the vault `ownerId`, mirroring how the old
 * code keyed documents by the Firebase uid.
 */

const SESSION_COOKIE = 'vault_session';
const SESSION_DAYS = 30;

export interface SessionUser {
  email: string;
}

/**
 * Session signing key. Resolution order:
 * 1. AUTH_SECRET / VAULT_AUTH_SECRET env (≥16 chars) when available.
 * 2. Deterministically derived from MONGODB_URI — the one env var that
 *    reliably reaches every deployment on this project (new env vars
 *    added later have failed to propagate). Same cluster → same key →
 *    sessions survive every redeploy; rotating the Mongo password
 *    rotates sessions too.
 */
function getSecretKey(): Uint8Array {
  const explicit =
    process.env.AUTH_SECRET && process.env.AUTH_SECRET.length >= 16
      ? process.env.AUTH_SECRET
      : process.env.VAULT_AUTH_SECRET && process.env.VAULT_AUTH_SECRET.length >= 16
      ? process.env.VAULT_AUTH_SECRET
      : null;
  if (explicit) {
    return new TextEncoder().encode(explicit);
  }

  const mongoUri = process.env.MONGODB_URI;
  if (mongoUri && mongoUri.length >= 16) {
    const derived = createHmac('sha256', 'dataadi-vault-auth-v1')
      .update(mongoUri)
      .digest('base64url');
    return new TextEncoder().encode(derived);
  }

  throw new Error('AUTH_SECRET is not set (need at least 16 characters)');
}

export function normalizeEmail(email: unknown): string {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createSessionToken(email: string): Promise<string> {
  return new SignJWT({ email })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(getSecretKey());
}

export async function setSessionCookie(token: string): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

/** True when the failure is a server misconfiguration (missing AUTH_SECRET). */
export function isConfigError(error: unknown): boolean {
  return error instanceof Error && error.message.includes('AUTH_SECRET');
}

/** Returns the signed-in user, or null. Never throws on bad/expired tokens. */
export async function getSessionUser(): Promise<SessionUser | null> {
  try {
    const store = await cookies();
    const token = store.get(SESSION_COOKIE)?.value;
    if (!token) return null;
    const { payload } = await jwtVerify(token, getSecretKey());
    const email =
      typeof payload.email === 'string'
        ? normalizeEmail(payload.email)
        : '';
    return email ? { email } : null;
  } catch {
    return null;
  }
}

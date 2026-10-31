import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';

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

function getSecretKey(): Uint8Array {
  // VAULT_AUTH_SECRET is the primary name; AUTH_SECRET kept as an alias
  // for older deployments configured with it.
  const secret = process.env.VAULT_AUTH_SECRET || process.env.AUTH_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error('AUTH_SECRET is not set (need at least 16 characters)');
  }
  return new TextEncoder().encode(secret);
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

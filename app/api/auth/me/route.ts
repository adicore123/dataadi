import { NextResponse } from 'next/server';
import { getSessionUser, setSessionCookie, createSessionToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * Session probe used by the client on load — replaces onAuthStateChanged.
 * A valid session is silently re-issued with a fresh expiry window, so an
 * actively used device never has to unlock the vault again.
 */
export async function GET() {
  const user = await getSessionUser();
  if (user?.email) {
    try {
      await setSessionCookie(await createSessionToken(user.email));
    } catch {
      // Refresh is best-effort — the existing cookie still works.
    }
  }
  return NextResponse.json({ email: user?.email ?? null });
}

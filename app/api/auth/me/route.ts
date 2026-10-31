import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/** Session probe used by the client on load — replaces onAuthStateChanged. */
export async function GET() {
  const user = await getSessionUser();
  return NextResponse.json({ email: user?.email ?? null });
}

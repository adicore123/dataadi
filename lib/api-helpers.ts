import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';

/**
 * Shared helpers for the vault API routes — collapse the repeated
 * 401 guard / error-JSON / 500 catch patterns.
 */

/** Returns the signed-in user's email, or null (callers answer 401). */
export async function requireUser(): Promise<string | null> {
  const user = await getSessionUser();
  return user?.email ?? null;
}

export function jsonError(error: string, status: 400 | 401 | 403 | 404 | 500) {
  return NextResponse.json({ error }, { status });
}

export function jsonOk() {
  return NextResponse.json({ ok: true });
}

/** Logs the error server-side and answers a uniform Hebrew 500. */
export function serverError(scope: string, error: unknown) {
  console.error(`${scope} error:`, error);
  return NextResponse.json({ error: 'שגיאת שרת — נסו שוב בעוד רגע' }, { status: 500 });
}

/** Parses a JSON request body, tolerating malformed input (null). */
export async function parseJsonBody(request: Request): Promise<unknown> {
  return request.json().catch(() => null);
}

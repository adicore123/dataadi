import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongo';

export const dynamic = 'force-dynamic';

/** Connectivity probe — replaces testFirestoreConnection(). */
export async function GET() {
  try {
    const db = await getDb();
    await db.command({ ping: 1 });
    const explicit =
      (process.env.AUTH_SECRET && process.env.AUTH_SECRET.length >= 16) ||
      (process.env.VAULT_AUTH_SECRET && process.env.VAULT_AUTH_SECRET.length >= 16);
    return NextResponse.json({
      ok: true,
      // Config diagnostics (never the values themselves).
      secretSource: explicit ? 'env' : process.env.MONGODB_URI ? 'derived' : 'none',
      nodeEnv: process.env.NODE_ENV ?? '',
    });
  } catch (error) {
    console.error('health check failed:', error);
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}

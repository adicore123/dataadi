import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongo';

export const dynamic = 'force-dynamic';

/** Connectivity probe — replaces testFirestoreConnection(). */
export async function GET() {
  try {
    const db = await getDb();
    await db.command({ ping: 1 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('health check failed:', error);
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}

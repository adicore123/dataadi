import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { getPendingSharesCollection } from '@/lib/mongo';

export const dynamic = 'force-dynamic';

/**
 * Escrow bridge for the Android APK share flow — replaces the direct
 * Firestore REST writes ShareSinkActivity used to make.
 *
 * POST /api/pending-shares?id=<uuid>  (no session; guarded by SHARE_SECRET)
 * Body: { name, mime, size, dataUrl, secret, expiresAtMs }
 * Mirrors the old firestore.rules contract: exact field set, secret match,
 * TTL window up to 15 minutes, dataUrl 8..800,000 chars, size ≤ 1MB.
 * The stored doc self-destructs via the TTL index on expiresAt.
 */

const MAX_TTL_MS = 15 * 60 * 1000;
const MAX_SIZE_BYTES = 1_000_000;
const MAX_DATAURL_CHARS = 800_000;
const MIN_DATAURL_CHARS = 8;
const ID_RE = /^[a-zA-Z0-9_-]{8,64}$/;

function secretMatches(candidate: unknown): boolean {
  const expected = process.env.SHARE_SECRET ?? '';
  if (!expected || typeof candidate !== 'string') return false;
  const a = Buffer.from(candidate);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

function clampStr(value: unknown, max: number, fallback = ''): string {
  return typeof value === 'string' ? value.slice(0, max) : fallback;
}

export async function POST(request: NextRequest) {
  try {
    const id = request.nextUrl.searchParams.get('id') ?? '';
    if (!ID_RE.test(id)) {
      return NextResponse.json({ error: 'bad id' }, { status: 400 });
    }

    const body = await request.json().catch(() => null);
    const b = (body ?? {}) as Record<string, unknown>;

    if (!secretMatches(b.secret)) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }

    const name = clampStr(b.name, 255, 'shared-file') || 'shared-file';
    const mime = clampStr(b.mime, 128, 'application/octet-stream') || 'application/octet-stream';
    const sizeRaw = Number(b.size);
    const size = Number.isFinite(sizeRaw)
      ? Math.min(MAX_SIZE_BYTES, Math.max(0, Math.round(sizeRaw)))
      : 0;
    const dataUrl = typeof b.dataUrl === 'string' ? b.dataUrl : '';
    if (dataUrl.length < MIN_DATAURL_CHARS || dataUrl.length > MAX_DATAURL_CHARS || !dataUrl.startsWith('data:')) {
      return NextResponse.json({ error: 'bad dataUrl' }, { status: 400 });
    }
    const expiresAtMsRaw = Number(b.expiresAtMs);
    if (!Number.isFinite(expiresAtMsRaw)) {
      return NextResponse.json({ error: 'bad expiry' }, { status: 400 });
    }
    const now = Date.now();
    const expiresAtMs = Math.min(now + MAX_TTL_MS, Math.max(now + 1000, Math.round(expiresAtMsRaw)));

    const sharesCol = await getPendingSharesCollection();
    await sharesCol.replaceOne(
      { _id: id },
      { name, mime, size, dataUrl, expiresAtMs, expiresAt: new Date(expiresAtMs) },
      { upsert: true }
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('pending-shares POST error:', error);
    return NextResponse.json({ error: 'server error' }, { status: 500 });
  }
}

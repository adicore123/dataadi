import { NextRequest, NextResponse } from 'next/server';
import { getPendingSharesCollection } from '@/lib/mongo';

export const dynamic = 'force-dynamic';

/**
 * One-time escrow pickup — the web replacement for the anonymous
 * getDoc + deleteDoc on Firestore's pending_shares collection.
 *
 * GET /api/pending-shares/[id]  (no session; the unguessable id is the
 * capability, exactly like the old rules-based flow). The document is
 * deleted atomically as it is read and only while unexpired.
 */

const ID_RE = /^[a-zA-Z0-9_-]{8,64}$/;

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  if (!ID_RE.test(id)) {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }
  try {
    const sharesCol = await getPendingSharesCollection();
    const doc = await sharesCol.findOneAndDelete({
      _id: id,
      expiresAt: { $gt: new Date() },
    });
    if (!doc) {
      return NextResponse.json({ error: 'not found' }, { status: 404 });
    }
    return NextResponse.json({
      name: doc.name,
      mime: doc.mime,
      size: doc.size,
      dataUrl: doc.dataUrl,
    });
  } catch (error) {
    console.error('pending-shares GET error:', error);
    return NextResponse.json({ error: 'server error' }, { status: 500 });
  }
}

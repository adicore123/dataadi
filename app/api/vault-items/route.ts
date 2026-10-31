import { NextRequest, NextResponse } from 'next/server';
import { getVaultItemsCollection } from '@/lib/mongo';
import { getSessionUser } from '@/lib/auth';
import { parseVaultItemCreate } from '@/lib/vault-validation';

export const dynamic = 'force-dynamic';

/** GET /api/vault-items — every item owned by the signed-in user. */
export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'נדרשת התחברות' }, { status: 401 });
  }
  try {
    const itemsCol = await getVaultItemsCollection();
    const docs = await itemsCol
      .find({ ownerId: user.email })
      .sort({ createdAtIso: -1 })
      .toArray();
    const items = docs.map((doc) => ({
      id: doc._id,
      title: doc.title,
      module: doc.module,
      albumId: doc.albumId,
      albumName: doc.albumName,
      createdAtIso: doc.createdAtIso,
      formattedDate: doc.formattedDate,
      formattedTime: doc.formattedTime,
      fileName: doc.fileName,
      fileSize: doc.fileSize,
      mimeType: doc.mimeType,
      dataUrl: doc.dataUrl,
      durationSec: doc.durationSec,
      notes: doc.notes,
      source: doc.source,
    }));
    return NextResponse.json(items);
  } catch (error) {
    console.error('vault-items GET error:', error);
    return NextResponse.json({ error: 'שגיאת שרת בטעינת הפריטים' }, { status: 500 });
  }
}

/** POST /api/vault-items — create/upsert an item (server sets ownerId). */
export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'נדרשת התחברות' }, { status: 401 });
  }
  try {
    const body = await request.json().catch(() => null);
    const parsed = parseVaultItemCreate(body);
    if ('error' in parsed) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const now = new Date();
    const doc = {
      ...parsed.doc,
      ownerId: user.email,
      createdAt: now,
      updatedAt: now,
    };
    // Upsert keeps the sign-in backfill idempotent (same client id retried).
    const itemsCol = await getVaultItemsCollection();
    await itemsCol.replaceOne({ _id: parsed.id, ownerId: user.email }, doc, {
      upsert: true,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('vault-items POST error:', error);
    return NextResponse.json({ error: 'שגיאת שרת בשמירת הפריט' }, { status: 500 });
  }
}

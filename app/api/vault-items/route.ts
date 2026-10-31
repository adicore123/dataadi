import { NextRequest } from 'next/server';
import { getVaultItemsCollection } from '@/lib/mongo';
import { parseVaultItemCreate } from '@/lib/vault-validation';
import { requireUser, jsonError, jsonOk, serverError, parseJsonBody } from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';

/** GET /api/vault-items — every item owned by the signed-in user. */
export async function GET() {
  const email = await requireUser();
  if (!email) return jsonError('נדרשת התחברות', 401);
  try {
    const itemsCol = await getVaultItemsCollection();
    const docs = await itemsCol
      .find({ ownerId: email })
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
    return Response.json(items);
  } catch (error) {
    return serverError('vault-items GET', error);
  }
}

/** POST /api/vault-items — create/upsert an item (server sets ownerId). */
export async function POST(request: NextRequest) {
  const email = await requireUser();
  if (!email) return jsonError('נדרשת התחברות', 401);
  try {
    const parsed = parseVaultItemCreate(await parseJsonBody(request));
    if ('error' in parsed) {
      return jsonError(parsed.error, 400);
    }

    const now = new Date();
    const doc = {
      ...parsed.doc,
      ownerId: email,
      createdAt: now,
      updatedAt: now,
    };
    // Upsert keeps the sign-in backfill idempotent (same client id retried).
    const itemsCol = await getVaultItemsCollection();
    await itemsCol.replaceOne({ _id: parsed.id, ownerId: email }, doc, {
      upsert: true,
    });
    return jsonOk();
  } catch (error) {
    return serverError('vault-items POST', error);
  }
}

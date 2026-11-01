import { NextRequest } from 'next/server';
import { getVaultItemsCollection } from '@/lib/mongo';
import { parseVaultItemCreate } from '@/lib/vault-validation';
import { requireUser, jsonError, jsonOk, serverError, parseJsonBody } from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';

/** Recycled items older than this are purged on sight (lazy GC). */
const TRASH_RETENTION_DAYS = 30;

/**
 * GET /api/vault-items — every item owned by the signed-in user.
 * `?trash=1` returns only recycled items (and purges stale ones first).
 */
export async function GET(request: NextRequest) {
  const email = await requireUser();
  if (!email) return jsonError('נדרשת התחברות', 401);
  try {
    const itemsCol = await getVaultItemsCollection();
    const trash = request.nextUrl.searchParams.get('trash') === '1';

    if (trash) {
      // ISO strings compare lexicographically — same ordering as dates.
      const cutoff = new Date(Date.now() - TRASH_RETENTION_DAYS * 86_400_000).toISOString();
      await itemsCol.deleteMany({ ownerId: email, deletedAt: { $lt: cutoff } });
    }

    const query: Record<string, unknown> = { ownerId: email };
    query.deletedAt = trash ? { $type: 'string', $ne: '' } : null;

    const docs = await itemsCol
      .find(query)
      .sort({ createdAtIso: -1 })
      .toArray();
    const items = docs.map((doc) => ({
      id: doc._id,
      title: doc.title,
      module: doc.module,
      // Legacy docs stored albumId/albumName (photos-only era) — surface
      // them uniformly as folder fields.
      folderId: doc.folderId ?? doc.albumId ?? '',
      folderName: doc.folderName ?? doc.albumName ?? '',
      tags: doc.tags ?? [],
      favorite: doc.favorite === true,
      expiresAt: doc.expiresAt,
      deletedAt: doc.deletedAt,
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

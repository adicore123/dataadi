import { NextRequest } from 'next/server';
import { getFoldersCollection, getDb } from '@/lib/mongo';
import { parseFolderCreate } from '@/lib/vault-validation';
import { requireUser, jsonError, jsonOk, serverError, parseJsonBody } from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';

/**
 * GET /api/folders — every folder owned by the signed-in user.
 * Lazily migrates the legacy photo_albums collection into folders
 * (module: 'photos') the first time a user has no folders yet.
 */
export async function GET() {
  const email = await requireUser();
  if (!email) return jsonError('נדרשת התחברות', 401);
  try {
    const foldersCol = await getFoldersCollection();

    // One-time migration: photo albums become photos folders.
    let folders = await foldersCol.find({ ownerId: email }).sort({ createdAtIso: -1 }).toArray();
    if (folders.length === 0) {
      const db = await getDb();
      const legacy = await db
        .collection<{ _id: unknown; name: string; createdAtIso: string }>('photo_albums')
        .find({ ownerId: email })
        .sort({ createdAtIso: -1 })
        .toArray();
      if (legacy.length > 0) {
        const now = new Date();
        await foldersCol.insertMany(
          legacy.map((album) => ({
            _id: String(album._id),
            ownerId: email,
            name: album.name,
            module: 'photos',
            createdAtIso: album.createdAtIso,
            createdAt: now,
            updatedAt: now,
          }))
        );
        await db.collection('photo_albums').deleteMany({ ownerId: email });
        folders = await foldersCol.find({ ownerId: email }).sort({ createdAtIso: -1 }).toArray();
      }
    }

    return Response.json(
      folders.map((doc) => ({
        id: doc._id,
        name: doc.name,
        module: doc.module,
        createdAtIso: doc.createdAtIso,
      }))
    );
  } catch (error) {
    return serverError('folders GET', error);
  }
}

/** POST /api/folders — create/upsert a folder (server sets ownerId). */
export async function POST(request: NextRequest) {
  const email = await requireUser();
  if (!email) return jsonError('נדרשת התחברות', 401);
  try {
    const parsed = parseFolderCreate(await parseJsonBody(request));
    if ('error' in parsed) {
      return jsonError(parsed.error, 400);
    }
    const now = new Date();
    const foldersCol = await getFoldersCollection();
    await foldersCol.replaceOne(
      { _id: parsed.id, ownerId: email },
      { ...parsed.doc, ownerId: email, createdAt: now, updatedAt: now },
      { upsert: true }
    );
    return jsonOk();
  } catch (error) {
    return serverError('folders POST', error);
  }
}

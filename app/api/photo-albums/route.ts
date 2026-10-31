import { NextRequest } from 'next/server';
import { getPhotoAlbumsCollection } from '@/lib/mongo';
import { parseAlbumCreate } from '@/lib/vault-validation';
import { requireUser, jsonError, jsonOk, serverError, parseJsonBody } from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';

/** GET /api/photo-albums — every album owned by the signed-in user. */
export async function GET() {
  const email = await requireUser();
  if (!email) return jsonError('נדרשת התחברות', 401);
  try {
    const albumsCol = await getPhotoAlbumsCollection();
    const docs = await albumsCol
      .find({ ownerId: email })
      .sort({ createdAtIso: -1 })
      .toArray();
    const albums = docs.map((doc) => ({
      id: doc._id,
      name: doc.name,
      createdAtIso: doc.createdAtIso,
    }));
    return Response.json(albums);
  } catch (error) {
    return serverError('photo-albums GET', error);
  }
}

/** POST /api/photo-albums — create/upsert an album (server sets ownerId). */
export async function POST(request: NextRequest) {
  const email = await requireUser();
  if (!email) return jsonError('נדרשת התחברות', 401);
  try {
    const parsed = parseAlbumCreate(await parseJsonBody(request));
    if ('error' in parsed) {
      return jsonError(parsed.error, 400);
    }
    const now = new Date();
    const albumsCol = await getPhotoAlbumsCollection();
    await albumsCol.replaceOne(
      { _id: parsed.id, ownerId: email },
      { ...parsed.doc, ownerId: email, createdAt: now, updatedAt: now },
      { upsert: true }
    );
    return jsonOk();
  } catch (error) {
    return serverError('photo-albums POST', error);
  }
}
